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
}

interface PanicPlayer {
  id: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  eliminated: boolean;
  finishPosition: number;
}

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
          this.platforms.push({
            id: `plat_${id++}`,
            x: col * 3 + (row % 2 === 0 ? 1.5 : 0),
            z: row * 2.6,
            active: true,
            crumbling: false,
            crumbleTimer: 0,
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
        eliminated: false,
        finishPosition: 0,
      });
      i++;
    }
  }

  handleInput(playerId: string, data: Record<string, unknown>): void {
    const player = this.panicPlayers.get(playerId);
    if (!player || player.eliminated) return;
    const joystick = data.joystick as { x: number; y: number } | undefined;
    if (joystick) {
      player.vx = joystick.x * 5;
      player.vz = joystick.y * 5;
    }
  }

  update(dt: number): void {
    const alivePlayers = [...this.panicPlayers.values()].filter(p => !p.eliminated);

    for (const p of alivePlayers) {
      p.x += p.vx * dt;
      p.z += p.vz * dt;

      let onPlatform = false;
      for (const plat of this.platforms) {
        if (!plat.active) continue;
        const dx = p.x - plat.x;
        const dz = p.z - plat.z;
        if (dx * dx + dz * dz < 2.25) {
          onPlatform = true;
          if (!plat.crumbling) {
            plat.crumbling = true;
            plat.crumbleTimer = 2.5;
          }
          break;
        }
      }

      if (!onPlatform) {
        p.y -= 9.8 * dt;
        if (p.y < -5) {
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
      } else {
        p.y = 1;
      }
    }

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
      data: { active: plat.active, crumbleTimer: plat.crumbleTimer },
    }));
  }

  getPlayerStates(): PlayerState[] {
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
    return alive.length <= 1 || super.isFinished();
  }
}
