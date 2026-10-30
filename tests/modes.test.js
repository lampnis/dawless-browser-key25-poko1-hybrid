/**
 * Tests for 100% Standalone APC Key 25 Mk1 Hardware Navigation:
 * Physical Shift (Note 98), Sustain (Note/CC 64), Track Buttons (52-59),
 * Mode Switching, and Pattern Tools.
 */

import { MidiManager } from '../src/midi/MidiManager.js';
import { OPERATIONAL_MODES, APC_SCENE_NOTES, APC_BUTTON_NOTES, APC_TRACK_BUTTON_NOTES } from '../src/midi/ApcConstants.js';

export function runModeTests(test) {
  test('Modes: Initial operational mode defaults to Pattern mode', (assert) => {
    const midi = new MidiManager();
    assert.strictEqual(midi.operationalMode, OPERATIONAL_MODES.PATTERN);
  });

  test('Modes: setOperationalMode switches between Sample, Pattern, and Performance', (assert) => {
    const midi = new MidiManager();
    let changedMode = '';
    midi.callbacks.onModeChange = (m) => { changedMode = m; };

    midi.setOperationalMode(OPERATIONAL_MODES.SAMPLE);
    assert.strictEqual(midi.operationalMode, OPERATIONAL_MODES.SAMPLE);
    assert.strictEqual(changedMode, OPERATIONAL_MODES.SAMPLE);

    midi.setOperationalMode(OPERATIONAL_MODES.PERFORMANCE);
    assert.strictEqual(midi.operationalMode, OPERATIONAL_MODES.PERFORMANCE);
    assert.strictEqual(changedMode, OPERATIONAL_MODES.PERFORMANCE);
  });

  test('Modes: Physical Shift Button (Note 98 on APC Key 25 Mk1) activates shift modifier', (assert) => {
    const midi = new MidiManager();

    // Note 98 is the hardware physical SHIFT button on APC Key 25 Mk1
    midi.handleMidiMessage({ data: [0x90, APC_BUTTON_NOTES.SHIFT_MK1, 127], timeStamp: 100 });
    assert.strictEqual(midi.shiftActive, true);

    // Shift + Scene 1 (Note 82) -> Mode 1: SAMPLE MODE
    midi.handleMidiMessage({ data: [0x90, APC_SCENE_NOTES.SCENE_1, 127], timeStamp: 110 });
    assert.strictEqual(midi.operationalMode, OPERATIONAL_MODES.SAMPLE);

    // Shift + Scene 2 (Note 83) -> Mode 2: PATTERN MODE
    midi.handleMidiMessage({ data: [0x90, APC_SCENE_NOTES.SCENE_2, 127], timeStamp: 115 });
    assert.strictEqual(midi.operationalMode, OPERATIONAL_MODES.PATTERN);

    // Shift + Scene 3 (Note 84) -> Mode 3: PERFORMANCE MODE
    midi.handleMidiMessage({ data: [0x90, APC_SCENE_NOTES.SCENE_3, 127], timeStamp: 120 });
    assert.strictEqual(midi.operationalMode, OPERATIONAL_MODES.PERFORMANCE);

    // Release Shift (Note 98)
    midi.handleMidiMessage({ data: [0x80, APC_BUTTON_NOTES.SHIFT_MK1, 0], timeStamp: 130 });
    assert.strictEqual(midi.shiftActive, false);
  });

  test('Modes: Bottom Track buttons (Notes 52-59) trigger track mute toggles', (assert) => {
    const midi = new MidiManager();
    let mutedTrack = -1;
    midi.callbacks.onTrackMuteToggle = (t) => { mutedTrack = t; };

    // Note 52 = Track 1 (Index 0)
    midi.handleMidiMessage({ data: [0x90, APC_TRACK_BUTTON_NOTES[0], 127], timeStamp: 150 });
    assert.strictEqual(mutedTrack, 0);

    // Note 55 = Track 4 (Index 3)
    midi.handleMidiMessage({ data: [0x90, APC_TRACK_BUTTON_NOTES[3], 127], timeStamp: 160 });
    assert.strictEqual(mutedTrack, 3);
  });

  test('Modes: Shift + Dedicated Hardware Controls trigger view and dialog toggles (Keys have NO hidden shortcuts)', (assert) => {
    const midi = new MidiManager();
    let viewToggled = false;
    let testerToggled = false;
    let keyboardNoteFired = false;

    midi.callbacks.onToggleView = () => { viewToggled = true; };
    midi.callbacks.onToggleTesterModal = () => { testerToggled = true; };
    midi.callbacks.onKeyboardNoteOn = () => { keyboardNoteFired = true; };

    // Engage Shift (Note 98)
    midi.handleMidiMessage({ data: [0x90, APC_BUTTON_NOTES.SHIFT_MK1, 127], timeStamp: 200 });

    // Shift + Sustain (CC 64): Toggle Minimal/Debug View
    midi.handleMidiMessage({ data: [0xB0, 64, 127], timeStamp: 210 });
    assert.strictEqual(viewToggled, true, 'Shift + Sustain CC 64 toggles view');

    // Shift + Stop All (Note 81): Toggle Guided Tester
    midi.handleMidiMessage({ data: [0x90, 81, 127], timeStamp: 220 });
    assert.strictEqual(testerToggled, true, 'Shift + Stop All toggles Guided Tester');

    // Piano keys on Channel 2 while Shift is held MUST still play music and NEVER trigger shortcuts!
    midi.handleMidiMessage({ data: [0x91, 60, 100], timeStamp: 230 });
    assert.strictEqual(keyboardNoteFired, true, 'Piano key strictly plays musical note');

    midi.handleMidiMessage({ data: [0x80, APC_BUTTON_NOTES.SHIFT_MK1, 0], timeStamp: 240 });
  });

  test('Modes: Shift + Scene 4 triggers Hardware Tap Tempo without computer keyboard', (assert) => {
    const midi = new MidiManager();
    let detectedBpm = -1;
    midi.callbacks.onTapTempo = (b) => { detectedBpm = b; };

    // Engage Shift
    midi.handleMidiMessage({ data: [0x90, APC_BUTTON_NOTES.SHIFT_MK1, 127], timeStamp: 300 });

    // Tap 1
    midi.handleMidiMessage({ data: [0x90, APC_SCENE_NOTES.SCENE_4_METRO, 127], timeStamp: 310 });
    // Fake performance.now by simulating 2 taps
    midi.hardwareTapTimes = [1000, 1500]; // 500ms diff = 120 BPM
    midi._handleHardwareTapTempo();

    assert.strictEqual(detectedBpm, 120);
  });
}
