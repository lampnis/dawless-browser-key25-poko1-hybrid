/**
 * Open-KO: DefaultKits
 * Synthesizes vintage PO-33 / EP-133 style analog & lo-fi samples into AudioBuffers
 * so the sampler is fully playable immediately upon launch.
 */

import { SampleLibrary } from './SampleLibrary.js';

export class DefaultKits {
  /**
   * Load factory presets across all 16 slots
   */
  static async loadFactoryPresets(audioEngine) {
    const ctx = audioEngine.ctx;
    const melodicList = SampleLibrary.getMelodicPresets();
    const drumList = SampleLibrary.getDrumPresets();

    // Slots 0-7: Distinct Melodic Instruments
    for (let i = 0; i < 8; i++) {
      const preset = melodicList[i % melodicList.length];
      audioEngine.slots[i].loadBuffer(preset.generate(ctx));
      audioEngine.slots[i].name = preset.name;
    }

    // Slots 8-15: Distinct Drum Kits
    for (let d = 8; d < 16; d++) {
      const kitIndex = (d - 8) % drumList.length;
      const kitPreset = drumList[kitIndex];
      const buffer = kitPreset.generate(ctx);
      audioEngine.slots[d].loadBuffer(buffer);
      audioEngine.slots[d].name = kitPreset.name;
      audioEngine.slots[d].autoSlice();
    }
  }

  /**
   * Generates a 16-hit composite drum buffer containing Kick, Snare, Claps, HiHats, Percs
   */
  static generate16SliceDrumKit(ctx) {
    const sampleRate = ctx.sampleRate;
    const sliceLenSec = 0.35; // 350ms per hit
    const totalDuration = sliceLenSec * 16;
    const totalSamples = Math.floor(sampleRate * totalDuration);

    const buffer = ctx.createBuffer(2, totalSamples, sampleRate);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);

    const hits = [
      (t) => this._synthKick(t, sliceLenSec),      // Slice 0: Boom Kick
      (t) => this._synthKickPunch(t, sliceLenSec), // Slice 1: Punch Kick
      (t) => this._synthSnare(t, sliceLenSec),     // Slice 2: Vintage Snare
      (t) => this._synthClap(t, sliceLenSec),      // Slice 3: Hand Clap
      (t) => this._synthHatClosed(t, sliceLenSec), // Slice 4: Closed Hat
      (t) => this._synthHatOpen(t, sliceLenSec),   // Slice 5: Open Hat
      (t) => this._synthTomLow(t, sliceLenSec),    // Slice 6: Low Tom
      (t) => this._synthTomHigh(t, sliceLenSec),   // Slice 7: High Tom
      (t) => this._synthRimshot(t, sliceLenSec),   // Slice 8: Rimshot
      (t) => this._synthShaker(t, sliceLenSec),    // Slice 9: Shaker
      (t) => this._synthCowbell(t, sliceLenSec),   // Slice 10: 808 Cowbell
      (t) => this._synthLaserPerc(t, sliceLenSec), // Slice 11: Disco Laser
      (t) => this._synthSubDrop(t, sliceLenSec),   // Slice 12: Sub Drop
      (t) => this._synthNoiseHit(t, sliceLenSec),  // Slice 13: Lo-Fi Noise
      (t) => this._synthVinylClick(t, sliceLenSec),// Slice 14: Vinyl Click
      (t) => this._synthCymbalCrash(t, sliceLenSec)// Slice 15: Crash Cymbal
    ];

    for (let s = 0; s < 16; s++) {
      const sliceStart = Math.floor(s * sliceLenSec * sampleRate);
      const hitFn = hits[s];
      const sliceSamples = Math.floor(sliceLenSec * sampleRate);

      for (let i = 0; i < sliceSamples; i++) {
        const timeSec = i / sampleRate;
        const val = hitFn(timeSec);
        const dest = sliceStart + i;
        if (dest < totalSamples) {
          left[dest] = val;
          right[dest] = val;
        }
      }
    }

