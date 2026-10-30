/**
 * Tests for SampleLibrary presets, polyphonic chord recording, and APC Key 25 arrow navigation.
 */

import { SampleLibrary } from '../src/presets/SampleLibrary.js';
import { StepData } from '../src/sequencer/StepData.js';
import { Sequencer } from '../src/sequencer/Sequencer.js';
import { MidiManager } from '../src/midi/MidiManager.js';

// Minimal mock AudioContext for Node.js test environment
function createMockAudioContext() {
  return {
    sampleRate: 44100,
    currentTime: 1.0,
    createBuffer(channels, length, sampleRate) {
      const dataL = new Float32Array(length);
      const dataR = new Float32Array(length);
      return {
        numberOfChannels: channels,
        length,
        duration: length / sampleRate,
        sampleRate,
        getChannelData(c) { return c === 0 ? dataL : dataR; }
      };
    }
  };
}

export function runLibraryAndPolyphonyTests(test) {
  test('SampleLibrary: Returns comprehensive catalog of melodic and drum presets', (assert) => {
    const melodicList = SampleLibrary.getMelodicPresets();
    const drumList = SampleLibrary.getDrumPresets();

    assert.ok(melodicList.length >= 12, 'Has at least 12 distinct melodic instruments');
    assert.ok(drumList.length >= 5, 'Has at least 5 distinct 16-slice drum kits');

    const names = melodicList.map(p => p.name);
    assert.ok(names.includes('Rhodes Bell'), 'Includes Rhodes Bell');
    assert.ok(names.includes('808 Sub Bass'), 'Includes 808 Sub Bass');
    assert.ok(names.includes('Wurlitzer 200A'), 'Includes Wurlitzer 200A');
    assert.ok(names.includes('Juno Warm Pad'), 'Includes Juno Warm Pad');
    assert.ok(names.includes('Acid 303 Squelch'), 'Includes Acid 303');
  });

  test('SampleLibrary: cyclePreset cycles through presets in both directions', (assert) => {
    const ctx = createMockAudioContext();
    const next1 = SampleLibrary.cyclePreset(ctx, 'Rhodes Bell', 'melodic', 1);
    assert.strictEqual(next1.name, 'Wurlitzer 200A', 'Cycles forward from Rhodes Bell to Wurlitzer 200A');
    assert.ok(next1.buffer.length > 0, 'Generates valid AudioBuffer');

    const prev1 = SampleLibrary.cyclePreset(ctx, 'Wurlitzer 200A', 'melodic', -1);
    assert.strictEqual(prev1.name, 'Rhodes Bell', 'Cycles backward from Wurlitzer 200A to Rhodes Bell');
  });

  test('StepData: Polyphony support with chord notes array and backward compatibility', (assert) => {
    const step = new StepData(true, 60, 110);
    assert.strictEqual(step.noteOrSlice, 60, 'Scalar getter returns first note');
    assert.strictEqual(step.notes.length, 1, 'Notes array initialized with single note');

    // Add chord voices
    step.addNote(64);
    step.addNote(67);
    assert.strictEqual(step.notes.length, 3, 'Chord now has 3 notes (C Major triad)');
    assert.strictEqual(step.notes[0], 60);
    assert.strictEqual(step.notes[1], 64);
    assert.strictEqual(step.notes[2], 67);

    // Backward compatible scalar assignment
    step.noteOrSlice = 72;
    assert.strictEqual(step.notes.length, 1);
    assert.strictEqual(step.noteOrSlice, 72);

    // Cloning preserves chord
    step.addNote(76);
    const cloned = step.clone();
    assert.strictEqual(cloned.notes.length, 2);
    assert.strictEqual(cloned.notes[1], 76);
  });

  test('Sequencer: Polyphonic chord recording records burst notes without dropping voices', (assert) => {
    const mockAudioEngine = {
      ctx: { currentTime: 1.0, state: 'running', resume: async () => {} },
      ensureAudioContext: async () => {},
      slots: new Array(16).fill(null).map(() => ({
        stopAll: () => {},
        type: 'melodic',
        buffer: { duration: 1.5 }
      })),
      playSlotDirect: () => {},
      punchInFx: { setBpm: () => {} },
      masterGain: {}
    };

    const seq = new Sequencer(mockAudioEngine);
    seq.isPlaying = true;
    seq.isRecording = true;
    seq.currentStep = 4;
    seq.nextStepTime = 1.0;

    // Simulate playing a C Major triad (60, 64, 67) simultaneously
    seq.recordHit(0, 60, 100);
    seq.recordHit(0, 64, 105);
    seq.recordHit(0, 67, 110);

    const step = seq.getCurrentPattern().tracks[0][4];
    assert.strictEqual(step.active, true, 'Step is active');
    assert.ok(step.notes.length >= 3, 'Step recorded all 3 chord voices polyphonically');
    assert.strictEqual(step.notes[0], 60);
    assert.strictEqual(step.notes[1], 64);
    assert.strictEqual(step.notes[2], 67);
  });

  test('MidiManager: Arrow buttons navigate UI without shift and cycle samples with shift', (assert) => {
    const midi = new MidiManager();
    const navHits = [];
    const sampleCycleHits = [];
    let knobBankToggled = false;
    let chainAppended = null;

    midi.callbacks.onNavArrow = (dir) => navHits.push(dir);
    midi.callbacks.onSampleCycle = (dir) => sampleCycleHits.push(dir);
    midi.callbacks.onToggleKnobBank = () => { knobBankToggled = true; };
    midi.callbacks.onPatternChainAppend = (idx) => { chainAppended = idx; };

    // 1. Arrows without shift: Notes 64, 65, 66, 67
    midi.handleMidiMessage({ data: [0x90, 64, 127], timeStamp: 100 }); // ▲
    midi.handleMidiMessage({ data: [0x90, 65, 127], timeStamp: 110 }); // ▼
    midi.handleMidiMessage({ data: [0x90, 66, 127], timeStamp: 120 }); // ◄
    midi.handleMidiMessage({ data: [0x90, 67, 127], timeStamp: 130 }); // ►

    assert.strictEqual(navHits.length, 4);
    assert.strictEqual(navHits[0], 'up');
    assert.strictEqual(navHits[1], 'down');
    assert.strictEqual(navHits[2], 'left');
    assert.strictEqual(navHits[3], 'right');

    // 2. Arrows WITH shift (Note 98):
    midi.handleMidiMessage({ data: [0x90, 98, 127], timeStamp: 200 }); // Shift on
    midi.handleMidiMessage({ data: [0x90, 64, 127], timeStamp: 210 }); // Shift + ▲
    midi.handleMidiMessage({ data: [0x90, 65, 127], timeStamp: 220 }); // Shift + ▼
    midi.handleMidiMessage({ data: [0x90, 67, 127], timeStamp: 230 }); // Shift + ►

    assert.strictEqual(sampleCycleHits.length, 2);
    assert.strictEqual(sampleCycleHits[0], 1, 'Shift + ▲ cycles next sample');
    assert.strictEqual(sampleCycleHits[1], -1, 'Shift + ▼ cycles previous sample');
    assert.strictEqual(knobBankToggled, true, 'Shift + ► toggles knob bank');

    // 3. Shift + Pattern Pad (Row 2 / Note 18 = Pad 3):
    // Coordinates in top-down mode: Note 18 is row 2, col 2 (Pattern 3)
    midi.handleMidiMessage({ data: [0x90, 18, 127], timeStamp: 240 });
    assert.strictEqual(chainAppended, 2, 'Shift + Pattern Pad appends pattern index to chain');
  });
}
