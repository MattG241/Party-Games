import { EntityState, GameId, PlayerState } from '@party-blast/shared';
import { SCORE_TABLE } from '@party-blast/shared';
import { BaseGame } from './base';
import { GameRoom } from '../rooms/types';

interface TriviaQuestion {
  question: string;
  answers: string[];
  correctIndex: number;
  category: string;
}

interface TriviaPlayer {
  id: string;
  points: number;
  streak: number;
  currentAnswer: number | null; // 0-3
  answeredCorrectly: boolean | null;
  eliminated: boolean;
}

const QUESTIONS: TriviaQuestion[] = [
  { question: 'What planet is closest to the Sun?', answers: ['Venus', 'Mercury', 'Mars', 'Earth'], correctIndex: 1, category: 'Space' },
  { question: 'How many sides does a hexagon have?', answers: ['5', '6', '7', '8'], correctIndex: 1, category: 'Math' },
  { question: 'What is the largest ocean?', answers: ['Atlantic', 'Indian', 'Pacific', 'Arctic'], correctIndex: 2, category: 'Geography' },
  { question: 'What gas do plants breathe in?', answers: ['Oxygen', 'Nitrogen', 'CO2', 'Helium'], correctIndex: 2, category: 'Science' },
  { question: 'Who painted the Mona Lisa?', answers: ['Picasso', 'Da Vinci', 'Van Gogh', 'Monet'], correctIndex: 1, category: 'Art' },
  { question: 'What is the speed of light (approx)?', answers: ['300k km/s', '150k km/s', '500k km/s', '1M km/s'], correctIndex: 0, category: 'Science' },
  { question: 'Which country has the most people?', answers: ['USA', 'India', 'China', 'Russia'], correctIndex: 1, category: 'Geography' },
  { question: 'What year did WW2 end?', answers: ['1943', '1944', '1945', '1946'], correctIndex: 2, category: 'History' },
  { question: 'How many legs does a spider have?', answers: ['6', '8', '10', '12'], correctIndex: 1, category: 'Nature' },
  { question: 'What is H2O?', answers: ['Hydrogen', 'Helium', 'Water', 'Oxygen'], correctIndex: 2, category: 'Science' },
  { question: 'Which is the longest river?', answers: ['Amazon', 'Nile', 'Mississippi', 'Yangtze'], correctIndex: 1, category: 'Geography' },
  { question: 'How many colors in a rainbow?', answers: ['5', '6', '7', '8'], correctIndex: 2, category: 'Science' },
  { question: 'What is the capital of Japan?', answers: ['Beijing', 'Seoul', 'Tokyo', 'Bangkok'], correctIndex: 2, category: 'Geography' },
  { question: 'What element has symbol Fe?', answers: ['Fluorine', 'Iron', 'Lead', 'Tin'], correctIndex: 1, category: 'Science' },
  { question: 'Which animal is the tallest?', answers: ['Elephant', 'Giraffe', 'Horse', 'Camel'], correctIndex: 1, category: 'Nature' },
  { question: 'How many continents are there?', answers: ['5', '6', '7', '8'], correctIndex: 2, category: 'Geography' },
  { question: 'What is the hardest natural mineral?', answers: ['Gold', 'Iron', 'Diamond', 'Quartz'], correctIndex: 2, category: 'Science' },
  { question: 'Who wrote Romeo and Juliet?', answers: ['Dickens', 'Shakespeare', 'Austen', 'Twain'], correctIndex: 1, category: 'Literature' },
  { question: 'What is the boiling point of water?', answers: ['90°C', '100°C', '110°C', '120°C'], correctIndex: 1, category: 'Science' },
  { question: 'Which planet has rings?', answers: ['Mars', 'Jupiter', 'Saturn', 'Neptune'], correctIndex: 2, category: 'Space' },
];

export class TriviaRoyale extends BaseGame {
  private tPlayers: Map<string, TriviaPlayer> = new Map();
  private questions: TriviaQuestion[];
  private currentQuestionIndex = 0;
  private questionTimer = 0;
  private questionDuration = 15;
  private phase: 'question' | 'reveal' | 'waiting' = 'question';
  private revealTimer = 0;

  constructor(room: GameRoom) {
    super(room, 300);
    // Shuffle questions
    this.questions = [...QUESTIONS].sort(() => Math.random() - 0.5);
    for (const [id] of room.players) {
      this.tPlayers.set(id, {
        id,
        points: 0,
        streak: 0,
        currentAnswer: null,
        answeredCorrectly: null,
        eliminated: false,
      });
    }
    this.startQuestion();
  }

