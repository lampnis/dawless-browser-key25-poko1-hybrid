/**
 * Open-KO: MinimalPoView
 * Ultra-minimalist Teenage Engineering PO-33 / EP-133 retro LCD engine
 * with animated punch boxer, authentic segment badges, 16-LED dot strip,
 * discrete vertical segment VU ladders, and pocket sampler feel.
 */

export class MinimalPoView {
  constructor(container, audioEngine, sequencer) {
    this.container = container;
    this.audioEngine = audioEngine;
    this.sequencer = sequencer;

    this.boxerPunching = false;
    this.punchTimeout = null;

    this._buildDom();
  }

  _buildDom() {
    this.container.innerHTML = `
      <div class="po-pocket-screen">
        <!-- Top Status Segment Icons (Authentic PO-33 / EP-133 LCD Badges) -->
        <div class="po-segment-icons">
          <!-- Modes -->
          <div class="po-badge-cluster">
            <span id="po-badge-smpl" class="po-badge" title="APC: Shift + Scene 1 (Note 98 + Note 82) -> Sample Mode" data-apc-hint="APC: Shift + Scene 1 -> Sample Mode">SMPL</span>
            <span id="po-badge-ptrn" class="po-badge active" title="APC: Shift + Scene 2 (Note 98 + Note 83) -> Pattern Mode" data-apc-hint="APC: Shift + Scene 2 -> Pattern Mode">PTRN</span>
            <span id="po-badge-perf" class="po-badge" title="APC: Shift + Scene 3 (Note 98 + Note 84) -> Performance Mode" data-apc-hint="APC: Shift + Scene 3 -> Performance Mode">PERF</span>
          </div>

          <!-- Transport & Action Indicators -->
          <div class="po-badge-cluster">
            <span id="po-badge-play" class="po-badge" title="APC: PLAY/PAUSE (Note 91) or Scene 1 (Note 82)" data-apc-hint="APC: PLAY/PAUSE (Note 91) or Scene 1">▶ PLAY</span>
            <span id="po-badge-rec" class="po-badge po-badge-rec" title="APC: REC (Note 93) or Scene 2 (Note 83)" data-apc-hint="APC: REC (Note 93) or Scene 2">● REC</span>
            <span id="po-badge-trim" class="po-badge" title="APC: Knob 1 (Start Trim) & Knob 2 (End Trim)" data-apc-hint="APC: Knob 1 (Start Trim) & Knob 2 (End Trim)">✂ TRIM</span>
            <span id="po-badge-fx" class="po-badge" title="APC: Matrix Row 5 Pads (Notes 0-7) trigger Punch-In FX" data-apc-hint="APC: Matrix Row 5 Pads (Notes 0-7) -> Punch-In FX">⚡ FX</span>
            <span id="po-badge-lock" class="po-badge" title="APC: Hold Step Pad + turn knob to P-Lock" data-apc-hint="APC: Hold Step Pad + turn knob to P-Lock">🔒 LOCK</span>
            <span id="po-badge-metro" class="po-badge" title="APC: Scene 4 (Note 85) toggles Metronome | Shift + Scene 4 = Tap Tempo" data-apc-hint="APC: Scene 4 -> Metronome | Shift + Scene 4 -> Tap Tempo">♩ METRO</span>
            <span id="po-badge-swing" class="po-badge" title="APC: In Master Knobs, turn Knob 2 (CC 49)" data-apc-hint="APC: In Master Knobs, turn Knob 2 (CC 49) -> Swing">⏳ SWG</span>
            <span id="po-badge-knob" class="po-badge" title="APC: DEVICE (Note 71) or Shift + ► toggles Track / Master Knobs" data-apc-hint="APC: DEVICE (Note 71) -> Toggle Track/Master Knobs">🎛 TRK</span>
            <span id="po-badge-type" class="po-badge active" title="APC: Hold ► (Note 67) + Pads (Row 1 Melodic, Row 2 Drum)" data-apc-hint="APC: Hold ► + Pads to select Melodic/Drum slot">🎹 MEL</span>
            <span id="po-badge-mute" class="po-badge po-badge-mute" title="APC: Bottom Track Buttons (Notes 64-71) toggle Track Mute" data-apc-hint="APC: Bottom Track Buttons (Notes 64-71) -> Mute">MUTE</span>
            <span id="po-badge-choke" class="po-badge" title="APC: Drum slice choke group" data-apc-hint="APC: Drum slot choke group">CHOKE</span>
            <span id="po-badge-sust" class="po-badge" title="APC: Physical SUSTAIN button (CC 64)" data-apc-hint="APC: Physical SUSTAIN button (CC 64)">SUST</span>
            <span id="po-badge-lpf" class="po-badge" title="APC: Turn Knob 4 (CC 51) below 64 for Low-Pass Filter" data-apc-hint="APC: Turn Knob 4 (CC 51) < 64 for LPF">LPF</span>
            <span id="po-badge-hpf" class="po-badge" title="APC: Turn Knob 4 (CC 51) above 64 for High-Pass Filter" data-apc-hint="APC: Turn Knob 4 (CC 51) > 64 for HPF">HPF</span>
          </div>
        </div>

        <!-- Main Display: Animated Boxer + Big LCD Numbers + VU Ladders -->
        <div class="po-lcd-main">
          <!-- Animated Teenage Engineering Boxer / K.O! Character -->
          <div class="po-boxer-box">
            <svg id="po-boxer-svg" class="po-boxer-svg" viewBox="0 0 80 80">
              <!-- Boxer Body -->
              <circle cx="40" cy="22" r="12" fill="#ff9f43" />
              <!-- Headband -->
              <rect x="28" y="16" width="24" height="4" fill="#e74c3c" />
              <!-- Eye -->
              <circle cx="46" cy="22" r="2" fill="#121417" />
              <!-- Torso -->
              <rect x="34" y="34" width="14" height="22" rx="4" fill="#ff9f43" />
              <!-- Boxing Shorts -->
              <rect x="32" y="52" width="18" height="12" rx="2" fill="#00cec9" />
              <!-- Legs -->
              <rect x="34" y="64" width="4" height="12" fill="#ff9f43" />
              <rect x="44" y="64" width="4" height="12" fill="#ff9f43" />
              <!-- Left Glove (Idle Guard) -->
              <circle id="boxer-left-glove" cx="28" cy="38" r="7" fill="#e74c3c" />
              <!-- Right Glove (Puncher) -->
              <circle id="boxer-right-glove" cx="50" cy="38" r="7" fill="#e74c3c" />
              <!-- Punch Impact Star -->
              <g id="boxer-impact-star" opacity="0">
                <polygon points="68,26 72,34 80,36 74,42 76,50 68,46 60,50 62,42 56,36 64,34" fill="#ffdd59" />
                <text x="63" y="41" font-size="8" font-family="sans-serif" font-weight="900" fill="#e74c3c">KO!</text>
              </g>
            </svg>
            <div id="po-action-text" class="po-action-text">OPEN-KO</div>
          </div>

          <!-- Big Retro 7-Segment LCD Data -->
          <div class="po-lcd-data-cluster">
            <div class="po-digit-group">
              <span class="po-mini-label">BPM</span>
              <span id="po-digit-bpm" class="po-big-digit">92</span>
            </div>
            <div class="po-digit-group">
              <span class="po-mini-label">PATTERN</span>
              <span id="po-digit-pattern" class="po-big-digit">01</span>
            </div>
            <div class="po-digit-group">
              <span class="po-mini-label">SLOT</span>
              <span id="po-digit-slot" class="po-big-digit">01</span>
            </div>
            <!-- Dual PO Filter Readout -->
            <div class="po-digit-group">
              <span class="po-mini-label">PO FILTER</span>
              <span id="po-digit-filter" class="po-med-digit">OFF</span>
            </div>
            <!-- Live Parameter / Tool Sub-Readout -->
            <div class="po-digit-group po-param-readout">
              <span class="po-mini-label">PARAM / TOOL</span>
              <span id="po-digit-param" class="po-small-lcd">STANDBY</span>
            </div>
          </div>

          <!-- Vertical Stereo & Mic VU Segment Ladders -->
          <div class="po-vu-ladders">
            <div class="po-vu-col" id="po-vu-col-l">
              <div class="po-vu-seg red"></div>
              <div class="po-vu-seg amber"></div>
              <div class="po-vu-seg green"></div>
              <div class="po-vu-seg green"></div>
              <div class="po-vu-seg green"></div>
              <span class="po-vu-lbl">L</span>
            </div>
            <div class="po-vu-col" id="po-vu-col-r">
              <div class="po-vu-seg red"></div>
              <div class="po-vu-seg amber"></div>
              <div class="po-vu-seg green"></div>
              <div class="po-vu-seg green"></div>
              <div class="po-vu-seg green"></div>
              <span class="po-vu-lbl">R</span>
            </div>
            <div class="po-vu-col" id="po-vu-col-in">
              <div class="po-vu-seg red"></div>
              <div class="po-vu-seg amber"></div>
              <div class="po-vu-seg green"></div>
              <div class="po-vu-seg green"></div>
              <div class="po-vu-seg green"></div>
              <span class="po-vu-lbl">IN</span>
            </div>
          </div>
        </div>

        <!-- PO-33 16-Step Circular LED Dot Strip -->
        <div class="po-led-strip">
          ${Array.from({ length: 16 }).map((_, idx) => `
            <div id="po-led-${idx}" class="po-led-dot" data-step="${idx}">
              <span class="po-led-num">${idx + 1}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  triggerPunch(text = 'HIT!') {
    const star = document.getElementById('boxer-impact-star');
    const glove = document.getElementById('boxer-right-glove');
    const actText = document.getElementById('po-action-text');

    if (glove) glove.setAttribute('cx', '64');
    if (star) star.setAttribute('opacity', '1');
    if (actText) actText.textContent = text.toUpperCase();

    if (this.punchTimeout) clearTimeout(this.punchTimeout);
    this.punchTimeout = setTimeout(() => {
      if (glove) glove.setAttribute('cx', '50');
      if (star) star.setAttribute('opacity', '0');
    }, 140);
  }

  updateState(state = {}) {
    // Mode Badges
    const badgeSmpl = document.getElementById('po-badge-smpl');
    const badgePtrn = document.getElementById('po-badge-ptrn');
    const badgePerf = document.getElementById('po-badge-perf');

    if (state.mode) {
      if (badgeSmpl) badgeSmpl.classList.toggle('active', state.mode === 'sample');
      if (badgePtrn) badgePtrn.classList.toggle('active', state.mode === 'pattern');
      if (badgePerf) badgePerf.classList.toggle('active', state.mode === 'performance');
    }

    // Function Badges
    const badgePlay = document.getElementById('po-badge-play');
    const badgeRec = document.getElementById('po-badge-rec');
    const badgeTrim = document.getElementById('po-badge-trim');
    const badgeFx = document.getElementById('po-badge-fx');
    const badgeLock = document.getElementById('po-badge-lock');
    const badgeMetro = document.getElementById('po-badge-metro');
    const badgeSwing = document.getElementById('po-badge-swing');
    const badgeKnob = document.getElementById('po-badge-knob');
    const badgeType = document.getElementById('po-badge-type');
    const badgeMute = document.getElementById('po-badge-mute');
    const badgeChoke = document.getElementById('po-badge-choke');
    const badgeSust = document.getElementById('po-badge-sust');
    const badgeLpf = document.getElementById('po-badge-lpf');
    const badgeHpf = document.getElementById('po-badge-hpf');

    if (badgePlay) {
      badgePlay.classList.toggle('active', !!state.isPlaying);
      badgePlay.textContent = state.isPaused ? '❚❚ PAUSE' : '▶ PLAY';
    }
    if (badgeRec) badgeRec.classList.toggle('active', !!state.isRecording);
    if (badgeTrim) badgeTrim.classList.toggle('active', !!state.isTrimming);
    if (badgeFx) badgeFx.classList.toggle('active', !!state.isFxActive);
    if (badgeLock) badgeLock.classList.toggle('active', !!state.hasPLock);
    if (badgeMetro) badgeMetro.classList.toggle('active', !!state.metronome);
    if (badgeSwing) badgeSwing.classList.toggle('active', (state.swing > 50));
    if (badgeKnob) {
      badgeKnob.textContent = state.knobBank === 'master' ? '🎛 MST' : '🎛 TRK';
      badgeKnob.classList.toggle('active', state.knobBank === 'master');
    }
    if (badgeType && state.slotType) {
      badgeType.textContent = state.slotType === 'melodic' ? '🎹 MEL' : '🥁 DRM';
      badgeType.classList.add('active');
    }
    if (badgeMute) badgeMute.classList.toggle('active', !!state.hasMutes);
    if (badgeChoke) badgeChoke.classList.toggle('active', !!state.chokeActive);
    if (badgeSust) badgeSust.classList.toggle('active', !!state.sustainActive);

    if (badgeLpf && badgeHpf && state.filterVal !== undefined) {
      badgeLpf.classList.toggle('active', state.filterVal < 64);
      badgeHpf.classList.toggle('active', state.filterVal > 64);
    }

    // Digits
    const digitBpm = document.getElementById('po-digit-bpm');
    const digitPat = document.getElementById('po-digit-pattern');
    const digitSlot = document.getElementById('po-digit-slot');
    const digitFilter = document.getElementById('po-digit-filter');
    const digitParam = document.getElementById('po-digit-param');

    if (digitBpm && state.bpm) digitBpm.textContent = `${state.bpm}`;
    if (digitPat && state.pattern !== undefined) {
      digitPat.textContent = `${String(state.pattern + 1).padStart(2, '0')}`;
    }
    if (digitSlot && state.slot !== undefined) {
      digitSlot.textContent = `${String(state.slot + 1).padStart(2, '0')}`;
    }
    if (digitFilter && state.filterVal !== undefined) {
      if (state.filterVal === 64) digitFilter.textContent = 'OFF';
      else if (state.filterVal < 64) digitFilter.textContent = `LP${Math.round((state.filterVal / 63) * 99)}`;
      else digitFilter.textContent = `HP${Math.round(((state.filterVal - 64) / 63) * 99)}`;
    }
    if (digitParam && state.paramMsg) {
      digitParam.textContent = state.paramMsg.toUpperCase();
    }
  }

  updateLeds(steps, currentStep = -1) {
    for (let i = 0; i < 16; i++) {
      const dot = document.getElementById(`po-led-${i}`);
      if (!dot) continue;

      dot.className = 'po-led-dot';
      const isActive = steps && steps[i];
      const isPlayhead = (i === currentStep);

      if (isPlayhead) {
        dot.classList.add(isActive ? 'po-led-red' : 'po-led-green');
      } else if (isActive) {
        dot.classList.add('po-led-amber');
      }
    }
  }

  updateVu(leftNorm, rightNorm, inNorm) {
    const renderCol = (colId, norm) => {
      const col = document.getElementById(colId);
      if (!col) return;
      const segs = Array.from(col.querySelectorAll('.po-vu-seg')).reverse(); // bottom to top
      const count = Math.round(norm * segs.length);
      segs.forEach((seg, idx) => {
        seg.classList.toggle('active', idx < count);
      });
    };

    renderCol('po-vu-col-l', leftNorm);
    renderCol('po-vu-col-r', rightNorm);
    renderCol('po-vu-col-in', inNorm);
  }
}
