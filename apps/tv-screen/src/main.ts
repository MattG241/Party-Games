import * as THREE from 'three';
import { Howl } from 'howler';
import { GameState, PlayerState, GameId, COLOR_HEX, GAME_NAMES, GAME_EMOJIS, GAME_DURATIONS } from '@party-blast/shared';
import { GameWebSocket } from './ws';

// ─── Background Music ────────────────────────────────────────────────────────
const bgMusic = new Howl({
  src: ['/tv/Good Luck Babe - Chappell Roan.mp3'],
  loop: true,
  volume: 0.4,
  html5: true,
});

// Browsers require a user gesture before audio can play.
// Start playback on the first click/tap/keypress anywhere on the page.
function startBgMusic() {
  if (!bgMusic.playing()) {
    bgMusic.play();
  }
  document.removeEventListener('click', startBgMusic);
  document.removeEventListener('keydown', startBgMusic);
  document.removeEventListener('touchstart', startBgMusic);
}
document.addEventListener('click', startBgMusic);
document.addEventListener('keydown', startBgMusic);
document.addEventListener('touchstart', startBgMusic);

// ─── WebSocket ────────────────────────────────────────────────────────────────
function getWsUrl(): string {
  if (import.meta.env.VITE_SERVER_URL) return import.meta.env.VITE_SERVER_URL;
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}`;
  }
  return 'ws://localhost:3001';
}
function getHttpUrl(): string {
  if (import.meta.env.VITE_SERVER_URL) {
    return import.meta.env.VITE_SERVER_URL.replace('ws://', 'http://').replace('wss://', 'https://');
  }
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    return `${window.location.protocol}//${window.location.host}`;
  }
  return 'http://localhost:3001';
}

const SERVER_URL = getWsUrl();
const HTTP_URL = getHttpUrl();

const gws = new GameWebSocket(SERVER_URL);

// ─── State ────────────────────────────────────────────────────────────────────
let roomCode = '';
let playerId = '';
let latestState: GameState | null = null;
let previousScores: Record<string, number> = {};

// ─── Three.js Setup ───────────────────────────────────────────────────────────
const canvas = document.getElementById('three-canvas') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
resize();
window.addEventListener('resize', resize);

// ─── DOM Refs ─────────────────────────────────────────────────────────────────
const lobbyScreen = document.getElementById('lobby-screen')!;
const hudEl = document.getElementById('hud')!;
const countdownOverlay = document.getElementById('countdown-overlay')!;
const voteScreen = document.getElementById('vote-screen')!;
const resultsScreen = document.getElementById('results-screen')!;
const victoryScreen = document.getElementById('victory-screen')!;

const roomCodeEl = document.getElementById('room-code')!;
const playerSlotsEl = document.getElementById('player-slots')!;
const startHintEl = document.getElementById('start-hint')!;
const qrContainer = document.getElementById('qr-container')!;
const joinUrlEl = document.getElementById('join-url')!;
const timerEl = document.getElementById('timer-display')!;
const roundEl = document.getElementById('round-display')!;
const gameTitleEl = document.getElementById('game-title')!;
const scoreBarEl = document.getElementById('score-bar')!;
const countdownNumEl = document.getElementById('countdown-number')!;
const countdownGameNameEl = document.getElementById('countdown-game-name')!;
const triviaOverlay = document.getElementById('trivia-overlay')!;
const triviaCategoryEl = document.getElementById('trivia-category')!;
const triviaTimerEl = document.getElementById('trivia-timer')!;
const triviaQuestionEl = document.getElementById('trivia-question-text')!;
const triviaAnswersEl = document.getElementById('trivia-answers')!;

// ─── Screen Management ────────────────────────────────────────────────────────
type Screen = 'lobby' | 'game' | 'countdown' | 'vote' | 'results' | 'victory';
let currentScreen: Screen = 'lobby';

function showScreen(screen: Screen) {
  currentScreen = screen;
  lobbyScreen.classList.toggle('hidden', screen !== 'lobby');
  hudEl.classList.toggle('hidden', screen !== 'game');
  countdownOverlay.classList.toggle('hidden', screen !== 'countdown');
  voteScreen.classList.toggle('hidden', screen !== 'vote');
  resultsScreen.classList.toggle('hidden', screen !== 'results');
  victoryScreen.classList.toggle('hidden', screen !== 'victory');
  // Hide trivia overlay when leaving game screen
  if (screen !== 'game') triviaOverlay.classList.add('hidden');
}

// ─── Scene Management ─────────────────────────────────────────────────────────
type SceneType = 'idle' | 'platform-panic' | 'bomb-tag' | 'arena-ball' | 'sumo-smash' | 'kart-blitz' | 'bullseye-bonanza' | 'doodle-dash' | 'obstacle-gauntlet' | 'trivia-royale' | 'rhythm-riot' | 'generic';
let currentSceneType: SceneType = 'idle';

// Player mesh pool
const playerMeshes = new Map<string, THREE.Mesh>();
const entityMeshes = new Map<string, THREE.Mesh | THREE.Group>();

function clearScene() {
  for (const mesh of playerMeshes.values()) scene.remove(mesh);
  for (const mesh of entityMeshes.values()) scene.remove(mesh);
  playerMeshes.clear();
  entityMeshes.clear();
  // Remove all children except lights
  const toRemove: THREE.Object3D[] = [];
  scene.traverse(obj => {
    if (obj !== scene && !(obj instanceof THREE.Light) && !(obj instanceof THREE.AmbientLight)) {
      if (obj.parent === scene) toRemove.push(obj);
    }
  });
  toRemove.forEach(o => scene.remove(o));
}

function buildIdleScene() {
  scene.background = new THREE.Color(0x0a0a1a);
  scene.fog = new THREE.FogExp2(0x0a0a1a, 0.02);

  const ambient = new THREE.AmbientLight(0x334466, 1.5);
  scene.add(ambient);

  const dir = new THREE.DirectionalLight(0xffffff, 2);
  dir.position.set(10, 20, 10);
  dir.castShadow = true;
  scene.add(dir);

  // Starfield
  const starGeo = new THREE.BufferGeometry();
  const starPositions: number[] = [];
  for (let i = 0; i < 2000; i++) {
    starPositions.push(
      (Math.random() - 0.5) * 300,
      (Math.random() - 0.5) * 300,
      (Math.random() - 0.5) * 300
    );
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, transparent: true, opacity: 0.8 });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  camera.position.set(0, 15, 30);
  camera.lookAt(0, 0, 0);
}

