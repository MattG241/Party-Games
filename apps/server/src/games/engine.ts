import { GameId } from '@party-blast/shared';
import { BaseGame, GameTickResult } from './base';
import { GameRoom } from '../rooms/types';
import { PlatformPanic } from './platform-panic';
import { BombTag } from './bomb-tag';
import { ArenaBall } from './arena-ball';
import { SumoSmash } from './sumo-smash';
import { KartBlitz } from './kart-blitz';
import { BullseyeBonanza } from './bullseye-bonanza';
import { DoodleDash } from './doodle-dash';
import { ObstacleGauntlet } from './obstacle-gauntlet';
import { TriviaRoyale } from './trivia-royale';
import { RhythmRiot } from './rhythm-riot';

// Map from playerId to input handler function
export type InputHandler = (playerId: string, data: Record<string, unknown>) => void;

export class GameEngine {
  private game: BaseGame;
  private lastTick = Date.now();
  public onInput: InputHandler;

  constructor(gameId: GameId, room: GameRoom) {
    this.game = GameEngine.createGame(gameId, room);
    this.onInput = (playerId: string, data: Record<string, unknown>) => {
      this.game.handleInput(playerId, data);
    };
  }

  private static createGame(gameId: GameId, room: GameRoom): BaseGame {
    switch (gameId) {
      case 'platform-panic': return new PlatformPanic(room);
      case 'bomb-tag': return new BombTag(room);
      case 'arena-ball': return new ArenaBall(room);
      case 'sumo-smash': return new SumoSmash(room);
      case 'kart-blitz': return new KartBlitz(room);
      case 'bullseye-bonanza': return new BullseyeBonanza(room);
      case 'doodle-dash': return new DoodleDash(room);
      case 'obstacle-gauntlet': return new ObstacleGauntlet(room);
      case 'trivia-royale': return new TriviaRoyale(room);
      case 'rhythm-riot': return new RhythmRiot(room);
      default: return new PlatformPanic(room);
    }
  }

  tick(): void {
    const now = Date.now();
    const dt = Math.min((now - this.lastTick) / 1000, 0.05);
    this.lastTick = now;
    this.game.update(dt);
  }

  handleInput(playerId: string, data: Record<string, unknown>): void {
    this.game.handleInput(playerId, data);
  }

  getState(): GameTickResult {
    return {
      phase: this.game.isFinished() ? 'results' : 'playing',
      timeRemaining: this.game.getTimeRemaining(),
      players: this.game.getPlayerStates(),
      entities: this.game.getEntities(),
      events: this.game.consumeEvents(),
      scores: this.game.getFinalScores(),
    };
  }

  isFinished(): boolean {
    return this.game.isFinished();
  }
}
