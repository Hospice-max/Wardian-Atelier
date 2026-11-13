import * as THREE from 'three';
import type { EnvironmentTelemetry, WeatherMode } from '../types/terrarium';
import { TERRARIUM_BOUNDS, mulberry32 } from './math';
import type { TerrariumMaterialLibrary } from './materials';
import type { ProceduralTextures } from './textures';
import type { TerrariumVesselRig } from './terrariumVessel';

// Pre-allocated scratch helpers (zero GC inside animation loop)
const _skyColor = new THREE.Color();
const _hemiSky = new THREE.Color();
const _hemiGround = new THREE.Color();
const _keyColor = new THREE.Color();
const _rimColor = new THREE.Color();
const _weatherFogTint = new THREE.Color();
const _dummy = new THREE.Object3D();

const SKY_STOPS: { hour: number; sky: number; hemiSky: number; hemiGround: number; key: number; keyInt: number; hemiInt: number }[] = [
  { hour: 0, sky: 0x090e17, hemiSky: 0x263a5e, hemiGround: 0x0b110f, key: 0x6b8ec9, keyInt: 0.48, hemiInt: 0.32 },
  { hour: 5, sky: 0x161d2e, hemiSky: 0x3b4970, hemiGround: 0x121814, key: 0x7e96c7, keyInt: 0.42, hemiInt: 0.35 },
  { hour: 6.5, sky: 0x352b3b, hemiSky: 0xd98a6c, hemiGround: 0x23241c, key: 0xffa06b, keyInt: 1.35, hemiInt: 0.62 },
  { hour: 9, sky: 0x22302d, hemiSky: 0xd9ece8, hemiGround: 0x2f3b28, key: 0xfff0d4, keyInt: 2.05, hemiInt: 0.85 },
  { hour: 13, sky: 0x263533, hemiSky: 0xe6f4f5, hemiGround: 0x34422c, key: 0xfff8ea, keyInt: 2.3, hemiInt: 0.92 },
  { hour: 17.5, sky: 0x362a28, hemiSky: 0xf2b57e, hemiGround: 0x2a241b, key: 0xffb366, keyInt: 1.75, hemiInt: 0.68 },
  { hour: 19.5, sky: 0x191d2b, hemiSky: 0x5c5b8c, hemiGround: 0x141715, key: 0x8994c9, keyInt: 0.55, hemiInt: 0.38 },
  { hour: 24, sky: 0x090e17, hemiSky: 0x263a5e, hemiGround: 0x0b110f, key: 0x6b8ec9, keyInt: 0.48, hemiInt: 0.32 },
];

export interface AtmosphereRig {
  keyLight: THREE.DirectionalLight;
  hemiLight: THREE.HemisphereLight;
  rimLight: THREE.DirectionalLight;
  interiorLamp: THREE.PointLight;
  update: (
    dt: number,
    elapsed: number,
    timeOfDay: number,
    weather: WeatherMode,
    windStrength: number,
    ventOpen: boolean,
    doorOpen: boolean,
  ) => EnvironmentTelemetry;
  dispose: () => void;
}

