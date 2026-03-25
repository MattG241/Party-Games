import * as THREE from 'three';

interface Particle {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
}

const particles: Particle[] = [];
let particleScene: THREE.Scene | null = null;

export function initParticles(scene: THREE.Scene) {
  particleScene = scene;
}

const sharedGeo = new THREE.SphereGeometry(0.1, 4, 4);

function spawnParticle(
  x: number, y: number, z: number,
  vx: number, vy: number, vz: number,
  color: number, size: number, life: number
) {
  if (!particleScene) return;
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
  const mesh = new THREE.Mesh(sharedGeo, mat);
  mesh.position.set(x, y, z);
  mesh.scale.setScalar(size);
  particleScene.add(mesh);
  particles.push({ mesh, vx, vy, vz, life, maxLife: life });
}

export function updateParticles(dt: number) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      if (particleScene) particleScene.remove(p.mesh);
      p.mesh.geometry = undefined as any; // help GC
      particles.splice(i, 1);
      continue;
    }
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    p.mesh.position.z += p.vz * dt;
    p.vy -= 8 * dt; // gravity
    // Fade out
    const t = p.life / p.maxLife;
    (p.mesh.material as THREE.MeshBasicMaterial).opacity = t;
    p.mesh.scale.setScalar(t * p.mesh.scale.x / t || 0.1);
  }
}

// ─── Effect Presets ──────────────────────────────────────────────────────────

export function explosionEffect(x: number, y: number, z: number) {
  const colors = [0xFF3B3B, 0xFF8C3B, 0xFFE03B, 0xFF6600];
  for (let i = 0; i < 30; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 3 + Math.random() * 8;
    const elev = (Math.random() - 0.3) * 6;
    spawnParticle(
      x, y + 0.5, z,
      Math.cos(angle) * speed, elev + 4, Math.sin(angle) * speed,
      colors[Math.floor(Math.random() * colors.length)],
      0.5 + Math.random() * 1.5,
      0.5 + Math.random() * 0.8
    );
  }
}

export function eliminationEffect(x: number, y: number, z: number, color: number) {
  for (let i = 0; i < 15; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 5;
    spawnParticle(
      x, y + 0.5, z,
      Math.cos(angle) * speed, 3 + Math.random() * 4, Math.sin(angle) * speed,
      color,
      0.3 + Math.random() * 0.8,
      0.4 + Math.random() * 0.5
    );
  }
}

export function goalEffect(x: number, y: number, z: number) {
  for (let i = 0; i < 20; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 4;
    spawnParticle(
      x, y, z,
      Math.cos(angle) * speed, 5 + Math.random() * 5, Math.sin(angle) * speed,
      [0xFFD700, 0xffffff, 0xFFE03B][Math.floor(Math.random() * 3)],
      0.3 + Math.random() * 0.6,
      0.6 + Math.random() * 0.6
    );
  }
}

export function hitSparkEffect(x: number, y: number, z: number) {
  for (let i = 0; i < 8; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 3;
    spawnParticle(
      x, y + 0.5, z,
      Math.cos(angle) * speed, 2 + Math.random() * 2, Math.sin(angle) * speed,
      0xFFE03B,
      0.2 + Math.random() * 0.4,
      0.2 + Math.random() * 0.3
    );
  }
}

export function ringOutEffect(x: number, y: number, z: number, color: number) {
  for (let i = 0; i < 20; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 3 + Math.random() * 6;
    spawnParticle(
      x, y, z,
      Math.cos(angle) * speed, 1 + Math.random() * 3, Math.sin(angle) * speed,
      color,
      0.4 + Math.random() * 1,
      0.5 + Math.random() * 0.5
    );
  }
}

export function platformCrumbleEffect(x: number, y: number, z: number) {
  for (let i = 0; i < 12; i++) {
    spawnParticle(
      x + (Math.random() - 0.5) * 2, y, z + (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 2, -1 - Math.random() * 3, (Math.random() - 0.5) * 2,
      [0x4488dd, 0x6699cc, 0x3366aa][Math.floor(Math.random() * 3)],
      0.3 + Math.random() * 0.5,
      0.5 + Math.random() * 0.5
    );
  }
}

export function boostTrailEffect(x: number, y: number, z: number) {
  for (let i = 0; i < 3; i++) {
    spawnParticle(
      x + (Math.random() - 0.5) * 0.5, y + 0.2, z + (Math.random() - 0.5) * 0.5,
      (Math.random() - 0.5) * 0.5, 0.5 + Math.random(), (Math.random() - 0.5) * 0.5,
      [0xFF8C3B, 0xFFE03B, 0xFF6600][Math.floor(Math.random() * 3)],
      0.2 + Math.random() * 0.3,
      0.2 + Math.random() * 0.2
    );
  }
}
