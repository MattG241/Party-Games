import { EntityState, GameId, PlayerState } from '@party-blast/shared';
import { SCORE_TABLE } from '@party-blast/shared';
import { BaseGame } from './base';
import { GameRoom } from '../rooms/types';

// Drawing prompt game: players draw on their phones, other players guess
// Simplified as a relay race where players must trace a path quickly

interface DrawPath {
  points: { x: number; y: number }[];
  word: string;
}

interface DoodlePlayer {
  id: string;
  points: number;
  currentDrawing: { x: number; y: number }[];
  isDrawer: boolean;
  hasGuessed: boolean;
}

const WORDS = [
  'cat', 'dog', 'house', 'tree', 'car', 'sun', 'moon', 'fish', 'bird', 'star',
  'boat', 'cake', 'hat', 'shoe', 'ball', 'flag', 'bell', 'cup', 'key', 'book',
  'heart', 'cloud', 'flower', 'apple', 'guitar', 'rocket', 'pizza', 'crown', 'sword', 'ghost',
  'robot', 'dragon', 'castle', 'rainbow', 'unicorn', 'diamond', 'anchor', 'cactus', 'mushroom', 'volcano',
];

export class DoodleDash extends BaseGame {
  private dPlayers: Map<string, DoodlePlayer> = new Map();
  private currentWord = '';
  private drawerId = '';
  private roundTimer = 0;
  private roundDuration = 40;
  private internalRound = 0;
  private totalInternalRounds: number;
  private roundPhase: 'drawing' | 'reveal' = 'drawing';
  private revealTimer = 0;
  private usedWords: Set<string> = new Set();

  constructor(room: GameRoom) {
    super(room, 480);
    this.totalInternalRounds = room.players.size * 2; // Each player draws twice
    for (const [id] of room.players) {
      this.dPlayers.set(id, {
        id,
        points: 0,
        currentDrawing: [],
        isDrawer: false,
        hasGuessed: false,
      });
    }
    this.startNewRound();
  }

  get gameId(): GameId { return 'doodle-dash'; }

  private pickWord(): string {
    const available = WORDS.filter(w => !this.usedWords.has(w));
    const word = available[Math.floor(Math.random() * available.length)] ?? 'star';
    this.usedWords.add(word);
    return word;
  }

  private startNewRound(): void {
    if (this.internalRound >= this.totalInternalRounds) return;

    this.roundPhase = 'drawing';
    this.roundTimer = this.roundDuration;
    this.currentWord = this.pickWord();

    // Rotate drawer
    const playerIds = [...this.dPlayers.keys()];
    this.drawerId = playerIds[this.internalRound % playerIds.length];

    for (const p of this.dPlayers.values()) {
      p.isDrawer = p.id === this.drawerId;
      p.hasGuessed = false;
      p.currentDrawing = [];
    }
  }

  handleInput(playerId: string, data: Record<string, unknown>): void {
    const p = this.dPlayers.get(playerId);
    if (!p) return;

    if (p.isDrawer && this.roundPhase === 'drawing') {
      // Drawer sends drawing strokes via tap
      const tap = data.tap as { x: number; y: number } | undefined;
      if (tap) {
        p.currentDrawing.push({ x: tap.x, y: tap.y });
      }
      // Also accept joystick as drawing position
      const joy = data.joystick as { x: number; y: number } | undefined;
      if (joy && (Math.abs(joy.x) > 0.1 || Math.abs(joy.y) > 0.1)) {
        p.currentDrawing.push({ x: joy.x, y: joy.y });
      }
    }

    const buttons = data.buttons as Record<string, boolean> | undefined;
    if (!p.isDrawer && this.roundPhase === 'drawing') {
      // Guessers use buttons a/b/x/y mapped to guess options
      if (buttons?.a && !p.hasGuessed) {
        p.hasGuessed = true;
        // Time-based scoring: faster guess = more points
        const timeBonus = Math.ceil((this.roundTimer / this.roundDuration) * 5);
        p.points += 3 + timeBonus;
        // Drawer also gets points
        const drawer = this.dPlayers.get(this.drawerId);
        if (drawer) drawer.points += 2;
        this.emitEvent({
          type: 'event',
          event: 'score_update',
          data: { playerId: p.id, points: 3 + timeBonus, word: this.currentWord },
          affectedPlayers: [p.id],
          timestamp: Date.now(),
        });
      }
    }
  }

  update(dt: number): void {
    if (this.internalRound >= this.totalInternalRounds) return;

    if (this.roundPhase === 'drawing') {
      this.roundTimer -= dt;

      // Check if all guessers have guessed
      const guessers = [...this.dPlayers.values()].filter(p => !p.isDrawer);
      const allGuessed = guessers.every(p => p.hasGuessed);

      if (this.roundTimer <= 0 || allGuessed) {
        this.roundPhase = 'reveal';
        this.revealTimer = 3;
      }
    } else if (this.roundPhase === 'reveal') {
      this.revealTimer -= dt;
      if (this.revealTimer <= 0) {
        this.internalRound++;
        this.startNewRound();
      }
    }
  }

  getEntities(): EntityState[] {
    const drawer = this.dPlayers.get(this.drawerId);
    const entities: EntityState[] = [];

    // Send drawing strokes as entities
    if (drawer && drawer.currentDrawing.length > 0) {
      entities.push({
        id: 'drawing',
        type: 'drawing',
        position: { x: 0, y: 0, z: 0 },
        data: {
          strokes: drawer.currentDrawing.slice(-100), // last 100 points
          drawerId: this.drawerId,
        },
      });
    }

    return entities;
  }

  getPlayerStates(): PlayerState[] {
    return [...this.room.players.values()].map(rp => {
      const dp = this.dPlayers.get(rp.id);
      return {
        id: rp.id,
        name: rp.name,
        color: rp.color,
        score: this.room.cumulativeScores.get(rp.id) ?? 0,
        connected: rp.connected,
        isHost: rp.isHost,
        position: { x: 0, y: 0, z: 0 },
        data: {
          points: dp?.points ?? 0,
          isDrawer: dp?.isDrawer ?? false,
          hasGuessed: dp?.hasGuessed ?? false,
          word: dp?.isDrawer ? this.currentWord : (this.roundPhase === 'reveal' ? this.currentWord : this.currentWord.replace(/[a-z]/g, '_')),
          roundPhase: this.roundPhase,
          internalRound: this.internalRound,
          totalInternalRounds: this.totalInternalRounds,
          roundTimer: Math.ceil(this.roundTimer),
        },
      };
    });
  }

  getFinalScores(): Record<string, number> {
    const sorted = [...this.dPlayers.values()].sort((a, b) => b.points - a.points);
    const scores: Record<string, number> = {};
    sorted.forEach((p, i) => {
      scores[p.id] = SCORE_TABLE[i + 1] ?? 3;
    });
    for (const [id] of this.room.players) {
      if (!scores[id]) scores[id] = 3;
    }
    return scores;
  }

  isFinished(): boolean {
    return this.internalRound >= this.totalInternalRounds || super.isFinished();
  }
}
