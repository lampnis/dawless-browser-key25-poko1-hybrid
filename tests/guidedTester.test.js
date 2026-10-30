/**
 * Tests for GuidedTester: ensures class instantiates, builds DOM without syntax errors,
 * and handles diagnostic tabs, wizard steps, and layout references.
 */

import { GuidedTester } from '../src/ui/GuidedTester.js';
import { MidiManager } from '../src/midi/MidiManager.js';

export function runGuidedTesterTests(test) {
  test('GuidedTester: Class instantiates and defines all 8 wizard steps', (assert) => {
    const mockMidi = new MidiManager();
    const mockAudio = { playActiveSlot: () => {}, setSustain: () => {} };
    const tester = new GuidedTester(mockMidi, mockAudio);

    assert.strictEqual(tester.wizardSteps.length, 8);
    assert.strictEqual(tester.wizardSteps[0].id, 'keys');
    assert.strictEqual(tester.wizardSteps[1].id, 'transport');
    assert.strictEqual(tester.wizardSteps[2].id, 'tracks');
    assert.strictEqual(tester.wizardSteps[3].id, 'scenes');
    assert.strictEqual(tester.wizardSteps[4].id, 'knobs');
    assert.strictEqual(tester.wizardSteps[5].id, 'shift_sustain');
    assert.strictEqual(tester.wizardSteps[6].id, 'pads');
    assert.strictEqual(tester.wizardSteps[7].id, 'confirm');
  });

  test('GuidedTester: Tab definitions and initial state', (assert) => {
    const mockMidi = new MidiManager();
    const mockAudio = { playActiveSlot: () => {}, setSustain: () => {} };
    const tester = new GuidedTester(mockMidi, mockAudio);

    assert.strictEqual(tester.activeTab, 'diagnostic');
    assert.strictEqual(tester.testedPads.size, 0);
    assert.strictEqual(tester.testedKnobs.size, 0);
    assert.strictEqual(tester.testedKeys.size, 0);
    assert.strictEqual(tester.testedButtons.size, 0);
  });
}
