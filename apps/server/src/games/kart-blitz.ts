import { EntityState, GameId, PlayerState } from '@party-blast/shared';
import { SCORE_TABLE } from '@party-blast/shared';
import { BaseGame } from './base';
import { GameRoom } from '../rooms/types';

interface Checkpoint {
  x: number;
  z: number;
  radius: number;
}

interface KartPlayer {
  id: string;
  x: number;
  z: number;
  angle: number; // facing direction in radians
  speed: number;
  lap: number;
  checkpoint: number;
  finished: boolean;
  finishTime: number;
  boostTimer: number;
}

const TRACK_CHECKPOINTS: Checkpoint[] = [
  { x: 0, z: -15, radius: 5 },
  { x: 15, z: -10, radius: 5 },
  { x: 18, z: 5, radius: 5 },
  { x: 10, z: 15, radius: 5 },
  { x: -5, z: 18, radius: 5 },
  { x: -18, z: 10, radius: 5 },
  { x: -18, z: -5, radius: 5 },
  { x: -10, z: -15, radius: 5 },
];

const TOTAL_LAPS = 3;
const MAX_SPEED = 12;
const BOOST_SPEED = 18;
const ACCELERATION = 15;
const FRICTION = 0.92;
const TURN_SPEED = 3.5;
const TRACK_RADIUS = 20;

export class KartBlitz extends BaseGame {
  private kartPlayers: Map<string, KartPlayer> = new Map();
  private finishOrder: string[] = [];

  constructor(room: GameRoom) {
    super(room, 180);
    let i = 0;
    for (const [id] of room.players) {
      this.kartPlayers.set(id, {
        id,
        x: -5 + (i % 4) * 3,
        z: -18 + Math.floor(i / 4) * 3,
        angle: Math.PI / 2,
        speed: 0,
        lap: 0,
        checkpoint: 0,
        finished: false,
        finishTime: 0,
        boostTimer: 0,
      });
      i++;
    }
  }

  get gameId(): GameId { return 'kart-blitz'; }

  handleInput(playerId: string, data: Record<string, unknown>): void {
    const p = this.kartPlayers.get(playerId);
    if (!p || p.finished) return;

    const joy = data.joystick as { x: number; y: number } | undefined;
    if (joy) {
      // Store input state - physics applied in update()
      (p as any).steerX = joy.x;
      (p as any).throttle = Math.max(0, joy.y);
      (p as any).brake = Math.max(0, -joy.y);
    }

    const buttons = data.buttons as Record<string, boolean> | undefined;
    if (buttons?.boost && p.boostTimer <= 0) {
      p.boostTimer = 1.5;
      p.speed = Math.min(p.speed + 6, BOOST_SPEED);
    }
  }

