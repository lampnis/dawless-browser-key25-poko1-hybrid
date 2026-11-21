/**
 * Open-KO: HardwareGrid
 * Renders the tactile 8x5 Pad Grid (40 Pads) + 5 Scene Launch buttons matching Akai APC Key 25.
 */

import { PUNCH_IN_FX_NAMES } from '../midi/ApcConstants.js';

export class HardwareGrid {
  /**
   * @param {HTMLElement} container
   * @param {Object} callbacks
   */
  constructor(container, callbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;
    // callbacks: onStepClick, onStepHold, onSlotClick, onPatternClick, onMuteClick, onSliceClick, onSampleToolClick, onClipLaunch, onFxTrigger, onSceneClick

    this.operationalMode = 'pattern'; // 'sample', 'pattern', 'performance'
    this.padElements = []; // [row][col]
    this.sceneElements = [];

    this._buildDom();
  }

  setOperationalMode(mode) {
    this.operationalMode = mode || 'pattern';
    this._updatePadLabels();
  }

  _updatePadLabels() {
    const sampleTools = ['SLICE', '16-EQ', 'REV', 'NORM', '-12ST', '+12ST', 'STRETCH', 'PLAY'];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 8; c++) {
        const btn = this.padElements[r] && this.padElements[r][c];
        if (!btn) continue;
        let label = '';
        let sublabel = '';
        let hint = '';

        if (this.operationalMode === 'sample') {
          if (r === 0) {
            label = `M${c + 1}`;
            sublabel = 'MEL';
            hint = `APC: Sample Mode Row 1 Pad ${c + 1} (Note ${32 + c}) -> Select Melodic Slot ${c + 1}`;
          } else if (r === 1) {
            label = `D${c + 1}`;
            sublabel = 'DRM';
            hint = `APC: Sample Mode Row 2 Pad ${c + 1} (Note ${24 + c}) -> Select Drum Kit Slot ${c + 9}`;
          } else if (r === 2) {
            label = `S${c + 1}`;
            sublabel = 'SLICE';
            hint = `APC: Sample Mode Row 3 Pad ${c + 1} (Note ${16 + c}) -> Trigger Drum Slice ${c + 1}`;
          } else if (r === 3) {
            label = `S${c + 9}`;
            sublabel = 'SLICE';
            hint = `APC: Sample Mode Row 4 Pad ${c + 1} (Note ${8 + c}) -> Trigger Drum Slice ${c + 9}`;
          } else {
            label = `T${c + 1}`;
            sublabel = sampleTools[c];
            hint = `APC: Sample Mode Row 5 Pad ${c + 1} (Note ${c}) -> Sample Tool: ${sampleTools[c]}`;
          }
        } else if (this.operationalMode === 'performance') {
          label = `C${c + 1}`;
          sublabel = `SC${r + 1}`;
          hint = `APC: Performance Mode Row ${r + 1} Pad ${c + 1} -> Launch Scene ${r + 1} Clip ${c + 1}`;
        } else {
          // Pattern Mode (Default) — matches physical APC Key 25 Mk1 1-to-1
          if (r === 0) {
            label = `${c + 1}`;
            sublabel = 'STEP';
            hint = `APC: Matrix Row 1 Pad ${c + 1} (Note ${32 + c}) -> Step ${c + 1} (Hold + Knob = P-Lock | Hold + Shift+K3 = 128th Nudge)`;
          } else if (r === 1) {
            label = `${c + 9}`;
            sublabel = 'STEP';
            hint = `APC: Matrix Row 2 Pad ${c + 1} (Note ${24 + c}) -> Step ${c + 9} (Hold + Knob = P-Lock | Shift + Pad = 128th/Sidechain Tool)`;
          } else if (r === 2) {
            label = `P${c + 1}`;
            sublabel = 'PAT';
            hint = `APC: Matrix Row 3 Pad ${c + 1} (Note ${16 + c}) -> Select Pattern ${c + 1} (Shift + Pad = Append to Chain)`;
          } else if (r === 3) {
            label = `T${c + 1}`;
            sublabel = 'MUTE';
            hint = `APC: Matrix Row 4 Pad ${c + 1} (Note ${8 + c}) -> Mute Track ${c + 1} (Shift + Pad = Mute Track ${c + 9})`;
          } else {
            label = `FX${c + 1}`;
            sublabel = PUNCH_IN_FX_NAMES[c].split(' ')[0];
            hint = `APC: Matrix Row 5 Pad ${c + 1} (Note ${c}) -> Hold for Punch-In FX: ${PUNCH_IN_FX_NAMES[c]}`;
          }
        }

        const numEl = btn.querySelector('.pad-num');
        const subEl = btn.querySelector('.pad-sub');
        if (numEl) numEl.textContent = label;
        if (subEl) subEl.textContent = sublabel;
        btn.dataset.apcHint = hint;
        btn.title = hint;
      }
    }
  }

  _buildDom() {
    this.container.innerHTML = `
      <div class="apc-grid-wrapper">
        <div class="apc-matrix">
          <!-- 5 Rows of 8 Pads -->
          <div class="pad-row" data-row="0" title="Steps 1-8"></div>
          <div class="pad-row" data-row="1" title="Steps 9-16"></div>
          <div class="pad-row" data-row="2" title="Melodic Slots 1-8"></div>
          <div class="pad-row" data-row="3" title="Drum Slots 9-16"></div>
          <div class="pad-row" data-row="4" title="Punch-In FX"></div>
        </div>
        <div class="apc-scenes">
          <!-- 5 Scene Launch Buttons -->
          <button class="scene-btn" data-scene="1" title="Scene 1: Play / Stop"><span class="scene-led"></span>PLAY</button>
          <button class="scene-btn" data-scene="2" title="Scene 2: Live Sample Armed"><span class="scene-led"></span>REC</button>
          <button class="scene-btn" data-scene="3" title="Scene 3: Auto-Slice Kit"><span class="scene-led"></span>SLICE</button>
          <button class="scene-btn" data-scene="4" title="Scene 4: Metronome"><span class="scene-led"></span>METRO</button>
          <button class="scene-btn" data-scene="5" title="Scene 5: Shift Mode"><span class="scene-led"></span>SHIFT</button>
        </div>
      </div>
    `;

    const rowContainers = this.container.querySelectorAll('.pad-row');

    for (let r = 0; r < 5; r++) {
      this.padElements[r] = [];
      const rowDiv = rowContainers[r];

      for (let c = 0; c < 8; c++) {
        const btn = document.createElement('button');
        btn.className = 'apc-pad led-off';
        btn.dataset.row = r;
        btn.dataset.col = c;

        // Label based on function
        let label = '';
        let sublabel = '';
        if (r === 0) {
          label = `${c + 1}`;
          sublabel = 'STEP';
        } else if (r === 1) {
          label = `${c + 9}`;
          sublabel = 'STEP';
        } else if (r === 2) {
          label = `M${c + 1}`;
          sublabel = 'MEL';
        } else if (r === 3) {
          label = `D${c + 1}`;
          sublabel = 'DRUM';
        } else if (r === 4) {
          label = `FX${c + 1}`;
          sublabel = PUNCH_IN_FX_NAMES[c].split(' ')[0];
        }

        btn.innerHTML = `<span class="pad-num">${label}</span><span class="pad-sub">${sublabel}</span>`;

        // Rich APC Key 25 Hover Tooltips & LCD Hints
        let hint = '';
        let titleText = '';
        if (r === 0) {
          hint = `APC: Matrix Row 1 Pad ${c + 1} (Note ${32 + c}) -> Step ${c + 1} (Hold + Knob to P-Lock, Hold ◄ to select Pattern ${c + 1})`;
          titleText = `APC: Matrix Pad Row 1, Col ${c + 1} (Note ${32 + c}) - Step ${c + 1}. Hold + turn knob to P-Lock. Hold ◄ + Pad to select/chain Pattern ${c + 1}.`;
        } else if (r === 1) {
          hint = `APC: Matrix Row 2 Pad ${c + 1} (Note ${24 + c}) -> Step ${c + 9} (Hold + Knob to P-Lock, Hold ◄ to select Pattern ${c + 9})`;
          titleText = `APC: Matrix Pad Row 2, Col ${c + 1} (Note ${24 + c}) - Step ${c + 9}. Hold + turn knob to P-Lock. Hold ◄ + Pad to select/chain Pattern ${c + 9}.`;
        } else if (r === 2) {
          hint = `APC: Matrix Row 3 Pad ${c + 1} (Note ${16 + c}) -> Melodic Track ${c + 1} (Hold ► + Pad to select)`;
          titleText = `APC: Matrix Pad Row 3, Col ${c + 1} (Note ${16 + c}) - Melodic Track ${c + 1}. Tap to select track. Hold ► + Pad 1..8 also selects.`;
        } else if (r === 3) {
          hint = `APC: Matrix Row 4 Pad ${c + 1} (Note ${8 + c}) -> Drum Kit Track ${c + 9} (Hold ► + Pad to select)`;
          titleText = `APC: Matrix Pad Row 4, Col ${c + 1} (Note ${8 + c}) - Drum Kit Track ${c + 9}. Tap to select kit. Hold ► + Pad 9..16 also selects.`;
        } else if (r === 4) {
          hint = `APC: Matrix Row 5 Pad ${c + 1} (Note ${c}) -> Hold for Punch-In FX: ${PUNCH_IN_FX_NAMES[c]}`;
          titleText = `APC: Matrix Pad Row 5, Col ${c + 1} (Note ${c}) - Punch-In FX: ${PUNCH_IN_FX_NAMES[c]}. Hold pad to engage live effect.`;
        }
        btn.dataset.apcHint = hint;
        btn.title = titleText;

        // Pad interactions
        this._attachPadListeners(btn, r, c);
        rowDiv.appendChild(btn);
        this.padElements[r][c] = btn;
      }
    }

    // Scene buttons
    const sceneBtns = this.container.querySelectorAll('.scene-btn');
    sceneBtns.forEach((sBtn) => {
      const sceneIndex = parseInt(sBtn.dataset.scene, 10);
      this.sceneElements[sceneIndex] = sBtn;

      if (sceneIndex === 1) {
        sBtn.title = 'APC: Scene 1 (Note 82) or PLAY/PAUSE (Note 91). Shift + Scene 1 enters Sample Mode';
        sBtn.dataset.apcHint = 'APC: Scene 1 (Note 82) or PLAY/PAUSE (Note 91) -> Play/Pause | Shift + Scene 1 -> Sample Mode';
      } else if (sceneIndex === 2) {
        sBtn.title = 'APC: Scene 2 (Note 83) or REC (Note 93). Shift + Scene 2 enters Pattern Mode';
        sBtn.dataset.apcHint = 'APC: Scene 2 (Note 83) or REC (Note 93) -> Overdub Record | Shift + Scene 2 -> Pattern Mode';
      } else if (sceneIndex === 3) {
        sBtn.title = 'APC: Scene 3 (Note 84) - Auto-Slice Drum Kit. Shift + Scene 3 enters Performance Mode';
        sBtn.dataset.apcHint = 'APC: Scene 3 (Note 84) -> Auto-Slice Kit | Shift + Scene 3 -> Performance Mode';
      } else if (sceneIndex === 4) {
        sBtn.title = 'APC: Scene 4 (Note 85) - Toggle Metronome. Shift + Scene 4 = Hardware Tap Tempo';
        sBtn.dataset.apcHint = 'APC: Scene 4 (Note 85) -> Metronome Toggle | Shift + Scene 4 -> Tap Tempo';
      } else if (sceneIndex === 5) {
        sBtn.title = 'APC: Scene 5 (Note 86) - Append to Chain. Shift + Scene 5 = Reset Chain to Loop';
        sBtn.dataset.apcHint = 'APC: Scene 5 (Note 86) -> Append to Song Chain | Shift + Scene 5 -> Reset Chain to Loop';
      }

      sBtn.addEventListener('mousedown', () => {
        if (this.callbacks.onSceneClick) this.callbacks.onSceneClick(sceneIndex, true);
      });
      sBtn.addEventListener('mouseup', () => {
        if (this.callbacks.onSceneClick) this.callbacks.onSceneClick(sceneIndex, false);
      });
    });

    this._updatePadLabels();
  }

  _attachPadListeners(btn, row, col) {
    let holdTimeout = null;

    const startAction = (e) => {
      e.preventDefault();
      if (this.operationalMode === 'sample') {
        if (row === 0) {
          if (this.callbacks.onSlotClick) this.callbacks.onSlotClick(col, 'melodic');
        } else if (row === 1) {
          if (this.callbacks.onSlotClick) this.callbacks.onSlotClick(8 + col, 'drum');
        } else if (row === 2 || row === 3) {
          const sliceIdx = (row - 2) * 8 + col;
          if (this.callbacks.onSliceClick) this.callbacks.onSliceClick(sliceIdx);
        } else if (row === 4) {
          if (this.callbacks.onSampleToolClick) this.callbacks.onSampleToolClick(col);
        }
        return;
      }

      if (this.operationalMode === 'performance') {
        if (this.callbacks.onClipLaunch) this.callbacks.onClipLaunch(row, col);
        return;
      }

      // Pattern Mode (Default)
      if (row === 0 || row === 1) {
        const stepIndex = row * 8 + col;
        holdTimeout = setTimeout(() => {
          if (this.callbacks.onStepHold) this.callbacks.onStepHold(stepIndex, true);
        }, 220);
        if (this.callbacks.onStepClick) this.callbacks.onStepClick(stepIndex);
      } else if (row === 2) {
        if (this.callbacks.onPatternClick) this.callbacks.onPatternClick(col);
        else if (this.callbacks.onSlotClick) this.callbacks.onSlotClick(col, 'melodic');
      } else if (row === 3) {
        if (this.callbacks.onMuteClick) this.callbacks.onMuteClick(col);
        else if (this.callbacks.onSlotClick) this.callbacks.onSlotClick(8 + col, 'drum');
      } else if (row === 4) {
        btn.classList.add('pressed');
        if (this.callbacks.onFxTrigger) this.callbacks.onFxTrigger(col, true);
      }
    };

    const endAction = () => {
      if (holdTimeout) {
        clearTimeout(holdTimeout);
        holdTimeout = null;
      }

      if (this.operationalMode === 'pattern') {
        if (row === 0 || row === 1) {
          const stepIndex = row * 8 + col;
          if (this.callbacks.onStepHold) this.callbacks.onStepHold(stepIndex, false);
        } else if (row === 4) {
          btn.classList.remove('pressed');
          if (this.callbacks.onFxTrigger) this.callbacks.onFxTrigger(col, false);
        }
      }
    };

    btn.addEventListener('mousedown', startAction);
    btn.addEventListener('mouseup', endAction);
    btn.addEventListener('mouseleave', endAction);

    btn.addEventListener('touchstart', startAction, { passive: false });
    btn.addEventListener('touchend', endAction);
  }

  setPadLed(row, col, color) {
    const pad = this.padElements[row] && this.padElements[row][col];
    if (!pad) return;

    // Reset classes
    pad.className = 'apc-pad';
    if (color && color !== 'off') {
      pad.classList.add(`led-${color}`);
    } else {
      pad.classList.add('led-off');
    }
  }

  setSceneLed(sceneIndex, color) {
    const sBtn = this.sceneElements[sceneIndex];
    if (!sBtn) return;
    sBtn.className = 'scene-btn';
    if (color && color !== 'off') {
      sBtn.classList.add(`scene-led-${color}`);
    }
  }
}
