/**
 * Open-KO: MixerRackView
 * 16-Track Simultaneous Layering Multitrack Mixer & Master DSP Effects Rack.
 * Gives complete transparency over track layering, instrument capacity, mutes, solos, and FX.
 */

import { PUNCH_IN_FX_NAMES } from '../midi/ApcConstants.js';

export class MixerRackView {
  constructor(audioEngine, sequencer, callbacks = {}) {
    this.audioEngine = audioEngine;
    this.sequencer = sequencer;
    this.callbacks = callbacks; // onSlotSelect, onMuteToggle, onSoloToggle, onVolumeChange

    this.container = document.getElementById('mixer-strips-container');
    this.panel = document.getElementById('mixer-rack-section');
    this.toggleBtn = document.getElementById('btn-toggle-mixer');

    this.isCollapsed = false;
    this.trackStrips = [];

    this._bindControls();
  }

  init() {
    try {
      this._renderStrips();
      this._initDspRack();
      this.updateAll();
    } catch (err) {
      console.warn('MixerRackView init error (non-fatal):', err);
    }
  }

  _bindControls() {
    if (this.toggleBtn && this.panel) {
      this.toggleBtn.addEventListener('click', () => {
        this.isCollapsed = !this.isCollapsed;
        this.panel.classList.toggle('collapsed', this.isCollapsed);
        this.toggleBtn.textContent = this.isCollapsed ? 'EXPAND MIXER' : 'COLLAPSE';
      });
    }
  }

  _renderStrips() {
    if (!this.container) return;
    this.container.innerHTML = '';
    this.trackStrips = [];

    for (let i = 0; i < 16; i++) {
      const slot = this.audioEngine.slots[i];
      const isMelodic = (i < 8);
      const trackNum = i + 1;

      const strip = document.createElement('div');
      strip.className = `mixer-strip ${isMelodic ? 'strip-melodic' : 'strip-drum'}`;
      strip.dataset.slot = i;

      const muteHint = i < 8
        ? `APC: Bottom Track Button ${trackNum} (Note ${64 + i}) -> Toggle Track ${trackNum} Mute`
        : `APC: Shift + Bottom Track Button ${(i - 8) + 1} (Note ${64 + (i - 8)}) -> Toggle Track ${trackNum} Mute`;
      const jamHint = i < 8
        ? `APC: Matrix Row 3 Pad ${trackNum} (Note ${16 + i}) or Hold ► + Pad ${trackNum} -> Select Track ${trackNum}`
        : `APC: Matrix Row 4 Pad ${(i - 8) + 1} (Note ${8 + (i - 8)}) or Hold ► + Pad ${trackNum} -> Select Track ${trackNum}`;
      const faderHint = `APC: Select track and adjust level or tweak Master Knob 8`;
      const soloHint = `APC: Solo Track ${trackNum} in Mixer`;

      strip.title = jamHint;
      strip.dataset.apcHint = jamHint;

      strip.innerHTML = `
        <div class="strip-header">
          <span class="strip-num">T${trackNum}</span>
          <span class="strip-type-badge ${isMelodic ? 'badge-mel' : 'badge-drm'}">${isMelodic ? 'MEL' : 'DRM'}</span>
          <span class="strip-led" id="strip-led-${i}"></span>
        </div>

        <div class="strip-name" title="${slot ? slot.name : ''}">${slot ? slot.name : `Track ${trackNum}`}</div>

        <div class="strip-steps-badge" id="strip-steps-${i}">0 STEPS</div>

        <div class="strip-fader-box">
          <input type="range" class="strip-fader" id="strip-vol-${i}" min="0" max="127" value="${Math.round((slot.volume || 0.85) * 127)}" title="${faderHint}" data-apc-hint="${faderHint}">
        </div>

        <div class="strip-btn-row">
          <button class="strip-btn strip-mute-btn" id="strip-mute-${i}" title="${muteHint}" data-apc-hint="${muteHint}">M</button>
          <button class="strip-btn strip-solo-btn" id="strip-solo-${i}" title="${soloHint}" data-apc-hint="${soloHint}">S</button>
          <button class="strip-btn strip-duck-btn ${slot.sidechainDucked !== false ? 'active' : ''}" id="strip-duck-${i}" title="APC: Select Track ${trackNum} then press Shift + Pad 14 (Note 29) -> Toggle Sidechain Ducking (Shift + Pad 15 sets Trigger Source)" data-apc-hint="APC: Shift + Pad 14 (Note 29) -> Toggle Track Sidechain Duck | Shift + Pad 15 -> Set SC Trigger">D</button>
        </div>

        <button class="strip-jam-btn" id="strip-jam-${i}" title="${jamHint}" data-apc-hint="${jamHint}">JAM</button>
      `;

      // Bind events
      const fader = strip.querySelector(`#strip-vol-${i}`);
      if (fader) {
        fader.addEventListener('input', (e) => {
          const val = parseInt(e.target.value, 10);
          slot.volume = val / 127;
          if (this.callbacks.onVolumeChange) this.callbacks.onVolumeChange(i, slot.volume);
        });
      }

      const muteBtn = strip.querySelector(`#strip-mute-${i}`);
      if (muteBtn) {
        muteBtn.addEventListener('click', () => {
          const isMuted = this.sequencer.toggleTrackMute(i);
          muteBtn.classList.toggle('active', isMuted);
          if (this.callbacks.onMuteToggle) this.callbacks.onMuteToggle(i, isMuted);
        });
      }

      const soloBtn = strip.querySelector(`#strip-solo-${i}`);
      if (soloBtn) {
        soloBtn.addEventListener('click', () => {
          const isSolo = this.sequencer.toggleTrackSolo(i);
          soloBtn.classList.toggle('active', isSolo);
          if (this.callbacks.onSoloToggle) this.callbacks.onSoloToggle(i, isSolo);
          this.updateMuteAndSoloStates();
        });
      }

      const duckBtn = strip.querySelector(`#strip-duck-${i}`);
      if (duckBtn) {
        duckBtn.addEventListener('click', () => {
          slot.sidechainDucked = !slot.sidechainDucked;
          duckBtn.classList.toggle('active', slot.sidechainDucked);
          if (this.callbacks.onDuckToggle) this.callbacks.onDuckToggle(i, slot.sidechainDucked);
        });
      }

      const jamBtn = strip.querySelector(`#strip-jam-${i}`);
      if (jamBtn) {
        jamBtn.addEventListener('click', () => {
          if (this.callbacks.onSlotSelect) {
            this.callbacks.onSlotSelect(i);
          }
        });
      }

      this.container.appendChild(strip);
      this.trackStrips.push(strip);
    }
  }

