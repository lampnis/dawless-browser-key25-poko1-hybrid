# Open-KO — Hardware-First Browser Sampler & 128th-Note Sequencer for Akai APC Key 25

```
+---------------------------------------------------------------------------------+
|  [ 8x5 PAD GRID (40 Tri-Color Pads, Ch 1) ]                      [SCENE LAUNCH] |
|  Row 1 (32-39): Steps  1-8  (Shift: Clear/Dup/Shift/Human/Swg/2x/0.5x) | [SMPL] |
|  Row 2 (24-31): Steps  9-16 (Shift: RecMode/Zoom/Nudge-/+/SC/Duck/Src) | [PTRN] |
|  Row 3 (16-23): Patterns 1-8 Select & Chain (Sample Mode: Slices 1-8)  | [PERF] |
|  Row 4 ( 8-15): Track 1-8 Mutes (Shift: Track 9-16 Mutes)              | [METR] |
|  Row 5 ( 0- 7): 8 Punch-In FX (Stutter, Roll, SP-1200, Brake, Pump...) | [NEXT] |
+---------------------------------------------------------------------------------+
|  [ 8 CONTINUOUS MACRO KNOBS (CC 48-55) — TRACK / MASTER / SHIFT BANKS ]         |
|  Track : 1:Start | 2:End   | 3:Pitch | 4:PO Filt | 5:Res Q | 6:Decay | 7:Dly |8:V|
|  Master: 1:BPM   | 2:Swing | 3:Tune  | 4:M-Filt  | 5:M-Q   | 6:SpcTm | 7:SCRl|8:D|
|  Shift : 1:Zoom8X| 2:Pg1-8 | 3:Nudge | 4:M-Filt  | 5:Swing | 6:Strch | 7:Fdbk|8:B|
+---------------------------------------------------------------------------------+
|  [ DEDICATED TRANSPORT & BOTTOM TRACK / PO-33 MODIFIERS (CHANNEL 1) ]           |
|  Scene 1 / Play (91) | Scene 2 / Rec (93): Freeform 128th Auto-BPM | Stop (81)  |
|  ▲/▼ (64/65): Track/Page (Shift: Preset) | Hold ◄ (66): PATTERN | Hold ►: SOUND |
+---------------------------------------------------------------------------------+
|  [ 25-KEY VELOCITY KEYBED (CHANNEL 2 — 100% ISOLATED) ]                         |
|  Plays active Melodic Slot polyphonically, OR triggers all 16 Drum Slices       |
+---------------------------------------------------------------------------------+
```

**Open-KO** is a standalone, browser-based groovebox and audio workstation fusing the raw beatmaking workflow of the **Teenage Engineering PO-33 K.O!**, **EP-133 K.O. II**, and **E-mu SP-1200** with an **FL Studio 21-inspired Channel Rack / Playlist / Insert Mixer UI** — engineered specifically for **100% hands-on hardware control** from the **Akai APC Key 25 (Mk1 & Mk2)**.

---

## Key Features

### 1. Freeform First-Loop Auto-BPM Recording & 128th-Note Micro-Timing
- **Freeform First-Loop Mode (Default, Toggleable):** Arm `REC` (`Scene 2` or `Note 93`) and strike your first chop or drum pad — the loop timer starts on your very first hit (`t = 0`). Tap `REC` again on your downbeat to seal the loop: Open-KO automatically detects the bar count (`1`, `2`, or `4` bars) and **locks the project BPM** around a natural lo-fi / boom-bap groove, laying every hit onto a **128th-note micro-timing grid** (`-4` to `+3` sub-ticks per 16th step) with all your natural swing intact.
- **Quantized Overdub Mode:** Toggle at any time (`Shift + Pad 9 / Note 24` or `Shift + PLAY / Note 91`) to overdub layered drum hits and 6-voice polyphonic chords onto a running loop while still capturing 128th-note micro-timing offsets.
- **Step Inspector & Seamless 128th-Note Nudging:** Hold any active step pad on the APC Key 25 (without deleting it!) to inspect its notes, velocity, P-Locks, and 128th sub-tick offset (`-4/128` to `+3/128`). Turn **`Shift + Knob 3` (CC 50)** while holding a step — or tap **`Shift + Pad 11 / 12` (Notes 26 / 27)** — to nudge hits earlier or later across the 128th-note pocket, seamlessly crossing step and page boundaries.

