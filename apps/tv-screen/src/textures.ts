import * as THREE from 'three';

// ─── Canvas Texture Generator ────────────────────────────────────────────────

function createCanvasTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  draw(ctx);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// ─── Grass Texture ───────────────────────────────────────────────────────────
export function grassTexture(): THREE.CanvasTexture {
  return createCanvasTexture(256, 256, (ctx) => {
    // Base green
    ctx.fillStyle = '#2d7a2d';
    ctx.fillRect(0, 0, 256, 256);
    // Darker patches
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const shade = Math.random() > 0.5 ? '#256e25' : '#348f34';
      ctx.fillStyle = shade;
      ctx.fillRect(x, y, 2 + Math.random() * 4, 1 + Math.random() * 2);
    }
    // Grass blades
    ctx.strokeStyle = '#3a9c3a';
    ctx.lineWidth = 1;
    for (let i = 0; i < 100; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (Math.random() - 0.5) * 3, y - 3 - Math.random() * 4);
      ctx.stroke();
    }
  });
}

// ─── Road/Asphalt Texture ────────────────────────────────────────────────────
export function roadTexture(): THREE.CanvasTexture {
  return createCanvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(0, 0, 256, 256);
    // Noise speckles
    for (let i = 0; i < 500; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const v = 40 + Math.random() * 30;
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x, y, 1, 1);
    }
    // Subtle cracks
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      let x = Math.random() * 256;
      let y = Math.random() * 256;
      ctx.moveTo(x, y);
      for (let j = 0; j < 6; j++) {
        x += (Math.random() - 0.5) * 30;
        y += (Math.random() - 0.5) * 30;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  });
}

// ─── Wood/Dohyo Texture ──────────────────────────────────────────────────────
export function woodTexture(): THREE.CanvasTexture {
  return createCanvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = '#c8a46e';
    ctx.fillRect(0, 0, 256, 256);
    // Wood grain lines
    ctx.strokeStyle = '#b8944e';
    ctx.lineWidth = 1;
    for (let y = 0; y < 256; y += 3 + Math.random() * 5) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x < 256; x += 10) {
        ctx.lineTo(x, y + (Math.random() - 0.5) * 2);
      }
      ctx.stroke();
    }
    // Darker knots
    for (let i = 0; i < 3; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const r = 5 + Math.random() * 10;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, '#8a6a3e');
      grad.addColorStop(1, '#c8a46e');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.6, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

// ─── Sand/Desert Texture ─────────────────────────────────────────────────────
export function sandTexture(): THREE.CanvasTexture {
  return createCanvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = '#d4b896';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 400; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const v = 180 + Math.random() * 40;
      ctx.fillStyle = `rgb(${v},${v * 0.85},${v * 0.7})`;
      ctx.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
  });
}

// ─── Neon Grid Texture ───────────────────────────────────────────────────────
export function neonGridTexture(lineColor: string = '#3B8BFF', bgColor: string = '#0a0a1e'): THREE.CanvasTexture {
  return createCanvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 0.3;
    const step = 16;
    for (let x = 0; x <= 256; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 256);
      ctx.stroke();
    }
    for (let y = 0; y <= 256; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(256, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });
}

// ─── Whiteboard Texture ──────────────────────────────────────────────────────
export function whiteboardTexture(): THREE.CanvasTexture {
  return createCanvasTexture(512, 384, (ctx) => {
    // Off-white background
    ctx.fillStyle = '#f8f4ee';
    ctx.fillRect(0, 0, 512, 384);
    // Subtle paper grain
    for (let i = 0; i < 300; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 384;
      ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.03})`;
      ctx.fillRect(x, y, 1, 1);
    }
    // Light grid lines
    ctx.strokeStyle = 'rgba(0, 100, 200, 0.06)';
    ctx.lineWidth = 0.5;
    for (let y = 24; y < 384; y += 24) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }
  });
}

// ─── Target/Bullseye Pattern ─────────────────────────────────────────────────
export function targetTexture(): THREE.CanvasTexture {
  return createCanvasTexture(128, 128, (ctx) => {
    const cx = 64, cy = 64;
    const rings = [
      { r: 60, color: '#ff3333' },
      { r: 48, color: '#ffffff' },
      { r: 36, color: '#ff3333' },
      { r: 24, color: '#ffffff' },
      { r: 12, color: '#ff3333' },
    ];
    for (const ring of rings) {
      ctx.fillStyle = ring.color;
      ctx.beginPath();
      ctx.arc(cx, cy, ring.r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}
