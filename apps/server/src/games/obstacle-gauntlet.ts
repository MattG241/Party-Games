import { EntityState, GameId, PlayerState } from '@party-blast/shared';
import { SCORE_TABLE } from '@party-blast/shared';
import { BaseGame } from './base';
import { GameRoom } from '../rooms/types';

interface Obstacle {
  id: string;
  type: 'wall' | 'spinner' | 'crusher' | 'gap';
  x: number;
  z: number;
  width: number;
  phase: number;
  speed: number;
}

interface GauntletPlayer {
  id: string;
  x: number;
  z: number;
  vx: number;
  vz: number;
  eliminated: boolean;
  finishPosition: number;
  jumpTimer: number;
  jumpCooldown: number;
  isJumping: boolean;
  stunTimer: number;
}

const TRACK_LENGTH = 100;
const TRACK_WIDTH = 12;
const MOVE_SPEED_X = 8;
const MOVE_SPEED_Z = 10;
const BASE_FORWARD = 2;
const PLAYER_RADIUS = 0.5;
const JUMP_DURATION = 0.5;
const JUMP_COOLDOWN = 0.8;

export class ObstacleGauntlet extends BaseGame {
  private gPlayers: Map<string, GauntletPlayer> = new Map();
  private obstacles: Obstacle[] = [];
  private finishOrder: string[] = [];
  private eliminationOrder: string[] = [];

  constructor(room: GameRoom) {
    super(room, 120);
    let i = 0;
    for (const [id] of room.players) {
      this.gPlayers.set(id, {
        id,
        x: -TRACK_WIDTH / 2 + (i + 1) * (TRACK_WIDTH / (room.players.size + 1)),
        z: 0,
        vx: 0, vz: 0,
        eliminated: false,
        finishPosition: 0,
        jumpTimer: 0,
        jumpCooldown: 0,
        isJumping: false,
        stunTimer: 0,
      });
      i++;
    }
    this.generateObstacles();
  }

  get gameId(): GameId { return 'obstacle-gauntlet'; }

  private generateObstacles(): void {
    let id = 0;
    for (let z = 10; z < TRACK_LENGTH - 5; z += 6) {
      const type = (['wall', 'spinner', 'crusher', 'gap'] as const)[Math.floor(Math.random() * 4)];
      this.obstacles.push({
        id: `obs_${id++}`,
        type,
        x: (Math.random() - 0.5) * (TRACK_WIDTH - 2),
        z,
        width: type === 'gap' ? 4 : (2 + Math.random() * 3),
        phase: Math.random() * Math.PI * 2,
        speed: 1 + Math.random() * 2,
      });
    }
  }

  handleInput(playerId: string, data: Record<string, unknown>): void {
    const p = this.gPlayers.get(playerId);
    if (!p || p.eliminated || p.finishPosition > 0) return;

    const joy = data.joystick as { x: number; y: number } | undefined;
    if (joy && p.stunTimer <= 0) {
      p.vx = joy.x * MOVE_SPEED_X;
      // Phone Y is inverted: pushing up = negative Y = run forward (+Z)
      const forwardInput = Math.max(0, -joy.y);
      const backInput = Math.max(0, joy.y);
      p.vz = BASE_FORWARD + forwardInput * MOVE_SPEED_Z - backInput * 3;
    }

    const buttons = data.buttons as Record<string, boolean> | undefined;
    if (buttons?.jump && p.jumpCooldown <= 0 && !p.isJumping && p.stunTimer <= 0) {
      p.isJumping = true;
      p.jumpTimer = JUMP_DURATION;
      p.jumpCooldown = JUMP_COOLDOWN;
    }
  }