### 2. True 8X Pattern Zoom (`1X` 16 $\rightarrow$ `2X` 32 $\rightarrow$ `4X` 64 $\rightarrow$ `8X` 128 Steps)
- **Canonical 128th-Tick Bijection:** Zoom between **1X (16th notes)**, **2X (32nd notes, 2 pages)**, **4X (64th notes, 4 pages)**, and **8X (128th notes, 8 pages `P1`–`P8`)** via **`Shift + Knob 1` (CC 48)** or **`Shift + Pad 10` (Note 25)**.
- **Zero Tempo Alteration:** Zooming acts strictly as a high-resolution viewport into the 4/4 measure — it **never** changes your playback speed, and zooming out (`8X` $\rightarrow$ `1X`) preserves exact 128th-note offsets via sub-tick `microTiming`.

### 3. Sidechain Ducking Compressor (Live & Offline WAV Export)
- **Dedicated Sidechain Bus:** Routes melodic/ducked tracks through `sidechainBus -> sidechainGain -> voicesBus` while trigger/percussion tracks pass punchy and untouched through `unduckedBus`.
- **100% Hardware Controllable:**
  - **`Shift + Pad 13` (Note 28):** Master Sidechain Ducking ON/OFF.
  - **`Shift + Pad 14` (Note 29):** Toggle active track `D` (Ducked vs Dry bypass).
  - **`Shift + Pad 15` (Note 30):** Assign active track as the `SC` Sidechain Trigger Source (defaults to Track 9 Kick).
  - **Master Knob 7 (CC 54):** Sidechain Release (`40ms` tight house pump to `500ms` deep lo-fi swell).
  - **Master Knob 8 (CC 55):** Sidechain Duck Depth (`0%` to `100%`) + Master Glue Compressor Gain.
- **Offline Arrangement Rendering:** `[⬇ EXPORT WAV]` renders full sidechain pumping, groove swing, and 128th-note micro-timing at 100x real-time speed into a studio-grade 16-bit 44.1 kHz stereo WAV file.

### 4. Overhauled 8-Bank Punch-In Performance FX (Row 5 Pads, Notes 0–7)
Momentary velocity-responsive master bus performance effects engineered with click-free slewing and parallel resonant filter routing:
1. **`1/8 Stutter`** — Tempo-synced eighth-note buffer repeat gate
2. **`1/16 Beat Roll`** — Tight sixteenth-note snare/chop roll
3. **`12-Bit SP-1200`** — Vintage 26 kHz / 12-bit crunch ring-mod & waveshaper grit
4. **`Vinyl Brake`** — Turntable platter motor power-down pitch drop & recovery spin-up
5. **`HPF Sweep`** — Parallel resonant high-pass DJ build sweep
6. **`LPF Sub-Drop`** — Deep underwater low-pass resonant sub-bass drop
7. **`Sidechain Pump`** — Instant rhythmic quarter-note French-house ducking pump
8. **`Dub Space Echo`** — Warm Butterworth-filtered ($Q = 0.707$, 1600 Hz) soft-saturated tape dub delay with zero runaway screech

### 5. Expanded 60-Preset Sound Library & Dual Stretching Modes
- **46 Synthesized Melodic Instruments:** Including *Concert Grand Piano* (5.5s inharmonic 3-string acoustic model), *Rhodes Stage 73 (Long)*, *Dusty Jazz Rhodes Chops*, *Tape-Saturated Vinyl Flute*, *808 Slide Sub Bass*, *Symphonic Strings*, *Cathedral Pipe Organ*, *Lush Choir Aah*, *Upright Acoustic Bass*, *Spanish Nylon Guitar*, *Solina String Ensemble*, *Prophet Analog Brass*, *Roland Jupiter-8 Poly Brass*, *Mellotron 1967 Tape Flute*, and more.
- **14 Sliced 16-Hit Drum Kits (224 Isolated Drum Hits):** Including *Dirty Boom-Bap SP-1200 Kit*, *Memphis 808 Drift Kit*, *Lo-Fi Hip-Hop Dust Kit*, *PO-33 Beat Kit*, *TR-909 House Kit*, *TR-808 Classic Kit*, *LinnDrum LM-2 Classic Kit*, *Studio Acoustic Drum Kit*, *Jungle & D&B Break Kit*, and *Trap 808 Mega Kit* — synthesized with a 15ms Hann tail fade + 4ms playback slice guard for **zero neighboring-slice bleed**.
- **Dual Sample Stretch Modes (`Shift + Knob 6` / CC 53):**
  - **`PITCH ONLY` (Default):** Granular overlap-add constant-duration engine — playing higher octaves raises pitch **without** shortening sample length!
  - **`SQUEEZE`:** Classic vintage sampler varispeed resampling ($R = 2^{\Delta/12}$).

