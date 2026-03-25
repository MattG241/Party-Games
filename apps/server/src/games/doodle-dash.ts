import { EntityState, GameId, PlayerState } from '@party-blast/shared';
import { SCORE_TABLE } from '@party-blast/shared';
import { BaseGame } from './base';
import { GameRoom } from '../rooms/types';

// Drawing game: one player draws on their phone, others guess from 4 choices

interface DoodlePlayer {
  id: string;
  points: number;
  currentDrawing: { x: number; y: number }[];
  isDrawer: boolean;
  hasGuessed: boolean;
}

const WORDS = [
  // Easy
  'cat', 'dog', 'house', 'tree', 'car', 'sun', 'moon', 'fish', 'bird', 'star',
  'boat', 'cake', 'hat', 'shoe', 'ball', 'flag', 'bell', 'cup', 'key', 'book',
  'heart', 'cloud', 'flower', 'apple', 'guitar', 'rocket', 'pizza', 'crown', 'sword', 'ghost',
  'robot', 'dragon', 'castle', 'rainbow', 'unicorn', 'diamond', 'anchor', 'cactus', 'mushroom', 'volcano',
  // Medium
  'penguin', 'bicycle', 'camera', 'scissors', 'umbrella', 'ladder', 'candle', 'piano', 'bridge', 'hammer',
  'turtle', 'whale', 'lighthouse', 'snowman', 'butterfly', 'spider', 'tornado', 'mountain', 'compass', 'trophy',
  'helmet', 'glasses', 'skateboard', 'surfboard', 'airplane', 'helicopter', 'telescope', 'satellite', 'igloo', 'tent',
  // Hard
  'waterfall', 'fireworks', 'dinosaur', 'treasure', 'pirate', 'mermaid', 'wizard', 'vampire', 'alien', 'ninja',
  'astronaut', 'submarine', 'parachute', 'trampoline', 'windmill', 'scarecrow', 'skeleton', 'jellyfish', 'octopus', 'porcupine',
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
  private answerChoices: string[] = [];
  private correctAnswerIndex = 0;

  constructor(room: GameRoom) {
    super(room, 600); // generous timer; game ends by round count not clock
    this.totalInternalRounds = Math.min(room.players.size * 2, 8); // cap at 8 rounds
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

    // Generate 4 answer choices (1 correct + 3 decoys)
    const decoys = WORDS.filter(w => w !== this.currentWord)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    this.answerChoices = [this.currentWord, ...decoys].sort(() => Math.random() - 0.5);
    this.correctAnswerIndex = this.answerChoices.indexOf(this.currentWord);

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
      // Drawer sends drawing strokes via tap (touch points)
      const tap = data.tap as { x: number; y: number } | undefined;
      if (tap) {
        p.currentDrawing.push({ x: tap.x, y: tap.y });
      }
      // Joystick as drawing cursor
      const joy = data.joystick as { x: number; y: number } | undefined;
      if (joy && (Math.abs(joy.x) > 0.1 || Math.abs(joy.y) > 0.1)) {
        p.currentDrawing.push({ x: joy.x, y: joy.y });
      }
      // Pen-up marker: NaN,NaN signals a stroke break
      const buttons = data.buttons as Record<string, boolean> | undefined;
      if (buttons?.penUp) {
        p.currentDrawing.push({ x: NaN, y: NaN });
      }
      // When joystick is released (near zero), add a stroke break
      if (joy && Math.abs(joy.x) < 0.05 && Math.abs(joy.y) < 0.05) {
        const last = p.currentDrawing[p.currentDrawing.length - 1];
        if (last && !isNaN(last.x)) {
          p.currentDrawing.push({ x: NaN, y: NaN });
        }
      }
    }

    const buttons = data.buttons as Record<string, boolean> | undefined;
    if (!p.isDrawer && this.roundPhase === 'drawing' && buttons && !p.hasGuessed) {
      // Guessers use buttons a/b/x/y mapped to answer choices
      const mapping: Record<string, number> = { a: 0, b: 1, x: 2, y: 3 };
      for (const [key, idx] of Object.entries(mapping)) {
        if (!buttons[key]) continue;
        p.hasGuessed = true;
        if (idx === this.correctAnswerIndex) {
          // Correct guess - time-based scoring: faster = more points
          const timeBonus = Math.ceil((this.roundTimer / this.roundDuration) * 5);
          p.points += 3 + timeBonus;
          // Drawer also gets points when someone guesses correctly
          const drawer = this.dPlayers.get(this.drawerId);
          if (drawer) drawer.points += 2;
          this.emitEvent({
            type: 'event',
            event: 'score_update',
            data: { playerId: p.id, points: 3 + timeBonus, word: this.currentWord, correct: true },
            affectedPlayers: [p.id],
            timestamp: Date.now(),
          });
        } else {
          // Wrong guess
          this.emitEvent({
            type: 'event',
            event: 'score_update',
            data: { playerId: p.id, points: 0, word: this.currentWord, correct: false },
            affectedPlayers: [p.id],
            timestamp: Date.now(),
          });
        }
        break;
      }
    }
  }

  update(dt: number): void {
    if (this.internalRound >= this.totalInternalRounds) return;

    if (this.roundPhase === 'drawing') {
      this.roundTimer -= dt;

      // Check if all guessers have guessed
      const guessers = [...this.dPlayers.values()].filter(p => !p.isDrawer);
      const allGuessed = guessers.length > 0 && guessers.every(p => p.hasGuessed);

      if (this.roundTimer <= 0 || allGuessed) {
        this.roundPhase = 'reveal';
        this.revealTimer = 5;
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
          strokes: drawer.currentDrawing.slice(-500),
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
          word: dp?.isDrawer ? this.currentWord : (this.roundPhase === 'reveal' ? this.currentWord : this.currentWord[0] + this.currentWord.slice(1).replace(/[a-zA-Z]/g, '_')),
          answerChoices: dp?.isDrawer ? [] : this.answerChoices,
          correctAnswerIndex: this.roundPhase === 'reveal' ? this.correctAnswerIndex : -1,
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
