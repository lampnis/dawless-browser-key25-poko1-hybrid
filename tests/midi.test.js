/**
 * Tests for APC Key 25 MIDI protocols, note-to-pad mappings, CCs, and LED velocity codes.
 */

import { MidiManager } from '../src/midi/MidiManager.js';
import {
  APC_MK1_LEDS,
  APC_MK2_LEDS,
  APC_KNOB_CCS_MK1,
  APC_SCENE_NOTES,
  GRID_LAYOUT_MODES
} from '../src/midi/ApcConstants.js';

export function runMidiTests(test) {
  test('ApcConstants: MK1 LED Velocity values are correct', (assert) => {
    assert.strictEqual(APC_MK1_LEDS.OFF, 0);
    assert.strictEqual(APC_MK1_LEDS.GREEN, 1);
    assert.strictEqual(APC_MK1_LEDS.GREEN_BLINK, 2);
    assert.strictEqual(APC_MK1_LEDS.RED, 3);
    assert.strictEqual(APC_MK1_LEDS.RED_BLINK, 4);
    assert.strictEqual(APC_MK1_LEDS.AMBER, 5);
    assert.strictEqual(APC_MK1_LEDS.AMBER_BLINK, 6);
  });

  test('ApcConstants: Continuous Knobs CC numbers match APC Key 25 Mk1', (assert) => {
    assert.strictEqual(APC_KNOB_CCS_MK1.K1_START, 48);
    assert.strictEqual(APC_KNOB_CCS_MK1.K2_END, 49);
    assert.strictEqual(APC_KNOB_CCS_MK1.K3_PITCH, 50);
    assert.strictEqual(APC_KNOB_CCS_MK1.K4_FILTER, 51);
    assert.strictEqual(APC_KNOB_CCS_MK1.K5_RES, 52);
    assert.strictEqual(APC_KNOB_CCS_MK1.K6_DECAY, 53);
    assert.strictEqual(APC_KNOB_CCS_MK1.K7_FX_SEND, 54);
    assert.strictEqual(APC_KNOB_CCS_MK1.K8_COMP_VOL, 55);
  });

  test('MidiManager: Top-Down coordinates mapping translates hardware notes correctly', (assert) => {
    const midi = new MidiManager({ layoutMode: GRID_LAYOUT_MODES.TOP_DOWN });

    // In top-down mode:
    // Physical row 4 (notes 32-39) is visual row 0 (Steps 1-8)
    const p32 = midi.getPadCoordinates(32);
    assert.strictEqual(p32.row, 0);
    assert.strictEqual(p32.col, 0);

    const p39 = midi.getPadCoordinates(39);
    assert.strictEqual(p39.row, 0);
    assert.strictEqual(p39.col, 7);

    // Physical row 3 (notes 24-31) is visual row 1 (Steps 9-16)
    const p24 = midi.getPadCoordinates(24);
    assert.strictEqual(p24.row, 1);
    assert.strictEqual(p24.col, 0);

    // Physical row 0 (notes 0-7) is visual row 4 (Punch-in FX)
    const p0 = midi.getPadCoordinates(0);
    assert.strictEqual(p0.row, 4);
    assert.strictEqual(p0.col, 0);

    // Reverse lookup
    assert.strictEqual(midi.getNoteFromCoordinates(0, 0), 32);
    assert.strictEqual(midi.getNoteFromCoordinates(4, 0), 0);
  });

  test('MidiManager: Bottom-Up coordinates mapping translates hardware notes correctly', (assert) => {
    const midi = new MidiManager({ layoutMode: GRID_LAYOUT_MODES.BOTTOM_UP });

    const p0 = midi.getPadCoordinates(0);
    assert.strictEqual(p0.row, 0);
    assert.strictEqual(p0.col, 0);

    const p39 = midi.getPadCoordinates(39);
    assert.strictEqual(p39.row, 4);
    assert.strictEqual(p39.col, 7);

    assert.strictEqual(midi.getNoteFromCoordinates(0, 0), 0);
    assert.strictEqual(midi.getNoteFromCoordinates(4, 7), 39);
  });

  test('MidiManager: Dispatches Step Toggle and Hold callbacks on pad press', (assert) => {
    const midi = new MidiManager({ layoutMode: GRID_LAYOUT_MODES.TOP_DOWN });
    let toggledStep = -1;
    let heldStep = -1;
    let heldState = false;

    midi.callbacks.onStepToggle = (step, vel) => { toggledStep = step; };
    midi.callbacks.onStepHold = (step, state) => { heldStep = step; heldState = state; };

    // Note 32 = Row 0, Col 0 = Step 0
    midi.handleMidiMessage({ data: [0x90, 32, 100], timeStamp: 100 });
    assert.strictEqual(toggledStep, 0);
    assert.strictEqual(heldStep, 0);
    assert.strictEqual(heldState, true);

    // Note 32 release (velocity 0 or Note Off)
    midi.handleMidiMessage({ data: [0x80, 32, 0], timeStamp: 200 });
    assert.strictEqual(heldState, false);
  });

  test('MidiManager: Dispatches Macro Knob CC events correctly', (assert) => {
    const midi = new MidiManager();
    let receivedKnob = -1;
    let receivedVal = -1;
    let receivedParam = '';

    midi.callbacks.onMacroKnob = (knob, val, param) => {
      receivedKnob = knob;
      receivedVal = val;
      receivedParam = param;
    };

    // CC 51 (Knob 4: poFilter) with value 90
    midi.handleMidiMessage({ data: [0xB0, 51, 90], timeStamp: 300 });
    assert.strictEqual(receivedKnob, 3);
    assert.strictEqual(receivedVal, 90);
    assert.strictEqual(receivedParam, 'poFilter');
  });

  test('MidiManager: Scene button notes trigger expected scene actions', (assert) => {
    const midi = new MidiManager();
    let triggeredScene = -1;

    midi.callbacks.onSceneButton = (scIdx, isPressed) => {
      if (isPressed) triggeredScene = scIdx;
    };

    // Note 82 = Scene 1 (Play/Stop)
    midi.handleMidiMessage({ data: [0x90, APC_SCENE_NOTES.SCENE_1_PLAY, 127], timeStamp: 400 });
    assert.strictEqual(triggeredScene, 1);

    // Note 83 = Scene 2 (Record Enable)
    midi.handleMidiMessage({ data: [0x90, APC_SCENE_NOTES.SCENE_2_REC, 127], timeStamp: 450 });
    assert.strictEqual(triggeredScene, 2);
  });

  test('MidiManager: Channel 2 Keybed Isolation guarantees keys never trigger pads or track mutes', (assert) => {
    const midi = new MidiManager({ layoutMode: GRID_LAYOUT_MODES.TOP_DOWN });
    let keyboardNote = -1;
    let trackMuteHit = false;
    let stepToggleHit = false;

    midi.callbacks.onKeyboardNoteOn = (note, vel) => {
      keyboardNote = note;
    };
    midi.callbacks.onTrackMuteToggle = () => {
      trackMuteHit = true;
    };
    midi.callbacks.onStepToggle = () => {
      stepToggleHit = true;
    };

    // 1. Channel 2 Note On with Note 64 (which would be Track 1 [▲] on Channel 1)
    // Status byte 0x91 is Note On, Channel 2
    midi.handleMidiMessage({ data: [0x91, 64, 105], timeStamp: 500 });
    assert.strictEqual(keyboardNote, 64, 'Keybed Note 64 received by keyboard callback');
    assert.strictEqual(trackMuteHit, false, 'Track mute was NOT triggered by keybed Note 64');

    // 2. Channel 2 Note On with Note 32 (which would be Step 0 Pad on Channel 1)
    midi.handleMidiMessage({ data: [0x91, 32, 98], timeStamp: 520 });
    assert.strictEqual(keyboardNote, 32, 'Keybed Note 32 received by keyboard callback');
    assert.strictEqual(stepToggleHit, false, 'Sequencer step was NOT triggered by keybed Note 32');

    // 3. Contrast: Channel 1 Note On with Note 64 SHOULD trigger Track 1 mute (Up button [▲])
    midi.handleMidiMessage({ data: [0x90, 64, 127], timeStamp: 540 });
    assert.strictEqual(trackMuteHit, true, 'Channel 1 Note 64 properly toggles Track 1 mute');
  });

  test('MidiManager: Piano keys strictly play notes and have NO hidden functions (even with Shift)', (assert) => {
    const midi = new MidiManager();
    let keyboardNote = -1;
    let modalActionTriggered = false;

    midi.callbacks.onKeyboardNoteOn = (note, vel) => {
      keyboardNote = note;
    };
    midi.callbacks.onToggleTesterModal = () => { modalActionTriggered = true; };
    midi.callbacks.onToggleView = () => { modalActionTriggered = true; };

    // Engage physical Shift (Note 98 on Channel 1)
    midi.handleMidiMessage({ data: [0x90, 98, 127], timeStamp: 600 });
    assert.strictEqual(midi.shiftActive, true);

    // Press key Note 60 on Channel 2 (Piano Keybed) while holding Shift
    midi.handleMidiMessage({ data: [0x91, 60, 100], timeStamp: 610 });
    assert.strictEqual(keyboardNote, 60, 'Keybed Note 60 is played musically');
    assert.strictEqual(modalActionTriggered, false, 'No hidden modal was triggered by piano key');
  });

  test('MidiManager: Sustain, Octave, and Shift + Dedicated Buttons behave consistently across modes', (assert) => {
    const midi = new MidiManager();
    let sustainState = false;
    let octaveReported = -1;
    let testerToggled = false;
    let viewToggled = false;
    let keyboardNoteFired = false;

    midi.callbacks.onKeyboardNoteOn = () => { keyboardNoteFired = true; };
    midi.callbacks.onSustainChange = (active) => { sustainState = active; };
    midi.callbacks.onOctaveChange = (baseNote) => { octaveReported = baseNote; };
    midi.callbacks.onToggleTesterModal = () => { testerToggled = true; };
    midi.callbacks.onToggleView = () => { viewToggled = true; };

    // 1. Normal Sustain Press via CC 64 (Physical SUSTAIN button transmits CC 64)
    midi.handleMidiMessage({ data: [0xB0, 64, 127], timeStamp: 700 });
    assert.strictEqual(sustainState, true, 'Sustain is active on CC 64 Value 127');
    midi.handleMidiMessage({ data: [0xB0, 64, 0], timeStamp: 710 });
    assert.strictEqual(sustainState, false, 'Sustain is inactive on CC 64 Value 0');

    // 2. Physical Transport: Play/Pause (Note 91) & Rec (Note 93)
    let playPauseFired = false;
    let recToggleFired = false;
    midi.callbacks.onTransportPlayPause = () => { playPauseFired = true; };
    midi.callbacks.onRecordToggle = () => { recToggleFired = true; };

    midi.handleMidiMessage({ data: [0x90, 91, 127], timeStamp: 720 });
    assert.strictEqual(playPauseFired, true, 'Note 91 fires onTransportPlayPause');
    assert.strictEqual(keyboardNoteFired, false, 'Note 91 does NOT fire piano note');

    midi.handleMidiMessage({ data: [0x90, 93, 127], timeStamp: 730 });
    assert.strictEqual(recToggleFired, true, 'Note 93 fires onRecordToggle');
    assert.strictEqual(keyboardNoteFired, false, 'Note 93 does NOT fire piano note');

    // 3. Holding Shift + Sustain (CC 64) toggles view mode
    midi.handleMidiMessage({ data: [0x90, 98, 127], timeStamp: 740 }); // Shift on
    midi.handleMidiMessage({ data: [0xB0, 64, 127], timeStamp: 750 }); // Shift + Sustain
    assert.strictEqual(viewToggled, true, 'Shift + Sustain toggles Minimal / Debug view');

    // 4. Holding Shift + Stop All toggles Guided Tester
    midi.handleMidiMessage({ data: [0x90, 81, 127], timeStamp: 760 }); // Shift + Stop All
    assert.strictEqual(testerToggled, true, 'Shift + Stop All toggles Guided Tester');

    // 5. Shift + Scene 1, 2, 3 switches modes cleanly in exact 1, 2, 3 order:
    // Shift + Scene 1 (Note 82) = Sample Mode
    // Shift + Scene 2 (Note 83) = Pattern Mode
    // Shift + Scene 3 (Note 84) = Performance Mode
    midi.handleMidiMessage({ data: [0x90, 82, 127], timeStamp: 770 }); // Shift + Scene 1
    assert.strictEqual(midi.operationalMode, 'sample', 'Shift + Scene 1 switches to Sample Mode');
    midi.handleMidiMessage({ data: [0x90, 83, 127], timeStamp: 780 }); // Shift + Scene 2
    assert.strictEqual(midi.operationalMode, 'pattern', 'Shift + Scene 2 switches to Pattern Mode');
    midi.handleMidiMessage({ data: [0x90, 84, 127], timeStamp: 790 }); // Shift + Scene 3
    assert.strictEqual(midi.operationalMode, 'performance', 'Shift + Scene 3 switches to Performance Mode');
  });

  test('MidiManager: Bottom row buttons 64-71 correctly map to all 8 tracks', (assert) => {
    const midi = new MidiManager();
    const toggledTracks = [];
    midi.callbacks.onTrackMuteToggle = (trackIdx) => {
      toggledTracks.push(trackIdx);
    };

    // Notes 64, 65, 66, 67, 68, 69, 70, 71 (▲, ▼, ◄, ►, VOLUME, PAN, SEND, DEVICE)
    for (let note = 64; note <= 71; note++) {
      midi.handleMidiMessage({ data: [0x90, note, 127], timeStamp: 800 + note });
    }

    assert.strictEqual(toggledTracks.length, 8);
    for (let i = 0; i < 8; i++) {
      assert.strictEqual(toggledTracks[i], i, `Button ${64 + i} toggled track ${i}`);
    }
  });
}
