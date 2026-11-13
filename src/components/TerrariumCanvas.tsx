import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type {
  CameraPreset,
  EnvironmentTelemetry,
  SpecimenInfo,
  TerrariumConfig,
} from '../types/terrarium';
import { createProceduralTextures } from '../three/textures';
import {
  createTerrariumMaterials,
  detectSoftwareWebGL,
} from '../three/materials';
import { createTerrariumVessel } from '../three/terrariumVessel';
import { createTerrain, type TerrainRig } from '../three/terrain';
import {
  BIOME_PALETTES,
  createFloraEcosystem,
  type FloraRig,
} from '../three/flora';
import { createAtmosphere } from '../three/atmosphere';
import type { TerrariumAudioEngine } from '../audio/ambientAudio';

interface CameraViewDef {
  pos: [number, number, number];
  target: [number, number, number];
}

const CAMERA_PRESETS: Record<CameraPreset, CameraViewDef> = {
  overview: { pos: [5.6, 3.8, 6.2], target: [0, 1.45, 0] },
  canopy: { pos: [-2.6, 2.75, 2.8], target: [-0.85, 1.85, -0.3] },
  pond: { pos: [2.8, 2.05, 2.7], target: [0.85, 0.95, 0.35] },
  flora: { pos: [0.8, 1.95, 3.1], target: [-0.25, 1.15, 0.1] },
};

// Pre-allocated scratch vectors for camera transitions & raycasting
const _camGoalPos = new THREE.Vector3();
const _camGoalTarget = new THREE.Vector3();
const _pointerNdc = new THREE.Vector2();

interface TerrariumCanvasProps {
  config: TerrariumConfig;
  audioEngine: TerrariumAudioEngine;
  onTimeAdvance: (newTime: number) => void;
  onTelemetryUpdate: (telemetry: EnvironmentTelemetry) => void;
  onSelectSpecimen: (specimen: SpecimenInfo | null) => void;
  onToggleDoor: () => void;
}

