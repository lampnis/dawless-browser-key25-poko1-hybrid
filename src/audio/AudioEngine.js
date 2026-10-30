/**
 * Open-KO: AudioEngine
 * Master Web Audio Graph, 16 Sample Slots, Sidechain Ducking Compressor,
 * Dual PO-33 Filter, Glue Compressor, and Soft-Clip Limiter.
 */

import { SampleSlot } from './SampleSlot.js';
import { PunchInFX } from './PunchInFX.js';
import { AudioRecorder } from './AudioRecorder.js';

export class AudioEngine {
  constructor() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContextClass();

    // 16 Sound Slots
    // Slots 0-7: Melodic
    // Slots 8-15: Drum Sliced
    this.slots = [];
    for (let i = 0; i < 16; i++) {
      const type = i < 8 ? 'melodic' : 'drum';
      this.slots.push(new SampleSlot(i, type));
    }
    this.activeSlotIndex = 0;

    // Sustain state for melodic keys
    this.sustainActive = false;
    this.sustainedNotes = new Set();

    // Master voices summing bus
    this.voicesBus = this.ctx.createGain();
    this.voicesBus.gain.value = 1.0;

    // Sidechain Ducking Bus Architecture
    // Melodic tracks route to sidechainBus -> sidechainGain -> voicesBus
    // Drum / trigger tracks route to unduckedBus -> voicesBus
    this.sidechainBus = this.ctx.createGain();
    this.sidechainGain = this.ctx.createGain();
    this.sidechainGain.gain.value = 1.0;

    this.unduckedBus = this.ctx.createGain();
    this.unduckedBus.gain.value = 1.0;

    // Sidechain Compressor settings
    this.sidechainEnabled = true;
    this.sidechainSource = 8; // Track 9 (TR-909 Kick drum by default)
    this.sidechainDepth = 0.65; // 0 to 1 (65% ducking)
    this.sidechainRelease = 0.18; // Seconds

    // Punch-in FX Chain
    this.punchInFx = new PunchInFX(this.ctx);

    // PO-Style Dual Filter
    // 0..63: LPF sweep down
    // 64: Bypass
    // 65..127: HPF sweep up
    this.filterLpf = this.ctx.createBiquadFilter();
    this.filterLpf.type = 'lowpass';
    this.filterLpf.frequency.value = 20000;
    this.filterLpf.Q.value = 1.0;

    this.filterHpf = this.ctx.createBiquadFilter();
    this.filterHpf.type = 'highpass';
    this.filterHpf.frequency.value = 20;
    this.filterHpf.Q.value = 1.0;

    this.currentFilterVal = 64; // Center
    this.currentResonanceVal = 64;

    // Master Dynamics Compressor (Drum bus glue)
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -18;
    this.compressor.knee.value = 12;
    this.compressor.ratio.value = 4;
    this.compressor.attack.value = 0.005;
    this.compressor.release.value = 0.12;

    // Master Soft-Clipper / Limiter
    this.softClipper = this.ctx.createWaveShaper();
    this.softClipper.curve = this._createSoftClipCurve();
    this.softClipper.oversample = '4x';

    // Master Gain & Analyser
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.85;

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 512;

    // Audio Recorder
    this.recorder = new AudioRecorder(this.ctx);

