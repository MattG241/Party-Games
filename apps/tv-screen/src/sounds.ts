// Web Audio API sound effects — no external files needed
let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function playTone(freq: number, duration: number, type: OscillatorType = 'sine', vol = 0.15) {
  try {
    const c = getCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    osc.connect(gain).connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + duration);
  } catch { /* audio not available */ }
}

function playNoise(duration: number, vol = 0.08) {
  try {
    const c = getCtx();
    const bufferSize = c.sampleRate * duration;
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    const gain = c.createGain();
    src.buffer = buffer;
    gain.gain.setValueAtTime(vol, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    src.connect(gain).connect(c.destination);
    src.start();
  } catch { /* audio not available */ }
}

// ─── Game Sound Effects ──────────────────────────────────────────────────────

export function sfxCountdownTick() {
  playTone(800, 0.1, 'square', 0.1);
}

export function sfxCountdownGo() {
  playTone(1200, 0.15, 'square', 0.15);
  setTimeout(() => playTone(1600, 0.3, 'square', 0.15), 100);
}

export function sfxElimination() {
  playTone(300, 0.15, 'sawtooth', 0.12);
  setTimeout(() => playTone(200, 0.3, 'sawtooth', 0.1), 100);
}

export function sfxGoal() {
  playTone(523, 0.1, 'square', 0.12);
  setTimeout(() => playTone(659, 0.1, 'square', 0.12), 100);
  setTimeout(() => playTone(784, 0.3, 'square', 0.15), 200);
}

export function sfxBombPass() {
  playTone(400, 0.08, 'triangle', 0.1);
  setTimeout(() => playTone(600, 0.08, 'triangle', 0.1), 60);
}

export function sfxExplosion() {
  playNoise(0.5, 0.15);
  playTone(80, 0.4, 'sawtooth', 0.12);
}

export function sfxRingOut() {
  playTone(500, 0.1, 'sine', 0.1);
  setTimeout(() => playTone(300, 0.15, 'sine', 0.08), 80);
  setTimeout(() => playTone(150, 0.3, 'sine', 0.06), 160);
}

export function sfxPlatformFall() {
  playTone(200, 0.2, 'triangle', 0.06);
  setTimeout(() => playTone(100, 0.3, 'triangle', 0.04), 150);
}

export function sfxTargetHit() {
  playTone(880, 0.08, 'sine', 0.1);
  setTimeout(() => playTone(1100, 0.1, 'sine', 0.08), 60);
}

export function sfxCorrectAnswer() {
  playTone(523, 0.08, 'sine', 0.1);
  setTimeout(() => playTone(784, 0.15, 'sine', 0.12), 80);
}

export function sfxWrongAnswer() {
  playTone(200, 0.15, 'square', 0.06);
  setTimeout(() => playTone(180, 0.2, 'square', 0.05), 120);
}

export function sfxRhythmHit(quality: string) {
  if (quality === 'perfect') {
    playTone(1047, 0.08, 'sine', 0.1);
  } else if (quality === 'good') {
    playTone(880, 0.08, 'triangle', 0.08);
  } else if (quality === 'ok') {
    playTone(660, 0.06, 'triangle', 0.06);
  }
}

export function sfxLapComplete() {
  playTone(660, 0.08, 'square', 0.08);
  setTimeout(() => playTone(880, 0.12, 'square', 0.1), 80);
}

export function sfxFinishLine() {
  playTone(523, 0.08, 'square', 0.1);
  setTimeout(() => playTone(659, 0.08, 'square', 0.1), 80);
  setTimeout(() => playTone(784, 0.08, 'square', 0.1), 160);
  setTimeout(() => playTone(1047, 0.3, 'square', 0.12), 240);
}

export function sfxVictory() {
  const notes = [523, 659, 784, 1047, 784, 1047];
  notes.forEach((n, i) => {
    setTimeout(() => playTone(n, 0.15, 'square', 0.1), i * 120);
  });
}

export function sfxScoreReveal() {
  playTone(440, 0.06, 'sine', 0.06);
  setTimeout(() => playTone(550, 0.1, 'sine', 0.08), 60);
}

export function sfxPlayerJoin() {
  playTone(600, 0.08, 'sine', 0.08);
  setTimeout(() => playTone(800, 0.1, 'sine', 0.08), 70);
}

export function sfxPlayerLeave() {
  playTone(400, 0.1, 'sine', 0.06);
  setTimeout(() => playTone(300, 0.12, 'sine', 0.05), 80);
}

export function sfxVoteSelect() {
  playTone(700, 0.06, 'triangle', 0.06);
}
