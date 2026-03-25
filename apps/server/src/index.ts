import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import QRCode from 'qrcode';
import { ClientMessage } from '@party-blast/shared';
import {
  createRoom, joinRoom, rejoinRoom,
  getRoomInfo, rooms, cleanExpiredRooms,
} from './rooms/manager';
import { broadcastToRoom, sendToPlayer } from './networking/broadcast';
import { startCountdown, recordVote, activeEngines } from './state/machine';

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

// Serve static frontend builds in production
const tvBuildPath = path.resolve(__dirname, '../../tv-screen/dist');
const controllerBuildPath = path.resolve(__dirname, '../../phone-controller/dist');

app.use('/tv', express.static(tvBuildPath));
app.use('/play', express.static(controllerBuildPath));

// SPA fallbacks
app.get('/tv/*', (_req, res) => {
  res.sendFile(path.join(tvBuildPath, 'index.html'));
});
app.get('/play/*', (_req, res) => {
  res.sendFile(path.join(controllerBuildPath, 'index.html'));
});

// Redirect root to TV screen
app.get('/', (_req, res) => {
  res.redirect('/tv');
});

// REST endpoints
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', rooms: rooms.size });
});

app.get('/qr/:code', async (req, res) => {
  const baseUrl = process.env.CLIENT_URL ?? `${req.protocol}://${req.get('host')}/play`;
  const url = `${baseUrl}?room=${req.params.code}`;
  try {
    const qr = await QRCode.toDataURL(url);
    res.json({ qr, url });
  } catch {
    res.status(500).json({ error: 'QR generation failed' });
  }
});

app.get('/room/:code', (req, res) => {
  const room = rooms.get(req.params.code.toUpperCase());
  if (!room) return res.status(404).json({ error: 'Room not found' });
  return res.json(getRoomInfo(room));
});

// WebSocket handler
wss.on('connection', (ws: WebSocket) => {
  let currentPlayerId: string | null = null;
  let currentRoomCode: string | null = null;

  ws.on('message', (raw) => {
    let msg: ClientMessage;
    try { msg = JSON.parse(raw.toString()); }
    catch { return; }

    switch (msg.type) {
      case 'create_room': {
        const { room, player } = createRoom(ws);
        currentPlayerId = player.id;
        currentRoomCode = room.code;
        sendToPlayer(ws, { type: 'room_created', code: room.code, playerId: player.id });
        break;
      }

      case 'join_room': {
        const result = joinRoom(msg.code, msg.playerName, msg.color, ws);
        if ('error' in result) {
          sendToPlayer(ws, { type: 'room_error', message: result.error });
          return;
        }
        const { room, player } = result;
        currentPlayerId = player.id;
        currentRoomCode = room.code;
        sendToPlayer(ws, { type: 'room_joined', roomInfo: getRoomInfo(room), playerId: player.id });
        broadcastToRoom(room, {
          type: 'player_joined',
          player: {
            id: player.id,
            name: player.name,
            color: player.color,
            score: 0,
            connected: true,
            isHost: player.isHost,
          },
          roomInfo: getRoomInfo(room),
        });
        break;
      }

      case 'rejoin_room': {
        const player = rejoinRoom(msg.code, msg.playerId, ws);
        if (!player) {
          sendToPlayer(ws, { type: 'room_error', message: 'Cannot rejoin. Room may have ended.' });
          return;
        }
        const room = rooms.get(msg.code)!;
        currentPlayerId = player.id;
        currentRoomCode = msg.code;
        sendToPlayer(ws, { type: 'room_joined', roomInfo: getRoomInfo(room), playerId: player.id });
        broadcastToRoom(room, {
          type: 'player_joined',
          player: {
            id: player.id,
            name: player.name,
            color: player.color,
            score: room.cumulativeScores.get(player.id) ?? 0,
            connected: true,
            isHost: player.isHost,
          },
          roomInfo: getRoomInfo(room),
        });
        break;
      }

      case 'start_game': {
        const room = rooms.get(msg.roomCode);
        if (!room) return;
        const player = room.players.get(msg.playerId);
        if (!player?.isHost) return;
        if (room.players.size < 2) {
          sendToPlayer(ws, { type: 'room_error', message: 'Need at least 2 players to start.' });
          return;
        }
        const gameId = room.settings.enabledGames[0] ?? 'platform-panic';
        startCountdown(room, gameId);
        break;
      }

      case 'vote_game': {
        const room = rooms.get(msg.roomCode);
        if (room) recordVote(room, msg.playerId, msg.gameId);
        break;
      }

      case 'select_game': {
        const room = rooms.get(msg.roomCode);
        if (!room) return;
        const player = room.players.get(msg.playerId);
        if (!player?.isHost) return;
        startCountdown(room, msg.gameId);
        break;
      }

      case 'update_settings': {
        const room = rooms.get(msg.roomCode);
        if (!room) return;
        const player = room.players.get(msg.playerId);
        if (!player?.isHost) return;
        Object.assign(room.settings, msg.settings);
        broadcastToRoom(room, { type: 'settings_updated', settings: room.settings });
        break;
      }

      case 'input': {
        const room = rooms.get(msg.roomCode);
        if (room?.phase === 'playing') {
          const engine = activeEngines.get(msg.roomCode);
          if (engine) {
            engine.handleInput(msg.playerId, msg.data as Record<string, unknown>);
          }
        }
        break;
      }

      case 'leave_room': {
        // Handled on close
        break;
      }
    }
  });

  ws.on('close', () => {
    if (currentPlayerId && currentRoomCode) {
      const room = rooms.get(currentRoomCode);
      if (room) {
        const player = room.players.get(currentPlayerId);
        if (player) {
          player.connected = false;
          player.lastSeen = Date.now();
          broadcastToRoom(room, {
            type: 'player_left',
            playerId: currentPlayerId,
            roomInfo: getRoomInfo(room),
          });
        }
      }
    }
  });

  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      sendToPlayer(ws, { type: 'ping', timestamp: Date.now() });
    } else {
      clearInterval(pingInterval);
    }
  }, 30000);
});

setInterval(cleanExpiredRooms, 10 * 60 * 1000);

server.listen(PORT, () => {
  console.log(`Party Blast Server running on port ${PORT}`);
  console.log(`  WebSocket: ws://localhost:${PORT}`);
  console.log(`  HTTP:      http://localhost:${PORT}`);
});
