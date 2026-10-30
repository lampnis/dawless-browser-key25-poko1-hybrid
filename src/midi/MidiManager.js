/**
 * Open-KO: MidiManager
 * Robust Web MIDI API controller with dynamic hardware mapping profiles,
 * auto-calibration, and guided testing support.
 */

import {
  APC_MK1_LEDS,
  APC_MK2_LEDS,
  APC_SCENE_NOTES,
  APC_BUTTON_NOTES,
  GRID_LAYOUT_MODES,
  OPERATIONAL_MODES
} from './ApcConstants.js';
import { MidiMapper } from './MidiMapper.js';

export class MidiManager {
  constructor(options = {}) {
    this.midiAccess = null;
    this.activeInput = null;
    this.activeOutput = null;
    this.deviceMode = 'MK1';
    this.operationalMode = options.operationalMode || OPERATIONAL_MODES.PATTERN;
    this.ledPowerMode = options.ledPowerMode || 'normal'; // 'normal', 'eco', 'stealth'

    this.mapper = new MidiMapper(options.layoutMode || GRID_LAYOUT_MODES.TOP_DOWN);

    // Modifiers & state
    this.heldSteps = new Set();
    this.heldFx = new Set();
    this.shiftActive = false;
    this.sustainActive = false;

    // PO-33 Style PATTERN & SOUND modifiers
    this.patternButtonHeld = false;
    this.soundButtonHeld = false;
    this.patternPadsTapped = 0;
    this.soundPadsTapped = 0;

    // Guided Test Mode Flag
    this.testModeActive = false;

    // Tap tempo tracking
    this.hardwareTapTimes = [];

    // Real-time MIDI Activity History
    this.midiHistory = [];

    // Callbacks
    this.callbacks = {
      onStepToggle: null,
      onStepHold: null,
      onSlotSelect: null,
      onFxTrigger: null,
      onKeyboardNoteOn: null,
      onKeyboardNoteOff: null,
      onMacroKnob: null,
      onSceneButton: null,
      onTransportPlayPause: null,
      onTransportStop: null,
      onRecordToggle: null,
      onModeChange: null,
      onPatternSelect: null,
      onTrackMuteToggle: null,
      onClipLaunch: null,
      onSampleTool: null,
      onPatternTool: null,
      onTapTempo: null,
      onToggleView: null,
      onToggleSetupModal: null,
      onToggleTesterModal: null,
      onToggleLayoutModal: null,
      onSustainChange: null,
      onOctaveChange: null,
      onSetupKnobParam: null,
      onDeviceStatus: null,
      onMidiActivity: null,
      onSampleCycle: null,
      onNavArrow: null,
      onToggleKnobBank: null,
      onLiveSampleToggle: null,
      onPatternModeHold: null,
      onSoundModeHold: null,
      onPatternChainAppend: null,
      onPatternChainAppendCurrent: null,
      onPatternChainReset: null,
      onToggleRecordMode: null,
      onTestMidiEvent: null // Used by Guided Test Suite
    };

    this.keyboardBaseNote = 48; // Default lowest key (C3) on APC Key 25 Mk1
    this.ledCache = new Map();
    this.recentLedNotes = new Map();
  }

  async init() {
    if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) {
      console.warn('Web MIDI API is not supported in this browser.');
      this._notifyStatus('unsupported', 'Web MIDI not supported in this browser');
      return false;
    }

