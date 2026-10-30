/**
 * Open-KO: KeyboardView
 * Renders the 25-key tactile keyboard matching Akai APC Key 25.
 * Adapts to Melodic mode (chromatic note names) and Drum mode (Slices 1 to 16).
 */

export class KeyboardView {
  constructor(container, callbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;
    // callbacks: onNoteOn(note, velocity), onNoteOff(note)

    this.baseOctave = 3; // C3 (48)
    this.activeSlotType = 'melodic'; // 'melodic' or 'drum'
    this.keyElements = new Map(); // midiNote -> element
    this.activeKeys = new Set();

    this._buildDom();
    this._attachKeyListeners();
  }

  setMode(slotType) {
    this.activeSlotType = slotType;
    this._updateKeyLabels();
  }

  setOctave(octave) {
    this.baseOctave = Math.max(1, Math.min(6, octave));
    this._buildDom();
  }

  _buildDom() {
    this.container.innerHTML = `
      <div class="keyboard-controls">
        <div class="octave-group">
          <button class="kbd-btn oct-down" title="APC: Physical OCTAVE DOWN button on APC Key 25" data-apc-hint="APC: Physical OCTAVE DOWN button on APC Key 25 MK1">OCT -</button>
          <span class="oct-display">OCT: C${this.baseOctave}</span>
          <button class="kbd-btn oct-up" title="APC: Physical OCTAVE UP button on APC Key 25" data-apc-hint="APC: Physical OCTAVE UP button on APC Key 25 MK1">OCT +</button>
        </div>
        <div class="kbd-mode-badge">${this.activeSlotType === 'melodic' ? 'CHROMATIC KEYS' : 'SLICES 1-16 TRIGGER'}</div>
      </div>
      <div class="piano-bed"></div>
    `;

    const pianoBed = this.container.querySelector('.piano-bed');
    const octDownBtn = this.container.querySelector('.oct-down');
    const octUpBtn = this.container.querySelector('.oct-up');

    octDownBtn.addEventListener('click', () => {
      this.baseOctave = Math.max(1, this.baseOctave - 1);
      this._buildDom();
    });
    octUpBtn.addEventListener('click', () => {
      this.baseOctave = Math.min(6, this.baseOctave + 1);
      this._buildDom();
    });

    const startNote = this.baseOctave * 12 + 12; // e.g. Octave 3 -> 48 (C3)
    this.keyElements.clear();

    // 25 Keys: 15 white keys and 10 black keys
    // White key intervals in semitones: C, D, E, F, G, A, B (0, 2, 4, 5, 7, 9, 11)
    const isBlack = [false, true, false, true, false, false, true, false, true, false, true, false];
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    // Map computer keyboard keys
    const computerKeys = ['a', 'w', 's', 'e', 'd', 'f', 't', 'g', 'y', 'h', 'u', 'j', 'k', 'o', 'l', 'p'];

    for (let i = 0; i < 25; i++) {
      const midiNote = startNote + i;
      const semitone = i % 12;
      const black = isBlack[semitone];
      const keyDiv = document.createElement('div');
      keyDiv.className = `piano-key ${black ? 'black-key' : 'white-key'}`;
      keyDiv.dataset.note = midiNote;
      keyDiv.dataset.keyIndex = i;

      const compKey = i < computerKeys.length ? computerKeys[i].toUpperCase() : '';
      keyDiv.innerHTML = `
        <span class="key-label"></span>
        <span class="key-shortcut">${compKey}</span>
      `;

      pianoBed.appendChild(keyDiv);
      this.keyElements.set(midiNote, keyDiv);

      // Mouse & touch events
      keyDiv.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.pressKey(midiNote, 100);
      });
      keyDiv.addEventListener('mouseup', () => this.releaseKey(midiNote));
      keyDiv.addEventListener('mouseleave', () => this.releaseKey(midiNote));

      keyDiv.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.pressKey(midiNote, 100);
      }, { passive: false });
      keyDiv.addEventListener('touchend', () => this.releaseKey(midiNote));
    }

    this._updateKeyLabels();
  }

  _updateKeyLabels() {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    this.keyElements.forEach((el, midiNote) => {
      const labelSpan = el.querySelector('.key-label');
      const keyIndex = parseInt(el.dataset.keyIndex, 10);

      if (this.activeSlotType === 'melodic') {
        const noteName = noteNames[midiNote % 12];
        const oct = Math.floor(midiNote / 12) - 1;
        labelSpan.textContent = `${noteName}${oct}`;
        el.title = `APC: Physical Piano Key (Ch 2) -> Play Chromatic Note ${noteName}${oct} (MIDI ${midiNote})`;
        el.dataset.apcHint = `APC: Keybed (Ch 2) -> Play ${noteName}${oct} (Note ${midiNote})`;
      } else {
        // Drum Mode: keys 0-15 trigger slices 1-16
        if (keyIndex < 16) {
          labelSpan.textContent = `S${keyIndex + 1}`;
          el.title = `APC: Physical Piano Key ${keyIndex + 1} (Ch 2) -> Triggers Drum Slice ${keyIndex + 1}`;
          el.dataset.apcHint = `APC: Keybed (Ch 2) Key ${keyIndex + 1} -> Drum Slice ${keyIndex + 1}`;
        } else {
          labelSpan.textContent = '-';
          el.title = `APC: Physical Piano Key ${keyIndex + 1} (Ch 2)`;
          el.dataset.apcHint = `APC: Keybed (Ch 2) Key ${keyIndex + 1}`;
        }
      }
    });

    const badge = this.container.querySelector('.kbd-mode-badge');
    if (badge) {
      badge.textContent = this.activeSlotType === 'melodic' ? 'MELODIC: CHROMATIC KEYS' : 'DRUM: SLICES 1-16 TRIGGER';
    }
  }

  _attachKeyListeners() {
    const computerKeyMap = {
      'a': 0, 'w': 1, 's': 2, 'e': 3, 'd': 4, 'f': 5, 't': 6,
      'g': 7, 'y': 8, 'h': 9, 'u': 10, 'j': 11, 'k': 12, 'o': 13,
      'l': 14, 'p': 15
    };

    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      const key = e.key.toLowerCase();
      if (computerKeyMap[key] !== undefined && !e.repeat) {
        const keyIndex = computerKeyMap[key];
        const startNote = this.baseOctave * 12 + 12;
        this.pressKey(startNote + keyIndex, 100);
      }
    });

    window.addEventListener('keyup', (e) => {
      const key = e.key.toLowerCase();
      if (computerKeyMap[key] !== undefined) {
        const keyIndex = computerKeyMap[key];
        const startNote = this.baseOctave * 12 + 12;
        this.releaseKey(startNote + keyIndex);
      }
    });
  }

  pressKey(midiNote, velocity = 100) {
    if (this.activeKeys.has(midiNote)) return;
    this.activeKeys.add(midiNote);

    const el = this.keyElements.get(midiNote);
    if (el) el.classList.add('key-active');

    if (this.callbacks.onNoteOn) {
      this.callbacks.onNoteOn(midiNote, velocity);
    }
  }

  releaseKey(midiNote) {
    if (!this.activeKeys.has(midiNote)) return;
    this.activeKeys.delete(midiNote);

    const el = this.keyElements.get(midiNote);
    if (el) el.classList.remove('key-active');

    if (this.callbacks.onNoteOff) {
      this.callbacks.onNoteOff(midiNote);
    }
  }

  highlightExternalNote(midiNote, isActive) {
    const el = this.keyElements.get(midiNote);
    if (el) {
      if (isActive) el.classList.add('key-active');
      else el.classList.remove('key-active');
    }
  }
}