### 6. FL Studio 21-Inspired Dark UI with APC Key 25 Hardware Tooltips
- **Channel Rack Two-Tone Step Chicklets:** Alternating 4-step slate/plum beat groups with emerald active indicators, cyan P-Lock dots, and top-right `±128th` micro-timing badges.
- **Playlist Pattern Clips & 16-Track Insert Mixer:** Visual song chain blocks, per-track VU/voice LEDs, `[M]` Mute, `[S]` Solo, `[D]` Sidechain Duck / `[SC]` Trigger badges, and live Sidechain Ducking + Master Glue GR meters.
- **Instant Hardware Hover Tooltips:** Hovering over *any* UI control immediately displays its exact physical **Akai APC Key 25 Mk1** shortcut on the amber LCD bar (`[APC] ...`) and in native tooltips.
- **Ultra-Minimalist PO-33 Retro LCD Mode (`Shift + Sustain`):** Collapses into a pocket-operator segment display with animated punching K.O! Boxer.

---

## Quickstart

### 1. Launch the Workstation
```bash
npm start
# or for Vite HMR development:
npm run dev
```
Open **`http://localhost:3000/`** (or the Vite dev URL) in **Google Chrome, Brave, or Microsoft Edge** (Web MIDI compatible browsers).

### 2. Plug In Your Akai APC Key 25
1. Connect your **Akai APC Key 25 (Mk1 or Mk2)** and optional USB audio interface (e.g., **PreSonus AudioBox USB 96**).
2. Open-KO automatically detects the controller, transmits the APC Key 25 Mk1 Ableton Live Mode SysEx handshake, and illuminates the 40 tri-color pad LEDs.
3. *(Tip: If shared USB ground causes LED PWM whine in analog headphones, click **`⚡ LED: ECO (SILENT)`** in the top bar to shed 90% of background LED current).*

---

## Hardware Mapping Matrix (Akai APC Key 25 Mk1)

### 8x5 Matrix Pads (Channel 1, Notes 0–39, Top-Down Default)

| Row | Hardware Notes | Pattern Mode | `SHIFT` + Pad (Pattern Mode) | Sample Mode | Performance Mode |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Row 1 (Top)** | Notes `32–39` | Steps `1–8` (Hold = Inspect/P-Lock) | `Clear`, `Dup`, `Shift ◄`, `Shift ►`, `Humanize`, `Swing`, `2x BPM`, `0.5x BPM` | Melodic Slots `1–8` | Scene 1 Clips `1–8` |
| **Row 2** | Notes `24–31` | Steps `9–16` (Hold = Inspect/P-Lock) | `Rec Mode`, `Cycle Zoom 1X-8X`, `Nudge -1/128`, `Nudge +1/128`, `SC ON/OFF`, `Track Duck D`, `Set SC Src`, `Follow` | Drum Slots `9–16` | Scene 2 Clips `1–8` |
| **Row 3** | Notes `16–23` | Select Pattern `1–8` | Append Pattern `1–8` to Song Chain | Trigger Slices `1–8` | Scene 3 Clips `1–8` |
| **Row 4** | Notes `8–15` | Mute Tracks `1–8` | Mute Tracks `9–16` | Trigger Slices `9–16` | Scene 4 Clips `1–8` |
| **Row 5 (Bot)** | Notes `0–7` | 8 Momentary Punch-In FX | 8 Momentary Punch-In FX | Sample Tools (`Auto-Slice`, `16-Grid`, `Rev`, `Norm`, `-12`, `+12`, `Stretch`, `Play`) | Scene 5 Clips `1–8` |

### 8 Continuous Macro Knobs (CC 48–55 — `DEVICE` Note 71 Toggles Track/Master)

