/**
 * Open-KO: AudioExporter
 * High-speed offline arrangement renderer and studio-grade 16-bit 44.1kHz WAV encoder.
 * Exports the complete pattern chain arrangement with zero clicks, full polyphony, and master DSP.
 */

export class AudioExporter {
  /**
   * Renders the complete song arrangement via OfflineAudioContext and downloads WAV
   * 
   * @param {AudioEngine} audioEngine Master live audio engine with loaded sample slots
   * @param {Sequencer} sequencer Sequencer containing patternChain and pattern tracks
   * @param {Function} onProgress Optional progress callback (pct) => {}
   * @returns {Promise<Blob>} WAV Blob
   */
  static async exportArrangement(audioEngine, sequencer, onProgress = null) {
    const chain = sequencer.patternChain || [0];
    const bpm = sequencer.bpm || 92;
    const sampleRate = 44100;

    const secondsPer16th = (60 / bpm) / 4;
    const secondsPerPattern = secondsPer16th * 16;
    const arrangementDuration = (chain.length * secondsPerPattern) + 2.5; // 2.5s tail for decay/space delay
    const totalSamples = Math.ceil(arrangementDuration * sampleRate);

    // 1. Create Offline Audio Context
    const offlineCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(
      2,
      totalSamples,
      sampleRate
    );

    // 2. Build Master DSP Chain inside Offline Context
    const masterGain = offlineCtx.createGain();
    masterGain.gain.value = audioEngine.masterGain.gain.value || 0.85;

    // PO Dual Filter
    const filterLpf = offlineCtx.createBiquadFilter();
    filterLpf.type = 'lowpass';
    const filterHpf = offlineCtx.createBiquadFilter();
    filterHpf.type = 'highpass';

    const filterVal = audioEngine.currentFilterVal !== undefined ? audioEngine.currentFilterVal : 64;
    const res = audioEngine.getResonanceValue ? audioEngine.getResonanceValue() : 1.0;

    if (filterVal < 64) {
      const norm = filterVal / 63;
      const freq = Math.max(35, Math.min(20000, 35 * Math.pow(20000 / 35, norm)));
      filterLpf.frequency.value = freq;
      filterLpf.Q.value = res;
      filterHpf.frequency.value = 20;
    } else if (filterVal > 64) {
      const norm = (filterVal - 64) / 63;
      const freq = Math.max(20, Math.min(10000, 25 * Math.pow(10000 / 25, norm)));
      filterHpf.frequency.value = freq;
      filterHpf.Q.value = res;
      filterLpf.frequency.value = 20000;
    } else {
      filterLpf.frequency.value = 20000;
      filterHpf.frequency.value = 20;
    }

    // Dynamics Compressor
    const comp = offlineCtx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 12;
    comp.ratio.value = 4;
    comp.attack.value = 0.005;
    comp.release.value = 0.12;

    // Soft Clipper
    const clipper = offlineCtx.createWaveShaper();
    clipper.curve = this._createSoftClipCurve();

    // Voices & Sidechain Ducking Buses
    const voicesBus = offlineCtx.createGain();
    voicesBus.gain.value = 1.0;

    const sidechainBus = offlineCtx.createGain();
    sidechainBus.gain.value = 1.0;
    const sidechainGain = offlineCtx.createGain();
    sidechainGain.gain.value = 1.0;

    const unduckedBus = offlineCtx.createGain();
    unduckedBus.gain.value = 1.0;

    sidechainBus.connect(sidechainGain);
    sidechainGain.connect(voicesBus);
    unduckedBus.connect(voicesBus);

    // Connect Offline Graph
    voicesBus.connect(filterLpf);
    filterLpf.connect(filterHpf);
    filterHpf.connect(comp);
    comp.connect(clipper);
    clipper.connect(masterGain);
    masterGain.connect(offlineCtx.destination);

    // 3. Schedule Arrangement Steps across the Pattern Chain (with 128th Micro-Timing, Swing & Sidechain)
    let patternStartTime = 0.0;
    const swing = sequencer.swing !== undefined ? sequencer.swing : 50;
    const swingRatio = (swing - 50) / 50;

    const scEnabled = audioEngine.sidechainEnabled !== false;
    const scSource = audioEngine.sidechainSource !== undefined ? audioEngine.sidechainSource : 8;
    const scDepth = audioEngine.sidechainDepth !== undefined ? audioEngine.sidechainDepth : 0.65;
    const scRelease = audioEngine.sidechainRelease !== undefined ? audioEngine.sidechainRelease : 0.18;

    for (let c = 0; c < chain.length; c++) {
      const patIdx = chain[c];
      const pattern = sequencer.patterns[patIdx];
      if (!pattern) continue;

      const zoom = pattern.zoom || 1;
      const numSteps = pattern.length || (16 * zoom);
      const stepDurationSec = (60 / bpm) / (4 * zoom);
      const ticksPerStep = 128 / (16 * zoom);
      const tickDurationSec = stepDurationSec / ticksPerStep;
      const secondsThisPattern = stepDurationSec * numSteps;

      const hasSolo = pattern.trackSolos ? pattern.trackSolos.some(s => s === true) : false;

      for (let s = 0; s < numSteps; s++) {
        const isOddStep = (s % 2 !== 0);
        const swingOffset = isOddStep ? (stepDurationSec * 0.45 * swingRatio) : 0;
        const stepTime = patternStartTime + (s * stepDurationSec) + swingOffset;

        for (let slotIdx = 0; slotIdx < 16; slotIdx++) {
          if (pattern.trackMutes && pattern.trackMutes[slotIdx]) continue;
          if (hasSolo && !(pattern.trackSolos && pattern.trackSolos[slotIdx])) continue;

          const trackSteps = pattern.tracks[slotIdx];
          const step = trackSteps && trackSteps[s];
          if (!step || !step.active) continue;

          const liveSlot = audioEngine.slots[slotIdx];
          if (!liveSlot || !liveSlot.buffer) continue;

          const microOffsetSec = (step.microTiming || 0) * tickDurationSec;
          const noteTime = Math.max(0, stepTime + microOffsetSec);

          // Trigger offline sidechain ducking envelope when sidechain source track hits
          if (scEnabled && slotIdx === scSource && scDepth > 0.01) {
            this._scheduleOfflineSidechainDuck(sidechainGain, noteTime, scDepth, scRelease);
          }

          const destBus = (liveSlot.sidechainDucked !== false) ? sidechainBus : unduckedBus;

          // Schedule polyphonic notes or single note
          const notesToPlay = (Array.isArray(step.notes) && step.notes.length > 0)
            ? step.notes
            : [step.noteOrSlice !== undefined ? step.noteOrSlice : 60];

          for (const note of notesToPlay) {
            this._scheduleOfflineVoice(
              offlineCtx,
              destBus,
              liveSlot,
              note,
              step.velocity || 100,
              noteTime,
              step.pLocks
            );
          }
        }
      }

      patternStartTime += secondsThisPattern;
    }

    // 4. Offline Render
    if (onProgress) onProgress(50);
    const renderedBuffer = await offlineCtx.startRendering();
    if (onProgress) onProgress(90);

    // 5. Encode to 16-bit 44.1kHz Stereo WAV
    const wavBlob = this.encodeWAV(renderedBuffer);
    if (onProgress) onProgress(100);

    return wavBlob;
  }