  get gameId(): GameId { return 'trivia-royale'; }

  private startQuestion(): void {
    if (this.currentQuestionIndex >= this.questions.length) return;
    this.phase = 'question';
    this.questionTimer = this.questionDuration;
    for (const p of this.tPlayers.values()) {
      p.currentAnswer = null;
      p.answeredCorrectly = null;
    }
  }

  handleInput(playerId: string, data: Record<string, unknown>): void {
    const p = this.tPlayers.get(playerId);
    if (!p || p.eliminated || this.phase !== 'question') return;
    if (p.currentAnswer !== null) return; // Already answered

    const buttons = data.buttons as Record<string, boolean> | undefined;
    if (buttons) {
      const mapping: Record<string, number> = { a: 0, b: 1, x: 2, y: 3 };
      for (const [key, idx] of Object.entries(mapping)) {
        if (buttons[key]) {
          p.currentAnswer = idx;
          break;
        }
      }
    }
  }

  update(dt: number): void {
    if (this.currentQuestionIndex >= this.questions.length) return;

    if (this.phase === 'question') {
      this.questionTimer -= dt;

      // Check if all players answered
      const activePlayers = [...this.tPlayers.values()].filter(p => !p.eliminated);
      const allAnswered = activePlayers.every(p => p.currentAnswer !== null);

      if (this.questionTimer <= 0 || allAnswered) {
        this.resolveQuestion();
      }
    } else if (this.phase === 'reveal') {
      this.revealTimer -= dt;
      if (this.revealTimer <= 0) {
        this.currentQuestionIndex++;
        if (this.currentQuestionIndex < this.questions.length) {
          this.startQuestion();
        }
      }
    }
  }

  private resolveQuestion(): void {
    this.phase = 'reveal';
    this.revealTimer = 4;
    const q = this.questions[this.currentQuestionIndex];

    for (const p of this.tPlayers.values()) {
      if (p.eliminated) continue;
      if (p.currentAnswer === q.correctIndex) {
        p.answeredCorrectly = true;
        const timeBonus = Math.ceil((this.questionTimer / this.questionDuration) * 3);
        const streakBonus = Math.min(p.streak, 3);
        p.points += 2 + timeBonus + streakBonus;
        p.streak++;
      } else {
        p.answeredCorrectly = false;
        p.streak = 0;
        // No answer = no penalty, wrong answer = small penalty
        if (p.currentAnswer !== null) {
          p.points = Math.max(0, p.points - 1);
        }
      }
    }

    this.emitEvent({
      type: 'event',
      event: 'score_update',
      data: {
        question: q.question,
        correctIndex: q.correctIndex,
        correctAnswer: q.answers[q.correctIndex],
      },
      affectedPlayers: [...this.tPlayers.keys()],
      timestamp: Date.now(),
    });
  }

  getEntities(): EntityState[] {
    if (this.currentQuestionIndex >= this.questions.length) return [];
    const q = this.questions[this.currentQuestionIndex];
    return [{
      id: 'question',
      type: 'trivia_question',
      position: { x: 0, y: 0, z: 0 },
      data: {
        question: q.question,
        answers: q.answers,
        category: q.category,
        correctIndex: this.phase === 'reveal' ? q.correctIndex : -1,
        phase: this.phase,
        timer: Math.ceil(this.questionTimer),
        questionNumber: this.currentQuestionIndex + 1,
        totalQuestions: Math.min(this.questions.length, 15),
      },
    }];
  }

  getPlayerStates(): PlayerState[] {
    return [...this.room.players.values()].map(rp => {
      const tp = this.tPlayers.get(rp.id);
      return {
        id: rp.id,
        name: rp.name,
        color: rp.color,
        score: this.room.cumulativeScores.get(rp.id) ?? 0,
        connected: rp.connected,
        isHost: rp.isHost,
        position: { x: 0, y: 0, z: 0 },
        eliminated: tp?.eliminated ?? false,
        data: {
          points: tp?.points ?? 0,
          streak: tp?.streak ?? 0,
          currentAnswer: tp?.currentAnswer,
          answeredCorrectly: tp?.answeredCorrectly,
        },
      };
    });
  }

  getFinalScores(): Record<string, number> {
    const sorted = [...this.tPlayers.values()].sort((a, b) => b.points - a.points);
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
    return this.currentQuestionIndex >= Math.min(this.questions.length, 15) || super.isFinished();
  }
}
