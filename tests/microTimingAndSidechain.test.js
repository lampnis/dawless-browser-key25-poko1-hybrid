/**
 * Open-KO: Micro-Timing, 8x Zoom, Freeform Auto-BPM, Sidechain Ducking, and Punch-In FX Tests
 */

import { Pattern, StepData } from '../src/sequencer/StepData.js';
import { Sequencer } from '../src/sequencer/Sequencer.js';
import { AudioEngine } from '../src/audio/AudioEngine.js';
import { PunchInFX } from '../src/audio/PunchInFX.js';
import { ProjectManager, PROJECT_STORAGE_KEY } from '../src/project/ProjectManager.js';
import { MidiManager } from '../src/midi/MidiManager.js';
import { AudioExporter } from '../src/audio/AudioExporter.js';

function createMockAudioContext() {
  return {
    sampleRate: 44100,
    currentTime: 1.0,
    state: 'running',
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
    },
    createDelay() {
      return { delayTime: { value: 0.28, setTargetAtTime: () => {}, setValueAtTime: () => {}, linearRampToValueAtTime: () => {}, cancelScheduledValues: () => {} }, connect: () => {} };
    },
    createGain() {
      return {
        gain: {
          value: 1.0,
          setTargetAtTime: () => {},
          linearRampToValueAtTime: () => {},
          setValueAtTime: () => {},
          exponentialRampToValueAtTime: () => {},
          cancelScheduledValues: () => {}
        },
        connect: () => {}
      };
    },
    createBiquadFilter() {
      return {
        type: 'lowpass',
        frequency: {
          value: 1600,
          setTargetAtTime: () => {},
          setValueAtTime: () => {},
          exponentialRampToValueAtTime: () => {},
          cancelScheduledValues: () => {}
        },
        Q: { value: 0.707, setTargetAtTime: () => {} },
        connect: () => {}
      };
    },
    createWaveShaper() {
      return { curve: null, connect: () => {} };
    },
    createDynamicsCompressor() {
      return {
        threshold: { value: -18, setTargetAtTime: () => {} },
        knee: { value: 12 },
        ratio: { value: 4, setTargetAtTime: () => {} },
        attack: { value: 0.005 },
        release: { value: 0.12 },
        connect: () => {}
      };
    },
    createAnalyser() {
      return { fftSize: 512, connect: () => {} };
    },
    destination: {}
  };
}