  /**
   * Schedule sidechain ducking envelope on offline sidechainGain node
   */
  static _scheduleOfflineSidechainDuck(sidechainGain, when, depth = 0.65, release = 0.18) {
    const targetGain = Math.max(0.02, 1.0 - (depth * 0.95));
    const attack = 0.005;
    const g = sidechainGain.gain;
    try {
      g.cancelScheduledValues(when);
      g.setValueAtTime(1.0, when);
      g.linearRampToValueAtTime(targetGain, when + attack);
      g.exponentialRampToValueAtTime(1.0, when + attack + release);
    } catch (e) {}
  }

  /**
   * Calculate exact offline step event timestamp (exposed for unit verification)
   */
  static computeStepEventTime(patternStartTime, stepIndex, bpm, zoom = 1, swing = 50, microTiming = 0) {
    const stepDurationSec = (60 / bpm) / (4 * zoom);
    const ticksPerStep = 128 / (16 * zoom);
    const tickDurationSec = stepDurationSec / ticksPerStep;
    const swingRatio = (swing - 50) / 50;
    const swingOffset = (stepIndex % 2 !== 0) ? (stepDurationSec * 0.45 * swingRatio) : 0;
    return Math.max(0, patternStartTime + (stepIndex * stepDurationSec) + swingOffset + (microTiming * tickDurationSec));
  }

