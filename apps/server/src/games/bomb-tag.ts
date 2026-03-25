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
  tagCooldown: number;
}

const ARENA_RADIUS = 12;
const BASE_SPEED = 6;
const BOMB_SPEED_BONUS = 1.5;
const TAG_RANGE = 2.2;
const TAG_COOLDOWN = 0.8;
const PLAYER_RADIUS = 0.6;

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
    this.startRound();
  }

  get gameId(): GameId { return 'bomb-tag'; }

  private initPlayers(): void {
    let i = 0;
    for (const [id] of this.room.players) {
      const angle = (i / this.room.players.size) * Math.PI * 2;
      this.bombPlayers.set(id, {
        id,
        x: Math.cos(angle) * 6,
        z: Math.sin(angle) * 6,
        vx: 0, vz: 0,
        hasBomb: false,
        eliminated: false,
        roundScore: 0,
        tagCooldown: 0,
      });
      i++;
    }
  }

  private startRound(): void {
    // Fuse gets shorter each round for escalating tension
    this.bombFuse = Math.max(8, 18 - (this.currentGameRound - 1) * 2) + Math.random() * 5;
    this.bombTimer = 0;
    this.roundPhase = 'playing';

    // Reposition players in a circle
    const players = [...this.bombPlayers.values()];
    players.forEach((p, i) => {
      const angle = (i / players.length) * Math.PI * 2;
      p.x = Math.cos(angle) * 6;
      p.z = Math.sin(angle) * 6;
      p.vx = 0;
      p.vz = 0;
      p.eliminated = false;
      p.hasBomb = false;
      p.tagCooldown = 0;
    });

    // Random bomb holder
    const randomIdx = Math.floor(Math.random() * players.length);
    if (players[randomIdx]) players[randomIdx].hasBomb = true;
  }

  handleInput(playerId: string, data: Record<string, unknown>): void {
    const player = this.bombPlayers.get(playerId);
    if (!player || player.eliminated) return;

    const joystick = data.joystick as { x: number; y: number } | undefined;
    if (joystick) {
      const speed = player.hasBomb ? BASE_SPEED + BOMB_SPEED_BONUS : BASE_SPEED;
      player.vx = joystick.x * speed;
      player.vz = joystick.y * speed;
    }

    const buttons = data.buttons as Record<string, boolean> | undefined;
    if (buttons?.tag && player.hasBomb && player.tagCooldown <= 0) {
      let nearest: BombPlayer | null = null;
      let nearestDist = TAG_RANGE;
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
        nearest.tagCooldown = TAG_COOLDOWN; // prevent instant tag-back
        this.emitEvent({
          type: 'event',
          event: 'bomb_pass',
          data: { from: playerId, to: nearest.id },
          affectedPlayers: [playerId, nearest.id],
          timestamp: Date.now(),
        });
      }
      player.tagCooldown = TAG_COOLDOWN;
    }
  }

  update(dt: number): void {
    // Always update movement (even during exploded pause for visual continuity)
    for (const p of this.bombPlayers.values()) {
      if (p.eliminated) continue;
      if (p.tagCooldown > 0) p.tagCooldown -= dt;

      p.x += p.vx * dt;
      p.z += p.vz * dt;

      // Circular arena boundary
      const dist = Math.sqrt(p.x * p.x + p.z * p.z);
      if (dist > ARENA_RADIUS) {
        const nx = p.x / dist;
        const nz = p.z / dist;
        p.x = nx * ARENA_RADIUS;
        p.z = nz * ARENA_RADIUS;
        // Bounce off wall slightly
        const dot = p.vx * nx + p.vz * nz;
        if (dot > 0) {
          p.vx -= nx * dot * 1.5;
          p.vz -= nz * dot * 1.5;
        }
      }
    }

    // Player-player collisions
    const alive = [...this.bombPlayers.values()].filter(p => !p.eliminated);
    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        const a = alive[i], b = alive[j];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < PLAYER_RADIUS * 2 && dist > 0) {
          const nx = dx / dist;
          const nz = dz / dist;
          const overlap = PLAYER_RADIUS * 2 - dist;
          a.x -= nx * overlap * 0.5;
          a.z -= nz * overlap * 0.5;
          b.x += nx * overlap * 0.5;
          b.z += nz * overlap * 0.5;
          // Small bump
          a.vx -= nx * 2;
          a.vz -= nz * 2;
          b.vx += nx * 2;
          b.vz += nz * 2;
        }
      }
    }

    if (this.roundPhase === 'exploded') {
      this.roundPauseTimer -= dt;
      if (this.roundPauseTimer <= 0) {
        if (this.currentGameRound < this.totalGameRounds) {
          this.currentGameRound++;
          this.startRound();
        }
      }
      return;
    }

    // Bomb fuse
    const bombHolder = alive.find(p => p.hasBomb);
    if (bombHolder) {
      this.bombTimer += dt;
      if (this.bombTimer >= this.bombFuse) {
        bombHolder.eliminated = true;
        this.roundPhase = 'exploded';
        this.roundPauseTimer = 3;
        this.emitEvent({
          type: 'event',
          event: 'elimination',
          data: { playerId: bombHolder.id, reason: 'bomb', round: this.currentGameRound },
          affectedPlayers: [bombHolder.id],
          timestamp: Date.now(),
        });
        // Survivors score
        for (const p of this.bombPlayers.values()) {
          if (!p.eliminated) p.roundScore += 5;
        }
        const remaining = [...this.bombPlayers.values()].filter(p => !p.eliminated);
        if (remaining.length === 1) remaining[0].roundScore += 3;
      }
    }
  }

  getEntities(): EntityState[] {
    // Send a bomb entity at the holder's position for visual effect
    const holder = [...this.bombPlayers.values()].find(p => p.hasBomb && !p.eliminated);
    if (!holder) return [];
    const fuseProgress = Math.min(1, this.bombTimer / this.bombFuse);
    return [{
      id: 'bomb',
      type: 'bomb',
      position: { x: holder.x, y: 1.5, z: holder.z },
      data: {
        fuseProgress,
        holderId: holder.id,
        timeLeft: Math.max(0, this.bombFuse - this.bombTimer),
      },
    }];
  }

  getPlayerStates(): PlayerState[] {
    const aliveCount = [...this.bombPlayers.values()].filter(p => !p.eliminated).length;
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
        data: {
          hasBomb: bp?.hasBomb ?? false,
          bombTimer: this.bombTimer,
          bombFuse: this.bombFuse,
          fuseProgress: Math.min(1, this.bombTimer / this.bombFuse),
          round: this.currentGameRound,
          totalRounds: this.totalGameRounds,
          roundPhase: this.roundPhase,
          roundScore: bp?.roundScore ?? 0,
          aliveCount,
          tagCooldown: Math.max(0, bp?.tagCooldown ?? 0),
        },
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
