import { WebSocket } from 'ws';
import { GameId, GamePhase, PlayerColor } from '@party-blast/shared';
import { RoomSettings } from '@party-blast/shared';

export interface ConnectedPlayer {
  ws: WebSocket;
  id: string;
  name: string;
  color: PlayerColor;
  isHost: boolean;
  score: number;
  connected: boolean;
  lastSeen: number;
  roomCode: string;
}

export interface GameRoom {
  code: string;
  players: Map<string, ConnectedPlayer>;
  phase: GamePhase;
  currentGame: GameId | null;
  settings: RoomSettings;
  createdAt: number;
  lastActivity: number;
  votes: Map<string, GameId>;
  voteOptions: GameId[];
  currentRound: number;
  cumulativeScores: Map<string, number>;
  gameLoopInterval: ReturnType<typeof setInterval> | null;
  tvWs?: WebSocket;
}