  update(dt: number): void {
    const elapsed = (Date.now() - this.startTime) / 1000;

    for (const p of this.gPlayers.values()) {
      if (p.eliminated || p.finishPosition > 0) continue;

      // Stun countdown
      if (p.stunTimer > 0) {
        p.stunTimer -= dt;
        p.vz = 0;
        p.vx = 0;
      }

      // Jump timer
      if (p.jumpTimer > 0) {
        p.jumpTimer -= dt;
        if (p.jumpTimer <= 0) p.isJumping = false;
      }
      if (p.jumpCooldown > 0) p.jumpCooldown -= dt;

      p.x += p.vx * dt;
      p.z += p.vz * dt;

      // Keep in bounds
      p.x = Math.max(-TRACK_WIDTH / 2, Math.min(TRACK_WIDTH / 2, p.x));
      p.z = Math.max(0, p.z);

      // Check obstacles (jumping skips obstacle collision)
      if (!p.isJumping) {
        for (const obs of this.obstacles) {
          const dz = Math.abs(p.z - obs.z);
          if (dz > 2) continue;

          let hits = false;
          switch (obs.type) {
            case 'wall': {
              const dx = Math.abs(p.x - obs.x);
              if (dx < obs.width / 2 && dz < 0.8) {
                // Push back smoothly
                p.vz = -2;
                p.stunTimer = 0.3;
              }
              break;
            }
            case 'spinner': {
              const spinX = obs.x + Math.sin(elapsed * obs.speed + obs.phase) * (obs.width / 2);
              const dx = Math.abs(p.x - spinX);
              if (dx < 1.2 && dz < 1) {
                hits = true;
              }
              break;
            }
            case 'crusher': {
              const crushActive = Math.sin(elapsed * obs.speed + obs.phase) > 0.3;
              if (crushActive) {
                const dx = Math.abs(p.x - obs.x);
                if (dx < obs.width / 2 && dz < 1) {
                  hits = true;
                }
              }
              break;
            }
            case 'gap': {
              const gapCenter = obs.x + Math.sin(elapsed * obs.speed * 0.5 + obs.phase) * 3;
              const dx = Math.abs(p.x - gapCenter);
              if (dz < 0.8 && dx > obs.width / 2) {
                // Hit wall part — push back and stun
                p.vz = -2;
                p.stunTimer = 0.3;
              }
              break;
            }
          }

          if (hits) {
            p.eliminated = true;
            this.eliminationOrder.push(p.id);
            this.emitEvent({
              type: 'event',
              event: 'elimination',
              data: { playerId: p.id, obstacle: obs.type },
              affectedPlayers: [p.id],
              timestamp: Date.now(),
            });
            break;
          }
        }
      }

      // Check finish
      if (p.z >= TRACK_LENGTH) {
        this.finishOrder.push(p.id);
        p.finishPosition = this.finishOrder.length;
        this.emitEvent({
          type: 'event',
          event: 'finish_line',
          data: { playerId: p.id, position: p.finishPosition },
          affectedPlayers: [p.id],
          timestamp: Date.now(),
        });
      }
    }

    // Player-player collisions
    const active = [...this.gPlayers.values()].filter(p => !p.eliminated && p.finishPosition === 0);
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const a = active[i], b = active[j];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < PLAYER_RADIUS * 2 && dist > 0) {
          const nx = dx / dist;
          const nz = dz / dist;
          const overlap = PLAYER_RADIUS * 2 - dist;
          a.x -= nx * overlap * 0.5;
          b.x += nx * overlap * 0.5;
        }
      }
    }
  }

  getEntities(): EntityState[] {
    const elapsed = (Date.now() - this.startTime) / 1000;
    return this.obstacles.map(obs => ({
      id: obs.id,
      type: `obstacle_${obs.type}`,
      position: {
        x: obs.type === 'spinner'
          ? obs.x + Math.sin(elapsed * obs.speed + obs.phase) * (obs.width / 2)
          : obs.x,
        y: 0,
        z: obs.z,
      },
      data: {
        width: obs.width,
        obsType: obs.type,
        active: obs.type === 'crusher' ? Math.sin(elapsed * obs.speed + obs.phase) > 0.3 : true,
        gapCenter: obs.type === 'gap'
          ? obs.x + Math.sin(elapsed * obs.speed * 0.5 + obs.phase) * 3
          : undefined,
      },
    }));
  }

  getPlayerStates(): PlayerState[] {
    // Find the average Z of alive players for camera tracking
    const alivePlayers = [...this.gPlayers.values()].filter(p => !p.eliminated && p.finishPosition === 0);
    const avgZ = alivePlayers.length > 0
      ? alivePlayers.reduce((sum, p) => sum + p.z, 0) / alivePlayers.length
      : 0;

    return [...this.room.players.values()].map(rp => {
      const gp = this.gPlayers.get(rp.id);
      return {
        id: rp.id,
        name: rp.name,
        color: rp.color,
        score: this.room.cumulativeScores.get(rp.id) ?? 0,
        connected: rp.connected,
        isHost: rp.isHost,
        position: gp ? { x: gp.x, y: gp.isJumping ? 2 : 0, z: gp.z } : { x: 0, y: 0, z: 0 },
        eliminated: gp?.eliminated ?? false,
        finishPosition: gp?.finishPosition ?? 0,
        data: {
          isJumping: gp?.isJumping ?? false,
          progress: ((gp?.z ?? 0) / TRACK_LENGTH) * 100,
          jumpCooldown: Math.max(0, gp?.jumpCooldown ?? 0),
          stunned: (gp?.stunTimer ?? 0) > 0,
          finished: (gp?.finishPosition ?? 0) > 0,
          avgZ,
        },
      };
    });
  }

  getFinalScores(): Record<string, number> {
    const scores: Record<string, number> = {};
    this.finishOrder.forEach((id, i) => {
      scores[id] = SCORE_TABLE[i + 1] ?? 3;
    });
    const remaining = [...this.gPlayers.values()]
      .filter(p => p.finishPosition === 0)
      .sort((a, b) => {
        if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
        return b.z - a.z;
      });
    remaining.forEach((p, i) => {
      scores[p.id] = SCORE_TABLE[this.finishOrder.length + i + 1] ?? 3;
    });
    for (const [id] of this.room.players) {
      if (!scores[id]) scores[id] = 3;
    }
    return scores;
  }

  isFinished(): boolean {
    const allDone = [...this.gPlayers.values()].every(p => p.finishPosition > 0 || p.eliminated);
    return allDone || super.isFinished();
  }
}
