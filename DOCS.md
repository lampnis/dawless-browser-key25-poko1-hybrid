# Open-KO — Comprehensive Hardware & Workstation Documentation

Welcome to **Open-KO**, a standalone browser-based audio workstation engineered to fuse the raw, tactile beatmaking workflow of the **Teenage Engineering PO-33 K.O!** and **EP-133 K.O. II** with the control surface power of the **Akai APC Key 25 (specifically Mk1)** and external USB audio interfaces (such as the **PreSonus AudioBox USB 96**).

---

## 1. Akai APC Key 25 Mk1 Hardware Architecture & MIDI Channels

The **Akai APC Key 25 Mk1** features a dedicated internal channel architecture:

```
+-----------------------------------------------------------------------------------------+
| [ MIDI CHANNEL 1: CONTROLS, MATRIX PADS & BUTTONS ]                                     |
| • 8 Macro Knobs (Continuous CC 48 to 55)                                                |
| • 40 Pad Grid (Note On/Off 0 to 39, Tri-color velocity LEDs 0-6)                        |
| • 5 Scene Launch Buttons (Notes 82, 83, 84, 85, 86)                                     |
| • Dedicated PLAY/PAUSE Button (Note 91 / 0x5B)                                          |
| • Dedicated REC Button (Note 93 / 0x5D)                                                 |
| • Stop All Clips Button (Note 81 / 0x51)                                                |
| • 8 Bottom Track Buttons (Notes 64 to 71: ▲, ▼, ◄, ►, VOLUME, PAN, SEND, DEVICE)       |
| • Shift Button (Note 98 / 0x62) & Sustain Button (CC 64)                                 |
+-----------------------------------------------------------------------------------------+
| [ MIDI CHANNEL 2: 25-KEY VELOCITY-SENSITIVE KEYBED ]                                    |
| • 25 Mini Keys transmitting on Channel 2 (Notes 48 to 72 / C3-C5 default or transposed) |
| • Octave Down / Octave Up Buttons (hardware internal pitch transposition)               |
| • Keybed is 100% isolated from Channel 1 pads and track buttons in Open-KO!             |
+-----------------------------------------------------------------------------------------+
```

