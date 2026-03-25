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
  phase: number; // animation phase
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
  isJumping: boolean;
}

const TRACK_LENGTH = 100;
const TRACK_WIDTH = 12;

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
        isJumping: false,
      });
      i++;
    }
    this.generateObstacles();
  }

  get gameId(): GameId { return 'obstacle-gauntlet'; }

  private generateObstacles(): void {
    let id = 0;
    // Place obstacles along the track
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
    if (joy) {
      p.vx = joy.x * 8;
      p.vz = Math.max(0, joy.y) * 10 + 3; // Always move forward somewhat
    }

    const buttons = data.buttons as Record<string, boolean> | undefined;
    if (buttons?.jump && p.jumpTimer <= 0) {
      p.isJumping = true;
      p.jumpTimer = 0.6;
    }
  }

  update(dt: number): void {
    const elapsed = (Date.now() - this.startTime) / 1000;

    for (const p of this.gPlayers.values()) {
      if (p.eliminated || p.finishPosition > 0) continue;

      p.x += p.vx * dt;
      p.z += p.vz * dt;

      // Keep in bounds
      p.x = Math.max(-TRACK_WIDTH / 2, Math.min(TRACK_WIDTH / 2, p.x));
      p.z = Math.max(0, p.z);

      // Jump timer
      if (p.jumpTimer > 0) {
        p.jumpTimer -= dt;
        if (p.jumpTimer <= 0) p.isJumping = false;
      }

      // Check obstacles
      if (!p.isJumping) {
        for (const obs of this.obstacles) {
          const dz = Math.abs(p.z - obs.z);
          if (dz > 2) continue;

          let hits = false;
          switch (obs.type) {
            case 'wall': {
              const dx = Math.abs(p.x - obs.x);
              if (dx < obs.width / 2 && dz < 0.8) {
                // Push back
                p.z -= 2;
                p.vz = 0;
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
                // Hit the wall part (not the gap)
                p.z -= 2;
                p.vz = 0;
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
        data: { isJumping: gp?.isJumping ?? false, progress: ((gp?.z ?? 0) / TRACK_LENGTH) * 100 },
      };
    });
  }

  getFinalScores(): Record<string, number> {
    const scores: Record<string, number> = {};
    // Finished players get top scores
    this.finishOrder.forEach((id, i) => {
      scores[id] = SCORE_TABLE[i + 1] ?? 3;
    });
    // Remaining scored by progress
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
