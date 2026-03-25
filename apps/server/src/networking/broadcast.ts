import { WebSocket } from 'ws';
import { ServerMessage } from '@party-blast/shared';
import { GameRoom } from '../rooms/types';

export function sendToPlayer(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

export function broadcastToRoom(room: GameRoom, msg: ServerMessage): void {
  const data = JSON.stringify(msg);
  // Send to all phone players
  for (const player of room.players.values()) {
    if (player.connected && player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(data);
    }
  }
  // Also send to TV screen
  if (room.tvWs && room.tvWs.readyState === WebSocket.OPEN) {
    room.tvWs.send(data);
  }
}

export function broadcastToRoomExcept(room: GameRoom, excludeId: string, msg: ServerMessage): void {
  const data = JSON.stringify(msg);
  for (const player of room.players.values()) {
    if (player.id !== excludeId && player.connected && player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(data);
    }
  }
}