    this._connectGraph();
  }

  _connectGraph() {
    // Sidechain routing into voicesBus
    this.sidechainBus.connect(this.sidechainGain);
    this.sidechainGain.connect(this.voicesBus);
    this.unduckedBus.connect(this.voicesBus);

    // Voices -> PunchInFX -> LPF -> HPF -> Compressor -> SoftClipper -> MasterGain -> Analyser -> Destination
    this.voicesBus.connect(this.punchInFx.input);
    this.punchInFx.output.connect(this.filterLpf);
    this.filterLpf.connect(this.filterHpf);
    this.filterHpf.connect(this.compressor);
    this.compressor.connect(this.softClipper);
    this.softClipper.connect(this.masterGain);
    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
  }

  /**
   * Resume audio context on user gesture or incoming MIDI
   */
  async ensureAudioContext() {
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  getActiveSlot() {
    return this.slots[this.activeSlotIndex];
  }

  setActiveSlot(index) {
    if (index >= 0 && index < 16) {
      this.activeSlotIndex = index;
    }
    return this.getActiveSlot();
  }

  /**
   * Trigger the sidechain ducking compression envelope
   */
  triggerSidechainDuck(when = 0) {
    if (!this.sidechainEnabled || this.sidechainDepth <= 0.01) return;
    const now = (when && when > this.ctx.currentTime) ? when : this.ctx.currentTime;
    const g = this.sidechainGain.gain;
    const targetGain = Math.max(0.02, 1.0 - (this.sidechainDepth * 0.95));
    const attack = 0.005; // 5ms instant duck
    const release = this.sidechainRelease || 0.18;

    try {
      if (typeof g.cancelScheduledValues === 'function') {
        g.cancelScheduledValues(now);
      }
      if (typeof g.setValueAtTime === 'function') {
        g.setValueAtTime(g.value !== undefined ? g.value : 1.0, now);
      }
      if (typeof g.linearRampToValueAtTime === 'function') {
        g.linearRampToValueAtTime(targetGain, now + attack);
      } else if (typeof g.setValueAtTime === 'function') {
        g.setValueAtTime(targetGain, now + attack);
      }
      if (typeof g.exponentialRampToValueAtTime === 'function') {
        g.exponentialRampToValueAtTime(1.0, now + attack + release);
      } else if (typeof g.linearRampToValueAtTime === 'function') {
        g.linearRampToValueAtTime(1.0, now + attack + release);
      }
    } catch (e) {}
  }

  setSidechainDepth(depth) {
    this.sidechainDepth = Math.max(0, Math.min(1.0, depth));
  }

  setSidechainRelease(sec) {
    this.sidechainRelease = Math.max(0.04, Math.min(0.8, sec));
  }

  setSidechainSource(slotIdx) {
    if (slotIdx >= 0 && slotIdx < 16) {
      this.sidechainSource = slotIdx;
    }
  }

  toggleSidechain(enabled = undefined) {
    this.sidechainEnabled = (enabled !== undefined) ? !!enabled : !this.sidechainEnabled;
    return this.sidechainEnabled;
  }

  /**
   * Play active slot via MIDI note or keyboard key
   */
  playActiveSlot(midiNote, velocity = 100, when = 0, pLocks = null) {
    this.ensureAudioContext();
    const slot = this.getActiveSlot();
    if (!slot) return null;

    // Trigger sidechain ducking if this active slot is the trigger source
    if (this.sidechainEnabled && this.activeSlotIndex === this.sidechainSource) {
      this.triggerSidechainDuck(when);
    }

    const destBus = (slot.sidechainDucked !== false) ? this.sidechainBus : this.unduckedBus;

    if (slot.type === 'melodic') {
      return slot.playMelodic(this.ctx, destBus, midiNote, velocity, when, pLocks);
    } else {
      const sliceIndex = (midiNote % 16);
      return slot.playSlice(this.ctx, destBus, sliceIndex, velocity, when, pLocks);
    }
  }

  /**
   * Set sustain pedal / button state
   */
  setSustain(active) {
    this.sustainActive = !!active;
    if (!this.sustainActive) {
      const slot = this.getActiveSlot();
      if (slot && slot.type === 'melodic') {
        for (const note of this.sustainedNotes) {
          slot.stopNote(note);
        }
      }
      this.sustainedNotes.clear();
    }
  }

  /**
   * Stop active slot note (respects sustain)
   */
  stopActiveSlot(midiNote) {
    if (this.sustainActive) {
      this.sustainedNotes.add(midiNote);
      return;
    }
    const slot = this.getActiveSlot();
    if (slot) {
      if (slot.type === 'melodic') {
        slot.stopNote(midiNote);
      } else {
        const sliceIdx = ((midiNote % 16) + 16) % 16;
        for (const voice of slot.activeVoices) {
          if (voice.sliceIndex === sliceIdx && voice.stop) {
            voice.stop();
          }
        }
      }
    }
  }

  /**
   * Play explicit slot and slice/note (used by sequencer)
   */
  playSlotDirect(slotIndex, noteOrSlice, velocity = 100, when = 0, pLocks = null) {
    this.ensureAudioContext();
    const slot = this.slots[slotIndex];
    if (!slot || !slot.buffer) return null;

    // Sidechain ducking trigger on source track hit
    if (this.sidechainEnabled && slotIndex === this.sidechainSource) {
      this.triggerSidechainDuck(when);
    }

    const destBus = (slot.sidechainDucked !== false) ? this.sidechainBus : this.unduckedBus;

    if (slot.type === 'melodic') {
      return slot.playMelodic(this.ctx, destBus, noteOrSlice, velocity, when, pLocks);
    } else {
      const sliceIdx = ((Math.round(noteOrSlice) % 16) + 16) % 16;
      return slot.playSlice(this.ctx, destBus, sliceIdx, velocity, when, pLocks);
    }
  }

  /**
   * Teenage Engineering PO-Style Dual Cutoff Filter (CC 51, Value 0-127)
   */
  setPoDualFilter(value) {
    this.currentFilterVal = value;
    const now = this.ctx.currentTime;
    const res = this.getResonanceValue();

    if (value === 64) {
      this.filterLpf.frequency.setTargetAtTime(20000, now, 0.015);
      this.filterLpf.Q.setTargetAtTime(0.707, now, 0.015);
      this.filterHpf.frequency.setTargetAtTime(20, now, 0.015);
      this.filterHpf.Q.setTargetAtTime(0.707, now, 0.015);
    } else if (value < 64) {
      const norm = value / 63;
      const freq = Math.max(35, Math.min(20000, 35 * Math.pow(20000 / 35, norm)));
      this.filterLpf.frequency.setTargetAtTime(freq, now, 0.015);
      this.filterLpf.Q.setTargetAtTime(res, now, 0.015);
      this.filterHpf.frequency.setTargetAtTime(20, now, 0.015);
      this.filterHpf.Q.setTargetAtTime(0.707, now, 0.015);
    } else {
      const norm = (value - 64) / 63;
      const freq = Math.max(20, Math.min(10000, 25 * Math.pow(10000 / 25, norm)));
      this.filterHpf.frequency.setTargetAtTime(freq, now, 0.015);
      this.filterHpf.Q.setTargetAtTime(res, now, 0.015);
      this.filterLpf.frequency.setTargetAtTime(20000, now, 0.015);
      this.filterLpf.Q.setTargetAtTime(0.707, now, 0.015);
    }
  }

  setFilterResonance(value) {
    this.currentResonanceVal = value;
    const res = this.getResonanceValue();
    const now = this.ctx.currentTime;

    if (this.currentFilterVal < 64) {
      this.filterLpf.Q.setTargetAtTime(res, now, 0.015);
    } else if (this.currentFilterVal > 64) {
      this.filterHpf.Q.setTargetAtTime(res, now, 0.015);
    }
  }

  getResonanceValue() {
    return 0.707 + (this.currentResonanceVal / 127) * 13.3;
  }

  setMasterCompVol(value) {
    const norm = value / 127;
    const now = this.ctx.currentTime;
    const thresh = -10 - (norm * 26);
    const ratio = 2 + (norm * 6);
    this.compressor.threshold.setTargetAtTime(thresh, now, 0.02);
    this.compressor.ratio.setTargetAtTime(ratio, now, 0.02);
    const masterVol = 0.2 + (norm * 0.9);
    this.masterGain.gain.setTargetAtTime(masterVol, now, 0.02);
  }

  setFxSend(value) {
    const norm = value / 127;
    const now = this.ctx.currentTime;
    this.punchInFx.spaceWet.gain.setTargetAtTime(norm * 0.85, now, 0.02);
  }

  _createSoftClipCurve() {
    const n = 1024;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = Math.tanh(x * 1.5) / Math.tanh(1.5);
    }
    return curve;
  }
}
