/**
 * Open-KO: UIManager
 * Coordinates 100% standalone hardware control for Akai APC Key 25 Mk1,
 * Guided Hardware Verification Wizard, Ultra-Minimal Teenage Engineering PO-33 / EP-133 Screen,
 * and view toggling.
 */

import { WaveformView } from './WaveformView.js';
import { HardwareGrid } from './HardwareGrid.js';
import { KeyboardView } from './KeyboardView.js';
import { MinimalPoView } from './MinimalPoView.js';
import { GuidedTester } from './GuidedTester.js';
import { MixerRackView } from './MixerRackView.js';
import { SampleLibrary } from '../presets/SampleLibrary.js';
import { AudioExporter } from '../audio/AudioExporter.js';
import {
  PUNCH_IN_FX_NAMES,
  OPERATIONAL_MODES
} from '../midi/ApcConstants.js';

export class UIManager {
  constructor(audioEngine, sequencer, midiManager) {
    this.audioEngine = audioEngine;
    this.sequencer = sequencer;
    this.midiManager = midiManager;

    this.heldStepIndex = -1;
    this._heldPadIndex = -1;
    this._pendingToggleOffStep = -1;
    this._stepModifiedDuringHold = false;
    this._lastNudgeKnobVal = null;
    this.selectedStepIndex = 0;
    this.knobBank = 'track'; // 'track' or 'master'
    this.knobValues = [0, 127, 64, 64, 20, 48, 0, 75];
    this.activePage = 0; // Active 16-step view page (0=P1..7=P8)
    this.followPlayhead = true; // Auto-flip page as arrangement plays

    this.waveformView = null;
    this.hardwareGrid = null;
    this.keyboardView = null;
    this.minimalPoView = null;
    this.guidedTester = null;
    this.mixerRackView = null;

    this.currentViewMode = 'debug'; // 'minimal' or 'debug'
    this._lastPlayheadStep = -1;
  }

  init() {
    this._bindDomElements();
    this._initViews();
    this._wireAudioAndMidiEvents();
    this._initKnobs();
    this._initTransportButtons();
    this._initModeSwitcher();
    this._initSongChainBar();
    this._initTouchStepGrid();
    this._initZoomAndSampleControls();
    this._initApcHoverHints();
    this._startMeterLoop();
    this.refreshAll();
  }

  _bindDomElements() {
    this.lcdBpm = document.getElementById('lcd-bpm');
    this.lcdPattern = document.getElementById('lcd-pattern');
    this.lcdSlot = document.getElementById('lcd-slot');
    this.lcdSlotName = document.getElementById('lcd-slot-name');
    this.lcdFilter = document.getElementById('lcd-filter');
    this.lcdVoices = document.getElementById('lcd-voices');
    this.lcdStatusMsg = document.getElementById('lcd-status-msg');
    this.vuMeterL = document.getElementById('vu-meter-l');
    this.vuMeterR = document.getElementById('vu-meter-r');
    this.inputVuBar = document.getElementById('input-vu-bar');
    this.midiLedIn = document.getElementById('midi-led-in');
    this.midiLedOut = document.getElementById('midi-led-out');
    this.viewToggleBtn = document.getElementById('btn-toggle-view');
    this.midiLogTable = document.getElementById('midi-log-table');
    this.settingsModal = document.getElementById('settings-modal');
  }

  _initViews() {
    // 1. Ultra-Minimalist Teenage Engineering PO-33 / EP-133 LCD Screen
    const poContainer = document.getElementById('po-screen-wrapper');
    if (poContainer) {
      this.minimalPoView = new MinimalPoView(poContainer, this.audioEngine, this.sequencer);
    }

    // 2. Guided Hardware Test Suite & Calibration Inspector
    this.guidedTester = new GuidedTester(this.midiManager, this.audioEngine);
    const testBtn = document.getElementById('btn-open-tester');
    if (testBtn) {
      testBtn.addEventListener('click', () => this.guidedTester.open('diagnostic'));
    }
    const layoutBtn = document.getElementById('btn-layout-map');
    if (layoutBtn) {
      layoutBtn.addEventListener('click', () => this.guidedTester.open('layout'));
    }

    const ledPowerBtn = document.getElementById('btn-led-power');
    if (ledPowerBtn) {
      ledPowerBtn.addEventListener('click', () => {
        const modes = ['normal', 'eco', 'stealth'];
        const curIdx = modes.indexOf(this.midiManager.ledPowerMode);
        const nextMode = modes[(curIdx + 1) % modes.length];
        this.midiManager.setLedPowerMode(nextMode);

        if (nextMode === 'eco') {
          ledPowerBtn.textContent = '⚡ LED: ECO (SILENT)';
          ledPowerBtn.style.borderColor = '#2ecc71';
          ledPowerBtn.style.color = '#2ecc71';
          this._updateLcdStatus('LED POWER: ECO (REDUCED USB CURRENT // SILENT GROUND)');
        } else if (nextMode === 'stealth') {
          ledPowerBtn.textContent = '⚡ LED: STEALTH (OFF)';
          ledPowerBtn.style.borderColor = '#828997';
          ledPowerBtn.style.color = '#828997';
          this._updateLcdStatus('LED POWER: STEALTH (ALL HARDWARE LEDS DISABLED)');
        } else {
          ledPowerBtn.textContent = '⚡ LED: NORMAL';
          ledPowerBtn.style.borderColor = '#f39c12';
          ledPowerBtn.style.color = '#ff9f43';
          this._updateLcdStatus('LED POWER: NORMAL (ALL LEDS ACTIVE)');
        }
        this._syncPadGridLeds();
      });
    }

    const knobBankBtn = document.getElementById('btn-knob-bank');
    if (knobBankBtn) {
      knobBankBtn.addEventListener('click', () => {
        if (this.midiManager.callbacks.onToggleKnobBank) {
          this.midiManager.callbacks.onToggleKnobBank();
        }
        knobBankBtn.textContent = (this.knobBank === 'master') ? '🎛 MASTER KNOBS' : '🎛 TRACK KNOBS';
        knobBankBtn.style.color = (this.knobBank === 'master') ? '#ff9f43' : '#61afef';
        knobBankBtn.style.borderColor = (this.knobBank === 'master') ? '#ff9f43' : '#61afef';
      });
    }

    const exportBtn = document.getElementById('btn-export-audio');
    if (exportBtn) {
      exportBtn.addEventListener('click', async () => {
        try {
          this._updateLcdStatus('RENDERING OFFLINE AUDIO (0% -> 100%)...');
          exportBtn.textContent = '⏳ RENDERING...';
          exportBtn.disabled = true;

          const wavBlob = await AudioExporter.exportArrangement(
            this.audioEngine,
            this.sequencer,
            (pct) => {
              this._updateLcdStatus(`EXPORTING WAV: ${pct}%`);
            }
          );

          const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
          const filename = `open_ko_arrangement_${dateStr}.wav`;
          AudioExporter.downloadBlob(wavBlob, filename);

          exportBtn.textContent = '⬇ EXPORT WAV';
          exportBtn.disabled = false;
          this._updateLcdStatus(`EXPORT COMPLETE: ${filename} DOWNLOADED`);
          if (this.minimalPoView) this.minimalPoView.triggerPunch('EXPORT!');
        } catch (err) {
          console.error('Export failed:', err);
          exportBtn.textContent = '⬇ EXPORT WAV';
          exportBtn.disabled = false;
          this._updateLcdStatus(`EXPORT ERROR: ${err.message}`);
        }
      });
    }

    // 3. Waveform Canvas View
    const canvas = document.getElementById('waveform-canvas');
    this.waveformView = new WaveformView(
      canvas,
      (start, end) => {
        this._updateLcdStatus(`TRIM: ${(start * 100).toFixed(0)}% - ${(end * 100).toFixed(0)}%`);
        this.knobValues[0] = Math.round(start * 127);
        this.knobValues[1] = Math.round(end * 127);
        this._renderKnob(0);
        this._renderKnob(1);
        this._syncPoState();
      },
      (sliceIdx, start, end) => {
        this._updateLcdStatus(`SLICE ${sliceIdx + 1}: ${start.toFixed(2)}s`);
      }
    );

    // 4. Hardware 8x5 Pad Grid & Scene Buttons
    const gridContainer = document.getElementById('apc-grid-container');
    this.hardwareGrid = new HardwareGrid(gridContainer, {
      onStepClick: (padIdx) => {
        const activeSlot = this.audioEngine.activeSlotIndex;
        const stepIdx = (this.activePage * 16) + padIdx;
        const newState = this.sequencer.toggleStep(activeSlot, stepIdx);
        this._syncSequencerLeds();
        this._updateTouchStepGrid();
        this._updateLcdStatus(`STEP ${stepIdx + 1} ${newState ? 'ON' : 'OFF'}`);
        if (this.minimalPoView) this.minimalPoView.triggerPunch(newState ? 'STEP ON' : 'STEP OFF');
      },
      onStepHold: (padIdx, isHeld) => {
        const stepIdx = (this.activePage * 16) + padIdx;
        this.heldStepIndex = isHeld ? stepIdx : -1;
        this._updateLcdStatus(isHeld ? `HOLDING STEP ${stepIdx + 1}: TWEAK KNOB TO P-LOCK` : 'READY');
        this._syncPoState();
      },
      onSlotClick: (slotIdx, type) => {
        this.selectSlot(slotIdx);
      },
      onFxTrigger: (fxIdx, active) => {
        this.audioEngine.punchInFx.trigger(fxIdx, active);
        this._syncFxLeds();
        if (active) {
          this._updateLcdStatus(`PUNCH-IN FX: ${PUNCH_IN_FX_NAMES[fxIdx]}`);
          if (this.minimalPoView) this.minimalPoView.triggerPunch('POW!');
        }
        this._syncPoState();
      },
      onSceneClick: (sceneIdx, isPressed) => {
        if (!isPressed) return;
        this._handleSceneAction(sceneIdx);
      }
    });

    // 5. 25-Key Piano Keyboard
    const kbdContainer = document.getElementById('apc-keyboard-container');
    this.keyboardView = new KeyboardView(kbdContainer, {
      onNoteOn: (note, velocity) => {
        this._onKeyboardHit(note, velocity);
      },
      onNoteOff: (note) => {
        this.audioEngine.stopActiveSlot(note);
      }
    });

    // 6. 16-Track Simultaneous Layering Multitrack Mixer & Master DSP Rack
    this.mixerRackView = new MixerRackView(this.audioEngine, this.sequencer, {
      onSlotSelect: (slotIdx) => this.selectSlot(slotIdx),
      onMuteToggle: (slotIdx, isMuted) => {
        this._syncTrackMuteLeds();
        const slot = this.audioEngine.slots[slotIdx];
        this._updateLcdStatus(`${slot ? slot.name : `Track ${slotIdx + 1}`} ${isMuted ? 'MUTED' : 'UNMUTED'}`);
      },
      onSoloToggle: (slotIdx, isSolo) => {
        this._syncTrackMuteLeds();
        const slot = this.audioEngine.slots[slotIdx];
        this._updateLcdStatus(`${slot ? slot.name : `Track ${slotIdx + 1}`} ${isSolo ? 'SOLOED' : 'SOLO OFF'}`);
      },
      onVolumeChange: (slotIdx, vol) => {
        const slot = this.audioEngine.slots[slotIdx];
        this._updateLcdStatus(`${slot ? slot.name : `Track ${slotIdx + 1}`} VOL: ${Math.round(vol * 100)}%`);
      },
      onDuckToggle: (slotIdx, isDucked) => {
        const slot = this.audioEngine.slots[slotIdx];
        this._updateLcdStatus(`${slot ? slot.name : `Track ${slotIdx + 1}`} SIDECHAIN DUCK: ${isDucked ? 'ON' : 'BYPASS'}`);
      },
      onFxTrigger: (fxIdx, active) => {
        this._syncFxLeds();
        if (active) this._updateLcdStatus(`PUNCH-IN FX: ${PUNCH_IN_FX_NAMES[fxIdx]}`);
      }
    });
    this.mixerRackView.init();
  }

