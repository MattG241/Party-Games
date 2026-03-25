import { EntityState, GameId, PlayerState } from '@party-blast/shared';
import { SCORE_TABLE } from '@party-blast/shared';
import { BaseGame } from './base';
import { GameRoom } from '../rooms/types';

interface Target {
  id: string;
  x: number;
  z: number;
  radius: number;
  points: number;
  active: boolean;
  respawnTimer: number;
}

interface BullseyePlayer {
  id: string;
  x: number;
  z: number;
  vx: number;
  vz: number;
  aimAngle: number;
  throwCooldown: number;
  points: number;
}

const ARENA_SIZE = 16;

export class BullseyeBonanza extends BaseGame {
  private bPlayers: Map<string, BullseyePlayer> = new Map();
  private targets: Target[] = [];
  private nextTargetId = 0;

  constructor(room: GameRoom) {
    super(room, 90);
    let i = 0;
    for (const [id] of room.players) {
      const angle = (i / room.players.size) * Math.PI * 2;
      this.bPlayers.set(id, {
        id,
        x: Math.cos(angle) * 6,
        z: Math.sin(angle) * 6,
        vx: 0, vz: 0,
        aimAngle: 0,
        throwCooldown: 0,
        points: 0,
      });
      i++;
    }
    // Spawn initial targets
    for (let t = 0; t < 6; t++) {
      this.spawnTarget();
    }
  }

  get gameId(): GameId { return 'bullseye-bonanza'; }

  private spawnTarget(): void {
    const id = `target_${this.nextTargetId++}`;
    const x = (Math.random() - 0.5) * ARENA_SIZE * 1.5;
    const z = (Math.random() - 0.5) * ARENA_SIZE * 1.5;
    const sizeRoll = Math.random();
    let radius: number, points: number;
    if (sizeRoll < 0.2) {
      radius = 0.5; points = 5; // small = high value
    } else if (sizeRoll < 0.6) {
      radius = 1; points = 3; // medium
    } else {
      radius = 1.8; points = 1; // large = low value
    }
    this.targets.push({ id, x, z, radius, points, active: true, respawnTimer: 0 });
  }

  handleInput(playerId: string, data: Record<string, unknown>): void {
    const p = this.bPlayers.get(playerId);
    if (!p) return;

    const joy = data.joystick as { x: number; y: number } | undefined;
    if (joy) {
      p.vx = joy.x * 5;
      p.vz = joy.y * 5;
      if (Math.abs(joy.x) > 0.1 || Math.abs(joy.y) > 0.1) {
        p.aimAngle = Math.atan2(joy.x, joy.y);
      }
    }

    const buttons = data.buttons as Record<string, boolean> | undefined;
    if (buttons?.throw && p.throwCooldown <= 0) {
      p.throwCooldown = 0.6;
      this.checkThrowHit(p);
    }
  }

  private checkThrowHit(p: BullseyePlayer): void {
    // Raycast in aim direction, check targets
    const dx = Math.sin(p.aimAngle);
    const dz = Math.cos(p.aimAngle);
    const range = 20;

    let bestTarget: Target | null = null;
    let bestDist = range;

    for (const target of this.targets) {
      if (!target.active) continue;
      // Point-to-line distance
      const tx = target.x - p.x;
      const tz = target.z - p.z;
      const dot = tx * dx + tz * dz;
      if (dot < 0 || dot > range) continue;
      const projX = dx * dot;
      const projZ = dz * dot;
      const perpDist = Math.sqrt((tx - projX) ** 2 + (tz - projZ) ** 2);
      if (perpDist < target.radius && dot < bestDist) {
        bestDist = dot;
        bestTarget = target;
      }
    }

    if (bestTarget) {
      p.points += bestTarget.points;
      bestTarget.active = false;
      bestTarget.respawnTimer = 2 + Math.random() * 2;
      this.emitEvent({
        type: 'event',
        event: 'pickup',
        data: { playerId: p.id, targetId: bestTarget.id, points: bestTarget.points },
        affectedPlayers: [p.id],
        timestamp: Date.now(),
      });
    }
  }

  update(dt: number): void {
    for (const p of this.bPlayers.values()) {
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      p.x = Math.max(-ARENA_SIZE, Math.min(ARENA_SIZE, p.x));
      p.z = Math.max(-ARENA_SIZE, Math.min(ARENA_SIZE, p.z));
      if (p.throwCooldown > 0) p.throwCooldown -= dt;
    }

    // Respawn targets
    for (const target of this.targets) {
      if (!target.active) {
        target.respawnTimer -= dt;
        if (target.respawnTimer <= 0) {
          target.active = true;
          target.x = (Math.random() - 0.5) * ARENA_SIZE * 1.5;
          target.z = (Math.random() - 0.5) * ARENA_SIZE * 1.5;
        }
      }
    }

    // Ensure minimum active targets
    const activeCount = this.targets.filter(t => t.active).length;
    if (activeCount < 4) {
      this.spawnTarget();
    }
  }

  getEntities(): EntityState[] {
    return this.targets
      .filter(t => t.active)
      .map(t => ({
        id: t.id,
        type: 'target',
        position: { x: t.x, y: 0.5, z: t.z },
        data: { radius: t.radius, points: t.points },
      }));
  }

  getPlayerStates(): PlayerState[] {
    return [...this.room.players.values()].map(rp => {
      const bp = this.bPlayers.get(rp.id);
      return {
        id: rp.id,
        name: rp.name,
        color: rp.color,
        score: this.room.cumulativeScores.get(rp.id) ?? 0,
        connected: rp.connected,
        isHost: rp.isHost,
        position: bp ? { x: bp.x, y: 0, z: bp.z } : { x: 0, y: 0, z: 0 },
        data: {
          points: bp?.points ?? 0,
          aimAngle: bp?.aimAngle ?? 0,
        },
      };
    });
  }

  getFinalScores(): Record<string, number> {
    const sorted = [...this.bPlayers.values()].sort((a, b) => b.points - a.points);
    const scores: Record<string, number> = {};
    sorted.forEach((p, i) => {
      scores[p.id] = SCORE_TABLE[i + 1] ?? 3;
    });
    for (const [id] of this.room.players) {
      if (!scores[id]) scores[id] = 3;
    }
    return scores;
  }
}
