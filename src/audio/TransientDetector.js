/**
 * Open-KO: TransientDetector
 * Energy & Spectral Flux based audio transient auto-detection for 16-slice drum slicing.
 */

export class TransientDetector {
  /**
   * Slice an AudioBuffer into 16 slices based on transient energy onsets.
   * Falls back to smart subdivision or equal spacing if transients are scarce.
   * 
   * @param {AudioBuffer} audioBuffer
   * @param {Object} options
   * @returns {Array<{ start: number, end: number, index: number }>} Array of 16 slice objects
   */
  static detectSlices(audioBuffer, options = {}) {
    const numSlices = options.numSlices || 16;
    const duration = audioBuffer.duration;
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length;

    if (length === 0 || duration <= 0) {
      return this.equalSlices(duration, numSlices);
    }

    // Mixdown to mono float32 channel for analysis
    const pcm = new Float32Array(length);
    const numChannels = audioBuffer.numberOfChannels;
    for (let c = 0; c < numChannels; c++) {
      const channelData = audioBuffer.getChannelData(c);
      for (let i = 0; i < length; i++) {
        pcm[i] += channelData[i] / numChannels;
      }
    }

    // Frame analysis settings
    const frameSize = options.frameSize || 512; // ~11.6ms at 44.1kHz
    const hopSize = options.hopSize || 256;     // 50% overlap
    const numFrames = Math.floor((length - frameSize) / hopSize);

    if (numFrames < numSlices * 2) {
      return this.equalSlices(duration, numSlices);
    }

    // Calculate Short-Time Energy (STE) and High-Frequency Energy
    const energies = new Float32Array(numFrames);
    for (let f = 0; f < numFrames; f++) {
      const offset = f * hopSize;
      let energy = 0;
      let diffSum = 0;

      for (let i = 0; i < frameSize; i++) {
        const s = pcm[offset + i];
        energy += s * s;
        if (i > 0) {
          const diff = s - pcm[offset + i - 1];
          diffSum += diff * diff; // emphasizes sharp attacks/transients
        }
      }

      // Combined metric: energy with high-frequency slope weighting
      energies[f] = Math.sqrt(energy / frameSize) + (Math.sqrt(diffSum / frameSize) * 1.5);
    }

    // Dynamic thresholding for onset detection
    const windowRadius = 10;
    const onsets = [];
    const minDistanceFrames = Math.max(2, Math.floor(sampleRate * 0.05 / hopSize)); // minimum 50ms between transients

    let lastOnsetTime = -1;

    for (let f = windowRadius; f < numFrames - windowRadius; f++) {
      // Local mean
      let localMean = 0;
      for (let w = -windowRadius; w <= windowRadius; w++) {
        localMean += energies[f + w];
      }
      localMean /= (2 * windowRadius + 1);

      const threshold = localMean * 1.35;
      const isPeak = energies[f] > threshold &&
                     energies[f] > energies[f - 1] &&
                     energies[f] > energies[f + 1];

      if (isPeak) {
        const timeSec = (f * hopSize) / sampleRate;
        if (lastOnsetTime === -1 || (timeSec - lastOnsetTime) >= 0.04) {
          onsets.push({ time: timeSec, energy: energies[f] });
          lastOnsetTime = timeSec;
        }
      }
    }

    // Ensure start of buffer is always an onset
    const points = [0];
    for (const onset of onsets) {
      if (onset.time > 0.02 && onset.time < duration - 0.05) {
        points.push(onset.time);
      }
    }

    // If we have fewer than 16 slices, fill in largest gaps
    while (points.length < numSlices) {
      // Find largest gap between adjacent points
      let maxGap = 0;
      let insertIndex = 0;
      let splitTime = 0;

      for (let i = 0; i < points.length; i++) {
        const t1 = points[i];
        const t2 = (i === points.length - 1) ? duration : points[i + 1];
        const gap = t2 - t1;

        if (gap > maxGap) {
          maxGap = gap;
          insertIndex = i + 1;
          splitTime = t1 + (gap / 2);
        }
      }

      points.splice(insertIndex, 0, splitTime);
    }

    // If we have more than 16 points, sort by energy and keep top 16, keeping time order
    if (points.length > numSlices) {
      // Keep 0 and pick top 15 remaining onsets with highest energy
      const internalOnsets = onsets.filter(o => o.time > 0.02 && o.time < duration - 0.05);
      internalOnsets.sort((a, b) => b.energy - a.energy);
      const chosenTimes = internalOnsets.slice(0, numSlices - 1).map(o => o.time);
      chosenTimes.push(0);
      chosenTimes.sort((a, b) => a - b);
      points.length = 0;
      points.push(...chosenTimes);
    }

    // Build slices: start -> end
    const slices = [];
    for (let i = 0; i < numSlices; i++) {
      const start = points[i];
      const end = (i < numSlices - 1) ? points[i + 1] : duration;
      slices.push({
        index: i,
        start: Number(start.toFixed(4)),
        end: Number(end.toFixed(4)),
        pitch: 0
      });
    }

    return slices;
  }

  /**
   * Slices audio buffer evenly into numSlices
   */
  static equalSlices(duration, numSlices = 16) {
    const slices = [];
    const sliceLen = duration / numSlices;
    for (let i = 0; i < numSlices; i++) {
      slices.push({
        index: i,
        start: Number((i * sliceLen).toFixed(4)),
        end: Number(((i + 1) * sliceLen).toFixed(4)),
        pitch: 0
      });
    }
    return slices;
  }
}
