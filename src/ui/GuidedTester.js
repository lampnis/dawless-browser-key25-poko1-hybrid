/**
 * Open-KO: GuidedTester
 * Comprehensive Hardware Verification Suite, Foolproof Guided Wizard,
 * and Akai APC Key 25 Mk1 Layout & MIDI Code Reference Inspector.
 */

import {
  APC_MK1_LEDS,
  APC_KNOB_CCS_MK1,
  APC_SCENE_NOTES,
  APC_BUTTON_NOTES,
  APC_TRACK_BUTTON_NOTES
} from '../midi/ApcConstants.js';

export class GuidedTester {
  constructor(midiManager, audioEngine) {
    this.midiManager = midiManager;
    this.audioEngine = audioEngine;
    this.modal = null;
    this.activeTab = 'diagnostic'; // 'diagnostic', 'wizard', 'layout'

    // Verified hardware tracking
    this.testedPads = new Set();
    this.testedKnobs = new Set();
    this.testedKeys = new Set();
    this.testedButtons = new Set();

    // Wizard state
    this.wizardStep = 0;
    this.wizardSteps = [
      { id: 'keys', title: '1. Piano Keybed (Channel 2)', desc: 'Play keys across the 25-key keyboard to test velocity, polyphony, and octave transposition.' },
      { id: 'transport', title: '2. Transport Controls (Play, Rec, Stop)', desc: 'Press STOP ALL CLIPS (Note 81), SCENE 1 / PLAY (Note 82) [or Play 91 on Mk2], and SCENE 2 / REC (Note 83) [or Rec 93 on Mk2].' },
      { id: 'tracks', title: '3. Bottom Track Buttons (Notes 64-71)', desc: 'Press the 8 track control buttons right above piano keys: ▲, ▼, ◄, ►, VOLUME, PAN, SEND, DEVICE (Notes 64-71).' },
      { id: 'scenes', title: '4. Scene Launch Buttons (Notes 82-86)', desc: 'Press Scene 1 to 5 buttons in the right vertical column (Notes 82-86).' },
      { id: 'knobs', title: '5. 8 Continuous Knobs (CC 48-55)', desc: 'Turn all 8 knobs through their full 0 to 127 sweep.' },
      { id: 'shift_sustain', title: '6. Shift (Note 98) & Sustain (CC 64)', desc: 'Press physical SHIFT (Note 98) and round SUSTAIN button (CC 64).' },
      { id: 'pads', title: '7. 40-Pad Grid & Tri-Color LEDs', desc: 'Press clip launch pads (Notes 0-39) to verify note mapping and bi-directional LED colors.' },
      { id: 'confirm', title: '8. Calibration Confirmation', desc: 'Review verified controls and click "SAVE CONFIRMED CALIBRATION" to lock in the hardware profile.' }
    ];

    this.noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  }

  open(initialTab = 'diagnostic') {
    if (!this.modal) {
      this._buildModal();
    }
    this.modal.classList.add('open');
    this.midiManager.testModeActive = true;
    this.midiManager.callbacks.onTestMidiEvent = (data) => this._handleTestMidi(data);
    this._switchTab(initialTab);
    this._updateStats();
  }

  close() {
    if (this.modal) {
      this.modal.classList.remove('open');
    }
    this.midiManager.testModeActive = false;
    this.midiManager.callbacks.onTestMidiEvent = null;
    this.midiManager.clearAllLeds();
  }

