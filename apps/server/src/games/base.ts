import { EntityState, GameEvent, GameId, GamePhase, PlayerState } from '@party-blast/shared';
import { GameRoom } from '../rooms/types';

export interface GameTickResult {
  phase: GamePhase;
  timeRemaining: number;
  players: PlayerState[];
  entities: EntityState[];
  events: GameEvent[];
  scores: Record<string, number>;
}

export abstract class BaseGame {
  protected room: GameRoom;
  protected tick = 0;
  protected startTime: number;
  protected duration: number;
  protected events: GameEvent[] = [];

  constructor(room: GameRoom, duration: number) {
    this.room = room;
    this.startTime = Date.now();
    this.duration = duration;
  }

  abstract get gameId(): GameId;
  abstract handleInput(playerId: string, data: Record<string, unknown>): void;
  abstract update(dt: number): void;
  abstract getEntities(): EntityState[];
  abstract getPlayerStates(): PlayerState[];
  abstract getFinalScores(): Record<string, number>;

  getTimeRemaining(): number {
    return Math.max(0, this.duration - (Date.now() - this.startTime) / 1000);
  }

  isFinished(): boolean {
    return this.getTimeRemaining() <= 0;
  }

  consumeEvents(): GameEvent[] {
    const evts = this.events;
    this.events = [];
    return evts;
  }

  protected emitEvent(event: GameEvent): void {
    this.events.push(event);
  }
}
