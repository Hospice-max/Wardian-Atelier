export type WeatherMode = 'clear' | 'mist' | 'rain' | 'storm';

export type CameraPreset = 'overview' | 'canopy' | 'pond' | 'flora';

export type BiomeStyle = 'temperate' | 'cloudforest' | 'twilight';

export interface SpecimenInfo {
  id: string;
  commonName: string;
  botanicalName: string;
  notes: string;
  humidityPref: string;
}

export interface TerrariumConfig {
  timeOfDay: number; // 0 to 24 hours
  autoCycle: boolean;
  weather: WeatherMode;
  windStrength: number; // 0 to 1
  ventOpen: boolean;
  doorOpen: boolean;
  biome: BiomeStyle;
  seed: number;
  cameraPreset: CameraPreset;
  audioEnabled: boolean;
}

export interface EnvironmentTelemetry {
  temperatureC: number;
  humidityPct: number;
  sunElevationDeg: number;
}
