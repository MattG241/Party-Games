import { EntityState, GameId, PlayerState } from '@party-blast/shared';
import { SCORE_TABLE } from '@party-blast/shared';
import { BaseGame } from './base';
import { GameRoom } from '../rooms/types';

interface SumoPlayer {
  id: string;
  x: number;
  z: number;
  vx: number;
  vz: number;
  eliminated: boolean;
  chargeCooldown: number;
  isCharging: boolean;
  chargeTimer: number;
  chargeVx: number;
  chargeVz: number;
  facingX: number; // last non-zero movement direction
  facingZ: number;
}

const ARENA_RADIUS = 10;
const PLAYER_RADIUS = 0.8;
const MOVE_SPEED = 5;
const CHARGE_SPEED = 18;
const CHARGE_DURATION = 0.4;
const CHARGE_COOLDOWN = 2.0;
const FRICTION = 0.88;
const CHARGE_HIT_FORCE = 22;
const NORMAL_HIT_FORCE = 5;

export class SumoSmash extends BaseGame {
  private sumoPlayers: Map<string, SumoPlayer> = new Map();
  private eliminationOrder: string[] = [];

  constructor(room: GameRoom) {
    super(room, 120);
    let i = 0;
    for (const [id] of room.players) {
      const angle = (i / room.players.size) * Math.PI * 2;
      this.sumoPlayers.set(id, {
        id,
        x: Math.cos(angle) * 6,
        z: Math.sin(angle) * 6,
        vx: 0, vz: 0,
        eliminated: false,
        chargeCooldown: 0,
        isCharging: false,
        chargeTimer: 0,
        chargeVx: 0,
        chargeVz: 0,
        facingX: -Math.cos(angle), // face center
        facingZ: -Math.sin(angle),
      });
      i++;
    }
  }

  get gameId(): GameId { return 'sumo-smash'; }

  handleInput(playerId: string, data: Record<string, unknown>): void {
    const p = this.sumoPlayers.get(playerId);
    if (!p || p.eliminated) return;

    const joy = data.joystick as { x: number; y: number } | undefined;
    if (joy && !p.isCharging) {
      p.vx = joy.x * MOVE_SPEED;
      p.vz = joy.y * MOVE_SPEED;
      // Track facing direction
      if (Math.abs(joy.x) > 0.15 || Math.abs(joy.y) > 0.15) {
        const mag = Math.sqrt(joy.x * joy.x + joy.y * joy.y);
        p.facingX = joy.x / mag;
        p.facingZ = joy.y / mag;
      }
    }

    const buttons = data.buttons as Record<string, boolean> | undefined;
    if (buttons?.charge && p.chargeCooldown <= 0 && !p.isCharging) {
      p.isCharging = true;
      p.chargeTimer = CHARGE_DURATION;
      // Charge in facing direction (works even at standstill)
      p.chargeVx = p.facingX * CHARGE_SPEED;
      p.chargeVz = p.facingZ * CHARGE_SPEED;
      p.chargeCooldown = CHARGE_COOLDOWN;
    }
  }

  update(dt: number): void {
    const alive = [...this.sumoPlayers.values()].filter(p => !p.eliminated);

    // Movement phase
    for (const p of alive) {
      if (p.chargeCooldown > 0) p.chargeCooldown -= dt;
      if (p.isCharging) {
        p.chargeTimer -= dt;
        if (p.chargeTimer <= 0) {
          p.isCharging = false;
          // Carry some charge momentum into normal velocity
          p.vx = p.chargeVx * 0.3;
          p.vz = p.chargeVz * 0.3;
        }
      }

      const moveVx = p.isCharging ? p.chargeVx : p.vx;
      const moveVz = p.isCharging ? p.chargeVz : p.vz;

      p.x += moveVx * dt;
      p.z += moveVz * dt;

      // Frame-rate independent friction (only when not charging)
      if (!p.isCharging) {
        p.vx *= Math.pow(FRICTION, dt * 60);
        p.vz *= Math.pow(FRICTION, dt * 60);
      }
    }

    // Player-player collisions (separate pass, no double-counting)
    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        const a = alive[i], b = alive[j];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < PLAYER_RADIUS * 2 && dist > 0) {
          const nx = dx / dist;
          const nz = dz / dist;

          // Force depends on charge state
          const forceA = a.isCharging ? CHARGE_HIT_FORCE : NORMAL_HIT_FORCE;
          const forceB = b.isCharging ? CHARGE_HIT_FORCE : NORMAL_HIT_FORCE;
          b.vx += nx * forceA;
          b.vz += nz * forceA;
          a.vx -= nx * forceB;
          a.vz -= nz * forceB;

          // Separate
          const overlap = PLAYER_RADIUS * 2 - dist;
          a.x -= nx * overlap * 0.5;
          a.z -= nz * overlap * 0.5;
          b.x += nx * overlap * 0.5;
          b.z += nz * overlap * 0.5;
        }
      }
    }

    // Ring-out check (separate pass after all movement and collisions)
    for (const p of alive) {
      const distFromCenter = Math.sqrt(p.x * p.x + p.z * p.z);
      if (distFromCenter > ARENA_RADIUS) {
        p.eliminated = true;
        this.eliminationOrder.push(p.id);
        this.emitEvent({
          type: 'event',
          event: 'ring_out',
          data: { playerId: p.id },
          affectedPlayers: [p.id],
          timestamp: Date.now(),
        });
      }
    }
  }

  getEntities(): EntityState[] {
    return [{
      id: 'arena',
      type: 'sumo_ring',
      position: { x: 0, y: 0, z: 0 },
      data: { radius: ARENA_RADIUS },
    }];
  }

  getPlayerStates(): PlayerState[] {
    const aliveCount = [...this.sumoPlayers.values()].filter(p => !p.eliminated).length;
    return [...this.room.players.values()].map(rp => {
      const sp = this.sumoPlayers.get(rp.id);
      const distFromCenter = sp ? Math.sqrt(sp.x * sp.x + sp.z * sp.z) : 0;
      return {
        id: rp.id,
        name: rp.name,
        color: rp.color,
        score: this.room.cumulativeScores.get(rp.id) ?? 0,
        connected: rp.connected,
        isHost: rp.isHost,
        position: sp ? { x: sp.x, y: 0, z: sp.z } : { x: 0, y: 0, z: 0 },
        eliminated: sp?.eliminated ?? false,
        data: {
          isCharging: sp?.isCharging ?? false,
          chargeCooldown: Math.max(0, sp?.chargeCooldown ?? 0),
          aliveCount,
          edgeDistance: Math.max(0, ARENA_RADIUS - distFromCenter),
        },
      };
    });
  }

  getFinalScores(): Record<string, number> {
    const scores: Record<string, number> = {};
    const allIds = [...this.room.players.keys()];
    const alive = [...this.sumoPlayers.values()].filter(p => !p.eliminated);
    alive.forEach((p, i) => { scores[p.id] = SCORE_TABLE[i + 1] ?? 3; });
    this.eliminationOrder.slice().reverse().forEach((id, i) => {
      scores[id] = SCORE_TABLE[alive.length + i + 1] ?? 3;
    });
    allIds.forEach(id => { if (!scores[id]) scores[id] = 3; });
    return scores;
  }

  isFinished(): boolean {
    const alive = [...this.sumoPlayers.values()].filter(p => !p.eliminated);
    const hasEliminations = this.eliminationOrder.length > 0;
    return (hasEliminations && alive.length <= 1) || super.isFinished();
  }
}