  _initDspRack() {
    // Sidechain Toggle button
    const scToggle = document.getElementById('btn-sidechain-toggle');
    if (scToggle) {
      scToggle.addEventListener('click', () => {
        const enabled = this.audioEngine.toggleSidechain();
        scToggle.textContent = enabled ? 'ON' : 'OFF';
        scToggle.style.color = enabled ? '#00cec9' : '#828997';
        scToggle.style.borderColor = enabled ? '#00cec9' : '#3e4451';
      });
    }
    const badges = document.querySelectorAll('.fx-badge');
    badges.forEach(badge => {
      const fxIdx = parseInt(badge.dataset.fx, 10);

      const triggerFx = (active) => {
        this.audioEngine.punchInFx.trigger(fxIdx, active);
        badge.classList.toggle('active', active);
        if (this.callbacks.onFxTrigger) {
          this.callbacks.onFxTrigger(fxIdx, active);
        }
      };

      badge.addEventListener('mousedown', (e) => { e.preventDefault(); triggerFx(true); });
      badge.addEventListener('mouseup', () => triggerFx(false));
      badge.addEventListener('mouseleave', () => triggerFx(false));
      badge.addEventListener('touchstart', (e) => { e.preventDefault(); triggerFx(true); });
      badge.addEventListener('touchend', () => triggerFx(false));
    });
  }

  flashTrackLed(slotIdx) {
    const led = document.getElementById(`strip-led-${slotIdx}`);
    if (led) {
      led.classList.add('active');
      setTimeout(() => led.classList.remove('active'), 100);
    }
  }

  updateActiveSlot(activeIdx) {
    this.trackStrips.forEach((strip, i) => {
      const isSelected = (i === activeIdx);
      strip.classList.toggle('active-slot', isSelected);
      const jamBtn = strip.querySelector(`#strip-jam-${i}`);
      if (jamBtn) {
        jamBtn.classList.toggle('active', isSelected);
        jamBtn.textContent = isSelected ? 'ACTIVE' : 'JAM';
      }
    });
  }

