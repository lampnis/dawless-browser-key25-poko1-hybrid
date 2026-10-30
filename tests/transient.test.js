/**
 * Tests for TransientDetector energy-based onset detection and 16-slice distribution.
 */

import { TransientDetector } from '../src/audio/TransientDetector.js';

// Minimal mock AudioBuffer for Node testing environment
function createMockAudioBuffer(duration, sampleRate = 44100, generatePcmFn = null) {
  const length = Math.floor(duration * sampleRate);
  const data = new Float32Array(length);
  if (generatePcmFn) {
    for (let i = 0; i < length; i++) {
      data[i] = generatePcmFn(i / sampleRate);
    }
  }
  return {
    duration,
    sampleRate,
    length,
    numberOfChannels: 1,
    getChannelData: () => data
  };
}

export function runTransientTests(test) {
  test('TransientDetector: equalSlices generates exactly 16 contiguous slices', (assert) => {
    const slices = TransientDetector.equalSlices(4.0, 16);
    assert.strictEqual(slices.length, 16);

    // First slice starts at 0
    assert.strictEqual(slices[0].start, 0);

    // Each slice is 0.25s long
    assert.strictEqual(slices[0].end, 0.25);
    assert.strictEqual(slices[1].start, 0.25);
    assert.strictEqual(slices[15].end, 4.0);

    // Slices must be contiguous
    for (let i = 1; i < slices.length; i++) {
      assert.strictEqual(slices[i].start, slices[i - 1].end);
    }
  });

  test('TransientDetector: detectSlices finds transients in synthetic multi-burst audio', (assert) => {
    const sampleRate = 44100;
    const duration = 2.0;

    // Create audio with 4 distinct loud transients at 0.0s, 0.5s, 1.0s, 1.5s
    const mockBuffer = createMockAudioBuffer(duration, sampleRate, (t) => {
      // 4 bursts
      if ((t >= 0 && t < 0.08) ||
          (t >= 0.5 && t < 0.58) ||
          (t >= 1.0 && t < 1.08) ||
          (t >= 1.5 && t < 1.58)) {
        return Math.sin(2 * Math.PI * 150 * t) * 0.9;
      }
      return (Math.random() * 0.005) - 0.0025; // silent floor
    });

    const slices = TransientDetector.detectSlices(mockBuffer, { numSlices: 16 });

    // Must return exactly 16 slices
    assert.strictEqual(slices.length, 16);

    // First slice starts at 0
    assert.strictEqual(slices[0].start, 0);

    // Last slice ends at duration
    assert.strictEqual(slices[15].end, duration);

    // Slices are strictly ordered in time
    for (let i = 1; i < slices.length; i++) {
      assert.ok(slices[i].start >= slices[i - 1].start, `Slice ${i} should be >= previous start`);
      assert.ok(slices[i].end > slices[i].start, `Slice ${i} end should be > start`);
    }
  });

  test('TransientDetector: Gracefully handles completely silent buffer by subdividing', (assert) => {
    const silentBuffer = createMockAudioBuffer(1.6, 44100, () => 0);
    const slices = TransientDetector.detectSlices(silentBuffer, { numSlices: 16 });
    assert.strictEqual(slices.length, 16);
    assert.strictEqual(slices[0].start, 0);
    assert.strictEqual(slices[15].end, 1.6);
  });
}
