/**
 * Tests for Pattern Zoom (1x, 2x, 4x), Drum Slice Layering, Safe Slicing, Space Delay Anti-Screech, and Sample Modification.
 */

import { Pattern, StepData } from '../src/sequencer/StepData.js';
import { Sequencer } from '../src/sequencer/Sequencer.js';
import { SampleSlot } from '../src/audio/SampleSlot.js';
import { PunchInFX } from '../src/audio/PunchInFX.js';
import { SampleLibrary } from '../src/presets/SampleLibrary.js';

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
    },
    createDelay() {
      return { delayTime: { value: 0.28, setTargetAtTime: () => {}, setValueAtTime: () => {} }, connect: () => {} };
    },
    createGain() {
      return { gain: { value: 1.0, setTargetAtTime: () => {}, linearRampToValueAtTime: () => {}, setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {}, cancelScheduledValues: () => {} }, connect: () => {} };
    },
    createBiquadFilter() {
      return { type: 'lowpass', frequency: { value: 1600, setTargetAtTime: () => {}, setValueAtTime: () => {}, cancelScheduledValues: () => {} }, Q: { value: 0.707, setTargetAtTime: () => {} }, connect: () => {} };
    },
    createWaveShaper() {
      return { curve: null, connect: () => {} };
    }
  };
}

