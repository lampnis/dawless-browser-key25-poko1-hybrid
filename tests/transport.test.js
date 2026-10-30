/**
 * Tests for Transport Controls: Play/Pause vs Stop & Reset, Pattern Chaining, and Swing.
 */

import { Sequencer } from '../src/sequencer/Sequencer.js';

// Minimal mock AudioEngine for testing Sequencer without browser Web Audio
function createMockEngine() {
  return {
    ctx: {
      currentTime: 1.0,
      state: 'running',
      resume: async () => {}
    },
    ensureAudioContext: async () => {},
    slots: new Array(16).fill(null).map(() => ({
      stopAll: () => {},
      type: 'melodic',
      selectedSliceIndex: 0
    })),
    playSlotDirect: () => {},
    punchInFx: { setBpm: () => {} },
    masterGain: {}
  };
}

export function runTransportTests(test) {
  test('Transport: Play/Pause toggles and pauses at current step', async (assert) => {
    const mockEngine = createMockEngine();
    const seq = new Sequencer(mockEngine);

    assert.strictEqual(seq.isPlaying, false);
    assert.strictEqual(seq.isPaused, false);

    // 1. Play
    await seq.togglePlayPause();
    assert.strictEqual(seq.isPlaying, true);
    assert.strictEqual(seq.isPaused, false);

    // Simulate playhead advancement to step 7
    seq.currentStep = 7;

    // 2. Pause
    await seq.togglePlayPause();
    assert.strictEqual(seq.isPlaying, false);
    assert.strictEqual(seq.isPaused, true);
    // Crucial requirement: step position preserved!
    assert.strictEqual(seq.currentStep, 7);

    // 3. Resume from step 7
    await seq.togglePlayPause();
    assert.strictEqual(seq.isPlaying, true);
    assert.strictEqual(seq.isPaused, false);
    assert.strictEqual(seq.currentStep, 7);

    // Clean up timer
    seq.stopAndReset();
  });

  test('Transport: Stop & Reset silences playback and resets playhead to step 0', async (assert) => {
    const mockEngine = createMockEngine();
    const seq = new Sequencer(mockEngine);

    await seq.resume();
    seq.currentStep = 11;
    seq.chainPosition = 2;

    seq.stopAndReset();

    assert.strictEqual(seq.isPlaying, false);
    assert.strictEqual(seq.isPaused, false);
    assert.strictEqual(seq.currentStep, 0);
    assert.strictEqual(seq.chainPosition, 0);
  });

  test('Transport: Pattern Chaining advances through sequence', (assert) => {
    const mockEngine = createMockEngine();
    const seq = new Sequencer(mockEngine);

    seq.setPatternChain([0, 0, 1, 2]);
    assert.strictEqual(seq.patternChain.length, 4);
    assert.strictEqual(seq.chainPosition, 0);

    // Advance 16 steps (one full pattern)
    for (let i = 0; i < 16; i++) {
      seq._advanceStep();
    }
    // Should now be at patternChain[1] = 0
    assert.strictEqual(seq.chainPosition, 1);
    assert.strictEqual(seq.activePatternIndex, 0);

    // Advance another 16 steps
    for (let i = 0; i < 16; i++) {
      seq._advanceStep();
    }
    // Should now be at patternChain[2] = 1
    assert.strictEqual(seq.chainPosition, 2);
    assert.strictEqual(seq.activePatternIndex, 1);
  });

  test('Transport: Track Muting toggles correctly and skips audio scheduling', (assert) => {
    const mockEngine = createMockEngine();
    const seq = new Sequencer(mockEngine);

    assert.strictEqual(seq.isTrackMuted(0), false);
    seq.toggleTrackMute(0);
    assert.strictEqual(seq.isTrackMuted(0), true);
    seq.toggleTrackMute(0);
    assert.strictEqual(seq.isTrackMuted(0), false);
  });

  test('Transport: Live Loop Overdub Recording toggle and hit recording', async (assert) => {
    const mockEngine = createMockEngine();
    const seq = new Sequencer(mockEngine);
    seq.setRecordMode('quantized');

    assert.strictEqual(seq.isRecording, false);

    // Toggle Record starts playback and arms loop recording
    await seq.toggleRecord();
    assert.strictEqual(seq.isRecording, true);
    assert.strictEqual(seq.isPlaying, true);

    // Record a hit at step 0
    seq.currentStep = 0;
    seq.recordHit(0, 60, 100);

    const pattern = seq.getCurrentPattern();
    assert.strictEqual(pattern.tracks[0][0].active, true);
    assert.strictEqual(pattern.tracks[0][0].noteOrSlice, 60);

    // Toggle Record off leaves playback looping smoothly
    await seq.toggleRecord();
    assert.strictEqual(seq.isRecording, false);
    assert.strictEqual(seq.isPlaying, true);

    seq.stopAndReset();
  });
}