  _wireAudioAndMidiEvents() {
    this.midiManager.callbacks.onTransportPlayPause = () => {
      this.sequencer.togglePlayPause();
    };

    this.midiManager.callbacks.onTransportStop = () => {
      this.heldStepIndex = -1;
      if (this.midiManager && this.midiManager.heldSteps) this.midiManager.heldSteps.clear();
      this.sequencer.stopAndReset();
      this._updateLcdStatus('STOPPED // RESET TO START');
      this._syncPoState();
    };

    this.midiManager.callbacks.onRecordToggle = () => {
      this.sequencer.toggleRecord();
    };

    this.midiManager.callbacks.onToggleRecordMode = () => {
      this._handleHardwarePatternTool('toggleRecMode');
    };

    this.midiManager.callbacks.onLiveSampleToggle = () => {
      this._toggleLiveSampling('mic');
    };

    this.midiManager.callbacks.onModeChange = (newMode) => {
      this.setMode(newMode);
    };

    this.midiManager.callbacks.onPatternSelect = (patIdx) => {
      if (this.sequencer.isPlaying) {
        this.sequencer.queuePattern(patIdx);
        this._updateLcdStatus(`PATTERN ${patIdx + 1} QUEUED (NEXT BAR)`);
      } else {
        this.sequencer.setPattern(patIdx);
        this._updateLcdStatus(`PATTERN ${patIdx + 1} SELECTED`);
      }
      this._renderSongChainBar();
      this._syncPadGridLeds();
      this._syncPoState();
    };

    this.midiManager.callbacks.onPatternModeHold = (isHeld) => {
      if (isHeld) {
        this._updateLcdStatus('PATTERN HOLD (◄) // TAP PAD 1-16 TO SELECT OR CHAIN');
        this._syncPatternSelectGridLeds();
      } else {
        this._syncPadGridLeds();
        this._syncPoState();
      }
    };

    this.midiManager.callbacks.onSoundModeHold = (isHeld) => {
      if (isHeld) {
        this._updateLcdStatus('SOUND HOLD (►) // ROW 1: MELODIC (1-8) | ROW 2: DRUM (9-16)');
        this._syncSoundSelectGridLeds();
      } else {
        this._syncPadGridLeds();
        this._syncPoState();
      }
    };

    this.midiManager.callbacks.onTrackMuteToggle = (trackIdx) => {
      const isMuted = this.sequencer.toggleTrackMute(trackIdx);
      const slot = this.audioEngine.slots[trackIdx];
      this._updateLcdStatus(`${slot ? slot.name : `Track ${trackIdx + 1}`} ${isMuted ? 'MUTED' : 'UNMUTED'}`);
      this._syncPadGridLeds();
    };

    this.midiManager.callbacks.onClipLaunch = (sceneIdx, trackIdx) => {
      this.sequencer.setPattern(sceneIdx);
      this._updateLcdStatus(`LAUNCHED SCENE ${sceneIdx + 1} // TRACK ${trackIdx + 1}`);
      this._syncPadGridLeds();
      this._syncPoState();
    };

    this.midiManager.callbacks.onTapTempo = (bpm) => {
      this.sequencer.setBpm(bpm);
      if (this.lcdBpm) this.lcdBpm.textContent = `${bpm}`;
      this._updateLcdStatus(`TAP TEMPO: ${bpm} BPM`);
      this._syncPoState();
    };

    this.midiManager.callbacks.onNavArrow = (direction) => {
      const curPat = this.sequencer.getCurrentPattern();
      const maxPages = curPat ? (curPat.zoom || 1) : 1;

      if (direction === 'up') {
        if (maxPages > 1) {
          const prevPage = (this.activePage - 1 + maxPages) % maxPages;
          this.setPatternPage(prevPage);
        } else {
          const prevSlot = (this.audioEngine.activeSlotIndex - 1 + 16) % 16;
          this.selectSlot(prevSlot);
          const slot = this.audioEngine.slots[prevSlot];
          this._updateLcdStatus(`TRACK ▲: ${prevSlot + 1}. ${slot.name.toUpperCase()}`);
        }
      } else if (direction === 'down') {
        if (maxPages > 1) {
          const nextPage = (this.activePage + 1) % maxPages;
          this.setPatternPage(nextPage);
        } else {
          const nextSlot = (this.audioEngine.activeSlotIndex + 1) % 16;
          this.selectSlot(nextSlot);
          const slot = this.audioEngine.slots[nextSlot];
          this._updateLcdStatus(`TRACK ▼: ${nextSlot + 1}. ${slot.name.toUpperCase()}`);
        }
      } else if (direction === 'left') {
        const prevPat = (this.sequencer.activePatternIndex - 1 + 16) % 16;
        this.sequencer.setPattern(prevPat);
        this._updateLcdStatus(`PATTERN ◄: P${prevPat + 1}`);
      } else if (direction === 'right') {
        const nextPat = (this.sequencer.activePatternIndex + 1) % 16;
        this.sequencer.setPattern(nextPat);
        this._updateLcdStatus(`PATTERN ►: P${nextPat + 1}`);
      }
      this._syncPoState();
    };

    this.midiManager.callbacks.onSampleCycle = (direction) => {
      const activeSlot = this.audioEngine.getActiveSlot();
      const res = SampleLibrary.cyclePreset(
        this.audioEngine.ctx,
        activeSlot.name,
        activeSlot.type,
        direction
      );

      activeSlot.loadBuffer(res.buffer);
      activeSlot.name = res.name;
      if (activeSlot.type === 'drum') {
        activeSlot.autoSlice();
      }

      this.refreshSlotDisplay();
      this.waveformView.render();
      this._updateLcdStatus(`SAMPLE: [${res.name.toUpperCase()}] (${res.category})`);
      if (this.minimalPoView) this.minimalPoView.triggerPunch('SAMP!');

      // Audition preview
      if (activeSlot.type === 'melodic') {
        this.audioEngine.playActiveSlot(60, 105);
      } else {
        this.audioEngine.playActiveSlot(0, 105);
      }
    };

    this.midiManager.callbacks.onToggleKnobBank = () => {
      this.knobBank = (this.knobBank === 'master') ? 'track' : 'master';
      const slot = this.audioEngine.getActiveSlot();
      const knobBankBtn = document.getElementById('btn-knob-bank');
      if (knobBankBtn) {
        knobBankBtn.textContent = (this.knobBank === 'master') ? '🎛 MASTER KNOBS' : '🎛 TRACK KNOBS';
        knobBankBtn.style.color = (this.knobBank === 'master') ? '#ff9f43' : '#61afef';
        knobBankBtn.style.borderColor = (this.knobBank === 'master') ? '#ff9f43' : '#61afef';
      }
      this._updateKnobLabels();
      if (this.knobBank === 'master') {
        this._updateLcdStatus('🎛 KNOBS: MASTER MIXER (BPM, SWING, DELAY, COMP)');
      } else {
        this._updateLcdStatus(`🎛 KNOBS: TRACK ${this.audioEngine.activeSlotIndex + 1} [${slot.name.toUpperCase()}]`);
      }
      this._syncPoState();
    };

    this.midiManager.callbacks.onPatternChainAppend = (patIdx) => {
      this.sequencer.patternChain.push(patIdx);
      this._renderSongChainBar();
      this._updateLcdStatus(`CHAIN: APPENDED P${patIdx + 1} (${this.sequencer.patternChain.length} BARS)`);
      if (this.minimalPoView) this.minimalPoView.triggerPunch(`CHAIN P${patIdx + 1}`);
    };

    this.midiManager.callbacks.onPatternChainAppendCurrent = () => {
      const curPat = this.sequencer.activePatternIndex;
      this.sequencer.patternChain.push(curPat);
      this._renderSongChainBar();
      this._updateLcdStatus(`CHAIN: APPENDED P${curPat + 1} (${this.sequencer.patternChain.length} BARS)`);
      if (this.minimalPoView) this.minimalPoView.triggerPunch(`CHAIN P${curPat + 1}`);
    };

    this.midiManager.callbacks.onPatternChainReset = () => {
      const curPat = this.sequencer.activePatternIndex;
      this.sequencer.setPatternChain([curPat]);
      this._renderSongChainBar();
      this._updateLcdStatus(`CHAIN: RESET TO SINGLE LOOP (P${curPat + 1})`);
      if (this.minimalPoView) this.minimalPoView.triggerPunch('RESET');
    };

    this.midiManager.callbacks.onToggleView = () => {
      this.toggleViewMode();
    };

    this.midiManager.callbacks.onToggleSetupModal = () => {
      if (this.settingsModal) {
        this.settingsModal.classList.toggle('open');
        this._updateLcdStatus(this.settingsModal.classList.contains('open') ? 'SETUP OPEN (KNOBS 1-4 TWEAK)' : 'SETUP SAVED & CLOSED');
      }
    };

    this.midiManager.callbacks.onToggleTesterModal = () => {
      if (this.guidedTester.modal && this.guidedTester.modal.classList.contains('open')) {
        this.guidedTester.close();
      } else {
        this.guidedTester.open('diagnostic');
      }
    };

    this.midiManager.callbacks.onToggleLayoutModal = () => {
      this.guidedTester.open('layout');
    };

    this.midiManager.callbacks.onSustainChange = (active) => {
      this.audioEngine.setSustain(active);
      this._updateLcdStatus(active ? 'SUSTAIN: ON' : 'SUSTAIN: OFF');
      this._lastParamMsg = active ? 'SUST ON' : 'SUST OFF';
      this._syncPoState();
    };

    this.midiManager.callbacks.onOctaveChange = (baseNote) => {
      const octaveNum = Math.floor(baseNote / 12) - 1;
      this._updateLcdStatus(`OCTAVE: C${octaveNum} (NOTE #${baseNote})`);
      this._lastParamMsg = `OCT C${octaveNum}`;
      this._syncPoState();
    };

    this.midiManager.callbacks.onPatternTool = (action) => {
      this._handleHardwarePatternTool(action);
    };

    this.midiManager.callbacks.onSampleTool = (toolIdx) => {
      this._handleHardwareSampleTool(toolIdx);
    };

    this.midiManager.callbacks.onSetupKnobParam = (knobIdx, value) => {
      this._handleSetupKnobParam(knobIdx, value);
    };

    this.midiManager.callbacks.onStepToggle = (padIdx, velocity) => {
      const activeSlot = this.audioEngine.activeSlotIndex;
      const stepIdx = (this.activePage * 16) + padIdx;
      this.selectedStepIndex = padIdx;
      const pat = this.sequencer.getCurrentPattern();
      const step = (pat && pat.tracks[activeSlot]) ? pat.tracks[activeSlot][stepIdx] : null;

      if (step && step.active) {
        // Defer turning off an already-active step until release so holding the pad
        // lets the user inspect, P-Lock, or 128th-nudge without deleting the step!
        this._pendingToggleOffStep = stepIdx;
        this._stepModifiedDuringHold = false;
        this._updateTouchStepGrid();
        this._updateStepInspector(activeSlot, stepIdx);
      } else {
        this._pendingToggleOffStep = -1;
        this._stepModifiedDuringHold = false;
        this.sequencer.toggleStep(activeSlot, stepIdx, velocity);
        this._syncSequencerLeds();
        this._updateTouchStepGrid();
        this._updateStepInspector(activeSlot, stepIdx);
        if (this.minimalPoView) this.minimalPoView.triggerPunch('STEP!');
      }
    };

    this.midiManager.callbacks.onStepHold = (padIdx, isHeld) => {
      const activeSlot = this.audioEngine.activeSlotIndex;
      const stepIdx = (this.activePage * 16) + padIdx;
      if (isHeld) {
        this.heldStepIndex = stepIdx;
        this._heldPadIndex = padIdx;
        this._lastNudgeKnobVal = null;
        this.selectedStepIndex = padIdx;
        this._updateTouchStepGrid();
        this._updateStepInspector(activeSlot, stepIdx);
        this._updateLcdStatus(`HOLD STEP ${stepIdx + 1}: KNOBS = P-LOCK // SHIFT+K3 = 128th NUDGE`);
      } else {
        if (this._pendingToggleOffStep === stepIdx && !this._stepModifiedDuringHold) {
          this.sequencer.toggleStep(activeSlot, stepIdx);
          if (this.minimalPoView) this.minimalPoView.triggerPunch('STEP OFF');
        }
        this._pendingToggleOffStep = -1;
        this._stepModifiedDuringHold = false;
        this.heldStepIndex = -1;
        this._heldPadIndex = -1;
        this._lastNudgeKnobVal = null;
        this._syncSequencerLeds();
        this._updateTouchStepGrid();
        this._updateLcdStatus('READY');
      }
      this._syncPoState();
    };

    this.midiManager.callbacks.onSlotSelect = (slotIdx, type) => {
      this.selectSlot(slotIdx);
    };

    this.midiManager.callbacks.onFxTrigger = (fxIdx, active, velocity) => {
      this.audioEngine.punchInFx.trigger(fxIdx, active, velocity);
      this._syncFxLeds();
      if (active) {
        this._flashMidiLed('in');
        this._updateLcdStatus(`FX: ${PUNCH_IN_FX_NAMES[fxIdx]}`);
        if (this.minimalPoView) this.minimalPoView.triggerPunch('K.O!');
      }
      this._syncPoState();
    };

    this.midiManager.callbacks.onKeyboardNoteOn = (note, velocity) => {
      this._flashMidiLed('in');
      this._onKeyboardHit(note, velocity);
      this.keyboardView.highlightExternalNote(note, true);
    };

    this.midiManager.callbacks.onKeyboardNoteOff = (note) => {
      this.audioEngine.stopActiveSlot(note);
      this.keyboardView.highlightExternalNote(note, false);
    };

    this.midiManager.callbacks.onMacroKnob = (knobIdx, value, paramName) => {
      this._flashMidiLed('in');
      this.setKnobValue(knobIdx, value, true);
    };

    this.midiManager.callbacks.onMidiActivity = (activity) => {
      this._appendMidiLog(activity);
    };

    // Sequencer Events
    this.sequencer.onStepTick = (stepIdx, patternIdx) => {
      this._lastPlayheadStep = stepIdx;
      if (this.followPlayhead && stepIdx >= 0) {
        const playheadPage = Math.floor(stepIdx / 16);
        if (playheadPage !== this.activePage) {
          this.activePage = playheadPage;
        }
      }
      this._syncSequencerLeds();
      this._updateTouchStepGrid();

      const activeSlot = this.audioEngine.activeSlotIndex;
      const steps = this.sequencer.getTrackSteps(activeSlot);
      if (this.minimalPoView) {
        this.minimalPoView.updateLeds(steps, stepIdx);
      }

      const slot = this.audioEngine.getActiveSlot();
      if (slot && slot.buffer && stepIdx >= 0) {
        this.waveformView.setPlayhead((stepIdx % 16) / 16);
      } else {
        this.waveformView.setPlayhead(-1);
      }
    };

    this.sequencer.onPlayChange = (isPlaying, isPaused) => {
      this.heldStepIndex = -1;
      if (this.midiManager && this.midiManager.heldSteps) this.midiManager.heldSteps.clear();
      this._syncSceneLeds();
      this._updatePlayButtonState(isPlaying, isPaused);
      this._syncPoState();
      if (isPlaying) this._updateLcdStatus('PLAYING');
      else if (isPaused) this._updateLcdStatus('PAUSED (CURSOR PRESERVED)');
      else this._updateLcdStatus('STOPPED');
    };

    this.sequencer.onRecordStateChange = (isRecording, recordMode = this.sequencer.recordMode, isWaitingForFirstHit = this.sequencer.isWaitingForFirstHit) => {
      this._syncSceneLeds();
      this._updateRecButtonState(isRecording);
      this._updateRecModeButtonState();
      this._syncPoState();
      if (isRecording) {
        if (recordMode === 'freeform' && isWaitingForFirstHit) {
          this._updateLcdStatus('● FREEFORM ARMED (128th) // STRIKE FIRST KEY TO START LOOP!');
          if (this.minimalPoView) this.minimalPoView.triggerPunch('ARMED');
        } else if (recordMode === 'freeform') {
          this._updateLcdStatus('● CAPTURING FREEFORM LOOP // TAP REC ON DOWNBEAT TO AUTO-CALC BPM');
          if (this.minimalPoView) this.minimalPoView.triggerPunch('FREE!');
        } else {
          this._updateLcdStatus('● QUANTIZED OVERDUB ON (128th MICRO-TIMING) // JAM KEYS TO LOOP');
          if (this.minimalPoView) this.minimalPoView.triggerPunch('REC ON');
        }
      } else {
        this._updateLcdStatus(this.sequencer.isPlaying ? 'LOOP PLAYING // RECORDING SAVED' : 'RECORDING DISARMED');
      }
    };

    this.sequencer.onFreeformLoopCaptured = ({ bpm, barCount, eventsCount }) => {
      if (this.lcdBpm) this.lcdBpm.textContent = `${bpm}`;
      this._syncSequencerLeds();
      this._updateTouchStepGrid();
      this._syncSceneLeds();
      if (this.mixerRackView) {
        this.mixerRackView.updateStepCounts();
      }
      this._updateLcdStatus(`AUTO-BPM LOCKED: ${bpm} BPM (${barCount} BAR // ${eventsCount} HITS ON 128th GRID)`);
      if (this.minimalPoView) this.minimalPoView.triggerPunch(`${bpm}BPM`);
      this._syncPoState();
    };

    this.sequencer.onStepRecorded = (slotIdx, stepIdx) => {
      if (slotIdx === this.audioEngine.activeSlotIndex) {
        this._syncSequencerLeds();
        this._updateTouchStepGrid();
      }
      if (this.mixerRackView) {
        this.mixerRackView.updateStepCounts();
      }
    };

    this.sequencer.onPatternChange = (patIdx, chainPos) => {
      if (this.lcdPattern) this.lcdPattern.textContent = `P${patIdx + 1}`;
      this._syncSequencerLeds();
      this._updateTouchStepGrid();
      this._renderSongChainBar();
      this._syncPoState();
      if (this.mixerRackView) {
        this.mixerRackView.updateStepCounts();
        this.mixerRackView.updateMuteAndSoloStates();
      }
    };

    this.sequencer.onPatternQueued = (queuedIdx) => {
      this._syncPatternLeds();
      if (this.midiManager.patternButtonHeld) {
        this._syncPatternSelectGridLeds();
      }
    };

    // Audio Recorder Event
    this.audioEngine.recorder.onLevelUpdate = (peak) => {
      if (this.inputVuBar) {
        const pct = Math.min(100, Math.round(peak * 100));
        this.inputVuBar.style.width = `${pct}%`;
        this.inputVuBar.style.backgroundColor = (peak > 0.95) ? '#e74c3c' : '#2ecc71';
      }
    };

    this.audioEngine.recorder.onRecordComplete = (audioBuffer) => {
      const activeSlot = this.audioEngine.getActiveSlot();
      activeSlot.loadBuffer(audioBuffer);
      activeSlot.name = `Rec ${Date.now().toString().slice(-4)}`;
      if (activeSlot.type === 'drum') {
        activeSlot.autoSlice();
      }
      this._updateSamplingButtons(false, null);
      this.refreshSlotDisplay();
      this.waveformView.render();
      this._updateLcdStatus('SAMPLE RECORDED & NORMALIZED (-0.5 dB)');
      if (this.minimalPoView) this.minimalPoView.triggerPunch('SAMPLED!');
    };
  }

