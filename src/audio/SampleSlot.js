/**
 * Open-KO: SampleSlot
 * Implements Melodic (chromatic polyphony) and Drum (16-slice one-shot) sample engines.
 */

import { TransientDetector } from './TransientDetector.js';

export class SampleSlot {
  /**
   * @param {number} index Slot index 0 to 15 (0-7 Melodic, 8-15 Drum)
   * @param {string} type 'melodic' or 'drum'
   * @param {string} name Slot label
   */
  constructor(index, type = 'melodic', name = '') {
    this.index = index;
    this.type = type; // 'melodic' or 'drum'
    this.name = name || (type === 'melodic' ? `Melodic ${index + 1}` : `Drum Kit ${index - 7}`);

    this.buffer = null; // AudioBuffer

    // Non-destructive sample parameters
    this.trimStart = 0.0; // 0.0 to 1.0 normalized
    this.trimEnd = 1.0;   // 0.0 to 1.0 normalized
    this.pitch = 0;       // -24 to +24 semitones
    this.fineTune = 0;    // -100 to +100 cents
    this.rootNote = 60;   // Middle C (C4)
    this.attack = 0.005;  // Seconds
    this.decay = (type === 'drum') ? 0.45 : 4.0; // Seconds (0.45s one-shot for drum kits, 4.0s sustain for melodic)
    this.volume = 0.85;   // 0.0 to 1.0
    this.reverse = false;
    this.loop = false;      // Loop mode: when true, held keys/pads loop continuously!
    this.stretchRatio = 1.0; // Current time-stretch multiplier
    this.stretchMode = 'pitch_only'; // Default: 'pitch_only' (time-invariant: higher notes maintain full constant duration!)
    this._pitchShiftCache = new Map(); // semitones -> AudioBuffer
    this.sidechainDucked = (type === 'melodic'); // Tracks duck volume when Kick hits

    // 16 Slices (for Drum slots or sliced melodic mode)
    this.slices = [];
    this.selectedSliceIndex = 0;

    // Active playing voices
    this.activeVoices = new Set();
  }

  /**
   * Reverse audio buffer channels in-place
   */
  reverseBuffer() {
    if (!this.buffer) return;
    if (this._pitchShiftCache) this._pitchShiftCache.clear();
    for (let c = 0; c < this.buffer.numberOfChannels; c++) {
      Array.prototype.reverse.call(this.buffer.getChannelData(c));
    }
    this.reverse = !this.reverse;
    if (this.type === 'drum') {
      this.autoSlice();
    }
  }

  /**
   * Peak normalize buffer to -0.5 dB in-place
   */
  normalizeBuffer() {
    if (!this.buffer) return;
    if (this._pitchShiftCache) this._pitchShiftCache.clear();
    let peak = 0;
    const len = this.buffer.length;
    for (let c = 0; c < this.buffer.numberOfChannels; c++) {
      const data = this.buffer.getChannelData(c);
      for (let i = 0; i < len; i++) {
        const abs = Math.abs(data[i]);
        if (abs > peak) peak = abs;
      }
    }
    if (peak > 0.001) {
      const gain = 0.95 / peak;
      for (let c = 0; c < this.buffer.numberOfChannels; c++) {
        const data = this.buffer.getChannelData(c);
        for (let i = 0; i < len; i++) data[i] *= gain;
      }
    }
  }

  /**
   * Time-stretch sample buffer using Granular Overlap-Add (OLA)
   * Stretches duration without changing musical pitch.
   * 
   * @param {number} factor Multiplier (0.5 = 2x faster, 2.0 = 2x slower)
   */
  timeStretch(factor = 1.0) {
    if (!this.buffer) return;
    const clampedFactor = Math.max(0.25, Math.min(4.0, factor));
    const oldBuffer = this.buffer;
    const sampleRate = oldBuffer.sampleRate;
    const numChannels = oldBuffer.numberOfChannels;
    const oldLen = oldBuffer.length;
    const newLen = Math.floor(oldLen * clampedFactor);

    // Create a temporary AudioContext to instantiate new AudioBuffer if in browser
    let newBuffer;
    if (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const tmpCtx = new Ctx();
      newBuffer = tmpCtx.createBuffer(numChannels, newLen, sampleRate);
      tmpCtx.close();
    } else {
      return;
    }

    // Granular overlap-add with Hann window
    const grainSize = Math.floor(sampleRate * 0.04); // 40ms window
    const hopIn = Math.floor(grainSize * 0.5);
    const hopOut = Math.floor(hopIn * clampedFactor);

    for (let c = 0; c < numChannels; c++) {
      const inData = oldBuffer.getChannelData(c);
      const outData = newBuffer.getChannelData(c);
      const win = new Float32Array(grainSize);
      for (let i = 0; i < grainSize; i++) {
        win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (grainSize - 1)));
      }

