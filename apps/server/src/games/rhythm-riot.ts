import { EntityState, GameId, PlayerState } from '@party-blast/shared';
import { SCORE_TABLE } from '@party-blast/shared';
import { BaseGame } from './base';
import { GameRoom } from '../rooms/types';

type NoteButton = 'a' | 'b' | 'x' | 'y';

interface RhythmNote {
  id: string;
  button: NoteButton;
  hitTime: number; // seconds from start when note should be hit
  hit: boolean;
  missed: boolean;
}

interface RhythmPlayer {
  id: string;
  points: number;
  combo: number;
  maxCombo: number;
  perfect: number;
  good: number;
  miss: number;
  lastHitQuality: string | null; // 'perfect' | 'good' | 'miss'
  hitNotes: Set<string>; // note IDs this player has hit
}

const BUTTONS: NoteButton[] = ['a', 'b', 'x', 'y'];

export class RhythmRiot extends BaseGame {
  private rPlayers: Map<string, RhythmPlayer> = new Map();
  private notes: RhythmNote[] = [];
  private elapsedTime = 0;
  private songDuration: number;
  private bpm = 120;

  constructor(room: GameRoom) {
    super(room, 180);
    this.songDuration = 160;
    for (const [id] of room.players) {
      this.rPlayers.set(id, {
        id,
        points: 0,
        combo: 0,
        maxCombo: 0,
        perfect: 0,
        good: 0,
        miss: 0,
        lastHitQuality: null,
        hitNotes: new Set(),
      });
    }
    this.generateNotes();
  }

  get gameId(): GameId { return 'rhythm-riot'; }

  private generateNotes(): void {
    const beatInterval = 60 / this.bpm;
    let noteId = 0;
    // Generate notes along the song
    for (let t = 2; t < this.songDuration - 2; t += beatInterval) {
      // Some beats are empty for variety
      if (Math.random() < 0.3) continue;

      const button = BUTTONS[Math.floor(Math.random() * BUTTONS.length)];
      this.notes.push({
        id: `note_${noteId++}`,
        button,
        hitTime: t,
        hit: false,
        missed: false,
      });

      // Occasionally add double notes
      if (Math.random() < 0.15) {
        const otherButton = BUTTONS.filter(b => b !== button)[Math.floor(Math.random() * 3)];
        this.notes.push({
          id: `note_${noteId++}`,
          button: otherButton,
          hitTime: t + 0.05,
          hit: false,
          missed: false,
        });
      }
    }
  }

  handleInput(playerId: string, data: Record<string, unknown>): void {
    const p = this.rPlayers.get(playerId);
    if (!p) return;

    const buttons = data.buttons as Record<string, boolean> | undefined;
    if (!buttons) return;

    for (const btn of BUTTONS) {
      if (!buttons[btn]) continue;

      // Find closest unhit note for this button within timing window
      let bestNote: RhythmNote | null = null;
      let bestDist = 0.5; // 500ms window

      for (const note of this.notes) {
        if (p.hitNotes.has(note.id) || note.missed || note.button !== btn) continue;
        const timeDiff = Math.abs(this.elapsedTime - note.hitTime);
        if (timeDiff < bestDist) {
          bestDist = timeDiff;
          bestNote = note;
        }
      }

      if (bestNote) {
        p.hitNotes.add(bestNote.id);
        if (bestDist < 0.08) {
          p.points += 3;
          p.combo++;
          p.perfect++;
          p.lastHitQuality = 'perfect';
        } else if (bestDist < 0.2) {
          p.points += 2;
          p.combo++;
          p.good++;
          p.lastHitQuality = 'good';
        } else {
          p.points += 1;
          p.combo++;
          p.good++;
          p.lastHitQuality = 'ok';
        }
        if (p.combo > 0 && p.combo % 10 === 0) {
          p.points += 5;
        }
        p.maxCombo = Math.max(p.maxCombo, p.combo);
      } else {
        p.combo = 0;
        p.lastHitQuality = 'miss';
      }
    }
  }

  update(dt: number): void {
    this.elapsedTime += dt;

    // Mark notes as missed after timing window passes
    for (const note of this.notes) {
      if (!note.missed && this.elapsedTime - note.hitTime > 0.5) {
        note.missed = true;
      }
    }
  }

  getEntities(): EntityState[] {
    // Send upcoming notes (next ~4 seconds worth)
    const upcoming = this.notes
      .filter(n => !n.hit && !n.missed && n.hitTime >= this.elapsedTime - 0.2 && n.hitTime <= this.elapsedTime + 4)
      .map(n => ({
        id: n.id,
        type: 'rhythm_note',
        position: { x: BUTTONS.indexOf(n.button) * 2 - 3, y: 0, z: (n.hitTime - this.elapsedTime) * 5 },
        data: { button: n.button, hitTime: n.hitTime, timeUntil: n.hitTime - this.elapsedTime },
      }));

    return upcoming;
  }

  getPlayerStates(): PlayerState[] {
    return [...this.room.players.values()].map(rp => {
      const rp2 = this.rPlayers.get(rp.id);
      return {
        id: rp.id,
        name: rp.name,
        color: rp.color,
        score: this.room.cumulativeScores.get(rp.id) ?? 0,
        connected: rp.connected,
        isHost: rp.isHost,
        position: { x: 0, y: 0, z: 0 },
        data: {
          points: rp2?.points ?? 0,
          combo: rp2?.combo ?? 0,
          maxCombo: rp2?.maxCombo ?? 0,
          perfect: rp2?.perfect ?? 0,
          good: rp2?.good ?? 0,
          miss: rp2?.miss ?? 0,
          lastHitQuality: rp2?.lastHitQuality,
          elapsedTime: this.elapsedTime,
          songDuration: this.songDuration,
        },
      };
    });
  }

  getFinalScores(): Record<string, number> {
    const sorted = [...this.rPlayers.values()].sort((a, b) => b.points - a.points);
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
    return this.elapsedTime >= this.songDuration || super.isFinished();
  }
}