function buildPlatformPanicScene() {
  scene.background = new THREE.Color(0x0d1a3a);
  scene.fog = new THREE.Fog(0x0d1a3a, 30, 80);

  scene.add(new THREE.AmbientLight(0x336699, 2));
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.position.set(15, 30, 15);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 2048;
  sun.shadow.mapSize.height = 2048;
  scene.add(sun);

  // Atmospheric point lights
  const colors = [0x3B8BFF, 0xC03BFF, 0xFF3BB0];
  colors.forEach((c, i) => {
    const pl = new THREE.PointLight(c, 3, 40);
    const a = (i / colors.length) * Math.PI * 2;
    pl.position.set(Math.cos(a) * 20, 10, Math.sin(a) * 20);
    scene.add(pl);
  });

  // Background clouds (simple sprites)
  for (let i = 0; i < 8; i++) {
    const geo = new THREE.SphereGeometry(3 + Math.random() * 4, 8, 6);
    const mat = new THREE.MeshStandardMaterial({ color: 0xaabbcc, transparent: true, opacity: 0.15 });
    const cloud = new THREE.Mesh(geo, mat);
    cloud.position.set((Math.random() - 0.5) * 60, -5 + Math.random() * 10, -10 - Math.random() * 30);
    scene.add(cloud);
  }

  camera.position.set(0, 22, 28);
  camera.lookAt(0, 0, 0);
}

function buildBombTagScene() {
  scene.background = new THREE.Color(0x0a0a0a);

  scene.add(new THREE.AmbientLight(0x111122, 2));

  // Neon grid floor
  const gridGeo = new THREE.PlaneGeometry(30, 30, 20, 20);
  const gridMat = new THREE.MeshBasicMaterial({ color: 0x1a1a2e, side: THREE.DoubleSide });
  const grid = new THREE.Mesh(gridGeo, gridMat);
  grid.rotation.x = -Math.PI / 2;
  grid.position.y = -0.1;
  scene.add(grid);

  // Neon grid lines
  const lineGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(30, 30, 20, 20));
  const lineMat = new THREE.LineBasicMaterial({ color: 0x3B8BFF, transparent: true, opacity: 0.3 });
  const gridLines = new THREE.LineSegments(lineGeo, lineMat);
  gridLines.rotation.x = -Math.PI / 2;
  scene.add(gridLines);

  // Arena boundary neon ring
  const ringGeo = new THREE.TorusGeometry(13, 0.15, 8, 64);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xFF3B3B });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  scene.add(ring);

  // Corner lights
  const neonColors = [0xFF3B3B, 0x3BFFF0, 0xFF3BB0, 0x3BFF6A];
  neonColors.forEach((c, i) => {
    const pl = new THREE.PointLight(c, 5, 20);
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    pl.position.set(Math.cos(a) * 13, 3, Math.sin(a) * 13);
    scene.add(pl);
  });

  camera.position.set(0, 28, 0);
  camera.lookAt(0, 0, 0);
  camera.up.set(0, 0, -1);
}

function buildArenaBallScene() {
  scene.background = new THREE.Color(0x1a3a1a);

  scene.add(new THREE.AmbientLight(0x88aa88, 2));
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.position.set(0, 30, 10);
  sun.castShadow = true;
  scene.add(sun);

  // Field
  const fieldGeo = new THREE.PlaneGeometry(22, 14);
  const fieldMat = new THREE.MeshStandardMaterial({ color: 0x2d7a2d });
  const field = new THREE.Mesh(fieldGeo, fieldMat);
  field.rotation.x = -Math.PI / 2;
  field.receiveShadow = true;
  scene.add(field);

  // Field markings
  const linesMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });

  // Center circle
  const circlePts: THREE.Vector3[] = [];
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    circlePts.push(new THREE.Vector3(Math.cos(a) * 3, 0.01, Math.sin(a) * 3));
  }
  const centerCircle = new THREE.Line(new THREE.BufferGeometry().setFromPoints(circlePts), linesMat);
  scene.add(centerCircle);

  // Center line
  const centerLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.01, -7), new THREE.Vector3(0, 0.01, 7)]),
    linesMat
  );
  scene.add(centerLine);

  // Goals
  const goalMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  [{ x: -11 }, { x: 11 }].forEach(({ x }) => {
    const post1 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 4), goalMat);
    post1.position.set(x, 2, -3);
    scene.add(post1);
    const post2 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 4), goalMat);
    post2.position.set(x, 2, 3);
    scene.add(post2);
    const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 6), goalMat);
    crossbar.rotation.x = Math.PI / 2;
    crossbar.position.set(x, 4, 0);
    scene.add(crossbar);
  });

  // Walls
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x888888, transparent: true, opacity: 0.3 });
  const wallTop = new THREE.Mesh(new THREE.BoxGeometry(22, 1, 0.2), wallMat);
  wallTop.position.set(0, 0.5, 7);
  scene.add(wallTop);
  const wallBot = wallTop.clone();
  wallBot.position.z = -7;
  scene.add(wallBot);

  camera.position.set(0, 20, 22);
  camera.lookAt(0, 0, 0);
}

function buildSumoScene() {
  scene.background = new THREE.Color(0x1a0d00);

  scene.add(new THREE.AmbientLight(0x442200, 3));
  const spot = new THREE.SpotLight(0xffffff, 5, 50, Math.PI / 4, 0.3);
  spot.position.set(0, 25, 0);
  spot.castShadow = true;
  scene.add(spot);

  // Dohyo (sumo ring)
  const dohyo = new THREE.Mesh(
    new THREE.CylinderGeometry(10, 10, 0.5, 64),
    new THREE.MeshStandardMaterial({ color: 0xc8a46e })
  );
  dohyo.receiveShadow = true;
  scene.add(dohyo);

  // Ring boundary line
  const ringLinePts: THREE.Vector3[] = [];
  for (let i = 0; i <= 128; i++) {
    const a = (i / 128) * Math.PI * 2;
    ringLinePts.push(new THREE.Vector3(Math.cos(a) * 10, 0.26, Math.sin(a) * 10));
  }
  const ringLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(ringLinePts),
    new THREE.LineBasicMaterial({ color: 0x1a1a1a, linewidth: 3 })
  );
  scene.add(ringLine);

  // Crowd lights
  const crowdColors = [0xFF8C3B, 0xFFE03B, 0xFF3B3B];
  for (let i = 0; i < 12; i++) {
    const pl = new THREE.PointLight(crowdColors[i % 3], 0.5, 30);
    const a = (i / 12) * Math.PI * 2;
    pl.position.set(Math.cos(a) * 18, 5, Math.sin(a) * 18);
    scene.add(pl);
  }

  camera.position.set(0, 22, 22);
  camera.lookAt(0, 0, 0);
}

