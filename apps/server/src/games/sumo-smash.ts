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
  chargeVx: number;
  chargeVz: number;
}

const ARENA_RADIUS = 10;
const PLAYER_RADIUS = 0.8;

export class SumoSmash extends BaseGame {
  private sumoPlayers: Map<string, SumoPlayer> = new Map();
  private eliminationOrder: string[] = [];

  constructor(room: GameRoom) {
    super(room, 240);
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
        chargeVx: 0,
        chargeVz: 0,
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
      p.vx = joy.x * 5;
      p.vz = joy.y * 5;
    }

    const buttons = data.buttons as Record<string, boolean> | undefined;
    if (buttons?.charge && p.chargeCooldown <= 0 && !p.isCharging) {
      const mag = Math.sqrt(p.vx * p.vx + p.vz * p.vz) || 1;
      p.isCharging = true;
      p.chargeVx = (p.vx / mag) * 18;
      p.chargeVz = (p.vz / mag) * 18;
      p.chargeCooldown = 2.5;
      setTimeout(() => { p.isCharging = false; }, 400);
    }
  }

  update(dt: number): void {
    const alive = [...this.sumoPlayers.values()].filter(p => !p.eliminated);

    for (const p of alive) {
      if (p.chargeCooldown > 0) p.chargeCooldown -= dt;

      const moveVx = p.isCharging ? p.chargeVx : p.vx;
      const moveVz = p.isCharging ? p.chargeVz : p.vz;

      p.x += moveVx * dt;
      p.z += moveVz * dt;

      // Friction
      if (!p.isCharging) {
        p.vx *= 0.85;
        p.vz *= 0.85;
      }

      // Player-player collisions
      for (const other of alive) {
        if (other.id === p.id) continue;
        const dx = other.x - p.x;
        const dz = other.z - p.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < PLAYER_RADIUS * 2 && dist > 0) {
          const nx = dx / dist;
          const nz = dz / dist;
          const force = p.isCharging ? 20 : 5;
          other.vx += nx * force;
          other.vz += nz * force;
          // Separate
          const overlap = PLAYER_RADIUS * 2 - dist;
          other.x += nx * overlap * 0.5;
          other.z += nz * overlap * 0.5;
          p.x -= nx * overlap * 0.5;
          p.z -= nz * overlap * 0.5;
        }
      }

      // Check ring out
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
    return [...this.room.players.values()].map(rp => {
      const sp = this.sumoPlayers.get(rp.id);
      return {
        id: rp.id,
        name: rp.name,
        color: rp.color,
        score: this.room.cumulativeScores.get(rp.id) ?? 0,
        connected: rp.connected,
        isHost: rp.isHost,
        position: sp ? { x: sp.x, y: 0, z: sp.z } : { x: 0, y: 0, z: 0 },
        eliminated: sp?.eliminated ?? false,
        data: { isCharging: sp?.isCharging ?? false },
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