export function TerrariumCanvas({
  config,
  audioEngine,
  onTimeAdvance,
  onTelemetryUpdate,
  onSelectSpecimen,
  onToggleDoor,
}: TerrariumCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [contextLost, setContextLost] = useState(false);

  // Mutable refs so the WebGL loop reads latest React state without re-creating the renderer
  const configRef = useRef(config);
  configRef.current = config;

  const callbacksRef = useRef({
    onTimeAdvance,
    onTelemetryUpdate,
    onSelectSpecimen,
    onToggleDoor,
    audioEngine,
  });
  callbacksRef.current = {
    onTimeAdvance,
    onTelemetryUpdate,
    onSelectSpecimen,
    onToggleDoor,
    audioEngine,
  };

  // Ref for rebuilding flora/terrain when seed or biome changes
  const rebuildEcosystemRef = useRef<((seed: number, biome: TerrariumConfig['biome']) => void) | null>(null);
  const triggerCameraPresetRef = useRef<((preset: CameraPreset) => void) | null>(null);

  useEffect(() => {
    rebuildEcosystemRef.current?.(config.seed, config.biome);
  }, [config.seed, config.biome]);

  useEffect(() => {
    triggerCameraPresetRef.current?.(config.cameraPreset);
  }, [config.cameraPreset]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const canvas = renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.appendChild(canvas);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const onContextRestored = () => {
      setContextLost(false);
    };
    canvas.addEventListener('webglcontextlost', onContextLost);
    canvas.addEventListener('webglcontextrestored', onContextRestored);

    const scene = new THREE.Scene();

    // Studio PBR reflections via RoomEnvironment on every device
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 80);
    const initialPreset = CAMERA_PRESETS[configRef.current.cameraPreset];
    camera.position.set(...initialPreset.pos);

    const controls = new OrbitControls(camera, canvas);
    controls.target.set(...initialPreset.target);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.minDistance = 2.6;
    controls.maxDistance = 13.5;
    controls.minPolarAngle = 0.22;
    controls.maxPolarAngle = Math.PI * 0.485;
    controls.enablePan = true;
    controls.update();

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    const textures = createProceduralTextures(maxAnisotropy);
    const materials = createTerrariumMaterials(textures, isSoftwareGl);
    const vessel = createTerrariumVessel(materials);
    scene.add(vessel.group);

    const atmosphere = createAtmosphere(scene, textures, materials, vessel, isSoftwareGl);

    let terrainRig: TerrainRig | null = null;
    let floraRig: FloraRig | null = null;

    const buildEcosystem = (seed: number, biome: TerrariumConfig['biome']) => {
      if (terrainRig) {
        scene.remove(terrainRig.group);
        terrainRig.dispose();
      }
      if (floraRig) {
        scene.remove(floraRig.group);
        floraRig.dispose();
      }
      const palette = BIOME_PALETTES[biome];
      terrainRig = createTerrain(seed, materials, {
        mossBase: palette.mossBase,
        mossHighlight: palette.mossHighlight,
        waterColor: palette.waterColor,
      });
      scene.add(terrainRig.group);

      floraRig = createFloraEcosystem(seed, biome, materials);
      scene.add(floraRig.group);
    };

    buildEcosystem(configRef.current.seed, configRef.current.biome);
    rebuildEcosystemRef.current = buildEcosystem;

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Camera transition state (smooth exponential damping, cancelled on user drag)
    let isTransitioningCam = false;
    _camGoalPos.set(...initialPreset.pos);
    _camGoalTarget.set(...initialPreset.target);

    triggerCameraPresetRef.current = (preset: CameraPreset) => {
      const def = CAMERA_PRESETS[preset];
      _camGoalPos.set(...def.pos);
      _camGoalTarget.set(...def.target);
      isTransitioningCam = true;
    };

    const onControlStart = () => {
      isTransitioningCam = false;
    };
    controls.addEventListener('start', onControlStart);

    // Raycasting on Layer 1 for specimen inspection
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    let pointerDownPos = { x: 0, y: 0 };
    let lastHoverTime = 0;

    const updatePointerNdc = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      _pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      _pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const findSpecimenFromHit = (obj: THREE.Object3D | null): SpecimenInfo | null => {
      let cur: THREE.Object3D | null = obj;
      while (cur) {
        if (cur.userData?.specimen) {
          return cur.userData.specimen as SpecimenInfo;
        }
        cur = cur.parent;
      }
      return null;
    };

    const findActionFromHit = (obj: THREE.Object3D | null): string | null => {
      let cur: THREE.Object3D | null = obj;
      while (cur) {
        if (typeof cur.userData?.action === 'string') {
          return cur.userData.action;
        }
        cur = cur.parent;
      }
      return null;
    };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverTime < 65) return;
      lastHoverTime = now;
      if (!floraRig) return;

      updatePointerNdc(e);
      raycaster.setFromCamera(_pointerNdc, camera);
      const targets = [...floraRig.interactables, vessel.frontDoorInteractable];
      const hits = raycaster.intersectObjects(targets, true);
      canvas.style.cursor = hits.length > 0 ? 'pointer' : 'grab';
    };

    const onPointerUp = (e: PointerEvent) => {
      const moved = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (moved > 6 || !floraRig) return;

      updatePointerNdc(e);
      raycaster.setFromCamera(_pointerNdc, camera);
      const targets = [...floraRig.interactables, vessel.frontDoorInteractable];
      const hits = raycaster.intersectObjects(targets, true);
      if (hits.length > 0) {
        const hitObj = hits[0].object;
        if (findActionFromHit(hitObj) === 'toggle-door') {
          callbacksRef.current.onToggleDoor();
          callbacksRef.current.audioEngine.playInspectChime();
          return;
        }
        const spec = findSpecimenFromHit(hitObj);
        callbacksRef.current.onSelectSpecimen(spec);
        callbacksRef.current.audioEngine.playInspectChime();
      } else {
        callbacksRef.current.onSelectSpecimen(null);
      }
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);

    // Resize handling
    const handleResize = () => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Continuous simulation loop with software-WebGL afterDraw pacing
    let frameId = 0;
    let disposed = false;
    const clock = new THREE.Clock();
    let lastTelemetryPush = 0;
    let lastTimeSync = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const tick = () => {
      if (disposed) return;

      const dt = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();
      const curCfg = configRef.current;

      // Advance 24h cycle smoothly if autoCycle enabled (1 full day every ~72s)
      let activeHour = curCfg.timeOfDay;
      if (curCfg.autoCycle) {
        activeHour = (activeHour + dt * 0.35) % 24;
        curCfg.timeOfDay = activeHour;
        if (elapsed - lastTimeSync > 0.15) {
          lastTimeSync = elapsed;
          callbacksRef.current.onTimeAdvance(activeHour);
        }
      }

      // Smooth damped camera preset transitions
      if (isTransitioningCam) {
        camera.position.x = THREE.MathUtils.damp(camera.position.x, _camGoalPos.x, 5.5, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, _camGoalPos.y, 5.5, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, _camGoalPos.z, 5.5, dt);
        controls.target.x = THREE.MathUtils.damp(controls.target.x, _camGoalTarget.x, 5.5, dt);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, _camGoalTarget.y, 5.5, dt);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, _camGoalTarget.z, 5.5, dt);

        if (
          camera.position.distanceToSquared(_camGoalPos) < 0.0004 &&
          controls.target.distanceToSquared(_camGoalTarget) < 0.0004
        ) {
          isTransitioningCam = false;
        }
      }

      controls.update();

      const telemetry = atmosphere.update(
        dt,
        elapsed,
        activeHour,
        curCfg.weather,
        curCfg.windStrength,
        curCfg.ventOpen,
        curCfg.doorOpen,
      );

      callbacksRef.current.audioEngine.updateMix(curCfg.weather, curCfg.windStrength);

      if (elapsed - lastTelemetryPush > 0.45) {
        lastTelemetryPush = elapsed;
        callbacksRef.current.onTelemetryUpdate(telemetry);
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    if (isSoftwareGl) {
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      controls.removeEventListener('start', onControlStart);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);

      controls.dispose();
      terrainRig?.dispose();
      floraRig?.dispose();
      vessel.dispose();
      atmosphere.dispose();
      materials.dispose();
      Object.values(textures).forEach((t) => t.dispose());
      envRT.dispose();
      renderer.dispose();
      if (canvas.parentElement === container) {
        container.removeChild(canvas);
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full">
      <div ref={mountRef} className="w-full h-full" />
      {contextLost && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0d1210] text-stone-200">
          <div className="text-center space-y-2 max-w-sm px-6">
            <h2 className="font-display text-2xl">3D Viewport Suspended</h2>
            <p className="text-sm text-stone-400">
              WebGL rendering context was interrupted. Waiting for graphics driver recovery.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
