import * as THREE from 'three';
import type { BiomeStyle, SpecimenInfo } from '../types/terrarium';
import {
  TERRARIUM_BOUNDS,
  groundHeightAt,
  isPointInPond,
  mulberry32,
} from './math';
import type { TerrariumMaterialLibrary } from './materials';

export interface BiomePalette {
  mossBase: number;
  mossHighlight: number;
  canopyColors: number[];
  fernColor: number;
  orchidPetal: number;
  orchidLip: number;
  mushroomCap: number;
  mushroomGlow: number;
  waterColor: number;
}

export const BIOME_PALETTES: Record<BiomeStyle, BiomePalette> = {
  temperate: {
    mossBase: 0x2f5327,
    mossHighlight: 0x58863d,
    canopyColors: [0x3b6f35, 0x4f8940, 0x629b4a, 0x2f5a2b],
    fernColor: 0x4f8c42,
    orchidPetal: 0xf5e9ef,
    orchidLip: 0xc24977,
    mushroomCap: 0x479e86,
    mushroomGlow: 0x68f5cd,
    waterColor: 0x3b6e6c,
  },
  cloudforest: {
    mossBase: 0x244a32,
    mossHighlight: 0x46885b,
    canopyColors: [0x2c6848, 0x3d8259, 0x559d6d, 0x23523a],
    fernColor: 0x3a855c,
    orchidPetal: 0xe6f2ff,
    orchidLip: 0x5c7be8,
    mushroomCap: 0x5992b8,
    mushroomGlow: 0x7fd8ff,
    waterColor: 0x2e6473,
  },
  twilight: {
    mossBase: 0x2b3e30,
    mossHighlight: 0x4c6b53,
    canopyColors: [0x394d42, 0x4e6759, 0x685a73, 0x2c3b36],
    fernColor: 0x476f57,
    orchidPetal: 0xf4dcf2,
    orchidLip: 0x9b45b2,
    mushroomCap: 0x6e59a8,
    mushroomGlow: 0xc494ff,
    waterColor: 0x354d63,
  },
};

export interface FloraRig {
  group: THREE.Group;
  interactables: THREE.Object3D[];
  dispose: () => void;
}

function tagSpecimen(obj: THREE.Object3D, info: SpecimenInfo): void {
  obj.userData.specimen = info;
  obj.traverse((child) => {
    child.layers.enable(1);
    child.userData.specimen = info;
  });
}