function buildKartBlitzScene() {
  scene.background = new THREE.Color(0x0a1a2a);
  scene.fog = new THREE.Fog(0x0a1a2a, 50, 120);

  scene.add(new THREE.AmbientLight(0x446688, 2));
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.position.set(20, 30, 10);
  sun.castShadow = true;
  scene.add(sun);

  // Track ground (grass)
  const groundGeo = new THREE.PlaneGeometry(70, 70);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x2a4a2a });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Render actual track surface between checkpoints
  // Create a wide path following the checkpoint loop
  const cpLoop = [
    { x: 0, z: -15 }, { x: 15, z: -10 }, { x: 18, z: 5 },
    { x: 10, z: 15 }, { x: -5, z: 18 }, { x: -18, z: 10 },
    { x: -18, z: -5 }, { x: -10, z: -15 },
  ];
  // Smooth track path with road surface
  const trackWidth = 6;
  const trackPts: THREE.Vector3[] = [];
  const numSegments = 128;
  for (let i = 0; i <= numSegments; i++) {
    const t = i / numSegments;
    const idx = t * cpLoop.length;
    const i0 = Math.floor(idx) % cpLoop.length;
    const i1 = (i0 + 1) % cpLoop.length;
    const frac = idx - Math.floor(idx);
    // Catmull-rom style smoothing
    const im1 = (i0 - 1 + cpLoop.length) % cpLoop.length;
    const i2 = (i1 + 1) % cpLoop.length;
    const tt = frac;
    const tt2 = tt * tt;
    const tt3 = tt2 * tt;
    const cx = 0.5 * ((2 * cpLoop[i0].x) +
      (-cpLoop[im1].x + cpLoop[i1].x) * tt +
      (2 * cpLoop[im1].x - 5 * cpLoop[i0].x + 4 * cpLoop[i1].x - cpLoop[i2].x) * tt2 +
      (-cpLoop[im1].x + 3 * cpLoop[i0].x - 3 * cpLoop[i1].x + cpLoop[i2].x) * tt3);
    const cz = 0.5 * ((2 * cpLoop[i0].z) +
      (-cpLoop[im1].z + cpLoop[i1].z) * tt +
      (2 * cpLoop[im1].z - 5 * cpLoop[i0].z + 4 * cpLoop[i1].z - cpLoop[i2].z) * tt2 +
      (-cpLoop[im1].z + 3 * cpLoop[i0].z - 3 * cpLoop[i1].z + cpLoop[i2].z) * tt3);
    trackPts.push(new THREE.Vector3(cx, 0.02, cz));
  }

  // Draw track surface as a series of quads
  const trackShape: THREE.Vector3[] = [];
  for (let i = 0; i < trackPts.length - 1; i++) {
    const curr = trackPts[i];
    const next = trackPts[i + 1];
    const dx = next.x - curr.x;
    const dz = next.z - curr.z;
    const len = Math.sqrt(dx * dx + dz * dz) || 1;
    const nx = -dz / len;
    const nz = dx / len;
    trackShape.push(
      new THREE.Vector3(curr.x + nx * trackWidth, 0.02, curr.z + nz * trackWidth),
      new THREE.Vector3(curr.x - nx * trackWidth, 0.02, curr.z - nz * trackWidth),
    );
  }
  // Build geometry from track shape
  const trackGeo = new THREE.BufferGeometry();
  const vertices: number[] = [];
  for (let i = 0; i < trackShape.length - 2; i += 2) {
    const tl = trackShape[i], tr = trackShape[i + 1];
    const bl = trackShape[i + 2], br = trackShape[i + 3];
    if (!tl || !tr || !bl || !br) continue;
    vertices.push(tl.x, tl.y, tl.z, bl.x, bl.y, bl.z, tr.x, tr.y, tr.z);
    vertices.push(tr.x, tr.y, tr.z, bl.x, bl.y, bl.z, br.x, br.y, br.z);
  }
  trackGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  trackGeo.computeVertexNormals();
  const trackMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.9 });
  const trackMesh = new THREE.Mesh(trackGeo, trackMat);
  trackMesh.receiveShadow = true;
  scene.add(trackMesh);

  // Track edge lines (center line)
  const centerLineMat = new THREE.LineBasicMaterial({ color: 0xFFE03B, transparent: true, opacity: 0.4 });
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(trackPts), centerLineMat));

  // Start/finish line
  const startPts = [
    new THREE.Vector3(-trackWidth, 0.03, -16),
    new THREE.Vector3(trackWidth, 0.03, -16),
  ];
  const startLineMat = new THREE.LineBasicMaterial({ color: 0xffffff });
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(startPts), startLineMat));

  // Spotlights at corners
  [0xFF3B3B, 0x3B8BFF, 0x3BFF6A, 0xFFE03B].forEach((c, i) => {
    const pl = new THREE.PointLight(c, 3, 30);
    const a = (i / 4) * Math.PI * 2;
    pl.position.set(Math.cos(a) * 25, 8, Math.sin(a) * 25);
    scene.add(pl);
  });

  camera.position.set(0, 30, 30);
  camera.lookAt(0, 0, 0);
}

function buildBullseyeScene() {
  scene.background = new THREE.Color(0x0d0d2a);

  scene.add(new THREE.AmbientLight(0x334466, 2));
  const spot = new THREE.SpotLight(0xffffff, 5, 50, Math.PI / 3, 0.3);
  spot.position.set(0, 25, 0);
  spot.castShadow = true;
  scene.add(spot);

  // Floor
  const floorGeo = new THREE.PlaneGeometry(40, 40);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x1a1a3a });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Grid lines
  const gridGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(40, 40, 16, 16));
  const gridMat = new THREE.LineBasicMaterial({ color: 0x3B8BFF, transparent: true, opacity: 0.15 });
  const gridLines = new THREE.LineSegments(gridGeo, gridMat);
  gridLines.rotation.x = -Math.PI / 2;
  gridLines.position.y = 0.01;
  scene.add(gridLines);

  // Corner target decorations
  [0xFF3B3B, 0xFFE03B, 0x3BFF6A, 0xC03BFF].forEach((c, i) => {
    const pl = new THREE.PointLight(c, 3, 20);
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    pl.position.set(Math.cos(a) * 16, 3, Math.sin(a) * 16);
    scene.add(pl);
  });

  camera.position.set(0, 25, 25);
  camera.lookAt(0, 0, 0);
}