export function runMicroTimingAndSidechainTests(test) {
  test('StepData: 128th-note microTiming clamps between -4 and +3 sub-ticks and clones accurately', (assert) => {
    const step = new StepData(true, 60, 100, 2);
    assert.strictEqual(step.microTiming, 2, 'Initial microTiming set to +2 ticks');

    step.setMicroTiming(10);
    assert.strictEqual(step.microTiming, 3, 'microTiming clamps to upper bound +3');

    step.setMicroTiming(-10);
    assert.strictEqual(step.microTiming, -4, 'microTiming clamps to lower bound -4');

    step.nudge(2);
    assert.strictEqual(step.microTiming, -2, 'nudge(-4 + 2) = -2');

    const copy = step.clone();
    assert.strictEqual(copy.microTiming, -2, 'Clone preserves microTiming');
    assert.strictEqual(copy.velocity, 100);
    assert.strictEqual(copy.noteOrSlice, 60);
  });

  test('Pattern: Supports 8x zoom (128 steps, 128th-note grid) with 8 pages of 16 steps', (assert) => {
    const pat = new Pattern(0, 1);
    assert.strictEqual(pat.zoom, 1);
    assert.strictEqual(pat.length, 16);

    pat.setZoom(8);
    assert.strictEqual(pat.zoom, 8, 'Zoom is 8x');
    assert.strictEqual(pat.length, 128, 'Pattern length expanded to 128 steps (128th notes)');
    assert.strictEqual(pat.tracks[0].length, 128, 'All 16 tracks have 128 steps');
  });

  test('Pattern: Canonical tick math preserves exact musical timing (positive & negative micro-timing) across zoom 1x <-> 8x', (assert) => {
    const pat = new Pattern(0, 1);
    const drumTrack = pat.tracks[8];

    // Put a kick at Step 0 (tick 0), Snare at Step 4 +1 tick (tick 33), and Hat at Step 8 -2 ticks (tick 62)
    drumTrack[0].active = true;
    drumTrack[0].noteOrSlice = 0;
    drumTrack[4].active = true;
    drumTrack[4].noteOrSlice = 2;
    drumTrack[4].setMicroTiming(1); // tick 32 + 1 = tick 33
    drumTrack[8].active = true;
    drumTrack[8].noteOrSlice = 4;
    drumTrack[8].setMicroTiming(-2); // tick 64 - 2 = tick 62

    // Zoom in to 8x (128 steps, each step is 1 tick)
    pat.setZoom(8);
    assert.strictEqual(pat.length, 128);
    assert.ok(pat.tracks[8][0].active, 'Step 0 is active at tick 0');
    assert.ok(pat.tracks[8][33].active, 'Step 33 is active (tick 32 + 1 micro-timing)');
    assert.ok(pat.tracks[8][62].active, 'Step 62 is active (tick 64 - 2 micro-timing)');

    // Zoom back to 1x (16 steps)
    pat.setZoom(1);
    assert.strictEqual(pat.length, 16);
    assert.ok(pat.tracks[8][0].active, 'Step 0 preserved');
    assert.ok(pat.tracks[8][4].active, 'Step 4 preserved');
    assert.strictEqual(pat.tracks[8][4].microTiming, 1, 'Micro-timing +1 preserved on zoom-out');
    assert.ok(pat.tracks[8][8].active, 'Step 8 preserved');
    assert.strictEqual(pat.tracks[8][8].microTiming, -2, 'Negative micro-timing -2 preserved on zoom-out');
  });

  test('Pattern.nudgeStep: Seamlessly nudges across 128th sub-ticks and crosses step boundaries cleanly', (assert) => {
    const pat = new Pattern(0, 1);
    pat.tracks[0][4].active = true;
    pat.tracks[0][4].noteOrSlice = 64;
    pat.tracks[0][4].setMicroTiming(3); // Maximum late sub-tick on Step 4

    // Nudge +1 tick: should cross seamlessly into Step 5 at microTiming -4
    const forward = pat.nudgeStep(0, 4, 1);
    assert.strictEqual(forward.newStep, 5, 'Crossed forward into Step 5');
    assert.strictEqual(forward.microTiming, -4, 'Entered Step 5 at -4/128th');
    assert.strictEqual(pat.tracks[0][4].active, false, 'Old Step 4 deactivated');
    assert.strictEqual(pat.tracks[0][5].active, true, 'New Step 5 activated');
    assert.strictEqual(pat.tracks[0][5].noteOrSlice, 64, 'Note pitch 64 preserved across boundary');

    // Nudge -1 tick: should cross seamlessly back into Step 4 at microTiming +3
    const backward = pat.nudgeStep(0, 5, -1);
    assert.strictEqual(backward.newStep, 4, 'Crossed backward into Step 4');
    assert.strictEqual(backward.microTiming, 3, 'Returned to Step 4 at +3/128th');
    assert.strictEqual(pat.tracks[0][5].active, false, 'Step 5 deactivated');
    assert.strictEqual(pat.tracks[0][4].active, true, 'Step 4 re-activated');
  });

  test('Sequencer: Freeform first-loop recording auto-detects tempo and maps to 128th grid', async (assert) => {
    const mockCtx = createMockAudioContext();
    const mockEngine = {
      ctx: mockCtx,
      ensureAudioContext: async () => {},
      playSlotDirect: () => {},
      slots: new Array(16).fill(null).map((_, i) => ({
        type: i < 8 ? 'melodic' : 'drum',
        stopAll: () => {},
        buffer: { duration: 1.0 }
      })),
      punchInFx: { setBpm: () => {} }
    };

    const seq = new Sequencer(mockEngine);
    assert.strictEqual(seq.recordMode, 'freeform', 'Default record mode is freeform');

    // Arm freeform recording
    await seq.toggleRecord();
    assert.strictEqual(seq.isRecording, true);
    assert.strictEqual(seq.isWaitingForFirstHit, true);

    // First note strike: begins timer t=0
    seq.handleLiveHit(8, 0, 100);
    assert.strictEqual(seq.isWaitingForFirstHit, false);
    assert.strictEqual(seq.freeformEvents.length, 1);
    assert.strictEqual(seq.freeformEvents[0].time, 0.0);

    // Simulate hits in a 1-bar hip-hop groove of total duration ~2.608s (92 BPM)
    // Beat 2 (quarter note): ~0.652s
    seq.freeformEvents.push({ slotIndex: 8, noteOrSlice: 2, velocity: 95, time: 0.652 });
    // Beat 3 (quarter note): ~1.304s
    seq.freeformEvents.push({ slotIndex: 8, noteOrSlice: 0, velocity: 105, time: 1.304 });
    // Beat 4 (slightly laid-back Dilla snare +2/128th late: 1.9565 + 2*(2.6087/128) = 1.997s)
    seq.freeformEvents.push({ slotIndex: 8, noteOrSlice: 2, velocity: 98, time: 1.997 });

    // Close the freeform loop at duration 2.61s
    const res = seq._finishFreeformLoop(2.61);
    assert.ok(res !== null);
    assert.strictEqual(res.bpm, 92, 'Auto-detected 92 BPM from 2.61s loop duration');
    assert.strictEqual(res.barCount, 1, 'Detected 1 bar');

    // Check pattern steps on 128th grid
    const drumTrack = seq.getCurrentPattern().tracks[8];
    assert.ok(drumTrack[0].active, 'Step 0 active (Beat 1)');
    assert.strictEqual(drumTrack[0].microTiming, 0, 'Beat 1 downbeat has 0 micro-timing offset');
    assert.ok(drumTrack[4].active, 'Step 4 active (Beat 2)');
    assert.deepStrictEqual(drumTrack[4].notes, [2], 'Beat 2 triggers pure Snare slice 2 without stray Kick 0');
    assert.strictEqual(drumTrack[4].microTiming, 0, 'Beat 2 has 0 micro-timing offset');
    assert.ok(drumTrack[8].active, 'Step 8 active (Beat 3)');
    assert.ok(drumTrack[12].active, 'Step 12 active (Beat 4)');
    assert.strictEqual(drumTrack[12].microTiming, 2, 'Laid-back Beat 4 snare captured with +2/128th micro-timing');

    seq.stopAndReset();
  });

  test('AudioEngine: Sidechain Ducking Compressor initializes and triggers ducking envelope', (assert) => {
    const mockCtx = createMockAudioContext();
    const engine = {
      ctx: mockCtx,
      sidechainEnabled: true,
      sidechainSource: 8,
      sidechainDepth: 0.65,
      sidechainRelease: 0.18,
      sidechainGain: mockCtx.createGain(),
      triggerSidechainDuck: AudioEngine.prototype.triggerSidechainDuck,
      setSidechainDepth: AudioEngine.prototype.setSidechainDepth,
      setSidechainRelease: AudioEngine.prototype.setSidechainRelease,
      toggleSidechain: AudioEngine.prototype.toggleSidechain
    };

    assert.strictEqual(engine.sidechainEnabled, true);
    assert.strictEqual(engine.sidechainSource, 8, 'Default sidechain source is Track 9 (Kick)');
    assert.strictEqual(engine.sidechainDepth, 0.65, 'Default sidechain depth is 65%');

    // Test parameter setters
    engine.setSidechainDepth(0.85);
    assert.strictEqual(engine.sidechainDepth, 0.85);

    engine.setSidechainRelease(0.24);
    assert.strictEqual(engine.sidechainRelease, 0.24);

    const toggled = engine.toggleSidechain();
    assert.strictEqual(toggled, false);
    assert.strictEqual(engine.sidechainEnabled, false);
    engine.toggleSidechain(true);
    assert.strictEqual(engine.sidechainEnabled, true);

    // Trigger ducking envelope
    let linearRampCalled = false;
    let targetGainVal = null;
    engine.sidechainGain.gain.linearRampToValueAtTime = (val) => {
      linearRampCalled = true;
      targetGainVal = val;
    };
    engine.triggerSidechainDuck(1.5);
    assert.strictEqual(linearRampCalled, true, 'Linear ramp called to duck gain');
    assert.ok(targetGainVal < 0.25, 'Gain ducked below 0.25 on sidechain trigger');
  });

  test('PunchInFX: Overhauled 8-FX bank initializes and triggers all effects cleanly', (assert) => {
    const mockCtx = createMockAudioContext();
    const pfx = new PunchInFX(mockCtx);

    assert.strictEqual(pfx.activeFx.size, 0);

    // Test triggering each of the 8 effects
    for (let i = 0; i < 8; i++) {
      pfx.trigger(i, true);
      assert.ok(pfx.activeFx.has(i), `FX ${i} is active`);
      pfx.trigger(i, false);
      assert.ok(!pfx.activeFx.has(i), `FX ${i} released cleanly`);
    }

    assert.strictEqual(pfx.activeFx.size, 0, 'All FX deactivated cleanly without hanging nodes');
  });

  test('ProjectManager v2: Persists and restores 128th microTiming, 8x zoom, recordMode, stretchMode & Sidechain settings', (assert) => {
    const createMockEngine = () => {
      const slots = new Array(16).fill(null).map((_, i) => ({
        id: i,
        type: i < 8 ? 'melodic' : 'drum',
        name: i < 8 ? `Synth ${i + 1}` : `Drum ${i - 7}`,
        pitch: 0,
        trimStart: 0.0,
        trimEnd: 1.0,
        decay: 0.5,
        volume: 1.0,
        loop: false,
        stretchMode: 'pitch_only',
        sidechainDucked: i < 8,
        selectedSliceIndex: 0,
        stopAll: () => {},
        playDirect: () => {}
      }));
      return {
        ctx: { currentTime: 0 },
        slots,
        activeSlotIndex: 0,
        sidechainEnabled: true,
        sidechainSource: 8,
        sidechainDepth: 0.65,
        sidechainRelease: 0.18,
        setActiveSlot(idx) { this.activeSlotIndex = idx; return this.slots[idx]; },
        getActiveSlot() { return this.slots[this.activeSlotIndex]; },
        ensureAudioContext: async () => {},
        punchInFx: { setBpm: () => {} }
      };
    };

    const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';
    const origDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    const prevRaw = (isBrowser && globalThis.localStorage) ? globalThis.localStorage.getItem(PROJECT_STORAGE_KEY) : null;
    if (!isBrowser) {
      const store = new Map();
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        writable: true,
        value: {
          getItem: (k) => store.get(k) || null,
          setItem: (k, v) => store.set(k, String(v)),
          removeItem: (k) => store.delete(k)
        }
      });
    }

    try {
      const engA = createMockEngine();
      const seqA = new Sequencer(engA);

      seqA.setBpm(88);
      seqA.setRecordMode('quantized');
      engA.sidechainEnabled = true;
      engA.sidechainSource = 9; // Track 10 Kick
      engA.sidechainDepth = 0.82;
      engA.sidechainRelease = 0.25;
      engA.slots[0].stretchMode = 'resample';
      engA.slots[8].sidechainDucked = true;

      // Pattern 0: 1x zoom with -3 and +2 microTiming
      seqA.patterns[0].tracks[0][4].active = true;
      seqA.patterns[0].tracks[0][4].noteOrSlice = 65;
      seqA.patterns[0].tracks[0][4].setMicroTiming(-3);

      seqA.patterns[0].tracks[8][12].active = true;
      seqA.patterns[0].tracks[8][12].noteOrSlice = 2;
      seqA.patterns[0].tracks[8][12].setMicroTiming(2);

      // Pattern 1: 8x zoom (128 steps)
      seqA.patterns[1].setZoom(8);
      seqA.patterns[1].tracks[8][97].active = true;
      seqA.patterns[1].tracks[8][97].noteOrSlice = 4;

      assert.ok(ProjectManager.saveProject(seqA, engA), 'Saved v2 project');

      const engB = createMockEngine();
      const seqB = new Sequencer(engB);
      assert.ok(ProjectManager.loadProject(seqB, engB), 'Loaded v2 project');

      assert.strictEqual(seqB.bpm, 88, 'Restored BPM 88');
      assert.strictEqual(seqB.recordMode, 'quantized', 'Restored recordMode quantized');
      assert.strictEqual(engB.sidechainSource, 9, 'Restored sidechainSource 9');
      assert.strictEqual(engB.sidechainDepth, 0.82, 'Restored sidechainDepth 0.82');
      assert.strictEqual(engB.sidechainRelease, 0.25, 'Restored sidechainRelease 0.25');
      assert.strictEqual(engB.slots[0].stretchMode, 'resample', 'Restored resample stretchMode');
      assert.strictEqual(engB.slots[8].sidechainDucked, true, 'Restored drum slot sidechainDucked');
      assert.strictEqual(seqB.patterns[0].tracks[0][4].microTiming, -3, 'Restored microTiming -3');
      assert.strictEqual(seqB.patterns[0].tracks[8][12].microTiming, 2, 'Restored microTiming +2');
      assert.strictEqual(seqB.patterns[1].zoom, 8, 'Restored 8x zoom');
      assert.strictEqual(seqB.patterns[1].length, 128, 'Restored 128 steps');
      assert.ok(seqB.patterns[1].tracks[8][97].active, 'Restored step 97 on 8x pattern');
    } finally {
      if (isBrowser && globalThis.localStorage) {
        if (prevRaw !== null) globalThis.localStorage.setItem(PROJECT_STORAGE_KEY, prevRaw);
        else globalThis.localStorage.removeItem(PROJECT_STORAGE_KEY);
      } else if (origDescriptor) {
        Object.defineProperty(globalThis, 'localStorage', origDescriptor);
      } else {
        delete globalThis.localStorage;
      }
    }
  });

  test('MidiManager: APC Key 25 Mk1 Shift + Row 1 pads (Notes 24-31) and Shift + Play (Note 91) trigger 128th & Sidechain tools', (assert) => {
    const midi = new MidiManager();
    const triggeredTools = [];
    let toggleRecCalled = 0;

    midi.callbacks.onPatternTool = (action) => triggeredTools.push(action);
    midi.callbacks.onToggleRecordMode = () => { toggleRecCalled++; };

    // Hold Physical SHIFT (Channel 1 Note On 98)
    midi.handleMidiMessage({ data: [0x90, 98, 127] });
    assert.strictEqual(midi.shiftActive, true, 'Shift active');

    // Shift + PLAY/PAUSE (Note 91) toggles Freeform/Quantized record mode
    midi.handleMidiMessage({ data: [0x90, 91, 127] });
    assert.strictEqual(toggleRecCalled, 1, 'Shift + Note 91 triggered onToggleRecordMode');

    // Shift + Row 1 Pads (Notes 24..31 in APC Key 25 Mk1 Top-Down orientation)
    for (let note = 24; note <= 31; note++) {
      midi.handleMidiMessage({ data: [0x90, note, 100] });
    }

    assert.deepStrictEqual(triggeredTools, [
      'toggleRecMode',
      'cycleZoom',
      'nudgePrev',
      'nudgeNext',
      'toggleSidechain',
      'toggleTrackDuck',
      'setSidechainSource',
      'toggleFollow'
    ], 'All 8 Shift + Row 1 hardware pattern tools dispatched accurately');

    // Release Shift
    midi.handleMidiMessage({ data: [0x80, 98, 0] });
    assert.strictEqual(midi.shiftActive, false, 'Shift released');
  });

  test('AudioExporter.computeStepEventTime: Accurately computes 128th-note micro-timing offsets in offline render', (assert) => {
    // At 120 BPM: 1 bar = 2.0s, 16th step (1x) = 0.125s, 128th tick = 0.125 / 8 = 0.015625s
    const tOnGrid = AudioExporter.computeStepEventTime(0.0, 4, 120, 1, 50, 0);
    assert.ok(Math.abs(tOnGrid - 0.5) < 1e-9, 'Beat 2 at 120 BPM is at 0.500s');

    const tLate2 = AudioExporter.computeStepEventTime(0.0, 4, 120, 1, 50, 2);
    assert.ok(Math.abs(tLate2 - (0.5 + 2 * 0.015625)) < 1e-9, '+2/128th offset adds +31.25ms');

    const tEarly3 = AudioExporter.computeStepEventTime(0.0, 4, 120, 1, 50, -3);
    assert.ok(Math.abs(tEarly3 - (0.5 - 3 * 0.015625)) < 1e-9, '-3/128th offset subtracts 46.875ms');

    // Verify exact equivalence at 8x zoom (step 34 = Beat 2 + 2 ticks)
    const tZoom8 = AudioExporter.computeStepEventTime(0.0, 34, 120, 8, 50, 0);
    assert.ok(Math.abs(tZoom8 - tLate2) < 1e-9, '8x step 34 matches 1x step 4 (+2/128th) to the nanosecond');
  });
}