  /**
   * Schedule an offline voice
   */
  static _scheduleOfflineVoice(ctx, destination, slot, noteOrSlice, velocity, when, pLocks) {
    const startTime = when;
    const velGain = velocity / 127;

    const source = ctx.createBufferSource();
    const gainNode = ctx.createGain();

    if (slot.type === 'melodic') {
      const pitchOffset = (pLocks && pLocks.pitch !== undefined) ? pLocks.pitch : slot.pitch;
      const rawSemitones = (noteOrSlice - slot.rootNote) + pitchOffset + (slot.fineTune / 100);
      const totalSemitones = Math.max(-36, Math.min(36, rawSemitones));

      let sourceBuffer = slot.buffer;
      let playbackRate = 1.0;
      if (slot.stretchMode === 'pitch_only' && Math.abs(totalSemitones) > 0.05 && typeof slot.getPitchOnlyBuffer === 'function') {
        sourceBuffer = slot.getPitchOnlyBuffer(ctx, totalSemitones) || slot.buffer;
        playbackRate = 1.0;
      } else {
        playbackRate = Math.max(0.125, Math.min(8.0, Math.pow(2, totalSemitones / 12)));
      }

      const duration = sourceBuffer.duration || slot.buffer.duration;
      source.buffer = sourceBuffer;
      source.playbackRate.setValueAtTime(playbackRate, startTime);

      let rawStart = (pLocks && pLocks.trimStart !== undefined ? pLocks.trimStart : slot.trimStart) * duration;
      let rawEnd = (pLocks && pLocks.trimEnd !== undefined ? pLocks.trimEnd : slot.trimEnd) * duration;
      if (rawStart >= rawEnd - 0.01) {
        rawEnd = Math.min(duration, rawStart + 0.05);
        rawStart = Math.max(0, rawEnd - 0.05);
      }
      const startSec = Math.max(0, Math.min(duration - 0.01, rawStart));
      const endSec = Math.max(startSec + 0.01, Math.min(duration, rawEnd));
      const playLengthSec = Math.max(0.01, endSec - startSec);

      const envAttack = Math.max(0.002, slot.attack);
      const envDecay = Math.max(0.02, (pLocks && pLocks.decay !== undefined) ? pLocks.decay : slot.decay);
      const peakGain = Math.max(0.0001, slot.volume * Math.max(0.01, velGain));

      gainNode.gain.setValueAtTime(0.0001, startTime);
      gainNode.gain.exponentialRampToValueAtTime(peakGain, startTime + envAttack);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + envAttack + envDecay);

      source.connect(gainNode);
      gainNode.connect(destination);

      const maxVoiceTime = Math.max(0.01, playLengthSec / playbackRate);
      const stopTime = Math.min(startTime + envAttack + envDecay, startTime + maxVoiceTime);

      try {
        source.start(startTime, startSec, maxVoiceTime);
        source.stop(stopTime + 0.05);
      } catch (e) {}
    } else {
      // Drum Slice (with 4ms anti-neighbor-bleed guard window)
      const duration = slot.buffer.duration;
      source.buffer = slot.buffer;
      const sliceIdx = ((Math.round(noteOrSlice) % 16) + 16) % 16;
      const slice = slot.slices && slot.slices[sliceIdx];
      const sStart = (slice && typeof slice.start === 'number') ? slice.start : ((sliceIdx / 16) * duration);
      const sEnd = (slice && typeof slice.end === 'number') ? slice.end : (((sliceIdx + 1) / 16) * duration);
      const sliceStart = Math.max(0, Math.min(sStart, duration - 0.01));
      const guardMargin = 0.004;
      const sliceEnd = Math.max(sliceStart + 0.008, Math.min(sEnd - guardMargin, duration));
      const sliceDuration = sliceEnd - sliceStart;

      const pitchOffset = (pLocks && pLocks.pitch !== undefined) ? pLocks.pitch : ((slice && slice.pitch) || slot.pitch);
      const playbackRate = Math.max(0.125, Math.min(8.0, Math.pow(2, pitchOffset / 12)));
      source.playbackRate.setValueAtTime(playbackRate, startTime);

      const envDecay = Math.max(0.02, (pLocks && pLocks.decay !== undefined) ? pLocks.decay : slot.decay);
      const peakGain = Math.max(0.0001, slot.volume * Math.max(0.01, velGain));

      gainNode.gain.setValueAtTime(0.0001, startTime);
      gainNode.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.002);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.002 + envDecay);

      source.connect(gainNode);
      gainNode.connect(destination);

      const voiceDuration = Math.min(sliceDuration / playbackRate, envDecay + 0.05);
      try {
        source.start(startTime, sliceStart, voiceDuration);
        source.stop(startTime + voiceDuration + 0.02);
      } catch (e) {}
    }
  }

  /**
   * Soft clip curve generator
   */
  static _createSoftClipCurve() {
    const samples = 1024;
    const curve = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = Math.tanh(x * 1.25);
    }
    return curve;
  }

  /**
   * Encode AudioBuffer into standard 16-bit Stereo PCM WAV Blob
   */
  static encodeWAV(audioBuffer) {
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;

    const left = audioBuffer.getChannelData(0);
    const right = numChannels > 1 ? audioBuffer.getChannelData(1) : left;
    const numSamples = left.length;

    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = numSamples * blockAlign;
    const bufferSize = 44 + dataSize;

    const arrayBuffer = new ArrayBuffer(bufferSize);
    const view = new DataView(arrayBuffer);

    // RIFF identifier
    this._writeString(view, 0, 'RIFF');
    // File length minus RIFF header
    view.setUint32(4, 36 + dataSize, true);
    // RIFF type
    this._writeString(view, 8, 'WAVE');
    // Format chunk identifier
    this._writeString(view, 12, 'fmt ');
    // Format chunk length
    view.setUint32(16, 16, true);
    // Sample format (raw PCM)
    view.setUint16(20, format, true);
    // Channel count
    view.setUint16(22, numChannels, true);
    // Sample rate
    view.setUint32(24, sampleRate, true);
    // Byte rate (sample rate * block align)
    view.setUint32(28, byteRate, true);
    // Block align (channels * bytes per sample)
    view.setUint16(32, blockAlign, true);
    // Bits per sample
    view.setUint16(34, bitDepth, true);
    // Data chunk identifier
    this._writeString(view, 36, 'data');
    // Data chunk length
    view.setUint32(40, dataSize, true);

    // Write 16-bit interleaved PCM samples with soft limiting
    let offset = 44;
    for (let i = 0; i < numSamples; i++) {
      // Left channel
      let sL = Math.max(-1, Math.min(1, left[i]));
      sL = sL < 0 ? sL * 0x8000 : sL * 0x7FFF;
      view.setInt16(offset, sL, true);
      offset += 2;

      // Right channel
      let sR = Math.max(-1, Math.min(1, right[i]));
      sR = sR < 0 ? sR * 0x8000 : sR * 0x7FFF;
      view.setInt16(offset, sR, true);
      offset += 2;
    }

    return new Blob([view], { type: 'audio/wav' });
  }

  static _writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  /**
   * Helper to trigger instant browser download of Blob
   */
  static downloadBlob(blob, filename = 'open_ko_arrangement.wav') {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 2000);
  }
}
