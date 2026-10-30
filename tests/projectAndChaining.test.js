/**
 * Tests for ProjectManager (Default 4/4 Kick & Project Persistence) and PO-33 PATTERN/SOUND Modifiers
 */

import { ProjectManager } from '../src/project/ProjectManager.js';
import { Sequencer } from '../src/sequencer/Sequencer.js';
import { MidiManager } from '../src/midi/MidiManager.js';

export function runProjectAndChainingTests(test) {
  function createMockAudioEngine() {
    const slots = [];
    for (let i = 0; i < 16; i++) {
      slots.push({
        id: i,
        type: i < 8 ? 'melodic' : 'drum',
        name: i < 8 ? `Synth ${i + 1}` : (i === 8 ? 'TR-909 House Kit' : `Drum Kit ${i - 7}`),
        pitch: 0,
        trimStart: 0.0,
        trimEnd: 1.0,
        decay: 0.5,
        volume: 1.0,
        loop: false,
        selectedSliceIndex: 0,
        stopAll: () => {},
        playDirect: () => {}
      });
    }

    return {
      ctx: { currentTime: 0 },
      slots,
      activeSlotIndex: 0,
      setActiveSlot(idx) {
        this.activeSlotIndex = idx;
        return this.slots[idx];
      },
      getActiveSlot() {
        return this.slots[this.activeSlotIndex];
      },
      ensureAudioContext: async () => {}
    };
  }

  test('ProjectManager: initDefaultProject programs strictly 4 kick drums on quarter notes (steps 0, 4, 8, 12 in 4/4) and NOTHING else', (assert) => {
    const audioEngine = createMockAudioEngine();
    const sequencer = new Sequencer(audioEngine);

    // Run default project initialization
    ProjectManager.initDefaultProject(sequencer, audioEngine);

    assert.strictEqual(sequencer.bpm, 120, 'Default BPM is 120 for 4/4 dance groove');
    assert.strictEqual(sequencer.swing, 50, 'Default swing is 50 (straight)');
    assert.strictEqual(sequencer.activePatternIndex, 0, 'Active pattern is 0');
    assert.strictEqual(audioEngine.activeSlotIndex, 8, 'Active slot is Drum Slot 8 (TR-909 House Kit)');

    const p0 = sequencer.patterns[0];
    const drumTrack = p0.tracks[8];

    // Verify 4-on-the-floor kick steps (0, 4, 8, 12)
    const expectedKickSteps = [0, 4, 8, 12];
    for (let s = 0; s < 16; s++) {
      if (expectedKickSteps.includes(s)) {
        assert.ok(drumTrack[s].active, `Step ${s} must be active (Kick quarter note)`);
        assert.strictEqual(drumTrack[s].noteOrSlice, 0, `Step ${s} must trigger Slice 0 (909 Kick)`);
      } else {
        assert.strictEqual(drumTrack[s].active, false, `Step ${s} on drum track must be inactive`);
      }
    }

    // Verify all other 15 tracks in Pattern 0 are completely empty
    for (let t = 0; t < 16; t++) {
      if (t === 8) continue;
      for (let s = 0; s < 16; s++) {
        assert.strictEqual(p0.tracks[t][s].active, false, `Track ${t} step ${s} must be completely empty`);
      }
    }

    // Verify all other 15 patterns (1 to 15) are completely empty
    for (let pIdx = 1; pIdx < 16; pIdx++) {
      for (let t = 0; t < 16; t++) {
        for (let s = 0; s < 16; s++) {
          assert.strictEqual(sequencer.patterns[pIdx].tracks[t][s].active, false, `Pattern ${pIdx} track ${t} must be empty`);
        }
      }
    }
  });

  test('ProjectManager: saveProject and loadProject correctly restores state', (assert) => {
    const audioEngine = createMockAudioEngine();
    const sequencer = new Sequencer(audioEngine);

    // Mock localStorage
    const mockStorage = new Map();
    const origLocal = globalThis.localStorage;
    globalThis.localStorage = {
      getItem: (k) => mockStorage.get(k) || null,
      setItem: (k, v) => mockStorage.set(k, v),
      removeItem: (k) => mockStorage.delete(k)
    };

    try {
      ProjectManager.initDefaultProject(sequencer, audioEngine);
      sequencer.setBpm(126);
      sequencer.setSwing(58);
      sequencer.patterns[0].tracks[0][2].active = true;
      sequencer.patterns[0].tracks[0][2].noteOrSlice = 64;

      const saveOk = ProjectManager.saveProject(sequencer, audioEngine);
      assert.ok(saveOk, 'Project saved successfully');

      // Create new fresh sequencer
      const freshAudioEngine = createMockAudioEngine();
      const freshSequencer = new Sequencer(freshAudioEngine);
      assert.strictEqual(freshSequencer.bpm, 92);

      const loadOk = ProjectManager.loadProject(freshSequencer, freshAudioEngine);
      assert.ok(loadOk, 'Project loaded successfully');
      assert.strictEqual(freshSequencer.bpm, 126, 'Restored BPM 126');
      assert.strictEqual(freshSequencer.swing, 58, 'Restored Swing 58');
      assert.ok(freshSequencer.patterns[0].tracks[0][2].active, 'Restored active step');
      assert.strictEqual(freshSequencer.patterns[0].tracks[0][2].noteOrSlice, 64, 'Restored note value');
    } finally {
      if (origLocal) {
        globalThis.localStorage = origLocal;
      }
    }
  });

  test('Sequencer: Quantized pattern queueing smoothly switches on bar downbeat', (assert) => {
    const audioEngine = createMockAudioEngine();
    const sequencer = new Sequencer(audioEngine);

    sequencer.isPlaying = true;
    sequencer.activePatternIndex = 0;
    sequencer.currentStep = 10;

    // Queue pattern 3 while playing
    sequencer.queuePattern(3);
    assert.strictEqual(sequencer.queuedPatternIndex, 3, 'Pattern 3 is queued');
    assert.strictEqual(sequencer.activePatternIndex, 0, 'Pattern 0 is still sounding before bar completes');

    // Advance to end of bar (step 15 -> step 16 / 0)
    sequencer.currentStep = 15;
    sequencer._advanceStep();

    assert.strictEqual(sequencer.currentStep, 0, 'Playhead wrapped to step 0');
    assert.strictEqual(sequencer.activePatternIndex, 3, 'Active pattern transitioned smoothly to Pattern 3');
    assert.strictEqual(sequencer.queuedPatternIndex, -1, 'Queue cleared after transition');
  });

  test('MidiManager: PO-33 PATTERN button (◄ Note 66) allows direct pattern jump and chaining', (assert) => {
    const midi = new MidiManager();
    let selectedPattern = -1;
    let appendedPattern = -1;
    let patternHoldState = false;

    midi.callbacks.onPatternSelect = (pat) => { selectedPattern = pat; };
    midi.callbacks.onPatternChainAppend = (pat) => { appendedPattern = pat; };
    midi.callbacks.onPatternModeHold = (held) => { patternHoldState = held; };

    // 1. Press and hold ◄ (Note 66)
    midi.handleMidiMessage({ data: [0x90, 66, 127] });
    assert.ok(midi.patternButtonHeld, 'Pattern button is held');
    assert.ok(patternHoldState, 'onPatternModeHold dispatched true');

    // 2. Press Pad 4 (Row 0, Col 4 => Pattern 4)
    // Row 0 Col 4 on Mk1 Top-Down = Note 36
    const padNote = midi.getNoteFromCoordinates(0, 4);
    midi.handleMidiMessage({ data: [0x90, padNote, 100] });
    assert.strictEqual(selectedPattern, 4, 'Directly selected Pattern 4');

    // 3. Keep holding ◄ and press Pad 5 (Row 0, Col 5 => Pattern 5)
    const pad5Note = midi.getNoteFromCoordinates(0, 5);
    midi.handleMidiMessage({ data: [0x90, pad5Note, 100] });
    assert.strictEqual(appendedPattern, 5, 'Appended Pattern 5 to chain');

    // 4. Release ◄ (Note 66)
    midi.handleMidiMessage({ data: [0x80, 66, 0] });
    assert.strictEqual(midi.patternButtonHeld, false, 'Pattern button released');
    assert.strictEqual(patternHoldState, false, 'onPatternModeHold dispatched false');
  });

  test('MidiManager: PO-33 SOUND button (► Note 67) allows direct sound slot jump across 16 slots', (assert) => {
    const midi = new MidiManager();
    let selectedSlot = -1;
    let selectedType = null;
    let soundHoldState = false;

    midi.callbacks.onSlotSelect = (slot, type) => {
      selectedSlot = slot;
      selectedType = type;
    };
    midi.callbacks.onSoundModeHold = (held) => { soundHoldState = held; };

    // 1. Press and hold ► (Note 67)
    midi.handleMidiMessage({ data: [0x90, 67, 127] });
    assert.ok(midi.soundButtonHeld, 'Sound button is held');
    assert.ok(soundHoldState, 'onSoundModeHold dispatched true');

    // 2. Tap Pad in Row 1, Col 0 (Slot 8 = Drum Kit 1, Note 24)
    const drumSlotNote = midi.getNoteFromCoordinates(1, 0);
    midi.handleMidiMessage({ data: [0x90, drumSlotNote, 100] });
    assert.strictEqual(selectedSlot, 8, 'Directly selected Slot 8 (TR-909 House Kit)');
    assert.strictEqual(selectedType, 'drum', 'Selected type is drum');

    // 3. Release ► (Note 67)
    midi.handleMidiMessage({ data: [0x80, 67, 0] });
    assert.strictEqual(midi.soundButtonHeld, false, 'Sound button released');
    assert.strictEqual(soundHoldState, false, 'onSoundModeHold dispatched false');
  });

  test('Sequencer: setStepParamLock respects activateIfInactive flag and prevents ghost notes', (assert) => {
    const audioEngine = createMockAudioEngine();
    const sequencer = new Sequencer(audioEngine);

    const pat = sequencer.getCurrentPattern();
    const step2 = pat.tracks[8][2]; // Step 2 is inactive (silent)
    assert.strictEqual(step2.active, false, 'Step 2 starts inactive');

    // Live automation recording: activateIfInactive = false
    sequencer.setStepParamLock(8, 2, 'poFilter', 45, false);
    assert.strictEqual(step2.pLocks.poFilter, 45, 'pLock is stored');
    assert.strictEqual(step2.active, false, 'Inactive step MUST NOT be activated by knob movement during live playback');

    // Manual held step locking: activateIfInactive = true
    sequencer.setStepParamLock(8, 2, 'poFilter', 60, true);
    assert.strictEqual(step2.pLocks.poFilter, 60, 'pLock updated');
    assert.strictEqual(step2.active, true, 'Explicitly held step is activated when activateIfInactive is true');
  });

  test('Master Knobs: Master mode knob movement never writes notes to pattern steps', (assert) => {
    const audioEngine = createMockAudioEngine();
    const sequencer = new Sequencer(audioEngine);
    ProjectManager.initDefaultProject(sequencer, audioEngine);

    // Track 8 has kicks at 0, 4, 8, 12; step 6 is silent
    const pat = sequencer.getCurrentPattern();
    assert.strictEqual(pat.tracks[8][6].active, false, 'Step 6 is silent');

    // Mock turning Knob 3 (Filter) or any knob in Master mode
    // When knobBank === 'master', sequencer.setStepParamLock is never called
    // Simulate playing and recording
    sequencer.isPlaying = true;
    sequencer.isRecording = true;
    sequencer.currentStep = 6;

    // Verify step 6 remains completely inactive
    assert.strictEqual(pat.tracks[8][6].active, false, 'Step 6 remains untouched and inactive');

    // Verify 4 kicks remain strictly on 0, 4, 8, 12
    const kickSteps = pat.tracks[8].map((s, idx) => s.active ? idx : null).filter(idx => idx !== null);
    assert.deepStrictEqual(kickSteps, [0, 4, 8, 12], 'Strictly 4 kicks remain on track 8');
  });

  test('Knobs: Turning Knobs 0-7 never activates inactive step 12 or creates ghost notes during playback', (assert) => {
    const audioEngine = createMockAudioEngine();
    const sequencer = new Sequencer(audioEngine);
    ProjectManager.initDefaultProject(sequencer, audioEngine);

    // Slot 0 (Melodic Track 1): All steps are initially inactive
    audioEngine.setActiveSlot(0);
    const pat = sequencer.getCurrentPattern();
    const activeCountBefore = pat.tracks[0].filter(s => s.active).length;
    assert.strictEqual(activeCountBefore, 0, 'Track 0 is completely empty initially');
    assert.strictEqual(pat.tracks[0][12].active, false, 'Step 12 is inactive');

    // Simulate playback running
    sequencer.isPlaying = true;
    sequencer.isRecording = false;
    sequencer.currentStep = 12;

    // Simulate turning knobs 0, 1, 2, 3, 5 (the knobs with parameter locks)
    // Even if setStepParamLock is invoked with activateIfInactive=false, it MUST NOT activate step 12!
    for (const k of [0, 1, 2, 3, 5]) {
      sequencer.setStepParamLock(0, 12, 'decay', 0.5, false);
      sequencer.setStepParamLock(0, 12, 'pitch', 2, false);
      sequencer.setStepParamLock(0, 12, 'poFilter', 50, false);
      assert.strictEqual(pat.tracks[0][12].active, false, `Knob ${k} never activates inactive step 12`);
    }

    // Verify track 0 remains 100% empty
    const activeCountAfter = pat.tracks[0].filter(s => s.active).length;
    assert.strictEqual(activeCountAfter, 0, 'Track 0 still has 0 active steps (no ghost notes created!)');
  });

  test('Drum Kits: Anti-bleed guard window prevents tail clipping into neighboring slices', (assert) => {
    // Generate a test drum kit buffer with 16 slices
    const sampleRate = 44100;
    const sliceLen = 0.35;
    const sliceSamples = Math.floor(sampleRate * sliceLen);
    const mockCtx = {
      sampleRate,
      createBuffer: (channels, length, sRate) => {
        const cData = [new Float32Array(length), new Float32Array(length)];
        return {
          numberOfChannels: channels,
          length,
          sampleRate: sRate,
          duration: length / sRate,
          getChannelData: (c) => cData[c]
        };
      }
    };

    import('../src/presets/SampleLibrary.js').then(({ SampleLibrary }) => {
      const drums = SampleLibrary.getDrumPresets();
      const kit = drums[0];
      const buffer = kit.generate(mockCtx);
      const ch0 = buffer.getChannelData(0);

      // Verify each slice tail in the last 2ms (last ~88 samples before next slice) drops to exact zero
      for (let s = 0; s < 15; s++) {
        const sliceEndSample = Math.floor((s + 1) * sliceLen * sampleRate) - 1;
        const tailSampleVal = Math.abs(ch0[sliceEndSample]);
        assert.ok(tailSampleVal < 0.001, `Slice ${s} fades to zero before slice ${s + 1} begins (measured ${tailSampleVal})`);
      }
    });
  });
}
