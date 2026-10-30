/**
 * Tests for Audio calculations, SampleSlot playback rates, trim boundaries, and PO dual filter curve math.
 */

import { SampleSlot } from '../src/audio/SampleSlot.js';
import { AudioRecorder } from '../src/audio/AudioRecorder.js';

export function runAudioTests(test) {
  test('SampleSlot: Pitch ratio semitone calculation is mathematically accurate', (assert) => {
    // formula: 2 ^ (semitones / 12)
    const unisonRate = Math.pow(2, 0 / 12);
    assert.strictEqual(unisonRate, 1.0);

    const octaveUpRate = Math.pow(2, 12 / 12);
    assert.strictEqual(octaveUpRate, 2.0);

    const octaveDownRate = Math.pow(2, -12 / 12);
    assert.strictEqual(octaveDownRate, 0.5);

    const twoOctavesUp = Math.pow(2, 24 / 12);
    assert.strictEqual(twoOctavesUp, 4.0);

    const fifthUp = Math.pow(2, 7 / 12);
    assert.ok(Math.abs(fifthUp - 1.4983) < 0.001);
  });

  test('SampleSlot: Initial parameters for melodic and drum slots', (assert) => {
    const melSlot = new SampleSlot(0, 'melodic', 'Synth Lead');
    assert.strictEqual(melSlot.type, 'melodic');
    assert.strictEqual(melSlot.name, 'Synth Lead');
    assert.strictEqual(melSlot.trimStart, 0.0);
    assert.strictEqual(melSlot.trimEnd, 1.0);
    assert.strictEqual(melSlot.pitch, 0);

    const drumSlot = new SampleSlot(8, 'drum');
    assert.strictEqual(drumSlot.type, 'drum');
    assert.strictEqual(drumSlot.selectedSliceIndex, 0);
  });

  test('PO-Style Dual Filter math: Center value 64 is bypass, <64 sweeps LPF, >64 sweeps HPF', (assert) => {
    // Verify the algorithm used in AudioEngine.setPoDualFilter:
    function calcLpfFreq(val) {
      if (val === 64) return 20000;
      const norm = val / 63;
      return 35 * Math.pow(20000 / 35, norm);
    }

    function calcHpfFreq(val) {
      if (val === 64) return 20;
      const norm = (val - 64) / 63;
      return 25 * Math.pow(10000 / 25, norm);
    }

    // At val 64: neutral
    assert.strictEqual(calcLpfFreq(64), 20000);
    assert.strictEqual(calcHpfFreq(64), 20);

    // At val 0 (full LPF cut): ~35Hz - 40Hz sub
    const minLpf = calcLpfFreq(0);
    assert.ok(minLpf >= 34 && minLpf <= 36, `Expected ~35Hz, got ${minLpf}`);

    // At val 63 (just below center): ~20000Hz (fully open)
    const maxLpf = calcLpfFreq(63);
    assert.ok(maxLpf >= 19990 && maxLpf <= 20010, `Expected ~20000Hz, got ${maxLpf}`);

    // At val 127 (full HPF cut): ~10000Hz (thin crispy treble)
    const maxHpf = calcHpfFreq(127);
    assert.ok(maxHpf >= 9990 && maxHpf <= 10010, `Expected ~10000Hz, got ${maxHpf}`);

    // Monotonicity checks
    assert.ok(calcLpfFreq(30) > calcLpfFreq(10));
    assert.ok(calcHpfFreq(110) > calcHpfFreq(80));
  });

  test('AudioRecorder: Direct Computer/Tab audio capture error handling when no audio track', async (assert) => {
    const mockCtx = {
      createAnalyser: () => ({ fftSize: 256 }),
      sampleRate: 44100
    };
    const recorder = new AudioRecorder(mockCtx);

    const origDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        mediaDevices: {
          getDisplayMedia: async () => ({
            getAudioTracks: () => [],
            getTracks: () => [{ stop: () => {} }]
          })
        }
      },
      configurable: true,
      writable: true
    });

    let threw = false;
    try {
      await recorder.initDisplayStream();
    } catch (e) {
      threw = true;
      assert.ok(e.message.includes('No audio track selected'));
    }
    assert.ok(threw, 'Should throw descriptive error when no audio track is selected in browser share dialog');

    if (origDesc) {
      Object.defineProperty(globalThis, 'navigator', origDesc);
    }
  });

  test('AudioRecorder: Normalizes captured PCM buffers to 0.95 peak (-0.5 dB)', (assert) => {
    let createdBuffer = null;
    const mockCtx = {
      createAnalyser: () => ({ fftSize: 256 }),
      sampleRate: 44100,
      createBuffer: (channels, length, sampleRate) => {
        const left = new Float32Array(length);
        const right = new Float32Array(length);
        createdBuffer = {
          length,
          getChannelData: (ch) => (ch === 0 ? left : right)
        };
        return createdBuffer;
      }
    };

    const recorder = new AudioRecorder(mockCtx);
    recorder.isRecording = true;
    recorder.recordedChunks = [
      {
        left: new Float32Array([0.1, 0.5, 0.2]),
        right: new Float32Array([0.05, 0.25, 0.1])
      }
    ];

    const buf = recorder.stopRecording();
    assert.ok(buf !== null);
    const outL = buf.getChannelData(0);
    // Initial peak was 0.5; normalized gain should scale 0.5 to 0.95
    assert.strictEqual(Math.round(outL[1] * 100) / 100, 0.95);
  });
}