| Knob | Track Bank (Default) | Master Bank (`DEVICE` / Note 71) | While Holding `SHIFT` (Note 98) |
| :--- | :--- | :--- | :--- |
| **K1 (CC 48)** | Sample Start Trim (`0–100%`) | Master Tempo (`40–220 BPM`) | **Pattern Zoom** (`1X` 16 $\leftrightarrow$ `2X` 32 $\leftrightarrow$ `4X` 64 $\leftrightarrow$ `8X` 128) |
| **K2 (CC 49)** | Sample End Trim (`0–100%`) | Master Swing (`50%–75%`) | **Page Scroll** (`P1` $\leftrightarrow$ `P8`) |
| **K3 (CC 50)** | Pitch Tune (`-24` to `+24 ST`) | Master Tune (`-12` to `+12 ST`) | **128th Step Nudge** *(while holding step)* / **Fine Tune** (`±50c`) |
| **K4 (CC 51)** | PO Dual Filter (`LPF < 64 > HPF`) | Global Master PO Dual Filter | Global Master PO Dual Filter (`LPF < 64 > HPF`) |
| **K5 (CC 52)** | Filter Resonance (`Q`) | Global Filter Resonance (`Q`) | Master Swing (`50%–75%`) |
| **K6 (CC 53)** | Amp Envelope Decay (`0.05–8.0s`) | Space Delay Echo Time | **Stretch Mode** (`PITCH ONLY` $\leftrightarrow$ `SQUEEZE`) |
| **K7 (CC 54)** | Space Delay FX Send | **Sidechain Release** (`40–500ms`) | Space Delay Feedback (`0%–68%`) |
| **K8 (CC 55)** | Track Output Level | **Sidechain Depth (`0–100%`) & Comp Vol** | Master Tempo (`40–220 BPM`) |

### Scene, Transport & Bottom Track Buttons (Channel 1) + Keybed (Channel 2)

| Control | Normal Action | With Physical `SHIFT` (Note 98) |
| :--- | :--- | :--- |
| **Scene 1 (Note 82)** | **Play / Pause** (Preserves cursor) | Switch to **Mode 1: Sample Mode** |
| **Scene 2 (Note 83)** | **Record** (Freeform 128th Auto-BPM / Overdub) | Switch to **Mode 2: Pattern Mode** |
| **Scene 3 (Note 84)** | **Auto-Slice** Active Slot into 16 Slices | Switch to **Mode 3: Performance Mode** |
| **Scene 4 (Note 85)** | **Metronome** ON/OFF | **Hardware Tap Tempo** |
| **Scene 5 (Note 86)** | **Next Pattern** / Advance | **Reset Song Chain** to Current Pattern |
| **PLAY/PAUSE (Note 91)** | **Play / Pause** | **Toggle Record Mode** (`FREEFORM` $\leftrightarrow$ `QUANTIZED`) |
| **REC (Note 93)** | **Record** (Freeform / Quantized Overdub) | **Live Sample** from Line-In / Mic |
| **STOP ALL (Note 81)** | **Stop & Reset** to Step 0, Pattern 1 | Open **Guided APC Hardware Tester** (`🧪 TEST APC`) |
| **▲ / ▼ (Notes 64–65)** | Prev / Next Track *(or Page when Zoom > 1X)* | **Cycle Factory Presets** (+1 / -1 in 60-preset catalog) |
| **◄ (Note 66)** | Prev Pattern *(Hold + Pads 1–16 = PO-33 `PATTERN` Jump/Chain)* | Cycle Groove Swing (`50%–66%`) |
| **► (Note 67)** | Next Pattern *(Hold + Pads 1–16 = PO-33 `SOUND` 1–16 Jump)* | Toggle Knob Bank (`Track` $\leftrightarrow$ `Master`) |
| **VOL/PAN/SEND (68–70)** | Mute Tracks `5, 6, 7` | Mute Tracks `13, 14, 15` |
| **DEVICE (Note 71)** | Toggle Knob Bank (`Track` $\leftrightarrow$ `Master`) | Toggle Knob Bank (`Track` $\leftrightarrow$ `Master`) |
| **Sustain (CC 64)** | Sustain Melodic Voices | Toggle **Minimal PO-33 LCD View** |
| **25 Piano Keys (Ch 2)** | Chromatic Polyphony (Slots 1–8) or Slices 1–16 (Slots 9–16) | **100% Isolated** — Always plays active sound (zero shortcuts!) |

---

## Testing, Building & Documentation

- **Run Automated Node.js Unit Test Suite (73 Tests across 12 Suites):**
  ```bash
  node tests/run-tests.js
  ```
- **Build Production Bundle (`dist/`):**
  ```bash
  npx vite build
  ```
- **Comprehensive Artist & Developer Guide:** See **[`DOCS.md`](./DOCS.md)** for full beatmaking workflows (choppy hip-hop freeform sampling, 128th-note pocket nudging, sidechain ducking setup, YouTube/Spotify tab sampling) and complete developer DSP/sequencer architecture documentation.
