import { WebSocket } from 'ws';
import { GameId, PlayerColor, PlayerState, RoomInfo } from '@party-blast/shared';
import { generateRoomCode, generatePlayerId, shuffleArray } from '@party-blast/shared';
import { DEFAULT_SETTINGS, PLAYER_COLORS } from '@party-blast/shared';
import { ConnectedPlayer, GameRoom } from './types';

export const rooms = new Map<string, GameRoom>();

export function createRoom(hostWs: WebSocket): { room: GameRoom; player: ConnectedPlayer } {
  let code = generateRoomCode();
  while (rooms.has(code)) code = generateRoomCode();

  const hostId = generatePlayerId();
  const host: ConnectedPlayer = {
    ws: hostWs,
    id: hostId,
    name: 'Host',
    color: 'red',
    isHost: true,
    score: 0,
    connected: true,
    lastSeen: Date.now(),
    roomCode: code,
  };

  const room: GameRoom = {
    code,
    players: new Map([[hostId, host]]),
    phase: 'lobby',
    currentGame: null,
    settings: { ...DEFAULT_SETTINGS },
    createdAt: Date.now(),
    lastActivity: Date.now(),
    votes: new Map(),
    voteOptions: [],
    currentRound: 0,
    cumulativeScores: new Map([[hostId, 0]]),
    gameLoopInterval: null,
  };

  rooms.set(code, room);
  return { room, player: host };
}

export function joinRoom(
  code: string,
  playerName: string,
  color: PlayerColor,
  ws: WebSocket
): { room: GameRoom; player: ConnectedPlayer } | { error: string } {
  const room = rooms.get(code.toUpperCase());
  if (!room) return { error: 'Room not found. Check the room code.' };
  if (room.phase !== 'lobby') return { error: 'Game already in progress.' };
  if (room.players.size >= 8) return { error: 'Room is full (max 8 players).' };

  const playerId = generatePlayerId();
  // Ensure unique color
  const takenColors = new Set([...room.players.values()].map(p => p.color));
  let assignedColor: PlayerColor = color;
  if (takenColors.has(color)) {
    const available = PLAYER_COLORS.filter(c => !takenColors.has(c));
    assignedColor = available[0] ?? 'red';
  }

  const player: ConnectedPlayer = {
    ws,
    id: playerId,
    name: playerName.slice(0, 12),
    color: assignedColor,
    isHost: false,
    score: 0,
    connected: true,
    lastSeen: Date.now(),
    roomCode: code.toUpperCase(),
  };

  room.players.set(playerId, player);
  room.cumulativeScores.set(playerId, 0);
  room.lastActivity = Date.now();

  return { room, player };
}

export function rejoinRoom(
  code: string,
  playerId: string,
  ws: WebSocket
): ConnectedPlayer | null {
  const room = rooms.get(code);
  if (!room) return null;
  const player = room.players.get(playerId);
  if (!player) return null;

  player.ws = ws;
  player.connected = true;
  player.lastSeen = Date.now();
  return player;
}

export function removePlayer(roomCode: string, playerId: string): GameRoom | null {
  const room = rooms.get(roomCode);
  if (!room) return null;
  room.players.delete(playerId);
  room.lastActivity = Date.now();

  if (room.players.size === 0) {
    rooms.delete(roomCode);
    return null;
  }

  // Transfer host if needed
  const hasHost = [...room.players.values()].some(p => p.isHost);
  if (!hasHost) {
    const first = [...room.players.values()][0];
    if (first) first.isHost = true;
  }

  return room;
}

export function getRoomInfo(room: GameRoom): RoomInfo {
  return {
    code: room.code,
    hostId: [...room.players.values()].find(p => p.isHost)?.id ?? '',
    players: getPlayerStates(room),
    phase: room.phase,
    currentGame: room.currentGame,
    settings: room.settings,
  };
}

export function getPlayerStates(room: GameRoom): PlayerState[] {
  return [...room.players.values()].map(p => ({
    id: p.id,
    name: p.name,
    color: p.color,
    score: room.cumulativeScores.get(p.id) ?? 0,
    connected: p.connected,
    isHost: p.isHost,
  }));
}

export function cleanExpiredRooms(): void {
  const now = Date.now();
  const EXPIRY = 2 * 60 * 60 * 1000;
  for (const [code, room] of rooms) {
    if (now - room.lastActivity > EXPIRY) {
      if (room.gameLoopInterval) clearInterval(room.gameLoopInterval);
      rooms.delete(code);
    }
  }
}
