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
  dashTimer: number; // remaining dash burst time
  lastKickTime: number; // prevent rapid re-kicks
}

const FIELD_W = 20;
const FIELD_H = 12;
const GOAL_W = 3.5;
const MOVE_SPEED = 7;
const DASH_SPEED = 16;
const DASH_DURATION = 0.25;
const DASH_COOLDOWN = 2.5;
const PLAYER_RADIUS = 0.6;
const BALL_RADIUS = 0.6;
const BALL_KICK_FORCE = 14;
const BALL_FRICTION = 0.97; // per-frame at 60fps baseline

export class ArenaBall extends BaseGame {
  private ball: Ball = { x: 0, y: 0.5, z: 0, vx: 0, vy: 0, vz: 0 };
  private arenaPlayers: Map<string, ArenaPlayer> = new Map();
  private teamScores: [number, number] = [0, 0];

  constructor(room: GameRoom) {
    super(room, 180);
    let i = 0;
    for (const [id] of room.players) {
      const team = (i % 2) as 0 | 1;
      this.arenaPlayers.set(id, {
        id,
        team,
        ...this.getSpawnPos(team, i),
        vx: 0,
        vz: 0,
        dashCooldown: 0,
        dashTimer: 0,
        lastKickTime: 0,
      });
      i++;
    }
  }

  get gameId(): GameId { return 'arena-ball'; }

  private getSpawnPos(team: 0 | 1, index: number): { x: number; z: number } {
    // Stagger players on their half of the field
    const teamIdx = Math.floor(index / 2);
    const zPositions = [-3, 3, 0, -1.5, 1.5];
    const z = zPositions[teamIdx % zPositions.length] ?? 0;
    const x = team === 0 ? -5 - (teamIdx % 2) * 2 : 5 + (teamIdx % 2) * 2;
    return { x, z };
  }

  private resetPositions(): void {
    let i = 0;
    for (const p of this.arenaPlayers.values()) {
      const pos = this.getSpawnPos(p.team, i);
      p.x = pos.x;
      p.z = pos.z;
      p.vx = 0;
      p.vz = 0;
      p.dashTimer = 0;
      i++;
    }
  }

  handleInput(playerId: string, data: Record<string, unknown>): void {
    const p = this.arenaPlayers.get(playerId);
    if (!p) return;
    const joy = data.joystick as { x: number; y: number } | undefined;
    if (joy && p.dashTimer <= 0) {
      p.vx = joy.x * MOVE_SPEED;
      p.vz = joy.y * MOVE_SPEED;
    }
    const buttons = data.buttons as Record<string, boolean> | undefined;
    if (buttons?.dash && p.dashCooldown <= 0) {
      const mag = Math.sqrt(p.vx * p.vx + p.vz * p.vz) || 1;
      p.vx = (p.vx / mag) * DASH_SPEED;
      p.vz = (p.vz / mag) * DASH_SPEED;
      p.dashCooldown = DASH_COOLDOWN;
      p.dashTimer = DASH_DURATION;
    }
  }

  update(dt: number): void {
    const now = Date.now() / 1000;

    for (const p of this.arenaPlayers.values()) {
      if (p.dashCooldown > 0) p.dashCooldown -= dt;
      if (p.dashTimer > 0) p.dashTimer -= dt;

      p.x += p.vx * dt;
      p.z += p.vz * dt;

      // Field bounds
      p.x = Math.max(-FIELD_W / 2, Math.min(FIELD_W / 2, p.x));
      p.z = Math.max(-FIELD_H / 2, Math.min(FIELD_H / 2, p.z));

      // Ball kick — only if not recently kicked (prevent per-frame spam)
      const dx = this.ball.x - p.x;
      const dz = this.ball.z - p.z;
      const distSq = dx * dx + dz * dz;
      const kickDist = PLAYER_RADIUS + BALL_RADIUS;
      if (distSq < kickDist * kickDist && now - p.lastKickTime > 0.15) {
        const dist = Math.sqrt(distSq) || 0.1;
        const nx = dx / dist;
        const nz = dz / dist;
        const pSpeed = Math.sqrt(p.vx * p.vx + p.vz * p.vz);
        const kickPower = BALL_KICK_FORCE + pSpeed * 0.4;
        this.ball.vx = nx * kickPower;
        this.ball.vz = nz * kickPower;
        // Push ball out of player
        this.ball.x = p.x + nx * (kickDist + 0.1);
        this.ball.z = p.z + nz * (kickDist + 0.1);
        p.lastKickTime = now;
      }
    }

    // Player-player collisions
    const players = [...this.arenaPlayers.values()];
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
          a.vx -= nx * 2;
          a.vz -= nz * 2;
          b.vx += nx * 2;
          b.vz += nz * 2;
        }
      }
    }

    // Ball physics
    this.ball.x += this.ball.vx * dt;
    this.ball.z += this.ball.vz * dt;
    this.ball.vx *= Math.pow(BALL_FRICTION, dt * 60);
    this.ball.vz *= Math.pow(BALL_FRICTION, dt * 60);

    // Wall bounces (top/bottom)
    if (Math.abs(this.ball.z) > FIELD_H / 2) {
      this.ball.vz *= -0.8;
      this.ball.z = Math.sign(this.ball.z) * FIELD_H / 2;
    }

    // Goal detection
    if (this.ball.x < -FIELD_W / 2 && Math.abs(this.ball.z) < GOAL_W) {
      this.teamScores[1]++;
      const scorers = [...this.arenaPlayers.values()].filter(ap => ap.team === 1).map(ap => ap.id);
      this.emitEvent({ type: 'event', event: 'goal', data: { team: 1, score: [...this.teamScores] }, affectedPlayers: scorers, timestamp: Date.now() });
      this.resetBall();
      this.resetPositions();
    } else if (this.ball.x > FIELD_W / 2 && Math.abs(this.ball.z) < GOAL_W) {
      this.teamScores[0]++;
      const scorers = [...this.arenaPlayers.values()].filter(ap => ap.team === 0).map(ap => ap.id);
      this.emitEvent({ type: 'event', event: 'goal', data: { team: 0, score: [...this.teamScores] }, affectedPlayers: scorers, timestamp: Date.now() });
      this.resetBall();
      this.resetPositions();
    } else if (Math.abs(this.ball.x) > FIELD_W / 2) {
      // Wall bounce (behind goal but outside goal area)
      this.ball.vx *= -0.8;
      this.ball.x = Math.sign(this.ball.x) * FIELD_W / 2;
    }
  }

  private resetBall(): void {
    this.ball = { x: 0, y: 0.5, z: 0, vx: (Math.random() - 0.5) * 3, vy: 0, vz: (Math.random() - 0.5) * 3 };
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
        data: {
          team: ap?.team ?? 0,
          teamScores: [...this.teamScores],
          dashCooldown: Math.max(0, ap?.dashCooldown ?? 0),
          isDashing: (ap?.dashTimer ?? 0) > 0,
        },
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
