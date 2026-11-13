import type { WeatherMode } from '../types/terrarium';

/**
 * Pure Web Audio API procedural soundscape synthesizer (zero external audio files).
 * Generates filtered pink noise for rain/breeze and soft harmonic chimes on inspection.
 */
export class TerrariumAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private rainFilter: BiquadFilterNode | null = null;
  private rainGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;
  private enabled = false;

  private init(): void {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = 0.0;
    master.connect(ctx.destination);
    this.masterGain = master;

    // Create 3-second looping pink-ish noise buffer
    const bufferSize = ctx.sampleRate * 3;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
      b6 = white * 0.115926;
    }

    // Rain channel (bandpass high-mid patter)
    const rainSrc = ctx.createBufferSource();
    rainSrc.buffer = buffer;
    rainSrc.loop = true;
    const rainFilter = ctx.createBiquadFilter();
    rainFilter.type = 'bandpass';
    rainFilter.frequency.value = 1800;
    rainFilter.Q.value = 0.7;
    const rainGain = ctx.createGain();
    rainGain.gain.value = 0.0;
    rainSrc.connect(rainFilter);
    rainFilter.connect(rainGain);
    rainGain.connect(master);
    rainSrc.start();
    this.rainFilter = rainFilter;
    this.rainGain = rainGain;

    // Breeze channel (lowpass warm air)
    const windSrc = ctx.createBufferSource();
    windSrc.buffer = buffer;
    windSrc.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 380;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.12;
    windSrc.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(master);
    windSrc.start();
    this.windFilter = windFilter;
    this.windGain = windGain;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (enabled) {
      this.init();
      if (this.ctx?.state === 'suspended') {
        void this.ctx.resume();
      }
      if (this.masterGain && this.ctx) {
        this.masterGain.gain.setTargetAtTime(0.32, this.ctx.currentTime, 0.25);
      }
    } else if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(0.0, this.ctx.currentTime, 0.2);
    }
  }

  public updateMix(weather: WeatherMode, windStrength: number): void {
    if (!this.ctx || !this.enabled || !this.rainGain || !this.windGain || !this.rainFilter || !this.windFilter) {
      return;
    }
    const now = this.ctx.currentTime;
    const targetRain =
      weather === 'storm' ? 0.45 : weather === 'rain' ? 0.28 : weather === 'mist' ? 0.08 : 0.015;
    const targetRainFreq = weather === 'storm' ? 2300 : weather === 'rain' ? 1850 : 1200;

    this.rainGain.gain.setTargetAtTime(targetRain, now, 0.4);
    this.rainFilter.frequency.setTargetAtTime(targetRainFreq, now, 0.4);

    const targetWind = 0.05 + windStrength * 0.18 + (weather === 'storm' ? 0.14 : 0);
    const targetWindFreq = 260 + windStrength * 340;
    this.windGain.gain.setTargetAtTime(targetWind, now, 0.4);
    this.windFilter.frequency.setTargetAtTime(targetWindFreq, now, 0.4);
  }

  public playInspectChime(): void {
    if (!this.enabled || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.exponentialRampToValueAtTime(990, now + 0.14);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.34);
  }

  public dispose(): void {
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}