function buildDoodleDashScene() {
  scene.background = new THREE.Color(0xf5f0e8);

  scene.add(new THREE.AmbientLight(0xffffff, 3));
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(5, 20, 10);
  scene.add(sun);

  // Canvas/whiteboard
  const canvasGeo = new THREE.PlaneGeometry(20, 15);
  const canvasMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const drawCanvas = new THREE.Mesh(canvasGeo, canvasMat);
  drawCanvas.position.set(0, 7.5, -2);
  scene.add(drawCanvas);

  // Frame
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
  const topFrame = new THREE.Mesh(new THREE.BoxGeometry(21, 0.5, 0.5), frameMat);
  topFrame.position.set(0, 15.25, -2);
  scene.add(topFrame);
  const botFrame = topFrame.clone();
  botFrame.position.y = -0.25;
  scene.add(botFrame);
  const leftFrame = new THREE.Mesh(new THREE.BoxGeometry(0.5, 16, 0.5), frameMat);
  leftFrame.position.set(-10.25, 7.5, -2);
  scene.add(leftFrame);
  const rightFrame = leftFrame.clone();
  rightFrame.position.x = 10.25;
  scene.add(rightFrame);

  camera.position.set(0, 8, 18);
  camera.lookAt(0, 7, 0);
}

function buildObstacleGauntletScene() {
  scene.background = new THREE.Color(0x1a0a2a);
  scene.fog = new THREE.Fog(0x1a0a2a, 20, 80);

  scene.add(new THREE.AmbientLight(0x442266, 2));
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.position.set(0, 30, 20);
  sun.castShadow = true;
  scene.add(sun);

  // Track floor
  const trackGeo = new THREE.PlaneGeometry(14, 60);
  const trackMat = new THREE.MeshStandardMaterial({ color: 0x2a2a4a });
  const trackFloor = new THREE.Mesh(trackGeo, trackMat);
  trackFloor.rotation.x = -Math.PI / 2;
  trackFloor.receiveShadow = true;
  scene.add(trackFloor);

  // Side walls
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xC03BFF, emissive: 0x6600aa, emissiveIntensity: 0.3, transparent: true, opacity: 0.4 });
  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3, 60), wallMat);
  leftWall.position.set(-7, 1.5, 0);
  scene.add(leftWall);
  const rightWall = leftWall.clone();
  rightWall.position.x = 7;
  scene.add(rightWall);

  // Neon lane markers
  const laneMat = new THREE.LineBasicMaterial({ color: 0xC03BFF, transparent: true, opacity: 0.3 });
  for (const x of [-7, 7]) {
    const pts = [new THREE.Vector3(x, 0.01, -30), new THREE.Vector3(x, 0.01, 30)];
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), laneMat));
  }

  // Spotlights along track
  for (let i = 0; i < 6; i++) {
    const pl = new THREE.PointLight(i % 2 === 0 ? 0xFF3BB0 : 0x3BFFF0, 3, 15);
    pl.position.set(i % 2 === 0 ? -6 : 6, 4, -25 + i * 10);
    scene.add(pl);
  }

  camera.position.set(0, 20, 20);
  camera.lookAt(0, 0, -5);
}

function buildTriviaScene() {
  scene.background = new THREE.Color(0x0a0a2a);

  scene.add(new THREE.AmbientLight(0x222244, 2));

  // Stage/podium floor
  const stageGeo = new THREE.CylinderGeometry(12, 12, 0.5, 64);
  const stageMat = new THREE.MeshStandardMaterial({ color: 0x1a1a4a });
  const stage = new THREE.Mesh(stageGeo, stageMat);
  stage.receiveShadow = true;
  scene.add(stage);

  // Central spotlight
  const spot = new THREE.SpotLight(0xC03BFF, 8, 30, Math.PI / 4, 0.5);
  spot.position.set(0, 20, 0);
  spot.castShadow = true;
  scene.add(spot);

  // Colored lights around
  const colors = [0xFF3B3B, 0x3B8BFF, 0x3BFF6A, 0xFFE03B, 0xC03BFF, 0xFF8C3B];
  colors.forEach((c, i) => {
    const pl = new THREE.PointLight(c, 2, 20);
    const a = (i / colors.length) * Math.PI * 2;
    pl.position.set(Math.cos(a) * 14, 5, Math.sin(a) * 14);
    scene.add(pl);
  });

  camera.position.set(0, 18, 22);
  camera.lookAt(0, 2, 0);
}

function buildRhythmRiotScene() {
  scene.background = new THREE.Color(0x0a0010);

  scene.add(new THREE.AmbientLight(0x110022, 2));

  // Dance floor
  const floorGeo = new THREE.PlaneGeometry(20, 30);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x1a0030 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Grid for dance floor tiles
  const gridGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(20, 30, 10, 15));
  const gridMat = new THREE.LineBasicMaterial({ color: 0xC03BFF, transparent: true, opacity: 0.2 });
  const gridLines = new THREE.LineSegments(gridGeo, gridMat);
  gridLines.rotation.x = -Math.PI / 2;
  gridLines.position.y = 0.01;
  scene.add(gridLines);

  // Note lane markers (A B X Y)
  const laneColors = [0x3BFF6A, 0xFF3B3B, 0x3B8BFF, 0xFFE03B];
  laneColors.forEach((c, i) => {
    const pl = new THREE.PointLight(c, 4, 15);
    pl.position.set(i * 2 - 3, 1, 12);
    scene.add(pl);

    // Hit zone markers
    const marker = new THREE.Mesh(
      new THREE.RingGeometry(0.3, 0.5, 16),
      new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.6 })
    );
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(i * 2 - 3, 0.02, 12);
    scene.add(marker);
  });

  // Disco lights
  for (let i = 0; i < 8; i++) {
    const pl = new THREE.PointLight(
      [0xFF3BB0, 0xC03BFF, 0x3BFFF0, 0xFFE03B][i % 4],
      2, 20
    );
    const a = (i / 8) * Math.PI * 2;
    pl.position.set(Math.cos(a) * 12, 8, Math.sin(a) * 12);
    scene.add(pl);
  }

  camera.position.set(0, 15, 22);
  camera.lookAt(0, 0, 5);
}

