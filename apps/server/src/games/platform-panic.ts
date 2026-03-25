import { EntityState, GameEvent, GameId, PlayerState } from '@party-blast/shared';
import { SCORE_TABLE } from '@party-blast/shared';
import { BaseGame } from './base';
import { GameRoom } from '../rooms/types';

interface Platform {
  id: string;
  x: number;
  z: number;
  active: boolean;
  crumbling: boolean;
  crumbleTimer: number;
  crumbleDuration: number; // total time before falling (varies by position)
}

interface PanicPlayer {
  id: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  vy: number;
  eliminated: boolean;
  finishPosition: number;
  jumpCooldown: number;
  isGrounded: boolean;
}

const PLAYER_RADIUS = 0.6;
const PLATFORM_RADIUS = 1.3;
const MOVE_SPEED = 6;
const FRICTION = 0.88;
const GRAVITY = 12;
const JUMP_VELOCITY = 6;
const JUMP_COOLDOWN = 1.2;

export class PlatformPanic extends BaseGame {
  private platforms: Platform[] = [];
  private panicPlayers: Map<string, PanicPlayer> = new Map();
  private eliminationOrder: string[] = [];

  constructor(room: GameRoom) {
    super(room, 180);
    this.initPlatforms();
    this.initPlayers();
  }

  get gameId(): GameId { return 'platform-panic'; }

  private initPlatforms(): void {
    let id = 0;
    for (let row = -3; row <= 3; row++) {
      for (let col = -3; col <= 3; col++) {
        if (Math.abs(row) + Math.abs(col) <= 4) {
          const distFromCenter = Math.sqrt(col * col + row * row);
          // Outer platforms crumble slower, center platforms crumble faster
          const crumbleDuration = 1.5 + distFromCenter * 0.5;
          this.platforms.push({
            id: `plat_${id++}`,
            x: col * 3 + (row % 2 === 0 ? 1.5 : 0),
            z: row * 2.6,
            active: true,
            crumbling: false,
            crumbleTimer: 0,
            crumbleDuration,
          });
        }
      }
    }
  }

  private initPlayers(): void {
    let i = 0;
    for (const [id] of this.room.players) {
      const angle = (i / this.room.players.size) * Math.PI * 2;
      this.panicPlayers.set(id, {
        id,
        x: Math.cos(angle) * 4,
        y: 1,
        z: Math.sin(angle) * 4,
        vx: 0,
        vz: 0,
        vy: 0,
        eliminated: false,
        finishPosition: 0,
        jumpCooldown: 0,
        isGrounded: true,
      });
      i++;
    }
  }

  handleInput(playerId: string, data: Record<string, unknown>): void {
    const player = this.panicPlayers.get(playerId);
    if (!player || player.eliminated) return;

    const joystick = data.joystick as { x: number; y: number } | undefined;
    if (joystick) {
      // Apply acceleration toward joystick direction
      player.vx += joystick.x * MOVE_SPEED * 0.3;
      player.vz += joystick.y * MOVE_SPEED * 0.3;
    }

    const buttons = data.buttons as Record<string, boolean> | undefined;
    if (buttons?.jump && player.isGrounded && player.jumpCooldown <= 0) {
      player.vy = JUMP_VELOCITY;
      player.isGrounded = false;
      player.jumpCooldown = JUMP_COOLDOWN;
    }
  }

