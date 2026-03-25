import { EntityState, GameId, PlayerState } from '@party-blast/shared';
import { SCORE_TABLE } from '@party-blast/shared';
import { BaseGame } from './base';
import { GameRoom } from '../rooms/types';

type NoteButton = 'a' | 'b' | 'x' | 'y';

interface RhythmNote {
  id: string;
  button: NoteButton;
  hitTime: number;
  hitBy: Set<string>; // player IDs who hit this note
  missedBy: Set<string>; // player IDs who missed this note
}

interface RhythmPlayer {
  id: string;
  points: number;
  combo: number;
  maxCombo: number;
  perfect: number;
  good: number;
  ok: number;
  miss: number;
  lastHitQuality: string | null;
}

const BUTTONS: NoteButton[] = ['a', 'b', 'x', 'y'];
const SONG_DURATION = 60;
const BPM = 110;
const HIT_WINDOW = 0.3; // ±300ms total
const PERFECT_WINDOW = 0.06;
const GOOD_WINDOW = 0.15;

export class RhythmRiot extends BaseGame {
  private rPlayers: Map<string, RhythmPlayer> = new Map();
  private notes: RhythmNote[] = [];
  private elapsedTime = 0;

  constructor(room: GameRoom) {
    super(room, SONG_DURATION + 10);
    for (const [id] of room.players) {
      this.rPlayers.set(id, {
        id,
        points: 0,
        combo: 0,
        maxCombo: 0,
        perfect: 0,
        good: 0,
        ok: 0,
        miss: 0,
        lastHitQuality: null,
      });
    }
    this.generateNotes();
  }

  get gameId(): GameId { return 'rhythm-riot'; }

  private generateNotes(): void {
    const beatInterval = 60 / BPM;
    let noteId = 0;
    for (let t = 3; t < SONG_DURATION - 2; t += beatInterval) {
      // 35% beats are empty for variety
      if (Math.random() < 0.35) continue;

      const button = BUTTONS[Math.floor(Math.random() * BUTTONS.length)];
      this.notes.push({
        id: `note_${noteId++}`,
        button,
        hitTime: t,
        hitBy: new Set(),
        missedBy: new Set(),
      });

      // Occasionally add double notes (10%)
      if (Math.random() < 0.1) {
        const otherButton = BUTTONS.filter(b => b !== button)[Math.floor(Math.random() * 3)];
        this.notes.push({
          id: `note_${noteId++}`,
          button: otherButton,
          hitTime: t + 0.05,
          hitBy: new Set(),
          missedBy: new Set(),
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
      let bestDist = HIT_WINDOW;

      for (const note of this.notes) {
        if (note.hitBy.has(playerId) || note.missedBy.has(playerId) || note.button !== btn) continue;
        const timeDiff = Math.abs(this.elapsedTime - note.hitTime);
        if (timeDiff < bestDist) {
          bestDist = timeDiff;
          bestNote = note;
        }
      }

      if (bestNote) {
        bestNote.hitBy.add(playerId);
        if (bestDist < PERFECT_WINDOW) {
          p.points += 3;
          p.combo++;
          p.perfect++;
          p.lastHitQuality = 'perfect';
        } else if (bestDist < GOOD_WINDOW) {
          p.points += 2;
          p.combo++;
          p.good++;
          p.lastHitQuality = 'good';
        } else {
          p.points += 1;
          p.combo++;
          p.ok++;
          p.lastHitQuality = 'ok';
        }
        // Combo bonus every 10
        if (p.combo > 0 && p.combo % 10 === 0) {
          p.points += 5;
        }
        p.maxCombo = Math.max(p.maxCombo, p.combo);
      } else {
        // Pressed wrong button with no matching note — break combo
        p.combo = 0;
        p.lastHitQuality = 'miss';
      }
    }
  }

  update(dt: number): void {
    this.elapsedTime += dt;

    // Mark notes as missed per-player after timing window passes
    for (const note of this.notes) {
      if (this.elapsedTime - note.hitTime > HIT_WINDOW) {
        for (const p of this.rPlayers.values()) {
          if (!note.hitBy.has(p.id) && !note.missedBy.has(p.id)) {
            note.missedBy.add(p.id);
            p.miss++;
            p.combo = 0;
            p.lastHitQuality = 'miss';
          }
        }
      }
    }
  }

  getEntities(): EntityState[] {
    // Send upcoming notes — position them so they approach z=0 (the hit line)
    return this.notes
      .filter(n => n.hitBy.size < this.rPlayers.size && !this.allMissed(n) &&
        n.hitTime >= this.elapsedTime - 0.3 && n.hitTime <= this.elapsedTime + 4)
      .map(n => ({
        id: n.id,
        type: 'rhythm_note',
        position: {
          x: BUTTONS.indexOf(n.button) * 2 - 3,
          y: 0,
          z: (n.hitTime - this.elapsedTime) * 5,
        },
        data: { button: n.button, hitTime: n.hitTime, timeUntil: n.hitTime - this.elapsedTime },
      }));
  }

  private allMissed(note: RhythmNote): boolean {
    return note.missedBy.size >= this.rPlayers.size;
  }

  getPlayerStates(): PlayerState[] {
    // Find next few notes for each player to show on phone
    const upcomingByButton: Record<string, number> = {};
    for (const note of this.notes) {
      if (note.hitTime > this.elapsedTime && note.hitTime < this.elapsedTime + 3) {
        if (!upcomingByButton[note.button] || note.hitTime < upcomingByButton[note.button]) {
          upcomingByButton[note.button] = note.hitTime;
        }
      }
    }
    // Next button to press
    let nextButton: string | null = null;
    let nextTime = Infinity;
    for (const [btn, time] of Object.entries(upcomingByButton)) {
      if (time < nextTime) { nextTime = time; nextButton = btn; }
    }

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
          ok: rp2?.ok ?? 0,
          miss: rp2?.miss ?? 0,
          lastHitQuality: rp2?.lastHitQuality,
          elapsedTime: this.elapsedTime,
          songDuration: SONG_DURATION,
          songProgress: Math.min(1, this.elapsedTime / SONG_DURATION),
          nextButton,
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
    return this.elapsedTime >= SONG_DURATION || super.isFinished();
  }
}