function setupScene(gameId: GameId | null) {
  const type = (gameId ?? 'idle') as SceneType;
  if (type === currentSceneType) return;
  currentSceneType = type;
  clearScene();

  switch (gameId) {
    case 'platform-panic': buildPlatformPanicScene(); break;
    case 'bomb-tag': buildBombTagScene(); break;
    case 'arena-ball': buildArenaBallScene(); break;
    case 'sumo-smash': buildSumoScene(); break;
    case 'kart-blitz': buildKartBlitzScene(); break;
    case 'bullseye-bonanza': buildBullseyeScene(); break;
    case 'doodle-dash': buildDoodleDashScene(); break;
    case 'obstacle-gauntlet': buildObstacleGauntletScene(); break;
    case 'trivia-royale': buildTriviaScene(); break;
    case 'rhythm-riot': buildRhythmRiotScene(); break;
    case null: buildIdleScene(); break;
    default: buildPlatformPanicScene(); break;
  }
}

// ─── Player Rendering ─────────────────────────────────────────────────────────
function getOrCreatePlayerMesh(player: PlayerState): THREE.Mesh {
  let mesh = playerMeshes.get(player.id);
  if (!mesh) {
    const geo = new THREE.SphereGeometry(0.7, 16, 16);
    const hex = COLOR_HEX[player.color] ?? '#ffffff';
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(hex),
      emissive: new THREE.Color(hex),
      emissiveIntensity: 0.3,
      roughness: 0.3,
      metalness: 0.5,
    });
    mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    scene.add(mesh);
    playerMeshes.set(player.id, mesh);

    // Name label using canvas texture
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 256;
    labelCanvas.height = 64;
    const ctx = labelCanvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    if (ctx.roundRect) {
      ctx.roundRect(4, 4, 248, 56, 8);
    } else {
      ctx.rect(4, 4, 248, 56);
    }
    ctx.fill();
    ctx.fillStyle = hex;
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(player.name.slice(0, 10), 128, 32);

    const tex = new THREE.CanvasTexture(labelCanvas);
    const labelGeo = new THREE.PlaneGeometry(2.5, 0.6);
    const labelMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
    const label = new THREE.Mesh(labelGeo, labelMat);
    label.position.y = 1.4;
    label.renderOrder = 1;
    mesh.add(label);
  }
  return mesh;
}

function updatePlayerMeshes(players: PlayerState[]) {
  const activeIds = new Set(players.map(p => p.id));

  // Remove stale meshes
  for (const [id, mesh] of playerMeshes) {
    if (!activeIds.has(id)) {
      scene.remove(mesh);
      playerMeshes.delete(id);
    }
  }

  for (const player of players) {
    if (!player.position) continue;
    const mesh = getOrCreatePlayerMesh(player);
    // Smooth interpolation
    mesh.position.lerp(new THREE.Vector3(player.position.x, player.position.y, player.position.z), 0.3);

    const mat = mesh.material as THREE.MeshStandardMaterial;
    if (player.eliminated) {
      mat.opacity = 0.3;
      mat.transparent = true;
      mat.emissiveIntensity = 0.3;
    } else {
      mat.opacity = 1;
      mat.transparent = false;
      // Bomb holder glow effect
      if (player.data?.hasBomb) {
        mat.emissive.setHex(0xFF3B3B);
        mat.emissiveIntensity = 1.2 + Math.sin(Date.now() * 0.01) * 0.5;
        mesh.scale.setScalar(1.0 + Math.sin(Date.now() * 0.008) * 0.1);
      } else {
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0.3;
        mesh.scale.setScalar(1.0);
      }
    }

    // Rotate player to face driving direction (kart-blitz)
    if (player.data?.angle !== undefined) {
      mesh.rotation.y = player.data.angle as number;
    }

    // Boost visual: pulsing emissive glow when boosting
    if (player.data?.boosting) {
      mat.emissiveIntensity = 0.8 + Math.sin(Date.now() * 0.02) * 0.3;
    } else if (!player.data?.hasBomb) {
      mat.emissiveIntensity = 0.3;
    }

    // Finished karts get transparent
    if (player.data?.finished) {
      mat.opacity = 0.5;
      mat.transparent = true;
    }

    // Make label always face camera
    mesh.children.forEach(child => {
      if (child instanceof THREE.Mesh) {
        child.lookAt(camera.position);
      }
    });
  }
}