  _handleHardwarePatternTool(action) {
    const curPattern = this.sequencer.getCurrentPattern();
    const curSlot = this.audioEngine.activeSlotIndex;

    switch (action) {
      case 'clearTrack':
        curPattern.clearTrack(curSlot);
        this._syncSequencerLeds();
        this._updateTouchStepGrid();
        this._updateLcdStatus('CLEARED ACTIVE TRACK STEPS');
        break;
      case 'duplicatePattern':
        const nextPat = this.sequencer.duplicateCurrentPattern();
        this._renderSongChainBar();
        this._updateLcdStatus(`DUPLICATED TO PATTERN ${nextPat + 1}`);
        break;
      case 'shiftLeft':
        curPattern.shiftTrackSteps(curSlot, -1);
        this._syncSequencerLeds();
        this._updateTouchStepGrid();
        this._updateLcdStatus('SHIFTED TRACK STEPS LEFT');
        break;
      case 'shiftRight':
        curPattern.shiftTrackSteps(curSlot, 1);
        this._syncSequencerLeds();
        this._updateTouchStepGrid();
        this._updateLcdStatus('SHIFTED TRACK STEPS RIGHT');
        break;
      case 'humanize':
        curPattern.humanizeTrackVelocity(curSlot, 18);
        this._updateLcdStatus('HUMANIZED TRACK VELOCITIES');
        break;
      case 'cycleSwing':
        const swings = [50, 54, 58, 62, 66];
        const nextIdx = (swings.indexOf(this.sequencer.swing) + 1) % swings.length;
        this.sequencer.setSwing(swings[nextIdx]);
        this._updateLcdStatus(`SWING: ${this.sequencer.swing}%`);
        this._syncPoState();
        break;
      case 'doubleBpm':
        this.sequencer.setBpm(this.sequencer.bpm * 2);
        if (this.lcdBpm) this.lcdBpm.textContent = `${this.sequencer.bpm}`;
        this._updateLcdStatus(`2X TEMPO: ${this.sequencer.bpm} BPM`);
        this._syncPoState();
        break;
      case 'halfBpm':
        this.sequencer.setBpm(Math.round(this.sequencer.bpm / 2));
        if (this.lcdBpm) this.lcdBpm.textContent = `${this.sequencer.bpm}`;
        this._updateLcdStatus(`0.5X TEMPO: ${this.sequencer.bpm} BPM`);
        this._syncPoState();
        break;
      case 'toggleRecMode': {
        const newMode = this.sequencer.toggleRecordMode();
        this._updateRecModeButtonState();
        this._updateLcdStatus(`REC MODE: ${newMode.toUpperCase()} (${newMode === 'freeform' ? 'AUTO-BPM ON 128th GRID' : 'QUANTIZED OVERDUB'})`);
        if (this.minimalPoView) this.minimalPoView.triggerPunch(newMode === 'freeform' ? 'FREE' : 'QUANT');
        break;
      }
      case 'cycleZoom': {
        const curZoom = curPattern ? (curPattern.zoom || 1) : 1;
        const zooms = [1, 2, 4, 8];
        const nextZoom = zooms[(zooms.indexOf(curZoom) + 1) % zooms.length];
        this.setPatternZoom(nextZoom);
        if (this.minimalPoView) this.minimalPoView.triggerPunch(`${nextZoom}X`);
        break;
      }
      case 'nudgePrev':
      case 'nudgeNext': {
        const delta = action === 'nudgeNext' ? 1 : -1;
        const pageOffset = this.activePage * 16;
        const targetStep = (this.heldStepIndex >= 0) ? this.heldStepIndex : (pageOffset + (this.selectedStepIndex || 0));
        const res = this.sequencer.nudgeStep(curSlot, targetStep, delta);
        if (res) {
          this._stepModifiedDuringHold = true;
          if (this.heldStepIndex >= 0) this.heldStepIndex = res.newStep;
          this.activePage = Math.floor(res.newStep / 16);
          this.selectedStepIndex = res.newStep % 16;
          this._updateTouchStepGrid();
          this._syncSequencerLeds();
          this._updateStepInspector(curSlot, res.newStep);
          this._updateLcdStatus(`NUDGE STEP ${res.newStep + 1}: ${res.microTiming >= 0 ? '+' : ''}${res.microTiming}/128th`);
        } else {
          this._updateLcdStatus(`SELECT AN ACTIVE STEP TO NUDGE ON 128th GRID`);
        }
        break;
      }
      case 'toggleSidechain': {
        const enabled = this.audioEngine.toggleSidechain();
        this._updateSidechainToggleState();
        if (this.mixerRackView) this.mixerRackView.updateDspReadouts(this.knobValues);
        this._updateLcdStatus(`MASTER SIDECHAIN DUCKING: ${enabled ? 'ON' : 'OFF'}`);
        if (this.minimalPoView) this.minimalPoView.triggerPunch(enabled ? 'SC ON' : 'SC OFF');
        break;
      }
      case 'toggleTrackDuck': {
        const slot = this.audioEngine.slots[curSlot];
        if (slot) {
          slot.sidechainDucked = !slot.sidechainDucked;
          if (this.mixerRackView) this.mixerRackView.updateMuteAndSoloStates();
          this._updateLcdStatus(`TRACK ${curSlot + 1} [${slot.name.toUpperCase()}] SIDECHAIN DUCK: ${slot.sidechainDucked ? 'ON' : 'BYPASS'}`);
          if (this.minimalPoView) this.minimalPoView.triggerPunch(slot.sidechainDucked ? 'DUCK' : 'DRY');
        }
        break;
      }
      case 'setSidechainSource': {
        this.audioEngine.setSidechainSource(curSlot);
        const slot = this.audioEngine.slots[curSlot];
        if (slot) slot.sidechainDucked = false; // Trigger source track should not duck itself
        if (this.mixerRackView) {
          this.mixerRackView.updateMuteAndSoloStates();
          this.mixerRackView.updateDspReadouts(this.knobValues);
        }
        this._updateLcdStatus(`SIDECHAIN TRIGGER SOURCE: TRACK ${curSlot + 1} [${slot ? slot.name.toUpperCase() : ''}]`);
        if (this.minimalPoView) this.minimalPoView.triggerPunch(`SRC T${curSlot + 1}`);
        break;
      }
      case 'toggleFollow': {
        this.followPlayhead = !this.followPlayhead;
        const followBtn = document.getElementById('btn-toggle-follow');
        if (followBtn) {
          followBtn.textContent = `FOLLOW: ${this.followPlayhead ? 'ON' : 'OFF'}`;
          followBtn.style.color = this.followPlayhead ? '#26de81' : '#828997';
        }
        this._updateLcdStatus(`PLAYHEAD PAGE FOLLOW: ${this.followPlayhead ? 'ON' : 'OFF'}`);
        break;
      }
    }
  }

  _handleHardwareSampleTool(toolIdx) {
    const slot = this.audioEngine.getActiveSlot();
    if (!slot || !slot.buffer) {
      this._updateLcdStatus('CANNOT EDIT: SLOT EMPTY');
      return;
    }

    switch (toolIdx) {
      case 0:
        this._triggerAutoSlice();
        break;
      case 1:
        slot.type = 'drum';
        slot.autoSlice();
        this.waveformView.render();
        this._updateLcdStatus('EQUAL 16-SLICE DIVISION');
        break;
      case 2:
        this._reverseBuffer(slot.buffer);
        this.waveformView.render();
        this._updateLcdStatus('SAMPLE BUFFER REVERSED');
        break;
      case 3:
        this._normalizeBuffer(slot.buffer);
        this.waveformView.render();
        this._updateLcdStatus('BUFFER NORMALIZED TO -0.5 dB');
        break;
      case 4:
        slot.pitch = Math.max(-24, slot.pitch - 12);
        this.knobValues[2] = Math.round(((slot.pitch + 24) / 48) * 127);
        this._renderKnob(2);
        this._updateLcdStatus(`PITCH: ${slot.pitch} ST`);
        break;
      case 5:
        slot.pitch = Math.min(24, slot.pitch + 12);
        this.knobValues[2] = Math.round(((slot.pitch + 24) / 48) * 127);
        this._renderKnob(2);
        this._updateLcdStatus(`PITCH: ${slot.pitch} ST`);
        break;
      case 6: {
        const mode = slot.toggleStretchMode();
        this._updateStretchModeDisplay();
        this._updateLcdStatus(`STRETCH MODE: ${mode === 'pitch_only' ? 'PITCH ONLY (TIME-INVARIANT)' : 'SQUEEZE (VARISPEED)'}`);
        if (this.minimalPoView) this.minimalPoView.triggerPunch(mode === 'pitch_only' ? 'PITCH' : 'SQUEEZE');
        break;
      }
      case 7:
        this.audioEngine.playActiveSlot(60, 110);
        this._updateLcdStatus('AUDITIONING FULL SAMPLE');
        break;
    }
  }