### Channel Separation in Open-KO
* **Channel 2 (Piano Keybed):** Every note on Channel 2 is strictly routed to the active sound engine. In **Melodic Slots**, keys play chromatic polyphonic voices. In **Drum Slots**, the 25 physical keys cleanly trigger **16 drum slices in one-shot mode** (anchored to the keyboard's base note). Keybed notes never accidentally trigger sequencer pads or track mutes!
* **Channel 1 (Controls & Pads):** All buttons, macro knobs, pad grid steps, and transport controls operate independently on Channel 1. Channel 1 messages never accidentally trigger piano voices!

---

## 2. 100% Standalone Hardware Operation Guide (APC Key 25 MK1)

> **Pure Standalone Hardware Philosophy:**  
> **Open-KO is operable 100% using the Akai APC Key 25 Mk1 control surface alone.**  
> The computer mouse and keyboard are purely optional debugging choices. Every single menu, workflow mode, sample tool, pattern action, tap tempo, device setting, layout lookup, and test wizard is accessible directly from the physical hardware!

### Understanding the APC Key 25 Mk1 vs Mk2 Transport Reality
* **APC Key 25 Mk1 Hardware Reality:** The original Mk1 chassis does **not** feature dedicated physical Play/Pause or Record buttons. 
* **Ergonomic Open-KO Mapping:** On Mk1, **Scene 1 (Note 82)** serves as **Play / Pause**, **Scene 2 (Note 83)** serves as **Live Loop Overdub Record**, and **Stop All Clips (Note 81)** serves as **Stop & Reset to Step 0**!
* **Mk2 Compatibility:** If an APC Key 25 Mk2 is connected, dedicated buttons **Play (Note 91)** and **Record (Note 93)** work immediately and seamlessly alongside the scene buttons.

### Hardware Navigation Matrix

| Hardware Action | Normal Function (Consistent Across ALL Modes) | While Holding Physical `SHIFT` (Note 98) |
| :--- | :--- | :--- |
| **Scene 1 (Note 82)** | **Play / Pause** (Preserves arrangement playhead cursor!) | Switch to **Mode 1: Sample Mode** |
| **Scene 2 (Note 83)** | **Record** (Freeform 128th Auto-BPM Loop or Quantized Overdub) | Switch to **Mode 2: Pattern Mode** |
| **Scene 3 (Note 84)** | **Auto-Slice Drum Kit** (16 slices via transient detector) | Switch to **Mode 3: Performance Mode** |
| **Scene 4 (Note 85)** | **Metronome On/Off** | **Hardware Tap Tempo** (Tap 2–4x to set BPM) |
| **Scene 5 (Note 86)** | **Advance / Append Pattern** | **Reset Arrangement Chain** to single pattern |
| **PLAY/PAUSE (Note 91)** | **Play / Pause** (Keeps cursor position intact) | **Toggle Record Mode** (`FREEFORM` $\leftrightarrow$ `QUANTIZED`) |
| **REC (Note 93)** | **Record** (Freeform 128th Auto-BPM or Quantized Overdub) | **Live Sample** from Mic / AudioBox USB 96 |
| **Stop All (Note 81)** | **Stop & Reset** to Step 0, Pattern 1 | **Toggle Guided Hardware Tester** / Calibration |
| **▲ Arrow (Note 64)** | **Prev Track / Slot** *(or Prev Page when Zoom > 1X)* | **Next Preset Sample in Library** (60-preset catalog) |
| **▼ Arrow (Note 65)** | **Next Track / Slot** *(or Next Page when Zoom > 1X)* | **Previous Preset Sample in Library** (60-preset catalog) |
| **◄ Arrow (Note 66)** | **Prev Pattern** *(Hold + Pad 1–16 = PO-33 `PATTERN` Jump/Chain)* | **Cycle Swing** (50% $\rightarrow$ 54% $\rightarrow$ 58% $\rightarrow$ 62% $\rightarrow$ 66%) |
| **► Arrow (Note 67)** | **Next Pattern** *(Hold + Pad 1–16 = PO-33 `SOUND` 1–16 Jump)* | **Toggle Knob Bank** (`Track` $\leftrightarrow$ `Master`) |
| **VOL (Note 68)** | **Toggle Track 5 Mute** | **Toggle Track 13 Mute** |
| **PAN (Note 69)** | **Toggle Track 6 Mute** | **Toggle Track 14 Mute** |
| **SEND (Note 70)** | **Toggle Track 7 Mute** | **Toggle Track 15 Mute** |
| **DEVICE (Note 71)** | **Toggle Knob Bank** (`Track` $\leftrightarrow$ `Master`) | **Toggle Knob Bank** (`Track` $\leftrightarrow$ `Master`) |
| **Sustain (CC 64)**| **Sustain Melodic Notes** | **Toggle Minimal PO View / Debug Monitor** |
| **Octave Down / Up** | **Transpose Keybed Octave** (Internal Hardware Transpose) | **Transpose Keybed Octave** |
| **25 Piano Keys (Ch 2)** | **Play Active Sample** (Polyphonic / 16 Slices) | **Play Active Sample** (NO hidden shortcuts!) |

### Continuous Macro Knobs (CC 48–55) Hardware Matrix

Every continuous rotary knob on the APC Key 25 provides dedicated functionality across **Track Mode**, **Master Mode** (toggled via `DEVICE` / Note 71), and while holding physical **`SHIFT`** (Note 98):

| Hardware Knob | Track Mode (Normal) | Master Mode (`DEVICE` / Note 71) | While Holding `SHIFT` (Note 98) |
| :--- | :--- | :--- | :--- |
| **Knob 1 (CC 48)** | **Sample Start Trim** (0% to 100%) | **Master Tempo / BPM** (40 to 220 BPM) | **Pattern Zoom** (`1X` 16 $\leftrightarrow$ `2X` 32 $\leftrightarrow$ `4X` 64 $\leftrightarrow$ `8X` 128 steps) |
| **Knob 2 (CC 49)** | **Sample End Trim** (0% to 100%) | **Master Groove Swing** (50% to 75%) | **Pattern Page Navigation** (`P1` through `P8`) |
| **Knob 3 (CC 50)** | **Semitone Pitch** (-24 to +24 ST) | **Master Bus Tune** (-12 to +12 ST) | **128th Step Nudge** *(if holding active step)* / **Fine Tune** (-50 to +50c) |
| **Knob 4 (CC 51)** | **Track PO Dual Filter** (LPF/HPF) | **Master PO Dual Filter** (LPF/HPF) | **Global Master PO Filter Sweep** (LPF < 64 > HPF) |
| **Knob 5 (CC 52)** | **Filter Resonance Q** (0.5 to 8.0) | **Master Filter Res Q** (0.5 to 8.0) | **Master Groove Swing** (50% to 75%) |
| **Knob 6 (CC 53)** | **Amp Envelope Decay** (0.05 to 8.0s) | **Space Delay Time** (80ms to 1.2s) | **Stretch Mode Toggle** (`PITCH ONLY` $\leftrightarrow$ `SQUEEZE`) |
| **Knob 7 (CC 54)** | **Space Delay FX Send** (0% to 100%) | **Sidechain Release** (40ms to 500ms) | **Master Space Delay Feedback** (0% to 68%) |
| **Knob 8 (CC 55)** | **Track Output Level / Drive** | **Sidechain Duck Depth (0–100%) & Comp Vol** | **Master BPM / Tempo Control** (40 to 220 BPM) |

---

## 3. Artist Beatmaking Guide: Choppy Freeform Auto-BPM, 128th Pocket Nudging & Sidechain Pump

Open-KO supports **two complementary live recording modes** designed for both unquantized MPC/SP-1200 choppy hip-hop sampling and tight electronic loop overdubbing. Toggle between them anytime from hardware via **`SHIFT + Pad 9` (Note 24)** or **`SHIFT + PLAY` (Note 91)** (or click `🎯 MODE: FREEFORM (AUTO-BPM)` in the transport bar).

### Workflow A: Dirty Choppy Hip-Hop Beatmaking (`FREEFORM` First-Loop Auto-BPM — Default)
1. **Pick a Chop or Drum Kit:**
   - Select **Track 1** (*Dusty Jazz Rhodes Chops* / *Concert Grand Piano* / your own YouTube tab sample) or **Track 9** (*Dirty Boom-Bap SP-1200 Kit* via `SHIFT + ▲`).
2. **Arm Freeform Recording (`REC` / Scene 2 / Note 93):**
   - Press **`REC`**. Playback pauses and the LCD reads: `● FREEFORM ARMED (128th) // STRIKE FIRST KEY TO START LOOP!`.
   - Take your time — the clock does **not** run until you play your very first note!
3. **Perform Your Loop Freely:**
   - Strike your first key or drum chop (`t = 0.0s`). Jam your 1-bar, 2-bar, or 4-bar groove completely freely without a click track constraining your swing.
4. **Seal the Loop on the Downbeat (`REC`):**
   - Right where Beat 1 of the next loop cycle would land, tap **`REC`** again.
   - Open-KO measures your exact phrase duration, automatically detects the bar count (`1`, `2`, or `4` bars) and locks the project **BPM** around a natural ~92 BPM boom-bap/lo-fi feel, maps every hit onto the **128th-note micro-timing grid** (`-4` to `+3` sub-ticks per 16th step), and immediately launches seamless loop playback!
5. **Inspect & Nudge Notes Across the 128th-Note Pocket:**
   - **Hold down any active step pad** on Rows 0–1 of the APC Key 25 (holding an active pad inspects it *without* deleting it; only a quick tap-and-release without tweaking toggles it off).
   - Check the **Step Inspector** bar above the Channel Rack to view exact pitch/slice, velocity, P-Locks, and sub-tick badge (e.g., `+2/128` for a laid-back J Dilla snare, or `-2/128` for an urgent ghost kick).
   - While holding the step pad, turn **`SHIFT + Knob 3` (CC 50)** (or tap **`SHIFT + Pad 11 / 12`**, Notes 26/27) to slide the note backward or forward by single **128th-note increments** — seamlessly crossing step and page boundaries!
   - Or zoom into **`8X` (128 Steps, Pages `P1`–`P8`)** via **`SHIFT + Knob 1`** to see and toggle every single 128th note directly 1-to-1 on the 16 pads!

### Workflow B: Quantized Multi-Track Overdubbing (`QUANTIZED` Mode)
1. **Switch to Quantized Overdub:**
   - Once your tempo and foundational loop are locked, press **`SHIFT + Pad 9` (Note 24)** (or `SHIFT + PLAY`) to switch to `QUANTIZED` overdub mode.
2. **Layer Chords, Bass & Percussion Without Stopping:**
   - Select **Track 2** (*808 Slide Sub Bass*) or **Track 1** (*Rhodes Stage 73*).
   - Press **`REC`** while the loop plays. Play full polyphonic chords (up to 6 simultaneous voices per step) or layer open/closed hi-hats onto existing kick steps without overwriting previous drum slices.
   - Your subtle human timing nuances are still preserved within `±128th` micro-timing sub-ticks!
   - Press **`REC`** again to disarm while playback continues unbroken.

### Workflow C: Setting Up Sidechain Ducking Pump & Punch-In FX
1. **Sidechain Ducking Compressor:**
   - By default, **Track 9 (`SC` — Kick/Drum Slot 9)** triggers the sidechain envelope, and **Tracks 1–8 (`D` — Melodic Slots)** duck dynamically whenever the kick hits!
   - To make any track duck (or bypass ducking), select the track and press **`SHIFT + Pad 14` (Note 29)** (or click `[D]` on its mixer strip).
   - To assign a different track as the sidechain trigger source, select that track and press **`SHIFT + Pad 15` (Note 30)**.
   - Press **`DEVICE` (Note 71)** to enter **Master Knobs**, then dial **Knob 8 (CC 55)** for **Sidechain Duck Depth** (`0–100%`) and **Knob 7 (CC 54)** for **Sidechain Release** (`40ms` tight bounce to `500ms` deep vinyl breathe). Watch the cyan **SIDECHAIN DUCKING** meter pump in real time!
2. **Jam the 8 Overhauled Punch-In Performance FX (Row 5 Pads, Notes 0–7):**
   - Hold or tap Pads 33–40 during playback or live performance:
     - **Pad 33 (Note 0): `1/8 Stutter`** | **Pad 34 (Note 1): `1/16 Beat Roll`** | **Pad 35 (Note 2): `12-Bit SP-1200`** | **Pad 36 (Note 3): `Vinyl Brake`** | **Pad 37 (Note 4): `HPF Sweep`** | **Pad 38 (Note 5): `LPF Sub-Drop`** | **Pad 39 (Note 6): `Sidechain Pump`** | **Pad 40 (Note 7): `Dub Space Echo`**.
3. **Chain Patterns & Export Studio WAV:**
   - Hold **`◄` (Note 66)** and tap pattern pads `1 -> 1 -> 2 -> 3` to build your arrangement on the FL Studio Playlist bar, then click **`[⬇ EXPORT WAV]`** to render a 16-bit 44.1 kHz stereo master with full 128th micro-timing and sidechain pumping!

---

## 4. 16-Track Simultaneous Multitrack Mixer & Master DSP Rack

Open-KO provides **16 simultaneous independent tracks** playing in polyphony:

### 16 Simultaneous Instrument Capacity & Built-In 60-Preset Catalog:
Open-KO ships with an expansive sound library of **60 studio-crafted factory presets** (**46 Melodic Instruments** and **14 Sliced 16-Hit Drum Kits** = 224 isolated drum slices) accessible across the 16 tracks. Hold **`SHIFT + ▲`** or **`SHIFT + ▼`** on the APC Key 25 at any time to instantly cycle instruments on the active track! *(See Section 16 for the highlighted physical acoustic & boom-bap presets).*

* **Tracks 1–8 (28 Melodic Synthesizers, Keys & Acoustic Instruments):**
  1. *Rhodes Bell* (Classic FM bell electric piano with crystalline bell transient)
  2. *Wurlitzer 200A* (Warm reed electric piano with subtle 6.5 Hz tremolo and tube drive)
  3. *DX7 Crystal EP* (Lush 80s 6-operator FM crystalline keyboard)
  4. *Lo-Fi Upright* (Muffled acoustic piano with felt hammer thud and lo-fi tape noise)
  5. *808 Sub Bass* (Saturated analog sub-bass with tanh wave-shaping warmth)
  6. *Moog Saw Bass* (Dual detuned sawtooth bass through resonant 24dB ladder filter)
  7. *Acid 303 Squelch* (Resonant Roland TB-303 squelch bass with fast exponential decay)
  8. *Slap Funk Bass* (Punchy thumbed bass guitar with bright percussive pop)
  9. *Juno Warm Pad* (Detuned analog chorus saw pad with gentle attack)
  10. *Vinyl Tape Strings* (Slightly wow/fluttered 70s string machine through vinyl dust)
  11. *Ambient Shimmer* (Ethereal fifth-octave pad with soft air noise)
  12. *Kalimba Pluck* (Woody resonant African thumb piano pluck)
  13. *Toy Vibraphone* (Metallic pitched vibraphone tine with tremolo)
  14. *Pizzicato Strings* (Crisp orchestral string pluck)
  15. *Retro Lead* (Dual square/saw 80s synth lead)
  16. *Chiptune NES Square* (Authentic 8-bit Nintendo pulse wave with arpeggiation bite)
  17. *Vowel Synth* (Formant vowel vocal choir chop)
  18. *Tape Choir* (Mellotron-style analog magnetic tape choir)
  19. *Acid TB-303 Lead* (Screaming resonant sawtooth acid lead with envelope filter sweep)
  20. *Oberheim 8-Voice Brass* (Lush, fat analog polyphonic brass swell)
  21. *Fairlight CMI Flute* (Breathy 80s 8-bit digital sampler flute)
  22. *Casio CZ Synth* (Phase distortion retro video game synth lead/bass)
  23. *Mellotron 1967 Tape Flute* (Vintage magnetic tape flute with subtle flutter)
  24. *909 Deep Sub* (Punchy low tuned sine sub-bass with tube saturation)
  25. *Rosewood Marimba* (Warm, woody acoustic mallet resonance)
  26. *Caribbean Steel Pan* (Bright steel drum overtone chime)
  27. *Lo-Fi Jazz Guitar* (Warm hollowbody electric guitar chord pluck through vinyl warmth)
  28. *Synthwave Gated Bass* (Aggressive 80s retro gated analog bass)

* **Tracks 9–16 (10 Sliced 16-Hit Drum Kits):**
  1. *PO-33 Beat Kit* (Authentic pocket operator boom-bap kit: kicks, snappy snares, claps, hats, toms, laser, sub)
  2. *TR-808 Classic Kit* (Legendary analog bass drum, crispy snare, low/mid/high congas, rimshot, maracas, cowbell)
  3. *TR-909 House Kit* (Punchy house kick, high-velocity snare, open/closed hats, ride cymbal, crash)
  4. *Acoustic Break Kit* (Natural sampled funk breakbeat slices, ghost snares, dynamic ride)
  5. *Industrial Cyber Kit* (Distorted aggressive industrial hits, metallic slams, bitcrushed percs)
  6. *Glitch & Vinyl Kit* (Vinyl crackle, tape stops, record backspins, micro-chops, transient clicks)
  7. *Lo-Fi Hip-Hop Dust Kit* (Muffled vinyl kick, dusty rimshots, laid-back snare, brushed hats, tape stops)
  8. *Trap 808 Mega Kit* (Deep distorted 808 kick, tight snappy trap snare, rapid hi-hat rolls, chants)
  9. *Vintage Electro Hybrid* (Punchy 808/909 electro fusion: snappy kicks, electric claps, claves, cowbells, zaps)
  10. *Jungle & D&B Break Kit* (High-speed sliced Amen break hits, pitched ghost snares, tight hats, sub impacts)

---

## 4. Dual Knob Banks (`Track` vs. `Master`)

The APC Key 25 Mk1 provides 8 continuous macro knobs (CC 48–55). In Open-KO, you can toggle these knobs between **Track Mode** and **Master Mode** at any time by pressing **`DEVICE` (Note 71)** or **`Shift + ►` (Note 67)** on the hardware, or tapping the `[🎛 TRACK / MASTER KNOBS]` button in the top bar.

### Bank 1: Track Knobs (Per-Instrument Sound Shaping)
When in **Track Bank** (default, LED / button highlighted blue), the 8 knobs sculpt the currently selected instrument slot:
* **Knob 1 (CC 48): Trim Start** — Adjusts the sample start marker (0.0 to 1.0).
* **Knob 2 (CC 49): Trim End** — Adjusts the sample end / loop boundary.
* **Knob 3 (CC 50): Pitch Tuning** — Transposes pitch from -24 to +24 semitones.
* **Knob 4 (CC 51): PO Dual Filter** — Sweeps LPF (0–63), Bypass (64), or HPF (65–127).
* **Knob 5 (CC 52): Filter Resonance (Q)** — Adjusts filter resonance from 0.707 up to 14.0.
* **Knob 6 (CC 53): Decay Time** — Controls envelope release / ring-out duration (0.02s to 2.5s).
* **Knob 7 (CC 54): Space Delay Send** — Sends track audio into the master ping-pong delay.
* **Knob 8 (CC 55): Track Volume** — Adjusts individual track mixer gain (0% to 100%).

### Bank 2: Master Knobs (Global Workstation, Sidechain & FX Control)
When switched to **Master Bank** (highlighted amber), the 8 knobs control global arrangement parameters without ever writing P-Locks or modifying track steps:
* **Knob 1 (CC 48): Master BPM** — Sweeps arrangement tempo smoothly from 40 to 220 BPM.
* **Knob 2 (CC 49): Master Swing** — Adjusts groove shuffle from 50% (straight) to 75% (heavy shuffle).
* **Knob 3 (CC 50): Master Tuning** — Transposes entire song arrangement (-12 to +12 semitones).
* **Knob 4 (CC 51): Master PO Filter** — Global DJ-style filter sweep across the full stereo mix.
* **Knob 5 (CC 52): Master Filter Q** — Global filter resonance peak.
* **Knob 6 (CC 53): Space Delay Time** — Adjusts master delay echo interval (80ms to 1180ms).
* **Knob 7 (CC 54): Sidechain Release** — Adjusts sidechain ducking recovery envelope (40ms tight bounce to 500ms deep breathe).
* **Knob 8 (CC 55): Sidechain Duck Depth & Master Comp Vol** — Controls sidechain ducking depth (0% to 100%) and master glue compressor output gain.

---

## 5. Polyphonic Chord Recording & Real-Time Automation (PO-33 Parameter Motion)

### Polyphonic Chord Recording
In previous versions, playing chords during live overdub would occasionally drop notes because each step only stored a single scalar note value. Open-KO features a dedicated **Chord Burst Polyphony Engine**:
* When multiple keys are struck together on the APC Key 25 keybed within a **140ms window**, they are detected as a unified harmonic chord.
* The sequencer records all incoming voices into the step's polyphonic `notes = [...]` array (supporting up to 6 simultaneous voices per track step).
* Upon step playback or arrangement export, all chord voices are scheduled polyphonically through independent Web Audio buffer sources, ensuring rich pads, Rhodes chords, and layered stabs play back with 100% voice fidelity!

### Real-Time Parameter Automation Recording (PO-33 Live Knob Motion)
Similar to the legendary Teenage Engineering PO-33 K.O!, you can record live knob movements directly into the sequence:
1. Start playback and engage recording (**`REC` / Note 93 or Scene 2**).
2. While the loop cycles, twist any of the macro knobs (Start, End, Pitch, Filter, Decay).
3. Open-KO automatically captures your knob position and writes parameter locks into the passing steps in real time!
4. The minimal PO-33 LCD displays the `[🔒 LOCK]` icon and boxer punch animation, giving immediate tactile confirmation.
5. **Held Step Parameter Locking:** You can also hold down any step pad (Rows 1 & 2) with one finger and twist a knob to lock a specific value to that single step.

---

## 6. PO-33 PATTERN & SOUND Modifiers & Direct 16-Pad Random Access

On classic grooveboxes like the Teenage Engineering PO-33 K.O!, you jump directly to any pattern or sound by holding `PATTERN` or `SOUND` and tapping one of the 16 number pads. Open-KO translates this exact workflow to the Akai APC Key 25 Mk1:

### 1. The PO-33 `PATTERN` Button (Hold `◄` / Note 66):
* **Direct Pattern Jump:** Hold down the **`◄` arrow** (Note 66) on the APC Key 25. The 16 matrix pads (Rows 0 & 1) immediately illuminate as a low-res display representing **Patterns 1 to 16**:
  * **Solid Green:** Active pattern currently playing.
  * **Blinking Green:** Queued pattern waiting for bar downbeat transition.
  * **Solid Amber:** Patterns present in the arrangement chain.
  * **Off:** Inactive patterns.
* Tap any pad (1 to 16) while holding `◄` to jump directly to that pattern! (If playing, it queues for a seamless bar transition on Step 0).
* **Live Pattern Chaining (PO-33 Style):** Keep holding **`◄`** and tap a sequence of pads (e.g. `Pad 1` $\rightarrow$ `Pad 1` $\rightarrow$ `Pad 2` $\rightarrow$ `Pad 3`). Open-KO instantly appends them to your arrangement chain (`[1, 1, 2, 3]`), displaying the chain on the retro LCD!
* **Quick Tap:** Tapping **`◄`** quickly (without holding any pads) steps back to the previous pattern.

### 2. The PO-33 `SOUND` Button (Hold `►` / Note 67):
* **Direct Sound Slot Jump:** Hold down the **`►` arrow** (Note 67) on the APC Key 25. The 16 matrix pads (Rows 0 & 1) immediately illuminate as a low-res display representing **Sound Slots 1 to 16**:
  * **Row 0 (Pads 1 to 8):** Melodic Instruments (Rhodes Bell, 808 Sub Bass, Juno Pad, etc.) illuminated in amber/green.
  * **Row 1 (Pads 9 to 16):** Drum Kits (TR-909 House Kit, TR-808 Classic Kit, PO-33 Beat Kit, etc.) illuminated in red/green.
* Tap any pad (1 to 16) while holding `►` to jump directly to that instrument or drum kit! The piano keys and waveform display switch immediately to that sound.
* **Quick Tap:** Tapping **`►`** quickly (without holding any pads) advances to the next pattern.

---

## 7. Studio-Grade Offline Audio Export (`[⬇ EXPORT WAV]`) & Project Persistence (`[💾 SAVE]` / `[★ NEW]`)

### Project Persistence & Default 4/4 Kick Start State:
* **Default Clean Start:** When Open-KO boots (or when clicking `[★ NEW]`), it initializes with **strictly 4 kick drums on quarter notes in 4/4 time signature** (steps 0, 4, 8, 12 on Track 9 / TR-909 House Kit) and **ABSOLUTELY NOTHING ELSE**! All other tracks and steps are completely clean.
* **LocalStorage Persistence:** Click **`[💾 SAVE]`** in the top bar to save your BPM, swing, pattern chain, 16 patterns, step sequences, p-locks, track mutes, and sound parameters to browser storage (`open_ko_project_v1`). On next launch, your project is restored automatically!

---

## 8. High-Resolution Pattern Zooming (1x, 2x, 4x, 8x / 128th Notes) as a Low-Res LED Viewport

Open-KO treats the 16 physical matrix pads (Rows 0 & 1) as a **low-resolution LED display and write surface** into the 128-tick 4/4 musical measure.

> **CRITICAL ARCHITECTURE PRINCIPLE:**  
> **Zooming NEVER alters the tempo or playback speed of your music!**  
> A 4/4 measure always takes the exact same musical duration (e.g. 2.0s at 120 BPM), and kicks always play on quarter notes (Beats 1, 2, 3, 4). Zooming converts notes via a **canonical 128th-tick bijection** (`0..127`), preserving every positive and negative micro-timing offset (`-4` to `+3`) losslessly when zooming in and back out!

### Zoom Levels & Low-Res Display Viewport:
* **1X Zoom (16th Notes — 16 Steps, 1 Page `P1`, 8 Sub-Ticks `-4..+3` per Step):**
  * The 16 pads show the entire 1 measure (16 steps).
  * Quarter notes (Beats 1, 2, 3, 4) land on pads 0, 4, 8, 12. You see all 4 kicks across the 16 pads!
* **2X Zoom (32nd Notes — 32 Steps, 2 Pages `P1–P2`, 4 Sub-Ticks `-2..+1` per Step):**
  * **Page 1 (Beats 1 & 2):** Pad 0 = Step 0 (Kick 1); Pad 8 = Step 8 (Kick 2).
  * **Page 2 (Beats 3 & 4):** Pad 0 = Step 16 (Kick 3); Pad 8 = Step 24 (Kick 4).
* **4X Zoom (64th Notes — 64 Steps, 4 Pages `P1–P4`, 2 Sub-Ticks `-1..0` per Step):**
  * Each page represents 1 quarter-note beat across 16 pads for rapid trap hi-hat triplets and micro-rolls!
* **8X Zoom (128th Notes — 128 Steps, 8 Pages `P1–P8`, 1-to-1 Discrete 128th Grid):**
  * Each page represents one eighth-note (`16 x 128th` ticks), exposing every single **128th-note sub-tick** directly on the 16 hardware pads for surgical J Dilla / MPC chop placement!

### Scrolling Through Pattern Pages (`P1`–`P8`):
* **Hardware Arrow Buttons:** When zoomed in (`2X`, `4X`, or `8X`), tapping **`▲`** or **`▼`** scrolls across Pages `P1`–`P8`, updating the pad LEDs instantly! (When at `1X`, `▲` and `▼` navigate between tracks).
* **Hardware Pads & Knobs:** Turn **`SHIFT + Knob 1`** (CC 48) or press **`SHIFT + Pad 10`** (Note 25) to change Zoom (`1X`, `2X`, `4X`, `8X`), and turn **`SHIFT + Knob 2`** (CC 49) to scroll pages!
* **Playhead Follow (`SHIFT + Pad 16` / Note 31):** When `FOLLOW: ON` is active, the pad viewport and UI Channel Rack automatically chase the running playhead across pages `P1`–`P8`!

---

## 9. Advanced Sample Modification: Sustain Looping & Granular Time-Stretching

Open-KO transforms factory samples and recorded audio into flexible sound design instruments:

* **Sustain Loop Mode (`🔁 LOOP: ON/OFF`):**
  * When enabled on any melodic or drum slot, holding down a piano key or pad loops the audio buffer seamlessly between `Trim Start` and `Trim End` boundaries!
  * Ideal for sustained ambient pads, endless synth drones, continuous vocal sustain, or sustained 808 sub-bass rumbles that hold as long as your finger presses the key!
* **Granular Time-Stretching (`⏱ 0.5x` / `⏱ 2.0x`):**
  * Built-in studio-grade **Granular Overlap-Add (OLA)** time stretch engine.
  * Stretches or compresses sample length (2x slower or 2x faster) **without altering musical pitch**!
* **In-Place Buffer Tools:**
  * **`🔄 REV`:** Reverses audio buffer channels in-place for reverse cymbals, backwards vocal chops, and psychedelic swells.
  * **`⚡ NORM`:** Instant peak auto-normalization to -0.5 dB headroom.
  * **`✂ SLICE`:** Transient energy auto-slicing into 16 contiguous slices.

---

## 10. Drum Slice Recording Accuracy & Multi-Sound Layering

In previous versions, playing drum hits during live overdub could replace previous slices, and out-of-bounds keys could trigger incorrect slice boundaries. Open-KO resolves this completely:

1. **Safe Modulo-16 Normalization:** Every key, pad, and playback event is cleanly clamped to `slice 0..15`, preventing audio buffer out-of-bounds blips.
2. **Multi-Sound Drum Layering (Polyphonic Overdub):**
   * Drum tracks now support simultaneous slice layering on the same step!
   * On loop pass 1, record your Kick (Slice 0) on step 1.
   * On loop pass 2, record your Hi-Hat (Slice 4) on step 1.
   * **The kick is not overwritten!** Both Kick and Hi-Hat are preserved polyphonically in `step.notes` and play back together with 100% voice fidelity.

---

## 11. Overhauled 8-Bank Punch-In Performance FX & Screech-Free Dub Space Echo

Row 5 on the APC Key 25 Mk1 (Notes 0–7 in Pattern/Perform Mode) triggers 8 momentary master-bus performance effects engineered with click-free gain slewing and parallel resonant filter routing:
1. **`1/8 Stutter` (Pad 33 / Note 0):** Tempo-synced eighth-note delay loop repeater.
2. **`1/16 Beat Roll` (Pad 34 / Note 1):** Tight sixteenth-note snare/chop beat repeat.
3. **`12-Bit SP-1200` (Pad 35 / Note 2):** Classic 26 kHz / 12-bit staircase waveshaper & ring-mod grit.
4. **`Vinyl Brake` (Pad 36 / Note 3):** Turntable platter stop pitch drop with smooth motor spin-up on release.
5. **`HPF Sweep` (Pad 37 / Note 4):** Parallel resonant high-pass DJ build filter sweep.
6. **`LPF Sub-Drop` (Pad 38 / Note 5):** Deep underwater low-pass resonant sub-bass drop.
7. **`Sidechain Pump` (Pad 39 / Note 6):** Instant tempo-synced quarter-note French-house ducking pump across the mix.
8. **`Dub Space Echo` (Pad 40 / Note 7):** Warm vintage dub delay featuring a flat Butterworth low-pass filter ($Q = 0.707$, 1600 Hz), `WaveShaper` soft-saturation feedback limiter, and exponential `setTargetAtTime` delay slewing for zero runaway screech.

---

## 12. FL Studio-Style 16-Track Insert Mixer, Sidechain Ducking Bus & Master DSP Rack
* **Live Voice LED:** Flashes in emerald green whenever a voice is sounding on that track.
* **Step Count Indicator:** Shows active step count in current pattern (e.g. `4 STEPS`).
* **Volume Faders:** Vertical faders from 0% to 100% gain per track.
* **Mute Buttons `[M]`:** Directly mapped to APC Key 25 bottom row track buttons (Notes 64–71) and Row 4 pads. Turns red when muted.
* **Solo Buttons `[S]`:** Isolates individual tracks for critical listening and mixing.
* **Sidechain Duck / Trigger Buttons `[D]` / `[SC]`:**
  - **`[D]` (Cyan):** Routes the track through the Sidechain Ducking Bus (`SHIFT + Pad 14` toggles on active track; enabled by default on Melodic Tracks 1–8).
  - **`[SC]` (Orange):** Marks the track as the global Sidechain Trigger Source (`SHIFT + Pad 15` assigns active track; defaults to Track 9 Kick).
* **`[JAM]` Buttons:** Sets the active track for chromatic keyboard jamming and macro knob tweaking.

### Master DSP Chain:
* **Sidechain Ducking Compressor (`SHIFT + Pad 13`, Master Knobs 7 & 8):**
  - Dedicated `sidechainBus -> sidechainGain -> voicesBus` routing triggered sample-accurately (`5ms` linear attack, `40–500ms` exponential release) whenever the `SC` source track fires, with live cyan ducking meter and full offline WAV export support.
* **PO Dual Filter (Knob 4 / CC 51 & Knob 5 / CC 52):**
  - Center value 64 is transparent bypass; values `0–63` sweep resonant LPF; values `65–127` sweep resonant HPF.
* **Master Glue Compressor (Master Knob 8 / CC 55):**
  - Punchy dynamics compressor (`-18 dB` threshold, `4:1` ratio) for drum bus glue with live amber gain-reduction meter and smooth makeup gain.
* **Space Delay (Track Knob 7 / Master Knob 6 / `SHIFT + Knob 7`):**
  - Tape-voiced dub delay send for spatial echoes and dub washes.
* **Master Soft-Clipper:**
  - Smooth `tanh` wave-shaping curve preceding final destination to guarantee zero digital clipping distortion in any browser.

---

## 5B. Hardware Pattern Tools (`SHIFT` + Rows 0 & 1) & Sample Chopping Tools

### Pattern & Sidechain Tools (`SHIFT` + Step Pads 1–16 in Pattern Mode)
Hold physical **`SHIFT` (Note 98)** and press step pads on **Row 0 (Notes 32–39)** or **Row 1 (Notes 24–31)**:
* **Row 0 — Pad 1 (Note 32):** **Clear Active Track Steps** (resets current instrument's sequence).
* **Row 0 — Pad 2 (Note 33):** **Duplicate Pattern** to next pattern slot.
* **Row 0 — Pad 3 / 4 (Notes 34 / 35):** **Shift Track Steps Left / Right** by 1 step.
* **Row 0 — Pad 5 (Note 36):** **Humanize Velocities** (adds natural velocity variations).
* **Row 0 — Pad 6 (Note 37):** **Cycle Swing** (`50%` $\rightarrow$ `54%` $\rightarrow$ `58%` $\rightarrow$ `62%` $\rightarrow$ `66%`).
* **Row 0 — Pad 7 / 8 (Notes 38 / 39):** **Double (2x) / Half (0.5x) Tempo**.
* **Row 1 — Pad 9 (Note 24):** **Toggle Record Mode** (`FREEFORM` Auto-BPM 128th $\leftrightarrow$ `QUANTIZED` Overdub).
* **Row 1 — Pad 10 (Note 25):** **Cycle Pattern Zoom** (`1X` 16 $\rightarrow$ `2X` 32 $\rightarrow$ `4X` 64 $\rightarrow$ `8X` 128 steps).
* **Row 1 — Pad 11 (Note 26):** **Nudge Step Earlier (`-1/128th`)** on active/held step.
* **Row 1 — Pad 12 (Note 27):** **Nudge Step Later (`+1/128th`)** on active/held step.
* **Row 1 — Pad 13 (Note 28):** **Toggle Master Sidechain Ducking** (`ON` / `OFF`).
* **Row 1 — Pad 14 (Note 29):** **Toggle Active Track Sidechain Duck (`D`)** (`DUCKED` / `BYPASS`).
* **Row 1 — Pad 15 (Note 30):** **Set Active Track as Sidechain Trigger (`SC`)**.
* **Row 1 — Pad 16 (Note 31):** **Toggle Playhead Page Follow** (`FOLLOW: ON` / `OFF`).
* **Row 2 — Pads 17–24 (Notes 16–23):** Append Pattern `1–8` to Song Chain.
* **Row 3 — Pads 25–32 (Notes 8–15):** Toggle Mutes for Tracks `9–16`.

### Sample Chopping Tools (Row 5 Pads in Sample Mode)
When in **Sample Mode (`Shift + Scene 1`)**, Row 5 (Pads 33–40, Notes 0–7) acts as the physical sample editor:
* **Pad 33 (Note 0):** Auto-Slice into 16 slices using Spectral Energy detection.
* **Pad 34 (Note 1):** Equal 16-division Slice.
* **Pad 35 (Note 2):** Reverse Sample Audio Buffer in-place.
* **Pad 36 (Note 3):** Peak Auto-Normalize buffer to -0.5 dB.
* **Pad 37 / 38 (Notes 4 / 5):** Pitch Down / Up 1 Octave (-12 / +12 semitones).
* **Pad 39 (Note 6):** Toggle Sample Stretch Mode (`PITCH ONLY` constant-duration $\leftrightarrow$ `SQUEEZE` varispeed).
* **Pad 40 (Note 7):** Audition Full Raw Sample.

---

## 6. Ultra-Minimalist PO-33 / EP-133 Retro Screen & LCD Badges

When switched to **Minimal View** (via `Shift + Sustain` or the `📱 MINIMAL VIEW` button), the UI collapses into an authentic, distraction-free pocket sampler screen inspired by the Teenage Engineering PO-33 K.O! and EP-133 K.O. II:

* **Animated K.O! Boxer Character:**
  - Bounces rhythmically with tempo breathing.
  - Throws dynamic left jabs and right crosses on drum and note hits with "PUNCH!" impact star.
  - Flurries on punch-in performance FX with "K.O.!" star.
  - Raises defensive guard when recording live samples.
* **Segment LCD Icon Badges:**
  - `[SMPL]`, `[PTRN]`, `[PERF]` — Active workflow mode.
  - `[▶ PLAY]`, `[❚❚ PAUSE]` — Transport state.
  - `[● REC]` — Red pulsing recording badge.
  - `[✂ TRIM]` — Sample trim active.
  - `[⚡ FX]` — Momentary punch-in FX active.
  - `[🔒 LOCK]` — Parameter lock held or active.
  - `[♩ METRO]` — Metronome beat indicator.
  - `[⏳ SWG]` — Swing active (> 50%).
  - `[🎹 MEL]` / `[🥁 DRM]` — Active sound slot type.
  - `[MUTE]` — Track mute active.
  - `[CHOKE]` — Drum choke group active.
  - `[LPF]` / `[HPF]` — Active PO Dual Filter direction.
* **Big 7-Segment Amber Digits:**
  - TEMPO: Chunky BPM readout (e.g. `092`).
  - PATTERN: Active pattern index (`01` to `16`).
  - SOUND SLOT: Active sound slot (`01` to `16`).
  - PO FILTER / PARAM: Dual filter readout (`OFF`, `LP45`, `HP80`) and real-time parameter feedback (`START 12%`, `DECAY 0.8s`, `PITCH +7 ST`).
* **Discrete Segment VU Ladders:**
  - Vertical Left, Right, and Mic Input columns lighting up discrete Green, Amber, and Red LCD segment blocks based on live Web Audio analysis.
* **PO-33 16-Step Circular LED Running Strip:**
  - Displays running playhead (Green LED), active triggers (Amber LED), and step trigger hits (Red LED).

---

## 7. Guided Hardware Test Suite & Auto-Calibration Inspector

Open-KO includes a built-in hardware diagnostic suite accessible via the **`🧪 TEST APC`** button, the **`🎛 APC MK1 MAP`** button, or directly on hardware by pressing **`Shift + Stop All`**:

1. **Tab 1: Live Diagnostic Surface:**
   - Touch any control on your APC Key 25 Mk1.
   - **Piano Keybed:** Confirms MIDI Channel 2, displays note name, octave, velocity, and plays test audio.
   - **Transport Buttons:** Confirms Play/Pause (Note 91), Rec (Note 93), and Stop All (Note 81).
   - **8 Knobs:** Verifies continuous CC 48–55 sweep from 0 to 127.
   - **Pad Matrix:** Verifies row/col coordinate translation and triggers bi-directional tri-color LED responses on the physical hardware (Green $\rightarrow$ Amber $\rightarrow$ Red $\rightarrow$ Off).
   - **Track Buttons:** Verifies Notes 64–71 (▲, ▼, ◄, ►, VOL, PAN, SEND, DEV).
   - **Modifiers:** Verifies Shift (Note 98), Sustain (CC 64), and internal hardware Octave shifts.
2. **Tab 2: Guided Step-by-Step Wizard:**
   - 8-step walkthrough: Keys $\rightarrow$ Transport $\rightarrow$ Tracks $\rightarrow$ Scenes $\rightarrow$ Knobs $\rightarrow$ Modifiers $\rightarrow$ Pads $\rightarrow$ Calibration Save.
   - Clicking **"CONFIRM & SAVE CALIBRATION"** writes your confirmed hardware profile to `localStorage` (`open_ko_midi_calibration_v1`).
3. **Tab 3: APC Key 25 Mk1 Layout & MIDI Map:**
   - Authoritative hardware reference table displaying every physical control, MIDI Channel, message type, and default Open-KO assignment.
4. **Bi-Directional LED Tools:**
   - "All Green", "All Amber", "All Red", "Chase Cycle", and "Clear All LEDs".

---

## 8. The "Constant Sine Wave" Mystery: Root Cause & Solution

During testing, users frequently report a mysterious, constant sine-wave drone in headphones that:
1. Starts playing whenever physical Octave Up / Down buttons transpose away from the base octave.
2. Stops only when returned to the base octave.
3. Plays continuously whenever pad/scene LEDs light up, and only stops when LEDs turn off.

### The Physics: USB Ground Loop & LED PWM Switching Noise
This sound is **not** generated by Web Audio synthesis or a runaway software oscillator. It is a well-known physical audio hardware phenomenon:
* **The Pulse Width Modulation (PWM) Power Draw:** Controllers like the Akai APC Key 25 Mk1 drive their tri-color LEDs using rapid PWM switching to control brightness.
* **The Shared USB Ground:** When both the Akai APC Key 25 (bus-powered) and a USB audio interface (e.g., PreSonus AudioBox USB 96) are plugged into the same computer, the switching current drawn by the LEDs ripples down the shared 5V USB ground wire.
* **The Analog Audio Bleed:** This electrical switching frequency (typically 1 kHz to 4 kHz) bleeds directly into the high-gain headphone amplifier of the audio interface as a clean, steady, unstoppable electrical tone that mimics a pure sine wave.
* **Why the Octave buttons cause it:** The Octave Up/Down buttons have internal red LEDs that turn on whenever the keyboard is transposed away from middle C. Open-KO does not even control those LEDs—the controller's internal microcontroller turns them on, immediately triggering USB current draw and the resulting ground whine!

### How Open-KO Solves It:
1. **Eco LED Mode (Software Fix):**
   - Click the **`⚡ LED: NORMAL`** button on the top bar to switch to **`⚡ LED: ECO (SILENT)`**.
   - In Eco Mode, Open-KO sheds over 90% of simultaneous background LED illumination, lighting only the active step/playhead and keeping unused pads dark. This drops USB current draw to negligible levels, eliminating the audible electrical whine!
   - You can also select **`⚡ LED: STEALTH`** to disable all hardware LEDs completely.
2. **Hardware Ground Isolation (Physical Fix):**
   - Connect the APC Key 25 and AudioBox USB 96 to different USB root hubs (or ports on opposite sides of a Mac).
   - Use an externally powered USB hub with isolated ground, or an inline USB ground loop isolator (e.g. iFi iDefender).
   - If using a laptop, disconnect the power brick and run on battery to test ground isolation.

---

## 9. Muscle Memory Translation Guide: PO-33 / EP-133 to Akai APC Key 25 Mk1

| Classic PO-33 / EP-133 Button | Akai APC Key 25 Mk1 Physical Control | Open-KO Behavior |
| :--- | :--- | :--- |
| **`SOUND` + 1–8** | **Track Buttons 1–8 (Notes 64–71)** or Row 0 Pads | Selects active Melodic Track 1 to 8 (Rhodes, 808 Bass, Juno, Kalimba, etc.) |
| **`SOUND` + 9–16** | **`SHIFT` + Track Buttons 1–8** or Row 1 Pads | Selects active Drum Kit Track 9 to 16 |
| **`PATTERN` + 1–8** | **Row 2 Pads (Notes 16–23)** | Switches active Sequencer Pattern (1 to 8) |
| **`PATTERN` + 9–16** | **`SHIFT` + Row 2 Pads** | Switches active Sequencer Pattern (9 to 16) |
| **`PLAY`** | **Scene 1 (Note 82)** [or Play 91 on Mk2] | Toggles Playback while strictly preserving cursor timestamp |
| **`STOP`** | **Stop All Clips (Note 81)** | Stops playback and resets playhead to Step 0 |
| **`RECORD` + Keys** | **Scene 2 (Note 83)** [or Rec 93 on Mk2] | Engages Live Loop Overdub Recording into active track |
| **`WRITE` (Step Edit)** | **Rows 0 & 1 Pads (Notes 32–39, 24–31)** | Tap pads directly to toggle 16th-note steps on/off |
| **Step Parameter Lock** | **Press & Hold Step Pad** + Turn Knob 1–8 | Locks Pitch, Trim, Filter, or Decay to that specific step |
| **`FX` + 1–8** | **Row 4 Pads (Notes 0–7)** | Triggers momentary Punch-In FX (Stutter, Roll, Bitcrush, Tape Stop, HPF/LPF, Space Delay) |
| **`BPM` / Tempo** | **`SHIFT` + Scene 4 (Note 85)** | Tap 2–4 times for hardware Tap Tempo |
| **PO Dual Filter Sweep** | **Knob 4 (CC 51) & Knob 5 (CC 52)** | 0–63: Low-Pass sweep down; 64: Bypass; 65–127: High-Pass sweep up |
| **Chromatic Keys** | **25 Mini Piano Keys (Channel 2)** | Plays active melodic sample chromatically or drum slices 1–16 |

---

## 10. Cross-Platform Workflow Guide

### For Teenage Engineering PO-33 / EP-133 Users
* Open-KO was built to faithfully preserve your muscle memory: 16 sound slots (8 melodic + 8 drum), 16 steps per pattern, parameter locks, punch-in FX, and transient auto-slicing.
* Instead of squinting at a tiny unlit LCD, you get full visual feedback on the browser screen with real-time waveform display, while your hands stay 100% on the Akai APC Key 25 hardware.

### For Akai APC Key 25 & Ableton Live Users
* In **Mode 3 (Performance Mode)**, Open-KO mirrors Ableton Live's Session View:
  - Rows 0–4 act as clip slots across 8 tracks.
  - Scene buttons 82–86 fire entire horizontal scenes.
  - Stop All Clips (81) stops playback.
  - Knobs 1–8 map cleanly to device macros and send levels.

### For FL Studio Users
* In **Mode 2 (Pattern Mode)**, Open-KO functions just like FL Studio's Pattern Blocks & Step Sequencer:
  - Each pattern contains 16 independent tracks.
  - Chaining patterns together on Scene 5 builds up full song arrangements.
  - Bottom row buttons act as track mutes, identical to FL Studio channel rack mutes.

---

## 11. Automated Testing Guide vs Guided Hardware Test Suite

* **`tests.html` (Developer Automated Test Engine):**
  - Designed for automated software regression testing in CI or browser consoles.
  - Uses synthetic in-memory mock objects to verify Web Audio DSP math, transient detection algorithms, pitch conversion curves, and MIDI parsers.
  - **Does not interact with physical hardware.** Green checkmarks on this page confirm that the codebase logic is 100% sound.
* **`index.html` $\rightarrow$ `🧪 TEST APC` (Guided Hardware Verification Wizard):**
  - The live, interactive test suite for your physical controller.
  - Listens to live Web MIDI input, detects Channel 1 vs Channel 2, verifies physical knob sweeps, validates pad coordinates, and runs bi-directional LED tests.

---

## 12. Master Session Logging System (`SessionLogger.js`)

Open-KO includes an integrated master logging engine to record, monitor, and archive workstation sessions:
* Automatically intercepts and timestamps all `console.log`, `console.info`, `console.warn`, and `console.error` calls.
* Automatically rotates and archives previous session logs to historical storage upon each page reload (`session_log_YYYY-MM-DD_HH-mm-ss.log`).
* Accessible in-app via the **`[📋 LOGS]`** button for one-click downloading or clipboard copying.

---

## 13. Fundamental Technical Limitations & Architectural Constraints

For advanced developers, live performers, and studio engineers, the following table and breakdown outline the fundamental boundaries imposed by the Web platform, MIDI specifications, and hardware physical interfaces:

| Constraint Category | Root Cause & Technical Limitation | Impact on Performance | Open-KO Mitigation / Workaround |
| :--- | :--- | :--- | :--- |
| **1. Web Audio Threading** | DSP operates on the OS audio thread, but scheduling and UI logic run on the single JavaScript event loop. | Heavy DOM redraws or garbage collection spikes can delay note scheduling if lookahead is too small. | Open-KO employs a **100ms dual-timer lookahead scheduler** with pre-buffered audio nodes and decoupled canvas rendering. Future: AudioWorklet sequencer. |
| **2. Web MIDI Browser Support** | Web MIDI is a W3C standard fully supported in Chromium (Chrome, Edge, Brave, Opera) but **unsupported in iOS Safari**. | Mobile iOS Safari cannot natively communicate with USB MIDI controllers without third-party wrapper browsers. | Works seamlessly on desktop Chrome, Brave, and Edge (macOS, Windows, Linux). On iPad/iPhone, use Web MIDI Browser or desktop pairing. |
| **3. USB Ground Loop Noise** | Controller LEDs are driven by rapid PWM current switching sharing the 5V USB ground rail with the audio interface. | Induces a 1–4 kHz audible electrical hum/whine in high-gain headphone preamps (especially when Octave LEDs turn on). | **Eco LED Mode** sheds >90% of simultaneous LED current; **Stealth LED Mode** turns LEDs off; hardware USB isolator or powered USB hub completely breaks loop. |
| **4. PCM Memory Footprint** | Uncompressed 32-bit float stereo audio in browser memory consumes ~21.1 MB per minute of audio. | Loading large multi-minute WAV files across all 16 slots could consume 500MB+ RAM and trigger browser tab eviction. | Open-KO enforces groovebox-style sample lengths (12–40 seconds per slot), keeping total active RAM footprint below 50 MB. |
| **5. 128th-Note Sub-Tick Resolution** | Primary pad matrix shows 16 steps per page, while internal timing resolves to **128 ticks per 4/4 bar**. | Ultra-fine unquantized rubato finer than 1/128th (~15–20ms) is snapped to the nearest 128th sub-tick. | **Freeform First-Loop Auto-BPM**, per-step **128th Micro-Timing (`-4..+3`)**, **`8X` 128-Step Zoom (`P1–P8`)**, and **Hardware Swing (`50%–75%`)** capture authentic choppy hip-hop swing. |
| **6. Mobile iOS Tab Suspension** | Mobile WebKit automatically suspends Web Audio contexts when the screen locks or tabs are backgrounded. | Playback will halt if the mobile screen goes to sleep or you navigate away to another app. | Prevent screen lock in mobile settings or keep the tab active during live performance. |
| **7. Drum Choke vs. Track Polyphony** | Drum tracks (9–16) are monophonic per-slot choke groups; melodic tracks (1–8) are 6-voice polyphonic. | Slices within a drum kit choke each other, but slices on separate tracks do not cross-choke unless in the same kit. | Keep open and closed hi-hats in the same 16-slice drum kit slot so they naturally choke each other. |
| **8. In-Memory WAV Encoding** | Offline rendering builds large contiguous `ArrayBuffer` objects in memory before triggering Blob file download. | Extremely long arrangements (>20 minutes) can require significant contiguous memory during rendering. | Standard song arrangements (2–6 minutes) render in under 1.5 seconds at 100x speed without noticeable memory overhead. |

---

## 14. Complete Sampling Guide: Line-In & Computer Audio (YouTube, Spotify, SoundCloud)

Open-KO gives you two ways to sample audio into your project:
1. **Sampling Straight from Computer Audio (YouTube, Spotify, SoundCloud, Bandcamp, Videos, Podcasts)**
2. **Sampling from Line-In (USB Audio Interface like AudioBox USB 96, Synthesizers, Drum Machines, Phone 3.5mm)**

Both methods automatically peak-normalize the captured audio to studio headroom (-0.5 dB) and immediately load it into your active sound slot for chromatic playback or 16-pad transient slicing.

---

### Part A: Sampling Straight from Computer Audio (YouTube, Spotify Web, SoundCloud)

You do **not** need any external cables, audio interfaces, or loopback software to sample audio playing in your browser. Open-KO uses high-fidelity digital tab audio streaming (`getDisplayMedia` with AGC and noise cancellation disabled) to capture 100% bit-perfect digital audio directly from any tab.

#### Step-by-Step Instructions:
1. **Prepare Your Audio Source:**
   - Open a browser tab with the audio you want to sample (e.g. YouTube, Spotify Web at `open.spotify.com`, SoundCloud, or Bandcamp).
   - Find the exact drum break, vocal hook, vinyl chord, or dialogue snippet you want to sample. Pause right before the cue.
2. **Select Destination Slot in Open-KO:**
   - In Open-KO, choose the track slot where you want the sample:
     - **Tracks 1 to 8 (Melodic Slots):** If you are sampling a bass note, Rhodes chord, vocal tone, synth pad, or melodic pluck. The sound will be pitched chromatically across all 25 piano keys.
     - **Tracks 9 to 16 (Drum Kit Slots):** If you are sampling a drum break, percussion loop, or beat. Open-KO will automatically slice the recorded audio into 16 slices across the 16 keys/pads.
3. **Initiate Tab Capture:**
   - Click the blue **`🖥️ TAB AUDIO`** button in the top navigation bar (or in the waveform toolbar).
4. **Select the Audio Tab in Browser Dialog:**
   - Chrome / Edge will present a permission modal titled *"Choose what to share"*.
   - Click the **"Chrome Tab"** (or **"Edge Tab"**) option at the top.
   - Click on your YouTube or Spotify tab from the list.
   - **CRITICAL STEP:** Ensure the checkbox at the bottom — **"Also share tab audio"** — is **CHECKED**!
   - Click **"Share"**.
5. **Start Recording & Play the Audio:**
   - Open-KO's top button turns red: `⏹ STOP TAB`.
   - The LCD readout displays `SAMPLING TAB/PC AUDIO (YOUTUBE/SPOTIFY)...`.
   - Switch to your YouTube/Spotify tab and hit **Play**.
   - You will see the live Green/Amber VU level bar dancing in Open-KO as the sound streams in.
6. **Stop Recording:**
   - When the snippet finishes playing, return to Open-KO and click **`⏹ STOP TAB`** (or press `Shift + REC` on your APC Key 25).
7. **Instant Result:**
   - Open-KO stops recording, stops the screen share, analyzes the peak amplitude, normalizes the buffer to **-0.5 dB**, and draws the new waveform on screen!
   - If recorded into a **Drum Slot (Tracks 9–16)**: It automatically runs transient detection and slices the break into 16 drum hits ready to jam on the keys.
   - If recorded into a **Melodic Slot (Tracks 1–8)**: Touch any key on the APC Key 25 keybed to play the sample chromatically!

---

### Part B: Sampling Desktop Apps (Desktop Spotify App, Apple Music, Logic) on macOS

If you are using the **desktop macOS Spotify application** (instead of the web browser player) or Apple Music, macOS does not natively permit web browsers to record desktop system sound without an internal loopback driver.

#### Option 1: The Quickest Zero-Install Route (Recommended)
* Instead of the desktop Spotify app, open **Spotify Web Player** (`open.spotify.com`) or **YouTube** in a Chrome/Brave/Edge tab.
* Use **Part A (Tab Audio Capture)** above. It takes 5 seconds, requires zero installation, and captures pristine digital audio.

#### Option 2: System-Wide Loopback with BlackHole (For Desktop Apps)
If you must sample from a desktop app like Spotify Desktop or Logic:
1. **Install BlackHole 2ch** (free open-source audio loopback driver):
   ```bash
   brew install blackhole-2ch
   ```
   *(Or download the official installer from Existential Audio).*
2. **Create a Multi-Output Device (So you can still hear the music in headphones):**
   - Open macOS **Audio MIDI Setup** (`Applications > Utilities > Audio MIDI Setup.app`).
   - Click the `+` button in the lower-left corner and choose **Create Multi-Output Device**.
   - In the right panel, check both:
     - Your **Headphones / AudioBox USB 96** (Master Device)
     - **BlackHole 2ch**
   - In macOS System Settings $\rightarrow$ Sound $\rightarrow$ Output, select this **Multi-Output Device**.
3. **Route into Open-KO:**
   - In Open-KO, click **`⚙ SETUP`** in the top bar (or turn `Shift + Knob 1` on the APC Key 25).
   - Under **Audio Input Device**, select **BlackHole 2ch**.
   - Click `CLOSE & SAVE`.
4. **Sample:**
   - Select your target slot (1–8 Melodic, 9–16 Drum).
   - Click **`🎙 LINE/MIC`** (or press **`Shift + REC`** on the APC Key 25 Mk1).
   - Start music in the Spotify desktop app.
   - Click **`⏹ STOP REC`** (or press **`Shift + REC`** again).
   - The desktop sound is captured and ready to play!

---

### Part C: Sampling from Line-In (PreSonus AudioBox USB 96, Synthesizers, Phone)

Use this method to sample hardware instruments (synthesizers, guitar, drum machines, vinyl turntables, or your phone's 3.5mm line-out).

#### Step-by-Step Instructions:
1. **Connect Hardware:**
   - Plug your audio interface (e.g. **PreSonus AudioBox USB 96**) into your Mac USB port.
   - Plug your audio source (synth output, turntable preamp, or 3.5mm-to-1/4" phone cable) into **Input 1 or Input 2** on the front of the AudioBox.
   - Adjust the hardware `GAIN 1` knob on the AudioBox so the red `CLIP` LED does not flash when you play loudly.
2. **Select Device in Open-KO:**
   - Click **`⚙ SETUP`** in the top right.
   - In the **Audio Input Device** dropdown, verify that **"AudioBox USB 96"** (or your USB interface) is selected.
   - Click **`CLOSE & SAVE`**.
   *(Hardware shortcut: Turn `Shift + Knob 1` (CC 48) on the APC Key 25 to scroll through input devices directly on the controller!)*
3. **Select Slot & Arm:**
   - Select **Track 1–8** for a melodic instrument, or **Track 9–16** for a drum kit.
4. **Record Sample:**
   - **From APC Key 25 Hardware:** Press **`Shift + REC` (Note 93)**.
   - **From Screen:** Click the **`🎙 LINE/MIC`** button.
   - The button turns red (`⏹ STOP REC`), and the LCD displays `SAMPLING LINE/MIC... PLAY NOW!`.
5. **Play Your Sound:**
   - Play the chord, synth bass note, acoustic percussion, or vocal line.
   - Watch the live VU meter bar next to the waveform display to monitor incoming amplitude.
6. **Finish & Chop:**
   - Press **`Shift + REC`** on the APC Key 25 (or click `⏹ STOP REC`).
   - The sample is automatically peak-normalized (-0.5 dB headroom).
   - In drum slots, it auto-slices into 16 slices across the keyboard. In melodic slots, it is pitched chromatically across all 25 keys!
   - Use **Knob 1** (`Trim Start`) and **Knob 2** (`Trim End`) to trim any leading silence.

---

## 15. Akai APC Key 25 Hover Tooltips & Master Mode Isolation

### Interactive Hardware Access Hover Tooltips & Real-Time LCD Display
Every button, macro knob, pad, fader, badge, and step grid cell across the entire Open-KO interface is mapped to the physical **Akai APC Key 25 Mk1**:
* **Instant Retro LCD Readout (`#lcd-status-msg`):** The moment your mouse hovers over any UI element, the retro LCD status readout instantly illuminates with `[APC] <Hardware Shortcut>` in crisp amber text (`#ff9f43`), giving you zero-delay muscle memory guidance without having to wait for the browser's native tooltip popup delay.
* **Native Tooltip Popups (`title`):** Native browser hover balloons display full instructions (e.g. `APC: Scene 1 (Note 82) or PLAY/PAUSE (Note 91) -> Play/Pause | Shift + Scene 1 -> Sample Mode`).
* **Dynamic Macro Knob Labels:** When you switch between `Track Knobs` and `Master Knobs` (via `DEVICE` / Note 71 or the UI button), the 8 on-screen knobs immediately update their names and tooltips (e.g. `1: Start` vs `1: BPM`, `4: Filter` vs `4: M-Filter`).

### Master Mode Knob Bank Isolation (Ghost Note Fix)
* **Master Mixer Knobs (CC 48–55):** When switched to **Master Bank** (`knobBank === 'master'`), turning Knob 4 (PO Dual Filter LPF/HPF) or any other knob strictly controls the global master audio bus parameters (BPM, Swing, Master Tune, Global LPF/HPF, Global Res Q, Space Delay Time, Space Delay Feedback, Master Compressor/Vol).
* **Step Isolation Guarantee:** Master knobs will **never** modify track pattern steps or write parameter locks to the active instrument track, even if the sequencer is playing and recording.
* **Active-Only Live Automation:** In Track Mode, turning knobs live during playback recording only applies automation locks (`pLocks`) to steps that are **already active**. Turning a knob will never activate silent steps or create unwanted ghost notes.

---

## 16. Dual Sample Stretching Modes & Expanded Melodic Preset Library

### Dual Sample Stretching Modes (Pitch Shift Behavior)

Open-KO provides two selectable sample stretching modes on every slot, defaulting to **`PITCH ONLY`** out of the box:

```
+---------------------------------------------------------------------------------------------------+
| 1. PITCH ONLY (Default Mode — Time-Invariant Constant Duration)                                   |
|    • Shifting octaves heightens or lowers pitch WITHOUT shortening or squeezing sample duration!  |
|    • Higher notes ring out for the EXACT same length and sustain as the root note!                |
|    • Granular overlap-add DSP engine (~35ms Hann-windowed grains) reconstructs constant-time audio|
|    • Zero-latency LRU buffer caching per semitone for polyphonic chord jamming.                   |
|    • Ideal for Concert Piano, Rhodes, Symphonic Strings, Organs, Choirs, and Guitar!             |
+---------------------------------------------------------------------------------------------------+
| 2. SQUEEZE (Classic Varispeed Resampling)                                                         |
|    • Shifting pitch octaves scales playback rate: R = 2^(semitones / 12)                          |
|    • Higher pitches squeeze playback duration (faster playback); lower pitches stretch duration.  |
|    • Exact behavior of classic vintage hardware samplers (PO-33 K.O!, SP-404, Akai S950).         |
+---------------------------------------------------------------------------------------------------+
```

#### How to Toggle Modes:
* **From Physical Hardware (APC Key 25 Mk1):**
  - **Quick Knob Toggle:** Turn **`SHIFT + Knob 6` (CC 53)** to toggle between `PITCH ONLY` (CC 0–63) and `SQUEEZE` (CC 64–127).
  - **In Sample Mode:** Press **Pad Row 5 Col 7 (Note 62)** to toggle modes.
  - The LCD readout immediately displays `STRETCH MODE: PITCH ONLY (CONSTANT TIME)` or `STRETCH MODE: SQUEEZE (VARISPEED)`.
* **From Screen UI:**
  - Click the **`⏱ MODE: PITCH ONLY`** / **`⏱ MODE: SQUEEZE`** button in the sample editor toolbar.

---

### Expanded Preset Catalog (46 Melodic Instruments + 14 Drum Kits = 60 Total)

Open-KO features an expanded internal catalog of **46 synthesized melodic instruments** and **14 composite drum kits** (16 slices each = 224 isolated drum hits):

#### Expressive Melodic Instruments:
1. **Concert Grand Piano (Keys)** — 5.5s physical acoustic string model with inharmonic string dispersion ($B = 0.00035$), 3-string detuned unison beating ($1.0, 1.0007, 0.9993$), felt hammer strike transient, cavity resonance, and natural acoustic decay ($\exp(-t \times 0.38)$) that rings out for over 5 seconds while held!
2. **Rhodes Stage 73 (Long) (Keys)** — 5.0s duration with authentic bell tine resonance, warm harmonic body, and subtle stereo chorus tremolo.
3. **Symphonic Strings (Sustain) (Pad)** — 5.0s bowed cello/violin ensemble with natural acoustic vibrato, sub octave body, and bow scrape attack transient.
4. **Cathedral Pipe Organ (Keys)** — 5.0s massive 8-rank pipe organ with 16' sub bass, 8' foundation, 4' octave, quint harmonics, and acoustic pipe wind noise.
5. **Lush Choir Aah (Sustain) (Pad)** — 5.0s multi-formant vocal choir ($F_1 = 820\,\text{Hz}$, $F_2 = 1250\,\text{Hz}$, $F_3 = 2600\,\text{Hz}$) with gentle human pitch vibrato and breath transient.
6. **Upright Acoustic Bass (Long) (Bass)** — 4.2s resonant acoustic double bass with wooden cavity bloom, string growl, and fretboard buzz.
7. **Spanish Nylon Guitar (Pluck)** — 4.0s classical nylon acoustic guitar with fingernail pluck transient, dual string resonance, and soundhole warmth.
8. **Solina String Ensemble (Pad)** — 5.0s vintage 1974 BBD triple-chorus string machine sound with lush detuning and warm presence.
9. **Ethereal Shimmer Pad (Long) (Pad)** — 6.0s ambient octave shimmer pad with slow evolving filter cutoff and sparkling high harmonics.
10. **Prophet Analog Brass (Long) (Lead)** — 4.5s massive dual-oscillator detuned analog brass with 24dB resonant lowpass envelope sweep.
11. **Fender Jazz Finger Bass (Bass)** — 4.2s warm finger-style electric bass with natural low-frequency body and bridge pickup bite.
12. **Baroque Concert Harpsichord (Keys)** — 3.5s bright metallic concert harpsichord with quill pluck transient and double 8'+4' string registers.
13. **Jazz Vibraphone (Tremolo) (Pluck)** — 5.0s struck metal tone bars with 5.2Hz motorized butterfly valve tremolo and singing decay.
14. **Orchestral Tubular Chimes (Keys)** — 5.5s brass chime bell strike with rich acoustic inharmonic dispersion cluster.
15. **Roland Jupiter-8 Poly Brass (Lead)** — 4.8s detuned dual-saw analog brass with warm resonant lowpass sweep.
16. **Dusty Jazz Rhodes Chops (Keys)** — 3.8s vinyl-saturated electric piano tine chops tailored for boom-bap slicing and chord stabs.
17. **Tape-Saturated Vinyl Flute (Lead)** — 3.2s breathy magnetic-tape flute with organic vibrato and warm `tanh` tape saturation.
18. **808 Slide Sub Bass (Bass)** — 4.2s pitch-gliding sub-bass drop with warm second-harmonic punch.
*(Plus 28 additional synth leads, subs, pads, plucks, and classic lo-fi keyboards!)*

#### 16-Slice Drum Kits (14 Total Kits = 224 Individual Drum Hits):
1. **TR-909 House Kit** — Legendary 909 kicks, snares, rimshots, open/closed hats, toms, ride, clap, crash.
2. **TR-808 Classic Kit** — Sub-bass boom 808 kick, punch kick, snare, clap, hats, congas, cowbell, clave, shaker.
3. **PO-33 Beat Kit** — Authentic Pocket Operator lo-fi compressed hip-hop drums.
4. **Lo-Fi Hip-Hop Dust Kit** — Gritty, tape-saturated vinyl kicks, dusty rimshots, crunchy snares, warm vinyl clicks.
5. **Trap 808 Mega Kit** — Ultra-deep pitched 808 sub drops, tight metallic snares, laser percs, fast hi-hats.
6. **Vintage Electro Hybrid** — 80s electro breakbeat kit with analog percs, cowbells, and laser zaps.
7. **Jungle & D&B Break Kit** — High-speed amen-style acoustic breaks, snappy rimshots, and heavy sub kicks.
8. **LinnDrum LM-2 Classic Kit** — Iconic 1982 Prince/Michael Jackson sampled drums (kicks, fat snare, sidestick, congas, cabasa, cowbell).
9. **Studio Acoustic Drum Kit** — Natural Ludwig wooden kicks, maple snare, acoustic hi-hats, floor/rack toms, and ride cymbals.
10. **Dirty Boom-Bap SP-1200 Kit** — Tape-driven boom-bap kicks, fat crunchy snares, vinyl scratch hits, and dusty tape chord stabs.
11. **Memphis 808 Drift Kit** — Heavy 808 kicks, crisp cowbells, tight claps, snares, and sub drops.
*(Plus Acoustic Break Kit, Industrial Cyber Kit, and Glitch & Vinyl Kit!)*

---

### Anti-Bleed Drum Slice Isolation & De-Clicking Engine

To eliminate digital clicking, transient pops, and bleeding from neighboring slices:
1. **Synthesized Buffer Guard Window (`_renderDrumKit`):** Every slice in every drum kit incorporates an automatic 15ms Hann window tail fade-out and forces the final samples to exact zero. Individual drum tails will never bleed into the onset of the neighboring slice in the buffer!
2. **Playback Boundary Guard Margin (`SampleSlot.playSlice`):** Playback applies an automatic 4ms guard margin before the start of the next slice, ensuring that even under extreme pitch bends or rapid triggering, the voice engine never touches the attack transient of the adjacent drum slice.
3. **Smooth De-Clicking Gain Envelopes:** Every drum slice voice initiates with a 1.5ms micro-fade-in to eliminate DC-offset attack pops, and terminates with a smooth linear fade-out down to zero, guaranteeing silent, clean cutoffs without pops or clicks.

---

### Ghost Note Elimination & Parameter Lock Safety

* **Active-Only Parameter Locking:** Parameter locks (`pLocks`) applied by turning knobs 0–7 will **never** activate an inactive step (`activateIfInactive = false`). Turning a knob cannot accidentally write a note or activate step 12 (or any step) in the sequence!
* **Physical Pad Verification:** Parameter locking strictly verifies that a step pad is actively, physically held down on the APC Key 25 (`midiManager.heldSteps.has(...)`). If no pad is physically being held down, `heldStepIndex` is guaranteed to be `-1`, preventing any accidental ghost-note creation during playback!
* **Transport & Navigation Clears:** Starting playback, stopping playback, resetting, changing patterns, or switching active slots automatically clears all held-step states.

---

## 17. FL Studio 21-Inspired UI Revamp (100% Hardware-First Preserved)

The full workstation view (`styles/open-ko.css`) adopts an **FL Studio 21 Dark Slate** visual hierarchy while keeping every control 1-to-1 mapped to the physical Akai APC Key 25 Mk1:

1. **Channel Rack Two-Tone Step Chicklets (`.step-btn-16` & `.beat-group-alt`):**
   - Steps 1–4 and 9–12 are styled in cool dark slate, while Steps 5–8 and 13–16 use warm reddish-plum slate, giving instant peripheral beat-group recognition identical to FL Studio's Channel Rack.
   - Active steps illuminate in bright warm orange-gold with a glowing emerald bottom LED bar; parameter-locked steps display a cyan `.has-plock` dot; micro-nudged steps display a crisp top-right `.micro-badge` pill (e.g. `-2`, `+3`); and the currently inspected/held step shows a cyan focus ring (`.selected-step`).
2. **Step Micro-Timing Inspector Bar:**
   - Displays the selected/held step's exact pitch or drum slice, velocity, active P-Locks, and 128th sub-tick offset (`-4/128` to `+3/128`), alongside quick `[◄ -1/128]` / `[+1/128 ►]` nudge controls (mirrored on hardware via `Hold Step + SHIFT + Knob 3` or `SHIFT + Pads 11/12`).
3. **FL Studio Playlist Arrangement Bar (`.song-chain-bar` & `.chain-block`):**
   - Renders chained patterns (`P1 -> P1 -> P2 -> P3`) as color-accented Playlist clips with live active-bar highlighting.
4. **16-Track Insert Mixer & Sidechain Meters:**
   - Individual insert channel strips with voice-trigger LEDs, step counters, `[M]` Mute, `[S]` Solo, `[D]` (Cyan Sidechain Duck) / `[SC]` (Orange Sidechain Trigger Source) badges, and real-time animated `#sidechain-duck-fill` + `#comp-gr-fill` gain reduction meters in the Master DSP Rack.

---

## 18. Developer Architecture & Contributor Reference

### 1. Codebase Module Map
```
src/
├── main.js                     # Application bootstrap, SessionLogger init, Audio/MIDI/UI wiring
├── audio/
│   ├── AudioEngine.js          # Master Web Audio graph, Sidechain Ducking Bus, PO Dual Filter, Glue Comp
│   ├── SampleSlot.js           # Voice playback, Pitch-Only OLA cache vs Squeeze, 4ms anti-bleed slice guard
│   ├── PunchInFX.js            # 8 momentary performance FX (parallel HPF/LPF, SP-1200, Vinyl Brake, Dub Echo)
│   ├── TransientDetector.js    # Spectral energy transient auto-slicer (16 slices)
│   ├── AudioRecorder.js        # Line-In / Mic & bit-perfect Tab Audio capture (-0.5 dB auto-normalizer)
│   └── AudioExporter.js        # 100x speed OfflineAudioContext renderer (128th micro-timing + sidechain WAV)
├── sequencer/
│   ├── StepData.js             # StepData (polyphonic notes[], pLocks, -4..+3 microTiming) & Pattern (1x-8x zoom)
│   └── Sequencer.js            # 100ms lookahead scheduler, Freeform Auto-BPM 128th loop capture, step nudging
├── midi/
│   ├── ApcConstants.js         # APC Key 25 Mk1/Mk2 Note/CC constants, LED velocities, SysEx, FX names
│   ├── MidiMappingConfig.js    # Top-Down / Bottom-Up 8x5 coordinate profiles & calibration persistence
│   └── MidiManager.js          # Web MIDI I/O, Ch 1 vs Ch 2 strict isolation, Shift+Row 0/1 tools, Eco LED cache
├── presets/
│   └── SampleLibrary.js        # Real-time procedural DSP synthesis for 46 Melodic + 14 Drum Kit presets
├── project/
│   └── ProjectManager.js       # Version 2 localStorage schema persistence & clean 4/4 kick project initializer
├── ui/
│   ├── UIManager.js            # Hardware-to-DOM controller, deferred step-hold inspector, delta pot nudging
│   ├── MixerRackView.js        # 16-track Insert Mixer strips ([M]/[S]/[D]/[SC]) & Master DSP readouts
│   ├── WaveformView.js         # Canvas waveform renderer with trim handles & 16-slice markers
│   ├── KeyboardView.js         # On-screen 25-key chromatic / 16-slice touch keyboard
│   ├── MinimalPoView.js        # Pocket Operator segment LCD & animated K.O! Boxer canvas
│   └── GuidedTester.js         # Interactive APC Key 25 diagnostic wizard & ASCII hardware map
└── logging/
    └── SessionLogger.js        # Console interceptor & automatic ISO-timestamped session log archiver
```

### 2. Web Audio DSP Signal Flow (`AudioEngine.js` & `AudioExporter.js`)
Both real-time playback and offline 16-bit WAV rendering share an identical bus topology:
```
[Melodic/Ducked SampleSlots (D = true)] ──► [sidechainBus] ──► [sidechainGain (ducked by SC)] ─┐
                                                                                                ├──► [voicesBus]
[Kick/Unducked SampleSlots  (D = false)] ────────────────────► [unduckedBus (1.0 unity)] ───────┘
                                                                                                       │
[Destination] ◄── [Master Gain] ◄── [Soft-Clipper] ◄── [Glue Comp] ◄── [PunchInFX] ◄── [PO LPF/HPF] ◄──┘
```
* **Zero-Click Sidechain Envelope:** When the designated `sidechainSource` track (default Slot 8 / Track 9) triggers a step, `triggerSidechainDuck(when)` schedules a `5ms` linear ramp down to `max(0.02, 1.0 - depth * 0.95)` followed by an exponential recovery ramp over `sidechainRelease` (`0.04s–0.50s`).

### 3. Canonical 128th-Tick Bijection & Hardware Step-Hold Architecture
* **Bijective Zoom Math (`Pattern.setZoom`):** Every 4/4 bar contains `128` canonical ticks (`0..127`). For any zoom factor $Z \in \{1, 2, 4, 8\}$ with `numSteps` $= 16Z$ and ticks-per-step $T = 128 / (16Z) \in \{8, 4, 2, 1\}$:
  - **Forward (`(step, micro) -> tick`):** $\text{tick} = ((s \cdot T + \text{micro}) \bmod 128 + 128) \bmod 128$.
  - **Inverse (`tick -> (step, micro)`):** With $H = \lfloor T / 2 \rfloor$, $u = \lfloor (\text{tick} + H) / T \rfloor$, $\text{step} = u \bmod (16Z)$, and $\text{micro} = \text{tick} - u \cdot T \in [-H, H - 1]$.
  - Because $16 \times 8 = 32 \times 4 = 64 \times 2 = 128 \times 1 = 128$, zooming arbitrarily between `1X`, `2X`, `4X`, and `8X` is 100% lossless for both positive and negative micro-timing offsets.
* **Potentiometer Relative Delta Nudging (`UIManager._handleSetupKnobParam`):** Because the physical knobs on the Akai APC Key 25 Mk1 are absolute `0..127` potentiometers (not endless rotary encoders), `Shift + Knob 3` tracks `_lastNudgeKnobVal` with a 2-unit jitter deadzone so clockwise turns always nudge `+1/128th` and counter-clockwise turns always nudge `-1/128th` regardless of absolute knob position.
* **Non-Destructive Active Step Holding (`UIManager` `onStepToggle` / `onStepHold`):** Pressing an inactive pad activates it immediately on `NoteOn`. Pressing an *already-active* pad defers deactivation (`_pendingToggleOffStep`) until `NoteOff` (`onStepHold(pad, false)`). If the artist applies a Parameter Lock or 128th-note Nudge while holding the pad (`_stepModifiedDuringHold = true`), deactivation is cancelled so holding a step to edit it never deletes the note.

### 4. Project Persistence Schema v2 (`ProjectManager.js`)
`ProjectManager.saveProject()` serializes a backward-compatible `version: 2` JSON payload to `localStorage` (`open_ko_project_v1`), storing:
- Global `bpm`, `swing`, `recordMode` (`'freeform'` | `'quantized'`), `activePatternIndex`, `patternChain`, `activeSlotIndex`, and `sidechain` (`{ enabled, source, depth, release }`).
- Per-pattern `zoom` (`1 | 2 | 4 | 8`), `length`, `trackMutes`, `trackSolos`, and sparse active steps (`{ idx, noteOrSlice, notes, velocity, microTiming, pLocks }`).
- Per-slot `stretchMode` (`'pitch_only'` | `'resample'`), `sidechainDucked`, `pitch`, `trimStart`, `trimEnd`, `decay`, `volume`, `loop`, and `selectedSliceIndex`.

### 5. Running Automated Tests & Production Builds
* **Node.js CLI Test Runner (All 12 Test Suites / 73 Unit Tests):**
  ```bash
  node tests/run-tests.js
  ```
* **Browser Interactive Unit Test Runner:** Open `tests.html` via your local dev server.
* **Production Bundle Verification:**
  ```bash
  npx vite build
  ```
  Compiles optimized static assets into `dist/` with zero runtime dependencies.






