import * as THREE from 'three';
import type { ProceduralTextures } from './textures';

export interface WindUniforms {
  uTime: { value: number };
  uWind: { value: number };
}

export interface TerrariumMaterialLibrary {
  windUniforms: WindUniforms;
  bronzeFrame: THREE.MeshStandardMaterial;
  brushedBrass: THREE.MeshPhysicalMaterial;
  walnutPlinth: THREE.MeshStandardMaterial;
  plaqueFace: THREE.MeshStandardMaterial;
  glassPane: THREE.MeshPhysicalMaterial;
  condensationOverlay: THREE.MeshStandardMaterial;
  studioTable: THREE.MeshStandardMaterial;
  contactShadow: THREE.MeshBasicMaterial;
  mossTerrain: THREE.MeshStandardMaterial;
  strataSide: THREE.MeshStandardMaterial;
  waterSurface: THREE.MeshPhysicalMaterial;
  bark: THREE.MeshStandardMaterial;
  stone: THREE.MeshStandardMaterial;
  canopyLeaf: THREE.MeshStandardMaterial;
  fernFrond: THREE.MeshStandardMaterial;
  mossTuft: THREE.MeshStandardMaterial;
  orchidLeaf: THREE.MeshStandardMaterial;
  orchidPetal: THREE.MeshStandardMaterial;
  orchidLip: THREE.MeshStandardMaterial;
  mushroomStem: THREE.MeshStandardMaterial;
  mushroomCap: THREE.MeshStandardMaterial;
  mushroomGlow: THREE.MeshStandardMaterial;
  pebble: THREE.MeshStandardMaterial;
  dispose: () => void;
}

export function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function attachWindSway(
  material: THREE.MeshStandardMaterial,
  uniforms: WindUniforms,
  amplitude = 0.045,
  heightPivot = 0.9,
): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uWind = uniforms.uWind;

    shader.vertexShader =
      `
      uniform float uTime;
      uniform float uWind;
      ` + shader.vertexShader;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      #include <begin_vertex>
      #ifdef USE_INSTANCING
        vec4 wPos = instanceMatrix * vec4(transformed, 1.0);
        float swayFactor = max(0.0, transformed.y) * 1.35;
        float phase = wPos.x * 2.1 + wPos.z * 1.7;
      #else
        float swayFactor = max(0.0, (position.y - ${heightPivot.toFixed(2)})) * 0.48;
        float phase = position.x * 2.3 + position.z * 1.9;
      #endif
      float gust = sin(uTime * 1.85 + phase) + 0.45 * sin(uTime * 3.7 + phase * 1.7);
      transformed.x += gust * uWind * ${amplitude.toFixed(4)} * swayFactor;
      transformed.z += cos(uTime * 1.45 + phase * 0.9) * uWind * ${(amplitude * 0.7).toFixed(4)} * swayFactor;
      `,
    );
  };
  material.customProgramCacheKey = () => `wind_sway_${amplitude}_${heightPivot}`;
}

function attachWaterRipple(
  material: THREE.MeshPhysicalMaterial,
  uniforms: WindUniforms,
): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uWind = uniforms.uWind;

    shader.vertexShader =
      `
      uniform float uTime;
      uniform float uWind;
      ` + shader.vertexShader;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      #include <begin_vertex>
      float rWave = sin(position.x * 9.0 + uTime * 2.4) * cos(position.z * 8.5 - uTime * 1.9);
      float amp = 0.004 + uWind * 0.006;
      transformed.y += rWave * amp;
      `,
    );
  };
  material.customProgramCacheKey = () => 'water_ripple_v1';
}