function createTaperedTube(
  points: THREE.Vector3[],
  tubularSegs: number,
  radiusStart: number,
  radiusEnd: number,
  radialSegs = 10,
): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, tubularSegs, 1, radialSegs, false);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const c = new THREE.Vector3();

  const ringSize = radialSegs + 1;
  for (let i = 0; i <= tubularSegs; i++) {
    const t = i / tubularSegs;
    curve.getPointAt(t, c);
    const r = THREE.MathUtils.lerp(radiusStart, radiusEnd, Math.pow(t, 0.8));
    for (let j = 0; j < ringSize; j++) {
      const idx = i * ringSize + j;
      v.fromBufferAttribute(pos, idx);
      v.sub(c).multiplyScalar(r).add(c);
      pos.setXYZ(idx, v.x, v.y, v.z);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

export function createFloraEcosystem(
  seed: number,
  biome: BiomeStyle,
  materials: TerrariumMaterialLibrary,
): FloraRig {
  const group = new THREE.Group();
  group.name = 'TerrariumFlora';
  const geometries: THREE.BufferGeometry[] = [];
  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const interactables: THREE.Object3D[] = [];
  const rng = mulberry32(seed + 303);
  const palette = BIOME_PALETTES[biome];

  // Apply biome colors to shared flora materials
  materials.fernFrond.color.setHex(palette.fernColor);
  materials.orchidPetal.color.setHex(palette.orchidPetal);
  materials.orchidLip.color.setHex(palette.orchidLip);
  materials.mushroomCap.color.setHex(palette.mushroomCap);
  materials.mushroomCap.emissive.setHex(palette.mushroomGlow);
  materials.mushroomGlow.color.setHex(palette.mushroomGlow);
  materials.mushroomGlow.emissive.setHex(palette.mushroomGlow);

  // =========================================================================
  // 1. HERO GNARLED MOSSY FICUS / BONSAI TREE (Composite 10+ part group)
  // =========================================================================
  const treeX = -0.95 + (rng() - 0.5) * 0.28;
  const treeZ = -0.35 + (rng() - 0.5) * 0.25;
  const treeBaseY = groundHeightAt(treeX, treeZ, seed);
  const treeGroup = new THREE.Group();
  treeGroup.position.set(treeX, treeBaseY - 0.04, treeZ);
  group.add(treeGroup);

  const trunkLeanX = 0.22 + (rng() - 0.5) * 0.25;
  const trunkLeanZ = 0.14 + (rng() - 0.5) * 0.2;
  const trunkH = 1.48 + rng() * 0.22;

  const trunkPts = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(trunkLeanX * 0.35, trunkH * 0.28, trunkLeanZ * 0.3),
    new THREE.Vector3(-trunkLeanX * 0.15, trunkH * 0.62, trunkLeanZ * 0.55),
    new THREE.Vector3(trunkLeanX * 0.65, trunkH, trunkLeanZ * 0.25),
  ];
  const trunkGeo = trackGeo(createTaperedTube(trunkPts, 24, 0.17, 0.065, 12));
  const trunkMesh = new THREE.Mesh(trunkGeo, materials.bark);
  trunkMesh.castShadow = true;
  trunkMesh.receiveShadow = true;
  treeGroup.add(trunkMesh);

  // 4 Flared root buttresses anchored into soil
  for (let r = 0; r < 4; r++) {
    const rAng = (r / 4) * Math.PI * 2 + rng() * 0.5;
    const rDist = 0.32 + rng() * 0.14;
    const rootPts = [
      new THREE.Vector3(Math.cos(rAng) * 0.06, 0.24, Math.sin(rAng) * 0.06),
      new THREE.Vector3(Math.cos(rAng) * (rDist * 0.55), 0.08, Math.sin(rAng) * (rDist * 0.55)),
      new THREE.Vector3(Math.cos(rAng) * rDist, -0.05, Math.sin(rAng) * rDist),
    ];
    const rootGeo = trackGeo(createTaperedTube(rootPts, 10, 0.06, 0.018, 8));
    const rootMesh = new THREE.Mesh(rootGeo, materials.bark);
    rootMesh.castShadow = true;
    treeGroup.add(rootMesh);
  }

  // 4 Primary twisting canopy branches + aerial tendrils + layered foliage pads
  const canopyTips: { pos: THREE.Vector3; radius: number }[] = [];
  const branchCount = 4;
  for (let b = 0; b < branchCount; b++) {
    const bAng = (b / branchCount) * Math.PI * 2 + 0.45 + rng() * 0.4;
    const bStartT = 0.52 + (b / branchCount) * 0.35;
    const bOrigin = new THREE.CatmullRomCurve3(trunkPts).getPointAt(
      Math.min(0.95, bStartT),
    );
    const bLen = 0.55 + rng() * 0.3;
    const bRise = 0.26 + rng() * 0.24;

    const tipPos = new THREE.Vector3(
      bOrigin.x + Math.cos(bAng) * bLen,
      bOrigin.y + bRise,
      bOrigin.z + Math.sin(bAng) * bLen,
    );
    const midPos = new THREE.Vector3(
      (bOrigin.x + tipPos.x) * 0.5 + (rng() - 0.5) * 0.14,
      (bOrigin.y + tipPos.y) * 0.5 + 0.08,
      (bOrigin.z + tipPos.z) * 0.5 + (rng() - 0.5) * 0.14,
    );
    const branchGeo = trackGeo(createTaperedTube([bOrigin, midPos, tipPos], 12, 0.055, 0.02, 8));
    const branchMesh = new THREE.Mesh(branchGeo, materials.bark);
    branchMesh.castShadow = true;
    treeGroup.add(branchMesh);

    canopyTips.push({ pos: tipPos, radius: 0.36 + rng() * 0.1 });

    // Hanging aerial root tendril on select branches
    if (b % 2 === 0) {
      const dropStart = midPos.clone();
      const dropEnd = new THREE.Vector3(
        dropStart.x + (rng() - 0.5) * 0.06,
        0.04,
        dropStart.z + (rng() - 0.5) * 0.06,
      );
      const aerialMid = dropStart.clone().lerp(dropEnd, 0.5);
      aerialMid.x += 0.04;
      const aerialGeo = trackGeo(createTaperedTube([dropStart, aerialMid, dropEnd], 10, 0.012, 0.006, 6));
      const aerialMesh = new THREE.Mesh(aerialGeo, materials.bark);
      treeGroup.add(aerialMesh);
    }
  }
  // Crown apex pad
  canopyTips.push({
    pos: trunkPts[3].clone().add(new THREE.Vector3(0, 0.14, 0)),
    radius: 0.44,
  });

  // Build sculpted foliage cloud pads (multi-lobed icosahedrons with vertex colors)
  const leafColor = new THREE.Color();
  canopyTips.forEach((tip, idx) => {
    const lobeCount = 3;
    for (let l = 0; l < lobeCount; l++) {
      const padRadius = tip.radius * (l === 0 ? 1.0 : 0.72 + rng() * 0.18);
      const padGeo = trackGeo(new THREE.IcosahedronGeometry(padRadius, 2));
      padGeo.scale(1.28, 0.62, 1.15);

      const pAttr = padGeo.attributes.position;
      const vCols = new Float32Array(pAttr.count * 3);
      for (let vi = 0; vi < pAttr.count; vi++) {
        const vx = pAttr.getX(vi);
        const vy = pAttr.getY(vi);
        const vz = pAttr.getZ(vi);
        const jitter = 0.88 + 0.24 * Math.sin(vx * 9 + vy * 7 + vz * 11 + idx);
        pAttr.setXYZ(vi, vx * jitter, vy * jitter, vz * jitter);

        const cHex = palette.canopyColors[(vi + l) % palette.canopyColors.length];
        leafColor.setHex(cHex);
        leafColor.offsetHSL(0, 0, (vy / padRadius) * 0.08);
        vCols[vi * 3] = leafColor.r;
        vCols[vi * 3 + 1] = leafColor.g;
        vCols[vi * 3 + 2] = leafColor.b;
      }
      padGeo.setAttribute('color', new THREE.BufferAttribute(vCols, 3));
      padGeo.computeVertexNormals();

      const padMesh = new THREE.Mesh(padGeo, materials.canopyLeaf);
      const offAng = (l / lobeCount) * Math.PI * 2 + idx;
      const offR = l === 0 ? 0 : padRadius * 0.55;
      padMesh.position.set(
        tip.pos.x + Math.cos(offAng) * offR,
        tip.pos.y + (l === 0 ? 0.04 : -0.04),
        tip.pos.z + Math.sin(offAng) * offR,
      );
      padMesh.castShadow = true;
      padMesh.receiveShadow = true;
      treeGroup.add(padMesh);
    }
  });

  tagSpecimen(treeGroup, {
    id: 'ficus-microcarpa',
    commonName: 'Gnarled Ficus Bonsai',
    botanicalName: 'Ficus microcarpa var. crassifolia',
    humidityPref: '75–90% RH · Filtered Canopy Light',
    notes: 'Aerial roots absorb ambient mist while layered foliage pads shelter the lower moss bed.',
  });
  interactables.push(treeGroup);

  // =========================================================================
  // 2. WEATHERED LIMESTONE BOULDERS & MOSSY DRIFTWOOD (Hardscape)
  // =========================================================================
  const buildBoulderGroup = (
    bx: number,
    bz: number,
    scale: number,
    rotY: number,
  ) => {
    const by = groundHeightAt(bx, bz, seed);
    const rockGroup = new THREE.Group();
    rockGroup.position.set(bx, by - 0.05, bz);
    rockGroup.rotation.y = rotY;

    const rockParts = [
      { ox: 0, oy: 0.14, oz: 0, sx: 0.34, sy: 0.24, sz: 0.28 },
      { ox: 0.18, oy: 0.08, oz: 0.1, sx: 0.22, sy: 0.16, sz: 0.2 },
      { ox: -0.15, oy: 0.09, oz: -0.08, sx: 0.2, sy: 0.15, sz: 0.18 },
    ];
    for (const part of rockParts) {
      const rGeo = trackGeo(new THREE.DodecahedronGeometry(1, 1));
      const rp = rGeo.attributes.position;
      for (let i = 0; i < rp.count; i++) {
        const vx = rp.getX(i);
        const vy = rp.getY(i);
        const vz = rp.getZ(i);
        const n = 0.84 + 0.28 * Math.sin(vx * 5.2 + vy * 4.1 + vz * 6.3 + bx);
        rp.setXYZ(i, vx * part.sx * scale * n, vy * part.sy * scale * n, vz * part.sz * scale * n);
      }
      rGeo.computeVertexNormals();
      const mesh = new THREE.Mesh(rGeo, materials.stone);
      mesh.position.set(part.ox * scale, part.oy * scale, part.oz * scale);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      rockGroup.add(mesh);
    }

    // Soft moss cushion cap on top of main boulder
    const capGeo = trackGeo(new THREE.SphereGeometry(0.24 * scale, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5));
    capGeo.scale(1.15, 0.38, 0.95);
    const capMat = materials.mossTuft;
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.set(0, 0.26 * scale, 0);
    cap.receiveShadow = true;
    rockGroup.add(cap);

    group.add(rockGroup);
  };

  buildBoulderGroup(0.05, -0.78, 1.15, 0.4);
  buildBoulderGroup(1.52, -0.58, 0.95, 1.8);
  buildBoulderGroup(-1.55, 0.88, 0.85, -0.9);

  // Mossy Driftwood Branch arching near the pond edge
  const logPts = [
    new THREE.Vector3(-0.32, groundHeightAt(-0.32, 0.62, seed) + 0.04, 0.62),
    new THREE.Vector3(0.05, groundHeightAt(0.05, 0.72, seed) + 0.16, 0.72),
    new THREE.Vector3(0.38, groundHeightAt(0.38, 0.56, seed) + 0.06, 0.56),
  ];
  const logGeo = trackGeo(createTaperedTube(logPts, 18, 0.085, 0.045, 9));
  const logMesh = new THREE.Mesh(logGeo, materials.bark);
  logMesh.castShadow = true;
  logMesh.receiveShadow = true;
  group.add(logMesh);

  // =========================================================================
  // 3. LAYERED SWORD FERN ROSETTES (3 Composite Clumps)
  // =========================================================================
  const buildFernFrondGeo = (): THREE.BufferGeometry => {
    const shape = new THREE.Shape();
    const len = 0.62;
    shape.moveTo(0, 0);
    const segs = 10;
    for (let i = 1; i <= segs; i++) {
      const t = i / segs;
      const w = Math.sin(t * Math.PI) * 0.085 * (1 - t * 0.25);
      const indent = i % 2 === 0 ? 0.65 : 1.0;
      shape.lineTo(w * indent, t * len);
    }
    shape.lineTo(0, len + 0.03);
    for (let i = segs; i >= 1; i--) {
      const t = i / segs;
      const w = Math.sin(t * Math.PI) * 0.085 * (1 - t * 0.25);
      const indent = i % 2 === 0 ? 0.65 : 1.0;
      shape.lineTo(-w * indent, t * len);
    }
    shape.closePath();

    const geo = new THREE.ShapeGeometry(shape, 4);
    // Arch the frond gracefully outward along +Z and curve upward along +Y
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const t = y / len;
      const archY = Math.sin(t * Math.PI * 0.72) * 0.36;
      const reachZ = t * 0.48;
      // Slight V-fold along midrib
      const foldY = Math.abs(x) * 0.25;
      p.setXYZ(i, x, archY + foldY, reachZ);
    }
    geo.computeVertexNormals();
    return geo;
  };

  const sharedFrondGeo = trackGeo(buildFernFrondGeo());

  const fernSpots: [number, number, number][] = [
    [-1.58, -0.92, 1.05],
    [1.42, -0.98, 0.92],
    [-1.42, 0.35, 0.85],
  ];

  fernSpots.forEach(([fx, fz, fScale], fIdx) => {
    const fy = groundHeightAt(fx, fz, seed);
    const fernGroup = new THREE.Group();
    fernGroup.position.set(fx, fy - 0.02, fz);

    // Fibrous fern crown base
    const crownGeo = trackGeo(new THREE.SphereGeometry(0.075 * fScale, 10, 8));
    crownGeo.scale(1, 0.6, 1);
    const crown = new THREE.Mesh(crownGeo, materials.bark);
    fernGroup.add(crown);

    const frondCount = 9;
    for (let i = 0; i < frondCount; i++) {
      const frond = new THREE.Mesh(sharedFrondGeo, materials.fernFrond);
      const ang = (i / frondCount) * Math.PI * 2 + rng() * 0.25;
      const tierScale = fScale * (0.78 + (i % 3) * 0.14);
      frond.rotation.y = ang;
      frond.rotation.x = -0.18 + (i % 2) * 0.14;
      frond.scale.setScalar(tierScale);
      frond.castShadow = true;
      frond.receiveShadow = true;
      fernGroup.add(frond);
    }

    group.add(fernGroup);
    if (fIdx === 0) {
      tagSpecimen(fernGroup, {
        id: 'nephrolepis-fern',
        commonName: 'Boston Sword Fern',
        botanicalName: 'Nephrolepis exaltata',
        humidityPref: '65–85% RH · Mist-Fed Fronds',
        notes: 'Pinnate arched fronds unfurl from a mossy crown and respond dynamically to enclosure drafts.',
      });
      interactables.push(fernGroup);
    }
  });

  // =========================================================================
  // 4. TERRARIUM ORCHID / BROMELIAD BLOOM CLUSTER (Composite 8+ parts)
  // =========================================================================
  const buildOrchidCluster = (ox: number, oz: number) => {
    const oy = groundHeightAt(ox, oz, seed);
    const orchidGroup = new THREE.Group();
    orchidGroup.position.set(ox, oy - 0.02, oz);

    // Cupped rosette leaves
    const leafShape = new THREE.Shape();
    leafShape.moveTo(0, 0);
    leafShape.quadraticCurveTo(0.07, 0.14, 0.04, 0.28);
    leafShape.quadraticCurveTo(0, 0.34, 0, 0.36);
    leafShape.quadraticCurveTo(0, 0.34, -0.04, 0.28);
    leafShape.quadraticCurveTo(-0.07, 0.14, 0, 0);
    const oLeafGeo = trackGeo(new THREE.ShapeGeometry(leafShape, 6));
    const lp = oLeafGeo.attributes.position;
    for (let i = 0; i < lp.count; i++) {
      const y = lp.getY(i);
      const t = y / 0.36;
      lp.setZ(i, t * 0.24);
      lp.setY(i, Math.sin(t * Math.PI * 0.6) * 0.16);
    }
    oLeafGeo.computeVertexNormals();

    for (let l = 0; l < 6; l++) {
      const leaf = new THREE.Mesh(oLeafGeo, materials.orchidLeaf);
      leaf.rotation.y = (l / 6) * Math.PI * 2 + 0.2;
      leaf.scale.setScalar(0.85 + (l % 2) * 0.22);
      leaf.castShadow = true;
      orchidGroup.add(leaf);
    }

    // Arching floral spike
    const spikePts = [
      new THREE.Vector3(0, 0.04, 0),
      new THREE.Vector3(0.04, 0.32, 0.06),
      new THREE.Vector3(0.12, 0.56, 0.16),
      new THREE.Vector3(0.24, 0.62, 0.24),
    ];
    const spikeGeo = trackGeo(createTaperedTube(spikePts, 14, 0.015, 0.008, 6));
    const spike = new THREE.Mesh(spikeGeo, materials.orchidLeaf);
    orchidGroup.add(spike);

    // 3 Blossoms along upper spike
    const petalGeo = trackGeo(new THREE.CircleGeometry(0.055, 10));
    petalGeo.scale(0.65, 1.2, 1);
    const lipGeo = trackGeo(new THREE.SphereGeometry(0.028, 10, 8));
    lipGeo.scale(1.1, 0.7, 1.3);

    const curve = new THREE.CatmullRomCurve3(spikePts);
    for (let f = 0; f < 3; f++) {
      const t = 0.68 + f * 0.15;
      const pos = curve.getPointAt(t);
      const flower = new THREE.Group();
      flower.position.copy(pos);
      flower.rotation.set(0.3, 0.4 + f * 0.6, 0);

      for (let pIdx = 0; pIdx < 5; pIdx++) {
        const petal = new THREE.Mesh(petalGeo, materials.orchidPetal);
        const pAng = (pIdx / 5) * Math.PI * 2;
        petal.position.set(Math.cos(pAng) * 0.042, Math.sin(pAng) * 0.042, 0);
        petal.rotation.z = pAng - Math.PI / 2;
        petal.rotation.x = 0.25;
        flower.add(petal);
      }
      const lip = new THREE.Mesh(lipGeo, materials.orchidLip);
      lip.position.set(0, -0.015, 0.025);
      flower.add(lip);

      orchidGroup.add(flower);
    }

    group.add(orchidGroup);
    tagSpecimen(orchidGroup, {
      id: 'phalaenopsis-mini',
      commonName: 'Miniature Jewel Orchid',
      botanicalName: 'Phalaenopsis equestris',
      humidityPref: '70–85% RH · Warm Microclimate',
      notes: 'Epiphytic rosette anchored beside the mossy ridge with arching sprays of miniature blossoms.',
    });
    interactables.push(orchidGroup);
  };

  buildOrchidCluster(-0.22, 0.18);

  // =========================================================================
  // 5. BIOLUMINESCENT MYCENA MUSHROOM COLONY (Composite Lathe + Tube)
  // =========================================================================
  const capLathePts = [
    new THREE.Vector2(0.0, 0.048),
    new THREE.Vector2(0.024, 0.044),
    new THREE.Vector2(0.048, 0.025),
    new THREE.Vector2(0.062, 0.0),
    new THREE.Vector2(0.045, 0.004),
    new THREE.Vector2(0.012, 0.022),
  ];
  const sharedCapGeo = trackGeo(new THREE.LatheGeometry(capLathePts, 16));
  const glowDotGeo = trackGeo(new THREE.SphereGeometry(0.009, 6, 6));

  const buildMushroomCluster = (mx: number, mz: number) => {
    const my = groundHeightAt(mx, mz, seed);
    const mushGroup = new THREE.Group();
    mushGroup.position.set(mx, my - 0.01, mz);

    const count = 6;
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2 + rng() * 0.4;
      const dist = 0.03 + rng() * 0.11;
      const h = 0.12 + rng() * 0.16;
      const leanX = Math.cos(ang) * dist;
      const leanZ = Math.sin(ang) * dist;

      const stemPts = [
        new THREE.Vector3(leanX * 0.3, 0, leanZ * 0.3),
        new THREE.Vector3(leanX * 0.7, h * 0.55, leanZ * 0.7),
        new THREE.Vector3(leanX, h, leanZ),
      ];
      const stemGeo = trackGeo(createTaperedTube(stemPts, 8, 0.013, 0.007, 7));
      const stemMesh = new THREE.Mesh(stemGeo, materials.mushroomStem);
      mushGroup.add(stemMesh);

      const capScale = 0.68 + rng() * 0.65;
      const capMesh = new THREE.Mesh(sharedCapGeo, materials.mushroomCap);
      capMesh.position.set(leanX, h, leanZ);
      capMesh.rotation.set((rng() - 0.5) * 0.3, rng() * Math.PI, (rng() - 0.5) * 0.3);
      capMesh.scale.setScalar(capScale);
      capMesh.castShadow = true;
      mushGroup.add(capMesh);

      // Tiny bioluminescent spots on cap
      for (let s = 0; s < 3; s++) {
        const sAng = (s / 3) * Math.PI * 2 + i;
        const dot = new THREE.Mesh(glowDotGeo, materials.mushroomGlow);
        dot.position.set(
          Math.cos(sAng) * 0.032,
          0.032,
          Math.sin(sAng) * 0.032,
        );
        capMesh.add(dot);
      }
    }

    group.add(mushGroup);
    tagSpecimen(mushGroup, {
      id: 'mycena-chlorophos',
      commonName: 'Bioluminescent Mycena',
      botanicalName: 'Mycena chlorophos',
      humidityPref: '85–95% RH · Nocturnal Glow',
      notes: 'Saprotrophic fungi thriving on damp humus; caps emit an ethereal bioluminescence after dusk.',
    });
    interactables.push(mushGroup);
  };

  buildMushroomCluster(0.18, -0.45);
  buildMushroomCluster(-0.62, 0.85);

  // =========================================================================
  // 6. INSTANCED MOSS TUFTS & GRASS BLADES (InstancedMesh > 500 items)
  // =========================================================================
  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(-0.016, 0);
  bladeShape.lineTo(0.016, 0);
  bladeShape.quadraticCurveTo(0.01, 0.11, 0.004, 0.2);
  bladeShape.lineTo(-0.006, 0.14);
  bladeShape.closePath();

  const bladeGeo = trackGeo(new THREE.ShapeGeometry(bladeShape, 3));
  // Subtle natural bend
  const bp = bladeGeo.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    const by = bp.getY(i);
    bp.setZ(i, by * by * 0.65);
  }
  bladeGeo.computeVertexNormals();

  const tuftCount = 560;
  const grassMesh = new THREE.InstancedMesh(bladeGeo, materials.mossTuft, tuftCount);
  grassMesh.castShadow = false;
  grassMesh.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const gColor = new THREE.Color();
  let gPlaced = 0;
  let gAttempts = 0;
  const { innerHalfW, innerHalfD } = TERRARIUM_BOUNDS;

  while (gPlaced < tuftCount && gAttempts < 2400) {
    gAttempts++;
    const gx = (rng() * 2 - 1) * (innerHalfW - 0.1);
    const gz = (rng() * 2 - 1) * (innerHalfD - 0.1);
    if (isPointInPond(gx, gz, seed)) continue;

    const gy = groundHeightAt(gx, gz, seed);
    dummy.position.set(gx, gy - 0.01, gz);
    dummy.rotation.set(
      (rng() - 0.5) * 0.25,
      rng() * Math.PI * 2,
      (rng() - 0.5) * 0.25,
    );
    const s = 0.72 + rng() * 0.62;
    dummy.scale.set(s, s * (0.85 + rng() * 0.45), s);
    dummy.updateMatrix();

    grassMesh.setMatrixAt(gPlaced, dummy.matrix);
    gColor.setHex(
      rng() > 0.45 ? palette.mossHighlight : palette.mossBase,
    );
    gColor.offsetHSL((rng() - 0.5) * 0.03, (rng() - 0.5) * 0.08, (rng() - 0.5) * 0.08);
    grassMesh.setColorAt(gPlaced, gColor);
    gPlaced++;
  }
  grassMesh.count = gPlaced;
  grassMesh.instanceMatrix.needsUpdate = true;
  if (grassMesh.instanceColor) grassMesh.instanceColor.needsUpdate = true;
  grassMesh.computeBoundingSphere();
  group.add(grassMesh);

  return {
    group,
    interactables,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
    },
  };
}