  updateMuteAndSoloStates() {
    const pattern = this.sequencer.getCurrentPattern();
    if (!pattern) return;

    const scSource = this.audioEngine.sidechainSource !== undefined ? this.audioEngine.sidechainSource : 8;

    for (let i = 0; i < 16; i++) {
      const muteBtn = document.getElementById(`strip-mute-${i}`);
      if (muteBtn) {
        muteBtn.classList.toggle('active', !!(pattern.trackMutes && pattern.trackMutes[i]));
      }
      const soloBtn = document.getElementById(`strip-solo-${i}`);
      if (soloBtn) {
        soloBtn.classList.toggle('active', !!(pattern.trackSolos && pattern.trackSolos[i]));
      }
      const duckBtn = document.getElementById(`strip-duck-${i}`);
      const slot = this.audioEngine.slots[i];
      if (duckBtn && slot) {
        const isSource = (i === scSource);
        duckBtn.classList.toggle('active', !isSource && slot.sidechainDucked !== false);
        duckBtn.classList.toggle('sc-source', isSource);
        duckBtn.textContent = isSource ? 'SC' : 'D';
      }
    }
  }

  updateStepCounts() {
    const pattern = this.sequencer.getCurrentPattern();
    if (!pattern) return;

    for (let i = 0; i < 16; i++) {
      const stepBadge = document.getElementById(`strip-steps-${i}`);
      if (stepBadge) {
        const activeCount = pattern.tracks[i].filter(s => s.active).length;
        stepBadge.textContent = `${activeCount} STEP${activeCount === 1 ? '' : 'S'}`;
        stepBadge.classList.toggle('has-steps', activeCount > 0);
      }
    }
  }

  updateDspReadouts(knobValues) {
    // 1. PO Dual Filter (Knob 4 / idx 3, Res Q / idx 4)
    const fVal = knobValues[3];
    const fReadout = document.getElementById('dsp-filter-readout');
    if (fReadout) {
      if (fVal === 64) fReadout.textContent = 'BYPASS // FLAT (CENTER 64)';
      else if (fVal < 64) fReadout.textContent = `LPF: ${Math.round((fVal / 63) * 100)}% // RES: ${this.audioEngine.getResonanceValue().toFixed(1)}`;
      else fReadout.textContent = `HPF: ${Math.round(((fVal - 64) / 63) * 100)}% // RES: ${this.audioEngine.getResonanceValue().toFixed(1)}`;
    }

    // Sidechain Ducking Readout & GR Meter
    const scReadout = document.getElementById('dsp-sidechain-readout');
    if (scReadout) {
      const depthPct = Math.round(this.audioEngine.sidechainDepth * 100);
      const relMs = Math.round(this.audioEngine.sidechainRelease * 1000);
      const srcTrack = (this.audioEngine.sidechainSource || 8) + 1;
      scReadout.textContent = `DEPTH: ${depthPct}% // REL: ${relMs}ms // SRC: T${srcTrack}`;
    }

    // 2. Compressor (Knob 8 / idx 7)
    const cVal = knobValues[7];
    const cReadout = document.getElementById('dsp-comp-readout');
    if (cReadout) {
      const drivePct = Math.round((cVal / 127) * 100);
      cReadout.textContent = `DRIVE: ${drivePct}% // RATIO: ${(2 + (cVal / 127) * 6).toFixed(1)}:1`;
    }

    // 3. Space Delay (Knob 7 / idx 6)
    const dVal = knobValues[6];
    const dReadout = document.getElementById('dsp-delay-readout');
    if (dReadout) {
      dReadout.textContent = `SEND: ${Math.round((dVal / 127) * 100)}%`;
    }

    // 4. Punch-In FX
    const activeFx = this.audioEngine.punchInFx.activeFx;
    const badges = document.querySelectorAll('.fx-badge');
    badges.forEach(b => {
      const idx = parseInt(b.dataset.fx, 10);
      b.classList.toggle('active', activeFx.has(idx));
    });
  }

  updateAll() {
    this.updateActiveSlot(this.audioEngine.activeSlotIndex);
    this.updateMuteAndSoloStates();
    this.updateStepCounts();
  }
}