export function createAtmosphere(
  scene: THREE.Scene,
  textures: ProceduralTextures,
  materials: TerrariumMaterialLibrary,
  vessel: TerrariumVesselRig,
  isSoftwareGl: boolean,
): AtmosphereRig {
  const rng = mulberry32(8080);

  // Horizon-matched exponential fog
  const fog = new THREE.FogExp2(0x22302d, 0.032);
  scene.fog = fog;
  scene.background = new THREE.Color(0x22302d);

  // 1. Key Light (Sun / Moon) with tight shadow frustum
  const keyLight = new THREE.DirectionalLight(0xfff4df, 2.1);
  keyLight.position.set(5, 8, 5);
  keyLight.castShadow = !isSoftwareGl;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.near = 1.0;
  keyLight.shadow.camera.far = 22.0;
  const d = 4.6;
  keyLight.shadow.camera.left = -d;
  keyLight.shadow.camera.right = d;
  keyLight.shadow.camera.top = d;
  keyLight.shadow.camera.bottom = -d;
  keyLight.shadow.bias = -0.0005;
  keyLight.shadow.normalBias = 0.025;
  scene.add(keyLight);

  // 2. Hemisphere Light (Sky / Ground cool-warm balance)
  const hemiLight = new THREE.HemisphereLight(0xd9ece8, 0x2f3b28, 0.85);
  hemiLight.position.set(0, 10, 0);
  scene.add(hemiLight);

  // 3. Rim Backlight for crisp glass & silhouette separation
  const rimLight = new THREE.DirectionalLight(0x9fc4d4, 0.75);
  rimLight.position.set(-5, 4.5, -6);
  scene.add(rimLight);

  // 4. Warm Conservatory Grow-Lamp inside the terrarium ridge
  const interiorLamp = new THREE.PointLight(0xffbe73, 0, 7.5, 1.8);
  interiorLamp.position.set(0, TERRARIUM_BOUNDS.ridgeY - 0.5, 0);
  scene.add(interiorLamp);

  // =========================================================================
  // WEATHER PARTICLE SYSTEMS (Pre-allocated, zero GC)
  // =========================================================================
  const geometries: THREE.BufferGeometry[] = [];
  const particleMaterials: THREE.Material[] = [];

  // A. Exterior Atmospheric Rain Streaks (InstancedMesh)
  const rainCount = 260;
  const rainGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.42, 4);
  geometries.push(rainGeo);
  const rainMat = new THREE.MeshBasicMaterial({
    color: 0xc2d8e4,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });
  particleMaterials.push(rainMat);
  const rainMesh = new THREE.InstancedMesh(rainGeo, rainMat, rainCount);
  rainMesh.frustumCulled = false;
  rainMesh.visible = false;
  scene.add(rainMesh);

  const rainState = Array.from({ length: rainCount }, () => ({
    x: (rng() - 0.5) * 14,
    y: rng() * 9,
    z: (rng() - 0.5) * 12,
    speed: 7.5 + rng() * 4.5,
  }));

  // B. Interior Condensation Drips falling from glass roof
  const dripCount = 36;
  const dripGeo = new THREE.SphereGeometry(0.014, 6, 6);
  dripGeo.scale(0.8, 1.5, 0.8);
  geometries.push(dripGeo);
  const dripMat = new THREE.MeshBasicMaterial({
    color: 0xdff5ee,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
  });
  particleMaterials.push(dripMat);
  const dripMesh = new THREE.InstancedMesh(dripGeo, dripMat, dripCount);
  dripMesh.frustumCulled = false;
  dripMesh.visible = false;
  scene.add(dripMesh);

  const dripState = Array.from({ length: dripCount }, () => ({
    x: (rng() - 0.5) * 4.2,
    y: 1.1 + rng() * 2.4,
    z: (rng() - 0.5) * 2.8,
    speed: 1.4 + rng() * 1.1,
  }));

  // C. Drifting Interior Mist Clouds (Points with soft radial sprite)
  const mistCount = 54;
  const mistPositions = new Float32Array(mistCount * 3);
  const mistSeeds = Array.from({ length: mistCount }, (_, i) => {
    const x = (rng() - 0.5) * 4.1;
    const y = 1.15 + rng() * 1.35;
    const z = (rng() - 0.5) * 2.7;
    mistPositions[i * 3] = x;
    mistPositions[i * 3 + 1] = y;
    mistPositions[i * 3 + 2] = z;
    return { bx: x, by: y, bz: z, phase: rng() * Math.PI * 2, speed: 0.35 + rng() * 0.4 };
  });
  const mistGeo = new THREE.BufferGeometry();
  mistGeo.setAttribute('position', new THREE.BufferAttribute(mistPositions, 3));
  geometries.push(mistGeo);
  const mistMat = new THREE.PointsMaterial({
    map: textures.mistSprite,
    size: 1.35,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    color: 0xdbeee8,
  });
  particleMaterials.push(mistMat);
  const mistPoints = new THREE.Points(mistGeo, mistMat);
  mistPoints.renderOrder = 8;
  scene.add(mistPoints);

  // D. Fireflies / Bioluminescent Spores (Points)
  const fireflyCount = 40;
  const ffPositions = new Float32Array(fireflyCount * 3);
  const ffSeeds = Array.from({ length: fireflyCount }, (_, i) => {
    const x = (rng() - 0.5) * 4.0;
    const y = 1.1 + rng() * 1.8;
    const z = (rng() - 0.5) * 2.6;
    ffPositions[i * 3] = x;
    ffPositions[i * 3 + 1] = y;
    ffPositions[i * 3 + 2] = z;
    return { bx: x, by: y, bz: z, phase: rng() * Math.PI * 2, speed: 0.6 + rng() * 0.8 };
  });
  const ffGeo = new THREE.BufferGeometry();
  ffGeo.setAttribute('position', new THREE.BufferAttribute(ffPositions, 3));
  geometries.push(ffGeo);
  const ffMat = new THREE.PointsMaterial({
    map: textures.mistSprite,
    size: 0.14,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    color: 0xc9ff99,
  });
  particleMaterials.push(ffMat);
  const fireflyPoints = new THREE.Points(ffGeo, ffMat);
  fireflyPoints.renderOrder = 9;
  scene.add(fireflyPoints);

  // Smooth state variables
  let currentCondensation = 0.08;
  let currentMistAlpha = 0.0;
  let currentRainAlpha = 0.0;
  let lightningTimer = 3.5;
  let lightningFlash = 0;

  const sampleSkyStops = (hour: number) => {
    const h = ((hour % 24) + 24) % 24;
    let prev = SKY_STOPS[0];
    let next = SKY_STOPS[SKY_STOPS.length - 1];
    for (let i = 0; i < SKY_STOPS.length - 1; i++) {
      if (h >= SKY_STOPS[i].hour && h <= SKY_STOPS[i + 1].hour) {
        prev = SKY_STOPS[i];
        next = SKY_STOPS[i + 1];
        break;
      }
    }
    const span = Math.max(0.001, next.hour - prev.hour);
    const t = THREE.MathUtils.smoothstep((h - prev.hour) / span, 0, 1);

    _skyColor.setHex(prev.sky).lerp(_keyColor.setHex(next.sky), t);
    _hemiSky.setHex(prev.hemiSky).lerp(_keyColor.setHex(next.hemiSky), t);
    _hemiGround.setHex(prev.hemiGround).lerp(_keyColor.setHex(next.hemiGround), t);
    _keyColor.setHex(prev.key).lerp(_rimColor.setHex(next.key), t);

    const keyInt = THREE.MathUtils.lerp(prev.keyInt, next.keyInt, t);
    const hemiInt = THREE.MathUtils.lerp(prev.hemiInt, next.hemiInt, t);
    return { keyInt, hemiInt };
  };

  const update = (
    dt: number,
    elapsed: number,
    timeOfDay: number,
    weather: WeatherMode,
    windStrength: number,
    ventOpen: boolean,
    doorOpen: boolean,
  ): EnvironmentTelemetry => {
    const { keyInt, hemiInt } = sampleSkyStops(timeOfDay);

    // Solar / Lunar orbital angle (6:00 sunrise -> 12:00 zenith -> 18:00 sunset)
    const dayAngle = ((timeOfDay - 6) / 24) * Math.PI * 2;
    const isDay = timeOfDay >= 5.8 && timeOfDay <= 18.6;
    const sunY = Math.sin(dayAngle);
    const sunElevationDeg = Math.round(sunY * 90);

    // Position keyLight along solar arc (when night, place high moon arc)
    const arcAngle = isDay ? dayAngle : dayAngle + Math.PI;
    const elevation = Math.max(0.28, Math.sin(arcAngle) * 0.85 + 0.25);
    keyLight.position.set(
      Math.cos(arcAngle) * 7.5,
      elevation * 9.0,
      4.2 + Math.sin(arcAngle * 0.5) * 1.5,
    );

    // Weather atmospheric darkening & fog density
    const weatherDim =
      weather === 'clear' ? 1.0 : weather === 'mist' ? 0.78 : weather === 'rain' ? 0.62 : 0.45;
    const targetFogColor =
      weather === 'storm' ? 0x161d22 : weather === 'rain' ? 0x1f2829 : 0x2a3834;

    if (weather !== 'clear') {
      _weatherFogTint.setHex(targetFogColor);
      _skyColor.lerp(_weatherFogTint, weather === 'storm' ? 0.65 : 0.45);
    }

    // Lightning pulse during storm
    if (weather === 'storm') {
      lightningTimer -= dt;
      if (lightningTimer <= 0) {
        lightningFlash = 1.0;
        lightningTimer = 3.5 + Math.random() * 6.5;
      }
    }
    lightningFlash = Math.max(0, lightningFlash - dt * 4.5);

    if (lightningFlash > 0.01) {
      _skyColor.lerp(_weatherFogTint.setHex(0xb8d4ee), lightningFlash * 0.45);
    }

    (scene.background as THREE.Color).copy(_skyColor);
    fog.color.copy(_skyColor);
    fog.density =
      weather === 'clear'
        ? 0.026
        : weather === 'mist'
          ? 0.044
          : weather === 'rain'
            ? 0.052
            : 0.062;

    keyLight.color.copy(_keyColor);
    keyLight.intensity = keyInt * weatherDim + lightningFlash * 3.8;
    hemiLight.color.copy(_hemiSky);
    hemiLight.groundColor.copy(_hemiGround);
    hemiLight.intensity = hemiInt * (0.75 + weatherDim * 0.25) + lightningFlash * 1.1;
    rimLight.intensity = (isDay ? 0.65 : 0.85) * weatherDim + lightningFlash * 1.4;

    // Nocturnal grow-lamp & bioluminescent mushrooms / fireflies
    const nightFactor =
      timeOfDay < 6.0
        ? 1 - THREE.MathUtils.smoothstep(timeOfDay, 4.5, 6.5)
        : THREE.MathUtils.smoothstep(timeOfDay, 17.2, 19.6);

    const lampIntensity = nightFactor * 2.4;
    interiorLamp.intensity = THREE.MathUtils.damp(interiorLamp.intensity, lampIntensity, 4, dt);
    vessel.growLampMat.emissiveIntensity = interiorLamp.intensity * 0.95;

    materials.mushroomCap.emissiveIntensity = 0.08 + nightFactor * 0.85;
    materials.mushroomGlow.emissiveIntensity = 0.2 + nightFactor * 1.9;
    materials.orchidLip.emissiveIntensity = 0.1 + nightFactor * 0.35;

    // Smooth roof vent hinges
    const targetVentAngle = ventOpen ? 0.38 : 0.0;
    vessel.leftVentPivot.rotation.x = THREE.MathUtils.damp(
      vessel.leftVentPivot.rotation.x,
      -targetVentAngle,
      5,
      dt,
    );
    vessel.rightVentPivot.rotation.x = THREE.MathUtils.damp(
      vessel.rightVentPivot.rotation.x,
      targetVentAngle,
      5,
      dt,
    );

    // Smooth front entrance door swing (outward toward +Z)
    const targetDoorAngle = doorOpen ? -1.32 : 0.0;
    vessel.frontDoorPivot.rotation.y = THREE.MathUtils.damp(
      vessel.frontDoorPivot.rotation.y,
      targetDoorAngle,
      5.5,
      dt,
    );

    // Glass condensation response (drops when vent or front door opens!)
    const ventFactor = (ventOpen ? 0.55 : 1.0) * (doorOpen ? 0.58 : 1.0);
    const targetCond =
      (weather === 'clear' ? 0.06 : weather === 'mist' ? 0.56 : weather === 'rain' ? 0.46 : 0.52) *
      ventFactor;
    currentCondensation = THREE.MathUtils.damp(currentCondensation, targetCond, 2.5, dt);
    materials.condensationOverlay.opacity = currentCondensation;

    // Wind uniforms for foliage & pond ripples
    const effectiveWind =
      windStrength * 0.75 +
      (doorOpen ? 0.14 : 0.0) +
      (weather === 'clear' ? 0.12 : weather === 'mist' ? 0.2 : weather === 'rain' ? 0.45 : 0.95);
    materials.windUniforms.uTime.value = elapsed;
    materials.windUniforms.uWind.value = THREE.MathUtils.damp(
      materials.windUniforms.uWind.value,
      effectiveWind,
      4,
      dt,
    );

    // Update Mist Sprites
    const targetMist =
      (weather === 'mist' ? 0.32 : weather === 'rain' ? 0.16 : weather === 'storm' ? 0.22 : 0.03) *
      (ventOpen ? 0.65 : 1.0) *
      (doorOpen ? 0.65 : 1.0);
    currentMistAlpha = THREE.MathUtils.damp(currentMistAlpha, targetMist, 2.5, dt);
    mistMat.opacity = currentMistAlpha;
    if (currentMistAlpha > 0.01) {
      const mArr = mistGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < mistCount; i++) {
        const s = mistSeeds[i];
        mArr[i * 3] = s.bx + Math.sin(elapsed * s.speed + s.phase) * 0.35;
        mArr[i * 3 + 1] = s.by + Math.cos(elapsed * s.speed * 0.7 + s.phase) * 0.12;
        mArr[i * 3 + 2] = s.bz + Math.cos(elapsed * s.speed * 0.8 + s.phase) * 0.28;
      }
      mistGeo.attributes.position.needsUpdate = true;
    }

    // Update Fireflies (stronger at dusk/night, gentle when not storming)
    const targetFF = nightFactor * (weather === 'storm' ? 0.25 : 0.85);
    ffMat.opacity = THREE.MathUtils.damp(ffMat.opacity, targetFF, 3.0, dt);
    if (ffMat.opacity > 0.02) {
      const fArr = ffGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < fireflyCount; i++) {
        const s = ffSeeds[i];
        fArr[i * 3] = s.bx + Math.sin(elapsed * s.speed + s.phase) * 0.45;
        fArr[i * 3 + 1] = s.by + Math.sin(elapsed * s.speed * 1.4 + s.phase * 2) * 0.25;
        fArr[i * 3 + 2] = s.bz + Math.cos(elapsed * s.speed * 0.9 + s.phase) * 0.38;
      }
      ffGeo.attributes.position.needsUpdate = true;
    }

    // Update Exterior Rain & Interior Condensation Drips
    const isRaining = weather === 'rain' || weather === 'storm';
    currentRainAlpha = THREE.MathUtils.damp(
      currentRainAlpha,
      weather === 'storm' ? 0.55 : weather === 'rain' ? 0.4 : 0.0,
      4.0,
      dt,
    );
    rainMesh.visible = currentRainAlpha > 0.02;
    rainMat.opacity = currentRainAlpha;

    if (rainMesh.visible) {
      const tilt = (weather === 'storm' ? 0.22 : 0.09) + windStrength * 0.12;
      for (let i = 0; i < rainCount; i++) {
        const r = rainState[i];
        r.y -= r.speed * dt * (weather === 'storm' ? 1.35 : 1.0);
        r.x -= r.speed * tilt * dt;
        if (r.y < 0.0) {
          r.y = 8.5 + (i % 5) * 0.3;
          r.x = ((i * 73) % 140) / 10 - 7;
        }
        _dummy.position.set(r.x, r.y, r.z);
        _dummy.rotation.set(0, 0, -tilt);
        _dummy.scale.set(1, isRaining ? 1 : 0.5, 1);
        _dummy.updateMatrix();
        rainMesh.setMatrixAt(i, _dummy.matrix);
      }
      rainMesh.instanceMatrix.needsUpdate = true;
    }

    const showDrips = weather === 'mist' || weather === 'rain' || weather === 'storm';
    dripMesh.visible = showDrips;
    if (showDrips) {
      for (let i = 0; i < dripCount; i++) {
        const dr = dripState[i];
        dr.y -= dr.speed * dt;
        if (dr.y < 0.95) {
          dr.y = 3.1 + (1 - Math.abs(dr.z) / 1.8) * 0.9;
        }
        _dummy.position.set(dr.x, dr.y, dr.z);
        _dummy.rotation.set(0, 0, 0);
        _dummy.scale.setScalar(1);
        _dummy.updateMatrix();
        dripMesh.setMatrixAt(i, _dummy.matrix);
      }
      dripMesh.instanceMatrix.needsUpdate = true;
    }

    // Derive realistic terrarium microclimate telemetry
    const diurnalTemp = 19.5 + Math.max(-2, Math.sin(dayAngle - 0.5) * 5.2);
    const weatherTempOffset = weather === 'clear' ? 1.0 : weather === 'mist' ? -0.8 : -2.2;
    const temperatureC = Math.round((diurnalTemp + weatherTempOffset) * 10) / 10;

    const baseHumidity =
      weather === 'clear' ? 68 : weather === 'mist' ? 91 : weather === 'rain' ? 88 : 93;
    const humidityPct = Math.round(
      THREE.MathUtils.clamp(
        baseHumidity - (ventOpen ? 8 : 0) - (doorOpen ? 10 : 0) - Math.max(0, sunY * 4),
        44,
        98,
      ),
    );

    return {
      temperatureC,
      humidityPct,
      sunElevationDeg,
    };
  };

  return {
    keyLight,
    hemiLight,
    rimLight,
    interiorLamp,
    update,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      particleMaterials.forEach((m) => m.dispose());
    },
  };
}