export function createTerrariumMaterials(
  textures: ProceduralTextures,
  isSoftwareGl: boolean,
): TerrariumMaterialLibrary {
  const windUniforms: WindUniforms = {
    uTime: { value: 0 },
    uWind: { value: 0.25 },
  };

  // Patinated blackened bronze mullions
  const bronzeFrame = new THREE.MeshStandardMaterial({
    color: 0x202421,
    roughness: 0.42,
    metalness: 0.82,
  });

  // Anisotropic brushed brass brackets & finial accents
  const brushedBrass = new THREE.MeshPhysicalMaterial({
    color: 0xc9a863,
    roughness: 0.24,
    metalness: 0.92,
    anisotropy: 0.75,
    anisotropyRotation: Math.PI / 4,
  });

  // Dark walnut pedestal plinth
  const walnutPlinth = new THREE.MeshStandardMaterial({
    map: textures.woodPlinthColor,
    color: 0xffffff,
    roughness: 0.62,
    metalness: 0.04,
  });

  const plaqueFace = new THREE.MeshStandardMaterial({
    map: textures.plaqueTexture,
    roughness: 0.28,
    metalness: 0.85,
  });

  // Optical glass panes (skip heavy transmission pass on software WebGL)
  const glassPane = new THREE.MeshPhysicalMaterial({
    color: 0xeef8f4,
    metalness: 0.0,
    roughness: isSoftwareGl ? 0.12 : 0.05,
    transmission: isSoftwareGl ? 0 : 0.92,
    transparent: true,
    opacity: isSoftwareGl ? 0.22 : 1.0,
    ior: 1.52,
    thickness: 0.08,
    attenuationColor: new THREE.Color(0xdcf0e6),
    attenuationDistance: 4.5,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    envMapIntensity: 1.35,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  // Inner condensation droplet veil (opacity dynamically scales with humidity/mist/rain)
  const condensationOverlay = new THREE.MeshStandardMaterial({
    color: 0xeaf4f0,
    roughness: 0.38,
    metalness: 0.02,
    alphaMap: textures.condensationMap,
    bumpMap: textures.condensationMap,
    bumpScale: 0.015,
    transparent: true,
    opacity: 0.08,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const studioTable = new THREE.MeshStandardMaterial({
    color: 0x161b19,
    roughness: 0.86,
    metalness: 0.04,
  });

  const contactShadow = new THREE.MeshBasicMaterial({
    map: textures.contactShadow,
    transparent: true,
    opacity: 0.58,
    depthWrite: false,
  });

  const mossTerrain = new THREE.MeshStandardMaterial({
    map: textures.mossColor,
    bumpMap: textures.mossBump,
    bumpScale: 0.045,
    roughness: 0.92,
    metalness: 0.0,
    vertexColors: true,
  });

  const strataSide = new THREE.MeshStandardMaterial({
    map: textures.strataColor,
    bumpMap: textures.strataBump,
    bumpScale: 0.035,
    roughness: 0.88,
    metalness: 0.02,
  });

  const waterSurface = new THREE.MeshPhysicalMaterial({
    color: 0x3b6e6c,
    roughness: 0.08,
    metalness: 0.05,
    transmission: isSoftwareGl ? 0 : 0.65,
    transparent: true,
    opacity: isSoftwareGl ? 0.72 : 0.92,
    ior: 1.333,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.4,
  });
  attachWaterRipple(waterSurface, windUniforms);

  const bark = new THREE.MeshStandardMaterial({
    map: textures.barkColor,
    bumpMap: textures.barkBump,
    bumpScale: 0.04,
    roughness: 0.9,
    metalness: 0.0,
  });

  const stone = new THREE.MeshStandardMaterial({
    map: textures.stoneColor,
    bumpMap: textures.stoneBump,
    bumpScale: 0.035,
    roughness: 0.84,
    metalness: 0.03,
  });

  const canopyLeaf = new THREE.MeshStandardMaterial({
    color: 0x4b7f40,
    roughness: 0.56,
    metalness: 0.02,
    vertexColors: true,
  });
  attachWindSway(canopyLeaf, windUniforms, 0.03, 1.5);

  const fernFrond = new THREE.MeshStandardMaterial({
    color: 0x528f44,
    roughness: 0.48,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
  attachWindSway(fernFrond, windUniforms, 0.065, 0.0);

  const mossTuft = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.78,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });
  attachWindSway(mossTuft, windUniforms, 0.045, 0.0);

  const orchidLeaf = new THREE.MeshStandardMaterial({
    color: 0x2f5f35,
    roughness: 0.34,
    metalness: 0.03,
    side: THREE.DoubleSide,
  });

  const orchidPetal = new THREE.MeshStandardMaterial({
    color: 0xf4e8ef,
    roughness: 0.42,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });

  const orchidLip = new THREE.MeshStandardMaterial({
    color: 0xc24d7a,
    roughness: 0.46,
    metalness: 0.0,
    emissive: 0x260814,
    emissiveIntensity: 0.25,
    side: THREE.DoubleSide,
  });

  const mushroomStem = new THREE.MeshStandardMaterial({
    color: 0xded9cb,
    roughness: 0.65,
    metalness: 0.0,
  });

  const mushroomCap = new THREE.MeshStandardMaterial({
    color: 0x4ca38c,
    roughness: 0.45,
    metalness: 0.04,
    emissive: 0x24b48a,
    emissiveIntensity: 0.15,
    side: THREE.DoubleSide,
  });

  const mushroomGlow = new THREE.MeshStandardMaterial({
    color: 0x8dfbe0,
    emissive: 0x52f2c8,
    emissiveIntensity: 0.4,
    roughness: 0.3,
  });

  const pebble = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.72,
    metalness: 0.04,
  });

  const allMaterials: THREE.Material[] = [
    bronzeFrame,
    brushedBrass,
    walnutPlinth,
    plaqueFace,
    glassPane,
    condensationOverlay,
    studioTable,
    contactShadow,
    mossTerrain,
    strataSide,
    waterSurface,
    bark,
    stone,
    canopyLeaf,
    fernFrond,
    mossTuft,
    orchidLeaf,
    orchidPetal,
    orchidLip,
    mushroomStem,
    mushroomCap,
    mushroomGlow,
    pebble,
  ];

  return {
    windUniforms,
    bronzeFrame,
    brushedBrass,
    walnutPlinth,
    plaqueFace,
    glassPane,
    condensationOverlay,
    studioTable,
    contactShadow,
    mossTerrain,
    strataSide,
    waterSurface,
    bark,
    stone,
    canopyLeaf,
    fernFrond,
    mossTuft,
    orchidLeaf,
    orchidPetal,
    orchidLip,
    mushroomStem,
    mushroomCap,
    mushroomGlow,
    pebble,
    dispose: () => {
      allMaterials.forEach((m) => m.dispose());
    },
  };
}
