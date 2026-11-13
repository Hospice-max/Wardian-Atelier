import { useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  CloudFog,
  CloudLightning,
  CloudRain,
  DoorClosed,
  DoorOpen,
  Play,
  Pause,
  RefreshCw,
  Sun,
  Volume2,
  VolumeX,
  Wind,
  X,
} from 'lucide-react';
import type {
  BiomeStyle,
  CameraPreset,
  EnvironmentTelemetry,
  SpecimenInfo,
  TerrariumConfig,
  WeatherMode,
} from '../types/terrarium';

interface ControlOverlayProps {
  config: TerrariumConfig;
  telemetry: EnvironmentTelemetry;
  selectedSpecimen: SpecimenInfo | null;
  onUpdateConfig: (patch: Partial<TerrariumConfig>) => void;
  onReseed: () => void;
  onDismissSpecimen: () => void;
}

function formatHour(hour: number): string {
  const h = Math.floor(((hour % 24) + 24) % 24);
  const m = Math.floor((hour - Math.floor(hour)) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function getPhaseLabel(hour: number): string {
  if (hour >= 5.5 && hour < 8.5) return 'Dawn';
  if (hour >= 8.5 && hour < 16.5) return 'Daylight';
  if (hour >= 16.5 && hour < 19.5) return 'Dusk';
  return 'Night';
}

export function ControlOverlay({
  config,
  telemetry,
  selectedSpecimen,
  onUpdateConfig,
  onReseed,
  onDismissSpecimen,
}: ControlOverlayProps) {
  const [dockCollapsed, setDockCollapsed] = useState(false);

  // Keyboard shortcut 'H' for Zen / Cinema inspection mode
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const weatherOptions: { id: WeatherMode; label: string; Icon: typeof Sun }[] = [
    { id: 'clear', label: 'Clear', Icon: Sun },
    { id: 'mist', label: 'Mist', Icon: CloudFog },
    { id: 'rain', label: 'Rain', Icon: CloudRain },
    { id: 'storm', label: 'Storm', Icon: CloudLightning },
  ];

  const timePresets: { label: string; hour: number }[] = [
    { label: 'Dawn', hour: 6.5 },
    { label: 'Noon', hour: 13.0 },
    { label: 'Dusk', hour: 17.8 },
    { label: 'Night', hour: 22.5 },
  ];

  const cameraOptions: { id: CameraPreset; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'canopy', label: 'Canopy' },
    { id: 'pond', label: 'Pond' },
    { id: 'flora', label: 'Flora' },
  ];

  const biomeOptions: { id: BiomeStyle; label: string }[] = [
    { id: 'temperate', label: 'Temperate' },
    { id: 'cloudforest', label: 'Cloud Forest' },
    { id: 'twilight', label: 'Twilight' },
  ];

  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between p-5">
      {/* Top Row: Minimal Title & Optional Specimen Inspection Card */}
      <div className="flex items-start justify-between gap-4">
        <header className="pointer-events-auto">
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-stone-100 leading-none">
            Wardian Atelier
          </h1>
          <p className="mt-1.5 flex items-center gap-2 text-xs text-stone-300/85">
            <span>Botanical Enclosure</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular">{telemetry.temperatureC.toFixed(1)}°C</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular">{telemetry.humidityPct}% RH</span>
            <span aria-hidden="true">·</span>
            <span>{getPhaseLabel(config.timeOfDay)}</span>
          </p>
        </header>

        {selectedSpecimen && (
          <aside
            aria-label="Specimen details"
            className="pointer-events-auto max-w-xs rounded-xl border border-stone-200/12 bg-[#0e1411]/92 p-4 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold text-stone-100 leading-snug">
                  {selectedSpecimen.commonName}
                </h2>
                <p className="text-xs italic text-[#d9c38c]">
                  {selectedSpecimen.botanicalName}
                </p>
              </div>
              <button
                type="button"
                onClick={onDismissSpecimen}
                aria-label="Close specimen card"
                className="rounded-md p-1 text-stone-400 hover:bg-white/10 hover:text-stone-100 focus-visible:outline-2 focus-visible:outline-[#d9c38c]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-xs text-stone-300 leading-relaxed">
              {selectedSpecimen.notes}
            </p>
            <p className="mt-2 text-[11px] text-stone-400">
              {selectedSpecimen.humidityPref}
            </p>
          </aside>
        )}
      </div>

      {/* Bottom Collapsible Control Dock (solid rgba surface, zero backdrop-filter over WebGL) */}
      <div className="flex flex-col items-center">
        <div
          className={`pointer-events-auto transition-transform duration-300 ease-out ${
            dockCollapsed ? 'translate-y-[calc(100%-30px)]' : 'translate-y-0'
          }`}
          style={{ maxWidth: 'min(920px, 95vw)', width: '100%' }}
        >
          {/* Collapse / Expand Drawer Tab */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setDockCollapsed((v) => !v)}
              title="Toggle Controls (H)"
              className="flex items-center gap-1.5 rounded-t-lg border border-b-0 border-stone-200/12 bg-[#0e1411]/92 px-3.5 py-1 text-[11px] font-medium text-stone-300 hover:text-stone-100 focus-visible:outline-2 focus-visible:outline-[#d9c38c] whitespace-nowrap shrink-0"
            >
              {dockCollapsed ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5" />
                  <span>Show Controls</span>
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5" />
                  <span>Hide Controls</span>
                </>
              )}
            </button>
          </div>

          {/* Main Dock Body */}
          <div className="rounded-xl border border-stone-200/12 bg-[#0e1411]/92 px-4 py-3 shadow-2xl">
            <div className="flex flex-col gap-2.5">
              {/* Row 1: Solar Time + Weather + Wind */}
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                {/* Day / Night 24h Scrubber */}
                <div className="flex items-center gap-2.5 flex-1 min-w-[260px]">
                  <button
                    type="button"
                    onClick={() => onUpdateConfig({ autoCycle: !config.autoCycle })}
                    aria-label={config.autoCycle ? 'Pause day cycle' : 'Play day cycle'}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/5 text-stone-200 hover:bg-white/12 focus-visible:outline-2 focus-visible:outline-[#d9c38c] shrink-0"
                  >
                    {config.autoCycle ? (
                      <Pause className="h-3.5 w-3.5" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                  </button>

                  <span className="font-mono-tabular text-xs font-medium text-[#d9c38c] w-11 shrink-0">
                    {formatHour(config.timeOfDay)}
                  </span>

                  <input
                    type="range"
                    aria-label="Time of day"
                    min={0}
                    max={23.95}
                    step={0.05}
                    value={config.timeOfDay}
                    onChange={(e) =>
                      onUpdateConfig({
                        timeOfDay: parseFloat(e.target.value),
                        autoCycle: false,
                      })
                    }
                    className="atelier-slider flex-1 min-w-[90px]"
                  />

                  <div className="hidden sm:flex items-center gap-1 rounded-md bg-white/5 p-0.5">
                    {timePresets.map((preset) => {
                      const active = Math.abs(config.timeOfDay - preset.hour) < 1.1;
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() =>
                            onUpdateConfig({ timeOfDay: preset.hour, autoCycle: false })
                          }
                          className={`rounded px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                            active
                              ? 'bg-[#d9c38c] text-[#141a17]'
                              : 'text-stone-300 hover:text-stone-100'
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Weather Segmented Controls */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 rounded-md bg-white/5 p-0.5">
                    {weatherOptions.map(({ id, label, Icon }) => {
                      const active = config.weather === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => onUpdateConfig({ weather: id })}
                          className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                            active
                              ? 'bg-[#4f8463] text-white'
                              : 'text-stone-300 hover:text-stone-100'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          <span>{label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Wind Breeze Control */}
                  <div className="hidden md:flex items-center gap-1.5 pl-1">
                    <Wind className="h-3.5 w-3.5 text-stone-400 shrink-0" />
                    <input
                      type="range"
                      aria-label="Wind strength"
                      min={0}
                      max={1}
                      step={0.02}
                      value={config.windStrength}
                      onChange={(e) =>
                        onUpdateConfig({ windStrength: parseFloat(e.target.value) })
                      }
                      className="atelier-slider w-16"
                    />
                  </div>
                </div>
              </div>

              {/* Hairline Divider */}
              <div className="h-px bg-white/10" />

              {/* Row 2: Camera Views + Biome + Roof Vent + Reseed + Audio */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                {/* Camera Presets */}
                <div className="flex items-center gap-1 rounded-md bg-white/5 p-0.5">
                  {cameraOptions.map((cam) => {
                    const active = config.cameraPreset === cam.id;
                    return (
                      <button
                        key={cam.id}
                        type="button"
                        onClick={() => onUpdateConfig({ cameraPreset: cam.id })}
                        className={`rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                          active
                            ? 'bg-stone-100 text-[#131816]'
                            : 'text-stone-300 hover:text-stone-100'
                        }`}
                      >
                        {cam.label}
                      </button>
                    );
                  })}
                </div>

                {/* Biome Palette */}
                <div className="flex items-center gap-1 rounded-md bg-white/5 p-0.5">
                  {biomeOptions.map((b) => {
                    const active = config.biome === b.id;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => onUpdateConfig({ biome: b.id })}
                        className={`rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                          active
                            ? 'bg-white/15 text-[#d9c38c]'
                            : 'text-stone-300 hover:text-stone-100'
                        }`}
                      >
                        {b.label}
                      </button>
                    );
                  })}
                </div>

                {/* Enclosure Actions */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onUpdateConfig({ doorOpen: !config.doorOpen })}
                    className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      config.doorOpen
                        ? 'border-[#d9c38c]/60 bg-[#d9c38c]/15 text-[#d9c38c]'
                        : 'border-white/10 bg-white/5 text-stone-300 hover:text-stone-100'
                    }`}
                  >
                    {config.doorOpen ? (
                      <DoorOpen className="h-3.5 w-3.5" />
                    ) : (
                      <DoorClosed className="h-3.5 w-3.5" />
                    )}
                    <span>{config.doorOpen ? 'Close Door' : 'Open Door'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onUpdateConfig({ ventOpen: !config.ventOpen })}
                    className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      config.ventOpen
                        ? 'border-[#d9c38c]/60 bg-[#d9c38c]/15 text-[#d9c38c]'
                        : 'border-white/10 bg-white/5 text-stone-300 hover:text-stone-100'
                    }`}
                  >
                    {config.ventOpen ? 'Close Vent' : 'Open Vent'}
                  </button>

                  <button
                    type="button"
                    onClick={onReseed}
                    className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-stone-200 hover:bg-white/12 focus-visible:outline-2 focus-visible:outline-[#d9c38c] whitespace-nowrap shrink-0"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Regrow</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onUpdateConfig({ audioEnabled: !config.audioEnabled })}
                    aria-label={config.audioEnabled ? 'Mute soundscape' : 'Enable soundscape'}
                    className={`flex h-7 w-7 items-center justify-center rounded-md border transition-colors shrink-0 ${
                      config.audioEnabled
                        ? 'border-[#4f8463] bg-[#4f8463]/25 text-stone-100'
                        : 'border-white/10 bg-white/5 text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    {config.audioEnabled ? (
                      <Volume2 className="h-3.5 w-3.5" />
                    ) : (
                      <VolumeX className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