      let inPos = 0;
      let outPos = 0;
      while (inPos + grainSize < oldLen && outPos + grainSize < newLen) {
        for (let i = 0; i < grainSize; i++) {
          outData[outPos + i] += inData[inPos + i] * win[i];
        }
        inPos += hopIn;
        outPos += hopOut;
      }

      // Peak normalize output channel
      let maxPeak = 0;
      for (let i = 0; i < newLen; i++) {
        const abs = Math.abs(outData[i]);
        if (abs > maxPeak) maxPeak = abs;
      }
      if (maxPeak > 0.001) {
        const gain = 0.95 / maxPeak;
        for (let i = 0; i < newLen; i++) outData[i] *= gain;
      }
    }

    this.buffer = newBuffer;
    this.stretchRatio = clampedFactor;
    if (this._pitchShiftCache) this._pitchShiftCache.clear();
    if (this.type === 'drum') {
      this.autoSlice();
    } else {
      this.slices = TransientDetector.equalSlices(newBuffer.duration, 16);
    }
  }

  /**
   * Load an AudioBuffer into this slot and configure defaults
   */
  loadBuffer(audioBuffer) {
    this.buffer = audioBuffer;
    this.trimStart = 0.0;
    this.trimEnd = 1.0;
    if (this._pitchShiftCache) this._pitchShiftCache.clear();

    if (this.type === 'drum') {
      this.autoSlice();
    } else {
      this.slices = TransientDetector.equalSlices(audioBuffer.duration, 16);
    }
  }

  /**
   * Set stretch mode:
   * - 'resample': Classic varispeed (octaves squeeze/stretch playback time)
   * - 'pitch_only': Time-invariant pitch shift (heightens pitch only, constant duration)
   * 
   * @param {'resample'|'pitch_only'} mode
   */
  setStretchMode(mode) {
    if (mode === 'pitch_only' || mode === 'resample') {
      this.stretchMode = mode;
      if (this._pitchShiftCache) this._pitchShiftCache.clear();
    }
    return this.stretchMode;
  }

  /**
   * Toggle between 'resample' and 'pitch_only'
   */
  toggleStretchMode() {
    return this.setStretchMode(this.stretchMode === 'resample' ? 'pitch_only' : 'resample');
  }

  /**
   * Generates or returns a cached pitch-shifted AudioBuffer that preserves
   * the exact original duration/length without squeezing or stretching time.
   * 
   * @param {AudioContext} ctx
   * @param {number} semitones Semitone shift (-36 to +36)
   * @returns {AudioBuffer}
   */
  getPitchOnlyBuffer(ctx, semitones) {
    if (!this.buffer) return null;
    const roundedSemi = Math.round(semitones * 2) / 2;
    if (Math.abs(roundedSemi) < 0.01) return this.buffer;

    if (!this._pitchShiftCache) {
      this._pitchShiftCache = new Map();
    }
    if (this._pitchShiftCache.has(roundedSemi)) {
      return this._pitchShiftCache.get(roundedSemi);
    }

    const origBuffer = this.buffer;
    const sampleRate = origBuffer.sampleRate;
    const numChannels = origBuffer.numberOfChannels;
    const origLen = origBuffer.length;
    const R = Math.pow(2, roundedSemi / 12);

    let shiftedBuffer;
    if (ctx && typeof ctx.createBuffer === 'function') {
      shiftedBuffer = ctx.createBuffer(numChannels, origLen, sampleRate);
    } else if (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const tmp = new Ctx();
      shiftedBuffer = tmp.createBuffer(numChannels, origLen, sampleRate);
      tmp.close();
    } else {
      return this.buffer;
    }

    // Granular overlap-add pitch shifter:
    // Window size ~35ms with Hann window
    const grainSize = Math.max(64, Math.floor(sampleRate * 0.035));
    const hopOut = Math.max(16, Math.floor(grainSize * 0.45));
    const hopIn = Math.max(16, Math.floor(hopOut * R));

    const win = new Float32Array(grainSize);
    for (let i = 0; i < grainSize; i++) {
      win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (grainSize - 1)));
    }

    for (let c = 0; c < numChannels; c++) {
      const inData = origBuffer.getChannelData(c);
      const outData = shiftedBuffer.getChannelData(c);

      let inPos = 0;
      let outPos = 0;
      while (inPos + grainSize < origLen && outPos + grainSize < origLen) {
        for (let i = 0; i < grainSize; i++) {
          const resampIdx = inPos + Math.floor(i * R);
          if (resampIdx < origLen) {
            outData[outPos + i] += inData[resampIdx] * win[i];
          }
        }
        inPos += hopIn;
        outPos += hopOut;
      }

      // Peak normalize channel
      let peak = 0;
      for (let i = 0; i < origLen; i++) {
        const abs = Math.abs(outData[i]);
        if (abs > peak) peak = abs;
      }
      if (peak > 0.001) {
        const gain = 0.92 / peak;
        for (let i = 0; i < origLen; i++) outData[i] *= gain;
      }
    }

    this._pitchShiftCache.set(roundedSemi, shiftedBuffer);
    return shiftedBuffer;
  }

  /**
   * Run automatic transient detection on drum slot
   */
  autoSlice() {
    if (!this.buffer) return;
    this.slices = TransientDetector.detectSlices(this.buffer, { numSlices: 16 });
    this.selectedSliceIndex = 0;
  }

  /**
   * Play a melodic note (polyphonic chromatic voice)
   * 
   * @param {AudioContext} ctx
   * @param {AudioNode} destination
   * @param {number} midiNote Physical key note (typically 48 to 72)
   * @param {number} velocity 1 to 127
   * @param {number} when AudioContext time
   * @param {Object} pLocks Parameter locks for this step (if any)
   * @returns {Object} voice handle
   */
  playMelodic(ctx, destination, midiNote = 60, velocity = 100, when = 0, pLocks = null) {
    if (!this.buffer) return null;

    const startTime = when > 0 ? when : ctx.currentTime;
    const velGain = (velocity / 127);

    // Calculate Pitch / Playback Rate
    const pitchOffset = (pLocks && pLocks.pitch !== undefined) ? pLocks.pitch : this.pitch;
    const rawSemitones = (midiNote - this.rootNote) + pitchOffset + (this.fineTune / 100);
    // Clamp semitones between -36 and +36 (3 octaves down to 3 octaves up) to prevent extreme aliasing whistle/rumble
    const totalSemitones = Math.max(-36, Math.min(36, rawSemitones));

    let sourceBuffer = this.buffer;
    let playbackRate = 1.0;

    if (this.stretchMode === 'pitch_only' && Math.abs(totalSemitones) > 0.05) {
      // MODE 2: PITCH ONLY (Heightens/lowers pitch WITHOUT squeezing sample duration!)
      sourceBuffer = this.getPitchOnlyBuffer(ctx, totalSemitones) || this.buffer;
      playbackRate = 1.0;
    } else {
      // MODE 1: RESAMPLE / SQUEEZE (Classic Varispeed: octaves squeeze sample time)
      playbackRate = Math.max(0.125, Math.min(8.0, Math.pow(2, totalSemitones / 12)));
      sourceBuffer = this.buffer;
    }

    // Boundaries in seconds with safe clamping
    const duration = sourceBuffer.duration || this.buffer.duration;
    let rawStart = (pLocks && pLocks.trimStart !== undefined ? pLocks.trimStart : this.trimStart) * duration;
    let rawEnd = (pLocks && pLocks.trimEnd !== undefined ? pLocks.trimEnd : this.trimEnd) * duration;
    if (rawStart >= rawEnd - 0.01) {
      rawEnd = Math.min(duration, rawStart + 0.05);
      rawStart = Math.max(0, rawEnd - 0.05);
    }
    const startSec = Math.max(0, Math.min(duration - 0.01, rawStart));
    const endSec = Math.max(startSec + 0.01, Math.min(duration, rawEnd));
    const playLengthSec = Math.max(0.01, endSec - startSec);

    // Audio Graph for this Voice
    const source = ctx.createBufferSource();
    source.buffer = sourceBuffer;
    source.playbackRate.setValueAtTime(playbackRate, startTime);

    const gainNode = ctx.createGain();
    const envAttack = Math.max(0.002, this.attack);
    const envDecay = Math.max(0.02, (pLocks && pLocks.decay !== undefined) ? pLocks.decay : this.decay);
    const peakGain = Math.max(0.0001, this.volume * Math.max(0.01, velGain));

    source.connect(gainNode);
    gainNode.connect(destination);

    if (this.loop) {
      // Sustain Loop Mode: Loops seamlessly between start and end boundaries while key is held!
      source.loop = true;
      source.loopStart = startSec;
      source.loopEnd = endSec;

      gainNode.gain.setValueAtTime(0.0001, startTime);
      gainNode.gain.exponentialRampToValueAtTime(peakGain, startTime + envAttack);

      try {
        source.start(startTime, startSec);
      } catch (e) {
        console.warn('Loop voice start protected:', e);
        return null;
      }
    } else {
      // Standard One-Shot Attack - Decay envelope
      gainNode.gain.setValueAtTime(0.0001, startTime);
      gainNode.gain.exponentialRampToValueAtTime(peakGain, startTime + envAttack);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + envAttack + envDecay);

      // Schedule playback safely
      const maxVoiceTime = Math.max(0.01, playLengthSec / playbackRate);
      const stopTime = Math.min(startTime + envAttack + envDecay, startTime + maxVoiceTime);

      try {
        source.start(startTime, startSec, maxVoiceTime);
        source.stop(stopTime + 0.05);
      } catch (e) {
        console.warn('Voice start protected:', e);
        return null;
      }
    }

    const voiceHandle = {
      note: midiNote,
      source,
      gainNode,
      startTime,
      stop: (releaseTime = 0.18) => {
        const now = ctx.currentTime;
        try {
          gainNode.gain.cancelScheduledValues(now);
          gainNode.gain.setValueAtTime(Math.max(0.0001, gainNode.gain.value), now);
          gainNode.gain.exponentialRampToValueAtTime(0.0001, now + releaseTime);
          source.stop(now + releaseTime + 0.03);
        } catch (e) {
          // Voice already finished
        }
        this.activeVoices.delete(voiceHandle);
      }
    };

    this.activeVoices.add(voiceHandle);
    source.onended = () => {
      this.activeVoices.delete(voiceHandle);
      try {
        source.disconnect();
        gainNode.disconnect();
      } catch (e) {}
    };

    return voiceHandle;
  }

  /**
   * Play a one-shot slice (for Drum Slot)
   * 
   * @param {AudioContext} ctx
   * @param {AudioNode} destination
   * @param {number} sliceIndex 0 to 15 (any integer or note number will be cleanly normalized)
   * @param {number} velocity 1 to 127
   * @param {number} when AudioContext time
   * @param {Object} pLocks Parameter locks
   * @returns {Object} voice handle
   */
  playSlice(ctx, destination, sliceIndex = 0, velocity = 100, when = 0, pLocks = null) {
    if (!this.buffer) return null;

    const startTime = when > 0 ? when : ctx.currentTime;
    const velGain = (velocity / 127);

    // Normalize sliceIndex cleanly to 0..15 modulo 16 to guarantee valid slice boundaries
    const safeSliceIdx = Math.max(0, Math.min(15, ((Math.round(sliceIndex) % 16) + 16) % 16));

    // Get slice boundary safely
    const slice = (this.slices && this.slices[safeSliceIdx]) ? this.slices[safeSliceIdx] : null;
    const sStart = (slice && typeof slice.start === 'number' && !isNaN(slice.start)) ? slice.start : ((safeSliceIdx / 16) * this.buffer.duration);
    const sEnd = (slice && typeof slice.end === 'number' && !isNaN(slice.end)) ? slice.end : (((safeSliceIdx + 1) / 16) * this.buffer.duration);
    const sliceStart = Math.max(0, Math.min(sStart, this.buffer.duration - 0.01));
    // Anti-neighbor bleed: shave off a 4ms guard margin before the next slice starts
    const guardMargin = 0.004;
    const sliceEnd = Math.max(sliceStart + 0.008, Math.min(sEnd - guardMargin, this.buffer.duration));
    const sliceDuration = sliceEnd - sliceStart;

    // Pitch
    const pitchOffset = (pLocks && pLocks.pitch !== undefined) ? pLocks.pitch : ((slice && slice.pitch) || this.pitch);
    const playbackRate = Math.max(0.125, Math.min(8.0, Math.pow(2, pitchOffset / 12)));

    const source = ctx.createBufferSource();
    source.buffer = this.buffer;
    source.playbackRate.setValueAtTime(playbackRate, startTime);

    const gainNode = ctx.createGain();
    const envDecay = Math.max(0.02, (pLocks && pLocks.decay !== undefined) ? pLocks.decay : (this.type === 'drum' ? 0.45 : this.decay));
    const peakGain = Math.max(0.0001, this.volume * Math.max(0.01, velGain));

    source.connect(gainNode);
    gainNode.connect(destination);

    if (this.loop) {
      // Sliced Loop mode: loops slice while held
      source.loop = true;
      source.loopStart = sliceStart;
      source.loopEnd = sliceEnd;

      gainNode.gain.setValueAtTime(0.0001, startTime);
      gainNode.gain.linearRampToValueAtTime(peakGain, startTime + 0.002);

      try {
        source.start(startTime, sliceStart);
      } catch (e) {
        console.warn('Slice loop start protected:', e);
        return null;
      }
    } else {
      // Clean One-Shot drum playback: anti-click micro-fade-in + smooth fade-out before slice boundary
      const voiceDuration = Math.min(sliceDuration / playbackRate, envDecay);
      const fadeOutDur = Math.min(0.01, voiceDuration * 0.2);
      const fadeStartTime = startTime + voiceDuration - fadeOutDur;

      gainNode.gain.setValueAtTime(0.0001, startTime);
      if (typeof gainNode.gain.linearRampToValueAtTime === 'function') {
        gainNode.gain.linearRampToValueAtTime(peakGain, startTime + 0.0015);
      } else if (typeof gainNode.gain.exponentialRampToValueAtTime === 'function') {
        gainNode.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.0015);
      } else {
        gainNode.gain.setValueAtTime(peakGain, startTime + 0.0015);
      }

      if (fadeStartTime > startTime + 0.002) {
        gainNode.gain.setValueAtTime(peakGain, fadeStartTime);
      }

      if (typeof gainNode.gain.linearRampToValueAtTime === 'function') {
        gainNode.gain.linearRampToValueAtTime(0.00001, startTime + voiceDuration);
      } else if (typeof gainNode.gain.exponentialRampToValueAtTime === 'function') {
        gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + voiceDuration);
      }

      try {
        source.start(startTime, sliceStart, voiceDuration);
        source.stop(startTime + voiceDuration + 0.002);
      } catch (e) {
        console.warn('Slice start protected:', e);
        return null;
      }
    }

    const voiceHandle = {
      sliceIndex: safeSliceIdx,
      source,
      gainNode,
      startTime,
      stop: () => {
        try {
          source.stop();
        } catch (e) {}
        this.activeVoices.delete(voiceHandle);
      }
    };

    this.activeVoices.add(voiceHandle);
    source.onended = () => {
      this.activeVoices.delete(voiceHandle);
      try {
        source.disconnect();
        gainNode.disconnect();
      } catch (e) {}
    };

    return voiceHandle;
  }

  /**
   * Stop all voices for a specific key (Note Off with acoustic release damping)
   * @param {number} midiNote
   * @param {number} [releaseTime=0.18]
   */
  stopNote(midiNote, releaseTime = 0.18) {
    for (const voice of this.activeVoices) {
      if (voice.note === midiNote) {
        voice.stop(releaseTime);
      }
    }
  }

  /**
   * Stop all playing voices in this slot
   */
  stopAll() {
    for (const voice of this.activeVoices) {
      voice.stop(0.01);
    }
    this.activeVoices.clear();
  }
}