  update(dt: number): void {
    const alivePlayers = [...this.panicPlayers.values()].filter(p => !p.eliminated);

    for (const p of alivePlayers) {
      // Cooldowns
      if (p.jumpCooldown > 0) p.jumpCooldown -= dt;

      // Apply friction
      p.vx *= Math.pow(FRICTION, dt * 60);
      p.vz *= Math.pow(FRICTION, dt * 60);

      // Clamp horizontal speed
      const hSpeed = Math.sqrt(p.vx * p.vx + p.vz * p.vz);
      if (hSpeed > MOVE_SPEED) {
        p.vx = (p.vx / hSpeed) * MOVE_SPEED;
        p.vz = (p.vz / hSpeed) * MOVE_SPEED;
      }

      // Move horizontally
      p.x += p.vx * dt;
      p.z += p.vz * dt;

      // Apply gravity
      p.vy -= GRAVITY * dt;
      p.y += p.vy * dt;

      // Platform collision
      let onPlatform = false;
      for (const plat of this.platforms) {
        if (!plat.active) continue;
        const dx = p.x - plat.x;
        const dz = p.z - plat.z;
        if (dx * dx + dz * dz < PLATFORM_RADIUS * PLATFORM_RADIUS) {
          // Player is over this platform
          if (p.y <= 1 && p.vy <= 0) {
            onPlatform = true;
            p.y = 1;
            p.vy = 0;
            p.isGrounded = true;
            // Start crumbling on contact
            if (!plat.crumbling) {
              plat.crumbling = true;
              plat.crumbleTimer = plat.crumbleDuration;
            }
          }
          break;
        }
      }

      // If not on any platform and below platform level, falling
      if (!onPlatform && p.y <= 1) {
        p.isGrounded = false;
      }

      // Elimination when fallen too far
      if (p.y < -8) {
        p.eliminated = true;
        this.eliminationOrder.push(p.id);
        this.emitEvent({
          type: 'event',
          event: 'elimination',
          data: { playerId: p.id },
          affectedPlayers: [p.id],
          timestamp: Date.now(),
        });
      }
    }

    // Player-player collisions (bump each other)
    for (let i = 0; i < alivePlayers.length; i++) {
      for (let j = i + 1; j < alivePlayers.length; j++) {
        const a = alivePlayers[i], b = alivePlayers[j];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < PLAYER_RADIUS * 2 && dist > 0) {
          const nx = dx / dist;
          const nz = dz / dist;
          // Push apart
          const overlap = PLAYER_RADIUS * 2 - dist;
          a.x -= nx * overlap * 0.5;
          a.z -= nz * overlap * 0.5;
          b.x += nx * overlap * 0.5;
          b.z += nz * overlap * 0.5;
          // Bump velocity
          const bumpForce = 3;
          a.vx -= nx * bumpForce;
          a.vz -= nz * bumpForce;
          b.vx += nx * bumpForce;
          b.vz += nz * bumpForce;
        }
      }
    }

    // Assign finish positions to surviving players when game is nearly over
    const aliveNow = [...this.panicPlayers.values()].filter(p => !p.eliminated);
    if (aliveNow.length <= 1 && this.eliminationOrder.length > 0) {
      for (const p of aliveNow) {
        if (p.finishPosition === 0) p.finishPosition = 1;
      }
    }

    // Platform crumble timers
    for (const plat of this.platforms) {
      if (!plat.crumbling) continue;
      plat.crumbleTimer -= dt;
      if (plat.crumbleTimer <= 0 && plat.active) {
        plat.active = false;
        this.emitEvent({
          type: 'event',
          event: 'platform_fall',
          data: { platformId: plat.id },
          affectedPlayers: [],
          timestamp: Date.now(),
        });
      }
    }
  }

  getEntities(): EntityState[] {
    return this.platforms.map(plat => ({
      id: plat.id,
      type: plat.crumbling ? 'platform_crumbling' : 'platform',
      position: { x: plat.x, y: 0, z: plat.z },
      data: {
        active: plat.active,
        crumbleTimer: plat.crumbleTimer,
        crumbleDuration: plat.crumbleDuration,
      },
    }));
  }

  getPlayerStates(): PlayerState[] {
    const aliveCount = [...this.panicPlayers.values()].filter(p => !p.eliminated).length;
    const activePlatforms = this.platforms.filter(p => p.active).length;
    return [...this.room.players.values()].map(rp => {
      const pp = this.panicPlayers.get(rp.id);
      return {
        id: rp.id,
        name: rp.name,
        color: rp.color,
        score: this.room.cumulativeScores.get(rp.id) ?? 0,
        connected: rp.connected,
        isHost: rp.isHost,
        position: pp ? { x: pp.x, y: pp.y, z: pp.z } : { x: 0, y: 0, z: 0 },
        eliminated: pp?.eliminated ?? false,
        finishPosition: pp?.finishPosition ?? 0,
        data: {
          isGrounded: pp?.isGrounded ?? true,
          jumpCooldown: Math.max(0, pp?.jumpCooldown ?? 0),
          aliveCount,
          activePlatforms,
        },
      };
    });
  }

  getFinalScores(): Record<string, number> {
    const scores: Record<string, number> = {};
    const allIds = [...this.room.players.keys()];
    const alive = [...this.panicPlayers.values()].filter(p => !p.eliminated);

    alive.forEach((p, i) => { scores[p.id] = SCORE_TABLE[i + 1] ?? 3; });

    this.eliminationOrder.slice().reverse().forEach((id, i) => {
      scores[id] = SCORE_TABLE[alive.length + i + 1] ?? 3;
    });

    allIds.forEach(id => { if (!scores[id]) scores[id] = 3; });
    return scores;
  }

  isFinished(): boolean {
    const alive = [...this.panicPlayers.values()].filter(p => !p.eliminated);
    const hasEliminations = this.eliminationOrder.length > 0;
    return (hasEliminations && alive.length <= 1) || super.isFinished();
  }
}
