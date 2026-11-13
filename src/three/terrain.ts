import * as THREE from 'three';
import {
  TERRARIUM_BOUNDS,
  fbm2D,
  groundHeightAt,
  isPointInPond,
  mulberry32,
} from './math';
import type { TerrariumMaterialLibrary } from './materials';

export interface TerrainRig {
  group: THREE.Group;
  dispose: () => void;
}

export function createTerrain(
  seed: number,
  materials: TerrariumMaterialLibrary,
  biomePalette: { mossBase: number; mossHighlight: number; waterColor: number },
): TerrainRig {
  const group = new THREE.Group();
  group.name = 'TerrariumTerrain';
  const geometries: THREE.BufferGeometry[] = [];
  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };

  const { innerHalfW, innerHalfD, soilBaseY, waterLevelY } = TERRARIUM_BOUNDS;
  const rng = mulberry32(seed + 77);

  // 1. Sculpted Top Moss & Soil Surface Mesh
  const segX = 56;
  const segZ = 42;
  const topGeo = trackGeo(
    new THREE.PlaneGeometry(innerHalfW * 2, innerHalfD * 2, segX, segZ),
  );
  topGeo.rotateX(-Math.PI / 2);

  const pos = topGeo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cMossBase = new THREE.Color(biomePalette.mossBase);
  const cMossHigh = new THREE.Color(biomePalette.mossHighlight);
  const cSoilBed = new THREE.Color(0x282018);
  const cTmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = groundHeightAt(x, z, seed);
    pos.setY(i, y);

    const n = fbm2D(x * 1.8, z * 1.8, seed + 13, 3);
    if (y < waterLevelY + 0.025) {
      // Dark wet silt & shore stone tint inside and around pond rim
      const shoreT = THREE.MathUtils.clamp((y - (waterLevelY - 0.14)) / 0.165, 0, 1);
      cTmp.copy(cSoilBed).lerp(cMossBase, shoreT * 0.55);
    } else {
      cTmp.copy(cMossBase).lerp(cMossHigh, THREE.MathUtils.clamp(n * 1.15, 0, 1));
    }
    colors[i * 3] = cTmp.r;
    colors[i * 3 + 1] = cTmp.g;
    colors[i * 3 + 2] = cTmp.b;
  }

  topGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  topGeo.computeVertexNormals();

  const topMesh = new THREE.Mesh(topGeo, materials.mossTerrain);
  topMesh.receiveShadow = true;
  topMesh.castShadow = true;
  group.add(topMesh);

  // 2. Cutaway Stratified Side Walls (matching top edge height down to soilBaseY)
  const buildStrataWall = (
    steps: number,
    getPoint: (t: number) => [number, number],
    normalFlip: boolean,
  ) => {
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const [wx, wz] = getPoint(t);
      const topY = groundHeightAt(wx, wz, seed);

      // Bottom vertex at soilBaseY, Top vertex at topY
      positions.push(wx, soilBaseY, wz);
      positions.push(wx, topY, wz);

      uvs.push(t, 0);
      uvs.push(t, 1);
    }

    for (let i = 0; i < steps; i++) {
      const b0 = i * 2;
      const t0 = i * 2 + 1;
      const b1 = (i + 1) * 2;
      const t1 = (i + 1) * 2 + 1;

      if (normalFlip) {
        indices.push(b0, t0, b1, b1, t0, t1);
      } else {
        indices.push(b0, b1, t0, b1, t1, t0);
      }
    }

    const wallGeo = trackGeo(new THREE.BufferGeometry());
    wallGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    wallGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    wallGeo.setIndex(indices);
    wallGeo.computeVertexNormals();

    const wallMesh = new THREE.Mesh(wallGeo, materials.strataSide);
    wallMesh.receiveShadow = true;
    group.add(wallMesh);
  };

  // Front (+Z), Back (-Z), Right (+X), Left (-X)
  buildStrataWall(
    segX,
    (t) => [THREE.MathUtils.lerp(-innerHalfW, innerHalfW, t), innerHalfD],
    false,
  );
  buildStrataWall(
    segX,
    (t) => [THREE.MathUtils.lerp(-innerHalfW, innerHalfW, t), -innerHalfD],
    true,
  );
  buildStrataWall(
    segZ,
    (t) => [innerHalfW, THREE.MathUtils.lerp(-innerHalfD, innerHalfD, t)],
    true,
  );
  buildStrataWall(
    segZ,
    (t) => [-innerHalfW, THREE.MathUtils.lerp(-innerHalfD, innerHalfD, t)],
    false,
  );

  // 3. Crystalline Rainwater Pond Plane (with animated ripple shader)
  materials.waterSurface.color.setHex(biomePalette.waterColor);
  const waterGeo = trackGeo(new THREE.PlaneGeometry(2.35, 1.85, 36, 28));
  waterGeo.rotateX(-Math.PI / 2);
  const waterMesh = new THREE.Mesh(waterGeo, materials.waterSurface);
  waterMesh.position.set(0.92, waterLevelY, 0.38);
  waterMesh.receiveShadow = true;
  waterMesh.renderOrder = 3;
  group.add(waterMesh);

  // 4. Instanced Shoreline & Drainage River Pebbles (InstancedMesh)
  const pebbleGeo = trackGeo(new THREE.DodecahedronGeometry(0.06, 1));
  pebbleGeo.scale(1.25, 0.65, 1.0);
  const pebbleCount = 96;
  const pebbles = new THREE.InstancedMesh(pebbleGeo, materials.pebble, pebbleCount);
  pebbles.castShadow = true;
  pebbles.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const pColor = new THREE.Color();
  const pebbleShades = [0x6e6a61, 0x545149, 0x847e72, 0x454440, 0x625a4e];

  let placed = 0;
  let attempts = 0;
  while (placed < pebbleCount && attempts < 800) {
    attempts++;
    // Cluster most pebbles near the pond shoreline and along edges
    const isShore = placed < 68;
    let px: number;
    let pz: number;
    if (isShore) {
      const angle = rng() * Math.PI * 2;
      const rad = 0.62 + rng() * 0.42;
      px = 0.92 + Math.cos(angle) * rad * 1.05;
      pz = 0.38 + Math.sin(angle) * rad * 0.82;
    } else {
      px = (rng() * 2 - 1) * (innerHalfW - 0.15);
      pz = (rng() * 2 - 1) * (innerHalfD - 0.15);
    }

    if (Math.abs(px) > innerHalfW - 0.1 || Math.abs(pz) > innerHalfD - 0.1) continue;
    const py = groundHeightAt(px, pz, seed);
    if (isShore && (py < waterLevelY - 0.08 || py > waterLevelY + 0.12)) continue;
    if (!isShore && isPointInPond(px, pz, seed)) continue;

    dummy.position.set(px, py + 0.012, pz);
    dummy.rotation.set(rng() * 0.4, rng() * Math.PI * 2, rng() * 0.4);
    const s = 0.65 + rng() * 0.95;
    dummy.scale.set(s, s * (0.7 + rng() * 0.4), s);
    dummy.updateMatrix();

    pebbles.setMatrixAt(placed, dummy.matrix);
    pColor.setHex(pebbleShades[Math.floor(rng() * pebbleShades.length)]);
    pColor.offsetHSL(0, 0, (rng() - 0.5) * 0.08);
    pebbles.setColorAt(placed, pColor);
    placed++;
  }
  pebbles.count = placed;
  pebbles.instanceMatrix.needsUpdate = true;
  if (pebbles.instanceColor) pebbles.instanceColor.needsUpdate = true;
  pebbles.computeBoundingSphere();
  group.add(pebbles);

  return {
    group,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
    },
  };
}
