/**
 * Open-KO: ApcHardwareHelp
 * Provides:
 * 1. Reusable live mini SVG mock model of the physical Akai APC Key 25 Mk1
 *    highlighting the exact physical button(s), pad(s), knob(s), Shift modifier,
 *    Track button(s), Scene launch button(s), or Keybed zone.
 * 2. Floating mouse-follow hardware tooltip on hover over ANY UI control.
 * 3. Dedicated Ableton Live-style docked "INFO BOX" help window.
 */

export class ApcHardwareHelp {
  constructor() {
    this.floatingEl = null;
    this.infoBoxEl = null;
    this.floatingEnabled = true;
    this.infoBoxVisible = false;
    this._hoverTimer = null;
    this._currentTarget = null;
    this._lastInfo = {
      title: 'OPEN-KO // LIVE HARDWARE INFO VIEW',
      shortcut: 'Hover any button, knob, pad, or mixer control',
      desc: 'Displays the exact physical Akai APC Key 25 Mk1 control that operates each element.',
      controls: []
    };
  }

  init() {
    if (typeof document === 'undefined') return;
    this._buildFloatingTooltip();
    this._buildDockedInfoBox();
    this._attachHoverListeners();

    const toggleBtn = document.getElementById('btn-toggle-help-panel');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        toggleBtn.blur();
        this.toggleInfoBox();
      });
    }
  }

  /**
   * Renders a crisp schematic SVG model of the physical Akai APC Key 25 Mk1
   * with highlighted control tokens.
   *
   * Supported tokens:
   * - 'pad-R-C' (R: 0..4, C: 0..7), 'row-R', 'matrix'
   * - 'scene1'..'scene5', 'stop', 'shift', 'play', 'rec', 'sustain', 'oct-dn', 'oct-up'
   * - 'track-0'..'track-7' (▲, ▼, ◄, ►, VOL, PAN, SEND, DEV)
   * - 'knob-0'..'knob-7' (K1..K8 in physical 2x4 APC Key 25 layout)
   * - 'keys' (25-key Channel 2 keybed)
   */
  static renderApcSvg(highlights = [], compact = false) {
    const hl = new Set(Array.isArray(highlights) ? highlights : []);
    const isHl = (token) => hl.has(token);

    const padColor = (r, c) => {
      if (isHl(`pad-${r}-${c}`) || isHl(`row-${r}`) || isHl('matrix')) {
        return { fill: '#e88c38', stroke: '#ffd3a0', pulse: true };
      }
      return { fill: '#2c343b', stroke: '#191f24', pulse: false };
    };

    const btnColor = (token, activeFill = '#e88c38') => {
      if (isHl(token)) {
        return { fill: activeFill, stroke: '#ffe2ba', text: '#171c20', pulse: true };
      }
      return { fill: '#2a3239', stroke: '#171c20', text: '#8c9aa6', pulse: false };
    };

    // 5x8 Pad Matrix (left side)
    let padsSvg = '';
    const padX0 = 10;
    const padY0 = 10;
    const padW = 15;
    const padH = 9;
    const gapX = 2.5;
    const gapY = 2.5;

    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 8; c++) {
        const x = padX0 + c * (padW + gapX);
        const y = padY0 + r * (padH + gapY);
        const st = padColor(r, c);
        padsSvg += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${padW}" height="${padH}" rx="1.2" fill="${st.fill}" stroke="${st.stroke}" stroke-width="${st.pulse ? '1.1' : '0.7'}" class="${st.pulse ? 'apc-svg-hl' : ''}"/>`;
      }
    }

    // 5 Scene Launch Round Buttons (column right of pads)
    let scenesSvg = '';
    const scX = padX0 + 8 * (padW + gapX) + 4;
    for (let i = 0; i < 5; i++) {
      const cy = padY0 + i * (padH + gapY) + padH / 2;
      const st = btnColor(`scene${i + 1}`, '#73bf57');
      scenesSvg += `<circle cx="${scX}" cy="${cy.toFixed(1)}" r="4.2" fill="${st.fill}" stroke="${st.stroke}" stroke-width="${st.pulse ? '1.2' : '0.7'}" class="${st.pulse ? 'apc-svg-hl' : ''}"/>`;
      scenesSvg += `<text x="${scX}" y="${(cy + 2).toFixed(1)}" text-anchor="middle" font-size="4.6" font-weight="700" fill="${st.text}">S${i + 1}</text>`;
    }

    // Bottom Row Track Buttons (8: ▲ ▼ ◄ ► VOL PAN SEND DEV) + STOP ALL
    const trackLabels = ['▲', '▼', '◄', '►', 'V', 'P', 'S', 'D'];
    let tracksSvg = '';
    const trY = padY0 + 5 * (padH + gapY) + 2;
    for (let c = 0; c < 8; c++) {
      const x = padX0 + c * (padW + gapX);
      const st = btnColor(`track-${c}`, '#5ca8d6');
      tracksSvg += `<rect x="${x.toFixed(1)}" y="${trY.toFixed(1)}" width="${padW}" height="8" rx="1.2" fill="${st.fill}" stroke="${st.stroke}" stroke-width="${st.pulse ? '1.1' : '0.7'}" class="${st.pulse ? 'apc-svg-hl' : ''}"/>`;
      tracksSvg += `<text x="${(x + padW / 2).toFixed(1)}" y="${(trY + 5.7).toFixed(1)}" text-anchor="middle" font-size="4.8" font-weight="700" fill="${st.text}">${trackLabels[c]}</text>`;
    }
    const stopSt = btnColor('stop', '#d64f4f');
    tracksSvg += `<rect x="${(scX - 6).toFixed(1)}" y="${trY.toFixed(1)}" width="12" height="8" rx="1.2" fill="${stopSt.fill}" stroke="${stopSt.stroke}" stroke-width="${stopSt.pulse ? '1.1' : '0.7'}" class="${stopSt.pulse ? 'apc-svg-hl' : ''}"/>`;
    tracksSvg += `<text x="${scX}" y="${(trY + 5.6).toFixed(1)}" text-anchor="middle" font-size="4.3" font-weight="700" fill="${stopSt.text}">STP</text>`;

    // Right Block: 8 Knobs (2 rows x 4 cols — authentic APC Key 25 layout!) + SHIFT / PLAY / REC
    const knobX0 = scX + 16;
    const knobY0 = 15;
    let knobsSvg = '';
    for (let k = 0; k < 8; k++) {
      const kr = Math.floor(k / 4);
      const kc = k % 4;
      const cx = knobX0 + kc * 20;
      const cy = knobY0 + kr * 22;
      const active = isHl(`knob-${k}`) || isHl('knobs');
      knobsSvg += `<circle cx="${cx}" cy="${cy}" r="6.8" fill="${active ? '#e88c38' : '#252c32'}" stroke="${active ? '#ffe2ba' : '#13171b'}" stroke-width="${active ? '1.3' : '0.8'}" class="${active ? 'apc-svg-hl' : ''}"/>`;
      knobsSvg += `<line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - 5.2}" stroke="${active ? '#171c20' : '#9aa8b4'}" stroke-width="1.3" stroke-linecap="round"/>`;
      knobsSvg += `<text x="${cx}" y="${cy + 12}" text-anchor="middle" font-size="4.6" font-weight="700" fill="${active ? '#ffd3a0' : '#7b8a97'}">K${k + 1}</text>`;
    }

    // Utility buttons under knobs: PLAY, REC, SHIFT
    const utilY = trY - 12;
    const playSt = btnColor('play', '#73bf57');
    const recSt = btnColor('rec', '#d64f4f');
    const shiftSt = btnColor('shift', '#f2b84b');
    let utilsSvg = '';
    utilsSvg += `<rect x="${knobX0 - 7}" y="${utilY}" width="21" height="9" rx="1.5" fill="${playSt.fill}" stroke="${playSt.stroke}" stroke-width="${playSt.pulse ? '1.1' : '0.7'}" class="${playSt.pulse ? 'apc-svg-hl' : ''}"/>`;
    utilsSvg += `<text x="${knobX0 + 3.5}" y="${utilY + 6.2}" text-anchor="middle" font-size="4.6" font-weight="700" fill="${playSt.text}">PLAY</text>`;

    utilsSvg += `<rect x="${knobX0 + 17}" y="${utilY}" width="20" height="9" rx="1.5" fill="${recSt.fill}" stroke="${recSt.stroke}" stroke-width="${recSt.pulse ? '1.1' : '0.7'}" class="${recSt.pulse ? 'apc-svg-hl' : ''}"/>`;
    utilsSvg += `<text x="${knobX0 + 27}" y="${utilY + 6.2}" text-anchor="middle" font-size="4.6" font-weight="700" fill="${recSt.text}">REC</text>`;

    utilsSvg += `<rect x="${knobX0 + 40}" y="${utilY}" width="27" height="9" rx="1.5" fill="${shiftSt.fill}" stroke="${shiftSt.stroke}" stroke-width="${shiftSt.pulse ? '1.2' : '0.7'}" class="${shiftSt.pulse ? 'apc-svg-hl' : ''}"/>`;
    utilsSvg += `<text x="${knobX0 + 53.5}" y="${utilY + 6.2}" text-anchor="middle" font-size="4.8" font-weight="800" fill="${shiftSt.text}">SHIFT</text>`;

    // Left-bottom modifiers (OCT -, OCT +, SUSTAIN)
    const modY = trY + 13;
    const octDnSt = btnColor('oct-dn', '#d64f4f');
    const octUpSt = btnColor('oct-up', '#d64f4f');
    const sustSt = btnColor('sustain', '#5ca8d6');
    let modsSvg = '';
    modsSvg += `<rect x="10" y="${modY}" width="17" height="9" rx="1.3" fill="${octDnSt.fill}" stroke="${octDnSt.stroke}" stroke-width="${octDnSt.pulse ? '1.1' : '0.7'}" class="${octDnSt.pulse ? 'apc-svg-hl' : ''}"/>`;
    modsSvg += `<text x="18.5" y="${modY + 6.2}" text-anchor="middle" font-size="4.4" font-weight="700" fill="${octDnSt.text}">OCT-</text>`;

    modsSvg += `<rect x="10" y="${modY + 11}" width="17" height="9" rx="1.3" fill="${octUpSt.fill}" stroke="${octUpSt.stroke}" stroke-width="${octUpSt.pulse ? '1.1' : '0.7'}" class="${octUpSt.pulse ? 'apc-svg-hl' : ''}"/>`;
    modsSvg += `<text x="18.5" y="${modY + 17.2}" text-anchor="middle" font-size="4.4" font-weight="700" fill="${octUpSt.text}">OCT+</text>`;

    modsSvg += `<rect x="10" y="${modY + 22}" width="17" height="8" rx="1.3" fill="${sustSt.fill}" stroke="${sustSt.stroke}" stroke-width="${sustSt.pulse ? '1.1' : '0.7'}" class="${sustSt.pulse ? 'apc-svg-hl' : ''}"/>`;
    modsSvg += `<text x="18.5" y="${modY + 27.6}" text-anchor="middle" font-size="4.1" font-weight="700" fill="${sustSt.text}">SUST</text>`;

    // Bottom 25-Key Piano Keybed (15 white keys + 10 black keys)
    const keysHl = isHl('keys');
    const kbdX = 32;
    const kbdY = modY;
    const whiteW = 13.7;
    const whiteH = 30;
    let keysSvg = '';

    for (let w = 0; w < 15; w++) {
      const wx = kbdX + w * whiteW;
      keysSvg += `<rect x="${wx.toFixed(1)}" y="${kbdY}" width="${(whiteW - 0.8).toFixed(1)}" height="${whiteH}" rx="1" fill="${keysHl ? '#f4c58a' : '#cfd6dc'}" stroke="#1b2126" stroke-width="0.6" class="${keysHl ? 'apc-svg-hl' : ''}"/>`;
    }
    const blackOffsets = [0, 1, 3, 4, 5, 7, 8, 10, 11, 12];
    for (const bo of blackOffsets) {
      const bx = kbdX + (bo + 1) * whiteW - 4.3;
      keysSvg += `<rect x="${bx.toFixed(1)}" y="${kbdY}" width="8.2" height="17.5" rx="0.8" fill="${keysHl ? '#e88c38' : '#1a1f24'}" stroke="#111417" stroke-width="0.6"/>`;
    }

    const svgWidth = compact ? 236 : 252;
    const svgHeight = compact ? 112 : 120;

    return `
      <svg class="apc-mini-svg" viewBox="0 0 248 118" width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg" aria-label="Akai APC Key 25 Hardware Diagram">
        <rect x="1.5" y="1.5" width="245" height="115" rx="4" fill="#1b2126" stroke="#424e58" stroke-width="1.2"/>
        <text x="176" y="7.5" font-size="4.4" font-weight="700" fill="#6f7e8b" letter-spacing="0.5">AKAI APC KEY 25 MK1</text>
        ${padsSvg}
        ${scenesSvg}
        ${tracksSvg}
        ${knobsSvg}
        ${utilsSvg}
        ${modsSvg}
        ${keysSvg}
      </svg>
    `;
  }

  /**
   * Resolves hardware control tokens & human-readable metadata from ANY hovered DOM element.
   */
  resolveControlInfo(el) {
    if (!el) return null;

    // 1. Extract explicit data-apc-ctrl tokens
    let controls = [];
    if (el.dataset && el.dataset.apcCtrl) {
      controls = el.dataset.apcCtrl.split(',').map(s => s.trim()).filter(Boolean);
    }

    // 2. Smart dynamic detection for dynamically rendered controls
    if (controls.length === 0) {
      if (el.classList.contains('step-btn-16') && el.dataset.step !== undefined) {
        const s = parseInt(el.dataset.step, 10);
        const r = Math.floor(s / 8);
        const c = s % 8;
        controls = [`pad-${r}-${c}`];
      } else if (el.classList.contains('apc-pad') && el.dataset.row !== undefined && el.dataset.col !== undefined) {
        controls = [`pad-${el.dataset.row}-${el.dataset.col}`];
      } else if (el.classList.contains('scene-btn') && el.dataset.scene) {
        controls = [`scene${el.dataset.scene}`];
      } else if (el.classList.contains('macro-knob') && el.dataset.knob !== undefined) {
        controls = [`knob-${el.dataset.knob}`];
      } else if (el.classList.contains('piano-key')) {
        controls = ['keys'];
      } else if (el.classList.contains('oct-down')) {
        controls = ['oct-dn'];
      } else if (el.classList.contains('oct-up')) {
        controls = ['oct-up'];
      } else if (el.classList.contains('chain-block')) {
        controls = ['track-2', 'row-2'];
      } else if (el.classList.contains('strip-mute-btn') && el.id) {
        const idx = parseInt(el.id.replace('strip-mute-', ''), 10);
        controls = idx < 8 ? [`track-${idx}`] : ['shift', `track-${idx - 8}`];
      } else if (el.classList.contains('strip-duck-btn')) {
        controls = ['shift', 'pad-1-5', 'pad-1-6'];
      } else if (el.classList.contains('strip-fader')) {
        controls = ['knob-7'];
      } else if (el.classList.contains('strip-jam-btn') || el.classList.contains('mixer-strip')) {
        const strip = el.closest('.mixer-strip');
        const idx = strip && strip.dataset.slot ? parseInt(strip.dataset.slot, 10) : 0;
        const r = Math.floor(idx / 8);
        const c = idx % 8;
        controls = ['track-3', `pad-${r}-${c}`];
      }
    }

    const rawHint = (el.dataset && (el.dataset.apcHint || el.dataset.nativeTitle)) || el.getAttribute('title') || '';
    if (!rawHint && controls.length === 0) return null;

    // Derive crisp title + hardware shortcut line
    const cleanText = rawHint.replace(/^APC:\s*/i, '').trim();
    const parts = cleanText.split(/\s*->\s*|\s*\|\s*/);
    const shortcut = parts[0] || cleanText;
    const desc = parts.slice(1).join(' • ') || cleanText;

    const btnText = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 28);
    const title = el.id === 'waveform-canvas'
      ? 'WAVEFORM / SAMPLE EDITOR'
      : (btnText && btnText.length > 0 && btnText.length <= 24 ? btnText.toUpperCase() : 'APC KEY 25 HARDWARE CONTROL');

    return { title, shortcut, desc, controls };
  }

  _buildFloatingTooltip() {
    this.floatingEl = document.createElement('div');
    this.floatingEl.id = 'apc-floating-tooltip';
    this.floatingEl.className = 'apc-floating-tooltip';
    this.floatingEl.setAttribute('role', 'tooltip');
    document.body.appendChild(this.floatingEl);
  }

  _buildDockedInfoBox() {
    this.infoBoxEl = document.createElement('aside');
    this.infoBoxEl.id = 'apc-info-view-dock';
    this.infoBoxEl.className = 'apc-info-view-dock';
    this.infoBoxEl.innerHTML = `
      <div class="info-dock-header">
        <span class="info-dock-title">INFO VIEW // AKAI APC KEY 25</span>
        <div class="info-dock-actions">
          <button id="btn-info-float-toggle" class="fl-btn fl-btn-xxs is-active" title="Toggle mouse-following floating hardware tooltips">FLOAT: ON</button>
          <button id="btn-info-dock-close" class="fl-btn fl-btn-xxs" title="Close docked Info View">✕</button>
        </div>
      </div>
      <div id="info-dock-body" class="info-dock-body"></div>
    `;
    document.body.appendChild(this.infoBoxEl);

    const floatToggle = document.getElementById('btn-info-float-toggle');
    if (floatToggle) {
      floatToggle.addEventListener('click', () => {
        this.floatingEnabled = !this.floatingEnabled;
        floatToggle.textContent = this.floatingEnabled ? 'FLOAT: ON' : 'FLOAT: OFF';
        floatToggle.classList.toggle('is-active', this.floatingEnabled);
        if (!this.floatingEnabled) this.hideFloating();
      });
    }

    const closeBtn = document.getElementById('btn-info-dock-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.toggleInfoBox(false));
    }

    this._renderInfoDock(this._lastInfo);
  }

  toggleInfoBox(forceState = undefined) {
    this.infoBoxVisible = (forceState !== undefined) ? !!forceState : !this.infoBoxVisible;
    if (this.infoBoxEl) {
      this.infoBoxEl.classList.toggle('open', this.infoBoxVisible);
    }
    const btn = document.getElementById('btn-toggle-help-panel');
    if (btn) {
      btn.classList.toggle('is-active', this.infoBoxVisible);
    }
    if (this.infoBoxVisible) {
      this._renderInfoDock(this._lastInfo);
    }
  }

  _renderInfoDock(info) {
    const body = document.getElementById('info-dock-body');
    if (!body || !info) return;
    body.innerHTML = `
      <div class="apc-tip-title">${this._escape(info.title)}</div>
      <div class="apc-tip-shortcut">${this._escape(info.shortcut)}</div>
      ${info.desc && info.desc !== info.shortcut ? `<div class="apc-tip-desc">${this._escape(info.desc)}</div>` : ''}
      <div class="apc-tip-svg-wrap">${ApcHardwareHelp.renderApcSvg(info.controls, false)}</div>
    `;
  }

  _showFloating(info, clientX, clientY) {
    if (!this.floatingEl || !this.floatingEnabled || !info) return;

    this.floatingEl.innerHTML = `
      <div class="apc-tip-head">
        <span class="apc-tip-badge">APC KEY 25</span>
        <span class="apc-tip-title">${this._escape(info.title)}</span>
      </div>
      <div class="apc-tip-shortcut">${this._escape(info.shortcut)}</div>
      ${info.desc && info.desc !== info.shortcut ? `<div class="apc-tip-desc">${this._escape(info.desc)}</div>` : ''}
      <div class="apc-tip-svg-wrap">${ApcHardwareHelp.renderApcSvg(info.controls, true)}</div>
    `;

    this.floatingEl.classList.add('visible');
    this._positionFloating(clientX, clientY);
  }

  _positionFloating(clientX, clientY) {
    if (!this.floatingEl || !this.floatingEl.classList.contains('visible')) return;
    const rect = this.floatingEl.getBoundingClientRect();
    const pad = 14;
    let left = clientX + pad;
    let top = clientY + pad;

    if (left + rect.width > window.innerWidth - 8) {
      left = Math.max(8, clientX - rect.width - pad);
    }
    if (top + rect.height > window.innerHeight - 8) {
      top = Math.max(8, clientY - rect.height - pad);
    }

    this.floatingEl.style.left = `${Math.round(left)}px`;
    this.floatingEl.style.top = `${Math.round(top)}px`;
  }

  hideFloating() {
    if (this._hoverTimer) {
      clearTimeout(this._hoverTimer);
      this._hoverTimer = null;
    }
    if (this.floatingEl) {
      this.floatingEl.classList.remove('visible');
    }
  }

  _attachHoverListeners() {
    const selector = '[data-apc-hint], [data-apc-ctrl], [title], .step-btn-16, .apc-pad, .scene-btn, .macro-knob, .piano-key, .strip-btn, .strip-fader, .strip-jam-btn, .fx-badge';

    document.addEventListener('mouseover', (e) => {
      if (!e.target || typeof e.target.closest !== 'function') return;
      // Don't float tooltips over modals or the walkthrough card itself
      if (e.target.closest('.modal-overlay.open') || e.target.closest('.walkthrough-card') || e.target.closest('.apc-info-view-dock')) {
        this.hideFloating();
        return;
      }

      const target = e.target.closest(selector);
      if (!target || target === this._currentTarget) return;
      this._currentTarget = target;

      // Suppress native browser title popup so our visual APC SVG tooltip isn't covered
      const nativeTitle = target.getAttribute('title');
      if (nativeTitle) {
        target.dataset.nativeTitle = nativeTitle;
        target.removeAttribute('title');
      }

      const info = this.resolveControlInfo(target);
      if (!info) {
        this.hideFloating();
        return;
      }

      this._lastInfo = info;
      if (this.infoBoxVisible) {
        this._renderInfoDock(info);
      }

      if (this._hoverTimer) clearTimeout(this._hoverTimer);
      const cx = e.clientX;
      const cy = e.clientY;
      this._hoverTimer = setTimeout(() => {
        if (this._currentTarget === target) {
          this._showFloating(info, cx, cy);
        }
      }, 110);
    });

    document.addEventListener('mousemove', (e) => {
      if (this.floatingEl && this.floatingEl.classList.contains('visible')) {
        this._positionFloating(e.clientX, e.clientY);
      }
    });

    document.addEventListener('mouseout', (e) => {
      if (!e.target || typeof e.target.closest !== 'function') return;
      const target = e.target.closest(selector);
      if (!target) return;
      if (e.relatedTarget && target.contains(e.relatedTarget)) return;
      if (target === this._currentTarget) {
        this._currentTarget = null;
        this.hideFloating();
      }
    });

    document.addEventListener('mousedown', () => {
      this.hideFloating();
    });
  }

  _escape(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
