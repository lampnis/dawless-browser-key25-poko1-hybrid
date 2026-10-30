/**
 * Open-KO: Akai APC Key 25 (Mk1) Hardware Protocols & Mapping Constants
 * Enables 100% standalone hardware control without touching a computer keyboard or mouse.
 */

// Akai APC Key 25 Mk1 Hardware Channel Split:
// - Channel 1 (0x90/0x80/0xB0): Matrix pads (0-39), Knobs (CC 48-55), Scenes (81-86), Track buttons (64-71), Shift (98), Sustain (CC 64)
// - Channel 2 (0x91/0x81): 25-Key Keybed (Piano keyboard notes 48-72 default or transposed)
export const APC_MIDI_CHANNELS = {
  CONTROLS_AND_PADS: 1, // Channel 1
  PIANO_KEYBED: 2       // Channel 2
};

// 3 Operational Workflow Modes
export const OPERATIONAL_MODES = {
  SAMPLE: 'sample',           // Recording, slicing, and editing samples (PO-33 workflow)
  PATTERN: 'pattern',         // Sequencing, pattern chaining, track muting, song structure
  PERFORMANCE: 'performance'  // Ableton Live Session View clip/scene launcher
};

// Akai APC Key 25 Mk1 LED Velocity Values (Channel 1, Note On)
export const APC_MK1_LEDS = {
  OFF: 0,
  GREEN: 1,
  GREEN_BLINK: 2,
  RED: 3,
  RED_BLINK: 4,
  AMBER: 5,
  AMBER_BLINK: 6
};

// Akai APC Key 25 Mk2 LED Velocity Values (RGB Palette)
export const APC_MK2_LEDS = {
  OFF: 0,
  GREEN: 21,
  GREEN_DIM: 23,
  GREEN_BLINK: 22,
  RED: 3,
  RED_DIM: 5,
  RED_BLINK: 4,
  AMBER: 9,
  AMBER_DIM: 11,
  AMBER_BLINK: 10,
  YELLOW: 13,
  CYAN: 37,
  BLUE: 45,
  WHITE: 1
};

// Continuous CC numbers on APC Key 25 Mk1
export const APC_KNOB_CCS_MK1 = {
  K1_START: 48,
  K2_END: 49,
  K3_PITCH: 50,
  K4_FILTER: 51,
  K5_RES: 52,
  K6_DECAY: 53,
  K7_FX_SEND: 54,
  K8_COMP_VOL: 55
};

// Alternative generic CCs on some APC Key 25 Mk2 modes
export const APC_KNOB_CCS_MK2 = {
  K1_START: 30,
  K2_END: 31,
  K3_PITCH: 32,
  K4_FILTER: 33,
  K5_RES: 34,
  K6_DECAY: 35,
  K7_FX_SEND: 36,
  K8_COMP_VOL: 37
};

// Hardware Dedicated Buttons on APC Key 25 Mk1
export const APC_BUTTON_NOTES = {
  PLAY_PAUSE: 91,     // Physical PLAY/PAUSE button (Note 91 / 0x5B)
  REC: 93,            // Physical REC button (Note 93 / 0x5D)
  STOP_ALL: 81,       // Physical STOP ALL CLIPS button (Note 81 / 0x51)
  SHIFT_MK1: 98,      // Physical SHIFT button on APC Key 25 Mk1 (Note 98 / 0x62)
  SUSTAIN_CC: 64      // Physical round SUSTAIN button sends CC 64 (value 127 on press, 0 on release)
};

// Bottom Row Track Control buttons on APC Key 25 Mk1 (Notes 64 to 71)
// 64: Up Arrow [▲] (Track 1)
// 65: Down Arrow [▼] (Track 2)
// 66: Left Arrow [◄] (Track 3)
// 67: Right Arrow [►] (Track 4)
// 68: VOLUME (Track 5)
// 69: PAN (Track 6)
// 70: SEND (Track 7)
// 71: DEVICE (Track 8)
export const APC_TRACK_BUTTON_NOTES = [64, 65, 66, 67, 68, 69, 70, 71];

// Scene Launch MIDI Note numbers (Right vertical column, Notes 82 to 86)
// Order corresponds directly to Modes 1, 2, 3:
// Shift + Scene 1: Mode 1 = SAMPLE MODE
// Shift + Scene 2: Mode 2 = PATTERN MODE
// Shift + Scene 3: Mode 3 = PERFORMANCE MODE
export const APC_SCENE_NOTES = {
  SCENE_1: 82,        // Scene 1 (Sample Mode when Shift held)
  SCENE_1_PLAY: 82,   // Alias for test & transport mapping
  SCENE_2: 83,        // Scene 2 (Pattern Mode when Shift held)
  SCENE_2_REC: 83,    // Alias for test & transport mapping
  SCENE_3: 84,        // Scene 3 (Performance Mode when Shift held)
  SCENE_4: 85,        // Scene 4 (Metronome / Tap Tempo)
  SCENE_4_METRO: 85,  // Alias for test & metronome mapping
  SCENE_5: 86,        // Scene 5 (Next Pattern / Arrange block)
  STOP_ALL: 81        // Stop All Clips
};

// Grid physical note range
export const APC_GRID = {
  MIN_NOTE: 0,
  MAX_NOTE: 39,
  TOTAL_PADS: 40,
  COLUMNS: 8,
  ROWS: 5
};

export const GRID_LAYOUT_MODES = {
  TOP_DOWN: 'top_down',
  BOTTOM_UP: 'bottom_up'
};

export const PUNCH_IN_FX_NAMES = [
  '1/8 Stutter',
  '1/16 Beat Roll',
  '12-Bit SP-1200',
  'Vinyl Brake',
  'HPF Sweep',
  'LPF Sub-Drop',
  'Sidechain Pump',
  'Dub Space Echo'
];
