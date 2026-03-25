import { GameId } from '@party-blast/shared';
import { shuffleArray } from '@party-blast/shared';
import { GameRoom } from '../rooms/types';
import { GameEngine } from '../games/engine';
import { broadcastToRoom } from '../networking/broadcast';
import { getRoomInfo, getPlayerStates } from '../rooms/manager';

const COUNTDOWN_SEC = 3;

// Store active engines per room so input can reach them
export const activeEngines = new Map<string, GameEngine>();

export function startCountdown(room: GameRoom, gameId: GameId): void {
  room.phase = 'countdown';
  room.currentGame = gameId;

  broadcastToRoom(room, {
    type: 'game_starting',
    gameId,
    countdown: COUNTDOWN_SEC,
  });

  setTimeout(() => startGame(room, gameId), COUNTDOWN_SEC * 1000);
}

export function startGame(room: GameRoom, gameId: GameId): void {
  room.phase = 'playing';
  room.currentGame = gameId;

  const engine = new GameEngine(gameId, room);
  activeEngines.set(room.code, engine);
  let tickCount = 0;

  room.gameLoopInterval = setInterval(() => {
    engine.tick();
    tickCount++;

    const result = engine.getState();

    broadcastToRoom(room, {
      type: 'state',
      tick: tickCount,
      timestamp: Date.now(),
      gameId,
      phase: result.phase,
      timeRemaining: result.timeRemaining,
      players: result.players,
      entities: result.entities,
      events: result.events,
      roomCode: room.code,
      scores: result.scores,
      round: room.currentRound,
      totalRounds: room.settings.totalRounds,
    });

    if (result.phase === 'results' || engine.isFinished()) {
      clearInterval(room.gameLoopInterval!);
      room.gameLoopInterval = null;
      activeEngines.delete(room.code);
      endGame(room, result.scores);
    }
  }, 1000 / 60);
}

export function endGame(room: GameRoom, gameScores: Record<string, number>): void {
  room.phase = 'results';
  room.currentRound++;

  for (const [pid, pts] of Object.entries(gameScores)) {
    const current = room.cumulativeScores.get(pid) ?? 0;
    room.cumulativeScores.set(pid, current + pts);
  }

  const cumulativeScores: Record<string, number> = {};
  for (const [pid, pts] of room.cumulativeScores) {
    cumulativeScores[pid] = pts;
  }

  broadcastToRoom(room, {
    type: 'game_end',
    scores: gameScores,
    cumulativeScores,
    stats: {},
  });

  if (room.currentRound < room.settings.totalRounds) {
    setTimeout(() => startVoting(room), 8000);
  } else {
    setTimeout(() => {
      room.phase = 'victory';
      broadcastToRoom(room, {
        type: 'state',
        tick: 0,
        timestamp: Date.now(),
        gameId: null,
        phase: 'victory',
        timeRemaining: 0,
        players: getPlayerStates(room),
        entities: [],
        events: [],
        roomCode: room.code,
        scores: cumulativeScores,
        round: room.currentRound,
        totalRounds: room.settings.totalRounds,
      });
    }, 8000);
  }
}

export function startVoting(room: GameRoom): void {
  room.phase = 'game-select';
  const enabled = room.settings.enabledGames;
  room.voteOptions = shuffleArray(enabled).slice(0, 3) as GameId[];
  room.votes = new Map();

  broadcastToRoom(room, {
    type: 'game_votes',
    votes: {} as Record<GameId, number>,
    options: room.voteOptions,
  });

  setTimeout(() => resolveVotes(room), 20000);
}

export function recordVote(room: GameRoom, playerId: string, gameId: GameId): void {
  if (!room.voteOptions.includes(gameId)) return;
  room.votes.set(playerId, gameId);

  const voteCounts: Record<GameId, number> = {} as Record<GameId, number>;
  for (const v of room.votes.values()) {
    voteCounts[v] = (voteCounts[v] ?? 0) + 1;
  }

  broadcastToRoom(room, {
    type: 'game_votes',
    votes: voteCounts,
    options: room.voteOptions,
  });

  if (room.votes.size === room.players.size) {
    resolveVotes(room);
  }
}

function resolveVotes(room: GameRoom): void {
  if (room.phase !== 'game-select') return;

  const voteCounts: Record<string, number> = {};
  for (const v of room.votes.values()) {
    voteCounts[v] = (voteCounts[v] ?? 0) + 1;
  }

  let winner = room.voteOptions[0];
  let maxVotes = 0;
  for (const opt of room.voteOptions) {
    const v = voteCounts[opt] ?? 0;
    if (v > maxVotes) { maxVotes = v; winner = opt; }
  }

  startCountdown(room, winner);
}