export function runZoomAndSlicesTests(test) {
  test('Pattern Zoom: Supports 1x (16), 2x (32), and 4x (64) steps with step duration scaling', (assert) => {
    const pat = new Pattern(0, 1);
    assert.strictEqual(pat.zoom, 1);
    assert.strictEqual(pat.length, 16);
    assert.strictEqual(pat.tracks[0].length, 16);

    // Zoom in to 2x (32 steps)
    pat.setZoom(2);
    assert.strictEqual(pat.zoom, 2);
    assert.strictEqual(pat.length, 32);
    assert.strictEqual(pat.tracks[0].length, 32, 'Tracks automatically padded to 32 steps');

    // Zoom in to 4x (64 steps)
    pat.setZoom(4);
    assert.strictEqual(pat.zoom, 4);
    assert.strictEqual(pat.length, 64);
    assert.strictEqual(pat.tracks[0].length, 64, 'Tracks automatically padded to 64 steps');

    // Sequencer timing math with zoom
    const mockAudioEngine = {
      ctx: { currentTime: 0, state: 'running' },
      ensureAudioContext: async () => {},
      slots: new Array(16).fill(null).map(() => ({ stopAll: () => {}, type: 'melodic' }))
    };
    const seq = new Sequencer(mockAudioEngine);
    seq.setBpm(120);

    // 120 BPM: quarter note = 0.5s. 16th note at 1x = 0.125s
    seq.patterns[0].setZoom(1);
    assert.strictEqual(Math.round(seq.getStepDuration() * 1000), 125, '1x zoom: 125ms per 16th note step');

    // 2x zoom: 32nd note = 0.0625s = 62.5ms
    seq.patterns[0].setZoom(2);
    assert.strictEqual(Math.round(seq.getStepDuration() * 1000), 63, '2x zoom: 62.5ms per 32nd note step');

    // 4x zoom: 64th note = 31.25ms
    seq.patterns[0].setZoom(4);
    assert.strictEqual(Math.round(seq.getStepDuration() * 1000), 31, '4x zoom: 31.25ms per 64th note step');
  });

  test('Pattern Zoom: Preserves musical timing and displays 2 kicks per page when zooming 1x to 2x', (assert) => {
    const pat = new Pattern(0, 1);
    const drumTrack = pat.tracks[8];

    // Program 4 kicks on quarter notes at 1x zoom (steps 0, 4, 8, 12)
    drumTrack[0].active = true; drumTrack[0].noteOrSlice = 0;
    drumTrack[4].active = true; drumTrack[4].noteOrSlice = 0;
    drumTrack[8].active = true; drumTrack[8].noteOrSlice = 0;
    drumTrack[12].active = true; drumTrack[12].noteOrSlice = 0;

    // Zoom in to 2x (32nd notes, 32 steps total, 2 pages of 16 steps)
    pat.setZoom(2);
    assert.strictEqual(pat.zoom, 2);
    assert.strictEqual(pat.length, 32);

    // Quarter notes at 2x should now be at steps 0, 8, 16, 24
    assert.ok(pat.tracks[8][0].active, 'Step 0 active (Beat 1)');
    assert.ok(pat.tracks[8][8].active, 'Step 8 active (Beat 2)');
    assert.ok(pat.tracks[8][16].active, 'Step 16 active (Beat 3)');
    assert.ok(pat.tracks[8][24].active, 'Step 24 active (Beat 4)');

    // Page 1 (steps 0 to 15) must contain ONLY 2 kicks (steps 0 and 8)!
    const page1Active = pat.tracks[8].slice(0, 16).filter(s => s.active).length;
    assert.strictEqual(page1Active, 2, 'Page 1 has strictly 2 kicks (Beats 1 & 2)');

    // Page 2 (steps 16 to 31) must contain the other 2 kicks (steps 16 and 24)!
    const page2Active = pat.tracks[8].slice(16, 32).filter(s => s.active).length;
    assert.strictEqual(page2Active, 2, 'Page 2 has strictly 2 kicks (Beats 3 & 4)');

    // Zoom back out to 1x: All 4 kicks return to steps 0, 4, 8, 12
    pat.setZoom(1);
    assert.strictEqual(pat.zoom, 1);
    assert.strictEqual(pat.length, 16);
    assert.ok(pat.tracks[8][0].active);
    assert.ok(pat.tracks[8][4].active);
    assert.ok(pat.tracks[8][8].active);
    assert.ok(pat.tracks[8][12].active);
    assert.strictEqual(pat.tracks[8].filter(s => s.active).length, 4);
  });

  test('Drum Slice Layering: Live overdub layers multiple drum slices on same step without dropping voices', (assert) => {
    const mockAudioEngine = {
      ctx: { currentTime: 1.0, state: 'running' },
      ensureAudioContext: async () => {},
      slots: new Array(16).fill(null).map((_, i) => ({
        stopAll: () => {},
        type: i >= 8 ? 'drum' : 'melodic',
        buffer: { duration: 2.0 }
      })),
      playSlotDirect: () => {}
    };

    const seq = new Sequencer(mockAudioEngine);
    seq.isPlaying = true;
    seq.isRecording = true;
    seq.currentStep = 0;
    seq.nextStepTime = 1.0;

    // Track 8 is a drum kit slot.
    // Loop Pass 1: Record Kick (Slice 0) on step 0
    seq.recordHit(8, 0, 110);
    const stepAfterPass1 = seq.getCurrentPattern().tracks[8][0];
    assert.strictEqual(stepAfterPass1.active, true);
    assert.strictEqual(stepAfterPass1.noteOrSlice, 0, 'First pass records Kick (Slice 0)');

    // Loop Pass 2: Record Hi-Hat (Slice 4) on step 0
    seq.recordHit(8, 4, 100);
    assert.ok(stepAfterPass1.notes.includes(0), 'Kick slice 0 is preserved');
    assert.ok(stepAfterPass1.notes.includes(4), 'Hi-hat slice 4 is layered onto step 0');
    assert.strictEqual(stepAfterPass1.notes.length, 2, 'Step now plays both Kick AND Hat together');
  });

  test('SampleSlot: Safe slice index clamping in playSlice prevents invalid buffer bounds', (assert) => {
    const slot = new SampleSlot(8, 'drum');
    slot.buffer = { duration: 5.6, numberOfChannels: 2 };
    slot.slices = [
      { start: 0.0, end: 0.35, pitch: 0 },
      { start: 0.35, end: 0.70, pitch: 0 }
    ];

    const mockCtx = {
      currentTime: 0.5,
      createBufferSource: () => ({
        playbackRate: { setValueAtTime: () => {} },
        start: (when, offset, dur) => {
          // Verify offset does not exceed buffer duration
          if (offset >= slot.buffer.duration) {
            throw new Error(`Offset ${offset} exceeds buffer duration!`);
          }
        },
        stop: () => {},
        connect: () => {}
      }),
      createGain: () => ({
        gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {}, linearRampToValueAtTime: () => {} },
        connect: () => {}
      })
    };

    // Calling with raw MIDI note 60 (out-of-bounds index) must not throw or exceed buffer
    const handle = slot.playSlice(mockCtx, {}, 60, 100);
    assert.ok(handle !== null, 'Voice handle successfully created for out-of-bounds note');
    assert.strictEqual(handle.sliceIndex, 12, 'Normalized 60 to slice index 12 (60 % 16)');
  });

  test('PunchInFX: Space Delay has warm non-screeching filter (Q <= 1.0) and soft-saturation limiter', (assert) => {
    const mockCtx = createMockAudioContext();
    const fx = new PunchInFX(mockCtx);

    assert.ok(fx.spaceFilter.Q.value <= 1.0, 'Space delay filter Q is <= 1.0 to eliminate self-oscillation screech');
    assert.strictEqual(fx.spaceFilter.type, 'lowpass', 'Space delay filter is lowpass');
    assert.ok(fx.spaceSaturation !== undefined, 'Space delay includes soft-saturation limiter in feedback loop');
    assert.ok(fx.spaceSaturation.curve !== null, 'Soft-saturator curve is populated');
  });

  test('SampleSlot: loop mode enables continuous sustain looping while held', (assert) => {
    const slot = new SampleSlot(0, 'melodic');
    slot.buffer = { duration: 2.0, numberOfChannels: 2 };
    slot.loop = true;

    let loopSet = false;
    let started = false;
    const mockCtx = {
      currentTime: 1.0,
      createBufferSource: () => {
        const src = {
          playbackRate: { setValueAtTime: () => {} },
          connect: () => {},
          start: () => { started = true; },
          stop: () => {}
        };
        Object.defineProperty(src, 'loop', {
          set: (v) => { loopSet = v; },
          get: () => loopSet
        });
        return src;
      },
      createGain: () => ({
        gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {}, cancelScheduledValues: () => {} },
        connect: () => {}
      })
    };

    const handle = slot.playMelodic(mockCtx, {}, 60, 100);
    assert.ok(handle !== null);
    assert.strictEqual(loopSet, true, 'AudioBufferSourceNode loop set to true when slot.loop is enabled');
    assert.strictEqual(started, true, 'Source started');
  });

  test('SampleLibrary: Expanded catalog contains 46 melodic presets and 14 drum kits (60 total)', (assert) => {
    const melodics = SampleLibrary.getMelodicPresets();
    const drums = SampleLibrary.getDrumPresets();

    assert.strictEqual(melodics.length, 46, `Melodic preset catalog expanded to 46 presets`);
    assert.strictEqual(drums.length, 14, `Drum kit catalog has 14 kits`);
    assert.strictEqual(melodics.length + drums.length, 60, 'Total preset count is 60');

    const names = melodics.map(m => m.name);
    // New long decay & sustain instruments
    assert.ok(names.includes('Concert Grand Piano'), 'Includes Concert Grand Piano (5.5s decay sustain)');
    assert.ok(names.includes('Rhodes Stage 73 (Long)'), 'Includes Rhodes Stage 73 (Long)');
    assert.ok(names.includes('Dusty Jazz Rhodes Chops'), 'Includes Dusty Jazz Rhodes Chops');
    assert.ok(names.includes('Tape-Saturated Vinyl Flute'), 'Includes Tape-Saturated Vinyl Flute');
    assert.ok(names.includes('808 Slide Sub Bass'), 'Includes 808 Slide Sub Bass');
    assert.ok(names.includes('Symphonic Strings (Sustain)'), 'Includes Symphonic Strings (Sustain)');
    assert.ok(names.includes('Cathedral Pipe Organ'), 'Includes Cathedral Pipe Organ');
    assert.ok(names.includes('Lush Choir Aah (Sustain)'), 'Includes Lush Choir Aah (Sustain)');
    assert.ok(names.includes('Upright Acoustic Bass (Long)'), 'Includes Upright Acoustic Bass (Long)');
    assert.ok(names.includes('Spanish Nylon Guitar'), 'Includes Spanish Nylon Guitar');
    assert.ok(names.includes('Solina String Ensemble'), 'Includes Solina String Ensemble');
    assert.ok(names.includes('Ethereal Shimmer Pad (Long)'), 'Includes Ethereal Shimmer Pad (Long)');
    assert.ok(names.includes('Prophet Analog Brass (Long)'), 'Includes Prophet Analog Brass (Long)');
    assert.ok(names.includes('Fender Jazz Finger Bass'), 'Includes Fender Jazz Finger Bass');
    assert.ok(names.includes('Baroque Concert Harpsichord'), 'Includes Baroque Concert Harpsichord');
    assert.ok(names.includes('Jazz Vibraphone (Tremolo)'), 'Includes Jazz Vibraphone (Tremolo)');
    assert.ok(names.includes('Orchestral Tubular Chimes'), 'Includes Orchestral Tubular Chimes');
    assert.ok(names.includes('Roland Jupiter-8 Poly Brass'), 'Includes Roland Jupiter-8 Poly Brass');

    // Classic synth presets
    assert.ok(names.includes('Acid TB-303 Lead'), 'Includes Acid TB-303 Lead');
    assert.ok(names.includes('Oberheim 8-Voice Brass'), 'Includes Oberheim Brass');
    assert.ok(names.includes('Fairlight CMI Flute'), 'Includes Fairlight CMI Flute');
    assert.ok(names.includes('Mellotron 1967 Tape Flute'), 'Includes Mellotron Flute');
    assert.ok(names.includes('909 Deep Sub'), 'Includes 909 Deep Sub');
    assert.ok(names.includes('Rosewood Marimba'), 'Includes Rosewood Marimba');
    assert.ok(names.includes('Caribbean Steel Pan'), 'Includes Caribbean Steel Pan');
    assert.ok(names.includes('Lo-Fi Jazz Guitar'), 'Includes Lo-Fi Jazz Guitar');

    const drumNames = drums.map(d => d.name);
    assert.ok(drumNames.includes('TR-909 House Kit'), 'Includes TR-909 House Kit');
    assert.ok(drumNames.includes('TR-808 Classic Kit'), 'Includes TR-808 Classic Kit');
    assert.ok(drumNames.includes('Lo-Fi Hip-Hop Dust Kit'), 'Includes Lo-Fi Hip-Hop Dust Kit');
    assert.ok(drumNames.includes('Trap 808 Mega Kit'), 'Includes Trap 808 Mega Kit');
    assert.ok(drumNames.includes('Vintage Electro Hybrid'), 'Includes Vintage Electro Hybrid');
    assert.ok(drumNames.includes('Jungle & D&B Break Kit'), 'Includes Jungle & D&B Break Kit');
    assert.ok(drumNames.includes('LinnDrum LM-2 Classic Kit'), 'Includes LinnDrum LM-2 Classic Kit');
    assert.ok(drumNames.includes('Studio Acoustic Drum Kit'), 'Includes Studio Acoustic Drum Kit');
  });

  test('SampleSlot: Dual stretch modes toggle correctly and pitch_only preserves duration', (assert) => {
    const slot = new SampleSlot(0, 'melodic', 'Concert Piano');
    assert.strictEqual(slot.stretchMode, 'pitch_only', 'Default mode is pitch_only (constant duration on higher notes)');

    const mode1 = slot.toggleStretchMode();
    assert.strictEqual(mode1, 'resample', 'Toggles to resample');
    assert.strictEqual(slot.stretchMode, 'resample');

    const mode2 = slot.toggleStretchMode();
    assert.strictEqual(mode2, 'pitch_only', 'Toggles back to pitch_only');
    assert.strictEqual(slot.stretchMode, 'pitch_only');

    slot.setStretchMode('pitch_only');
    assert.strictEqual(slot.stretchMode, 'pitch_only');

    // Mock AudioContext with buffer creation
    const sampleRate = 44100;
    const durationSec = 2.0;
    const mockCtx = {
      sampleRate,
      currentTime: 1.0,
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

    // Attach synthetic 2-second buffer
    slot.buffer = mockCtx.createBuffer(2, sampleRate * durationSec, sampleRate);
    const originalLength = slot.buffer.length;

    // Pitch shift +12 semitones in pitch_only mode
    const shiftedBuf = slot.getPitchOnlyBuffer(mockCtx, 12);
    assert.ok(shiftedBuf !== null, 'Generated pitch-shifted buffer');
    assert.strictEqual(shiftedBuf.length, originalLength, 'Length in samples is 100% constant (no time squeezing!)');
    assert.strictEqual(shiftedBuf.duration, slot.buffer.duration, 'Duration in seconds is 100% preserved');

    // Verify cache hit
    const cachedBuf = slot.getPitchOnlyBuffer(mockCtx, 12);
    assert.strictEqual(cachedBuf, shiftedBuf, 'Subsequent requests return cached buffer for zero-latency performance');
  });

  test('SampleLibrary: Concert Grand Piano generator creates 5.5s physical acoustic model', (assert) => {
    const melodics = SampleLibrary.getMelodicPresets();
    const pianoPreset = melodics.find(p => p.id === 'concert_grand_piano');
    assert.ok(pianoPreset !== undefined, 'Concert Grand Piano preset exists');
    assert.strictEqual(pianoPreset.name, 'Concert Grand Piano');

    const mockCtx = {
      sampleRate: 22050, // Test at 22.05 kHz for fast generation in test runner
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

    const pianoBuf = pianoPreset.generate(mockCtx);
    assert.ok(pianoBuf !== null);
    assert.ok(pianoBuf.duration >= 5.0, `Piano buffer duration is ${pianoBuf.duration}s (>= 5.0s sustain decay)`);
    assert.strictEqual(pianoBuf.numberOfChannels, 2, 'Stereo soundboard resonance');
  });
}
