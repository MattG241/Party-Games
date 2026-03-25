import { EntityState, GameId, PlayerState } from '@party-blast/shared';
import { BaseGame } from './base';
import { GameRoom } from '../rooms/types';

interface BombPlayer {
  id: string;
  x: number;
  z: number;
  vx: number;
  vz: number;
  hasBomb: boolean;
  eliminated: boolean;
  roundScore: number;
}

export class BombTag extends BaseGame {
  private bombPlayers: Map<string, BombPlayer> = new Map();
  private bombTimer = 0;
  private bombFuse = 0;
  private currentGameRound = 1;
  private totalGameRounds = 5;
  private roundPhase: 'playing' | 'exploded' = 'playing';
  private roundPauseTimer = 0;

  constructor(room: GameRoom) {
    super(room, 300);
    this.initPlayers();
    this.resetBomb();
  }

  get gameId(): GameId { return 'bomb-tag'; }

  private initPlayers(): void {
    let i = 0;
    for (const [id] of this.room.players) {
      const angle = (i / this.room.players.size) * Math.PI * 2;
      this.bombPlayers.set(id, {
        id,
        x: Math.cos(angle) * 8,
        z: Math.sin(angle) * 8,
        vx: 0, vz: 0,
        hasBomb: i === 0,
        eliminated: false,
        roundScore: 0,
      });
      i++;
    }
  }

  private resetBomb(): void {
    this.bombFuse = 15 + Math.random() * 15;
    this.bombTimer = 0;
  }

  handleInput(playerId: string, data: Record<string, unknown>): void {
    const player = this.bombPlayers.get(playerId);
    if (!player || player.eliminated) return;

    const joystick = data.joystick as { x: number; y: number } | undefined;
    if (joystick) {
      player.vx = joystick.x * 6;
      player.vz = joystick.y * 6;
    }

    const buttons = data.buttons as Record<string, boolean> | undefined;
    if (buttons?.tag && player.hasBomb) {
      let nearest: BombPlayer | null = null;
      let nearestDist = 3;
      for (const [pid, other] of this.bombPlayers) {
        if (pid === playerId || other.eliminated) continue;
        const dx = player.x - other.x;
        const dz = player.z - other.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = other;
        }
      }
      if (nearest) {
        player.hasBomb = false;
        nearest.hasBomb = true;
        this.emitEvent({
          type: 'event',
          event: 'bomb_pass',
          data: { from: playerId, to: nearest.id },
          affectedPlayers: [playerId, nearest.id],
          timestamp: Date.now(),
        });
      }
    }
  }

  update(dt: number): void {
    if (this.roundPhase === 'exploded') {
      this.roundPauseTimer -= dt;
      if (this.roundPauseTimer <= 0) {
        this.nextRound();
      }
      return;
    }

    for (const p of this.bombPlayers.values()) {
      if (p.eliminated) continue;
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      const r = 12;
      p.x = Math.max(-r, Math.min(r, p.x));
      p.z = Math.max(-r, Math.min(r, p.z));
    }

    const bombHolder = [...this.bombPlayers.values()].find(p => p.hasBomb && !p.eliminated);
    if (bombHolder) {
      this.bombTimer += dt;
      if (this.bombTimer >= this.bombFuse) {
        bombHolder.eliminated = true;
        this.roundPhase = 'exploded';
        this.roundPauseTimer = 3;
        this.emitEvent({
          type: 'event',
          event: 'elimination',
          data: { playerId: bombHolder.id, reason: 'bomb' },
          affectedPlayers: [bombHolder.id],
          timestamp: Date.now(),
        });
        for (const p of this.bombPlayers.values()) {
          if (!p.eliminated) p.roundScore += 5;
        }
        const alive = [...this.bombPlayers.values()].filter(p => !p.eliminated);
        if (alive.length === 1) alive[0].roundScore += 3;
      }
    }
  }

  private nextRound(): void {
    if (this.currentGameRound >= this.totalGameRounds) return;
    this.currentGameRound++;
    this.roundPhase = 'playing';
    for (const p of this.bombPlayers.values()) {
      p.eliminated = false;
    }
    this.resetBomb();
    const players = [...this.bombPlayers.values()];
    players.forEach(p => { p.hasBomb = false; });
    const randomHolder = players[Math.floor(Math.random() * players.length)];
    if (randomHolder) randomHolder.hasBomb = true;
  }

  getEntities(): EntityState[] {
    return [];
  }

  getPlayerStates(): PlayerState[] {
    return [...this.room.players.values()].map(rp => {
      const bp = this.bombPlayers.get(rp.id);
      return {
        id: rp.id,
        name: rp.name,
        color: rp.color,
        score: this.room.cumulativeScores.get(rp.id) ?? 0,
        connected: rp.connected,
        isHost: rp.isHost,
        position: bp ? { x: bp.x, y: 0, z: bp.z } : { x: 0, y: 0, z: 0 },
        eliminated: bp?.eliminated ?? false,
        data: { hasBomb: bp?.hasBomb ?? false, bombTimer: this.bombTimer, bombFuse: this.bombFuse },
      };
    });
  }

  getFinalScores(): Record<string, number> {
    const scores: Record<string, number> = {};
    for (const [id, p] of this.bombPlayers) {
      scores[id] = p.roundScore;
    }
    return scores;
  }

  isFinished(): boolean {
    return this.currentGameRound >= this.totalGameRounds && this.roundPhase === 'exploded' && this.roundPauseTimer <= 0;
  }
}
