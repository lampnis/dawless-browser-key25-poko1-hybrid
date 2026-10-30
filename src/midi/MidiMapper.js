/**
 * Open-KO: MidiMapper
 * Authoritative Akai APC Key 25 Mk1 Hardware Profile & Calibration Engine.
 * Supports standard factory layouts and user-calibrated mappings stored in localStorage.
 */

import {
  APC_MK1_LEDS,
  APC_SCENE_NOTES,
  APC_BUTTON_NOTES,
  APC_TRACK_BUTTON_NOTES,
  GRID_LAYOUT_MODES
} from './ApcConstants.js';

export class MidiMapper {
  constructor(layoutMode = GRID_LAYOUT_MODES.TOP_DOWN) {
    this.storageKey = 'open_ko_midi_calibration_v1';
    this.layoutMode = layoutMode;

    // Default APC Key 25 Mk1 Factory Profiles
    this.defaultProfiles = {
      top_down: {
        name: 'APC Key 25 Mk1 (Top-Down Sequencer)',
        // Row 0 (top of visual grid): Hardware notes 32-39
        // Row 1: Hardware notes 24-31
        // Row 2: Hardware notes 16-23
        // Row 3: Hardware notes 8-15
        // Row 4 (bottom): Hardware notes 0-7
        gridRows: [
          [32, 33, 34, 35, 36, 37, 38, 39],
          [24, 25, 26, 27, 28, 29, 30, 31],
          [16, 17, 18, 19, 20, 21, 22, 23],
          [8,  9,  10, 11, 12, 13, 14, 15],
          [0,  1,  2,  3,  4,  5,  6,  7]
        ],
        knobCCs: [48, 49, 50, 51, 52, 53, 54, 55],
        sceneNotes: {
          scene1: 82,
          scene2: 83,
          scene3: 84,
          scene4: 85,
          scene5: 86,
          stopAll: 81
        },
        transportNotes: {
          playPause: 91,
          rec: 93,
          stopAll: 81
        },
        shiftNotes: [98], // Physical SHIFT button on APC Key 25 Mk1 is Note 98 only (Note 86 is Scene 5)
        sustainNotes: [], // Sustain is strictly CC 64, NOT Note 64 (Note 64 is Track 1 Up button)
        trackNotes: [64, 65, 66, 67, 68, 69, 70, 71]
      },
      bottom_up: {
        name: 'APC Key 25 Mk1 (Bottom-Up Sequencer)',
        gridRows: [
          [0,  1,  2,  3,  4,  5,  6,  7],
          [8,  9,  10, 11, 12, 13, 14, 15],
          [16, 17, 18, 19, 20, 21, 22, 23],
          [24, 25, 26, 27, 28, 29, 30, 31],
          [32, 33, 34, 35, 36, 37, 38, 39]
        ],
        knobCCs: [48, 49, 50, 51, 52, 53, 54, 55],
        sceneNotes: {
          scene1: 82,
          scene2: 83,
          scene3: 84,
          scene4: 85,
          scene5: 86,
          stopAll: 81
        },
        transportNotes: {
          playPause: 91,
          rec: 93,
          stopAll: 81
        },
        shiftNotes: [98], // Physical SHIFT button on APC Key 25 Mk1 is Note 98 only (Note 86 is Scene 5)
        sustainNotes: [], // Sustain is strictly CC 64
        trackNotes: [64, 65, 66, 67, 68, 69, 70, 71]
      }
    };

    this.activeProfile = this.loadCustomProfile() || this.defaultProfiles[this.layoutMode] || this.defaultProfiles.top_down;
  }

  setLayoutMode(mode) {
    this.layoutMode = mode;
    this.activeProfile = this.defaultProfiles[mode] || this.defaultProfiles.top_down;
  }

  loadCustomProfile() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.getItem === 'function') {
        const data = localStorage.getItem(this.storageKey);
        if (data) {
          const profile = JSON.parse(data);
          // Sanity check: Discard any corrupt or legacy profile that has incorrect shift notes (e.g. Note 86)
          if (profile && Array.isArray(profile.gridRows) && profile.gridRows.length === 5 &&
              profile.shiftNotes && profile.shiftNotes.includes(98) && !profile.shiftNotes.includes(86)) {
            return profile;
          } else {
            console.warn('[MidiMapper] Discarded invalid or corrupted custom profile from storage.');
            localStorage.removeItem(this.storageKey);
          }
        }
      }
    } catch (e) {
      console.warn('Could not read custom MIDI profile:', e);
    }
    return null;
  }

  saveCustomProfile(profile) {
    try {
      // Ensure shift notes strictly point to physical Shift (Note 98) on APC Key 25 Mk1
      profile.shiftNotes = [98];
      if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.setItem === 'function') {
        localStorage.setItem(this.storageKey, JSON.stringify(profile));
      }
      this.activeProfile = profile;
      return true;
    } catch (e) {
      console.error('Failed to save MIDI calibration:', e);
      return false;
    }
  }

  resetToDefault(mode = 'top_down') {
    this.setLayoutMode(mode);
    try {
      if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.removeItem === 'function') {
        localStorage.removeItem(this.storageKey);
      }
    } catch (e) {}
    return this.activeProfile;
  }

  getNoteCoordinates(note) {
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 8; c++) {
        if (this.activeProfile.gridRows[r][c] === note) {
          return { row: r, col: c, note };
        }
      }
    }
    return null;
  }

  getNoteForCell(row, col) {
    if (row >= 0 && row < 5 && col >= 0 && col < 8) {
      return this.activeProfile.gridRows[row][col];
    }
    return -1;
  }

  isShiftNote(note) {
    return this.activeProfile.shiftNotes.includes(note);
  }

  isSustain(noteOrCC) {
    return this.activeProfile.sustainNotes.includes(noteOrCC);
  }

  getKnobIndex(cc) {
    return this.activeProfile.knobCCs.indexOf(cc);
  }
}
