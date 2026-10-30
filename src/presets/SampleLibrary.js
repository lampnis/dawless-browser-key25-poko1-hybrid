/**
 * Open-KO: SampleLibrary
 * Comprehensive catalog of vintage lo-fi, analog & digital synthesized instruments and drum kits.
 * Enables seamless preset cycling (Shift + Up/Down) on any selected slot.
 */

export class SampleLibrary {
  /**
   * Render helper for melodic mono/stereo AudioBuffers
   */
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

  /**
   * Render helper for 16-slice composite drum kits
   */
  static _renderDrumKit(ctx, sliceLenSec, hitFns) {
    const sampleRate = ctx.sampleRate;
    const totalDuration = sliceLenSec * 16;
    const totalSamples = Math.floor(sampleRate * totalDuration);

    const buffer = ctx.createBuffer(2, totalSamples, sampleRate);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);

    for (let s = 0; s < 16; s++) {
      const sliceStart = Math.floor(s * sliceLenSec * sampleRate);
      const hitFn = hitFns[s];
      const sliceSamples = Math.floor(sliceLenSec * sampleRate);

      // Anti-bleed guard window: fade out the last 15ms of each slice so tails never bleed into neighboring slice!
      const fadeOutSamples = Math.max(16, Math.floor(sampleRate * 0.015));
      const fadeStart = sliceSamples - fadeOutSamples;

      for (let i = 0; i < sliceSamples; i++) {
        const timeSec = i / sampleRate;
        let val = hitFn(timeSec, sliceLenSec);

        // Micro fade-in on sample 0-16 to prevent DC offset attack pop
        if (i < 16) {
          val *= (i / 16);
        }
        // Smooth Hann fade-out over last 15ms to prevent clipping into neighboring slice
        if (i >= fadeStart) {
          const fadeProgress = (i - fadeStart) / fadeOutSamples;
          val *= 0.5 * (1 + Math.cos(Math.PI * fadeProgress));
        }
        if (i >= sliceSamples - 3) {
          val = 0;
        }

        const dest = sliceStart + i;
        if (dest < totalSamples) {
          left[dest] = val;
          right[dest] = val;
        }
      }
    }
    return buffer;
  }

  // ==========================================
  // MELODIC INSTRUMENT PRESETS
  // ==========================================

  static getMelodicPresets() {
    return [
      {
        id: 'concert_grand_piano',
        name: 'Concert Grand Piano',
        category: 'Keys',
        generate: (ctx) => this._renderMelodic(ctx, 5.5, 261.63, (t, f) => {
          // Acoustic Steinway Concert Grand Piano String Model:
          // Inharmonic string harmonics: f_h = h * f * sqrt(1 + B * h^2)
          const B = 0.00035;
          let strings = 0;
          // 3 detuned unison strings producing natural acoustic beating and blooming sustain
          const detunes = [1.0, 1.0007, 0.9993];
          for (const d of detunes) {
            for (let h = 1; h <= 8; h++) {
              const inharmFreq = f * d * h * Math.sqrt(1 + B * h * h);
              const harmDecay = 0.32 + h * 0.18;
              const amp = (1.0 / Math.pow(h, 1.25)) * Math.exp(-t * harmDecay);
              strings += Math.sin(2 * Math.PI * inharmFreq * t) * amp;
            }
          }
          strings *= 0.18;
          // Hammer impact felt thump & high string strike ping
          const hammerThump = Math.sin(2 * Math.PI * 110 * t) * Math.exp(-t * 60) * 0.3;
          const hammerStrike = (Math.random() * 2 - 1) * Math.exp(-t * 120) * 0.2;
          // Wooden soundboard cavity resonance
          const soundboard = Math.sin(2 * Math.PI * 138 * t) * Math.exp(-t * 1.5) * 0.12;
          // Long acoustic decay: keeps ringing for over 5 seconds while held!
          const masterEnv = (1 - Math.exp(-t * 80)) * Math.exp(-t * 0.38);
          return (strings + hammerThump + hammerStrike + soundboard) * masterEnv * 0.85;
        })
      },
      {
        id: 'warm_rhodes_stage73',
        name: 'Rhodes Stage 73 (Long)',
        category: 'Keys',
        generate: (ctx) => this._renderMelodic(ctx, 5.0, 261.63, (t, f) => {
          const tremolo = 1.0 + 0.08 * Math.sin(2 * Math.PI * 3.8 * t);
          const tineMod = Math.sin(2 * Math.PI * (f * 3.0) * t) * Math.exp(-t * 3.0) * 2.2;
          const carrier = Math.sin(2 * Math.PI * f * t + tineMod);
          const bell = Math.sin(2 * Math.PI * (f * 7.0) * t) * Math.exp(-t * 8.0) * 0.25;
          const warmSustain = Math.sin(2 * Math.PI * f * 1.002 * t) * Math.exp(-t * 0.45) * 0.3;
          const env = (1 - Math.exp(-t * 100)) * Math.exp(-t * 0.42);
          return (carrier + bell + warmSustain) * tremolo * env * 0.75;
        })
      },
      {
        id: 'symphonic_strings',
        name: 'Symphonic Strings (Sustain)',
        category: 'Pad',
        generate: (ctx) => this._renderMelodic(ctx, 5.0, 261.63, (t, f) => {
          const vib = 1.0 + 0.006 * Math.sin(2 * Math.PI * 5.2 * t);
          const s1 = Math.sin(2 * Math.PI * f * vib * t);
          const s2 = Math.sin(2 * Math.PI * (f * 1.004) * vib * t) * 0.8;
          const s3 = Math.sin(2 * Math.PI * (f * 0.996) * vib * t) * 0.8;
          const cello = Math.sin(2 * Math.PI * (f * 0.5) * t) * 0.5;
          const octave = Math.sin(2 * Math.PI * (f * 2.0) * vib * t) * 0.35;
          const bowScrape = (Math.random() * 2 - 1) * Math.exp(-t * 12) * 0.08;
          const env = (1 - Math.exp(-t * 3.0)) * Math.exp(-t * 0.12);
          return (s1 + s2 + s3 + cello + octave + bowScrape) * env * 0.35;
        })
      },
      {
        id: 'cathedral_pipe_organ',
        name: 'Cathedral Pipe Organ',
        category: 'Keys',
        generate: (ctx) => this._renderMelodic(ctx, 5.0, 261.63, (t, f) => {
          const sub16 = Math.sin(2 * Math.PI * (f * 0.5) * t) * 0.7;
          const fund8 = Math.sin(2 * Math.PI * f * t) * 1.0;
          const oct4 = Math.sin(2 * Math.PI * (f * 2.0) * t) * 0.6;
          const quint = Math.sin(2 * Math.PI * (f * 3.0) * t) * 0.35;
          const oct2 = Math.sin(2 * Math.PI * (f * 4.0) * t) * 0.25;
          const windNoise = (Math.random() * 2 - 1) * 0.03;
          const env = (1 - Math.exp(-t * 30)) * Math.exp(-t * 0.08);
          return Math.tanh((sub16 + fund8 + oct4 + quint + oct2 + windNoise) * 1.1) * env * 0.45;
        })
      },
      {
        id: 'choir_aah_sustain',
        name: 'Lush Choir Aah (Sustain)',
        category: 'Pad',
        generate: (ctx) => this._renderMelodic(ctx, 5.0, 261.63, (t, f) => {
          const vib = 1.0 + 0.005 * Math.sin(2 * Math.PI * 4.8 * t);
          let choir = 0;
          for (let h = 1; h <= 10; h++) {
            const harmFreq = f * h * vib;
            const formant1 = Math.exp(-Math.pow(harmFreq - 820, 2) / 60000);
            const formant2 = Math.exp(-Math.pow(harmFreq - 1250, 2) / 90000);
            const formant3 = Math.exp(-Math.pow(harmFreq - 2600, 2) / 160000);
            const weight = 0.15 + (formant1 * 0.9 + formant2 * 0.7 + formant3 * 0.4);
            choir += Math.sin(2 * Math.PI * harmFreq * t) * weight;
          }
          const breath = (Math.random() * 2 - 1) * 0.025;
          const env = (1 - Math.exp(-t * 2.5)) * Math.exp(-t * 0.15);
          return (choir * 0.3 + breath) * env * 0.7;
        })
      },
      {
        id: 'upright_jazz_bass',
        name: 'Upright Acoustic Bass (Long)',
        category: 'Bass',
        generate: (ctx) => this._renderMelodic(ctx, 4.2, 98.0, (t, f) => {
          const fund = Math.sin(2 * Math.PI * f * t);
          const harm2 = Math.sin(2 * Math.PI * (f * 2.001) * t) * 0.5 * Math.exp(-t * 0.8);
          const harm3 = Math.sin(2 * Math.PI * (f * 3.002) * t) * 0.25 * Math.exp(-t * 1.5);
          const bodyRes = Math.sin(2 * Math.PI * 85 * t) * Math.exp(-t * 1.2) * 0.35;
          const fingerSnap = (Math.random() * 2 - 1) * Math.exp(-t * 70) * 0.3;
          const env = (1 - Math.exp(-t * 70)) * Math.exp(-t * 0.55);
          return (fund + harm2 + harm3 + bodyRes + fingerSnap) * env * 0.85;
        })
      },
      {
        id: 'spanish_nylon_guitar',
        name: 'Spanish Nylon Guitar',
        category: 'Pluck',
        generate: (ctx) => this._renderMelodic(ctx, 4.0, 329.63, (t, f) => {
          const s1 = Math.sin(2 * Math.PI * f * t);
          const s2 = Math.sin(2 * Math.PI * (f * 2) * t) * 0.45 * Math.exp(-t * 1.2);
          const s3 = Math.sin(2 * Math.PI * (f * 3) * t) * 0.25 * Math.exp(-t * 2.0);
          const nailPluck = (Math.random() * 2 - 1) * Math.exp(-t * 90) * 0.25;
          const soundboard = Math.sin(2 * Math.PI * 180 * t) * Math.exp(-t * 1.8) * 0.2;
          const env = (1 - Math.exp(-t * 90)) * Math.exp(-t * 0.65);
          return (s1 + s2 + s3 + soundboard + nailPluck) * env * 0.8;
        })
      },
      {
        id: 'vintage_solina_strings',
        name: 'Solina String Ensemble',
        category: 'Pad',
        generate: (ctx) => this._renderMelodic(ctx, 5.0, 261.63, (t, f) => {
          const lfo1 = 1.0 + 0.008 * Math.sin(2 * Math.PI * 5.8 * t);
          const lfo2 = 1.0 + 0.006 * Math.sin(2 * Math.PI * 0.7 * t);
          let saw = 0;
          for (let h = 1; h <= 7; h++) {
            saw += Math.sin(2 * Math.PI * f * h * lfo1 * lfo2 * t) / h;
          }
          const sub = Math.sin(2 * Math.PI * (f * 0.5) * t) * 0.4;
          const env = (1 - Math.exp(-t * 3.5)) * Math.exp(-t * 0.15);
          return Math.tanh((saw * 0.5 + sub) * 1.3) * env * 0.5;
        })
      },
      {
        id: 'ethereal_shimmer_pad',
        name: 'Ethereal Shimmer Pad (Long)',
        category: 'Pad',
        generate: (ctx) => this._renderMelodic(ctx, 6.0, 261.63, (t, f) => {
          const fund = Math.sin(2 * Math.PI * f * t);
          const shimmer5th = Math.sin(2 * Math.PI * (f * 1.498) * t) * 0.4;
          const shimmerOct = Math.sin(2 * Math.PI * (f * 2.002) * t) * 0.35;
          const shimmerOct2 = Math.sin(2 * Math.PI * (f * 4.004) * t) * 0.2;
          const filterMod = 0.7 + 0.3 * Math.sin(2 * Math.PI * 0.35 * t);
          const env = (1 - Math.exp(-t * 2.0)) * Math.exp(-t * 0.12);
          return (fund + shimmer5th + shimmerOct + shimmerOct2) * filterMod * env * 0.45;
        })
      },
      {
        id: 'prophet_poly_brass',
        name: 'Prophet Analog Brass (Long)',
        category: 'Lead',
        generate: (ctx) => this._renderMelodic(ctx, 4.5, 261.63, (t, f) => {
          const filterCutoff = Math.exp(-t * 1.8) * 6 + 1.5;
          let brass = 0;
          for (let h = 1; h <= 9; h++) {
            const s1 = Math.sin(2 * Math.PI * f * 1.003 * h * t);
            const s2 = Math.sin(2 * Math.PI * f * 0.997 * h * t);
            const damp = Math.exp(-h / filterCutoff);
            brass += ((s1 + s2) / h) * damp;
          }
          const env = (1 - Math.exp(-t * 15)) * Math.exp(-t * 0.45);
          return Math.tanh(brass * 1.5) * env * 0.65;
        })
      },
      {
        id: 'rhodes_bell',
        name: 'Rhodes Bell',
        category: 'Keys',
        generate: (ctx) => this._renderMelodic(ctx, 1.8, 261.63, (t, f) => {
          const mod = Math.sin(2 * Math.PI * (f * 3.5) * t) * Math.exp(-t * 5.0) * 3.0;
          const carrier = Math.sin(2 * Math.PI * f * t + mod);
          const tine = Math.sin(2 * Math.PI * (f * 7.0) * t) * Math.exp(-t * 14.0) * 0.3;
          return (carrier + tine) * Math.exp(-t * 1.8) * 0.7;
        })
      },
      {
        id: 'wurlitzer_200a',
        name: 'Wurlitzer 200A',
        category: 'Keys',
        generate: (ctx) => this._renderMelodic(ctx, 1.6, 261.63, (t, f) => {
          const tremolo = 1.0 + 0.18 * Math.sin(2 * Math.PI * 6.5 * t);
          const reed = Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(2 * Math.PI * 3 * f * t);
          const grit = Math.tanh(reed * 1.4);
          return grit * tremolo * Math.exp(-t * 2.0) * 0.75;
        })
      },
      {
        id: 'dx7_crystal',
        name: 'DX7 Crystal EP',
        category: 'Keys',
        generate: (ctx) => this._renderMelodic(ctx, 2.0, 261.63, (t, f) => {
          const mod1 = Math.sin(2 * Math.PI * f * 2.0 * t) * Math.exp(-t * 3.0) * 4.0;
          const mod2 = Math.sin(2 * Math.PI * f * 7.0 * t) * Math.exp(-t * 8.0) * 2.5;
          const carrier = Math.sin(2 * Math.PI * f * t + mod1 + mod2);
          return carrier * Math.exp(-t * 1.5) * 0.65;
        })
      },
      {
        id: 'lofi_upright',
        name: 'Lo-Fi Upright',
        category: 'Keys',
        generate: (ctx) => this._renderMelodic(ctx, 1.5, 261.63, (t, f) => {
          const f1 = Math.sin(2 * Math.PI * f * t);
          const f2 = 0.5 * Math.sin(2 * Math.PI * f * 2.01 * t);
          const feltNoise = (Math.random() * 2 - 1) * Math.exp(-t * 40) * 0.15;
          return (f1 + f2 + feltNoise) * Math.exp(-t * 2.5) * 0.8;
        })
      },
      {
        id: 'sub_808',
        name: '808 Sub Bass',
        category: 'Bass',
        generate: (ctx) => this._renderMelodic(ctx, 1.5, 130.81, (t, f) => {
          const fund = Math.sin(2 * Math.PI * f * t);
          const sub = Math.sin(2 * Math.PI * (f * 0.5) * t) * 0.6;
          const saturation = Math.tanh((fund + sub) * 1.5);
          return saturation * Math.exp(-t * 2.2) * 0.85;
        })
      },
      {
        id: 'moog_saw_bass',
        name: 'Moog Saw Bass',
        category: 'Bass',
        generate: (ctx) => this._renderMelodic(ctx, 1.3, 110.0, (t, f) => {
          // Band-limited analog saw with filter envelope
          let saw = 0;
          const filterCutoff = Math.exp(-t * 6) * 12 + 2;
          for (let h = 1; h <= 12; h++) {
            const harmonic = Math.sin(2 * Math.PI * f * h * t) / h;
            const damp = Math.exp(-h / filterCutoff);
            saw += harmonic * damp;
          }
          return Math.tanh(saw * 1.8) * Math.exp(-t * 2.0) * 0.8;
        })
      },
      {
        id: 'acid_303',
        name: 'Acid 303 Squelch',
        category: 'Bass',
        generate: (ctx) => this._renderMelodic(ctx, 1.1, 110.0, (t, f) => {
          const env = Math.exp(-t * 8);
          const cutoff = 400 + 2600 * env;
          const sqr = Math.sin(2 * Math.PI * f * t) > 0 ? 0.6 : -0.6;
          const res = Math.sin(2 * Math.PI * cutoff * t) * env * 0.5;
          return Math.tanh((sqr + res) * 1.5) * Math.exp(-t * 3.0) * 0.75;
        })
      },
      {
        id: 'slap_funk_bass',
        name: 'Slap Funk Bass',
        category: 'Bass',
        generate: (ctx) => this._renderMelodic(ctx, 1.2, 98.0, (t, f) => {
          const pop = (Math.random() * 2 - 1) * Math.exp(-t * 70) * 0.4;
          const tone = Math.sin(2 * Math.PI * f * t) + 0.4 * Math.sin(2 * Math.PI * 2 * f * t) + 0.3 * Math.sin(2 * Math.PI * 3 * f * t);
          return (tone + pop) * Math.exp(-t * 4.0) * 0.85;
        })
      },
      {
        id: 'juno_pad',
        name: 'Juno Warm Pad',
        category: 'Pad',
        generate: (ctx) => this._renderMelodic(ctx, 2.2, 261.63, (t, f) => {
          const s1 = Math.sin(2 * Math.PI * f * t);
          const s2 = Math.sin(2 * Math.PI * (f * 1.004) * t);
          const s3 = Math.sin(2 * Math.PI * (f * 0.996) * t);
          const sub = Math.sin(2 * Math.PI * (f * 0.5) * t) * 0.4;
          const env = (1 - Math.exp(-t * 3.5)) * Math.exp(-t * 0.8);
          return (s1 + s2 + s3 + sub) * env * 0.4;
        })
      },
      {
        id: 'vinyl_strings',
        name: 'Vinyl Tape Strings',
        category: 'Pad',
        generate: (ctx) => this._renderMelodic(ctx, 2.0, 261.63, (t, f) => {
          const flutter = 1.0 + 0.003 * Math.sin(2 * Math.PI * 4.2 * t);
          let str = 0;
          for (let h = 1; h <= 6; h++) {
            str += Math.sin(2 * Math.PI * f * h * flutter * t) / (h * 0.9);
          }
          const dust = (Math.random() * 2 - 1) * 0.04;
          const env = (1 - Math.exp(-t * 4)) * Math.exp(-t * 0.9);
          return (str * 0.35 + dust) * env * 0.7;
        })
      },
      {
        id: 'ambient_shimmer',
        name: 'Ambient Shimmer',
        category: 'Pad',
        generate: (ctx) => this._renderMelodic(ctx, 2.4, 261.63, (t, f) => {
          const fund = Math.sin(2 * Math.PI * f * t);
          const fifth = Math.sin(2 * Math.PI * (f * 1.498) * t) * 0.5;
          const octave = Math.sin(2 * Math.PI * (f * 2.002) * t) * 0.35;
          const env = (1 - Math.exp(-t * 2)) * Math.exp(-t * 0.6);
          return (fund + fifth + octave) * env * 0.5;
        })
      },
      {
        id: 'kalimba_pluck',
        name: 'Kalimba Pluck',
        category: 'Pluck',
        generate: (ctx) => this._renderMelodic(ctx, 1.2, 523.25, (t, f) => {
          const click = (Math.random() * 2 - 1) * Math.exp(-t * 50) * 0.2;
          const tine1 = Math.sin(2 * Math.PI * f * t);
          const tine2 = Math.sin(2 * Math.PI * (f * 5.4) * t) * Math.exp(-t * 22) * 0.4;
          const env = Math.exp(-t * 3.5);
          return (tine1 + tine2 + click) * env * 0.8;
        })
      },
      {
        id: 'toy_vibraphone',
        name: 'Toy Vibraphone',
        category: 'Pluck',
        generate: (ctx) => this._renderMelodic(ctx, 1.4, 523.25, (t, f) => {
          const strike = Math.sin(2 * Math.PI * f * t);
          const bell = Math.sin(2 * Math.PI * f * 3.98 * t) * Math.exp(-t * 12) * 0.5;
          const env = Math.exp(-t * 2.2);
          return (strike + bell) * env * 0.75;
        })
      },
      {
        id: 'pizzicato',
        name: 'Pizzicato Strings',
        category: 'Pluck',
        generate: (ctx) => this._renderMelodic(ctx, 0.9, 329.63, (t, f) => {
          const body = Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(2 * Math.PI * 2 * f * t);
          const pluck = (Math.random() * 2 - 1) * Math.exp(-t * 80) * 0.3;
          const env = Math.exp(-t * 5.5);
          return (body + pluck) * env * 0.85;
        })
      },
      {
        id: 'retro_lead',
        name: 'Retro Lead',
        category: 'Lead',
        generate: (ctx) => this._renderMelodic(ctx, 1.5, 329.63, (t, f) => {
          const s1 = Math.sin(2 * Math.PI * f * t);
          const s2 = Math.sin(2 * Math.PI * (f * 2) * t) * 0.4;
          const s3 = Math.sin(2 * Math.PI * (f * 3) * t) * 0.2;
          const vibrato = 1 + 0.008 * Math.sin(2 * Math.PI * 5.5 * t);
          const env = (1 - Math.exp(-t * 20)) * Math.exp(-t * 1.5);
          return (s1 + s2 + s3) * vibrato * env * 0.7;
        })
      },
      {
        id: 'chiptune_square',
        name: 'Chiptune NES Square',
        category: 'Lead',
        generate: (ctx) => this._renderMelodic(ctx, 1.2, 440.0, (t, f) => {
          // 25% pulse width arcade sound
          const phase = (f * t) % 1.0;
          const pulse = phase < 0.25 ? 0.65 : -0.65;
          return pulse * Math.exp(-t * 2.5) * 0.7;
        })
      },
      {
        id: 'vowel_synth',
        name: 'Vowel Synth',
        category: 'Vocal',
        generate: (ctx) => this._renderMelodic(ctx, 1.4, 261.63, (t, f) => {
          // Dual formant filters at 750Hz and 1200Hz
          const pulse = (Math.sin(2 * Math.PI * f * t) > 0 ? 1 : -1);
          const f1 = Math.sin(2 * Math.PI * 750 * t) * Math.exp(-((t * 1000) % (1000 / f)) * 0.08);
          const f2 = Math.sin(2 * Math.PI * 1200 * t) * Math.exp(-((t * 1000) % (1000 / f)) * 0.08) * 0.6;
          const env = (1 - Math.exp(-t * 12)) * Math.exp(-t * 1.8);
          return (pulse * 0.2 + f1 + f2) * env * 0.6;
        })
      },
      {
        id: 'tape_choir',
        name: 'Tape Choir',
        category: 'Vocal',
        generate: (ctx) => this._renderMelodic(ctx, 1.8, 329.63, (t, f) => {
          const v1 = Math.sin(2 * Math.PI * f * t);
          const v2 = Math.sin(2 * Math.PI * (f * 1.003) * t) * 0.7;
          const v3 = Math.sin(2 * Math.PI * (f * 0.997) * t) * 0.7;
          const breath = (Math.random() * 2 - 1) * 0.05;
          const env = (1 - Math.exp(-t * 5)) * Math.exp(-t * 1.0);
          return (v1 + v2 + v3 + breath) * env * 0.45;
        })
      },
      {
        id: 'acid_303_lead',
        name: 'Acid TB-303 Lead',
        category: 'Lead',
        generate: (ctx) => this._renderMelodic(ctx, 1.4, 220.0, (t, f) => {
          const saw = (2 * ((f * t) % 1) - 1);
          const filterMod = f * (1 + 5.0 * Math.exp(-t * 14));
          const res = Math.sin(2 * Math.PI * filterMod * t) * 0.55;
          return Math.tanh((saw + res) * 2.2) * Math.exp(-t * 2.2) * 0.75;
        })
      },
      {
        id: 'oberheim_brass',
        name: 'Oberheim 8-Voice Brass',
        category: 'Brass',
        generate: (ctx) => this._renderMelodic(ctx, 1.8, 261.63, (t, f) => {
          const s1 = (2 * ((f * t) % 1) - 1);
          const s2 = (2 * (((f * 1.005) * t) % 1) - 1);
          const s3 = (2 * (((f * 0.995) * t) % 1) - 1);
          const swell = (1 - Math.exp(-t * 10)) * Math.exp(-t * 1.2);
          return (s1 + s2 * 0.8 + s3 * 0.8) * swell * 0.35;
        })
      },
      {
        id: 'fairlight_flute',
        name: 'Fairlight CMI Flute',
        category: 'Keys',
        generate: (ctx) => this._renderMelodic(ctx, 1.6, 349.23, (t, f) => {
          const fund = Math.sin(2 * Math.PI * f * t);
          const h2 = Math.sin(2 * Math.PI * f * 2 * t) * 0.3;
          const breath = (Math.random() * 2 - 1) * Math.exp(-t * 12) * 0.15;
          const raw = (fund + h2 + breath) * Math.exp(-t * 1.6) * 0.75;
          // 8-bit digital quantization
          return Math.round(raw * 32) / 32;
        })
      },
      {
        id: 'casio_cz_synth',
        name: 'Casio CZ Synth',
        category: 'Lead',
        generate: (ctx) => this._renderMelodic(ctx, 1.5, 261.63, (t, f) => {
          const phase = (f * t) % 1.0;
          const cz = Math.sin(2 * Math.PI * phase) * (1 - Math.cos(2 * Math.PI * phase));
          return Math.tanh(cz * 1.8) * Math.exp(-t * 1.9) * 0.7;
        })
      },
      {
        id: 'mellotron_flute',
        name: 'Mellotron 1967 Tape Flute',
        category: 'Keys',
        generate: (ctx) => this._renderMelodic(ctx, 2.0, 329.63, (t, f) => {
          const flutter = 1 + 0.007 * Math.sin(2 * Math.PI * 6.2 * t);
          const core = Math.sin(2 * Math.PI * (f * flutter) * t) + 0.25 * Math.sin(2 * Math.PI * (f * 2) * t);
          const tapeDust = (Math.random() * 2 - 1) * 0.03;
          const env = (1 - Math.exp(-t * 8)) * Math.exp(-t * 0.9);
          return (core + tapeDust) * env * 0.65;
        })
      },
      {
        id: 'deep_909_sub',
        name: '909 Deep Sub',
        category: 'Bass',
        generate: (ctx) => this._renderMelodic(ctx, 1.6, 98.0, (t, f) => {
          const drop = f * Math.exp(-t * 18) + 42;
          const sine = Math.sin(2 * Math.PI * drop * t);
          const sat = Math.tanh(sine * 2.0);
          return sat * Math.exp(-t * 2.0) * 0.85;
        })
      },
      {
        id: 'rosewood_marimba',
        name: 'Rosewood Marimba',
        category: 'Pluck',
        generate: (ctx) => this._renderMelodic(ctx, 1.2, 440.0, (t, f) => {
          const f1 = Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 8);
          const f2 = Math.sin(2 * Math.PI * (f * 3.98) * t) * Math.exp(-t * 24) * 0.4;
          const f3 = Math.sin(2 * Math.PI * (f * 9.2) * t) * Math.exp(-t * 45) * 0.15;
          return (f1 + f2 + f3) * 0.8;
        })
      },
      {
        id: 'steel_drum_pan',
        name: 'Caribbean Steel Pan',
        category: 'Pluck',
        generate: (ctx) => this._renderMelodic(ctx, 1.4, 392.0, (t, f) => {
          const fund = Math.sin(2 * Math.PI * f * t);
          const ring = Math.sin(2 * Math.PI * (f * 2.4) * t) * 0.5;
          const chime = Math.sin(2 * Math.PI * (f * 4.8) * t) * 0.25;
          return (fund + ring + chime) * Math.exp(-t * 5.0) * 0.75;
        })
      },
      {
        id: 'lofi_jazz_guitar',
        name: 'Lo-Fi Jazz Guitar',
        category: 'Pluck',
        generate: (ctx) => this._renderMelodic(ctx, 1.6, 196.0, (t, f) => {
          const str1 = Math.sin(2 * Math.PI * f * t);
          const str2 = Math.sin(2 * Math.PI * (f * 2.002) * t) * 0.35;
          const pick = (Math.random() * 2 - 1) * Math.exp(-t * 60) * 0.25;
          return (str1 + str2 + pick) * Math.exp(-t * 2.8) * 0.75;
        })
      },
      {
        id: 'synthwave_bass',
        name: 'Synthwave Gated Bass',
        category: 'Bass',
        generate: (ctx) => this._renderMelodic(ctx, 1.1, 110.0, (t, f) => {
          const saw = (2 * ((f * t) % 1) - 1);
          const sub = Math.sin(2 * Math.PI * (f * 0.5) * t) * 0.7;
          return Math.tanh((saw + sub) * 1.8) * Math.exp(-t * 4.0) * 0.8;
        })
      },
      {
        id: 'fender_jazz_bass',
        name: 'Fender Jazz Finger Bass',
        category: 'Bass',
        generate: (ctx) => this._renderMelodic(ctx, 4.2, 98.0, (t, f) => {
          const fund = Math.sin(2 * Math.PI * f * t);
          const harm2 = Math.sin(2 * Math.PI * (f * 2) * t) * 0.45;
          const harm3 = Math.sin(2 * Math.PI * (f * 3) * t) * 0.18;
          const plk = (Math.random() * 2 - 1) * Math.exp(-t * 80) * 0.25;
          const env = (1 - Math.exp(-t * 90)) * Math.exp(-t * 0.55);
          return (fund + harm2 + harm3 + plk) * env * 0.82;
        })
      },
      {
        id: 'baroque_harpsichord',
        name: 'Baroque Concert Harpsichord',
        category: 'Keys',
        generate: (ctx) => this._renderMelodic(ctx, 3.5, 261.63, (t, f) => {
          const qPluck = (Math.random() * 2 - 1) * Math.exp(-t * 120) * 0.4;
          let choir = 0;
          for (let h = 1; h <= 12; h++) {
            const hAmp = (1 / Math.pow(h, 0.9)) * Math.exp(-t * (0.8 + h * 0.25));
            choir += Math.sin(2 * Math.PI * f * h * t) * hAmp;
            choir += Math.sin(2 * Math.PI * (f * 2) * h * 1.002 * t) * (hAmp * 0.4);
          }
          const env = (1 - Math.exp(-t * 150)) * Math.exp(-t * 0.7);
          return (choir * 0.18 + qPluck) * env * 0.75;
        })
      },
      {
        id: 'jazz_vibraphone_tremolo',
        name: 'Jazz Vibraphone (Tremolo)',
        category: 'Pluck',
        generate: (ctx) => this._renderMelodic(ctx, 5.0, 392.0, (t, f) => {
          const trem = 1.0 + 0.18 * Math.sin(2 * Math.PI * 5.2 * t);
          const bar1 = Math.sin(2 * Math.PI * f * t);
          const bar2 = Math.sin(2 * Math.PI * (f * 3.96) * t) * Math.exp(-t * 6.0) * 0.35;
          const bar3 = Math.sin(2 * Math.PI * (f * 9.8) * t) * Math.exp(-t * 18.0) * 0.15;
          const mallet = Math.sin(2 * Math.PI * 90 * t) * Math.exp(-t * 40) * 0.25;
          const env = (1 - Math.exp(-t * 100)) * Math.exp(-t * 0.38);
          return (bar1 + bar2 + bar3 + mallet) * trem * env * 0.8;
        })
      },
      {
        id: 'tubular_chimes_bell',
        name: 'Orchestral Tubular Chimes',
        category: 'Keys',
        generate: (ctx) => this._renderMelodic(ctx, 5.5, 440.0, (t, f) => {
          const strike = (Math.random() * 2 - 1) * Math.exp(-t * 90) * 0.35;
          const o1 = Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 0.45);
          const o2 = Math.sin(2 * Math.PI * (f * 2.76) * t) * Math.exp(-t * 0.65) * 0.65;
          const o3 = Math.sin(2 * Math.PI * (f * 5.40) * t) * Math.exp(-t * 0.95) * 0.45;
          const o4 = Math.sin(2 * Math.PI * (f * 8.90) * t) * Math.exp(-t * 1.5) * 0.25;
          const o5 = Math.sin(2 * Math.PI * (f * 13.2) * t) * Math.exp(-t * 2.5) * 0.15;
          return (strike + o1 + o2 + o3 + o4 + o5) * 0.72;
        })
      },
      {
        id: 'jupiter8_warm_poly_brass',
        name: 'Roland Jupiter-8 Poly Brass',
        category: 'Lead',
        generate: (ctx) => this._renderMelodic(ctx, 4.8, 220.0, (t, f) => {
          const vib = 1.0 + 0.005 * Math.sin(2 * Math.PI * 4.6 * t);
          const saw1 = (2 * ((f * vib * t) % 1) - 1);
          const saw2 = (2 * ((f * 1.006 * vib * t) % 1) - 1) * 0.9;
          const sub = Math.sin(2 * Math.PI * (f * 0.5) * t) * 0.4;
          const filtMod = Math.exp(-t * 1.2);
          const shaped = Math.tanh((saw1 + saw2 + sub) * (1.2 + filtMod * 2.5));
          const env = (1 - Math.exp(-t * 30)) * Math.exp(-t * 0.32);
          return shaped * env * 0.7;
        })
      },
      {
        id: 'dusty_jazz_rhodes_chops',
        name: 'Dusty Jazz Rhodes Chops',
        category: 'Keys',
        generate: (ctx) => this._renderMelodic(ctx, 3.8, 261.63, (t, f) => {
          const tine = Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 1.8);
          const bar = Math.sin(2 * Math.PI * (f * 3.98) * t) * Math.exp(-t * 4.5) * 0.45;
          const tone = Math.sin(2 * Math.PI * (f * 2.0) * t) * Math.exp(-t * 2.2) * 0.3;
          const vinylNoise = (Math.random() * 2 - 1) * 0.04 * Math.exp(-t * 0.6);
          const trem = 1.0 + 0.12 * Math.sin(2 * Math.PI * 5.2 * t);
          return Math.tanh((tine + bar + tone + vinylNoise) * 1.3) * trem * Math.exp(-t * 0.5) * 0.75;
        })
      },
      {
        id: 'tape_saturated_vinyl_flute',
        name: 'Tape-Saturated Vinyl Flute',
        category: 'Lead',
        generate: (ctx) => this._renderMelodic(ctx, 3.2, 330.0, (t, f) => {
          const breath = (Math.random() * 2 - 1) * 0.12;
          const vib = 1.0 + 0.015 * Math.sin(2 * Math.PI * 5.4 * t);
          const fundamental = Math.sin(2 * Math.PI * f * vib * t);
          const h2 = Math.sin(2 * Math.PI * (f * 2) * vib * t) * 0.25;
          const h3 = Math.sin(2 * Math.PI * (f * 3) * vib * t) * 0.1;
          const env = (1 - Math.exp(-t * 40)) * Math.exp(-t * 0.45);
          return Math.tanh((fundamental + h2 + h3 + breath) * 1.4) * env * 0.72;
        })
      },
      {
        id: '808_slide_sub_bass',
        name: '808 Slide Sub Bass',
        category: 'Bass',
        generate: (ctx) => this._renderMelodic(ctx, 4.2, 55.0, (t, f) => {
          const glideFreq = f * (1.0 + 0.4 * Math.exp(-t * 12) + 0.1 * Math.sin(2 * Math.PI * 0.8 * t));
          const sub = Math.sin(2 * Math.PI * glideFreq * t);
          const warmHarmonic = Math.sin(2 * Math.PI * glideFreq * 2 * t) * 0.25;
          const drive = Math.tanh((sub + warmHarmonic) * 1.5);
          const env = Math.exp(-t * 0.38);
          return drive * env * 0.85;
        })
      }
    ];
  }

  // ==========================================
  // DRUM KIT PRESETS (16 SLICES CONTIGUOUS)
  // ==========================================

  static getDrumPresets() {
    return [
      {
        id: 'tr909_house',
        name: 'TR-909 House Kit',
        category: 'Drums',
        generate: (ctx) => this._renderDrumKit(ctx, 0.35, [
          (t) => this._synth909Kick(t),
          (t) => this._synthKickPunch(t),
          (t) => this._synth909Snare(t),
          (t) => this._synth909Clap(t),
          (t) => this._synthHatClosed(t),
          (t) => this._synthHatOpen(t),
          (t) => this._synthTomLow(t),
          (t) => this._synthTomHigh(t),
          (t) => this._synthRimshot(t),
          (t) => this._synth909Ride(t),
          (t) => this._synthCowbell(t),
          (t) => this._synthLaser(t),
          (t) => this._synthSubDrop(t),
          (t) => this._synthNoiseHit(t),
          (t) => this._synthVinylClick(t),
          (t) => this._synthCymbalCrash(t)
        ])
      },
      {
        id: 'tr808_classic',
        name: 'TR-808 Classic Kit',
        category: 'Drums',
        generate: (ctx) => this._renderDrumKit(ctx, 0.35, [
          (t) => this._synth808Kick(t),
          (t) => this._synthKickBoom(t),
          (t) => this._synth808Snare(t),
          (t) => this._synthClap(t),
          (t) => this._synthHatClosed(t),
          (t) => this._synthHatOpen(t),
          (t) => this._synthCongaLow(t),
          (t) => this._synthCongaHi(t),
          (t) => this._synthClave(t),
          (t) => this._synthShaker(t),
          (t) => this._synthCowbell(t),
          (t) => this._synthRimshot(t),
          (t) => this._synthSubDrop(t),
          (t) => this._synthTomLow(t),
          (t) => this._synthTomHigh(t),
          (t) => this._synthCymbalCrash(t)
        ])
      },
      {
        id: 'po33_beat_kit',
        name: 'PO-33 Beat Kit',
        category: 'Drums',
        generate: (ctx) => this._renderDrumKit(ctx, 0.35, [
          (t) => this._synthKickBoom(t),
          (t) => this._synthKickPunch(t),
          (t) => this._synthSnareFat(t),
          (t) => this._synthClap(t),
          (t) => this._synthHatClosed(t),
          (t) => this._synthHatOpen(t),
          (t) => this._synthTomLow(t),
          (t) => this._synthTomHigh(t),
          (t) => this._synthRimshot(t),
          (t) => this._synthShaker(t),
          (t) => this._synthCowbell(t),
          (t) => this._synthLaser(t),
          (t) => this._synthSubDrop(t),
          (t) => this._synthNoiseHit(t),
          (t) => this._synthVinylClick(t),
          (t) => this._synthCymbalCrash(t)
        ])
      },
      {
        id: 'acoustic_breakbeat',
        name: 'Acoustic Break Kit',
        category: 'Drums',
        generate: (ctx) => this._renderDrumKit(ctx, 0.35, [
          (t) => this._synthAcousticKick(t),
          (t) => this._synthKickPunch(t),
          (t) => this._synthAcousticSnare(t),
          (t) => this._synthClap(t),
          (t) => this._synthHatClosed(t),
          (t) => this._synthHatOpen(t),
          (t) => this._synthTomLow(t),
          (t) => this._synthTomHigh(t),
          (t) => this._synthRimshot(t),
          (t) => this._synthShaker(t),
          (t) => this._synthCowbell(t),
          (t) => this._synthTambourine(t),
          (t) => this._synthSubDrop(t),
          (t) => this._synthVinylClick(t),
          (t) => this._synth909Ride(t),
          (t) => this._synthCymbalCrash(t)
        ])
      },
      {
        id: 'industrial_cyber',
        name: 'Industrial Cyber Kit',
        category: 'Drums',
        generate: (ctx) => this._renderDrumKit(ctx, 0.35, [
          (t) => this._synthDistortedKick(t),
          (t) => this._synth909Kick(t),
          (t) => this._synthSnareFat(t),
          (t) => this._synth909Clap(t),
          (t) => this._synthHatClosed(t),
          (t) => this._synthHatOpen(t),
          (t) => this._synthMetallicPerc(t),
          (t) => this._synthMetallicPerc2(t),
          (t) => this._synthLaser(t),
          (t) => this._synthClave(t),
          (t) => this._synthCowbell(t),
          (t) => this._synthNoiseHit(t),
          (t) => this._synthSubDrop(t),
          (t) => this._synthDistortedKick(t),
          (t) => this._synthVinylClick(t),
          (t) => this._synthCymbalCrash(t)
        ])
      },
      {
        id: 'glitch_vinyl',
        name: 'Glitch & Vinyl Kit',
        category: 'Drums',
        generate: (ctx) => this._renderDrumKit(ctx, 0.35, [
          (t) => this._synthSubDrop(t),
          (t) => this._synthKickPunch(t),
          (t) => this._synthVinylClick(t),
          (t) => this._synthClap(t),
          (t) => this._synthHatClosed(t),
          (t) => this._synthHatOpen(t),
          (t) => this._synthNoiseHit(t),
          (t) => this._synthLaser(t),
          (t) => this._synthRimshot(t),
          (t) => this._synthShaker(t),
          (t) => this._synthCowbell(t),
          (t) => this._synthMetallicPerc(t),
          (t) => this._synthSubDrop(t),
          (t) => this._synthVinylClick(t),
          (t) => this._synthClave(t),
          (t) => this._synthCymbalCrash(t)
        ])
      },
      {
        id: 'lofi_hiphop_dust',
        name: 'Lo-Fi Hip-Hop Dust Kit',
        category: 'Drums',
        generate: (ctx) => this._renderDrumKit(ctx, 0.35, [
          (t) => this._synthAcousticKick(t),
          (t) => this._synthKickBoom(t),
          (t) => this._synthRimshot(t),
          (t) => this._synthSnareFat(t),
          (t) => this._synthHatClosed(t),
          (t) => this._synthHatOpen(t),
          (t) => this._synthShaker(t),
          (t) => this._synthVinylClick(t),
          (t) => this._synthTomLow(t),
          (t) => this._synthTomHigh(t),
          (t) => this._synthClap(t),
          (t) => this._synthNoiseHit(t),
          (t) => this._synthSubDrop(t),
          (t) => this._synthVinylClick(t),
          (t) => this._synthAcousticSnare(t),
          (t) => this._synthCymbalCrash(t)
        ])
      },
      {
        id: 'trap_808_mega',
        name: 'Trap 808 Mega Kit',
        category: 'Drums',
        generate: (ctx) => this._renderDrumKit(ctx, 0.35, [
          (t) => this._synthDistortedKick(t),
          (t) => this._synth808Kick(t),
          (t) => this._synth808Snare(t),
          (t) => this._synth909Clap(t),
          (t) => this._synthHatClosed(t),
          (t) => this._synthHatOpen(t),
          (t) => this._synthTomLow(t),
          (t) => this._synthLaser(t),
          (t) => this._synthRimshot(t),
          (t) => this._synthCowbell(t),
          (t) => this._synthMetallicPerc(t),
          (t) => this._synthNoiseHit(t),
          (t) => this._synthSubDrop(t),
          (t) => this._synthKickPunch(t),
          (t) => this._synthClave(t),
          (t) => this._synthCymbalCrash(t)
        ])
      },
      {
        id: 'vintage_electro',
        name: 'Vintage Electro Hybrid',
        category: 'Drums',
        generate: (ctx) => this._renderDrumKit(ctx, 0.35, [
          (t) => this._synth909Kick(t),
          (t) => this._synth808Kick(t),
          (t) => this._synth909Snare(t),
          (t) => this._synthClap(t),
          (t) => this._synthHatClosed(t),
          (t) => this._synthHatOpen(t),
          (t) => this._synthCowbell(t),
          (t) => this._synthClave(t),
          (t) => this._synthLaser(t),
          (t) => this._synthMetallicPerc(t),
          (t) => this._synthTomHigh(t),
          (t) => this._synthTomLow(t),
          (t) => this._synthRimshot(t),
          (t) => this._synthDistortedKick(t),
          (t) => this._synthSubDrop(t),
          (t) => this._synthCymbalCrash(t)
        ])
      },
      {
        id: 'jungle_dnb_break',
        name: 'Jungle & D&B Break Kit',
        category: 'Drums',
        generate: (ctx) => this._renderDrumKit(ctx, 0.35, [
          (t) => this._synthKickPunch(t),
          (t) => this._synthAcousticKick(t),
          (t) => this._synthAcousticSnare(t),
          (t) => this._synthSnareFat(t),
          (t) => this._synthHatClosed(t),
          (t) => this._synthHatOpen(t),
          (t) => this._synthShaker(t),
          (t) => this._synthRimshot(t),
          (t) => this._synthSubDrop(t),
          (t) => this._synthTomHigh(t),
          (t) => this._synthNoiseHit(t),
          (t) => this._synthLaser(t),
          (t) => this._synth808Snare(t),
          (t) => this._synthDistortedKick(t),
          (t) => this._synthVinylClick(t),
          (t) => this._synthCymbalCrash(t)
        ])
      },
      {
        id: 'linndrum_lm2',
        name: 'LinnDrum LM-2 Classic Kit',
        category: 'Drums',
        generate: (ctx) => this._renderDrumKit(ctx, 0.35, [
          (t) => this._synthKickPunch(t),
          (t) => this._synth808Kick(t),
          (t) => this._synthSnareFat(t),
          (t) => this._synthRimshot(t),
          (t) => this._synthClap(t),
          (t) => this._synthHatClosed(t),
          (t) => this._synthHatOpen(t),
          (t) => this._synthTomHigh(t),
          (t) => this._synthTomLow(t),
          (t) => this._synthCongaHi(t),
          (t) => this._synthCongaLow(t),
          (t) => this._synthCowbell(t),
          (t) => this._synthShaker(t),
          (t) => this._synthClave(t),
          (t) => this._synth909Ride(t),
          (t) => this._synthCymbalCrash(t)
        ])
      },
      {
        id: 'studio_acoustic_kit',
        name: 'Studio Acoustic Drum Kit',
        category: 'Drums',
        generate: (ctx) => this._renderDrumKit(ctx, 0.35, [
          (t) => this._synthAcousticKick(t),
          (t) => this._synthKickBoom(t),
          (t) => this._synthAcousticSnare(t),
          (t) => this._synthRimshot(t),
          (t) => this._synthHatClosed(t),
          (t) => this._synthHatOpen(t),
          (t) => this._synthTomHigh(t),
          (t) => this._synthTomLow(t),
          (t) => this._synthShaker(t),
          (t) => this._synthClap(t),
          (t) => this._synthCongaHi(t),
          (t) => this._synthCongaLow(t),
          (t) => this._synthCowbell(t),
          (t) => this._synth909Ride(t),
          (t) => this._synthMetallicPerc(t),
          (t) => this._synthCymbalCrash(t)
        ])
      },
      {
        id: 'sp1200_dirty_boombap',
        name: 'Dirty Boom-Bap SP-1200 Kit',
        category: 'Drums',
        generate: (ctx) => this._renderDrumKit(ctx, 0.38, [
          (t) => Math.tanh(this._synthKickBoom(t) * 1.5) * 0.85,
          (t) => this._synthKickPunch(t),
          (t) => Math.tanh(this._synthSnareFat(t) * 1.4) * 0.85,
          (t) => this._synthRimshot(t),
          (t) => this._synthClap(t),
          (t) => this._synthHatClosed(t) * 0.9,
          (t) => this._synthHatOpen(t),
          (t) => this._synthTomLow(t),
          (t) => this._synthTomHigh(t),
          (t) => this._synthCongaHi(t),
          (t) => this._synthShaker(t),
          (t) => this._synthCowbell(t),
          (t) => this._synthMetallicPerc(t),
          (t) => this._synthVinylScratch(t),
          (t) => this._synthTapeStab(t),
          (t) => this._synthCymbalCrash(t)
        ])
      },
      {
        id: 'memphis_808_drift',
        name: 'Memphis 808 Drift Kit',
        category: 'Drums',
        generate: (ctx) => this._renderDrumKit(ctx, 0.45, [
          (t) => this._synth808Kick(t),
          (t) => this._synthKickPunch(t),
          (t) => this._synth808Snare(t),
          (t) => this._synthClap(t),
          (t) => this._synthHatClosed(t),
          (t) => this._synthHatOpen(t),
          (t) => this._synthTomLow(t),
          (t) => this._synthTomHigh(t),
          (t) => this._synthCowbell(t),
          (t) => this._synthRimshot(t),
          (t) => this._synthShaker(t),
          (t) => this._synthCongaHi(t),
          (t) => this._synthMetallicPerc(t),
          (t) => this._synthLaser(t),
          (t) => this._synthSubDrop(t),
          (t) => this._synthCymbalCrash(t)
        ])
      }
    ];
  }

  // ==========================================
  // DRUM SYNTHESIS PRIMITIVES
  // ==========================================

  static _synthKickBoom(t) {
    const freq = 135 * Math.exp(-t * 26) + 40;
    const amp = Math.exp(-t * 9.5);
    const click = t < 0.005 ? (Math.random() * 2 - 1) * 0.4 : 0;
    return (Math.sin(2 * Math.PI * freq * t) + click) * amp * 0.9;
  }

  static _synthKickPunch(t) {
    const freq = 185 * Math.exp(-t * 32) + 50;
    const amp = Math.exp(-t * 12.0);
    return Math.sin(2 * Math.PI * freq * t) * amp * 0.9;
  }

  static _synth808Kick(t) {
    const freq = 150 * Math.exp(-t * 18) + 38;
    const amp = Math.exp(-t * 5.5);
    return Math.sin(2 * Math.PI * freq * t) * amp * 0.95;
  }

  static _synth909Kick(t) {
    const freq = 210 * Math.exp(-t * 35) + 48;
    const amp = Math.exp(-t * 11);
    const click = t < 0.003 ? 0.8 : 0;
    return Math.tanh((Math.sin(2 * Math.PI * freq * t) + click) * 1.5) * amp * 0.9;
  }

  static _synthAcousticKick(t) {
    const freq = 120 * Math.exp(-t * 22) + 45;
    const amp = Math.exp(-t * 14);
    const beater = (Math.random() * 2 - 1) * Math.exp(-t * 60) * 0.3;
    return (Math.sin(2 * Math.PI * freq * t) + beater) * amp * 0.85;
  }

  static _synthDistortedKick(t) {
    const freq = 260 * Math.exp(-t * 30) + 42;
    const raw = Math.sin(2 * Math.PI * freq * t);
    const dist = Math.tanh(raw * 3.5);
    return dist * Math.exp(-t * 8) * 0.85;
  }

  static _synthSnareFat(t) {
    const bodyFreq = 185 * Math.exp(-t * 16);
    const body = Math.sin(2 * Math.PI * bodyFreq * t) * Math.exp(-t * 14) * 0.6;
    const noise = (Math.random() * 2 - 1) * Math.exp(-t * 11) * 0.7;
    return (body + noise) * 0.85;
  }

  static _synth808Snare(t) {
    const body = Math.sin(2 * Math.PI * 240 * t) * Math.exp(-t * 18) * 0.45;
    const body2 = Math.sin(2 * Math.PI * 340 * t) * Math.exp(-t * 20) * 0.35;
    const noise = (Math.random() * 2 - 1) * Math.exp(-t * 14) * 0.6;
    return (body + body2 + noise) * 0.8;
  }

  static _synth909Snare(t) {
    const bodyFreq = 220 * Math.exp(-t * 20) + 140;
    const body = Math.sin(2 * Math.PI * bodyFreq * t) * Math.exp(-t * 15) * 0.55;
    const noise = (Math.random() * 2 - 1) * Math.exp(-t * 12) * 0.75;
    return (body + noise) * 0.85;
  }

  static _synthAcousticSnare(t) {
    const body = Math.sin(2 * Math.PI * 190 * t) * Math.exp(-t * 16) * 0.5;
    const rattle = (Math.random() * 2 - 1) * Math.exp(-t * 9) * 0.65;
    return (body + rattle) * 0.8;
  }

  static _synthClap(t) {
    let burst = 0;
    if (t < 0.01) burst = 1;
    else if (t > 0.015 && t < 0.025) burst = 0.9;
    else if (t > 0.03 && t < 0.04) burst = 0.8;
    else if (t >= 0.04) burst = Math.exp(-(t - 0.04) * 14);
    const noise = (Math.random() * 2 - 1);
    return noise * burst * 0.75;
  }

  static _synth909Clap(t) {
    let burst = 0;
    if (t < 0.012) burst = 0.9;
    else if (t > 0.018 && t < 0.03) burst = 0.95;
    else if (t > 0.035 && t < 0.048) burst = 1.0;
    else if (t >= 0.048) burst = Math.exp(-(t - 0.048) * 16);
    const noise = (Math.random() * 2 - 1);
    const filter = Math.sin(2 * Math.PI * 1100 * t);
    return (noise * 0.7 + filter * 0.3) * burst * 0.8;
  }

  static _synthHatClosed(t) {
    const noise = (Math.random() * 2 - 1);
    return noise * Math.exp(-t * 60) * 0.65;
  }

  static _synthHatOpen(t) {
    const noise = (Math.random() * 2 - 1);
    return noise * Math.exp(-t * 12) * 0.6;
  }

  static _synth909Ride(t) {
    const noise = (Math.random() * 2 - 1);
    const metal = Math.sin(2 * Math.PI * 3400 * t) * 0.4 + Math.sin(2 * Math.PI * 5200 * t) * 0.3;
    return (noise * 0.4 + metal) * Math.exp(-t * 7) * 0.6;
  }

  static _synthTomLow(t) {
    const freq = 120 * Math.exp(-t * 14) + 65;
    return Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 8) * 0.8;
  }

  static _synthTomHigh(t) {
    const freq = 220 * Math.exp(-t * 16) + 110;
    return Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 9) * 0.8;
  }

  static _synthCongaLow(t) {
    const freq = 160 * Math.exp(-t * 18) + 85;
    return Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 11) * 0.85;
  }

  static _synthCongaHi(t) {
    const freq = 310 * Math.exp(-t * 22) + 160;
    return Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 13) * 0.85;
  }

  static _synthClave(t) {
    return Math.sin(2 * Math.PI * 2500 * t) * Math.exp(-t * 45) * 0.75;
  }

  static _synthRimshot(t) {
    const f1 = 820 * Math.exp(-t * 40);
    const env = Math.exp(-t * 45);
    return (Math.sin(2 * Math.PI * f1 * t) + (Math.random() * 0.5)) * env * 0.7;
  }

  static _synthShaker(t) {
    const noise = (Math.random() * 2 - 1);
    const env = Math.sin(Math.min(Math.PI, (t / 0.12) * Math.PI)) * Math.exp(-t * 8);
    return noise * env * 0.5;
  }

  static _synthTambourine(t) {
    const rattle = (Math.random() * 2 - 1) * Math.exp(-t * 18);
    const jingle = Math.sin(2 * Math.PI * 6200 * t) * Math.exp(-t * 12) * 0.5;
    return (rattle + jingle) * 0.6;
  }

  static _synthCowbell(t) {
    const env = Math.exp(-t * 16);
    const s1 = Math.sin(2 * Math.PI * 540 * t) > 0 ? 0.5 : -0.5;
    const s2 = Math.sin(2 * Math.PI * 800 * t) > 0 ? 0.5 : -0.5;
    return (s1 + s2) * env * 0.6;
  }

  static _synthLaser(t) {
    const freq = 1200 * Math.exp(-t * 35) + 80;
    return Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 15) * 0.75;
  }

  static _synthMetallicPerc(t) {
    const f1 = Math.sin(2 * Math.PI * 940 * t);
    const f2 = Math.sin(2 * Math.PI * 1420 * t) * 0.7;
    return Math.tanh((f1 + f2) * 2.0) * Math.exp(-t * 16) * 0.7;
  }

  static _synthMetallicPerc2(t) {
    const f1 = Math.sin(2 * Math.PI * 1740 * t);
    const f2 = Math.sin(2 * Math.PI * 2350 * t) * 0.5;
    return (f1 + f2) * Math.exp(-t * 22) * 0.75;
  }

  static _synthSubDrop(t) {
    const freq = 90 * Math.exp(-t * 4) + 30;
    return Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 5) * 0.9;
  }

  static _synthNoiseHit(t) {
    const noise = (Math.random() * 2 - 1);
    return noise * Math.exp(-t * 18) * 0.6;
  }

  static _synthVinylClick(t) {
    if (t > 0.05) return 0;
    return (Math.random() * 2 - 1) * Math.exp(-t * 120) * 0.8;
  }

  static _synthCymbalCrash(t) {
    const noise = (Math.random() * 2 - 1);
    return noise * Math.exp(-t * 6) * 0.55;
  }

  static _synthVinylScratch(t) {
    const freq = 320 + 380 * Math.sin(2 * Math.PI * 18 * t);
    const noise = (Math.random() * 2 - 1) * 0.35;
    return Math.tanh((Math.sin(2 * Math.PI * freq * t) + noise) * 1.5) * Math.exp(-t * 14) * 0.8;
  }

  static _synthTapeStab(t) {
    const f = 220;
    const chord = Math.sin(2 * Math.PI * f * t) + Math.sin(2 * Math.PI * (f * 1.2) * t) * 0.7 + Math.sin(2 * Math.PI * (f * 1.5) * t) * 0.5;
    return Math.tanh(chord * 2.0) * Math.exp(-t * 12) * 0.75;
  }

  /**
   * Cycle next or previous preset in category for a slot
   * 
   * @param {AudioContext} ctx
   * @param {string} currentName Current slot preset name
   * @param {string} type 'melodic' or 'drum'
   * @param {number} direction +1 for next, -1 for previous
   * @returns {{ name: string, buffer: AudioBuffer }}
   */
  static cyclePreset(ctx, currentName, type, direction = 1) {
    const list = type === 'melodic' ? this.getMelodicPresets() : this.getDrumPresets();
    let curIdx = list.findIndex(p => p.name.toLowerCase() === (currentName || '').toLowerCase());
    if (curIdx === -1) curIdx = 0;

    const nextIdx = (curIdx + direction + list.length) % list.length;
    const preset = list[nextIdx];
    const buffer = preset.generate(ctx);
    return {
      name: preset.name,
      category: preset.category,
      buffer
    };
  }
}