    return buffer;
  }

  // --- Drum Sound Synthesizers ---

  static _synthKick(t, maxT) {
    if (t > maxT) return 0;
    const freq = 130 * Math.exp(-t * 26) + 42;
    const amp = Math.exp(-t * 9.5);
    const click = t < 0.005 ? (Math.random() * 2 - 1) * 0.4 : 0;
    return (Math.sin(2 * Math.PI * freq * t) + click) * amp * 0.9;
  }

  static _synthKickPunch(t, maxT) {
    if (t > maxT) return 0;
    const freq = 180 * Math.exp(-t * 32) + 52;
    const amp = Math.exp(-t * 12.0);
    return Math.sin(2 * Math.PI * freq * t) * amp * 0.9;
  }

  static _synthSnare(t, maxT) {
    if (t > maxT) return 0;
    const bodyFreq = 185 * Math.exp(-t * 16);
    const body = Math.sin(2 * Math.PI * bodyFreq * t) * Math.exp(-t * 14) * 0.6;
    const noise = (Math.random() * 2 - 1) * Math.exp(-t * 11) * 0.7;
    return (body + noise) * 0.85;
  }

  static _synthClap(t, maxT) {
    if (t > maxT) return 0;
    // 3 small burst claps followed by tail
    let burst = 0;
    if (t < 0.01) burst = 1;
    else if (t > 0.015 && t < 0.025) burst = 0.9;
    else if (t > 0.03 && t < 0.04) burst = 0.8;
    else if (t >= 0.04) burst = Math.exp(-(t - 0.04) * 14);
    const noise = (Math.random() * 2 - 1);
    return noise * burst * 0.75;
  }

  static _synthHatClosed(t, maxT) {
    if (t > maxT) return 0;
    const noise = (Math.random() * 2 - 1);
    const env = Math.exp(-t * 60);
    return noise * env * 0.65;
  }

  static _synthHatOpen(t, maxT) {
    if (t > maxT) return 0;
    const noise = (Math.random() * 2 - 1);
    const env = Math.exp(-t * 12);
    return noise * env * 0.6;
  }

  static _synthTomLow(t, maxT) {
    if (t > maxT) return 0;
    const freq = 120 * Math.exp(-t * 14) + 65;
    const amp = Math.exp(-t * 8);
    return Math.sin(2 * Math.PI * freq * t) * amp * 0.8;
  }

  static _synthTomHigh(t, maxT) {
    if (t > maxT) return 0;
    const freq = 220 * Math.exp(-t * 16) + 110;
    const amp = Math.exp(-t * 9);
    return Math.sin(2 * Math.PI * freq * t) * amp * 0.8;
  }

  static _synthRimshot(t, maxT) {
    if (t > maxT) return 0;
    const f1 = 820 * Math.exp(-t * 40);
    const env = Math.exp(-t * 45);
    return (Math.sin(2 * Math.PI * f1 * t) + (Math.random() * 0.5)) * env * 0.7;
  }

  static _synthShaker(t, maxT) {
    if (t > maxT) return 0;
    const noise = (Math.random() * 2 - 1);
    const env = Math.sin(Math.min(Math.PI, (t / 0.12) * Math.PI)) * Math.exp(-t * 8);
    return noise * env * 0.5;
  }

  static _synthCowbell(t, maxT) {
    if (t > maxT) return 0;
    const env = Math.exp(-t * 16);
    // 808 cowbell dual square waves: 540Hz and 800Hz
    const s1 = Math.sin(2 * Math.PI * 540 * t) > 0 ? 0.5 : -0.5;
    const s2 = Math.sin(2 * Math.PI * 800 * t) > 0 ? 0.5 : -0.5;
    return (s1 + s2) * env * 0.6;
  }

  static _synthLaserPerc(t, maxT) {
    if (t > maxT) return 0;
    const freq = 1200 * Math.exp(-t * 35) + 80;
    const env = Math.exp(-t * 15);
    return Math.sin(2 * Math.PI * freq * t) * env * 0.75;
  }

  static _synthSubDrop(t, maxT) {
    if (t > maxT) return 0;
    const freq = 90 * Math.exp(-t * 4) + 30;
    const env = Math.exp(-t * 5);
    return Math.sin(2 * Math.PI * freq * t) * env * 0.9;
  }

  static _synthNoiseHit(t, maxT) {
    if (t > maxT) return 0;
    const noise = (Math.random() * 2 - 1);
    const env = Math.exp(-t * 18);
    return noise * env * 0.6;
  }

  static _synthVinylClick(t, maxT) {
    if (t > 0.05) return 0;
    return (Math.random() * 2 - 1) * Math.exp(-t * 120) * 0.8;
  }

  static _synthCymbalCrash(t, maxT) {
    if (t > maxT) return 0;
    const noise = (Math.random() * 2 - 1);
    const env = Math.exp(-t * 6);
    return noise * env * 0.55;
  }

  // --- Melodic Synthesizers ---

  static generateElectricPiano(ctx) {
    return this._renderMelodic(ctx, 1.8, 261.63, (t, f) => {
      // FM Bell Rhodes tone
      const mod = Math.sin(2 * Math.PI * (f * 3.5) * t) * Math.exp(-t * 5.0) * 3.0;
      const carrier = Math.sin(2 * Math.PI * f * t + mod);
      const tine = Math.sin(2 * Math.PI * (f * 7.0) * t) * Math.exp(-t * 14.0) * 0.3;
      const env = Math.exp(-t * 1.8);
      return (carrier + tine) * env * 0.7;
    });
  }

  static generateSubBass(ctx) {
    return this._renderMelodic(ctx, 1.5, 130.81, (t, f) => {
      const fund = Math.sin(2 * Math.PI * f * t);
      const sub = Math.sin(2 * Math.PI * (f * 0.5) * t) * 0.6;
      const saturation = Math.tanh((fund + sub) * 1.5);
      const env = Math.exp(-t * 2.2);
      return saturation * env * 0.8;
    });
  }

  static generateWarmPad(ctx) {
    return this._renderMelodic(ctx, 2.2, 261.63, (t, f) => {
      // Detuned dual saw
      const saw1 = (2 * ((f * t) % 1) - 1);
      const saw2 = (2 * (((f * 1.004) * t) % 1) - 1);
      const sub = Math.sin(2 * Math.PI * (f * 0.5) * t) * 0.4;
      const env = (1 - Math.exp(-t * 8)) * Math.exp(-t * 0.9);
      return (saw1 + saw2 + sub) * env * 0.35;
    });
  }

  static generatePluck(ctx) {
    return this._renderMelodic(ctx, 1.2, 523.25, (t, f) => {
      const p1 = Math.sin(2 * Math.PI * f * t);
      const p2 = Math.sin(2 * Math.PI * (f * 2.01) * t) * 0.5;
      const env = Math.exp(-t * 6.5);
      return (p1 + p2) * env * 0.75;
    });
  }

  static generateOrgan(ctx) {
    return this._renderMelodic(ctx, 1.8, 261.63, (t, f) => {
      // Hammond drawbars 16', 8', 4', 2'
      const h1 = Math.sin(2 * Math.PI * (f * 0.5) * t) * 0.5;
      const h2 = Math.sin(2 * Math.PI * f * t) * 0.6;
      const h3 = Math.sin(2 * Math.PI * (f * 2.0) * t) * 0.3;
      const env = Math.exp(-t * 1.2);
      return (h1 + h2 + h3) * env * 0.6;
    });
  }

  static generateLead(ctx) {
    return this._renderMelodic(ctx, 1.5, 329.63, (t, f) => {
      const sq = (Math.sin(2 * Math.PI * f * t) > 0 ? 0.6 : -0.6);
      const saw = (2 * ((f * t) % 1) - 1) * 0.4;
      const env = Math.exp(-t * 1.8);
      return (sq + saw) * env * 0.55;
    });
  }

  static generateVocalChop(ctx) {
    return this._renderMelodic(ctx, 1.4, 261.63, (t, f) => {
      // Formant synthesis approximation
      const f1 = 700; // 'Ah' vowel formant 1
      const f2 = 1220; // 'Ah' vowel formant 2
      const pulse = Math.sin(2 * Math.PI * f * t);
      const vocal = (Math.sin(2 * Math.PI * f1 * t) * 0.5 + Math.sin(2 * Math.PI * f2 * t) * 0.3) * pulse;
      const env = Math.exp(-t * 2.4);
      return vocal * env * 0.7;
    });
  }

  static generateChime(ctx) {
    return this._renderMelodic(ctx, 2.0, 523.25, (t, f) => {
      const b1 = Math.sin(2 * Math.PI * f * t);
      const b2 = Math.sin(2 * Math.PI * (f * 2.76) * t) * 0.4;
      const b3 = Math.sin(2 * Math.PI * (f * 5.4) * t) * 0.2;
      const env = Math.exp(-t * 2.8);
      return (b1 + b2 + b3) * env * 0.65;
    });
  }

  static _renderMelodic(ctx, durationSec, fundamental, renderFn) {
    const sampleRate = ctx.sampleRate;
    const numSamples = Math.floor(sampleRate * durationSec);
    const buffer = ctx.createBuffer(2, numSamples, sampleRate);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const sample = renderFn(t, fundamental);
      left[i] = sample;
      right[i] = sample;
    }
    return buffer;
  }
}
