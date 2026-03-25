import { GameId, PlayerColor, RoomSettings } from '../types';

export const TICK_RATE = 60;
export const INPUT_RATE = 30;
export const MAX_PLAYERS = 8;
export const MIN_PLAYERS = 1;
export const ROOM_CODE_LENGTH = 4;
export const ROOM_EXPIRY_MS = 2 * 60 * 60 * 1000; // 2 hours
export const RECONNECT_WINDOW_MS = 30 * 1000; // 30 seconds

export const PLAYER_COLORS: PlayerColor[] = [
  'red', 'blue', 'green', 'yellow', 'purple', 'orange', 'cyan', 'pink'
];

export const COLOR_HEX: Record<PlayerColor, string> = {
  red: '#FF3B3B',
  blue: '#3B8BFF',
  green: '#3BFF6A',
  yellow: '#FFE03B',
  purple: '#C03BFF',
  orange: '#FF8C3B',
  cyan: '#3BFFF0',
  pink: '#FF3BB0',
};

export const GAME_NAMES: Record<GameId, string> = {
  'kart-blitz': 'Kart Blitz',
  'arena-ball': 'Arena Ball',
  'bullseye-bonanza': 'Bullseye Bonanza',
  'platform-panic': 'Platform Panic',
  'doodle-dash': 'Doodle Dash',
  'bomb-tag': 'Bomb Tag',
  'obstacle-gauntlet': 'Obstacle Gauntlet',
  'trivia-royale': 'Trivia Royale',
  'sumo-smash': 'Sumo Smash',
  'rhythm-riot': 'Rhythm Riot',
};

export const GAME_EMOJIS: Record<GameId, string> = {
  'kart-blitz': '🏎️',
  'arena-ball': '⚽',
  'bullseye-bonanza': '🎯',
  'platform-panic': '🧊',
  'doodle-dash': '🎨',
  'bomb-tag': '💣',
  'obstacle-gauntlet': '🏃',
  'trivia-royale': '🧠',
  'sumo-smash': '🥊',
  'rhythm-riot': '🎵',
};

export const SCORE_TABLE: Record<number, number> = {
  1: 15, 2: 12, 3: 10, 4: 8, 5: 6, 6: 5, 7: 4, 8: 3
};

export const DEFAULT_SETTINGS: RoomSettings = {
  totalRounds: 5,
  enabledGames: ['kart-blitz', 'arena-ball', 'bullseye-bonanza', 'platform-panic', 'doodle-dash', 'bomb-tag', 'obstacle-gauntlet', 'trivia-royale', 'sumo-smash', 'rhythm-riot'],
  difficulty: 'normal',
};

export const GAME_DURATIONS: Record<GameId, number> = {
  'kart-blitz': 180,
  'arena-ball': 180,
  'bullseye-bonanza': 90,
  'platform-panic': 180,
  'doodle-dash': 480,
  'bomb-tag': 300,
  'obstacle-gauntlet': 120,
  'trivia-royale': 300,
  'sumo-smash': 240,
  'rhythm-riot': 180,
};