  _handleSetupKnobParam(knobIdx, value) {
    if (this.settingsModal && this.settingsModal.classList.contains('open')) {
      const inputSelect = document.getElementById('select-audio-input');
      const midiInSelect = document.getElementById('select-midi-in');
      const midiOutSelect = document.getElementById('select-midi-out');
      const orientSelect = document.getElementById('select-grid-orientation');

      if (knobIdx === 0 && inputSelect && inputSelect.options.length > 0) {
        const optIdx = Math.floor((value / 128) * inputSelect.options.length);
        inputSelect.selectedIndex = optIdx;
        this.audioEngine.recorder.initStream(inputSelect.value);
        this._updateLcdStatus(`INPUT: ${inputSelect.options[optIdx].text}`);
      } else if (knobIdx === 1 && midiInSelect && midiInSelect.options.length > 0) {
        const optIdx = Math.floor((value / 128) * midiInSelect.options.length);
        midiInSelect.selectedIndex = optIdx;
        this.midiManager.setInput(this.midiManager.getInputs()[optIdx] || null);
        this._updateLcdStatus(`MIDI IN: ${midiInSelect.options[optIdx].text}`);
      } else if (knobIdx === 2 && midiOutSelect && midiOutSelect.options.length > 0) {
        const optIdx = Math.floor((value / 128) * midiOutSelect.options.length);
        midiOutSelect.selectedIndex = optIdx;
        this.midiManager.setOutput(this.midiManager.getOutputs()[optIdx] || null);
        this._updateLcdStatus(`MIDI OUT: ${midiOutSelect.options[optIdx].text}`);
      } else if (knobIdx === 3 && orientSelect) {
        orientSelect.selectedIndex = value > 63 ? 1 : 0;
        this.midiManager.setLayoutMode(orientSelect.value);
        this.refreshAll();
        this._updateLcdStatus(`ORIENTATION: ${orientSelect.value.toUpperCase()}`);
      }
    } else {
      // Hardware SHIFT + Knob controls when setup modal is closed
      if (knobIdx === 0) {
        // SHIFT + Knob 1: Pattern Resolution Zoom (1x = 16 steps, 2x = 32 steps, 4x = 64 steps, 8x = 128 steps)
        let zoom = 1;
        if (value >= 96) zoom = 8;
        else if (value >= 64) zoom = 4;
        else if (value >= 32) zoom = 2;
        this.setPatternZoom(zoom);
      } else if (knobIdx === 1) {
        // SHIFT + Knob 2: Pattern Page Navigation (P1..P8)
        const curPat = this.sequencer.getCurrentPattern();
        const maxPages = curPat ? curPat.zoom : 1;
        const pageIdx = Math.min(maxPages - 1, Math.floor((value / 128) * maxPages));
        this.setPatternPage(pageIdx);
      } else if (knobIdx === 2) {
        // SHIFT + Knob 3: Active Step 128th Nudge (if holding step) or Slot Fine Tuning (-50..+50 cents)
        if (this.heldStepIndex >= 0) {
          if (this._lastNudgeKnobVal === null) {
            this._lastNudgeKnobVal = value;
            return;
          }
          const diff = value - this._lastNudgeKnobVal;
          if (Math.abs(diff) < 2) return;
          const delta = diff > 0 ? 1 : -1;
          this._lastNudgeKnobVal = value;
          this._stepModifiedDuringHold = true;

          const activeSlotIdx = this.audioEngine.activeSlotIndex;
          const res = this.sequencer.nudgeStep(activeSlotIdx, this.heldStepIndex, delta);
          if (res) {
            this.heldStepIndex = res.newStep;
            const newPage = Math.floor(res.newStep / 16);
            if (newPage !== this.activePage) this.activePage = newPage;
            this.selectedStepIndex = res.newStep % 16;
            this._updateTouchStepGrid();
            this._syncSequencerLeds();
            this._updateStepInspector(activeSlotIdx, res.newStep);
            this._updateLcdStatus(`NUDGE STEP ${res.newStep + 1}: ${res.microTiming >= 0 ? '+' : ''}${res.microTiming}/128th`);
          }
        } else {
          const slot = this.audioEngine.getActiveSlot();
          if (slot) {
            const fineCents = Math.round(((value / 127) * 100) - 50);
            slot.fineTune = fineCents;
            this._lastParamMsg = `FINE ${fineCents > 0 ? '+' : ''}${fineCents}c`;
            this._updateLcdStatus(`FINE TUNE: ${fineCents > 0 ? '+' : ''}${fineCents} CENTS`);
            this._syncPoState();
          }
        }
      } else if (knobIdx === 3) {
        // SHIFT + Knob 4: Global Master Dual PO Filter (Sweep LPF < 64 > HPF across whole mix)
        this.audioEngine.setPoDualFilter(value);
        let fText = 'FILTER: OFF';
        if (value < 64) fText = `LPF: ${Math.round((value / 63) * 100)}%`;
        else if (value > 64) fText = `HPF: ${Math.round(((value - 64) / 63) * 100)}%`;
        this._lastParamMsg = fText;
        this._updateLcdStatus(`MASTER FILTER: ${fText}`);
        this._syncPoState();
      } else if (knobIdx === 4) {
        // SHIFT + Knob 5: Master Swing percentage (50% to 75%)
        const swingVal = 50 + Math.round((value / 127) * 25);
        this.sequencer.setSwing(swingVal);
        this._lastParamMsg = `SWING ${swingVal}%`;
        this._updateLcdStatus(`MASTER SWING: ${swingVal}%`);
        this._syncPoState();
      } else if (knobIdx === 5) {
        // SHIFT + Knob 6: Stretch Mode Toggle (PITCH ONLY vs SQUEEZE)
        const slot = this.audioEngine.getActiveSlot();
        if (slot) {
          const newMode = (value < 64) ? 'pitch_only' : 'resample';
          if (slot.stretchMode !== newMode) {
            slot.setStretchMode(newMode);
            this._updateStretchModeDisplay();
          }
          const modeLabel = (slot.stretchMode === 'pitch_only') ? 'PITCH ONLY (CONSTANT TIME)' : 'SQUEEZE (VARISPEED)';
          this._lastParamMsg = slot.stretchMode === 'pitch_only' ? 'PITCH ONLY' : 'SQUEEZE';
          this._updateLcdStatus(`STRETCH MODE: ${modeLabel}`);
          this._syncPoState();
        }
      } else if (knobIdx === 6) {
        // SHIFT + Knob 7: Master Space Delay Feedback (0% to 68%)
        this.audioEngine.punchInFx.spaceFeedback.gain.setTargetAtTime((value / 127) * 0.68, this.audioEngine.ctx.currentTime, 0.03);
        this._lastParamMsg = `SPACE FEED`;
        this._updateLcdStatus(`SPACE DELAY FEEDBACK: ${Math.round((value / 127) * 100)}%`);
        this._syncPoState();
      } else if (knobIdx === 7) {
        // SHIFT + Knob 8: Master BPM / Tempo (40 to 220 BPM)
        const coarseBpm = 40 + Math.round((value / 127) * 180);
        this.sequencer.setBpm(coarseBpm);
        if (this.lcdBpm) this.lcdBpm.textContent = `${coarseBpm}`;
        this._lastParamMsg = `${coarseBpm} BPM`;
        this._updateLcdStatus(`MASTER TEMPO: ${coarseBpm} BPM`);
        this._syncPoState();
      }
    }
  }