// ─── Entity Rendering ─────────────────────────────────────────────────────────
function updateEntityMeshes(entities: GameState['entities']) {
  for (const entity of entities) {
    if (entity.type === 'platform' || entity.type === 'platform_crumbling') {
      let mesh = entityMeshes.get(entity.id) as THREE.Mesh;
      if (!mesh) {
        const geo = new THREE.CylinderGeometry(1.3, 1.3, 0.3, 6);
        const mat = new THREE.MeshStandardMaterial({
          color: 0x4488dd,
          roughness: 0.4,
          metalness: 0.6,
          emissive: 0x1144aa,
          emissiveIntensity: 0.2,
        });
        mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        entityMeshes.set(entity.id, mesh);
      }
      const active = entity.data?.active as boolean ?? true;
      mesh.visible = active;
      if (!active) continue;

      mesh.position.set(entity.position.x, entity.position.y, entity.position.z);

      // Crumble effect
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (entity.type === 'platform_crumbling') {
        const duration = (entity.data?.crumbleDuration as number) ?? 2.5;
        const timer = (entity.data?.crumbleTimer as number) ?? duration;
        const t = Math.max(0, timer / duration); // 1 = fresh, 0 = about to fall
        mat.color.setHex(t < 0.3 ? 0xff2200 : t < 0.6 ? 0xff6600 : 0xffaa00);
        mat.emissive.setHex(t < 0.3 ? 0xff2200 : t < 0.6 ? 0xff4400 : 0xff6600);
        mat.emissiveIntensity = 0.4 + (1 - t) * 0.6;
        // Shake more as timer runs out
        mesh.position.y = entity.position.y + (Math.random() - 0.5) * (1 - t) * 0.08;
        // Sink slightly as it crumbles
        mesh.position.y -= (1 - t) * 0.15;
      } else {
        mat.color.setHex(0x4488dd);
        mat.emissive.setHex(0x1144aa);
        mat.emissiveIntensity = 0.2;
      }
    } else if (entity.type === 'ball') {
      let mesh = entityMeshes.get(entity.id) as THREE.Mesh;
      if (!mesh) {
        const geo = new THREE.SphereGeometry(0.6, 32, 32);
        const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
        mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        scene.add(mesh);
        entityMeshes.set(entity.id, mesh);
      }
      mesh.position.lerp(new THREE.Vector3(entity.position.x, entity.position.y, entity.position.z), 0.4);
    } else if (entity.type === 'target') {
      let mesh = entityMeshes.get(entity.id) as THREE.Mesh;
      const radius = (entity.data?.radius as number) ?? 1;
      const points = (entity.data?.points as number) ?? 1;
      if (!mesh) {
        const geo = new THREE.CylinderGeometry(radius, radius, 0.3, 32);
        const color = points >= 5 ? 0xFF3B3B : points >= 3 ? 0xFFE03B : 0x3BFF6A;
        const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.4 });
        mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        scene.add(mesh);
        entityMeshes.set(entity.id, mesh);
        // Add rings
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(radius * 0.6, 0.05, 8, 32),
          new THREE.MeshBasicMaterial({ color: 0xffffff })
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.16;
        mesh.add(ring);
      }
      mesh.position.lerp(new THREE.Vector3(entity.position.x, entity.position.y, entity.position.z), 0.3);
    } else if (entity.type === 'checkpoint') {
      let mesh = entityMeshes.get(entity.id) as THREE.Mesh;
      if (!mesh) {
        const radius = (entity.data?.radius as number) ?? 5;
        const geo = new THREE.TorusGeometry(radius, 0.15, 8, 32);
        const mat = new THREE.MeshBasicMaterial({ color: 0xFFE03B, transparent: true, opacity: 0.15 });
        mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = Math.PI / 2;
        scene.add(mesh);
        entityMeshes.set(entity.id, mesh);
      }
      mesh.position.set(entity.position.x, 0.1, entity.position.z);
      // Highlight next checkpoint for any player (pick the lowest next checkpoint among all)
      const cpIndex = (entity.data?.index as number) ?? -1;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      if (latestState && latestState.gameId === 'kart-blitz') {
        const isNext = latestState.players.some(p => (p.data?.checkpoint as number) === cpIndex && !p.data?.finished);
        mat.opacity = isNext ? 0.5 : 0.1;
        mat.color.setHex(isNext ? 0x3BFF6A : 0xFFE03B);
      }
    } else if (entity.type.startsWith('obstacle_')) {
      let mesh = entityMeshes.get(entity.id) as THREE.Mesh;
      const width = (entity.data?.width as number) ?? 2;
      const obsType = entity.data?.obsType as string;
      if (!mesh) {
        const color = obsType === 'spinner' ? 0xFF3B3B : obsType === 'crusher' ? 0xFF8C3B : 0xC03BFF;
        const geo = new THREE.BoxGeometry(width, 2, 1);
        const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.3 });
        mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        scene.add(mesh);
        entityMeshes.set(entity.id, mesh);
      }
      mesh.position.lerp(new THREE.Vector3(entity.position.x, 1, entity.position.z), 0.3);
      const active = entity.data?.active as boolean ?? true;
      mesh.visible = active || obsType !== 'crusher';
    } else if (entity.type === 'sumo_ring') {
      // Ring is already rendered in the scene builder; no additional mesh needed
    } else if (entity.type === 'trivia_question') {
      // Display trivia question on HTML overlay
      triviaOverlay.classList.remove('hidden');
      const q = entity.data as any;
      triviaCategoryEl.textContent = q.category ?? '';
      triviaTimerEl.textContent = String(q.timer ?? '');
      triviaTimerEl.style.color = (q.timer ?? 15) <= 5 ? '#FF3B3B' : 'white';
      triviaQuestionEl.textContent = `Q${q.questionNumber}: ${q.question}`;
      const answers = (q.answers as string[]) ?? [];
      const labels = ['A', 'B', 'X', 'Y'];
      const colors = ['#3BFF6A', '#FF3B3B', '#3B8BFF', '#FFE03B'];
      const correctIdx = q.correctIndex as number;
      const isReveal = q.phase === 'reveal';
      triviaAnswersEl.innerHTML = answers.map((a: string, i: number) => {
        let cls = 'trivia-answer';
        if (isReveal && i === correctIdx) cls += ' correct';
        else if (isReveal && i !== correctIdx) cls += ' wrong';
        return `<div class="${cls}"><div class="trivia-answer-label" style="background:${colors[i]}33;color:${colors[i]}">${labels[i]}</div>${a}</div>`;
      }).join('');
    } else if (entity.type === 'rhythm_note') {
      let mesh = entityMeshes.get(entity.id) as THREE.Mesh;
      const btn = entity.data?.button as string;
      if (!mesh) {
        const colorMap: Record<string, number> = { a: 0x3BFF6A, b: 0xFF3B3B, x: 0x3B8BFF, y: 0xFFE03B };
        const geo = new THREE.BoxGeometry(1.2, 0.4, 0.8);
        const mat = new THREE.MeshStandardMaterial({ color: colorMap[btn] ?? 0xffffff, emissive: colorMap[btn] ?? 0xffffff, emissiveIntensity: 0.5 });
        mesh = new THREE.Mesh(geo, mat);
        scene.add(mesh);
        entityMeshes.set(entity.id, mesh);
      }
      mesh.position.lerp(new THREE.Vector3(entity.position.x, 0.5, entity.position.z), 0.4);
    } else if (entity.type === 'drawing') {
      // Drawing entities rendered as line segments on the whiteboard
      // Whiteboard is 20x15 at position (0, 7.5, -2)
      let group = entityMeshes.get(entity.id) as THREE.Group;
      if (group) { scene.remove(group); entityMeshes.delete(entity.id); }
      const strokes = entity.data?.strokes as { x: number; y: number }[] | undefined;
      if (strokes && strokes.length > 1) {
        group = new THREE.Group();
        // Map joystick coordinates (-1 to 1) to whiteboard space
        const pts = strokes.map(s => new THREE.Vector3(
          s.x * 9,           // -1..1 -> -9..9 (within 20-wide canvas)
          7.5 - s.y * 6.5,   // -1..1 -> 14..1 (inverted Y, within 15-tall canvas)
          -1.9               // slightly in front of whiteboard at z=-2
        ));
        const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
        const lineMat = new THREE.LineBasicMaterial({ color: 0x333333, linewidth: 2 });
        group.add(new THREE.Line(lineGeo, lineMat));
        scene.add(group);
        entityMeshes.set(entity.id, group);
      }
    }
  }

  // Clean up stale entity meshes
  const activeEntityIds = new Set(entities.map(e => e.id));
  for (const [id, mesh] of entityMeshes) {
    if (!activeEntityIds.has(id)) {
      scene.remove(mesh);
      entityMeshes.delete(id);
    }
  }
}

