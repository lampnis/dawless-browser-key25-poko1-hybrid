/**
 * Open-KO: GuidedWalkthrough
 * Hand-holding interactive First-Run Onboarding Tour that teaches every core
 * FL Studio + Akai APC Key 25 workflow step-by-step with live UI spotlighting
 * and highlighted Akai APC Key 25 hardware diagrams.
 */

import { ApcHardwareHelp } from './ApcHardwareHelp.js';

export const WALKTHROUGH_STORAGE_KEY = 'open_ko_walkthrough_done_v1';

export class GuidedWalkthrough {
  constructor(uiManager) {
    this.ui = uiManager;
    this.isActive = false;
    this.currentStep = 0;
    this.overlayEl = null;
    this.cardEl = null;
    this._highlightedEl = null;

    this.steps = [
      {
        id: 'welcome',
        target: '#fl-main-toolbar',
        title: '1. Welcome to Open-KO — Unlock Audio First',
        body: 'Open-KO combines an FL Studio Channel Rack, Insert Mixer, and PO-33 sampler with 100% hands-on Akai APC Key 25 Mk1 control. Browser security mutes Web Audio until your first click — hit "Try It" below to unlock audio and hear your active kit immediately.',
        apcTip: 'Any hover in Open-KO displays an interactive APC Key 25 diagram showing the exact physical button.',
        controls: ['play', 'keys'],
        actionLabel: 'Try It: Unlock Audio & Audition Sound',
        onAction: async () => {
          await this.ui.audioEngine.ensureAudioContext();
          this.ui.updateAudioStateIndicator();
          this.ui.auditionActiveSlot();
        }
      },
      {
        id: 'transport',
        target: '#tour-transport',
        title: '2. Transport: Play, Pause, Stop & Tempo',
        body: 'Press PLAY / PAUSE to start and pause playback while preserving your exact playhead position. Press STOP to silence voices and reset to Step 1. Change tempo anytime with the Tempo -/+ buttons or Shift + Knob 8 (last knob) on your APC Key 25.',
        apcTip: 'APC: PLAY/PAUSE (Note 91) or Scene 1 (Note 82) | STOP ALL (Note 81) | Shift + Knob 8 = BPM',
        controls: ['play', 'scene1', 'stop', 'shift', 'knob-7'],
        actionLabel: 'Try It: Toggle Play / Pause',
        onAction: () => {
          this.ui.sequencer.togglePlayPause();
        }
      },
      {
        id: 'samples',
        target: '#tour-samples',
        title: '3. Browse, Switch & Play All 60 Samples',
        body: 'Open-KO includes 16 simultaneous tracks (Tracks 1–8 Melodic, Tracks 9–16 Sliced Drum Kits) and 60 synthesized presets (Concert Grand Piano, Dusty Jazz Rhodes, 808 Slide Sub, SP-1200 Boom-Bap, TR-909/808). Pick any sound with the dropdown, ◀/▶ buttons, or AUDITION — or jam directly on the 25-key keybed (keys A–P on your computer keyboard).',
        apcTip: 'APC: Hold ► (Note 67) + Pad 1–16 selects any Track | Shift + ▲/▼ cycles all 60 presets | Ch 2 Keys play sound!',
        controls: ['shift', 'track-0', 'track-1', 'track-3', 'keys'],
        actionLabel: 'Try It: Cycle Next Preset & Audition',
        onAction: () => {
          this.ui.cycleActivePreset(1);
        }
      },
      {
        id: 'freeform',
        target: '#btn-rec-mode',
        title: '4. Choppy Hip-Hop Freeform Recording (Auto-BPM)',
        body: 'Recording defaults to FREEFORM 128th mode for dirty, unquantized sampling: press REC to arm, strike your first chop or drum freely (timing begins on your first strike!), then tap REC again on the downbeat. Open-KO calculates your exact BPM and lays every hit onto the 128th-note grid. Toggle QUANTIZED anytime to layer chords and hats onto a running loop.',
        apcTip: 'APC: REC (Note 93 / Scene 2) = Arm & Seal Loop | Shift + Pad 9 (Note 24) or Shift + PLAY = Freeform/Quantized',
        controls: ['rec', 'scene2', 'shift', 'pad-1-0'],
        actionLabel: 'Try It: Toggle Freeform / Quantized Mode',
        onAction: () => {
          this.ui._handleHardwarePatternTool('toggleRecMode');
        }
      },
      {
        id: 'channel_rack',
        target: '#tour-channel-rack',
        title: '5. FL Channel Rack, 8X Zoom (128th) & Pocket Nudging',
        body: 'Program beats on the alternating 4-step grey/plum Channel Rack buttons. Zoom from 1X (16 steps) up to 8X (128 discrete 128th-note steps across P1–P8) without changing tempo! Hold any active step pad on the APC Key 25 to inspect it without deleting, turn Knobs 1–6 to P-Lock, or nudge its timing across the 128th-note pocket.',
        apcTip: 'APC: Rows 1–2 Pads = Steps | Shift + Knob 1 = Zoom 1X–8X | Hold Step + Shift + Knob 3 (or Shift + Pads 11/12) = 128th Nudge',
        controls: ['row-0', 'row-1', 'shift', 'knob-0', 'knob-2', 'pad-1-2', 'pad-1-3'],
        actionLabel: 'Try It: Switch Zoom 1X -> 2X -> 1X',
        onAction: () => {
          const curZoom = this.ui.sequencer.getCurrentPattern().zoom || 1;
          this.ui.setPatternZoom(curZoom === 1 ? 2 : 1);
        }
      },
      {
        id: 'stretch_sample',
        target: '.waveform-section',
        title: '6. Constant-Time Pitching, Auto-Slice & Tab Sampling',
        body: 'Drag green/red trim handles or click drum slices on the waveform to audition. Melodic slots default to STRETCH: PITCH ONLY so higher octaves ring out with full duration instead of squeezing short (toggle SQUEEZE for classic varispeed). Capture external audio straight from YouTube/Spotify via TAB AUDIO or your USB interface via LINE / MIC.',
        apcTip: 'APC: Knob 1/2 = Trim Start/End | Shift + Knob 6 = PITCH ONLY vs SQUEEZE | Scene 3 = Auto-Slice | Shift + REC = Sample',
        controls: ['knob-0', 'knob-1', 'shift', 'knob-5', 'scene3'],
        actionLabel: 'Try It: Audition Waveform Sample',
        onAction: () => {
          this.ui.auditionActiveSlot();
        }
      },
      {
        id: 'sidechain',
        target: '#mixer-rack-section',
        title: '7. 16-Track Insert Mixer & Sidechain Ducking Compressor',
        body: 'Mix all 16 simultaneous instruments with vertical faders, M (Mute), S (Solo), and D (Sidechain Duck). Melodic tracks duck automatically whenever the orange SC trigger track (default Track 9 Kick) hits — both live and in offline WAV exports!',
        apcTip: 'APC: Shift + Pad 13 = Sidechain ON/OFF | Pad 14 = Track Duck (D) | Pad 15 = Set Trigger (SC) | Master Knobs 7 & 8 = Release & Depth',
        controls: ['shift', 'pad-1-4', 'pad-1-5', 'pad-1-6', 'track-7', 'knob-6', 'knob-7'],
        actionLabel: 'Try It: Toggle Master Sidechain',
        onAction: () => {
          this.ui._handleHardwarePatternTool('toggleSidechain');
        }
      },
      {
        id: 'fx',
        target: '#dsp-module-fx',
        title: '8. 8 Momentary Punch-In Performance FX',
        body: 'Hold Row 5 Pads (Notes 0–7) or click the Slot 5 FX pads during playback for instant live fills: 1/8 Stutter, 1/16 Beat Roll, 12-Bit SP-1200 Crunch, Vinyl Brake Stop, Resonant HPF Sweep, LPF Sub-Drop, French House Sidechain Pump, and warm Dub Space Echo.',
        apcTip: 'APC: Hold Matrix Row 5 Pads 1–8 (Notes 0–7) to engage Punch-In FX live!',
        controls: ['row-4'],
        actionLabel: null,
        onAction: null
      },
      {
        id: 'playlist',
        target: '#tour-playlist',
        title: '9. Playlist Pattern Chaining & 16-Bit WAV Export',
        body: 'Build multi-bar song arrangements by chaining patterns in the Playlist bar (+ APPEND or hold ◄ + tap a pad sequence like 1 → 1 → 2 → 3). Click SAVE to keep your project in localStorage, or EXPORT WAV to render a 16-bit 44.1 kHz stereo master with full sidechain & 128th micro-timing.',
        apcTip: 'APC: Hold ◄ (Note 66) + tap Pad sequence = Chain Patterns | Scene 5 = Append | Shift + Scene 5 = Reset Chain',
        controls: ['track-2', 'row-2', 'scene5'],
        actionLabel: null,
        onAction: null
      },
      {
        id: 'help_finish',
        target: '#btn-toggle-help-panel',
        title: '10. On-The-Fly Hardware Help & APC Tester',
        body: 'Anytime you forget a shortcut, simply hover over any UI button for an instant floating Akai APC Key 25 diagram — or pin the Ableton-style INFO BOX in the corner! Use TEST APC (Shift + Stop All) to verify every pad, knob, and octave shift on your physical controller. You are ready to make beats!',
        apcTip: 'APC: Shift + Stop All (Note 81) = Hardware Tester | Shift + Sustain (CC 64) = PO-33 Minimal View',
        controls: ['shift', 'stop', 'sustain', 'oct-dn', 'oct-up'],
        actionLabel: 'Open Docked Info Box & Start Creating!',
        onAction: () => {
          if (this.ui.hardwareHelp) this.ui.hardwareHelp.toggleInfoBox(true);
          this.completeAndClose();
        }
      }
    ];
  }

