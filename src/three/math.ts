import * as THREE from 'three';

export const TERRARIUM_BOUNDS = {
  width: 5.0,
  depth: 3.6,
  halfW: 2.5,
  halfD: 1.8,
  innerHalfW: 2.36,
  innerHalfD: 1.66,
  plinthHeight: 0.42,
  soilBaseY: 0.42,
  waterLevelY: 0.92,
  eaveY: 3.2,
  ridgeY: 4.35,
};

export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2D(ix: number, iz: number, seed: number): number {
  let n = Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(seed, 1442695041);
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

export function valueNoise2D(x: number, z: number, seed = 101): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);

  const a = hash2D(ix, iz, seed);
  const b = hash2D(ix + 1, iz, seed);
  const c = hash2D(ix, iz + 1, seed);
  const d = hash2D(ix + 1, iz + 1, seed);

  return THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(a, b, ux),
    THREE.MathUtils.lerp(c, d, ux),
    uz,
  );
}

export function fbm2D(x: number, z: number, seed = 101, octaves = 4): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise2D(x * freq, z * freq, seed + i * 31);
    norm += amp;
    amp *= 0.5;
    freq *= 2.02;
  }
  return sum / norm;
}

/**
 * Deterministic terrain surface elevation inside the terrarium.
 * Creates an elevated mossy ridge on the left-back (-x, -z) and a crystalline pond basin on the right-front (+x, +z).
 */
export function groundHeightAt(x: number, z: number, seed: number): number {
  const baseElevation = 0.98;

  // Elevated undulating ridge on left/back
  const ridgeDist = Math.hypot((x + 0.95) * 0.85, (z + 0.45) * 1.1);
  const ridge = Math.max(0, 1 - ridgeDist / 2.25);
  const ridgeLift = ridge * ridge * 0.48;

  // Secondary gentle mound back-right
  const backMoundDist = Math.hypot((x - 1.25) * 0.95, (z + 0.85) * 1.15);
  const backMound = Math.max(0, 1 - backMoundDist / 1.45);
  const backLift = backMound * backMound * 0.24;

  // Pond basin on right-front (+0.95, +0.42)
  const pondDx = (x - 0.92) / 1.05;
  const pondDz = (z - 0.38) / 0.82;
  const pondDist = Math.hypot(pondDx, pondDz);
  const pondMask = Math.max(0, 1 - pondDist);
  const pondDepth = pondMask * pondMask * (3 - 2 * pondMask) * 0.34;

  // Organic FBM undulation
  const noise = (fbm2D(x * 0.9 + 5.2, z * 0.9 - 3.1, seed, 4) - 0.5) * 0.22;

  // Gently soften near glass walls so soil meets glass cleanly
  const edgeFadeX = THREE.MathUtils.smoothstep(Math.abs(x), 1.85, 2.38);
  const edgeFadeZ = THREE.MathUtils.smoothstep(Math.abs(z), 1.25, 1.66);
  const edgeDamp = 1 - Math.max(edgeFadeX, edgeFadeZ) * 0.35;

  return baseElevation + (ridgeLift + backLift + noise) * edgeDamp - pondDepth;
}

export function isPointInPond(x: number, z: number, seed: number): boolean {
  return groundHeightAt(x, z, seed) < TERRARIUM_BOUNDS.waterLevelY - 0.015;
}
