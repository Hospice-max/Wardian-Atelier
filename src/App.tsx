/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { TerrariumCanvas } from './components/TerrariumCanvas';
import { ControlOverlay } from './components/ControlOverlay';
import { TerrariumAudioEngine } from './audio/ambientAudio';
import type {
  EnvironmentTelemetry,
  SpecimenInfo,
  TerrariumConfig,
} from './types/terrarium';

export default function App() {
  const [config, setConfig] = useState<TerrariumConfig>({
    timeOfDay: 14.2,
    autoCycle: false,
    weather: 'clear',
    windStrength: 0.35,
    ventOpen: false,
    doorOpen: false,
    biome: 'temperate',
    seed: 1042,
    cameraPreset: 'overview',
    audioEnabled: false,
  });

  const [telemetry, setTelemetry] = useState<EnvironmentTelemetry>({
    temperatureC: 22.4,
    humidityPct: 71,
    sunElevationDeg: 58,
  });

  const [selectedSpecimen, setSelectedSpecimen] = useState<SpecimenInfo | null>(null);

  const audioEngine = useMemo(() => new TerrariumAudioEngine(), []);

  useEffect(() => {
    audioEngine.setEnabled(config.audioEnabled);
  }, [audioEngine, config.audioEnabled]);

  useEffect(() => {
    return () => {
      audioEngine.dispose();
    };
  }, [audioEngine]);

  const handleUpdateConfig = useCallback((patch: Partial<TerrariumConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleTimeAdvance = useCallback((newTime: number) => {
    setConfig((prev) => ({ ...prev, timeOfDay: newTime }));
  }, []);

  const handleReseed = useCallback(() => {
    setSelectedSpecimen(null);
    setConfig((prev) => ({
      ...prev,
      seed: Math.floor(Math.random() * 90000) + 1000,
    }));
  }, []);

  const handleToggleDoor = useCallback(() => {
    setConfig((prev) => ({ ...prev, doorOpen: !prev.doorOpen }));
  }, []);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#0d1210]">
      <TerrariumCanvas
        config={config}
        audioEngine={audioEngine}
        onTimeAdvance={handleTimeAdvance}
        onTelemetryUpdate={setTelemetry}
        onSelectSpecimen={setSelectedSpecimen}
        onToggleDoor={handleToggleDoor}
      />

      <ControlOverlay
        config={config}
        telemetry={telemetry}
        selectedSpecimen={selectedSpecimen}
        onUpdateConfig={handleUpdateConfig}
        onReseed={handleReseed}
        onDismissSpecimen={() => setSelectedSpecimen(null)}
      />
    </main>
  );
}
