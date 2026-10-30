/**
 * Tests for 16-Step Sequencer, Pattern tracks, Parameter Locking, and Lookahead Math.
 */

import { Pattern, StepData } from '../src/sequencer/StepData.js';

export function runSequencerTests(test) {
  test('Pattern: Initializes with 16 tracks x 16 steps', (assert) => {
    const pat = new Pattern(0);
    assert.strictEqual(pat.tracks.length, 16);

    for (let t = 0; t < 16; t++) {
      assert.strictEqual(pat.tracks[t].length, 16);
      for (let s = 0; s < 16; s++) {
        assert.strictEqual(pat.tracks[t][s].active, false);
      }
    }
  });

  test('StepData: Parameter Locks store and clear values per-step', (assert) => {
    const step = new StepData(true, 60, 100);

    step.setLock('pitch', 7);
    step.setLock('decay', 0.25);
    step.setLock('poFilter', 32);

    assert.strictEqual(step.pLocks.pitch, 7);
    assert.strictEqual(step.pLocks.decay, 0.25);
    assert.strictEqual(step.pLocks.poFilter, 32);

    step.clearLock('decay');
    assert.strictEqual(step.pLocks.decay, undefined);
    assert.strictEqual(step.pLocks.pitch, 7);

    step.clearAllLocks();
    assert.strictEqual(Object.keys(step.pLocks).length, 0);
  });

  test('Sequencer Timing Math: 16th note step duration varies correctly with BPM', (assert) => {
    function calcStepDuration(bpm) {
      return (60.0 / bpm) / 4.0;
    }

    // At 120 BPM: 1 beat = 0.5s; 16th note = 0.125s (125ms)
    assert.strictEqual(calcStepDuration(120), 0.125);

    // At 60 BPM: 16th note = 0.250s (250ms)
    assert.strictEqual(calcStepDuration(60), 0.25);

    // At 92 BPM: ~163ms
    const dur92 = calcStepDuration(92);
    assert.ok(Math.abs(dur92 - 0.16304) < 0.001);
  });

  test('Pattern: Track clearing removes active steps and p-locks', (assert) => {
    const pat = new Pattern(1);
    pat.tracks[2][0].active = true;
    pat.tracks[2][0].setLock('pitch', 12);
    pat.tracks[2][4].active = true;

    assert.strictEqual(pat.tracks[2][0].active, true);
    assert.strictEqual(pat.tracks[2][4].active, true);

    pat.clearTrack(2);
    assert.strictEqual(pat.tracks[2][0].active, false);
    assert.strictEqual(pat.tracks[2][4].active, false);
    assert.strictEqual(pat.tracks[2][0].pLocks.pitch, undefined);
  });
}