  _reverseBuffer(buffer) {
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      Array.prototype.reverse.call(buffer.getChannelData(c));
    }
  }

  _normalizeBuffer(buffer) {
    let peak = 0;
    const len = buffer.length;
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const data = buffer.getChannelData(c);
      for (let i = 0; i < len; i++) {
        const abs = Math.abs(data[i]);
        if (abs > peak) peak = abs;
      }
    }
    if (peak > 0.001) {
      const gain = 0.95 / peak;
      for (let c = 0; c < buffer.numberOfChannels; c++) {
        const data = buffer.getChannelData(c);
        for (let i = 0; i < len; i++) data[i] *= gain;
      }
    }
  }

  _initTransportButtons() {
    const playBtn = document.getElementById('btn-transport-play');
    const stopBtn = document.getElementById('btn-transport-stop');
    const recBtn = document.getElementById('btn-transport-rec');

    if (playBtn) {
      playBtn.addEventListener('click', () => {
        this.sequencer.togglePlayPause();
      });
    }

    if (recBtn) {
      recBtn.addEventListener('click', () => {
        this.sequencer.toggleRecord();
      });
    }

    if (stopBtn) {
      stopBtn.addEventListener('click', () => {
        this.sequencer.stopAndReset();
        this._updateLcdStatus('STOPPED // RESET TO START');
      });
    }

    if (this.viewToggleBtn) {
      this.viewToggleBtn.addEventListener('click', () => {
        this.toggleViewMode();
      });
    }
  }

  _initModeSwitcher() {
    const modeBtns = document.querySelectorAll('.mode-btn');
    modeBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        this.setMode(mode);
      });
    });
  }

  setMode(mode) {
    this.midiManager.operationalMode = mode;
    const modeBtns = document.querySelectorAll('.mode-btn');
    modeBtns.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    this._updateLcdStatus(`MODE: ${mode.toUpperCase()} ACTIVE`);
    this._syncPadGridLeds();
    this._syncPoState();
  }

  toggleViewMode() {
    this.currentViewMode = (this.currentViewMode === 'minimal') ? 'debug' : 'minimal';
    document.body.className = `view-${this.currentViewMode}`;
    if (this.viewToggleBtn) {
      this.viewToggleBtn.textContent = (this.currentViewMode === 'minimal')
        ? '🎛 MONITOR / DEBUG VIEW'
        : '📱 MINIMAL PO-33 VIEW';
    }
    this._updateLcdStatus(`SWITCHED TO ${this.currentViewMode.toUpperCase()} VIEW`);
  }

  _initSongChainBar() {
    const addChainBtn = document.getElementById('btn-chain-add');
    const clearChainBtn = document.getElementById('btn-chain-clear');

    if (addChainBtn) {
      addChainBtn.addEventListener('click', () => {
        const curPat = this.sequencer.activePatternIndex;
        const newChain = [...this.sequencer.patternChain, curPat];
        this.sequencer.setPatternChain(newChain);
        this._renderSongChainBar();
        this._updateLcdStatus(`CHAIN: APPENDED P${curPat + 1}`);
      });
    }

    if (clearChainBtn) {
      clearChainBtn.addEventListener('click', () => {
        this.sequencer.setPatternChain([this.sequencer.activePatternIndex]);
        this._renderSongChainBar();
        this._updateLcdStatus('CHAIN: RESET TO SINGLE LOOP');
      });
    }

    this._renderSongChainBar();
  }

  _renderSongChainBar() {
    const container = document.getElementById('song-chain-blocks');
    if (!container) return;

    container.innerHTML = '';
    const chain = this.sequencer.patternChain;
    const currentChainIdx = this.sequencer.chainPosition;

    chain.forEach((patIdx, idx) => {
      const block = document.createElement('button');
      block.className = `chain-block ${idx === currentChainIdx ? 'current' : ''}`;
      block.textContent = `P${patIdx + 1}`;
      block.title = `APC: Arrangement Block ${idx + 1}: Pattern ${patIdx + 1}. Hold ◄ (Note 66) + tap pad sequence to chain live!`;
      block.dataset.apcHint = `APC: Pattern ${patIdx + 1} (Block ${idx + 1}) | Hold ◄ (Note 66) + tap pads to chain live!`;
      block.addEventListener('click', () => {
        this.sequencer.chainPosition = idx;
        this.sequencer.setPattern(patIdx);
        this._renderSongChainBar();
      });
      container.appendChild(block);
    });
  }

  _initTouchStepGrid() {
    const grid = document.getElementById('touch-step-grid');
    if (!grid) return;

    grid.innerHTML = '';
    for (let s = 0; s < 16; s++) {
      const btn = document.createElement('button');
      btn.className = 'step-btn-16';
      btn.dataset.step = s;
      btn.innerHTML = `<span>${s + 1}</span>`;

      btn.addEventListener('click', () => {
        const activeSlot = this.audioEngine.activeSlotIndex;
        const stepIdx = (this.activePage * 16) + s;
        this.selectedStepIndex = s;
        const newState = this.sequencer.toggleStep(activeSlot, stepIdx);
        btn.classList.toggle('active', newState);
        this._syncSequencerLeds();
        this._updateTouchStepGrid();
        this._updateStepInspector(activeSlot, stepIdx);
        this._updateLcdStatus(`STEP ${stepIdx + 1} ${newState ? 'ON' : 'OFF'}`);
        if (this.minimalPoView) this.minimalPoView.triggerPunch('STEP!');
      });

      grid.appendChild(btn);
    }
    this._updateTouchStepGrid();
  }

  _updateTouchStepGrid() {
    const activeSlot = this.audioEngine.activeSlotIndex;
    const steps = this.sequencer.getTrackSteps(activeSlot);
    const playhead = this._lastPlayheadStep;
    const curPat = this.sequencer.getCurrentPattern();
    const zoom = curPat ? curPat.zoom : 1;
    const totalSteps = curPat ? curPat.length : 16;
    const pageOffset = this.activePage * 16;

    // Update Page Buttons visibility and active state for up to 8 pages (128 steps)
    for (let p = 1; p <= 8; p++) {
      const pBtn = document.getElementById(`btn-page-${p}`);
      if (pBtn) {
        pBtn.style.display = (p <= zoom) ? 'inline-block' : 'none';
        const isCurrentPage = (p - 1) === this.activePage;
        pBtn.classList.toggle('active', isCurrentPage);
        pBtn.style.color = isCurrentPage ? '#61afef' : '#828997';
        pBtn.style.borderColor = isCurrentPage ? '#61afef' : '#3e4451';
        pBtn.title = `APC: Tap ▲ / ▼ to scroll to Page ${p}`;
        pBtn.dataset.apcHint = `APC: Tap ▲ / ▼ to scroll pages`;
      }
    }

    // Update Zoom Buttons active class
    const zoomBtns = document.querySelectorAll('.btn-zoom');
    zoomBtns.forEach(btn => {
      const bZoom = parseInt(btn.dataset.zoom, 10);
      const isCurrentZoom = (bZoom === zoom);
      btn.classList.toggle('active', isCurrentZoom);
      btn.style.color = isCurrentZoom ? '#98c379' : '#828997';
      btn.style.borderColor = isCurrentZoom ? '#98c379' : '#3e4451';
      btn.title = `APC: Zoom ${bZoom}X (${bZoom === 1 ? 'Shift + ◄' : bZoom === 2 ? 'Shift + ►' : `${bZoom}X resolution`})`;
      btn.dataset.apcHint = `APC: Zoom ${bZoom}X (${bZoom === 1 ? 'Shift + ◄' : bZoom === 2 ? 'Shift + ►' : `${bZoom}X`})`;
    });

    const inspectIdx = (this.heldStepIndex >= 0) ? this.heldStepIndex : (pageOffset + (this.selectedStepIndex || 0));

    const stepBtns = document.querySelectorAll('.step-btn-16');
    stepBtns.forEach((btn, idx) => {
      const globalStepIdx = pageOffset + idx;
      const label = btn.querySelector('span');
      if (label) label.textContent = `${globalStepIdx + 1}`;
      btn.classList.toggle('active', !!steps[globalStepIdx]);
      btn.classList.toggle('playhead', globalStepIdx === playhead);
      btn.classList.toggle('selected-step', globalStepIdx === inspectIdx);
      btn.classList.toggle('beat-group-alt', Math.floor((idx % 16) / 4) % 2 === 1);

      const trackStep = (curPat && curPat.tracks[activeSlot]) ? curPat.tracks[activeSlot][globalStepIdx] : null;
      const hasMicro = trackStep && trackStep.active && (trackStep.microTiming !== 0);
      const hasLocks = trackStep && trackStep.active && trackStep.pLocks && Object.keys(trackStep.pLocks).length > 0;
      btn.classList.toggle('has-micro-timing', !!hasMicro);
      btn.classList.toggle('has-plock', !!hasLocks);
      let microBadge = btn.querySelector('.micro-badge');
      if (hasMicro) {
        if (!microBadge) {
          microBadge = document.createElement('div');
          microBadge.className = 'micro-badge';
          btn.appendChild(microBadge);
        }
        microBadge.textContent = `${trackStep.microTiming > 0 ? '+' : ''}${trackStep.microTiming}`;
      } else if (microBadge) {
        microBadge.remove();
      }

      const padRow = idx < 8 ? 1 : 2;
      const padCol = idx < 8 ? idx + 1 : idx - 7;
      const padNote = idx < 8 ? (32 + idx) : (24 + (idx - 8));
      btn.dataset.apcHint = `APC: Matrix Row ${padRow} Pad ${padCol} (Note ${padNote}) -> Step ${globalStepIdx + 1} (Hold + Knob = P-Lock | Hold + Shift+K3 = 128th Nudge)`;
      btn.title = `APC: Matrix Row ${padRow} Pad ${padCol} (Note ${padNote}) - Step ${globalStepIdx + 1}. Hold + turn knob to P-Lock, or Hold + Shift+Knob 3 to nudge 128th timing.`;
    });

    const titleEl = document.getElementById('seq-grid-title');
    if (titleEl) {
      titleEl.textContent = `CHANNEL RACK // P${(this.sequencer.activePatternIndex || 0) + 1} (${totalSteps} STEPS, PAGE ${this.activePage + 1}/${zoom})`;
    }

    this._updateStepInspector(activeSlot, inspectIdx);
  }

  _updateStepInspector(slotIdx, stepIdx) {
    const inspText = document.getElementById('step-inspector-text');
    if (!inspText) return;
    const pat = this.sequencer.getCurrentPattern();
    if (!pat || !pat.tracks[slotIdx]) return;
    const track = pat.tracks[slotIdx];
    const safeIdx = Math.max(0, Math.min(track.length - 1, stepIdx));
    const step = track[safeIdx];
    if (!step) return;

    const ticksPerStep = 128 / pat.length;
    const canonicalTick = Math.max(0, Math.min(127, Math.round((safeIdx * ticksPerStep) + (step.microTiming || 0))));
    const slot = this.audioEngine.slots[slotIdx];
    const notesArr = (Array.isArray(step.notes) && step.notes.length > 1) ? step.notes : [step.noteOrSlice];
    const noteName = slot && slot.type === 'drum'
      ? notesArr.map(v => `SLICE ${(((v % 16) + 16) % 16) + 1}`).join('+')
      : notesArr.map(v => this._midiToNoteName(v)).join('+');

    const lockKeys = step.pLocks ? Object.keys(step.pLocks) : [];
    const lockSummary = lockKeys.length > 0 ? ` | <span style="color:#18dcff;">P-LOCKS: ${lockKeys.join(', ')}</span>` : '';

    inspText.innerHTML = `<strong>STEP ${safeIdx + 1}</strong>: ${step.active ? '<span style="color:#26de81;">ACTIVE</span>' : '<span style="color:#7f8c8d;">OFF</span>'} | ${noteName} | VEL ${step.velocity} | <strong>128th GRID:</strong> <span style="color:#ff9f43; font-weight: bold;">${step.microTiming >= 0 ? '+' : ''}${step.microTiming}/128th</span> (TICK ${canonicalTick}/128)${lockSummary}`;
  }

  _midiToNoteName(midiNote) {
    const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const n = Math.round(midiNote);
    const octave = Math.floor(n / 12) - 1;
    const note = names[((n % 12) + 12) % 12];
    return `${note}${octave}`;
  }

  setPatternZoom(zoom) {
    this.sequencer.setPatternZoom(zoom);
    const curPat = this.sequencer.getCurrentPattern();
    const zoomVal = curPat ? curPat.zoom : 1;
    const totalSteps = curPat ? curPat.length : 16;
    if (this.activePage >= zoomVal) {
      this.activePage = 0;
    }
    this.followPlayhead = false;
    const followBtn = document.getElementById('btn-toggle-follow');
    if (followBtn) {
      followBtn.textContent = 'FOLLOW: OFF';
      followBtn.style.color = '#828997';
    }
    this._updateTouchStepGrid();
    this._syncSequencerLeds();
    this._updateLcdStatus(`PATTERN ZOOM: ${zoomVal}X (${totalSteps} STEPS)`);
    this._syncPoState();
  }

  setPatternPage(pageIdx) {
    const curPat = this.sequencer.getCurrentPattern();
    const maxPages = curPat ? curPat.zoom : 1;
    this.activePage = Math.max(0, Math.min(maxPages - 1, pageIdx));
    this.followPlayhead = false;
    const followBtn = document.getElementById('btn-toggle-follow');
    if (followBtn) {
      followBtn.textContent = 'FOLLOW: OFF';
      followBtn.style.color = '#828997';
    }
    this._updateTouchStepGrid();
    this._syncSequencerLeds();
    this._updateLcdStatus(`PAGE ${this.activePage + 1}/${maxPages} (STEPS ${this.activePage * 16 + 1}-${this.activePage * 16 + 16})`);
  }

  _initZoomAndSampleControls() {
    // Zoom Buttons
    const zoomBtns = document.querySelectorAll('.btn-zoom');
    zoomBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const zoom = parseInt(btn.dataset.zoom, 10);
        this.setPatternZoom(zoom);
      });
    });

    // Page Buttons
    const pageBtns = document.querySelectorAll('.btn-page');
    pageBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const page = parseInt(btn.dataset.page, 10);
        this.setPatternPage(page);
      });
    });

    // Follow Playhead Toggle
    const followBtn = document.getElementById('btn-toggle-follow');
    if (followBtn) {
      followBtn.addEventListener('click', () => {
        this.followPlayhead = !this.followPlayhead;
        followBtn.textContent = `FOLLOW: ${this.followPlayhead ? 'ON' : 'OFF'}`;
        followBtn.style.color = this.followPlayhead ? '#98c379' : '#828997';
        this._updateLcdStatus(`PLAYHEAD FOLLOW: ${this.followPlayhead ? 'ON' : 'OFF'}`);
      });
    }

    // Freeform vs Quantized Record Mode Toggle
    const recModeBtn = document.getElementById('btn-rec-mode');
    if (recModeBtn) {
      recModeBtn.addEventListener('click', () => {
        const newMode = this.sequencer.toggleRecordMode();
        this._updateRecModeButtonState();
        this._updateLcdStatus(`REC MODE: ${newMode.toUpperCase()} (${newMode === 'freeform' ? 'AUTO-BPM ON 128th GRID' : 'QUANTIZED OVERDUB'})`);
      });
    }

    // Step Inspector Nudge Buttons
    const nudgePrevBtn = document.getElementById('btn-nudge-prev');
    if (nudgePrevBtn) {
      nudgePrevBtn.addEventListener('click', () => {
        this._handleHardwarePatternTool('nudgePrev');
      });
    }

    const nudgeNextBtn = document.getElementById('btn-nudge-next');
    if (nudgeNextBtn) {
      nudgeNextBtn.addEventListener('click', () => {
        this._handleHardwarePatternTool('nudgeNext');
      });
    }

    // Sample Modification Tools
    const loopBtn = document.getElementById('btn-sample-loop');
    if (loopBtn) {
      loopBtn.addEventListener('click', () => {
        const slot = this.audioEngine.getActiveSlot();
        if (slot) {
          slot.loop = !slot.loop;
          loopBtn.textContent = `🔁 LOOP: ${slot.loop ? 'ON' : 'OFF'}`;
          loopBtn.style.color = slot.loop ? '#98c379' : '#828997';
          this._updateLcdStatus(`SAMPLE LOOP: ${slot.loop ? 'ON (HOLD KEYS TO LOOP)' : 'OFF'}`);
          this._syncPoState();
        }
      });
    }

    // Stretch Mode Toggle: 'resample' (squeezes time) vs 'pitch_only' (heightens pitch only)
    const stretchModeBtn = document.getElementById('btn-stretch-mode');
    if (stretchModeBtn) {
      stretchModeBtn.addEventListener('click', () => {
        const slot = this.audioEngine.getActiveSlot();
        if (slot) {
          const newMode = slot.toggleStretchMode();
          this._updateStretchModeDisplay();
          if (newMode === 'pitch_only') {
            this._updateLcdStatus('STRETCH MODE: PITCH ONLY (TIME-INVARIANT CONSTANT DURATION)');
          } else {
            this._updateLcdStatus('STRETCH MODE: SQUEEZE (CLASSIC VARISPEED OCTAVES)');
          }
          if (this.minimalPoView) this.minimalPoView.triggerPunch(newMode === 'pitch_only' ? 'PITCH' : 'SQUEEZE');
        }
      });
    }
    this._updateStretchModeDisplay();

    const stretchHalfBtn = document.getElementById('btn-sample-stretch-half');
    if (stretchHalfBtn) {
      stretchHalfBtn.addEventListener('click', () => {
        const slot = this.audioEngine.getActiveSlot();
        if (slot && slot.buffer) {
          slot.timeStretch(0.5);
          this.waveformView.render();
          this._updateLcdStatus('TIME STRETCH: 0.5X (2X FASTER, PITCH PRESERVED)');
          if (this.minimalPoView) this.minimalPoView.triggerPunch('STRETCH');
        }
      });
    }

    const stretchDoubleBtn = document.getElementById('btn-sample-stretch-double');
    if (stretchDoubleBtn) {
      stretchDoubleBtn.addEventListener('click', () => {
        const slot = this.audioEngine.getActiveSlot();
        if (slot && slot.buffer) {
          slot.timeStretch(2.0);
          this.waveformView.render();
          this._updateLcdStatus('TIME STRETCH: 2.0X (2X SLOWER, PITCH PRESERVED)');
          if (this.minimalPoView) this.minimalPoView.triggerPunch('STRETCH');
        }
      });
    }

    const revBtn = document.getElementById('btn-sample-reverse');
    if (revBtn) {
      revBtn.addEventListener('click', () => {
        const slot = this.audioEngine.getActiveSlot();
        if (slot && slot.buffer) {
          slot.reverseBuffer();
          this.waveformView.render();
          this._updateLcdStatus('REVERSED SAMPLE BUFFER');
        }
      });
    }

    const normBtn = document.getElementById('btn-sample-normalize');
    if (normBtn) {
      normBtn.addEventListener('click', () => {
        const slot = this.audioEngine.getActiveSlot();
        if (slot && slot.buffer) {
          slot.normalizeBuffer();
          this.waveformView.render();
          this._updateLcdStatus('NORMALIZED BUFFER TO -0.5 dB');
        }
      });
    }

    const sliceBtn = document.getElementById('btn-sample-autoslice');
    if (sliceBtn) {
      sliceBtn.addEventListener('click', () => {
        this._triggerAutoSlice();
      });
    }
  }

  _updatePlayButtonState(isPlaying, isPaused) {
    const playBtn = document.getElementById('btn-transport-play');
    if (!playBtn) return;

    if (isPlaying) {
      playBtn.textContent = '❚❚ PAUSE';
      playBtn.style.background = '#e67e22';
    } else if (isPaused) {
      playBtn.textContent = '▶ RESUME';
      playBtn.style.background = '#27ae60';
    } else {
      playBtn.textContent = '▶ PLAY';
      playBtn.style.background = '#27ae60';
    }
  }

  _updateRecModeButtonState() {
    const recModeBtn = document.getElementById('btn-rec-mode');
    if (!recModeBtn) return;
    const isFree = (this.sequencer.recordMode === 'freeform');
    recModeBtn.textContent = isFree ? 'REC: FREEFORM (128th)' : 'REC: QUANTIZED';
    recModeBtn.style.color = isFree ? '#ff7828' : '#18dcff';
    recModeBtn.style.borderColor = isFree ? '#ff7828' : '#18dcff';
  }

  _updateSidechainToggleState() {
    const scToggle = document.getElementById('btn-sidechain-toggle');
    if (!scToggle) return;
    const enabled = this.audioEngine.sidechainEnabled !== false;
    scToggle.textContent = enabled ? 'ON' : 'OFF';
    scToggle.style.color = enabled ? '#26de81' : '#828997';
    scToggle.style.borderColor = enabled ? '#26de81' : '#3e4451';
  }

  _updateRecButtonState(isRecording) {
    const recBtn = document.getElementById('btn-transport-rec');
    if (!recBtn) return;
    if (this.sequencer.isWaitingForFirstHit) {
      recBtn.textContent = '● ARMED (HIT)';
      recBtn.style.background = '#d35400';
      recBtn.style.borderColor = '#e67e22';
      recBtn.classList.add('active');
    } else if (isRecording) {
      recBtn.textContent = '● RECORDING...';
      recBtn.style.background = '#e74c3c';
      recBtn.style.borderColor = '#c0392b';
      recBtn.classList.add('active');
    } else {
      recBtn.textContent = '● REC';
      recBtn.style.background = '';
      recBtn.style.borderColor = '';
      recBtn.classList.remove('active');
    }
  }

  _appendMidiLog(activity) {
    if (!this.midiLogTable) return;

    const entry = document.createElement('div');
    entry.className = `log-entry ${activity.direction === 'IN' ? 'log-in' : 'log-out'}`;

    const timeStr = new Date(activity.timestamp).toISOString().substr(14, 8);
    entry.textContent = `[${timeStr}] [${activity.direction}] ${activity.status} ${activity.d1} ${activity.d2} // ${activity.description}`;

    this.midiLogTable.appendChild(entry);
    if (this.midiLogTable.children.length > 50) {
      this.midiLogTable.removeChild(this.midiLogTable.firstChild);
    }
    this.midiLogTable.scrollTop = this.midiLogTable.scrollHeight;
  }

  _onKeyboardHit(note, velocity) {
    const activeSlot = this.audioEngine.activeSlotIndex;
    const slot = this.audioEngine.getActiveSlot();

    if (slot.type === 'melodic') {
      this.audioEngine.playActiveSlot(note, velocity);
      this.sequencer.handleLiveHit(activeSlot, note, velocity);
    } else {
      // Drum Kit: Map 25 physical keys or pads to 16 slices cleanly
      let sliceIdx;
      if (note >= 0 && note < 16) {
        // Direct slice index from pads or UI buttons
        sliceIdx = note;
      } else {
        // Physical keybed or MIDI keyboard (Channel 2 keys: 48..72 or transposed)
        const baseNote = this.midiManager.keyboardBaseNote || 48;
        let relativeKey = note - baseNote;
        if (relativeKey < 0 || relativeKey >= 25) {
          const nearestC = Math.floor(note / 12) * 12;
          relativeKey = note - nearestC;
        }
        sliceIdx = ((relativeKey % 16) + 16) % 16;
      }

      slot.selectedSliceIndex = sliceIdx;
      this.audioEngine.playActiveSlot(sliceIdx, velocity);
      this.sequencer.handleLiveHit(activeSlot, sliceIdx, velocity);
      this.waveformView.render();
    }

    if (this.mixerRackView) {
      this.mixerRackView.flashTrackLed(activeSlot);
    }

    if (this.lcdVoices) {
      this.lcdVoices.textContent = `${slot.activeVoices.size}`;
    }

    if (this.minimalPoView) {
      this.minimalPoView.triggerPunch(slot.type === 'melodic' ? 'NOTE!' : `SLICE ${slot.selectedSliceIndex + 1}`);
    }
  }

  _handleSceneAction(sceneIdx) {
    switch (sceneIdx) {
      case 1:
        this.sequencer.togglePlayPause();
        break;
      case 2:
        this.sequencer.toggleRecord();
        break;
      case 3:
        this._triggerAutoSlice();
        break;
      case 4:
        const metroOn = this.sequencer.toggleMetronome();
        this._syncSceneLeds();
        this._updateLcdStatus(`METRONOME ${metroOn ? 'ON' : 'OFF'}`);
        this._syncPoState();
        break;
      case 5:
        const nextPat = (this.sequencer.activePatternIndex + 1) % 16;
        this.sequencer.setPattern(nextPat);
        this._updateLcdStatus(`PATTERN ${nextPat + 1}`);
        this._renderSongChainBar();
        this._syncPoState();
        break;
      case 0:
        this.sequencer.stopAndReset();
        break;
    }
  }

  async _toggleLiveSampling(sourceType = 'mic') {
    const rec = this.audioEngine.recorder;
    if (!rec.isRecording) {
      try {
        if (sourceType === 'tab') {
          await rec.initDisplayStream();
          this._updateLcdStatus('SAMPLING TAB/PC AUDIO (YOUTUBE/SPOTIFY)...');
        } else {
          if (!rec.sourceNode || rec.activeDeviceId === 'display_media_tab_audio') {
            await rec.initStream();
          }
          this._updateLcdStatus('SAMPLING LINE/MIC... PLAY NOW!');
        }
        rec.startRecording();
        this._updateSamplingButtons(true, sourceType);
        this._syncSceneLeds();
        this._syncPoState();
      } catch (err) {
        this._updateSamplingButtons(false, null);
        alert('Could not start sampling: ' + err.message);
      }
    } else {
      rec.stopRecording();
      rec.stopStream();
      this._updateSamplingButtons(false, null);
      this._syncSceneLeds();
      this._syncPoState();
    }
  }

  _updateSamplingButtons(isSampling, sourceType) {
    const micBtn = document.getElementById('btn-live-sample');
    const tabBtn = document.getElementById('btn-tab-sample');
    if (micBtn) {
      if (isSampling && sourceType !== 'tab') {
        micBtn.textContent = '⏹ STOP REC';
        micBtn.classList.add('recording');
        micBtn.style.background = '#e74c3c';
        micBtn.style.borderColor = '#c0392b';
      } else {
        micBtn.textContent = '🎙 LINE/MIC';
        micBtn.classList.remove('recording');
        micBtn.style.background = '#2d3436';
        micBtn.style.borderColor = '#e17055';
      }
    }
    if (tabBtn) {
      if (isSampling && sourceType === 'tab') {
        tabBtn.textContent = '⏹ STOP TAB';
        tabBtn.classList.add('recording');
        tabBtn.style.background = '#e74c3c';
        tabBtn.style.borderColor = '#c0392b';
      } else {
        tabBtn.textContent = '🖥️ TAB AUDIO';
        tabBtn.classList.remove('recording');
        tabBtn.style.background = '#2d3436';
        tabBtn.style.borderColor = '#0984e3';
      }
    }
  }

  _triggerAutoSlice() {
    const slot = this.audioEngine.getActiveSlot();
    if (!slot || !slot.buffer) {
      this._updateLcdStatus('CANNOT SLICE: SLOT EMPTY');
      return;
    }
    slot.type = 'drum';
    slot.autoSlice();
    this.keyboardView.setMode('drum');
    this.waveformView.render();
    this._syncSlotLeds();
    this._updateLcdStatus('AUTO-SLICED INTO 16 SLICES');
    if (this.minimalPoView) this.minimalPoView.triggerPunch('SLICED!');
    this._syncPoState();
  }

  selectSlot(slotIdx) {
    this.heldStepIndex = -1;
    if (this.midiManager && this.midiManager.heldSteps) this.midiManager.heldSteps.clear();
    const slot = this.audioEngine.setActiveSlot(slotIdx);
    this.refreshSlotDisplay();
    this._syncSlotLeds();
    this._syncSequencerLeds();
    this._updateTouchStepGrid();
    if (this.mixerRackView) {
      this.mixerRackView.updateActiveSlot(slotIdx);
    }
    this._updateLcdStatus(`SELECTED: ${slot.name} (${slot.type.toUpperCase()})`);
    this._syncPoState();
  }

  refreshSlotDisplay() {
    const slot = this.audioEngine.getActiveSlot();
    if (!slot) return;

    if (this.lcdSlot) this.lcdSlot.textContent = `SLOT ${slot.index + 1}`;
    if (this.lcdSlotName) this.lcdSlotName.textContent = slot.name;
    this.keyboardView.setMode(slot.type);
    this.waveformView.setSlot(slot);

    this.knobValues[0] = Math.round(slot.trimStart * 127);
    this.knobValues[1] = Math.round(slot.trimEnd * 127);
    this.knobValues[2] = Math.round(((slot.pitch + 24) / 48) * 127);
    // Decay: 0.05s to 8.0s smooth exponential/piecewise mapping
    if (slot.decay <= 1.0) {
      this.knobValues[5] = Math.max(0, Math.min(32, Math.round(((slot.decay - 0.05) / 0.95) * 32)));
    } else {
      this.knobValues[5] = Math.max(32, Math.min(127, Math.round(32 + ((slot.decay - 1.0) / 7.0) * 95)));
    }

    for (let k = 0; k < 8; k++) {
      this._renderKnob(k);
    }

    const loopBtn = document.getElementById('btn-sample-loop');
    if (loopBtn) {
      loopBtn.textContent = `🔁 LOOP: ${slot.loop ? 'ON' : 'OFF'}`;
      loopBtn.style.color = slot.loop ? '#98c379' : '#828997';
    }
    this._updateStretchModeDisplay();
    this._syncPoState();
  }

  _updateStretchModeDisplay() {
    const slot = this.audioEngine.getActiveSlot();
    const btn = document.getElementById('btn-stretch-mode');
    if (btn && slot) {
      const isPitchOnly = (slot.stretchMode === 'pitch_only');
      btn.textContent = isPitchOnly ? '⏱ MODE: PITCH ONLY' : '⏱ MODE: SQUEEZE';
      btn.style.color = isPitchOnly ? '#ff9f43' : '#61afef';
      btn.style.borderColor = isPitchOnly ? '#ff9f43' : '#61afef';
      btn.title = isPitchOnly
        ? 'APC: Shift + Knob 6 or Pad Note 62 toggles Stretch Mode. (Current: PITCH ONLY - Constant Time/Duration)'
        : 'APC: Shift + Knob 6 or Pad Note 62 toggles Stretch Mode. (Current: SQUEEZE - Classic Varispeed)';
      btn.dataset.apcHint = isPitchOnly
        ? 'APC: Shift + Knob 6 or Pad Note 62 -> Toggle Stretch Mode (Currently PITCH ONLY)'
        : 'APC: Shift + Knob 6 or Pad Note 62 -> Toggle Stretch Mode (Currently SQUEEZE)';
    }
  }

  _initKnobs() {
    this._updateKnobLabels();
    const knobContainers = document.querySelectorAll('.macro-knob');
    knobContainers.forEach((el) => {
      const idx = parseInt(el.dataset.knob, 10);
      let startY = 0;
      let startVal = 0;

      const onMouseDown = (e) => {
        e.preventDefault();
        startY = e.clientY || (e.touches && e.touches[0].clientY);
        startVal = this.knobValues[idx];

        const onMouseMove = (ev) => {
          const curY = ev.clientY || (ev.touches && ev.touches[0].clientY);
          const delta = (startY - curY) * 0.9;
          const newVal = Math.max(0, Math.min(127, Math.round(startVal + delta)));
          this.setKnobValue(idx, newVal, false);
        };

        const onMouseUp = () => {
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
          window.removeEventListener('touchmove', onMouseMove);
          window.removeEventListener('touchend', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        window.addEventListener('touchmove', onMouseMove, { passive: false });
        window.addEventListener('touchend', onMouseUp);
      };

      el.addEventListener('mousedown', onMouseDown);
      el.addEventListener('touchstart', onMouseDown, { passive: false });
    });
  }

  setKnobValue(knobIdx, value, fromHardware = false) {
    this.knobValues[knobIdx] = value;
    this._renderKnob(knobIdx);

    // 1. MASTER KNOB BANK DISPATCH
    // In Master Mode, knobs control global mix/FX parameters and MUST NEVER touch track steps or p-locks!
    if (this.knobBank === 'master') {
      switch (knobIdx) {
        case 0: {
          const bpm = 40 + Math.round((value / 127) * 180);
          this.sequencer.setBpm(bpm);
          if (this.lcdBpm) this.lcdBpm.textContent = `${bpm}`;
          this._lastParamMsg = `${bpm} BPM`;
          this._updateLcdStatus(`MASTER TEMPO: ${bpm} BPM`);
          break;
        }
        case 1: {
          const swing = 50 + Math.round((value / 127) * 25);
          this.sequencer.swing = swing;
          this._lastParamMsg = `SWING ${swing}%`;
          this._updateLcdStatus(`MASTER SWING: ${swing}%`);
          break;
        }
        case 2: {
          const mPitch = Math.round(((value / 127) * 24) - 12);
          this._lastParamMsg = `TUNE ${mPitch > 0 ? '+' : ''}${mPitch}`;
          this._updateLcdStatus(`MASTER TUNE: ${mPitch > 0 ? '+' : ''}${mPitch} ST`);
          break;
        }
        case 3:
          this.audioEngine.setPoDualFilter(value);
          let fText = 'FILTER: OFF';
          if (value < 64) fText = `LPF: ${Math.round((value / 63) * 100)}%`;
          else if (value > 64) fText = `HPF: ${Math.round(((value - 64) / 63) * 100)}%`;
          this._lastParamMsg = fText;
          this._updateLcdStatus(fText);
          break;
        case 4:
          this.audioEngine.setFilterResonance(value);
          this._lastParamMsg = `RES Q ${(this.audioEngine.getResonanceValue()).toFixed(1)}`;
          this._updateLcdStatus(`RES Q: ${(this.audioEngine.getResonanceValue()).toFixed(1)}`);
          break;
        case 5:
          this.audioEngine.punchInFx.spaceDelay.delayTime.setTargetAtTime(0.08 + (value / 127) * 1.1, this.audioEngine.ctx.currentTime, 0.03);
          this._lastParamMsg = `SPACE TIME`;
          this._updateLcdStatus(`SPACE DELAY TIME: ${Math.round((value / 127) * 100)}%`);
          break;
        case 6: {
          const relSec = 0.04 + (value / 127) * 0.46;
          this.audioEngine.setSidechainRelease(relSec);
          this._lastParamMsg = `SC REL ${Math.round(relSec * 1000)}ms`;
          this._updateLcdStatus(`SIDECHAIN RELEASE: ${Math.round(relSec * 1000)}ms`);
          break;
        }
        case 7: {
          const scDepth = value / 127;
          this.audioEngine.setSidechainDepth(scDepth);
          this.audioEngine.setMasterCompVol(value);
          this._lastParamMsg = `SC ${Math.round(scDepth * 100)}% / VOL`;
          this._updateLcdStatus(`SIDECHAIN DUCK: ${Math.round(scDepth * 100)}% // COMP VOL`);
          break;
        }
      }
      if (this.mixerRackView) {
        this.mixerRackView.updateDspReadouts(this.knobValues);
      }
      this._syncPoState();
      return;
    }

    const slot = this.audioEngine.getActiveSlot();
    const activeSlotIdx = this.audioEngine.activeSlotIndex;

    // 2. Parameter Locking on Held Step (Track Bank Only)
    // STRICT VALIDATION: Only lock parameters if a step is ACTUALLY, PHYSICALLY being held down right now!
    const checkPad = (this._heldPadIndex >= 0) ? this._heldPadIndex : (this.heldStepIndex % 16);
    const isStepPhysicallyHeld = (this.heldStepIndex >= 0) &&
      ((this.midiManager && this.midiManager.heldSteps && this.midiManager.heldSteps.has(checkPad)) || !fromHardware);

    if (!isStepPhysicallyHeld) {
      this.heldStepIndex = -1;
    }

    if (this.heldStepIndex >= 0) {
      let paramKey = '';
      let lockVal = value;

      if (knobIdx === 0) { paramKey = 'trimStart'; lockVal = value / 127; }
      else if (knobIdx === 1) { paramKey = 'trimEnd'; lockVal = value / 127; }
      else if (knobIdx === 2) { paramKey = 'pitch'; lockVal = Math.round(((value / 127) * 48) - 24); }
      else if (knobIdx === 3) { paramKey = 'poFilter'; lockVal = value; }
      else if (knobIdx === 5) { paramKey = 'decay'; lockVal = (value <= 32) ? (0.05 + (value / 32) * 0.95) : (1.0 + ((value - 32) / 95) * 7.0); }

      if (paramKey) {
        // Parameter locking MUST NEVER activate an empty step or create ghost notes!
        const pat = this.sequencer.getCurrentPattern();
        const targetStep = (pat && pat.tracks[activeSlotIdx]) ? pat.tracks[activeSlotIdx][this.heldStepIndex] : null;
        if (targetStep && targetStep.active) {
          this._stepModifiedDuringHold = true;
          this.sequencer.setStepParamLock(activeSlotIdx, this.heldStepIndex, paramKey, lockVal, false);
          this._updateTouchStepGrid();
          this._updateStepInspector(activeSlotIdx, this.heldStepIndex);
          this._updateLcdStatus(`P-LOCK STEP ${this.heldStepIndex + 1}: ${paramKey} = ${typeof lockVal === 'number' && !Number.isInteger(lockVal) ? lockVal.toFixed(2) : lockVal}`);
          this._syncPoState();
          return;
        }
      }
    }

    // 3. Real-Time Automation Recording (PO-33 Live Knob Motion Recording - Track Bank Only)
    // CRITICAL: Only record automation onto ALREADY ACTIVE steps!
    // Turning a knob during live recording must NEVER activate empty steps or create ghost notes.
    if (this.sequencer.isPlaying && this.sequencer.isRecording) {
      const curStep = this.sequencer.currentStep;
      const pattern = this.sequencer.getCurrentPattern();
      const step = (pattern && pattern.tracks[activeSlotIdx]) ? pattern.tracks[activeSlotIdx][curStep] : null;

      if (step && step.active) {
        let paramKey = '';
        let lockVal = value;

        if (knobIdx === 0) { paramKey = 'trimStart'; lockVal = value / 127; }
        else if (knobIdx === 1) { paramKey = 'trimEnd'; lockVal = value / 127; }
        else if (knobIdx === 2) { paramKey = 'pitch'; lockVal = Math.round(((value / 127) * 48) - 24); }
        else if (knobIdx === 3) { paramKey = 'poFilter'; lockVal = value; }
        else if (knobIdx === 5) { paramKey = 'decay'; lockVal = (value <= 32) ? (0.05 + (value / 32) * 0.95) : (1.0 + ((value - 32) / 95) * 7.0); }

        if (paramKey) {
          this.sequencer.setStepParamLock(activeSlotIdx, curStep, paramKey, lockVal, false);
          if (this.minimalPoView) this.minimalPoView.triggerPunch('LOCK');
        }
      }
    }

    // 4. TRACK / SAMPLE KNOB BANK DISPATCH

    switch (knobIdx) {
      case 0:
        if (slot) {
          slot.trimStart = (value / 127);
          this.waveformView.render();
          this._lastParamMsg = `START ${(slot.trimStart * 100).toFixed(0)}%`;
          this._updateLcdStatus(`SAMPLE START: ${(slot.trimStart * 100).toFixed(0)}%`);
        }
        break;
      case 1:
        if (slot) {
          slot.trimEnd = (value / 127);
          this.waveformView.render();
          this._lastParamMsg = `END ${(slot.trimEnd * 100).toFixed(0)}%`;
          this._updateLcdStatus(`SAMPLE END: ${(slot.trimEnd * 100).toFixed(0)}%`);
        }
        break;
      case 2:
        if (slot) {
          const semitones = Math.round(((value / 127) * 48) - 24);
          slot.pitch = semitones;
          this._lastParamMsg = `PITCH ${semitones > 0 ? '+' : ''}${semitones}`;
          this._updateLcdStatus(`PITCH: ${semitones > 0 ? '+' : ''}${semitones} ST`);
        }
        break;
      case 3:
        this.audioEngine.setPoDualFilter(value);
        let fText = 'FILTER: OFF';
        if (value < 64) fText = `LPF: ${Math.round((value / 63) * 100)}%`;
        else if (value > 64) fText = `HPF: ${Math.round(((value - 64) / 63) * 100)}%`;
        if (this.lcdFilter) this.lcdFilter.textContent = fText;
        this._lastParamMsg = fText;
        this._updateLcdStatus(fText);
        break;
      case 4:
        this.audioEngine.setFilterResonance(value);
        this._lastParamMsg = `RES Q ${(this.audioEngine.getResonanceValue()).toFixed(1)}`;
        this._updateLcdStatus(`RES Q: ${(this.audioEngine.getResonanceValue()).toFixed(1)}`);
        break;
      case 5:
        if (slot) {
          const decaySec = (value <= 32) ? (0.05 + (value / 32) * 0.95) : (1.0 + ((value - 32) / 95) * 7.0);
          slot.decay = decaySec;
          this._lastParamMsg = `DECAY ${decaySec.toFixed(2)}s`;
          this._updateLcdStatus(`DECAY: ${decaySec.toFixed(2)}s`);
        }
        break;
      case 6:
        this.audioEngine.setFxSend(value);
        this._lastParamMsg = `DELAY ${Math.round((value / 127) * 100)}%`;
        this._updateLcdStatus(`DELAY SEND: ${Math.round((value / 127) * 100)}%`);
        break;
      case 7:
        this.audioEngine.setMasterCompVol(value);
        this._lastParamMsg = `DRIVE ${Math.round((value / 127) * 100)}%`;
        this._updateLcdStatus(`MASTER DRIVE: ${Math.round((value / 127) * 100)}%`);
        break;
    }
    if (this.mixerRackView) {
      this.mixerRackView.updateDspReadouts(this.knobValues);
    }
    this._syncPoState();
  }

  _renderKnob(knobIdx) {
    const el = document.querySelector(`.macro-knob[data-knob="${knobIdx}"]`);
    if (!el) return;
    const val = this.knobValues[knobIdx];
    const valDisplay = el.querySelector('.knob-val');
    const dial = el.querySelector('.knob-indicator');

    const angle = -135 + (val / 127) * 270;
    if (dial) dial.style.transform = `rotate(${angle}deg)`;
    if (valDisplay) valDisplay.textContent = `${val}`;
  }

  _updateKnobLabels() {
    const isMaster = (this.knobBank === 'master');
    const trackLabels = [
      { num: '1', name: 'Start', hint: 'APC: Knob 1 (CC 48) -> Sample Start Trim (or P-Lock on held step)' },
      { num: '2', name: 'End', hint: 'APC: Knob 2 (CC 49) -> Sample End Trim (or P-Lock on held step)' },
      { num: '3', name: 'Pitch', hint: 'APC: Knob 3 (CC 50) -> Pitch Tuning -24..+24 ST (or P-Lock on held step)' },
      { num: '4', name: 'Filter', hint: 'APC: Knob 4 (CC 51) -> PO Dual LPF/HPF (or P-Lock on held step)' },
      { num: '5', name: 'Res Q', hint: 'APC: Knob 5 (CC 52) -> Filter Resonance Q' },
      { num: '6', name: 'Decay', hint: 'APC: Knob 6 (CC 53) -> Amp Envelope Decay Time (or P-Lock on held step)' },
      { num: '7', name: 'FX Send', hint: 'APC: Knob 7 (CC 54) -> Space Delay FX Send' },
      { num: '8', name: 'Drive/Vol', hint: 'APC: Knob 8 (CC 55) -> Track Level / Drive' },
    ];
    const masterLabels = [
      { num: '1', name: 'BPM', hint: 'APC: Knob 1 (CC 48) -> Master Tempo (40-220 BPM)' },
      { num: '2', name: 'Swing', hint: 'APC: Knob 2 (CC 49) -> Master Swing (50-75%)' },
      { num: '3', name: 'Tune', hint: 'APC: Knob 3 (CC 50) -> Master Pitch Tune (-12..+12 ST)' },
      { num: '4', name: 'M-Filter', hint: 'APC: Knob 4 (CC 51) -> Global Master Dual Filter (LPF < 64 > HPF)' },
      { num: '5', name: 'M-Res Q', hint: 'APC: Knob 5 (CC 52) -> Global Master Resonance Q' },
      { num: '6', name: 'Dly Time', hint: 'APC: Knob 6 (CC 53) -> Space Delay Time' },
      { num: '7', name: 'SC Rel', hint: 'APC: Knob 7 (CC 54) -> Sidechain Ducking Release (40-500ms)' },
      { num: '8', name: 'SC/Vol', hint: 'APC: Knob 8 (CC 55) -> Sidechain Duck Depth (0-100%) & Master Vol' },
    ];

    const labels = isMaster ? masterLabels : trackLabels;
    for (let k = 0; k < 8; k++) {
      const knobEl = document.querySelector(`.macro-knob[data-knob="${k}"]`);
      if (knobEl) {
        const labelEl = knobEl.querySelector('.knob-label');
        if (labelEl) labelEl.textContent = `${labels[k].num}: ${labels[k].name}`;
        knobEl.title = labels[k].hint;
        knobEl.dataset.apcHint = labels[k].hint;
      }
    }
  }

  _syncPadGridLeds() {
    if (this.midiManager.patternButtonHeld) {
      this._syncPatternSelectGridLeds();
      return;
    }
    if (this.midiManager.soundButtonHeld) {
      this._syncSoundSelectGridLeds();
      return;
    }

    const mode = this.midiManager.operationalMode;

    if (mode === OPERATIONAL_MODES.PATTERN) {
      this._syncSequencerLeds();
      this._syncPatternLeds();
      this._syncTrackMuteLeds();
      this._syncFxLeds();
    } else if (mode === OPERATIONAL_MODES.SAMPLE) {
      this.midiManager.renderSlotLeds(this.audioEngine.activeSlotIndex);
      this._syncSlotLeds();
    } else if (mode === OPERATIONAL_MODES.PERFORMANCE) {
      this.midiManager.renderPerformanceLeds(this.sequencer.activePatternIndex);
    }
  }

  _syncSequencerLeds() {
    const activeSlot = this.audioEngine.activeSlotIndex;
    const curPat = this.sequencer.getCurrentPattern();
    const allSteps = this.sequencer.getTrackSteps(activeSlot);
    const playheadGlobal = (this.sequencer.isPlaying || this.sequencer.isPaused) ? this._lastPlayheadStep : -1;

    // Slice 16 steps for the current page
    const pageOffset = this.activePage * 16;
    const pageSteps = allSteps.slice(pageOffset, pageOffset + 16);
    while (pageSteps.length < 16) pageSteps.push(false);

    // Playhead index relative to active page
    let pagePlayhead = -1;
    if (playheadGlobal >= 0 && Math.floor(playheadGlobal / 16) === this.activePage) {
      pagePlayhead = playheadGlobal % 16;
    }

    this.midiManager.renderSequencerLeds(pageSteps, pagePlayhead);

    for (let i = 0; i < 16; i++) {
      const row = Math.floor(i / 8);
      const col = i % 8;
      const isActive = pageSteps[i];
      const isPlayhead = (i === pagePlayhead);

      let color = 'off';
      if (isPlayhead) color = isActive ? 'red-blink' : 'green-blink';
      else if (isActive) color = 'amber';
      else color = 'off';

      this.hardwareGrid.setPadLed(row, col, color);
    }
  }

  _syncPatternLeds() {
    this.midiManager.renderPatternLeds(
      this.sequencer.activePatternIndex,
      this.sequencer.patternChain,
      this.sequencer.queuedPatternIndex
    );
    for (let col = 0; col < 8; col++) {
      let color = 'off';
      if (this.sequencer.activePatternIndex === col) {
        color = 'green';
      } else if (this.sequencer.queuedPatternIndex === col) {
        color = 'green-blink';
      } else if (this.sequencer.patternChain && this.sequencer.patternChain.includes(col)) {
        color = 'amber';
      }
      this.hardwareGrid.setPadLed(2, col, color);
    }
  }

  _syncPatternSelectGridLeds() {
    const activePat = this.sequencer.activePatternIndex;
    const queuedPat = this.sequencer.queuedPatternIndex;
    const chain = this.sequencer.patternChain;

    this.midiManager.renderPatternSelectGridLeds(activePat, chain, queuedPat);

    for (let i = 0; i < 16; i++) {
      const row = Math.floor(i / 8);
      const col = i % 8;
      let color = 'off';
      if (i === activePat) {
        color = 'green';
      } else if (i === queuedPat) {
        color = 'green-blink';
      } else if (chain.includes(i)) {
        color = 'amber';
      }
      this.hardwareGrid.setPadLed(row, col, color);
    }
  }

  _syncSoundSelectGridLeds() {
    const activeSlot = this.audioEngine.activeSlotIndex;
    this.midiManager.renderSoundSelectGridLeds(activeSlot);

    for (let i = 0; i < 16; i++) {
      const row = Math.floor(i / 8);
      const col = i % 8;
      let color = 'off';
      if (i === activeSlot) {
        color = 'green';
      } else if (i < 8) {
        color = 'amber';
      } else {
        color = 'red';
      }
      this.hardwareGrid.setPadLed(row, col, color);
    }
  }

  _syncTrackMuteLeds() {
    const mutes = this.sequencer.getCurrentPattern().trackMutes;
    this.midiManager.renderTrackMuteLeds(mutes);
    for (let col = 0; col < 8; col++) {
      this.hardwareGrid.setPadLed(3, col, mutes[col] ? 'red' : 'green');
    }
  }

  _syncSlotLeds() {
    const activeIdx = this.audioEngine.activeSlotIndex;

    for (let col = 0; col < 8; col++) {
      this.hardwareGrid.setPadLed(0, col, activeIdx === col ? 'amber' : 'green');
    }
    for (let col = 0; col < 8; col++) {
      this.hardwareGrid.setPadLed(1, col, activeIdx === (8 + col) ? 'red' : 'green');
    }
  }

  _syncFxLeds() {
    const fxSet = this.audioEngine.punchInFx.activeFx;
    this.midiManager.renderFxLeds(fxSet);

    for (let col = 0; col < 8; col++) {
      const isActive = fxSet.has(col);
      this.hardwareGrid.setPadLed(4, col, isActive ? 'red-blink' : 'off');
    }
  }

  _syncSceneLeds() {
    const state = {
      isPlaying: this.sequencer.isPlaying,
      isPaused: this.sequencer.isPaused,
      isRecording: this.audioEngine.recorder.isRecording,
      isRecArmed: this.sequencer.isRecording,
      isSlicing: false,
      metronome: this.sequencer.metronomeEnabled
    };

    this.midiManager.renderSceneLeds(state);

    let scene1Color = 'off';
    if (state.isPlaying) scene1Color = 'green';
    else if (state.isPaused) scene1Color = 'green-blink';

    this.hardwareGrid.setSceneLed(1, scene1Color);
    this.hardwareGrid.setSceneLed(2, state.isRecording ? 'red' : (state.isRecArmed ? 'red-blink' : 'off'));
    this.hardwareGrid.setSceneLed(3, 'off');
    this.hardwareGrid.setSceneLed(4, state.metronome ? 'amber' : 'off');
    this.hardwareGrid.setSceneLed(5, this.midiManager.shiftActive ? 'green' : 'off');
  }

  _syncPoState() {
    if (!this.minimalPoView) return;
    const curSlot = this.audioEngine.getActiveSlot();
    const curPattern = this.sequencer.getCurrentPattern();

    this.minimalPoView.updateState({
      mode: this.midiManager.operationalMode,
      isPlaying: this.sequencer.isPlaying,
      isPaused: this.sequencer.isPaused,
      isRecording: this.sequencer.isRecording || this.audioEngine.recorder.isRecording,
      isTrimming: this.knobValues[0] > 0 || this.knobValues[1] < 127,
      isFxActive: this.audioEngine.punchInFx.activeFx.size > 0,
      hasPLock: this.heldStepIndex >= 0,
      metronome: this.sequencer.metronomeEnabled,
      swing: this.sequencer.swing,
      knobBank: this.knobBank,
      slotType: curSlot ? curSlot.type : 'melodic',
      bpm: this.sequencer.bpm,
      pattern: this.sequencer.activePatternIndex,
      slot: this.audioEngine.activeSlotIndex,
      filterVal: this.knobValues[3],
      sustainActive: this.audioEngine.sustainActive,
      hasMutes: curPattern ? curPattern.trackMutes.some(Boolean) : false,
      chokeActive: curSlot ? !!curSlot.choke : false,
      paramMsg: this._lastParamMsg || 'READY'
    });
  }

  _startMeterLoop() {
    const data = new Uint8Array(this.audioEngine.analyser.frequencyBinCount);

    const updateVu = () => {
      this.audioEngine.analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        sum += data[i];
      }
      const avg = sum / data.length;
      const pct = Math.min(100, Math.round((avg / 128) * 100));

      if (this.vuMeterL) this.vuMeterL.style.height = `${pct}%`;
      if (this.vuMeterR) this.vuMeterR.style.height = `${Math.min(100, pct * 0.95)}%`;

      // Live Sidechain Ducking & Glue Compressor Gain Reduction Meters
      const scFill = document.getElementById('sidechain-duck-fill');
      if (scFill && this.audioEngine.sidechainGain) {
        const curScGain = this.audioEngine.sidechainGain.gain.value;
        const duckPct = this.audioEngine.sidechainEnabled ? Math.max(0, Math.min(100, Math.round((1.0 - curScGain) * 100))) : 0;
        scFill.style.width = `${duckPct}%`;
      }

      const grFill = document.getElementById('comp-gr-fill');
      if (grFill && this.audioEngine.compressor) {
        const red = Math.abs(this.audioEngine.compressor.reduction || 0);
        const grPct = Math.min(100, Math.round(red * 5));
        grFill.style.width = `${grPct}%`;
      }

      if (this.minimalPoView) {
        const inPeak = this.audioEngine.recorder.lastPeak || 0;
        this.minimalPoView.updateVu(pct / 100, (pct * 0.95) / 100, inPeak);
      }

      requestAnimationFrame(updateVu);
    };

    requestAnimationFrame(updateVu);
  }

  _flashMidiLed(type) {
    const led = (type === 'in') ? this.midiLedIn : this.midiLedOut;
    if (led) {
      led.classList.add('active');
      setTimeout(() => led.classList.remove('active'), 80);
    }
  }

  _updateLcdStatus(msg, isHint = false) {
    if (!isHint) {
      this._lastStatusMsg = msg;
    }
    if (this.lcdStatusMsg) {
      this.lcdStatusMsg.textContent = msg.toUpperCase();
      if (isHint) {
        this.lcdStatusMsg.style.color = '#ff9f43';
      } else {
        this.lcdStatusMsg.style.color = '#61afef';
      }
    }
  }

  _initApcHoverHints() {
    let lastHoveredEl = null;

    document.addEventListener('mouseover', (e) => {
      if (!e.target || typeof e.target.closest !== 'function') return;
      const target = e.target.closest('[data-apc-hint], [title]');
      if (!target || target === lastHoveredEl) return;
      lastHoveredEl = target;

      const rawHint = target.dataset.apcHint || target.title;
      if (rawHint) {
        const displayMsg = rawHint.startsWith('APC:') ? rawHint : `APC: ${rawHint}`;
        this._updateLcdStatus(displayMsg, true);
        if (!target.title) {
          target.title = displayMsg;
        }
      }
    });

    document.addEventListener('mouseout', (e) => {
      if (!e.target || typeof e.target.closest !== 'function') return;
      const target = e.target.closest('[data-apc-hint], [title]');
      if (!target) return;
      if (e.relatedTarget && target.contains(e.relatedTarget)) return;
      if (target === lastHoveredEl) {
        lastHoveredEl = null;
        this._updateLcdStatus(this._lastStatusMsg || 'READY // APC KEY 25 READY', false);
      }
    });
  }

  refreshAll() {
    this.refreshSlotDisplay();
    this._syncPadGridLeds();
    this._syncSceneLeds();
    this._renderSongChainBar();
    this._updateTouchStepGrid();
    this._updateRecModeButtonState();
    this._updateSidechainToggleState();
    this._syncPoState();
    if (this.mixerRackView) {
      this.mixerRackView.updateAll();
      this.mixerRackView.updateDspReadouts(this.knobValues);
    }
    if (this.lcdBpm) this.lcdBpm.textContent = `${this.sequencer.bpm}`;
    if (this.lcdPattern) this.lcdPattern.textContent = `P${this.sequencer.activePatternIndex + 1}`;
  }
}