  shouldAutoStart() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.getItem === 'function') {
        return !localStorage.getItem(WALKTHROUGH_STORAGE_KEY);
      }
    } catch (e) {}
    return false;
  }

  markCompleted() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.setItem === 'function') {
        localStorage.setItem(WALKTHROUGH_STORAGE_KEY, '1');
      }
    } catch (e) {}
  }

  open(stepIndex = 0) {
    if (typeof document === 'undefined') return;
    if (!this.overlayEl) {
      this._buildDom();
    }
    this.isActive = true;
    this.currentStep = Math.max(0, Math.min(this.steps.length - 1, stepIndex));
    this.overlayEl.classList.add('open');
    this._renderStep();
  }

  close() {
    this.isActive = false;
    this._clearHighlight();
    if (this.overlayEl) {
      this.overlayEl.classList.remove('open');
    }
  }

  completeAndClose() {
    this.markCompleted();
    this.close();
  }

  next() {
    if (this.currentStep < this.steps.length - 1) {
      this.currentStep++;
      this._renderStep();
    } else {
      this.completeAndClose();
    }
  }

  prev() {
    if (this.currentStep > 0) {
      this.currentStep--;
      this._renderStep();
    }
  }

  _buildDom() {
    this.overlayEl = document.createElement('div');
    this.overlayEl.id = 'guided-walkthrough-overlay';
    this.overlayEl.className = 'walkthrough-backdrop';

    this.cardEl = document.createElement('div');
    this.cardEl.className = 'walkthrough-card';
    this.overlayEl.appendChild(this.cardEl);
    document.body.appendChild(this.overlayEl);
  }

  _clearHighlight() {
    if (this._highlightedEl) {
      this._highlightedEl.classList.remove('walkthrough-spotlight');
      this._highlightedEl = null;
    }
  }

  _renderStep() {
    if (!this.cardEl) return;
    const step = this.steps[this.currentStep];
    const total = this.steps.length;
    const isLast = (this.currentStep === total - 1);

    // Highlight & scroll target into view
    this._clearHighlight();
    const targetEl = step.target ? document.querySelector(step.target) : null;
    if (targetEl) {
      targetEl.classList.add('walkthrough-spotlight');
      this._highlightedEl = targetEl;
      try {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch (e) {}
    }

    const progressPct = Math.round(((this.currentStep + 1) / total) * 100);

    this.cardEl.innerHTML = `
      <div class="wt-header">
        <div class="wt-step-badge">GUIDED WALKTHROUGH // STEP ${this.currentStep + 1} OF ${total}</div>
        <button id="wt-btn-skip" class="fl-btn fl-btn-xs" title="Close walkthrough and don't auto-show again">SKIP TOUR ✕</button>
      </div>
      <div class="wt-progress-track"><div class="wt-progress-fill" style="width: ${progressPct}%;"></div></div>

      <h3 class="wt-title">${step.title}</h3>
      <p class="wt-body">${step.body}</p>

      <div class="wt-apc-box">
        <div class="wt-apc-label">${step.apcTip}</div>
        <div class="wt-apc-svg">${ApcHardwareHelp.renderApcSvg(step.controls, false)}</div>
      </div>

      ${step.actionLabel ? `
        <div class="wt-try-row">
          <button id="wt-btn-try" class="fl-btn btn-accent-green">${step.actionLabel}</button>
        </div>
      ` : ''}

      <div class="wt-footer">
        <button id="wt-btn-prev" class="fl-btn" ${this.currentStep === 0 ? 'disabled' : ''}>◀ BACK</button>
        <div class="wt-dots">
          ${this.steps.map((_, i) => `<span class="wt-dot ${i === this.currentStep ? 'active' : (i < this.currentStep ? 'done' : '')}" data-step="${i}"></span>`).join('')}
        </div>
        <button id="wt-btn-next" class="fl-btn btn-accent-orange">${isLast ? 'FINISH ✓' : 'NEXT ▶'}</button>
      </div>
    `;

    const skipBtn = document.getElementById('wt-btn-skip');
    if (skipBtn) skipBtn.addEventListener('click', () => this.completeAndClose());

    const prevBtn = document.getElementById('wt-btn-prev');
    if (prevBtn) prevBtn.addEventListener('click', () => this.prev());

    const nextBtn = document.getElementById('wt-btn-next');
    if (nextBtn) nextBtn.addEventListener('click', () => this.next());

    const tryBtn = document.getElementById('wt-btn-try');
    if (tryBtn && typeof step.onAction === 'function') {
      tryBtn.addEventListener('click', () => step.onAction());
    }

    this.cardEl.querySelectorAll('.wt-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        const idx = parseInt(dot.dataset.step, 10);
        if (!isNaN(idx)) {
          this.currentStep = idx;
          this._renderStep();
        }
      });
    });
  }
}