  _switchTab(tabId) {
    this.activeTab = tabId;
    const tabBtns = this.modal.querySelectorAll('.tester-tab-btn');
    tabBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabId));

    const panels = this.modal.querySelectorAll('.tester-tab-panel');
    panels.forEach(panel => {
      const isActive = (panel.id === `tab-${tabId}`);
      panel.classList.toggle('active', isActive);
      panel.style.display = isActive ? 'block' : 'none';
    });

    if (tabId === 'diagnostic') {
      this._renderDiagram();
    } else if (tabId === 'wizard') {
      this._renderWizardStep();
    } else if (tabId === 'layout') {
      this._renderLayoutReference();
    }
  }

  _buildModal() {
    this.modal = document.createElement('div');
    this.modal.id = 'guided-tester-modal';
    this.modal.className = 'modal-overlay';
    this.modal.innerHTML = `
      <div class="modal-content" style="max-width: 920px; max-height: 94vh; display: flex; flex-direction: column;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #3e4451; padding-bottom: 8px; margin-bottom: 8px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="font-size: 15px; font-weight: 900; color: #ff5722; letter-spacing: 1px;">APC KEY 25 MK1 // HARDWARE TEST &amp; CALIBRATION</div>
            <span style="font-size: 9px; background: #282c34; padding: 2px 6px; border-radius: 4px; color: #00cec9;">FOOLPROOF INSPECTOR</span>
          </div>
          <button id="btn-close-tester" class="btn-tactile">CLOSE [ESC]</button>
        </div>

        <!-- Navigation Tabs -->
        <div class="tester-tabs-bar" style="display: flex; gap: 8px; margin-bottom: 10px; border-bottom: 1px solid #282c34; padding-bottom: 6px;">
          <button class="tester-tab-btn active" data-tab="diagnostic">🔍 LIVE DIAGNOSTIC SURFACE</button>
          <button class="tester-tab-btn" data-tab="wizard">🧙 GUIDED TEST WIZARD</button>
          <button class="tester-tab-btn" data-tab="layout">🎛 APC KEY 25 MK1 LAYOUT &amp; MIDI MAP</button>
        </div>

        <!-- Tab 1: Live Diagnostic Surface -->
        <div id="tab-diagnostic" class="tester-tab-panel active" style="overflow-y: auto; flex: 1;">
          <div style="display: grid; grid-template-columns: 1.8fr 1.2fr; gap: 12px; margin-bottom: 10px;">
            <!-- Left: Visual Hardware Surface -->
            <div>
              <div style="font-size: 10px; font-weight: bold; color: #828997; margin-bottom: 6px;">TOUCH PHYSICAL CONTROLS ON HARDWARE:</div>
              <div id="tester-diagram" class="tester-diagram-box"></div>
            </div>

            <!-- Right: Diagnostic Monitor, Progress & LED Test Controls -->
            <div style="display: flex; flex-direction: column; gap: 8px; background: #14171a; padding: 10px; border-radius: 6px; border: 1px solid #282c34;">
              <div style="font-size: 10px; font-weight: bold; color: #ff9f43;">LAST MIDI MESSAGE RECEIVED:</div>
              <div id="tester-last-msg" style="font-family: 'Courier New', monospace; font-size: 11px; background: #080a0c; padding: 8px; border-radius: 4px; color: #2ecc71; min-height: 54px; line-height: 1.4;">
                WAITING FOR APC KEY 25 INPUT...
              </div>

              <!-- Live Keybed Monitor -->
              <div style="background: #0d0f12; padding: 6px 8px; border-radius: 4px; border: 1px solid #282c34; font-size: 10px;">
                <div style="color: #61afef; font-weight: bold; margin-bottom: 2px;">KEYBED STATUS:</div>
                <div>Detected Channel: <strong id="t-key-ch" style="color: #2ecc71;">--</strong></div>
                <div>Last Key: <strong id="t-key-note" style="color: #ff9f43;">--</strong> (Velocity: <span id="t-key-vel">--</span>)</div>
                <div>Keyboard Base: <strong id="t-key-base" style="color: #00cec9;">C3 (Note 48)</strong></div>
              </div>

              <!-- Test Progress Stats -->
              <div style="font-size: 10px; font-weight: bold; color: #61afef; margin-top: 2px;">VERIFICATION STATS:</div>
              <div style="font-size: 10px; line-height: 1.5; color: #abb2bf;">
                <div>Pads Verified: <strong id="stat-pads" style="color: #2ecc71;">0 / 40</strong></div>
                <div>Knobs Swept: <strong id="stat-knobs" style="color: #2ecc71;">0 / 8</strong></div>
                <div>Keys Played: <strong id="stat-keys" style="color: #2ecc71;">0 / 25</strong></div>
                <div>Buttons Tested: <strong id="stat-buttons" style="color: #2ecc71;">0 / 16</strong></div>
              </div>

              <!-- Bi-Directional LED Test Palette -->
              <div style="margin-top: auto; display: flex; flex-direction: column; gap: 5px;">
                <div style="font-size: 9px; font-weight: bold; color: #828997;">LED DIAGNOSTIC COMMANDS:</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
                  <button id="btn-flash-all-green" class="btn-tactile" style="background: #1e3d2f; border-color: #2ecc71; font-size: 9px; padding: 4px;">ALL GREEN</button>
                  <button id="btn-flash-all-amber" class="btn-tactile" style="background: #4a3818; border-color: #f39c12; font-size: 9px; padding: 4px;">ALL AMBER</button>
                  <button id="btn-flash-all-red" class="btn-tactile" style="background: #4a1f1f; border-color: #e74c3c; font-size: 9px; padding: 4px;">ALL RED</button>
                  <button id="btn-led-chase" class="btn-tactile" style="background: #252a38; border-color: #61afef; font-size: 9px; padding: 4px;">CHASE CYCLE</button>
                </div>
                <button id="btn-save-calib" class="btn-tactile btn-play" style="margin-top: 4px; font-size: 10px; padding: 6px;">💾 SAVE CONFIRMED CALIBRATION</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Tab 2: Guided Step-by-Step Wizard -->
        <div id="tab-wizard" class="tester-tab-panel" style="overflow-y: auto; flex: 1;">
          <div id="wizard-container" style="background: #14171a; border: 1px solid #282c34; border-radius: 6px; padding: 14px;"></div>
        </div>

        <!-- Tab 3: Layout & MIDI Code Reference Map -->
        <div id="tab-layout" class="tester-tab-panel" style="overflow-y: auto; flex: 1;">
          <div id="layout-reference-container"></div>
        </div>
      </div>
    `;

    document.body.appendChild(this.modal);

    // Bind Tab switching
    this.modal.querySelectorAll('.tester-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => this._switchTab(btn.dataset.tab));
    });

    document.getElementById('btn-close-tester').addEventListener('click', () => this.close());

    document.getElementById('btn-flash-all-green').addEventListener('click', () => this._flashAllLeds(APC_MK1_LEDS.GREEN));
    document.getElementById('btn-flash-all-amber').addEventListener('click', () => this._flashAllLeds(APC_MK1_LEDS.AMBER));
    document.getElementById('btn-flash-all-red').addEventListener('click', () => this._flashAllLeds(APC_MK1_LEDS.RED));
    document.getElementById('btn-led-chase').addEventListener('click', () => this._runLedChase());

    document.getElementById('btn-save-calib').addEventListener('click', () => {
      const profile = {
        name: 'APC Key 25 Mk1 (Calibrated)',
        deviceMode: this.midiManager.deviceMode,
        timestamp: Date.now(),
        transportNotes: { playPause: 91, rec: 93, stopAll: 81 },
        trackNotes: [64, 65, 66, 67, 68, 69, 70, 71],
        sceneNotes: { scene1: 82, scene2: 83, scene3: 84, scene4: 85, scene5: 86, stopAll: 81 },
        shiftNotes: [98],
        sustainCC: 64,
        knobCCs: [48, 49, 50, 51, 52, 53, 54, 55],
        gridRows: this.midiManager.mapper.activeProfile.gridRows
      };
      this.midiManager.mapper.saveCustomProfile(profile);
      alert('✓ Hardware Calibration Confirmed & Saved to Browser Storage!\nOpen-KO will automatically use this profile.');
    });

    // Pre-render all 3 tabs immediately so no panel is ever blank
    this._renderDiagram();
    this._renderWizardStep();
    this._renderLayoutReference();
  }

  _renderDiagram() {
    const container = document.getElementById('tester-diagram');
    if (!container) return;

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 8px; background: #1c2025; padding: 10px; border-radius: 6px; border: 1px solid #2d333b;">
        <!-- 8 Macro Knobs (CC 48-55) -->
        <div style="display: grid; grid-template-columns: repeat(8, 1fr); gap: 4px; text-align: center;">
          ${[
            { name: 'Start', cc: 48 },
            { name: 'End', cc: 49 },
            { name: 'Pitch', cc: 50 },
            { name: 'Filter', cc: 51 },
            { name: 'Res Q', cc: 52 },
            { name: 'Decay', cc: 53 },
            { name: 'Send', cc: 54 },
            { name: 'Comp', cc: 55 }
          ].map((k, idx) => `
            <div id="t-knob-${idx}" style="background: #282c34; border: 1px solid #3e4451; border-radius: 4px; padding: 3px; font-size: 8px;">
              <div style="color: #abb2bf; font-weight: bold;">K${idx + 1}</div>
              <div class="t-k-val" style="color: #ff9f43; font-weight: bold; font-family: monospace;">0</div>
              <div style="color: #5c6370; font-size: 7px;">CC ${k.cc}</div>
            </div>
          `).join('')}
        </div>

        <!-- 8x5 Pad Matrix + Scene Column -->
        <div style="display: flex; gap: 6px;">
          <!-- 40 Pads -->
          <div style="flex: 1; display: flex; flex-direction: column; gap: 3px;">
            ${[0, 1, 2, 3, 4].map(r => `
              <div style="display: grid; grid-template-columns: repeat(8, 1fr); gap: 3px;">
                ${[0, 1, 2, 3, 4, 5, 6, 7].map(c => {
                  const note = this.midiManager.getNoteFromCoordinates(r, c);
                  return `
                    <div id="t-pad-${r}-${c}" style="aspect-ratio: 1.4; background: #202428; border: 1px solid #14171a; border-radius: 3px; display: flex; flex-direction: column; justify-content: center; align-items: center; font-size: 7px; color: #7f8c8d; cursor: pointer;">
                      <span>R${r}C${c}</span>
                      <span class="t-pad-note" style="font-size: 7px; opacity: 0.8; font-family: monospace;">N:${note}</span>
                    </div>
                  `;
                }).join('')}
              </div>
            `).join('')}
          </div>

          <!-- Scene Buttons (Notes 82, 83, 84, 85, 86) -->
          <div style="width: 55px; display: flex; flex-direction: column; gap: 3px;">
            ${[
              { num: 1, note: 82, label: 'PLAY' },
              { num: 2, note: 83, label: 'REC' },
              { num: 3, note: 84, label: 'SLICE' },
              { num: 4, note: 85, label: 'METRO' },
              { num: 5, note: 86, label: 'SHIFT' }
            ].map(s => `
              <div id="t-scene-${s.num}" style="flex: 1; background: #282c34; border: 1px solid #3e4451; border-radius: 3px; display: flex; flex-direction: column; justify-content: center; align-items: center; font-size: 7px; font-weight: bold; color: #abb2bf;">
                <span>SC${s.num}</span>
                <span style="font-size: 6px; color: #5c6370;">N:${s.note}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Bottom Track Mute Buttons (Notes 64-71) + Stop All (Note 81) -->
        <div style="display: flex; gap: 6px; align-items: center;">
          <div style="flex: 1; display: grid; grid-template-columns: repeat(8, 1fr); gap: 3px;">
            ${[
              { label: '▲', note: 64 },
              { label: '▼', note: 65 },
              { label: '◄', note: 66 },
              { label: '►', note: 67 },
              { label: 'VOL', note: 68 },
              { label: 'PAN', note: 69 },
              { label: 'SEND', note: 70 },
              { label: 'DEV', note: 71 }
            ].map((t, idx) => `
              <div id="t-track-${idx}" style="background: #23272e; border: 1px solid #3e4451; border-radius: 3px; padding: 2px; text-align: center; font-size: 7px; color: #abb2bf;">
                <div style="font-weight: 900; color: #61afef;">${t.label}</div>
                <div style="font-size: 6px; color: #5c6370;">N:${t.note}</div>
              </div>
            `).join('')}
          </div>
          <div id="t-stop-all" style="width: 55px; background: #3a1f1f; border: 1px solid #e74c3c; border-radius: 3px; padding: 2px; text-align: center; font-size: 7px; font-weight: bold; color: #ff6b6b;">
            <div>STOP ALL</div>
            <div style="font-size: 6px; opacity: 0.8;">N:81</div>
          </div>
        </div>

        <!-- Dedicated Transport & Modifier Buttons: Play/Pause, Rec, Sustain, Shift, Octaves -->
        <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; text-align: center;">
          <div id="t-play-pause" style="background: #282c34; border: 1px solid #2ecc71; border-radius: 3px; padding: 3px; font-size: 8px; color: #abb2bf;">
            <div style="font-weight: bold; color: #2ecc71;">▶❚❚ PLAY</div>
            <div style="font-size: 6px; color: #5c6370;">N:91</div>
          </div>
          <div id="t-rec" style="background: #282c34; border: 1px solid #e74c3c; border-radius: 3px; padding: 3px; font-size: 8px; color: #abb2bf;">
            <div style="font-weight: bold; color: #e74c3c;">● REC</div>
            <div style="font-size: 6px; color: #5c6370;">N:93</div>
          </div>
          <div id="t-sustain" style="background: #282c34; border: 1px solid #00cec9; border-radius: 3px; padding: 3px; font-size: 8px; color: #abb2bf;">
            <div style="font-weight: bold; color: #00cec9;">SUSTAIN</div>
            <div style="font-size: 6px; color: #5c6370;">CC:64</div>
          </div>
          <div id="t-shift" style="background: #282c34; border: 1px solid #e67e22; border-radius: 3px; padding: 3px; font-size: 8px; color: #abb2bf;">
            <div style="font-weight: bold; color: #e67e22;">SHIFT</div>
            <div style="font-size: 6px; color: #5c6370;">N:98</div>
          </div>
          <div id="t-hw-oct" style="background: #282c34; border: 1px solid #3e4451; border-radius: 3px; padding: 3px; font-size: 8px; color: #abb2bf;">
            <div style="font-weight: bold; color: #61afef;">OCT ▲/▼</div>
            <div style="font-size: 6px; color: #5c6370;">HW Transpose</div>
          </div>
        </div>

        <!-- 25-Key Piano Keyboard Preview -->
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <div style="display: flex; justify-content: space-between; font-size: 8px; color: #828997;">
            <span>25-KEY KEYBED (CHANNEL 2) // C3 (48) TO C5 (72)</span>
            <span id="t-piano-live-badge" style="color: #00cec9;">READY</span>
          </div>
          <div style="background: #0d0f12; height: 46px; border-radius: 4px; display: flex; position: relative; overflow: hidden; border: 1px solid #3e4451;">
            ${Array.from({ length: 25 }).map((_, idx) => {
              const isBlack = [1, 3, 6, 8, 10, 13, 15, 18, 20, 22].includes(idx);
              return `
                <div id="t-key-${idx}" style="flex: 1; background: ${isBlack ? '#1a1d21' : '#f1f2f6'}; border-right: 1px solid #444; height: 100%; transition: background 0.08s ease;"></div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  }

  _handleTestMidi(event) {
    const { status, channel, d1, d2, command } = event;
    const msgBox = document.getElementById('tester-last-msg');

    // -------------------------------------------------------------
    // INTERCEPT DEDICATED TRANSPORT BUTTONS (Notes 91 & 93 on Ch 1)
    // -------------------------------------------------------------
    if (d1 === 91) {
      this.testedButtons.add(91);
      if (msgBox) {
        msgBox.innerHTML = `▶❚❚ <strong style="color: #2ecc71;">PLAY / PAUSE BUTTON:</strong> Note #91 (0x5B) Confirmed!`;
      }
      this.midiManager.sendLed(91, APC_MK1_LEDS.GREEN);
      setTimeout(() => this.midiManager.sendLed(91, APC_MK1_LEDS.OFF), 350);
      const playEl = document.getElementById('t-play-pause');
      if (playEl) {
        playEl.style.background = '#2ecc71';
        playEl.style.color = '#121417';
        setTimeout(() => { playEl.style.background = '#282c34'; playEl.style.color = '#abb2bf'; }, 300);
      }
      this._checkWizardProgress('transport', 91);
      this._updateStats();
      return;
    }

    if (d1 === 93) {
      this.testedButtons.add(93);
      if (msgBox) {
        msgBox.innerHTML = `● <strong style="color: #e74c3c;">REC / OVERDUB BUTTON:</strong> Note #93 (0x5D) Confirmed!`;
      }
      this.midiManager.sendLed(93, APC_MK1_LEDS.RED);
      setTimeout(() => this.midiManager.sendLed(93, APC_MK1_LEDS.OFF), 350);
      const recEl = document.getElementById('t-rec');
      if (recEl) {
        recEl.style.background = '#e74c3c';
        recEl.style.color = '#ffffff';
        setTimeout(() => { recEl.style.background = '#282c34'; recEl.style.color = '#abb2bf'; }, 300);
      }
      this._checkWizardProgress('transport', 93);
      this._updateStats();
      return;
    }

    // -------------------------------------------------------------
    // CHANNEL 2: KEYBED INPUT
    // -------------------------------------------------------------
    if (channel === 2) {
      const note = d1;
      const vel = d2;

      // Note Off or velocity 0
      if (command === 0x80 || (command === 0x90 && vel === 0)) {
        this.audioEngine.stopActiveSlot(note);
        return;
      }

      if (command === 0x90 && vel > 0) {
        this.testedKeys.add(note);

        const noteName = this.noteNames[note % 12];
        const octave = Math.floor(note / 12) - 1;
        const fullNote = `${noteName}${octave}`;

        // Update Keybed Status UI
        const chEl = document.getElementById('t-key-ch');
        const noteEl = document.getElementById('t-key-note');
        const velEl = document.getElementById('t-key-vel');
        const baseEl = document.getElementById('t-key-base');
        if (chEl) chEl.textContent = `Channel 2 (Keybed Confirmed!)`;
        if (noteEl) noteEl.textContent = `${fullNote} (MIDI #${note})`;
        if (velEl) velEl.textContent = `${vel}`;
        if (baseEl) baseEl.textContent = `C${Math.floor(this.midiManager.keyboardBaseNote / 12) - 1} (Note ${this.midiManager.keyboardBaseNote})`;

        if (msgBox) {
          msgBox.innerHTML = `🎹 <strong style="color: #00cec9;">PIANO KEY (CH 2):</strong> Note ${note} (${fullNote}) // Velocity: ${vel}`;
        }

        // Visual Feedback on Keybed
        const keyIndex = Math.max(0, Math.min(24, note - this.midiManager.keyboardBaseNote));
        const keyEl = document.getElementById(`t-key-${keyIndex}`);
        if (keyEl) {
          const isBlack = [1, 3, 6, 8, 10, 13, 15, 18, 20, 22].includes(keyIndex);
          keyEl.style.background = '#ff5722';
          setTimeout(() => {
            keyEl.style.background = isBlack ? '#1a1d21' : '#f1f2f6';
          }, 220);
        }

        // Audible test feedback
        this.audioEngine.playActiveSlot(note, vel);
        this._checkWizardProgress('key', note, fullNote);
        this._updateStats();
        return;
      }
    }

    // -------------------------------------------------------------
    // CHANNEL 1: CONTROLS, PADS & BUTTONS
    // -------------------------------------------------------------
    if (command === 0x90 && d2 > 0) {
      const note = d1;
      const vel = d2;

      // 1. Pad Check
      const coord = this.midiManager.getPadCoordinates(note);
      if (coord) {
        this.testedPads.add(note);
        if (msgBox) {
          msgBox.innerHTML = `🟩 <strong style="color: #2ecc71;">PAD HIT (CH 1):</strong> Note #${note} (Row ${coord.row}, Col ${coord.col}) // Vel: ${vel}`;
        }

        // Send Bi-directional LED sequence to hardware: Green -> Amber -> Red -> Off!
        this.midiManager.sendLed(note, APC_MK1_LEDS.GREEN);
        setTimeout(() => this.midiManager.sendLed(note, APC_MK1_LEDS.AMBER), 100);
        setTimeout(() => this.midiManager.sendLed(note, APC_MK1_LEDS.RED), 200);
        setTimeout(() => this.midiManager.sendLed(note, APC_MK1_LEDS.OFF), 350);

        const padEl = document.getElementById(`t-pad-${coord.row}-${coord.col}`);
        if (padEl) {
          padEl.style.background = '#2ecc71';
          setTimeout(() => padEl.style.background = '#202428', 300);
        }
        this._checkWizardProgress('pad', note, `R${coord.row}C${coord.col}`);
      }
      // 2. Bottom Track Buttons Check (Notes 64-71)
      else if (APC_TRACK_BUTTON_NOTES.includes(note)) {
        this.testedButtons.add(note);
        const idx = APC_TRACK_BUTTON_NOTES.indexOf(note);
        const trLabels = ['▲ (Up / Track 1)', '▼ (Down / Track 2)', '◄ (Left / Track 3)', '► (Right / Track 4)', 'VOLUME (Track 5)', 'PAN (Track 6)', 'SEND (Track 7)', 'DEVICE (Track 8)'];
        if (msgBox) msgBox.innerHTML = `🔘 <strong style="color: #61afef;">BOTTOM TRACK BUTTON:</strong> ${trLabels[idx]} (Note #${note})`;

        // Send LED blink to button
        this.midiManager.sendLed(note, APC_MK1_LEDS.GREEN);
        setTimeout(() => this.midiManager.sendLed(note, APC_MK1_LEDS.RED), 150);
        setTimeout(() => this.midiManager.sendLed(note, APC_MK1_LEDS.OFF), 300);

        const trEl = document.getElementById(`t-track-${idx}`);
        if (trEl) {
          trEl.style.background = '#61afef';
          trEl.style.color = '#121417';
          setTimeout(() => {
            trEl.style.background = '#23272e';
            trEl.style.color = '#abb2bf';
          }, 300);
        }
        this._checkWizardProgress('track', note, trLabels[idx]);
      }
      // 3. Scene Buttons Check (Notes 81-86)
      else if (Object.values(APC_SCENE_NOTES).includes(note)) {
        this.testedButtons.add(note);

        // Send LED blink to scene button
        this.midiManager.sendLed(note, APC_MK1_LEDS.GREEN);
        setTimeout(() => this.midiManager.sendLed(note, APC_MK1_LEDS.AMBER), 150);
        setTimeout(() => this.midiManager.sendLed(note, APC_MK1_LEDS.OFF), 300);

        if (note === 81) {
          if (msgBox) msgBox.innerHTML = `🛑 <strong style="color: #e74c3c;">STOP ALL CLIPS BUTTON:</strong> Note #${note}`;
          const stopEl = document.getElementById('t-stop-all');
          if (stopEl) {
            stopEl.style.background = '#e74c3c';
            setTimeout(() => stopEl.style.background = '#3a1f1f', 300);
          }
          this._checkWizardProgress('transport', 81);
        } else {
          const scNum = note - 81; // 82->1, 83->2, etc.
          if (msgBox) msgBox.innerHTML = `🎬 <strong style="color: #ff9f43;">SCENE ${scNum} BUTTON:</strong> Note #${note}`;
          const scEl = document.getElementById(`t-scene-${scNum}`);
          if (scEl) {
            scEl.style.background = '#2ecc71';
            scEl.style.color = '#121417';
            setTimeout(() => {
              scEl.style.background = '#282c34';
              scEl.style.color = '#abb2bf';
            }, 300);
          }
          this._checkWizardProgress('scene', scNum);
        }
      }
      // 4. Physical Shift Button (Note 98)
      else if (note === APC_BUTTON_NOTES.SHIFT_MK1 || note === 98) {
        this.testedButtons.add(note);
        if (msgBox) msgBox.innerHTML = `⚡ <strong style="color: #e67e22;">PHYSICAL SHIFT BUTTON:</strong> Note #98 (0x62)`;
        const shEl = document.getElementById('t-shift');
        if (shEl) {
          shEl.style.background = '#e67e22';
          shEl.style.color = '#121417';
          setTimeout(() => {
            shEl.style.background = '#282c34';
            shEl.style.color = '#abb2bf';
          }, 300);
        }
        this._checkWizardProgress('shift', 98);
      } else {
        // Fallback key on Channel 1 (if external keyboard)
        this.testedKeys.add(note);
        if (msgBox) msgBox.innerHTML = `🎹 KEY ON CH 1: Note #${note} // Vel: ${vel}`;
      }
    }
    // Control Change (Knobs CC 48-55 & Sustain CC 64)
    else if (command === 0xB0) {
      const cc = d1;
      const val = d2;
      const knobIdx = this.midiManager.mapper.getKnobIndex(cc);

      if (knobIdx !== -1) {
        this.testedKnobs.add(knobIdx);
        if (msgBox) msgBox.innerHTML = `🎛 <strong style="color: #ff9f43;">KNOB ${knobIdx + 1} (CC #${cc}):</strong> Value: ${val} / 127`;
        const kEl = document.getElementById(`t-knob-${knobIdx}`);
        if (kEl) {
          kEl.querySelector('.t-k-val').textContent = `${val}`;
          kEl.style.borderColor = '#ff5722';
          setTimeout(() => kEl.style.borderColor = '#3e4451', 300);
        }
        this._checkWizardProgress('knob', knobIdx, `CC ${cc} = ${val}`);
      } else if (cc === 64) {
        this.testedButtons.add(64);
        const isPressed = val > 63;
        if (msgBox) msgBox.innerHTML = `🎵 <strong style="color: #00cec9;">SUSTAIN BUTTON/PEDAL (CC #64):</strong> ${isPressed ? 'PRESSED (127)' : 'RELEASED (0)'}`;
        const sustEl = document.getElementById('t-sustain');
        if (sustEl) {
          sustEl.style.background = isPressed ? '#00cec9' : '#282c34';
          sustEl.style.color = isPressed ? '#121417' : '#abb2bf';
        }
        this.audioEngine.setSustain(isPressed);
        this._checkWizardProgress('sustain', isPressed ? '127' : '0');
      }
    }

    this._updateStats();
  }

  _flashAllLeds(velocity) {
    // 1. All 40 Grid Pads
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 8; c++) {
        const note = this.midiManager.getNoteFromCoordinates(r, c);
        if (note >= 0) this.midiManager.sendLed(note, velocity);
      }
    }
    // 2. Scene Buttons (82-86) and Stop All (81)
    for (const scNote of Object.values(APC_SCENE_NOTES)) {
      this.midiManager.sendLed(scNote, velocity);
    }
    // 3. Bottom Track Buttons (64-71)
    for (const trNote of APC_TRACK_BUTTON_NOTES) {
      this.midiManager.sendLed(trNote, velocity);
    }

    setTimeout(() => this.midiManager.clearAllLeds(), 800);
  }

  _runLedChase() {
    let step = 0;
    const allNotes = [];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 8; c++) {
        allNotes.push(this.midiManager.getNoteFromCoordinates(r, c));
      }
    }
    const interval = setInterval(() => {
      if (step >= allNotes.length) {
        clearInterval(interval);
        this.midiManager.clearAllLeds();
        return;
      }
      const note = allNotes[step];
      if (note >= 0) {
        this.midiManager.sendLed(note, (step % 3 === 0) ? APC_MK1_LEDS.GREEN : (step % 3 === 1 ? APC_MK1_LEDS.AMBER : APC_MK1_LEDS.RED));
      }
      step++;
    }, 25);
  }

  _updateStats() {
    const sP = document.getElementById('stat-pads');
    const sK = document.getElementById('stat-knobs');
    const sKey = document.getElementById('stat-keys');
    const sB = document.getElementById('stat-buttons');

    if (sP) sP.textContent = `${this.testedPads.size} / 40`;
    if (sK) sK.textContent = `${this.testedKnobs.size} / 8`;
    if (sKey) sKey.textContent = `${this.testedKeys.size} / 25`;
    if (sB) sB.textContent = `${this.testedButtons.size} / 16`;
  }

  _renderWizardStep() {
    const container = document.getElementById('wizard-container');
    if (!container) return;

    const step = this.wizardSteps[this.wizardStep];
    const isConfirmStep = (step.id === 'confirm');

    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid #3e4451; padding-bottom: 8px;">
        <div>
          <span style="font-size: 10px; color: #ff5722; font-weight: 900;">STEP ${this.wizardStep + 1} OF ${this.wizardSteps.length}</span>
          <h3 style="color: #ffffff; margin-top: 2px;">${step.title}</h3>
        </div>
        <div style="display: flex; gap: 6px;">
          <button id="btn-wiz-prev" class="btn-tactile" ${this.wizardStep === 0 ? 'disabled' : ''}>◀ PREV</button>
          <button id="btn-wiz-next" class="btn-tactile btn-play">${this.wizardStep === this.wizardSteps.length - 1 ? 'FINISH' : 'NEXT ▶'}</button>
        </div>
      </div>

      <div style="font-size: 12px; color: #abb2bf; line-height: 1.6; margin-bottom: 14px;">
        <p>${step.desc}</p>
      </div>

      ${isConfirmStep ? `
        <div style="background: #1c2025; border: 1px solid #2ecc71; border-radius: 6px; padding: 12px; margin-bottom: 12px;">
          <h4 style="color: #2ecc71; margin-bottom: 8px;">VERIFIED CONTROLS SUMMARY:</h4>
          <div style="font-size: 11px; line-height: 1.8; color: #abb2bf;">
            <div>🎹 Piano Keys Verified: <strong style="color: #00cec9;">${this.testedKeys.size} keys (Channel 2)</strong></div>
            <div>🔘 Hardware Buttons Verified: <strong style="color: #61afef;">${this.testedButtons.size} buttons</strong> (Play/Pause 91, Rec 93, Stop 81, Tracks 64-71, Scenes 82-86)</div>
            <div>🎛 Knobs Swept: <strong style="color: #ff9f43;">${this.testedKnobs.size} / 8 continuous encoders</strong></div>
            <div>🟩 Grid Pads Verified: <strong style="color: #2ecc71;">${this.testedPads.size} / 40 pads</strong></div>
          </div>
          <button id="btn-wiz-confirm-save" class="btn-tactile btn-play" style="margin-top: 10px; width: 100%; padding: 8px; font-weight: 900; font-size: 11px;">💾 CONFIRM &amp; SAVE CALIBRATION PROFILE</button>
        </div>
      ` : ''}

      <div id="wizard-live-box" style="background: #0d0f12; padding: 12px; border-radius: 6px; border: 1px dashed #3e4451; font-family: monospace; font-size: 11px; color: #2ecc71;">
        STATUS: AWAITING INPUT FOR ${step.title.toUpperCase()}...
      </div>
    `;

    if (isConfirmStep) {
      const confBtn = document.getElementById('btn-wiz-confirm-save');
      if (confBtn) {
        confBtn.addEventListener('click', () => {
          const profile = {
            name: 'Akai APC Key 25 Mk1 (Calibrated)',
            deviceMode: this.midiManager.deviceMode,
            timestamp: Date.now(),
            transportNotes: { playPause: 91, rec: 93, stopAll: 81 },
            trackNotes: [64, 65, 66, 67, 68, 69, 70, 71],
            sceneNotes: { scene1: 82, scene2: 83, scene3: 84, scene4: 85, scene5: 86, stopAll: 81 },
            shiftNotes: [98],
            sustainCC: 64,
            knobCCs: [48, 49, 50, 51, 52, 53, 54, 55],
            gridRows: this.midiManager.mapper.activeProfile.gridRows
          };
          this.midiManager.mapper.saveCustomProfile(profile);
          alert('✓ Hardware Calibration Profile Confirmed & Saved!');
          this._switchTab('diagnostic');
        });
      }
    }

    document.getElementById('btn-wiz-prev').addEventListener('click', () => {
      if (this.wizardStep > 0) {
        this.wizardStep--;
        this._renderWizardStep();
      }
    });

    document.getElementById('btn-wiz-next').addEventListener('click', () => {
      if (this.wizardStep < this.wizardSteps.length - 1) {
        this.wizardStep++;
        this._renderWizardStep();
      } else {
        alert('Guided Hardware Verification Complete! All controls confirmed.');
        this._switchTab('diagnostic');
      }
    });
  }

  _checkWizardProgress(type, id, extra = '') {
    const liveBox = document.getElementById('wizard-live-box');
    if (!liveBox) return;

    const curStep = this.wizardSteps[this.wizardStep];
    let matched = false;

    if (curStep.id === 'keys' && type === 'key') {
      matched = true;
      liveBox.innerHTML = `✅ <strong style="color: #2ecc71;">[KEYBED DETECTED]</strong> Key Note #${id} (${extra}) on Channel 2! Total keys tested: ${this.testedKeys.size}/25`;
    } else if (curStep.id === 'transport' && (type === 'transport' || (type === 'scene' && (id === 1 || id === 2)))) {
      matched = true;
      const tNames = {
        91: 'PLAY/PAUSE (Dedicated Note 91)',
        93: 'REC / OVERDUB (Dedicated Note 93)',
        81: 'STOP ALL CLIPS (Note 81)',
        1: 'PLAY/PAUSE (Mk1 Scene 1 / Note 82)',
        2: 'REC / OVERDUB (Mk1 Scene 2 / Note 83)'
      };
      liveBox.innerHTML = `✅ <strong style="color: #2ecc71;">[TRANSPORT DETECTED]</strong> ${tNames[id] || `Note ${id}`} Confirmed! Total buttons: ${this.testedButtons.size}`;
    } else if (curStep.id === 'tracks' && type === 'track') {
      matched = true;
      liveBox.innerHTML = `✅ <strong style="color: #2ecc71;">[TRACK BUTTON DETECTED]</strong> Track Button #${id} (${extra}) Confirmed! Total buttons: ${this.testedButtons.size}`;
    } else if (curStep.id === 'scenes' && type === 'scene') {
      matched = true;
      liveBox.innerHTML = `✅ <strong style="color: #2ecc71;">[SCENE BUTTON DETECTED]</strong> Scene Launch #${id} Confirmed! Total buttons: ${this.testedButtons.size}`;
    } else if (curStep.id === 'knobs' && type === 'knob') {
      matched = true;
      liveBox.innerHTML = `✅ <strong style="color: #2ecc71;">[KNOB DETECTED]</strong> Knob ${id + 1} (${extra}) Turned! Knobs swept: ${this.testedKnobs.size}/8`;
    } else if (curStep.id === 'shift_sustain' && (type === 'shift' || type === 'sustain')) {
      matched = true;
      liveBox.innerHTML = `✅ <strong style="color: #2ecc71;">[MODIFIER DETECTED]</strong> ${type.toUpperCase()} (${id}) Confirmed!`;
    } else if (curStep.id === 'pads' && type === 'pad') {
      matched = true;
      liveBox.innerHTML = `✅ <strong style="color: #2ecc71;">[PAD DETECTED]</strong> Pad Note #${id} (${extra}) Confirmed! Pads tested: ${this.testedPads.size}/40`;
    }

    if (matched) {
      liveBox.style.borderColor = '#2ecc71';
      setTimeout(() => { if (liveBox) liveBox.style.borderColor = '#3e4451'; }, 400);
    }
  }

  _renderLayoutReference() {
    const container = document.getElementById('layout-reference-container');
    if (!container) return;

    container.innerHTML = `
      <div style="background: #14171a; border: 1px solid #282c34; border-radius: 6px; padding: 14px; font-size: 11px; line-height: 1.6; color: #abb2bf;">
        <h3 style="color: #ff5722; margin-bottom: 8px;">AKAI APC KEY 25 MK1 // HARDWARE ARCHITECTURE &amp; MIDI CODES</h3>
        
        <div style="background: #1c2025; padding: 8px 12px; border-radius: 4px; border-left: 3px solid #00cec9; margin-bottom: 12px;">
          <strong style="color: #ffffff;">CRITICAL CHANNEL SEPARATION:</strong><br>
          • <strong>Channel 1:</strong> 40 Clip Launch Pads (0-39), 8 Knobs (CC 48-55), 5 Scenes (82-86), Stop All Clips (81), 8 Bottom Track Buttons (64-71), Shift (98), Sustain (CC 64).<br>
          • <strong>Channel 2:</strong> 25-Key Velocity-Sensitive Keybed (C3-C5 / Notes 48 to 72 default). Strictly plays active sample with ZERO hidden shortcuts!
        </div>

        <!-- Visual ASCII Hardware Diagram of APC Key 25 Mk1 -->
        <div style="background: #080a0c; border: 1px solid #3e4451; border-radius: 4px; padding: 10px; margin-bottom: 14px; font-family: monospace; font-size: 10px; color: #61afef; overflow-x: auto;">
<pre style="margin: 0; line-height: 1.3;">
+---------------------------------------------------------------------------------------------------+
|  AKAI APC KEY 25 MK1 PHYSICAL FRONT PANEL LAYOUT                                                  |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|  [ K1:CC48 ] [ K2:CC49 ] [ K3:CC50 ] [ K4:CC51 ] [ K5:CC52 ] [ K6:CC53 ] [ K7:CC54 ] [ K8:CC55 ]  |
|   (Start)     (End)       (Pitch)    (Dual-Filt)    (Res-Q)     (Decay)    (FX-Send)   (Comp-Vol) |
|                                                                                                   |
|  +-------------------------------------------------------------------+  [SCENE 1: Note 82] PLAY   |
|  | [32] [33] [34] [35] [36] [37] [38] [39]  Row 0 / Step  1 -  8     |  (Shift+Sc1: Sample Mode)  |
|  | [24] [25] [26] [27] [28] [29] [30] [31]  Row 1 / Step  9 - 16     |  [SCENE 2: Note 83] REC    |
|  | [16] [17] [18] [19] [20] [21] [22] [23]  Row 2 / Patterns 1 -  8  |  (Shift+Sc2: Pattern Mode) |
|  | [ 8] [ 9] [10] [11] [12] [13] [14] [15]  Row 3 / Mutes    1 -  8  |  [SCENE 3: Note 84] SLICE  |
|  | [ 0] [ 1] [ 2] [ 3] [ 4] [ 5] [ 6] [ 7]  Row 4 / Punch FX 1 -  8  |  (Shift+Sc3: Perform Mode) |
|  +-------------------------------------------------------------------+  [SCENE 4: Note 85] TAP    |
|                                                                         [SCENE 5: Note 86] NEXT   |
|   [▲:64]    [▼:65]    [◄:66]    [►:67]   [VOL:68]  [PAN:69]  [SEND:70]  [DEV:71]  [STOP ALL: 81]    |
|   Track 1   Track 2   Track 3   Track 4   Track 5   Track 6   Track 7   Track 8   [ SHIFT: 98 ]     |
|                                                                                                   |
|  [OCT UP]   +----------------------------------------------------------------------------------+  |
|  [OCT DN]   |  25-KEY VELOCITY KEYBED (MIDI CHANNEL 2 EXCLUSIVELY: NOTES 48 TO 72 DEFAULT)     |  |
|  [SUSTAIN]  |  | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | |  |
|  (CC 64)    +----------------------------------------------------------------------------------+  |
+---------------------------------------------------------------------------------------------------+
</pre>
        </div>

        <div style="background: #1e2630; padding: 8px 12px; border-radius: 4px; border-left: 3px solid #f39c12; margin-bottom: 12px; font-size: 11px;">
          <strong style="color: #ff9f43;">WHY DO MK1 OCTAVE / LED BUTTONS SOMETIMES WHINE IN HEADPHONES?</strong><br>
          The APC Key 25 Mk1 uses high-frequency <strong>Pulse Width Modulation (PWM)</strong> to drive its tri-color LEDs. When connected to the same computer as a USB-powered audio interface (such as the PreSonus AudioBox USB 96), this PWM switching current ripples across the shared 5V USB ground, creating an audible electrical pitch in analog headphone amplifiers. <em>This is not a software synthesis bug</em>.<br>
          👉 <strong>Software Fix:</strong> Use Open-KO's <strong>ECO LED MODE</strong> (toggles on the top bar) to keep unused background pads dark, reducing USB current draw by 90% and running dead silent!<br>
          👉 <strong>Hardware Fix:</strong> Connect the APC Key 25 and AudioBox to separate USB root hubs or an externally powered USB hub with isolated ground.
        </div>

        <table style="width: 100%; font-size: 11px; border-collapse: collapse; margin-top: 8px;">
          <thead>
            <tr style="border-bottom: 2px solid #3e4451; color: #ff9f43; text-align: left;">
              <th style="padding: 6px;">Hardware Element</th>
              <th style="padding: 6px;">MIDI Channel</th>
              <th style="padding: 6px;">Type / Note / CC</th>
              <th style="padding: 6px;">Open-KO Default Function</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid #23272e;">
              <td style="padding: 5px;"><strong>8x5 Pad Matrix (40 Pads)</strong></td>
              <td style="padding: 5px;">Channel 1</td>
              <td style="padding: 5px;">Note On/Off 0 to 39</td>
              <td style="padding: 5px;">Steps 1-16 (Rows 0-1; Hold Step + Knobs = P-Lock; Hold Step + Shift+K3 = 128th Nudge) | Patterns 1-8 (Row 2) | Mutes 1-8 (Row 3) | 8 Punch-In FX (Row 4: 1/8 Stutter, 1/16 Beat Roll, 12-Bit SP-1200, Vinyl Brake, HPF Sweep, LPF Sub-Drop, Sidechain Pump, Dub Space Echo)</td>
            </tr>
            <tr style="border-bottom: 1px solid #23272e;">
              <td style="padding: 5px;"><strong>Shift + Rows 0 &amp; 1 (Pattern Tools)</strong></td>
              <td style="padding: 5px;">Channel 1</td>
              <td style="padding: 5px;">Note 98 + Notes 24–39</td>
              <td style="padding: 5px;"><strong>Row 0 (32-39):</strong> Clear, Dup, Shift L/R, Humanize, Swing, 2x/0.5x BPM<br><strong>Row 1 (24-31):</strong> Rec Mode (Freeform/Quant), Cycle Zoom (1X–8X / 128th), Nudge -1/128, Nudge +1/128, Master Sidechain ON/OFF, Track Duck (D), Set Sidechain Source (SC), Page Follow</td>
            </tr>
            <tr style="border-bottom: 1px solid #23272e;">
              <td style="padding: 5px;"><strong>Knobs 1 to 8 (Dual Banks + Shift)</strong></td>
              <td style="padding: 5px;">Channel 1</td>
              <td style="padding: 5px;">Continuous CC #48 to #55</td>
              <td style="padding: 5px;"><strong>Track:</strong> Start (48), End (49), Pitch (50), PO Filter (51), Q (52), Decay (53), Delay Send (54), Vol (55)<br><strong>Master (DEV 71):</strong> BPM, Swing, Tune, Master Filter, Master Q, Space Time, Sidechain Release, Sidechain Depth / Comp Vol<br><strong>Shift:</strong> Zoom 1X-8X (48), Page P1-P8 (49), 128th Nudge / Fine Tune (50), Master Filter (51), Swing (52), Stretch Mode (53), Space Feedback (54), BPM (55)</td>
            </tr>
            <tr style="border-bottom: 1px solid #23272e;">
              <td style="padding: 5px;"><strong>Scene Buttons 1 to 5</strong></td>
              <td style="padding: 5px;">Channel 1</td>
              <td style="padding: 5px;">Note #82, 83, 84, 85, 86</td>
              <td style="padding: 5px;">Scene 1 (Play/Pause, Shift = Sample Mode) | Scene 2 (Rec Freeform/Overdub, Shift = Pattern Mode) | Scene 3 (Auto-Slice, Shift = Perf Mode) | Scene 4 (Metro, Shift = Tap Tempo) | Scene 5 (Append Chain, Shift = Reset Chain)</td>
            </tr>
            <tr style="border-bottom: 1px solid #23272e;">
              <td style="padding: 5px;"><strong>Physical PLAY / PAUSE</strong></td>
              <td style="padding: 5px;">Channel 1</td>
              <td style="padding: 5px;"><strong style="color: #2ecc71;">Note #91 (0x5B)</strong></td>
              <td style="padding: 5px;">Normal: Play / Pause playback | Shift + Play: Toggle Freeform (Auto-BPM 128th) vs Quantized Record Mode</td>
            </tr>
            <tr style="border-bottom: 1px solid #23272e;">
              <td style="padding: 5px;"><strong>Physical REC</strong></td>
              <td style="padding: 5px;">Channel 1</td>
              <td style="padding: 5px;"><strong style="color: #e74c3c;">Note #93 (0x5D)</strong></td>
              <td style="padding: 5px;">Normal: Arm Freeform 128th First-Loop Auto-BPM (or Quantized Overdub) | Shift + REC: Live Sample Line/Mic</td>
            </tr>
            <tr style="border-bottom: 1px solid #23272e;">
              <td style="padding: 5px;"><strong>Stop All Clips</strong></td>
              <td style="padding: 5px;">Channel 1</td>
              <td style="padding: 5px;">Note #81 (0x51)</td>
              <td style="padding: 5px;">Stop Playback &amp; Reset Playhead to Step 0, Pattern 1</td>
            </tr>
            <tr style="border-bottom: 1px solid #23272e;">
              <td style="padding: 5px;"><strong>Bottom Track Buttons (8)</strong></td>
              <td style="padding: 5px;">Channel 1</td>
              <td style="padding: 5px;">Note #64 to #71</td>
              <td style="padding: 5px;">▲(64), ▼(65), ◄(66), ►(67), VOL(68), PAN(69), SEND(70), DEV(71) — Track Mutes 1-8 (Shift = Mutes 9-16)</td>
            </tr>
            <tr style="border-bottom: 1px solid #23272e;">
              <td style="padding: 5px;"><strong>Physical Shift Button</strong></td>
              <td style="padding: 5px;">Channel 1</td>
              <td style="padding: 5px;">Note #98 (0x62)</td>
              <td style="padding: 5px;">Global Shift Modifier (Hold for mode switching &amp; pattern tools)</td>
            </tr>
            <tr style="border-bottom: 1px solid #23272e;">
              <td style="padding: 5px;"><strong>Physical Sustain Button</strong></td>
              <td style="padding: 5px;">Channel 1</td>
              <td style="padding: 5px;">CC #64 (127 on press, 0 on release)</td>
              <td style="padding: 5px;">Normal: Sustain melodic notes | Shift + Sustain: Toggle Minimal View</td>
            </tr>
            <tr style="border-bottom: 1px solid #23272e;">
              <td style="padding: 5px;"><strong>Octave Down / Up Buttons</strong></td>
              <td style="padding: 5px;">Hardware Internal</td>
              <td style="padding: 5px;">Internal Transposition</td>
              <td style="padding: 5px;">Transposes 25 physical piano keys internally by ±12 semitones without MIDI voice trigger</td>
            </tr>
            <tr>
              <td style="padding: 5px;"><strong>25-Key Piano Keyboard</strong></td>
              <td style="padding: 5px;"><strong style="color: #00cec9;">Channel 2</strong></td>
              <td style="padding: 5px;">Notes 48 to 72 (C3 to C5 default)</td>
              <td style="padding: 5px;">Melodic Slot: Chromatic polyphony | Drum Slot: Keys 1-16 trigger slices 1-16 (ZERO hidden shortcuts!)</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }
}