// ─── HUD ─────────────────────────────────────────────────────────────────────
function updateHUD(state: GameState) {
  // Timer
  const secs = Math.ceil(state.timeRemaining);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  timerEl.textContent = `${m}:${s.toString().padStart(2, '0')}`;
  timerEl.classList.toggle('urgent', secs <= 10);

  // Round
  roundEl.textContent = `ROUND ${state.round + 1}/${state.totalRounds}`;

  // Game title
  if (state.gameId) {
    gameTitleEl.textContent = (GAME_NAMES[state.gameId] ?? state.gameId).toUpperCase();
  }

  // Score bar - sort by race position for kart-blitz, by score otherwise
  const isKart = state.gameId === 'kart-blitz';
  const sorted = isKart
    ? [...state.players].sort((a, b) => {
        const aFinished = a.data?.finished ? 1 : 0;
        const bFinished = b.data?.finished ? 1 : 0;
        if (aFinished !== bFinished) return bFinished - aFinished;
        const aLap = (a.data?.lap as number) ?? 0;
        const bLap = (b.data?.lap as number) ?? 0;
        if (aLap !== bLap) return bLap - aLap;
        return ((b.data?.checkpoint as number) ?? 0) - ((a.data?.checkpoint as number) ?? 0);
      })
    : [...state.players].sort((a, b) => b.score - a.score);

  scoreBarEl.innerHTML = sorted.map((p, i) => {
    const hex = COLOR_HEX[p.color] ?? '#ffffff';
    const initial = p.name.charAt(0).toUpperCase();
    // Show lap info for kart-blitz
    const extraInfo = isKart
      ? `<div style="font-size:11px;opacity:0.7">LAP ${Math.min(((p.data?.lap as number) ?? 0) + 1, 3)}/3</div>`
      : '';
    const finishedBadge = p.data?.finished
      ? '<div style="font-size:11px;color:#3BFF6A;font-weight:700">FINISHED</div>'
      : '';
    return `
      <div class="player-score-card ${p.eliminated ? 'eliminated' : ''} ${!p.connected ? 'disconnected' : ''}"
           style="border-color: ${p.eliminated ? 'transparent' : hex}22">
        <div class="player-avatar-tv" style="background:${hex}33;color:${hex}">${initial}</div>
        <div class="player-name-tv" style="color:${hex}">${p.name}</div>
        ${finishedBadge || extraInfo}
        <div class="player-pts-tv">${p.score}</div>
        <div class="player-pos-badge">#${i + 1}</div>
      </div>
    `;
  }).join('');
}

// ─── Lobby HUD ────────────────────────────────────────────────────────────────
function updateLobbyPlayers(players: PlayerState[]) {
  const title = playerSlotsEl.querySelector('#player-slots-title') ?? playerSlotsEl.children[0];
  if (title) (title as HTMLElement).textContent = `Players (${players.length}/8)`;

  const filledSlots = players.map(p => {
    const hex = COLOR_HEX[p.color] ?? '#ffffff';
    return `
      <div class="player-slot">
        <div class="player-slot-dot" style="background:${hex}33;color:${hex}">${p.name.charAt(0).toUpperCase()}</div>
        <div class="player-slot-name">${p.name}</div>
        ${p.isHost ? '<div class="player-slot-host">HOST</div>' : ''}
      </div>
    `;
  }).join('');

  const emptyCount = Math.max(0, 8 - players.length);
  const emptySlots = Array.from({ length: Math.min(emptyCount, 4) }).map(() => `
    <div class="empty-slot">
      <div class="empty-slot-dot"></div>
      <div class="empty-slot-text">Waiting...</div>
    </div>
  `).join('');

  // Re-create contents keeping title
  playerSlotsEl.innerHTML = `
    <div id="player-slots-title">Players (${players.length}/8)</div>
    ${filledSlots}
    ${emptySlots}
  `;

  startHintEl.classList.toggle('hidden', players.length < 1);
}

// ─── Vote Screen ──────────────────────────────────────────────────────────────
let voteTimerStart = 0;

function showVoteScreen(options: GameId[], votes: Record<string, number>) {
  showScreen('vote');
  voteTimerStart = Date.now();

  const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0);
  const maxVotes = Math.max(...options.map(o => votes[o] ?? 0), 1);

  const html = options.map(opt => {
    const count = votes[opt] ?? 0;
    const pct = totalVotes > 0 ? (count / maxVotes) * 100 : 0;
    const leading = count === maxVotes && count > 0;
    return `
      <div class="vote-card ${leading ? 'leading' : ''}">
        <div class="vote-emoji">${GAME_EMOJIS[opt] ?? '🎮'}</div>
        <div class="vote-game-name">${GAME_NAMES[opt] ?? opt}</div>
        <div class="vote-count">${count}</div>
        <div class="vote-bar-container">
          <div class="vote-bar" style="width:${pct}%"></div>
        </div>
      </div>
    `;
  }).join('');

  document.getElementById('vote-options')!.innerHTML = html;
}

// ─── Results Screen ───────────────────────────────────────────────────────────
function showResults(state: GameState, gameScores: Record<string, number>, cumScores: Record<string, number>) {
  showScreen('results');
  document.getElementById('results-subtitle')!.textContent = `Round ${state.round} of ${state.totalRounds}`;

  const sorted = [...state.players].sort((a, b) => (cumScores[b.id] ?? 0) - (cumScores[a.id] ?? 0));

  const posLabels = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];
  const posClasses = ['gold', 'silver', 'bronze', '', '', '', '', ''];

  const html = sorted.map((p, i) => {
    const hex = COLOR_HEX[p.color] ?? '#ffffff';
    const roundPts = gameScores[p.id] ?? 0;
    const total = cumScores[p.id] ?? 0;
    const prev = previousScores[p.id] ?? 0;
    const delta = total - prev;
    return `
      <div class="result-row" style="animation-delay:${i * 0.1}s">
        <div class="result-pos ${posClasses[i] ?? ''}">${posLabels[i] ?? (i + 1) + 'th'}</div>
        <div class="result-color-dot" style="background:${hex}"></div>
        <div class="result-name">${p.name}</div>
        <div class="result-round-pts">+${roundPts} pts</div>
        <div class="result-total-pts">${total}</div>
      </div>
    `;
  }).join('');

  document.getElementById('results-list')!.innerHTML = html;
  previousScores = { ...cumScores };
}

