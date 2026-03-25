export type GameId =
  | 'kart-blitz'
  | 'arena-ball'
  | 'bullseye-bonanza'
  | 'platform-panic'
  | 'doodle-dash'
  | 'bomb-tag'
  | 'obstacle-gauntlet'
  | 'trivia-royale'
  | 'sumo-smash'
  | 'rhythm-riot';

export type GamePhase = 'lobby' | 'game-select' | 'countdown' | 'playing' | 'results' | 'victory';

export type PlayerColor = 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'orange' | 'cyan' | 'pink';

export interface PlayerState {
  id: string;
  name: string;
  color: PlayerColor;
  score: number;
  connected: boolean;
  isHost: boolean;
  avatar?: AvatarConfig;
  // game-specific state
  position?: { x: number; y: number; z: number };
  velocity?: { x: number; y: number; z: number };
  health?: number;
  eliminated?: boolean;
  finishPosition?: number;
  data?: Record<string, unknown>;
}

export interface AvatarConfig {
  eyes: number;
  mouth: number;
  hat: number;
}

export interface PlayerInput {
  type: 'input';
  playerId: string;
  roomCode: string;
  gameId: GameId;
  timestamp: number;
  data: {
    joystick?: { x: number; y: number };
    buttons?: Record<string, boolean>;
    gyro?: { alpha: number; beta: number; gamma: number };
    swipe?: { direction: 'up' | 'down' | 'left' | 'right'; velocity: number };
    tap?: { x: number; y: number };
  };
}

export interface EntityState {
  id: string;
  type: string;
  position: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number; w: number };
  velocity?: { x: number; y: number; z: number };
  data?: Record<string, unknown>;
}

export interface GameEvent {
  type: 'event';
  event: 'goal' | 'elimination' | 'pickup' | 'collision' | 'boost' |
         'countdown' | 'game_start' | 'game_end' | 'round_end' | 'player_joined' |
         'player_left' | 'game_selected' | 'score_update' | 'bomb_pass' |
         'platform_fall' | 'ring_out' | 'lap_complete' | 'finish_line';
  data: Record<string, unknown>;
  affectedPlayers: string[];
  timestamp: number;
}

export interface GameState {
  type: 'state';
  tick: number;
  timestamp: number;
  gameId: GameId | null;
  phase: GamePhase;
  timeRemaining: number;
  players: PlayerState[];
  entities: EntityState[];
  events: GameEvent[];
  roomCode: string;
  scores: Record<string, number>; // cumulative scores
  round: number;
  totalRounds: number;
}

export interface RoomInfo {
  code: string;
  hostId: string;
  players: PlayerState[];
  phase: GamePhase;
  currentGame: GameId | null;
  settings: RoomSettings;
}

export interface RoomSettings {
  totalRounds: number;
  enabledGames: GameId[];
  difficulty: 'easy' | 'normal' | 'hard';
}

// WebSocket message types
export type ClientMessage =
  | { type: 'create_room' }
  | { type: 'join_room'; code: string; playerName: string; color: PlayerColor }
  | { type: 'rejoin_room'; code: string; playerId: string }
  | { type: 'leave_room'; roomCode: string; playerId: string }
  | { type: 'start_game'; roomCode: string; playerId: string }
  | { type: 'select_game'; roomCode: string; playerId: string; gameId: GameId }
  | { type: 'vote_game'; roomCode: string; playerId: string; gameId: GameId }
  | { type: 'update_settings'; roomCode: string; playerId: string; settings: Partial<RoomSettings> }
  | { type: 'update_avatar'; roomCode: string; playerId: string; avatar: AvatarConfig }
  | PlayerInput;

export type ServerMessage =
  | { type: 'room_created'; code: string; playerId: string }
  | { type: 'room_joined'; roomInfo: RoomInfo; playerId: string }
  | { type: 'room_error'; message: string }
  | { type: 'player_joined'; player: PlayerState; roomInfo: RoomInfo }
  | { type: 'player_left'; playerId: string; roomInfo: RoomInfo }
  | { type: 'game_starting'; gameId: GameId; countdown: number }
  | { type: 'game_votes'; votes: Record<GameId, number>; options: GameId[] }
  | { type: 'game_end'; scores: Record<string, number>; cumulativeScores: Record<string, number>; stats: Record<string, unknown> }
  | { type: 'settings_updated'; settings: RoomSettings }
  | { type: 'ping'; timestamp: number }
  | GameState;
