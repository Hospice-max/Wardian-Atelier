import * as THREE from 'three';
import { mulberry32 } from './math';

export interface ProceduralTextures {
  mossColor: THREE.CanvasTexture;
  mossBump: THREE.CanvasTexture;
  strataColor: THREE.CanvasTexture;
  strataBump: THREE.CanvasTexture;
  barkColor: THREE.CanvasTexture;
  barkBump: THREE.CanvasTexture;
  stoneColor: THREE.CanvasTexture;
  stoneBump: THREE.CanvasTexture;
  condensationMap: THREE.CanvasTexture;
  mistSprite: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  woodPlinthColor: THREE.CanvasTexture;
  plaqueTexture: THREE.CanvasTexture;
}

function makeCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function finalizeTexture(
  canvas: HTMLCanvasElement,
  maxAnisotropy: number,
  isColor: boolean,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTextures {
  const rng = mulberry32(4242);

  // 1. Moss & Soil Top Albedo + Bump (512x512)
  const [mossCanvas, mCtx] = makeCanvas(512, 512);
  const [mossBumpCanvas, mbCtx] = makeCanvas(512, 512);
  mCtx.fillStyle = '#2d4728';
  mCtx.fillRect(0, 0, 512, 512);
  mbCtx.fillStyle = '#606060';
  mbCtx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 6500; i++) {
    const x = rng() * 512;
    const y = rng() * 512;
    const r = 1.2 + rng() * 5.2;
    const palette = ['#36582c', '#456d33', '#273f21', '#547d3b', '#3a3022', '#26381e'];
    const c = palette[Math.floor(rng() * palette.length)];
    mCtx.globalAlpha = 0.25 + rng() * 0.45;
    mCtx.fillStyle = c;
    mCtx.beginPath();
    mCtx.arc(x, y, r, 0, Math.PI * 2);
    mCtx.fill();

    const bumpVal = Math.floor(80 + rng() * 145);
    mbCtx.globalAlpha = 0.32;
    mbCtx.fillStyle = `rgb(${bumpVal},${bumpVal},${bumpVal})`;
    mbCtx.beginPath();
    mbCtx.arc(x, y, r * 0.9, 0, Math.PI * 2);
    mbCtx.fill();
  }
  mCtx.globalAlpha = 1;
  mbCtx.globalAlpha = 1;

  // 2. Stratified Cutaway Soil / Charcoal / Pebbles Side Texture (512x256)
  const [strataCanvas, sCtx] = makeCanvas(512, 256);
  const [strataBumpCanvas, sbCtx] = makeCanvas(512, 256);
  // Top humus soil (0..135)
  const soilGrad = sCtx.createLinearGradient(0, 0, 0, 256);
  soilGrad.addColorStop(0.0, '#271e16');
  soilGrad.addColorStop(0.45, '#1d1610');
  soilGrad.addColorStop(0.54, '#111213'); // activated charcoal band
  soilGrad.addColorStop(0.64, '#18191b');
  soilGrad.addColorStop(0.66, '#38342e'); // drainage gravel
  soilGrad.addColorStop(1.0, '#2a2621');
  sCtx.fillStyle = soilGrad;
  sCtx.fillRect(0, 0, 512, 256);

  sbCtx.fillStyle = '#505050';
  sbCtx.fillRect(0, 0, 512, 256);

  // Soil crumbs & roots in upper layer
  for (let i = 0; i < 2400; i++) {
    const x = rng() * 512;
    const y = rng() * 135;
    const rad = 0.8 + rng() * 2.8;
    sCtx.fillStyle = rng() > 0.2 ? '#32261c' : '#4b3b2b';
    sCtx.globalAlpha = 0.35 + rng() * 0.4;
    sCtx.beginPath();
    sCtx.arc(x, y, rad, 0, Math.PI * 2);
    sCtx.fill();

    const bv = Math.floor(110 + rng() * 110);
    sbCtx.fillStyle = `rgb(${bv},${bv},${bv})`;
    sbCtx.beginPath();
    sbCtx.arc(x, y, rad, 0, Math.PI * 2);
    sbCtx.fill();
  }
  // Charcoal granules (135..165)
  for (let i = 0; i < 650; i++) {
    const x = rng() * 512;
    const y = 135 + rng() * 30;
    const rad = 1.2 + rng() * 3.0;
    sCtx.fillStyle = rng() > 0.5 ? '#1b1d20' : '#0b0c0e';
    sCtx.globalAlpha = 0.7;
    sCtx.beginPath();
    sCtx.arc(x, y, rad, 0, Math.PI * 2);
    sCtx.fill();
  }
  // Bottom river pebbles & LECA clay spheres (168..256)
  for (let i = 0; i < 420; i++) {
    const x = rng() * 512;
    const y = 170 + rng() * 82;
    const rx = 4 + rng() * 7;
    const ry = 3 + rng() * 5;
    const shades = ['#6f6659', '#57524b', '#877867', '#4a4640', '#7a5a46'];
    sCtx.fillStyle = shades[Math.floor(rng() * shades.length)];
    sCtx.globalAlpha = 0.88;
    sCtx.beginPath();
    sCtx.ellipse(x, y, rx, ry, rng() * Math.PI, 0, Math.PI * 2);
    sCtx.fill();

    sbCtx.fillStyle = '#dcdcdc';
    sbCtx.globalAlpha = 0.65;
    sbCtx.beginPath();
    sbCtx.ellipse(x, y, rx * 0.85, ry * 0.85, 0, 0, Math.PI * 2);
    sbCtx.fill();
  }
  sCtx.globalAlpha = 1;
  sbCtx.globalAlpha = 1;

  // 3. Tree Bark Albedo + Bump (256x512)
  const [barkCanvas, bCtx] = makeCanvas(256, 512);
  const [barkBumpCanvas, bbCtx] = makeCanvas(256, 512);
  bCtx.fillStyle = '#3f3227';
  bCtx.fillRect(0, 0, 256, 512);
  bbCtx.fillStyle = '#707070';
  bbCtx.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 700; i++) {
    const x = rng() * 256;
    const y = rng() * 512;
    const w = 1.5 + rng() * 4;
    const h = 16 + rng() * 54;
    bCtx.fillStyle = rng() > 0.35 ? '#2b2119' : rng() > 0.5 ? '#554436' : '#3a4a2c';
    bCtx.globalAlpha = 0.4 + rng() * 0.35;
    bCtx.fillRect(x, y, w, h);

    const bv = rng() > 0.5 ? 40 : 200;
    bbCtx.fillStyle = `rgb(${bv},${bv},${bv})`;
    bbCtx.globalAlpha = 0.35;
    bbCtx.fillRect(x, y, w, h);
  }
  bCtx.globalAlpha = 1;
  bbCtx.globalAlpha = 1;

  // 4. Weathered Limestone Albedo + Bump (256x256)
  const [stoneCanvas, stCtx] = makeCanvas(256, 256);
  const [stoneBumpCanvas, stbCtx] = makeCanvas(256, 256);
  stCtx.fillStyle = '#6f706b';
  stCtx.fillRect(0, 0, 256, 256);
  stbCtx.fillStyle = '#808080';
  stbCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1200; i++) {
    const x = rng() * 256;
    const y = rng() * 256;
    const r = 2 + rng() * 11;
    stCtx.fillStyle = rng() > 0.45 ? '#585a55' : rng() > 0.15 ? '#878880' : '#4a5a3c';
    stCtx.globalAlpha = 0.22 + rng() * 0.25;
    stCtx.beginPath();
    stCtx.arc(x, y, r, 0, Math.PI * 2);
    stCtx.fill();

    const bv = Math.floor(60 + rng() * 160);
    stbCtx.fillStyle = `rgb(${bv},${bv},${bv})`;
    stbCtx.globalAlpha = 0.25;
    stbCtx.beginPath();
    stbCtx.arc(x, y, r * 0.8, 0, Math.PI * 2);
    stbCtx.fill();
  }
  stCtx.globalAlpha = 1;
  stbCtx.globalAlpha = 1;

  // 5. Glass Condensation Droplet Roughness/Mist Map (512x512)
  const [condCanvas, cCtx] = makeCanvas(512, 512);
  cCtx.fillStyle = '#080808'; // smooth glass baseline
  cCtx.fillRect(0, 0, 512, 512);
  // Soft misty fog gradient stronger near bottom/top edges
  const mistGrad = cCtx.createLinearGradient(0, 0, 0, 512);
  mistGrad.addColorStop(0, 'rgba(195, 205, 200, 0.55)');
  mistGrad.addColorStop(0.28, 'rgba(130, 140, 135, 0.20)');
  mistGrad.addColorStop(0.72, 'rgba(155, 165, 160, 0.25)');
  mistGrad.addColorStop(1, 'rgba(215, 222, 218, 0.65)');
  cCtx.fillStyle = mistGrad;
  cCtx.fillRect(0, 0, 512, 512);
  // Crisp tiny condensation beads + occasional drip streaks
  for (let i = 0; i < 1600; i++) {
    const x = rng() * 512;
    const y = rng() * 512;
    const r = 0.9 + rng() * 2.9;
    cCtx.fillStyle = `rgba(245, 250, 248, ${0.35 + rng() * 0.55})`;
    cCtx.beginPath();
    cCtx.arc(x, y, r, 0, Math.PI * 2);
    cCtx.fill();
  }
  for (let i = 0; i < 36; i++) {
    const x = rng() * 512;
    const y = rng() * 400;
    const len = 24 + rng() * 64;
    cCtx.strokeStyle = 'rgba(235, 245, 240, 0.45)';
    cCtx.lineWidth = 1.2 + rng() * 1.4;
    cCtx.beginPath();
    cCtx.moveTo(x, y);
    cCtx.lineTo(x + (rng() - 0.5) * 4, y + len);
    cCtx.stroke();
  }

  // 6. Soft Mist Wisp Sprite (128x128)
  const [spriteCanvas, spCtx] = makeCanvas(128, 128);
  const spGrad = spCtx.createRadialGradient(64, 64, 4, 64, 64, 62);
  spGrad.addColorStop(0, 'rgba(255, 255, 255, 0.72)');
  spGrad.addColorStop(0.45, 'rgba(235, 245, 242, 0.28)');
  spGrad.addColorStop(1, 'rgba(220, 235, 230, 0)');
  spCtx.fillStyle = spGrad;
  spCtx.fillRect(0, 0, 128, 128);

  // 7. Radial Contact Shadow (256x256)
  const [shadowCanvas, shCtx] = makeCanvas(256, 256);
  const shGrad = shCtx.createRadialGradient(128, 128, 14, 128, 128, 124);
  shGrad.addColorStop(0, 'rgba(0, 0, 0, 0.78)');
  shGrad.addColorStop(0.58, 'rgba(0, 0, 0, 0.34)');
  shGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  shCtx.fillStyle = shGrad;
  shCtx.fillRect(0, 0, 256, 256);

  // 8. Dark Walnut Wood Plinth Grain (512x256)
  const [woodCanvas, wCtx] = makeCanvas(512, 256);
  wCtx.fillStyle = '#251c16';
  wCtx.fillRect(0, 0, 512, 256);
  for (let y = 0; y < 256; y += 2) {
    wCtx.fillStyle = rng() > 0.5 ? 'rgba(56, 42, 32, 0.35)' : 'rgba(18, 12, 9, 0.35)';
    wCtx.fillRect(0, y, 512, 1 + rng() * 2);
  }

  // 9. Engraved Brass Nameplate (512x128)
  const [plaqueCanvas, pCtx] = makeCanvas(512, 128);
  const brassGrad = pCtx.createLinearGradient(0, 0, 512, 128);
  brassGrad.addColorStop(0, '#c2a366');
  brassGrad.addColorStop(0.5, '#dfc487');
  brassGrad.addColorStop(1, '#a9894e');
  pCtx.fillStyle = brassGrad;
  pCtx.fillRect(0, 0, 512, 128);
  pCtx.strokeStyle = '#4e3f23';
  pCtx.lineWidth = 5;
  pCtx.strokeRect(12, 12, 488, 104);
  pCtx.fillStyle = '#2e2412';
  pCtx.font = '600 32px Georgia, serif';
  pCtx.textAlign = 'center';
  pCtx.textBaseline = 'middle';
  pCtx.fillText('WARDIAN CONSERVATORY', 256, 52);
  pCtx.font = '500 18px sans-serif';
  pCtx.fillStyle = '#4a3b1f';
  pCtx.fillText('VIVARIUM BOTANICUM  ·  NO. 04', 256, 88);

  const mistSprite = new THREE.CanvasTexture(spriteCanvas);
  mistSprite.colorSpace = THREE.SRGBColorSpace;
  mistSprite.needsUpdate = true;

  const contactShadow = new THREE.CanvasTexture(shadowCanvas);
  contactShadow.colorSpace = THREE.SRGBColorSpace;
  contactShadow.needsUpdate = true;

  const plaqueTexture = finalizeTexture(plaqueCanvas, maxAnisotropy, true, 1, 1);
  plaqueTexture.wrapS = THREE.ClampToEdgeWrapping;
  plaqueTexture.wrapT = THREE.ClampToEdgeWrapping;

  return {
    mossColor: finalizeTexture(mossCanvas, maxAnisotropy, true, 3, 2),
    mossBump: finalizeTexture(mossBumpCanvas, maxAnisotropy, false, 3, 2),
    strataColor: finalizeTexture(strataCanvas, maxAnisotropy, true, 2, 1),
    strataBump: finalizeTexture(strataBumpCanvas, maxAnisotropy, false, 2, 1),
    barkColor: finalizeTexture(barkCanvas, maxAnisotropy, true, 2, 4),
    barkBump: finalizeTexture(barkBumpCanvas, maxAnisotropy, false, 2, 4),
    stoneColor: finalizeTexture(stoneCanvas, maxAnisotropy, true, 2, 2),
    stoneBump: finalizeTexture(stoneBumpCanvas, maxAnisotropy, false, 2, 2),
    condensationMap: finalizeTexture(condCanvas, maxAnisotropy, false, 2, 1.5),
    mistSprite,
    contactShadow,
    woodPlinthColor: finalizeTexture(woodCanvas, maxAnisotropy, true, 2, 1),
    plaqueTexture,
  };
}