  update(dt: number): void {
    for (const p of this.kartPlayers.values()) {
      if (p.finished) continue;

      if (p.boostTimer > 0) p.boostTimer -= dt;

      // Apply steering and acceleration from stored input
      const steerX = (p as any).steerX ?? 0;
      const throttle = (p as any).throttle ?? 0;
      const brake = (p as any).brake ?? 0;
      const maxSpd = p.boostTimer > 0 ? BOOST_SPEED : MAX_SPEED;

      p.angle -= steerX * TURN_SPEED * dt;
      p.speed += throttle * ACCELERATION * dt;
      p.speed -= brake * ACCELERATION * 1.5 * dt;
      p.speed = Math.max(-3, Math.min(maxSpd, p.speed));

      // Move
      p.x += Math.sin(p.angle) * p.speed * dt;
      p.z += Math.cos(p.angle) * p.speed * dt;

      // Friction
      p.speed *= FRICTION;

      // Track boundary - push back toward center if too far
      const distFromCenter = Math.sqrt(p.x * p.x + p.z * p.z);
      if (distFromCenter > TRACK_RADIUS + 5) {
        const nx = p.x / distFromCenter;
        const nz = p.z / distFromCenter;
        p.x = nx * (TRACK_RADIUS + 5);
        p.z = nz * (TRACK_RADIUS + 5);
        p.speed *= 0.5;
      }

      // Checkpoint detection
      const nextCp = TRACK_CHECKPOINTS[p.checkpoint];
      if (nextCp) {
        const dx = p.x - nextCp.x;
        const dz = p.z - nextCp.z;
        if (dx * dx + dz * dz < nextCp.radius * nextCp.radius) {
          p.checkpoint++;
          if (p.checkpoint >= TRACK_CHECKPOINTS.length) {
            p.checkpoint = 0;
            p.lap++;
            this.emitEvent({
              type: 'event',
              event: 'lap_complete',
              data: { playerId: p.id, lap: p.lap },
              affectedPlayers: [p.id],
              timestamp: Date.now(),
            });

            if (p.lap >= TOTAL_LAPS) {
              p.finished = true;
              p.finishTime = Date.now();
              this.finishOrder.push(p.id);
              this.emitEvent({
                type: 'event',
                event: 'finish_line',
                data: { playerId: p.id, position: this.finishOrder.length },
                affectedPlayers: [p.id],
                timestamp: Date.now(),
              });
            }
          }
        }
      }

      // Player-player collisions
      for (const other of this.kartPlayers.values()) {
        if (other.id === p.id || other.finished) continue;
        const dx = other.x - p.x;
        const dz = other.z - p.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < 1.5 && dist > 0) {
          const nx = dx / dist;
          const nz = dz / dist;
          other.x += nx * 0.5;
          other.z += nz * 0.5;
          p.x -= nx * 0.5;
          p.z -= nz * 0.5;
          // Speed transfer
          const avgSpeed = (p.speed + other.speed) / 2;
          p.speed = avgSpeed * 0.8;
          other.speed = avgSpeed * 0.8;
        }
      }
    }
  }

  getEntities(): EntityState[] {
    return TRACK_CHECKPOINTS.map((cp, i) => ({
      id: `cp_${i}`,
      type: 'checkpoint',
      position: { x: cp.x, y: 0, z: cp.z },
      data: { radius: cp.radius, index: i },
    }));
  }

  getPlayerStates(): PlayerState[] {
    return [...this.room.players.values()].map(rp => {
      const kp = this.kartPlayers.get(rp.id);
      return {
        id: rp.id,
        name: rp.name,
        color: rp.color,
        score: this.room.cumulativeScores.get(rp.id) ?? 0,
        connected: rp.connected,
        isHost: rp.isHost,
        position: kp ? { x: kp.x, y: 0, z: kp.z } : { x: 0, y: 0, z: 0 },
        data: {
          angle: kp?.angle ?? 0,
          speed: kp?.speed ?? 0,
          lap: kp?.lap ?? 0,
          checkpoint: kp?.checkpoint ?? 0,
          finished: kp?.finished ?? false,
          boosting: (kp?.boostTimer ?? 0) > 0,
        },
      };
    });
  }

  getFinalScores(): Record<string, number> {
    const scores: Record<string, number> = {};
    // Score by finish order, then by progress
    this.finishOrder.forEach((id, i) => {
      scores[id] = SCORE_TABLE[i + 1] ?? 3;
    });

    // Unfinished players sorted by progress
    const unfinished = [...this.kartPlayers.values()]
      .filter(p => !p.finished)
      .sort((a, b) => {
        if (a.lap !== b.lap) return b.lap - a.lap;
        return b.checkpoint - a.checkpoint;
      });

    unfinished.forEach((p, i) => {
      scores[p.id] = SCORE_TABLE[this.finishOrder.length + i + 1] ?? 3;
    });

    for (const [id] of this.room.players) {
      if (!scores[id]) scores[id] = 3;
    }
    return scores;
  }

  isFinished(): boolean {
    const allFinished = [...this.kartPlayers.values()].every(p => p.finished);
    return allFinished || super.isFinished();
  }
}
