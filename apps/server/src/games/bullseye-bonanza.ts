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

interface Projectile {
  id: string;
  x: number;
  z: number;
  dx: number;
  dz: number;
  life: number;
  playerId: string;
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

const ARENA_SIZE = 14;
const MOVE_SPEED = 6;
const FRICTION = 0.90;
const THROW_COOLDOWN = 0.5;
const THROW_RANGE = 18;
const THROW_SPEED = 30;
const PLAYER_RADIUS = 0.6;
const MIN_TARGET_SPAWN_DIST = 3;

export class BullseyeBonanza extends BaseGame {
  private bPlayers: Map<string, BullseyePlayer> = new Map();
  private targets: Target[] = [];
  private projectiles: Projectile[] = [];
  private nextTargetId = 0;
  private nextProjectileId = 0;

  constructor(room: GameRoom) {
    super(room, 90);
    let i = 0;
    for (const [id] of room.players) {
      const angle = (i / room.players.size) * Math.PI * 2;
      this.bPlayers.set(id, {
        id,
        x: Math.cos(angle) * 5,
        z: Math.sin(angle) * 5,
        vx: 0, vz: 0,
        aimAngle: angle + Math.PI, // face center
        throwCooldown: 0,
        points: 0,
      });
      i++;
    }
    for (let t = 0; t < 8; t++) {
      this.spawnTarget();
    }
  }

  get gameId(): GameId { return 'bullseye-bonanza'; }

  private spawnTarget(): void {
    const id = `target_${this.nextTargetId++}`;
    let x: number, z: number;
    let attempts = 0;
    // Avoid spawning on top of players
    do {
      x = (Math.random() - 0.5) * ARENA_SIZE * 1.6;
      z = (Math.random() - 0.5) * ARENA_SIZE * 1.6;
      attempts++;
    } while (attempts < 10 && this.isNearPlayer(x, z));

    const sizeRoll = Math.random();
    let radius: number, points: number;
    if (sizeRoll < 0.2) {
      radius = 0.5; points = 5;
    } else if (sizeRoll < 0.6) {
      radius = 1; points = 3;
    } else {
      radius = 1.8; points = 1;
    }
    this.targets.push({ id, x, z, radius, points, active: true, respawnTimer: 0 });
  }

  private isNearPlayer(x: number, z: number): boolean {
    for (const p of this.bPlayers.values()) {
      const dx = p.x - x;
      const dz = p.z - z;
      if (dx * dx + dz * dz < MIN_TARGET_SPAWN_DIST * MIN_TARGET_SPAWN_DIST) return true;
    }
    return false;
  }

  handleInput(playerId: string, data: Record<string, unknown>): void {
    const p = this.bPlayers.get(playerId);
    if (!p) return;

    const joy = data.joystick as { x: number; y: number } | undefined;
    if (joy) {
      p.vx += joy.x * MOVE_SPEED * 0.4;
      p.vz += joy.y * MOVE_SPEED * 0.4;
      // Update aim direction from movement
      if (Math.abs(joy.x) > 0.15 || Math.abs(joy.y) > 0.15) {
        p.aimAngle = Math.atan2(joy.x, joy.y);
      }
    }

    const buttons = data.buttons as Record<string, boolean> | undefined;
    if (buttons?.throw && p.throwCooldown <= 0) {
      p.throwCooldown = THROW_COOLDOWN;
      this.fireProjectile(p);
    }
  }

  private fireProjectile(p: BullseyePlayer): void {
    const dx = Math.sin(p.aimAngle);
    const dz = Math.cos(p.aimAngle);
    this.projectiles.push({
      id: `proj_${this.nextProjectileId++}`,
      x: p.x + dx * 0.8,
      z: p.z + dz * 0.8,
      dx, dz,
      life: THROW_RANGE / THROW_SPEED,
      playerId: p.id,
    });

    // Check hits along the ray
    let bestTarget: Target | null = null;
    let bestDist = THROW_RANGE;

    for (const target of this.targets) {
      if (!target.active) continue;
      const tx = target.x - p.x;
      const tz = target.z - p.z;
      const dot = tx * dx + tz * dz;
      if (dot < 0 || dot > THROW_RANGE) continue;
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
    // Player movement
    for (const p of this.bPlayers.values()) {
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      p.x = Math.max(-ARENA_SIZE, Math.min(ARENA_SIZE, p.x));
      p.z = Math.max(-ARENA_SIZE, Math.min(ARENA_SIZE, p.z));
      if (p.throwCooldown > 0) p.throwCooldown -= dt;
      // Friction
      p.vx *= Math.pow(FRICTION, dt * 60);
      p.vz *= Math.pow(FRICTION, dt * 60);
      // Clamp speed
      const spd = Math.sqrt(p.vx * p.vx + p.vz * p.vz);
      if (spd > MOVE_SPEED) {
        p.vx = (p.vx / spd) * MOVE_SPEED;
        p.vz = (p.vz / spd) * MOVE_SPEED;
      }
    }

    // Player-player collisions
    const players = [...this.bPlayers.values()];
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const a = players[i], b = players[j];
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
        }
      }
    }

    // Update projectiles
    for (const proj of this.projectiles) {
      proj.x += proj.dx * THROW_SPEED * dt;
      proj.z += proj.dz * THROW_SPEED * dt;
      proj.life -= dt;
    }
    this.projectiles = this.projectiles.filter(p => p.life > 0);

    // Respawn targets
    for (const target of this.targets) {
      if (!target.active) {
        target.respawnTimer -= dt;
        if (target.respawnTimer <= 0) {
          target.active = true;
          target.x = (Math.random() - 0.5) * ARENA_SIZE * 1.6;
          target.z = (Math.random() - 0.5) * ARENA_SIZE * 1.6;
        }
      }
    }

    // Ensure minimum active targets
    const activeCount = this.targets.filter(t => t.active).length;
    if (activeCount < 5) {
      const inactive = this.targets.find(t => !t.active && t.respawnTimer <= 0);
      if (inactive) {
        inactive.active = true;
        inactive.x = (Math.random() - 0.5) * ARENA_SIZE * 1.6;
        inactive.z = (Math.random() - 0.5) * ARENA_SIZE * 1.6;
      } else {
        this.spawnTarget();
      }
    }
  }

  getEntities(): EntityState[] {
    const entities: EntityState[] = [];

    // Active targets
    for (const t of this.targets) {
      if (!t.active) continue;
      entities.push({
        id: t.id,
        type: 'target',
        position: { x: t.x, y: 0.5, z: t.z },
        data: { radius: t.radius, points: t.points },
      });
    }

    // Projectiles (for TV visualization)
    for (const proj of this.projectiles) {
      entities.push({
        id: proj.id,
        type: 'projectile',
        position: { x: proj.x, y: 0.5, z: proj.z },
        data: { playerId: proj.playerId },
      });
    }

    return entities;
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
          throwCooldown: Math.max(0, bp?.throwCooldown ?? 0),
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