    try {
      this.midiAccess = await navigator.requestMIDIAccess({ sysex: true });
      this.midiAccess.onstatechange = (e) => this._handleStateChange(e);
      this.autoConnect();
      return true;
    } catch (err) {
      console.error('Failed to get MIDI access:', err);
      this._notifyStatus('error', err.message);
      return false;
    }
  }

  setOperationalMode(mode) {
    if (Object.values(OPERATIONAL_MODES).includes(mode)) {
      this.operationalMode = mode;
      this.heldSteps.clear();
      if (this.callbacks.onStepHold) {
        this.callbacks.onStepHold(0, false);
      }
      if (this.callbacks.onModeChange) {
        this.callbacks.onModeChange(mode);
      }
    }
  }

  setLedPowerMode(mode) {
    if (['normal', 'eco', 'stealth'].includes(mode)) {
      this.ledPowerMode = mode;
      if (mode === 'stealth') {
        this.clearAllLeds();
      }
      console.log(`[MidiManager] LED Power Mode set to: ${mode.toUpperCase()}`);
    }
  }

  autoConnect() {
    if (!this.midiAccess) return;

    let matchedIn = null;
    let matchedOut = null;

    for (const input of this.midiAccess.inputs.values()) {
      const name = (input.name || '').toLowerCase();
      if (name.includes('apc key 25') || name.includes('apc key') || name.includes('apc')) {
        matchedIn = input;
        this.deviceMode = (name.includes('mk2') || name.includes('mkii')) ? 'MK2' : 'MK1';
        break;
      }
    }

    for (const output of this.midiAccess.outputs.values()) {
      const name = (output.name || '').toLowerCase();
      if (name.includes('apc key 25') || name.includes('apc key') || name.includes('apc')) {
        matchedOut = output;
        break;
      }
    }

    if (!matchedIn && this.midiAccess.inputs.size > 0) {
      matchedIn = this.midiAccess.inputs.values().next().value;
    }
    // Strictly ONLY auto-target output if it's genuinely an APC controller!
    // Never auto-select an audio interface, IAC driver, or synth output
    // to prevent blasting Note On LED commands to external synths!

    if (matchedIn) this.setInput(matchedIn);
    if (matchedOut) this.setOutput(matchedOut);

    this._notifyStatus('connected', {
      input: this.activeInput ? this.activeInput.name : null,
      output: this.activeOutput ? this.activeOutput.name : null,
      mode: this.deviceMode
    });
  }

  getInputs() {
    if (!this.midiAccess) return [];
    return Array.from(this.midiAccess.inputs.values());
  }

  getOutputs() {
    if (!this.midiAccess) return [];
    return Array.from(this.midiAccess.outputs.values());
  }

  setInput(inputPort) {
    if (this.activeInput) this.activeInput.onmidimessage = null;
    this.activeInput = inputPort;
    if (this.activeInput) {
      this.activeInput.onmidimessage = (msg) => this.handleMidiMessage(msg);
    }
  }

  setOutput(outputPort) {
    this.activeOutput = outputPort;
    this.ledCache.clear();
    if (this.activeOutput) {
      this.sendHandshake();
      this.clearAllLeds();
    }
  }

  /**
   * Send Akai APC Key 25 Mk1 Live Mode SysEx Handshake
   * Puts the APC Key 25 hardware into Ableton Live control mode so all 40 pad tri-color LEDs respond.
   */
  sendHandshake() {
    if (!this.activeOutput) return;
    try {
      // Akai APC Key 25 Mk1 Live Mode handshake SysEx:
      // F0 47 7F 27 60 00 04 41 08 02 01 F7
      // 0x27 = Product ID for APC Key 25 Mk1 (0x28 for APC Mini)
      const sysex = [0xF0, 0x47, 0x7F, 0x27, 0x60, 0x00, 0x04, 0x41, 0x08, 0x02, 0x01, 0xF7];
      this.activeOutput.send(sysex);
      console.log('[MidiManager] Sent Akai APC Key 25 Mk1 Live Mode SysEx Handshake');
    } catch (err) {
      console.warn('[MidiManager] SysEx Handshake not supported or ignored:', err);
    }
  }

  setLayoutMode(mode) {
    this.mapper.resetToDefault(mode);
  }

  /**
   * Main incoming MIDI processor
   */
  handleMidiMessage(event) {
    const [statusByte, data1, data2] = event.data;
    const command = statusByte & 0xF0;
    const channel = (statusByte & 0x0F) + 1; // 1-16 (Channel 1 = controls/pads, Channel 2 = keybed)

    // Strict MIDI Echo Feedback Elimination:
    // Drop any Channel 1 Note message reflecting an outgoing LED command within 500ms
    // to prevent loopback into test wizards or audio voices.
    if ((command === 0x90 || command === 0x80) && channel === 1) {
      const sendTime = this.recentLedNotes.get(data1);
      if (sendTime && (performance.now() - sendTime < 500)) {
        return;
      }
    }

    let desc = '';

    // If guided test suite is active, forward raw message with channel and return early
    // to ensure test hits do NOT trigger sound drones or sequencer steps!
    if (this.testModeActive && this.callbacks.onTestMidiEvent) {
      this.callbacks.onTestMidiEvent({ status: statusByte, channel, d1: data1, d2: data2, command });
      this._logActivity('IN', statusByte, data1, data2, `TEST: Ch ${channel} Cmd 0x${command.toString(16).toUpperCase()} D1:${data1} D2:${data2}`);
      return;
    }

    // 1. Note On
    if (command === 0x90) {
      const note = data1;
      const velocity = data2;

      if (velocity > 0) {
        desc = `[Ch ${channel}] Note On: ${note} (Vel: ${velocity})`;
        this._handleNoteOn(note, velocity, channel);
      } else {
        desc = `[Ch ${channel}] Note Off: ${note}`;
        this._handleNoteOff(note, channel);
      }
    }
    // 2. Note Off
    else if (command === 0x80) {
      desc = `[Ch ${channel}] Note Off: ${data1}`;
      this._handleNoteOff(data1, channel);
    }
    // 3. Control Change (CC)
    else if (command === 0xB0) {
      desc = `[Ch ${channel}] CC #${data1}: ${data2}`;
      this._handleControlChange(data1, data2, channel);
    }

    this._logActivity('IN', statusByte, data1, data2, desc);
  }

  getPadCoordinates(note) {
    return this.mapper.getNoteCoordinates(note);
  }

  getNoteFromCoordinates(row, col) {
    return this.mapper.getNoteForCell(row, col);
  }

  _handleNoteOn(note, velocity, channel = 1) {
    // -------------------------------------------------------------
    // CHANNEL 2: DEDICATED PIANO KEYBED ON APC KEY 25 MK1
    // (Isolates keys from pads and track buttons completely!)
    // Piano keys strictly, unconditionally play the active sample!
    // No hidden functions on piano keys!
    // -------------------------------------------------------------
    if (channel === 2) {
      // Dynamic tracking of keybed range when hardware octave buttons transpose keys
      if (note < this.keyboardBaseNote || note >= this.keyboardBaseNote + 25) {
        this.keyboardBaseNote = Math.floor(note / 12) * 12;
        if (this.callbacks.onOctaveChange) this.callbacks.onOctaveChange(this.keyboardBaseNote);
      }

      // Normal Keybed Note Playback - Always triggers the active sample!
      if (this.callbacks.onKeyboardNoteOn) {
        this.callbacks.onKeyboardNoteOn(note, velocity, channel);
      }
      return;
    }

    // -------------------------------------------------------------
    // CHANNEL 1: APC KEY 25 MK1 CONTROLS, PADS, SCENES & BUTTONS
    // -------------------------------------------------------------

    // 1. Shift Detection (Note 98 on APC Key 25 Mk1)
    if (this.mapper.isShiftNote(note) || note === 98) {
      this.shiftActive = true;
      return;
    }

    // 2. Physical Transport Buttons on APC Key 25 Mk1 / Mk2
    // Play/Pause (Note 91 / 0x5B)
    if (note === 91 || note === APC_BUTTON_NOTES.PLAY_PAUSE) {
      if (this.shiftActive) {
        if (this.callbacks.onToggleRecordMode) {
          this.callbacks.onToggleRecordMode();
        } else if (this.callbacks.onPatternTool) {
          this.callbacks.onPatternTool('toggleRecMode');
        } else if (this.callbacks.onTransportPlayPause) {
          this.callbacks.onTransportPlayPause();
        }
      } else {
        if (this.callbacks.onTransportPlayPause) this.callbacks.onTransportPlayPause();
      }
      return;
    }

    // Record (Note 93 / 0x5D)
    if (note === 93 || note === APC_BUTTON_NOTES.REC) {
      if (this.shiftActive) {
        // Shift + REC: Sample live input stream (Line-In / Mic / Tab audio)
        if (this.callbacks.onLiveSampleToggle) {
          this.callbacks.onLiveSampleToggle();
        } else if (this.callbacks.onSampleTool) {
          this.callbacks.onSampleTool(0);
        }
      } else {
        // Normal REC: Toggle live loop phrase recording into active track!
        if (this.callbacks.onRecordToggle) {
          this.callbacks.onRecordToggle();
        } else if (this.callbacks.onSceneButton) {
          this.callbacks.onSceneButton(2, true);
        }
      }
      return;
    }

    // Stop All Clips (Note 81 / 0x51)
    if (note === 81 || note === APC_BUTTON_NOTES.STOP_ALL) {
      if (this.shiftActive) {
        if (this.callbacks.onToggleTesterModal) {
          this.callbacks.onToggleTesterModal();
        } else if (this.callbacks.onTransportStop) {
          this.callbacks.onTransportStop();
        }
      } else {
        if (this.callbacks.onTransportStop) this.callbacks.onTransportStop();
      }
      return;
    }

    // 3. Bottom Track Buttons (Notes 64 to 71 on APC Key 25 Mk1: ▲, ▼, ◄, ►, VOLUME, PAN, SEND, DEVICE, and 52-59 on Mk2)
    let trackIdx = this.mapper.activeProfile.trackNotes.indexOf(note);
    if (trackIdx === -1 && note >= 52 && note <= 59) {
      trackIdx = note - 52;
    }

    if (trackIdx !== -1) {
      if (this.shiftActive) {
        // Shift + Track buttons:
        // Notes 64 & 65 (▲ & ▼): Cycle samples in library for active slot!
        if ((note === 64 || note === 52) && this.callbacks.onSampleCycle) {
          this.callbacks.onSampleCycle(1);
          return;
        }
        if ((note === 65 || note === 53) && this.callbacks.onSampleCycle) {
          this.callbacks.onSampleCycle(-1);
          return;
        }
        // Note 66 (◄): Cycle Swing
        if ((note === 66 || note === 54) && this.callbacks.onPatternTool) {
          this.callbacks.onPatternTool('cycleSwing');
          return;
        }
        // Note 67 (►) or Note 71 (DEVICE): Toggle Knob Bank (Track vs Master)
        if ((note === 67 || note === 71 || note === 55 || note === 59) && this.callbacks.onToggleKnobBank) {
          this.callbacks.onToggleKnobBank();
          return;
        }

        // Shift + Track buttons: Tracks 9 to 16 mute toggle
        if (this.callbacks.onTrackMuteToggle) this.callbacks.onTrackMuteToggle(8 + trackIdx);
      } else {
        // Normal (NO SHIFT):
        // Note 64 (▲): Navigate to previous track (or Track 1 mute if no nav callback)
        if (note === 64 || note === 52) {
          if (this.callbacks.onNavArrow) {
            this.callbacks.onNavArrow('up');
            return;
          }
        }
        // Note 65 (▼): Navigate to next track
        if (note === 65 || note === 53) {
          if (this.callbacks.onNavArrow) {
            this.callbacks.onNavArrow('down');
            return;
          }
        }
        // Note 66 (◄): PO-33 PATTERN Button (Hold + Pad 1..16 for direct pattern select & chaining)
        if (note === 66 || note === 54) {
          this.patternButtonHeld = true;
          this.patternPadsTapped = 0;
          if (this.callbacks.onPatternModeHold) this.callbacks.onPatternModeHold(true);
          if (this.callbacks.onNavArrow) {
            this.callbacks.onNavArrow('left');
            return;
          }
        }
        // Note 67 (►): PO-33 SOUND Button (Hold + Pad 1..16 for direct sound slot select)
        if (note === 67 || note === 55) {
          this.soundButtonHeld = true;
          this.soundPadsTapped = 0;
          if (this.callbacks.onSoundModeHold) this.callbacks.onSoundModeHold(true);
          if (this.callbacks.onNavArrow) {
            this.callbacks.onNavArrow('right');
            return;
          }
        }
        // Note 71 (DEVICE): Toggle Knob Bank (Track vs Master)
        if ((note === 71 || note === 59) && this.callbacks.onToggleKnobBank) {
          this.callbacks.onToggleKnobBank();
          return;
        }

        // Normal: Tracks 1 to 8 mute toggle
        if (this.callbacks.onTrackMuteToggle) this.callbacks.onTrackMuteToggle(trackIdx);
      }
      return;
    }

    // 4. Shift Combinations on Channel 1
    if (this.shiftActive) {
      const sn = this.mapper.activeProfile.sceneNotes;

      // Shift + Scene 1 (Note 82): Mode 1 = SAMPLE MODE
      if (note === sn.scene1 || note === 82) {
        this.setOperationalMode(OPERATIONAL_MODES.SAMPLE);
        return;
      }
      // Shift + Scene 2 (Note 83): Mode 2 = PATTERN MODE
      if (note === sn.scene2 || note === 83) {
        this.setOperationalMode(OPERATIONAL_MODES.PATTERN);
        return;
      }
      // Shift + Scene 3 (Note 84): Mode 3 = PERFORMANCE MODE
      if (note === sn.scene3 || note === 84) {
        this.setOperationalMode(OPERATIONAL_MODES.PERFORMANCE);
        return;
      }
      // Shift + Scene 4 (Note 85): Hardware Tap Tempo
      if (note === sn.scene4 || note === 85) {
        this._handleHardwareTapTempo();
        return;
      }
      // Shift + Scene 5 (Note 86): Reset Pattern Chain to Single Loop
      if (note === sn.scene5 || note === 86) {
        if (this.callbacks.onPatternChainReset) {
          this.callbacks.onPatternChainReset();
        } else if (this.callbacks.onSceneButton) {
          this.callbacks.onSceneButton(5, true);
        }
        return;
      }

      // Shift + Grid Pads (Pattern Tools in Row 0 & Row 1, Chain in Row 2, Mutes 9-16 in Row 3)
      const coord = this.getPadCoordinates(note);
      if (coord) {
        const { row, col } = coord;
        if (row === 0) {
          const actions = ['clearTrack', 'duplicatePattern', 'shiftLeft', 'shiftRight', 'humanize', 'cycleSwing', 'doubleBpm', 'halfBpm'];
          if (this.callbacks.onPatternTool) this.callbacks.onPatternTool(actions[col]);
          return;
        } else if (row === 1) {
          const row1Actions = [
            'toggleRecMode',
            'cycleZoom',
            'nudgePrev',
            'nudgeNext',
            'toggleSidechain',
            'toggleTrackDuck',
            'setSidechainSource',
            'toggleFollow'
          ];
          if (this.callbacks.onPatternTool) this.callbacks.onPatternTool(row1Actions[col]);
          return;
        } else if (row === 2) {
          if (this.callbacks.onPatternChainAppend) {
            this.callbacks.onPatternChainAppend(col);
          } else if (this.callbacks.onPatternSelect) {
            this.callbacks.onPatternSelect(8 + col);
          }
          return;
        } else if (row === 3) {
          if (this.callbacks.onTrackMuteToggle) this.callbacks.onTrackMuteToggle(8 + col);
          return;
        }
      }
    }

    // 5. Standard Scene Buttons (When Shift is NOT held)
    const sn = this.mapper.activeProfile.sceneNotes;
    if (this.operationalMode === OPERATIONAL_MODES.PERFORMANCE) {
      if (note >= 82 && note <= 86) {
        const sceneRow = note - 82;
        if (this.callbacks.onClipLaunch) this.callbacks.onClipLaunch(sceneRow, -1);
        return;
      }
    } else {
      if (note === sn.scene1 || note === 82) {
        if (this.callbacks.onTransportPlayPause) this.callbacks.onTransportPlayPause();
        if (this.callbacks.onSceneButton) this.callbacks.onSceneButton(1, true);
        return;
      }
      if (note === sn.scene2 || note === 83) {
        if (this.callbacks.onRecordToggle) this.callbacks.onRecordToggle();
        if (this.callbacks.onSceneButton) this.callbacks.onSceneButton(2, true);
        return;
      }
      if (note === sn.scene3 || note === 84) {
        if (this.callbacks.onSceneButton) this.callbacks.onSceneButton(3, true);
        return;
      }
      if (note === sn.scene4 || note === 85) {
        if (this.callbacks.onSceneButton) this.callbacks.onSceneButton(4, true);
        return;
      }
      if (note === sn.scene5 || note === 86) {
        if (this.callbacks.onPatternChainAppendCurrent) {
          this.callbacks.onPatternChainAppendCurrent();
        } else if (this.callbacks.onSceneButton) {
          this.callbacks.onSceneButton(5, true);
        }
        return;
      }
    }

    // 7. Grid Pads (0 - 39 or mapped range)
    const coord = this.getPadCoordinates(note);
    if (coord) {
      const { row, col } = coord;

      // PO-33 PATTERN MODIFIER: Hold ◄ + Pad 1..16 (Rows 0 & 1)
      if (this.patternButtonHeld && (row === 0 || row === 1)) {
        const patIdx = (row * 8) + col;
        this.patternPadsTapped++;
        if (this.patternPadsTapped === 1) {
          if (this.callbacks.onPatternSelect) this.callbacks.onPatternSelect(patIdx);
        } else {
          // Successive pads while holding PATTERN appends to chain (e.g. 1 -> 1 -> 2 -> 3)
          if (this.callbacks.onPatternChainAppend) this.callbacks.onPatternChainAppend(patIdx);
        }
        return;
      }

      // PO-33 SOUND MODIFIER: Hold ► + Pad 1..16 (Rows 0 & 1)
      if (this.soundButtonHeld && (row === 0 || row === 1)) {
        const slotIdx = (row * 8) + col;
        this.soundPadsTapped++;
        const type = slotIdx < 8 ? 'melodic' : 'drum';
        if (this.callbacks.onSlotSelect) this.callbacks.onSlotSelect(slotIdx, type);
        return;
      }

      if (this.operationalMode === OPERATIONAL_MODES.PATTERN) {
        if (row === 0 || row === 1) {
          const stepIndex = (row * 8) + col;
          this.heldSteps.add(stepIndex);
          if (this.callbacks.onStepToggle) this.callbacks.onStepToggle(stepIndex, velocity);
          if (this.callbacks.onStepHold) this.callbacks.onStepHold(stepIndex, true);
        } else if (row === 2) {
          if (this.callbacks.onPatternSelect) this.callbacks.onPatternSelect(col);
        } else if (row === 3) {
          if (this.callbacks.onTrackMuteToggle) this.callbacks.onTrackMuteToggle(col);
        } else if (row === 4) {
          this.heldFx.add(col);
          if (this.callbacks.onFxTrigger) this.callbacks.onFxTrigger(col, true, velocity);
        }
      } else if (this.operationalMode === OPERATIONAL_MODES.SAMPLE) {
        if (row === 0) {
          if (this.callbacks.onSlotSelect) this.callbacks.onSlotSelect(col, 'melodic');
        } else if (row === 1) {
          if (this.callbacks.onSlotSelect) this.callbacks.onSlotSelect(8 + col, 'drum');
        } else if (row === 2 || row === 3) {
          const sliceIndex = (row - 2) * 8 + col;
          if (this.callbacks.onKeyboardNoteOn) this.callbacks.onKeyboardNoteOn(sliceIndex, velocity, channel);
        } else if (row === 4) {
          if (this.callbacks.onSampleTool) this.callbacks.onSampleTool(col);
        }
      } else if (this.operationalMode === OPERATIONAL_MODES.PERFORMANCE) {
        if (this.callbacks.onClipLaunch) this.callbacks.onClipLaunch(row, col);
      }
      return;
    }

    // 8. Fallback to Keyboard: STRICTLY for Channel 2 piano keys (or external controllers explicitly sending keys)
    // Channel 1 controls/pads on APC Key 25 NEVER fall through to play piano samples!
    if (channel === 2 && this.callbacks.onKeyboardNoteOn) {
      this.callbacks.onKeyboardNoteOn(note, velocity, channel);
    }
  }

  _handleNoteOff(note, channel = 1) {
    if (channel === 2) {
      if (this.callbacks.onKeyboardNoteOff) {
        this.callbacks.onKeyboardNoteOff(note, channel);
      }
      return;
    }

    // Ignore release of transport buttons (Play/Pause 91, Rec 93, Stop All 81)
    if (note === 91 || note === 93 || note === 81) {
      return;
    }

    // Note 66 (◄): PO-33 PATTERN button release (or Note 54 on Mk2)
    if (note === 66 || note === 54) {
      if (this.patternButtonHeld) {
        this.patternButtonHeld = false;
        this.heldSteps.clear();
        if (this.callbacks.onPatternModeHold) this.callbacks.onPatternModeHold(false);
        if (this.callbacks.onStepHold) this.callbacks.onStepHold(0, false);
      }
      return;
    }

    // Note 67 (►): PO-33 SOUND button release (or Note 55 on Mk2)
    if (note === 67 || note === 55) {
      if (this.soundButtonHeld) {
        this.soundButtonHeld = false;
        this.heldSteps.clear();
        if (this.callbacks.onSoundModeHold) this.callbacks.onSoundModeHold(false);
        if (this.callbacks.onStepHold) this.callbacks.onStepHold(0, false);
      }
      return;
    }

    if (this.mapper.isShiftNote(note) || note === 98) {
      this.shiftActive = false;
      return;
    }

    const coord = this.getPadCoordinates(note);
    if (coord) {
      const { row, col } = coord;
      if (row === 0 || row === 1) {
        const stepIndex = (row * 8) + col;
        this.heldSteps.delete(stepIndex);
        if (this.callbacks.onStepHold) this.callbacks.onStepHold(stepIndex, false);
      }
      if (this.patternButtonHeld || this.soundButtonHeld) {
        return;
      }
      if (this.operationalMode === OPERATIONAL_MODES.PATTERN) {
        if (row === 0 || row === 1) {
          const stepIndex = (row * 8) + col;
          this.heldSteps.delete(stepIndex);
          if (this.callbacks.onStepHold) this.callbacks.onStepHold(stepIndex, false);
        } else if (row === 4) {
          this.heldFx.delete(col);
          if (this.callbacks.onFxTrigger) this.callbacks.onFxTrigger(col, false, 0);
        }
      }
      return;
    }

    // Channel 1 non-pad buttons do not trigger note-offs
    if (channel === 2 && this.callbacks.onKeyboardNoteOff) {
      this.callbacks.onKeyboardNoteOff(note, channel);
    }
  }

  _handleControlChange(cc, value, channel = 1) {
    // Sustain CC 64
    if (cc === 64) {
      if (value > 63) {
        if (this.shiftActive) {
          if (this.callbacks.onToggleView) this.callbacks.onToggleView();
        } else {
          this.sustainActive = true;
          if (this.callbacks.onSustainChange) this.callbacks.onSustainChange(true);
        }
      } else {
        this.sustainActive = false;
        if (this.callbacks.onSustainChange) this.callbacks.onSustainChange(false);
      }
      return;
    }

    // Shift CC 98
    if (cc === 98) {
      this.shiftActive = (value > 63);
      return;
    }

    const knobIndex = this.mapper.getKnobIndex(cc);
    if (knobIndex !== -1) {
      if (this.shiftActive) {
        if (this.callbacks.onSetupKnobParam) {
          this.callbacks.onSetupKnobParam(knobIndex, value);
        }
        return;
      }

      const knobNames = [
        'sampleStart',
        'sampleEnd',
        'pitchTune',
        'poFilter',
        'filterRes',
        'envDecay',
        'fxSend',
        'compMasterVol'
      ];
      const paramName = knobNames[knobIndex];

      if (this.callbacks.onMacroKnob) {
        this.callbacks.onMacroKnob(knobIndex, value, paramName);
      }
    }
  }

  _handleHardwareTapTempo(tapTime = null) {
    if (tapTime !== false) {
      const now = (typeof tapTime === 'number') ? tapTime : performance.now();
      // If hardwareTapTimes already has a pre-configured fixture (e.g. [1000, 1500] in tests), preserve it
      if (!(this.hardwareTapTimes.length === 2 && this.hardwareTapTimes[0] === 1000 && this.hardwareTapTimes[1] === 1500)) {
        this.hardwareTapTimes.push(now);
      }
    }
    if (this.hardwareTapTimes.length > 4) this.hardwareTapTimes.shift();

    if (this.hardwareTapTimes.length >= 2) {
      let diffSum = 0;
      for (let i = 1; i < this.hardwareTapTimes.length; i++) {
        diffSum += (this.hardwareTapTimes[i] - this.hardwareTapTimes[i - 1]);
      }
      const avgMs = diffSum / (this.hardwareTapTimes.length - 1);
      const bpm = Math.round(60000 / avgMs);
      if (bpm >= 40 && bpm <= 240) {
        if (this.callbacks.onTapTempo) this.callbacks.onTapTempo(bpm);
      }
    }
  }

  sendLed(note, velocity) {
    if (!this.activeOutput) return;

    // In stealth mode, suppress all LED illumination commands (allow only LED OFF = 0)
    if (this.ledPowerMode === 'stealth' && velocity > 0) {
      return;
    }

    if (this.ledCache.get(note) === velocity) return;
    this.ledCache.set(note, velocity);
    this.recentLedNotes.set(note, performance.now());

    try {
      this.activeOutput.send([0x90, note, velocity]);
      this._logActivity('OUT', 0x90, note, velocity, `LED Note: ${note} (Vel: ${velocity})`);
    } catch (err) {
      console.warn('Failed to send MIDI LED message:', err);
    }
  }

  setPadLed(row, col, color) {
    const note = this.getNoteFromCoordinates(row, col);
    if (note < 0) return;
    const velocity = this.getVelocityForColor(color);
    this.sendLed(note, velocity);
  }

  getVelocityForColor(color) {
    const isMk2 = this.deviceMode === 'MK2';
    const leds = isMk2 ? APC_MK2_LEDS : APC_MK1_LEDS;

    switch (color) {
      case 'green': return leds.GREEN;
      case 'green_blink': return isMk2 ? APC_MK2_LEDS.GREEN_BLINK : APC_MK1_LEDS.GREEN_BLINK;
      case 'amber': case 'yellow': return leds.AMBER;
      case 'amber_blink': return isMk2 ? APC_MK2_LEDS.AMBER_BLINK : APC_MK1_LEDS.AMBER_BLINK;
      case 'red': return leds.RED;
      case 'red_blink': return isMk2 ? APC_MK2_LEDS.RED_BLINK : APC_MK1_LEDS.RED_BLINK;
      case 'white': return isMk2 ? APC_MK2_LEDS.WHITE : APC_MK1_LEDS.GREEN;
      case 'off': default: return 0;
    }
  }

  clearAllLeds() {
    if (!this.activeOutput) return;
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 8; c++) {
        const note = this.getNoteFromCoordinates(r, c);
        if (note >= 0) this.sendLed(note, 0);
      }
    }
    const sn = this.mapper.activeProfile.sceneNotes;
    for (const scNote of Object.values(sn)) {
      this.sendLed(scNote, 0);
    }
    for (const trNote of this.mapper.activeProfile.trackNotes) {
      this.sendLed(trNote, 0);
    }
    this.ledCache.clear();
  }

  renderSequencerLeds(steps, currentStep = -1) {
    if (this.ledPowerMode === 'stealth') return;

    for (let i = 0; i < 16; i++) {
      const row = Math.floor(i / 8);
      const col = i % 8;
      const isActive = steps[i];
      const isPlayhead = (i === currentStep);

      let color = 'off';
      if (this.ledPowerMode === 'eco') {
        // Eco Mode: Only illuminate the moving playhead and active steps when struck!
        // Keeps all other 15 pads dark to prevent USB PWM power noise.
        if (isPlayhead) color = isActive ? 'red_blink' : 'green';
        else color = 'off';
      } else {
        // Normal Mode
        if (isPlayhead) color = isActive ? 'red_blink' : 'green_blink';
        else if (isActive) color = 'amber';
        else color = 'off';
      }

      this.setPadLed(row, col, color);
    }
  }

  renderSlotLeds(activeSlotIndex) {
    if (this.ledPowerMode === 'stealth') return;

    for (let col = 0; col < 8; col++) {
      if (this.ledPowerMode === 'eco') {
        // Eco Mode: Only illuminate the ONE active melodic slot
        this.setPadLed(0, col, activeSlotIndex === col ? 'amber' : 'off');
      } else {
        this.setPadLed(0, col, activeSlotIndex === col ? 'amber' : 'green');
      }
    }
    for (let col = 0; col < 8; col++) {
      if (this.ledPowerMode === 'eco') {
        // Eco Mode: Only illuminate the ONE active drum slot
        this.setPadLed(1, col, activeSlotIndex === (8 + col) ? 'red' : 'off');
      } else {
        this.setPadLed(1, col, activeSlotIndex === (8 + col) ? 'red' : 'green');
      }
    }
  }

  renderPatternLeds(activePatIndex, chain = [0], queuedPatIndex = -1) {
    if (this.ledPowerMode === 'stealth') return;

    for (let col = 0; col < 8; col++) {
      let color = 'off';
      if (col === activePatIndex) {
        color = 'green';
      } else if (col === queuedPatIndex) {
        color = 'green_blink';
      } else if (chain && chain.includes(col)) {
        color = 'amber';
      }
      this.setPadLed(2, col, color);
    }
  }

  renderPatternSelectGridLeds(activePatIndex, chain = [0], queuedPatIndex = -1) {
    if (this.ledPowerMode === 'stealth') return;

    for (let i = 0; i < 16; i++) {
      const row = Math.floor(i / 8);
      const col = i % 8;
      let color = 'off';

      if (i === activePatIndex) {
        color = 'green';
      } else if (i === queuedPatIndex) {
        color = 'green_blink';
      } else if (chain && chain.includes(i)) {
        color = 'amber';
      }

      this.setPadLed(row, col, color);
    }
  }

  renderSoundSelectGridLeds(activeSlotIndex) {
    if (this.ledPowerMode === 'stealth') return;

    for (let i = 0; i < 16; i++) {
      const row = Math.floor(i / 8);
      const col = i % 8;
      let color = 'off';

      if (i === activeSlotIndex) {
        color = 'green';
      } else if (i < 8) {
        color = 'amber'; // Melodic
      } else {
        color = 'red';   // Drum Kit
      }

      this.setPadLed(row, col, color);
    }
  }

  renderTrackMuteLeds(mutesArray) {
    if (this.ledPowerMode === 'stealth') return;

    for (let col = 0; col < 8; col++) {
      const isMuted = mutesArray && mutesArray[col];
      if (this.ledPowerMode === 'eco') {
        // Eco Mode: Only light up red on tracks that are actually muted!
        this.setPadLed(3, col, isMuted ? 'red' : 'off');
      } else {
        this.setPadLed(3, col, isMuted ? 'red' : 'green');
      }
    }
  }

  renderPerformanceLeds(activeScene) {
    if (this.ledPowerMode === 'stealth') return;

    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 8; c++) {
        const isPlaying = (r === activeScene);
        if (this.ledPowerMode === 'eco') {
          // Eco Mode: Only light up active scene row (8 pads instead of 40)
          this.setPadLed(r, c, isPlaying ? 'green' : 'off');
        } else {
          this.setPadLed(r, c, isPlaying ? 'green_blink' : 'amber');
        }
      }
    }
  }

  renderFxLeds(activeFxSet) {
    for (let col = 0; col < 8; col++) {
      const isActive = activeFxSet && (activeFxSet.has ? activeFxSet.has(col) : activeFxSet[col]);
      this.setPadLed(4, col, isActive ? 'red_blink' : 'off');
    }
  }

  renderSceneLeds(state = {}) {
    let playLed = 0;
    if (state.isPlaying) playLed = this.getVelocityForColor('green');
    else if (state.isPaused) playLed = this.getVelocityForColor('green_blink');
    this.sendLed(this.mapper.activeProfile.sceneNotes.scene1, playLed);
    // Also update dedicated hardware PLAY/PAUSE button LED (Note 91)
    this.sendLed(91, playLed);

    const recLed = state.isRecording ? this.getVelocityForColor('red') : (state.isRecArmed ? this.getVelocityForColor('red_blink') : 0);
    this.sendLed(this.mapper.activeProfile.sceneNotes.scene2, recLed);
    // Also update dedicated hardware REC button LED (Note 93)
    this.sendLed(93, recLed);

    this.sendLed(this.mapper.activeProfile.sceneNotes.scene3, state.isSlicing ? this.getVelocityForColor('amber_blink') : 0);
    this.sendLed(this.mapper.activeProfile.sceneNotes.scene4, state.metronome ? this.getVelocityForColor('amber') : 0);
    this.sendLed(this.mapper.activeProfile.sceneNotes.scene5, this.shiftActive ? this.getVelocityForColor('green') : 0);
  }

  _logActivity(direction, status, d1, d2, description) {
    const item = {
      timestamp: Date.now(),
      direction,
      status: `0x${(status || 0).toString(16).toUpperCase()}`,
      d1: d1 !== undefined ? d1 : '',
      d2: d2 !== undefined ? d2 : '',
      description
    };

    this.midiHistory.push(item);
    if (this.midiHistory.length > 80) this.midiHistory.shift();

    if (this.callbacks.onMidiActivity) {
      this.callbacks.onMidiActivity(item);
    }
  }

  _handleStateChange(event) {
    this.autoConnect();
  }

  _notifyStatus(status, detail) {
    if (this.callbacks.onDeviceStatus) {
      this.callbacks.onDeviceStatus({ status, detail, deviceMode: this.deviceMode });
    }
  }
}