// ─── Victory Screen ───────────────────────────────────────────────────────────
function showVictory(players: PlayerState[], scores: Record<string, number>) {
  showScreen('victory');

  const sorted = [...players].sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0));
  const [first, second, third] = sorted;

  const makePodiumPlayer = (p: PlayerState | undefined, cls: string, medal: string) => {
    if (!p) return `<div class="podium-step"><div class="podium-player-info"></div><div class="podium-block ${cls}">${medal}</div></div>`;
    const hex = COLOR_HEX[p.color] ?? '#ffffff';
    return `
      <div class="podium-step">
        <div class="podium-player-info">
          <div class="podium-avatar" style="background:${hex}33;color:${hex};border-color:${hex}">${p.name.charAt(0).toUpperCase()}</div>
          <div class="podium-player-name">${p.name}</div>
          <div class="podium-player-score">${scores[p.id] ?? 0} pts</div>
        </div>
        <div class="podium-block ${cls}">${medal}</div>
      </div>
    `;
  };

  document.getElementById('podium')!.innerHTML = `
    ${makePodiumPlayer(second, 'second', '🥈')}
    ${makePodiumPlayer(first, 'first', '🥇')}
    ${makePodiumPlayer(third, 'third', '🥉')}
  `;

  startConfetti();
}

// ─── Confetti ─────────────────────────────────────────────────────────────────
function startConfetti() {
  const confettiCanvas = document.getElementById('confetti-canvas') as HTMLCanvasElement;
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
  const ctx = confettiCanvas.getContext('2d')!;

  const particles: { x: number; y: number; vx: number; vy: number; color: string; size: number; rotation: number; rotSpeed: number }[] = [];
  const colors = ['#FF3B3B', '#3B8BFF', '#3BFF6A', '#FFE03B', '#C03BFF', '#FF8C3B', '#3BFFF0', '#FF3BB0'];

  for (let i = 0; i < 200; i++) {
    particles.push({
      x: Math.random() * window.innerWidth,
      y: -20 - Math.random() * 200,
      vx: (Math.random() - 0.5) * 4,
      vy: 2 + Math.random() * 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 6 + Math.random() * 10,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.2,
    });
  }

  let frame = 0;
  function animateConfetti() {
    if (frame++ > 300) {
      ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      return;
    }
    ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rotSpeed;
      p.vy += 0.05;
      if (p.y > window.innerHeight + 20) { p.y = -20; p.x = Math.random() * window.innerWidth; }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
    requestAnimationFrame(animateConfetti);
  }
  animateConfetti();
}

// ─── QR Code ──────────────────────────────────────────────────────────────────
async function loadQR(code: string) {
  try {
    const res = await fetch(`${HTTP_URL}/qr/${code}`);
    const data = await res.json();
    qrContainer.innerHTML = `<img src="${data.qr}" alt="QR Code" />`;
    joinUrlEl.textContent = data.url;
  } catch {
    qrContainer.innerHTML = `<div style="color:#000;font-size:11px;text-align:center;padding:8px">Scan QR<br>${code}</div>`;
  }
}

// ─── Countdown ────────────────────────────────────────────────────────────────
function runCountdown(gameId: GameId, seconds: number) {
  showScreen('countdown');
  countdownGameNameEl.textContent = (GAME_NAMES[gameId] ?? gameId).toUpperCase();
  setupScene(gameId);

  let remaining = seconds;
  countdownNumEl.textContent = remaining.toString();
  countdownNumEl.style.color = 'white';

  const interval = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(interval);
      countdownNumEl.textContent = 'GO!';
      countdownNumEl.style.color = '#3BFF6A';
      setTimeout(() => showScreen('game'), 700);
    } else {
      countdownNumEl.textContent = remaining.toString();
    }
  }, 1000);
}

// ─── WebSocket Handling ───────────────────────────────────────────────────────
let voteTimer: ReturnType<typeof setInterval> | null = null;

gws.onMessage((msg) => {
  switch (msg.type) {
    case 'room_created':
      roomCode = msg.code;
      playerId = msg.playerId;
      roomCodeEl.textContent = roomCode;
      loadQR(roomCode);
      showScreen('lobby');
      setupScene(null);
      break;

    case 'room_joined':
      updateLobbyPlayers(msg.roomInfo.players);
      break;

    case 'player_joined':
      updateLobbyPlayers(msg.roomInfo.players);
      break;

    case 'player_left':
      updateLobbyPlayers(msg.roomInfo.players);
      break;

    case 'game_starting':
      runCountdown(msg.gameId, msg.countdown);
      break;

    case 'game_votes': {
      if (voteTimer) clearInterval(voteTimer);
      showVoteScreen(msg.options, msg.votes as Record<string, number>);
      let elapsed = 0;
      voteTimer = setInterval(() => {
        elapsed += 100;
        const pct = Math.max(0, 100 - (elapsed / 20000) * 100);
        const fill = document.getElementById('vote-timer-fill');
        if (fill) fill.style.width = pct + '%';
        if (elapsed >= 20000 && voteTimer) {
          clearInterval(voteTimer);
          voteTimer = null;
        }
      }, 100);
      break;
    }

    case 'game_end':
      if (latestState) {
        showResults(latestState, msg.scores, msg.cumulativeScores);
      }
      break;

    case 'settings_updated':
      break;

    case 'ping':
      break;

    case 'state': {
      latestState = msg;

      if (msg.phase === 'playing') {
        if (currentScreen !== 'game') showScreen('game');
        setupScene(msg.gameId);
        updateHUD(msg);
        updatePlayerMeshes(msg.players);
        updateEntityMeshes(msg.entities);
        // Hide trivia overlay if not in trivia game
        if (msg.gameId !== 'trivia-royale') triviaOverlay.classList.add('hidden');
      } else if (msg.phase === 'victory') {
        showVictory(msg.players, msg.scores);
      } else if (msg.phase === 'lobby') {
        if (currentScreen !== 'lobby') showScreen('lobby');
        updateLobbyPlayers(msg.players);
      }
      break;
    }
  }
});

// ─── Animation Loop ───────────────────────────────────────────────────────────
const clock = new THREE.Clock();
let cameraAngle = 0;

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  const elapsed = clock.getElapsedTime();

  // Idle camera orbit
  if (currentScreen === 'lobby' || currentScreen === 'countdown') {
    cameraAngle += delta * 0.15;
    if (currentSceneType === 'idle') {
      camera.position.x = Math.sin(cameraAngle) * 30;
      camera.position.z = Math.cos(cameraAngle) * 30;
      camera.position.y = 15 + Math.sin(elapsed * 0.3) * 3;
      camera.lookAt(0, 0, 0);
    }
  }

  // Vote screen timer bar live update is done via setInterval

  renderer.render(scene, camera);
}

// ─── Init ─────────────────────────────────────────────────────────────────────
buildIdleScene();
gws.connect();
animate();
