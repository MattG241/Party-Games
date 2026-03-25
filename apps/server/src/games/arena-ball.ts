import { EntityState, GameId, PlayerState } from '@party-blast/shared';
import { BaseGame } from './base';
import { GameRoom } from '../rooms/types';

interface Ball {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
}

interface ArenaPlayer {
  id: string;
  team: 0 | 1;
  x: number;
  z: number;
  vx: number;
  vz: number;
  dashCooldown: number;
}

export class ArenaBall extends BaseGame {
  private ball: Ball = { x: 0, y: 0.5, z: 0, vx: 0, vy: 0, vz: 0 };
  private arenaPlayers: Map<string, ArenaPlayer> = new Map();
  private teamScores: [number, number] = [0, 0];
  private FIELD_W = 20;
  private FIELD_H = 12;
  private GOAL_W = 3;

  constructor(room: GameRoom) {
    super(room, 180);
    let i = 0;
    for (const [id] of room.players) {
      const team = (i % 2) as 0 | 1;
      this.arenaPlayers.set(id, {
        id,
        team,
        x: team === 0 ? -6 : 6,
        z: (i < 2 ? -2 : 2) * (Math.floor(i / 2) + 1),
        vx: 0,
        vz: 0,
        dashCooldown: 0,
      });
      i++;
    }
  }

  get gameId(): GameId { return 'arena-ball'; }

  handleInput(playerId: string, data: Record<string, unknown>): void {
    const p = this.arenaPlayers.get(playerId);
    if (!p) return;
    const joy = data.joystick as { x: number; y: number } | undefined;
    if (joy) { p.vx = joy.x * 7; p.vz = joy.y * 7; }
    const buttons = data.buttons as Record<string, boolean> | undefined;
    if (buttons?.dash && p.dashCooldown <= 0) {
      const mag = Math.sqrt(p.vx * p.vx + p.vz * p.vz) || 1;
      p.vx = (p.vx / mag) * 15;
      p.vz = (p.vz / mag) * 15;
      p.dashCooldown = 3;
    }
  }

  update(dt: number): void {
    for (const p of this.arenaPlayers.values()) {
      p.x = Math.max(-this.FIELD_W / 2, Math.min(this.FIELD_W / 2, p.x + p.vx * dt));
      p.z = Math.max(-this.FIELD_H / 2, Math.min(this.FIELD_H / 2, p.z + p.vz * dt));
      if (p.dashCooldown > 0) p.dashCooldown -= dt;

      const dx = this.ball.x - p.x;
      const dz = this.ball.z - p.z;
      if (dx * dx + dz * dz < 1.2) {
        const mag = Math.sqrt(dx * dx + dz * dz) || 1;
        this.ball.vx = (dx / mag) * 12 + p.vx * 0.5;
        this.ball.vz = (dz / mag) * 12 + p.vz * 0.5;
      }
    }

    this.ball.x += this.ball.vx * dt;
    this.ball.z += this.ball.vz * dt;
    this.ball.vx *= 0.98;
    this.ball.vz *= 0.98;

    if (Math.abs(this.ball.z) > this.FIELD_H / 2) {
      this.ball.vz *= -0.8;
      this.ball.z = Math.sign(this.ball.z) * this.FIELD_H / 2;
    }

    if (this.ball.x < -this.FIELD_W / 2 && Math.abs(this.ball.z) < this.GOAL_W) {
      this.teamScores[1]++;
      const scorers = [...this.arenaPlayers.values()].filter(ap => ap.team === 1).map(ap => ap.id);
      this.emitEvent({ type: 'event', event: 'goal', data: { team: 1, score: this.teamScores }, affectedPlayers: scorers, timestamp: Date.now() });
      this.resetBall();
    } else if (this.ball.x > this.FIELD_W / 2 && Math.abs(this.ball.z) < this.GOAL_W) {
      this.teamScores[0]++;
      const scorers = [...this.arenaPlayers.values()].filter(ap => ap.team === 0).map(ap => ap.id);
      this.emitEvent({ type: 'event', event: 'goal', data: { team: 0, score: this.teamScores }, affectedPlayers: scorers, timestamp: Date.now() });
      this.resetBall();
    } else if (Math.abs(this.ball.x) > this.FIELD_W / 2) {
      this.ball.vx *= -0.8;
      this.ball.x = Math.sign(this.ball.x) * this.FIELD_W / 2;
    }
  }

  private resetBall(): void {
    this.ball = { x: 0, y: 0.5, z: 0, vx: (Math.random() - 0.5) * 4, vy: 0, vz: (Math.random() - 0.5) * 4 };
  }

  getEntities(): EntityState[] {
    return [{
      id: 'ball',
      type: 'ball',
      position: { x: this.ball.x, y: this.ball.y, z: this.ball.z },
      velocity: { x: this.ball.vx, y: this.ball.vy, z: this.ball.vz },
    }];
  }

  getPlayerStates(): PlayerState[] {
    return [...this.room.players.values()].map(rp => {
      const ap = this.arenaPlayers.get(rp.id);
      return {
        id: rp.id,
        name: rp.name,
        color: rp.color,
        score: this.room.cumulativeScores.get(rp.id) ?? 0,
        connected: rp.connected,
        isHost: rp.isHost,
        position: ap ? { x: ap.x, y: 0, z: ap.z } : { x: 0, y: 0, z: 0 },
        data: { team: ap?.team ?? 0, teamScores: this.teamScores },
      };
    });
  }

  getFinalScores(): Record<string, number> {
    const scores: Record<string, number> = {};
    const winTeam = this.teamScores[0] > this.teamScores[1] ? 0 : (this.teamScores[1] > this.teamScores[0] ? 1 : -1);
    for (const [id, p] of this.arenaPlayers) {
      scores[id] = this.teamScores[p.team] * 3 + (winTeam === p.team ? 5 : 0);
    }
    return scores;
  }
}
