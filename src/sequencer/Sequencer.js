/**
 * Open-KO: Sequencer
 * High-precision lookahead audio scheduler supporting:
 * - Play/Pause (resumes from current step timestamp)
 * - Stop & Reset (resets playhead to start)
 * - 16 chainable patterns x 16 tracks
 * - 128th-note micro-timing scheduling & live recording
 * - Micro-timing nudge across the 128th-note grid
 * - Freeform first-loop recording with automatic tempo (BPM) detection
 * - Parameter locking per step
 * - Track muting & soloing
 * - Swing / groove timing
 * - Live recording with velocity sensitivity
 */

import { Pattern, StepData } from './StepData.js';

export class Sequencer {
  constructor(audioEngine) {
    this.audioEngine = audioEngine;
    this.ctx = audioEngine.ctx;

    // 16 Patterns
    this.patterns = [];
    for (let i = 0; i < 16; i++) {
      this.patterns.push(new Pattern(i));
    }
    this.activePatternIndex = 0;
    this.queuedPatternIndex = -1; // Next pattern waiting for bar downbeat
    this.patternChain = [0]; // Pattern sequence list, e.g. [0, 0, 1, 1]
    this.chainPosition = 0;

    // Tempo & Timing
    this.bpm = 92; // Default Lo-Fi hip hop tempo
    this.swing = 50; // 50 = straight, 54 = light swing, 60 = medium, 66 = heavy
    this.isPlaying = false;
    this.isPaused = false;
    this.isRecording = false; // Live record mode
    this.metronomeEnabled = false;

    // Recording Mode: 'freeform' (default, auto-BPM 128th-note loop capture) or 'quantized' (overdub)
    this.recordMode = 'freeform';
    this.isWaitingForFirstHit = false;
    this.freeformEvents = [];
    this.freeformStartTime = 0;

    // Lookahead Scheduler properties
    this.lookaheadMs = 25.0;         // Interval of worker/timer tick in ms
    this.scheduleAheadTimeSec = 0.1; // Window to schedule audio events ahead (100ms)
    this.currentStep = 0;            // 0 to 15 (or up to pattern length)
    this.nextStepTime = 0.0;         // AudioContext time for next step

    this._timerId = null;

    // Visual synchronization queue
    this.scheduledStepQueue = []; // [{ step, time, pattern }]

    // Callbacks
    this.onStepTick = null;          // (stepIndex, patternIndex) => {}
    this.onPlayChange = null;        // (isPlaying, isPaused) => {}
    this.onPatternChange = null;     // (patternIndex, chainPos) => {}
    this.onPatternQueued = null;     // (patternIndex) => {}
    this.onRecordStateChange = null; // (isRecording, recordMode, isWaitingForFirstHit) => {}
    this.onStepRecorded = null;      // (slotIndex, stepIndex, microTiming) => {}
    this.onTrackMuteChange = null;   // (slotIndex, isMuted) => {}
    this.onTrackSoloChange = null;   // (slotIndex, isSoloed) => {}
    this.onZoomChange = null;        // (zoom, length) => {}
    this.onFreeformLoopCaptured = null; // ({ bpm, barCount, eventsCount }) => {}
  }

  getCurrentPattern() {
    return this.patterns[this.activePatternIndex];
  }

  setBpm(bpm) {
    this.bpm = Math.max(40, Math.min(260, Math.round(bpm)));
    if (this.audioEngine && this.audioEngine.punchInFx) {
      this.audioEngine.punchInFx.setBpm(this.bpm);
    }
  }

  setSwing(val) {
    this.swing = Math.max(50, Math.min(75, val));
  }

  setRecordMode(mode) {
    if (mode === 'freeform' || mode === 'quantized') {
      this.recordMode = mode;
      if (this.onRecordStateChange) {
        this.onRecordStateChange(this.isRecording, this.recordMode, this.isWaitingForFirstHit);
      }
    }
  }

  toggleRecordMode() {
    this.recordMode = (this.recordMode === 'freeform') ? 'quantized' : 'freeform';
    if (this.onRecordStateChange) {
      this.onRecordStateChange(this.isRecording, this.recordMode, this.isWaitingForFirstHit);
    }
    return this.recordMode;
  }

  getStepDuration() {
    const pattern = this.getCurrentPattern();
    const zoom = (pattern && pattern.zoom) ? pattern.zoom : 1;
    // 16th note at 1x, 32nd note at 2x, 64th note at 4x, 128th note at 8x
    return (60.0 / this.bpm) / (4.0 * zoom);
  }

  getPatternLength() {
    const pattern = this.getCurrentPattern();
    return (pattern && pattern.length) ? pattern.length : 16;
  }

  setPatternZoom(zoomFactor) {
    const pattern = this.getCurrentPattern();
    if (pattern) {
      const oldLen = pattern.length;
      pattern.setZoom(zoomFactor);
      const newLen = pattern.length;
      // Rescale playhead position proportionally so playhead stays at exact same musical beat!
      if (oldLen > 0 && newLen > 0) {
        this.currentStep = Math.min(newLen - 1, Math.floor((this.currentStep / oldLen) * newLen));
      }
      if (this.onZoomChange) {
        this.onZoomChange(pattern.zoom, pattern.length);
      }
    }
  }

  /**
   * Transport: Play/Pause Button
   * Keeps playhead at current step timestamp when paused, and resumes from that step!
   */
  async togglePlayPause() {
    await this.audioEngine.ensureAudioContext();

    if (this.isPlaying) {
      // Pause in place
      this.pause();
    } else {
      // Resume from current step
      this.resume();
    }
    return this.isPlaying;
  }

  /**
   * Start / Resume playback from current step
   */
  async resume() {
    if (this.isPlaying) return;
    await this.audioEngine.ensureAudioContext();

    this.isPlaying = true;
    this.isPaused = false;

    const totalSteps = this.getPatternLength();
    if (this.currentStep < 0 || this.currentStep >= totalSteps) {
      this.currentStep = 0;
    }

    this.nextStepTime = this.ctx.currentTime + 0.03;
    this._timerId = setInterval(() => this._schedulerTick(), this.lookaheadMs);

    if (this.onPlayChange) this.onPlayChange(true, false);
  }

  /**
   * Pause playback keeping playhead at current step position
   */
  pause() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    this.isPaused = true;

    if (this._timerId) {
      clearInterval(this._timerId);
      this._timerId = null;
    }

    this.scheduledStepQueue = [];
    this._silenceVoices();

    if (this.onPlayChange) this.onPlayChange(false, true);
  }

  /**
   * Transport: Stop Button
   * Stops playback AND resets the playhead to the very beginning (step 0, pattern 0)
   */
  stopAndReset() {
    this.isPlaying = false;
    this.isPaused = false;
    this.isRecording = false;
    this.isWaitingForFirstHit = false;

    if (this._timerId) {
      clearInterval(this._timerId);
      this._timerId = null;
    }

    this.currentStep = 0;
    this.chainPosition = 0;
    this.queuedPatternIndex = -1;
    if (this.patternChain.length > 0) {
      this.activePatternIndex = this.patternChain[0];
    }
    this.scheduledStepQueue = [];

    this._silenceVoices();

    if (this.onPlayChange) this.onPlayChange(false, false);
    if (this.onRecordStateChange) this.onRecordStateChange(false, this.recordMode, false);
    if (this.onStepTick) this.onStepTick(0, this.activePatternIndex);
    if (this.onPatternChange) this.onPatternChange(this.activePatternIndex, 0);
    if (this.onPatternQueued) this.onPatternQueued(-1);
  }

  _silenceVoices() {
    if (this.audioEngine && this.audioEngine.slots) {
      for (const slot of this.audioEngine.slots) {
        slot.stopAll();
      }
    }
  }

  toggleMetronome() {
    this.metronomeEnabled = !this.metronomeEnabled;
    return this.metronomeEnabled;
  }

  /**
   * Lookahead loop: schedules audio events ahead in time
   */
  _schedulerTick() {
    while (this.nextStepTime < this.ctx.currentTime + this.scheduleAheadTimeSec) {
      // Calculate swing offset on odd 16th steps
      const isOddStep = (this.currentStep % 2 !== 0);
      const stepDur = this.getStepDuration();
      const swingRatio = (this.swing - 50) / 50; // 0.0 to 0.5
      const swingOffset = isOddStep ? (stepDur * 0.45 * swingRatio) : 0;

      const scheduledTime = this.nextStepTime + swingOffset;

      this._scheduleStep(this.currentStep, scheduledTime);
      this._advanceStep();
    }

    // Process visual step queue when audio time matches current time
    const currentTime = this.ctx.currentTime;
    while (this.scheduledStepQueue.length > 0 && this.scheduledStepQueue[0].time <= currentTime) {
      const item = this.scheduledStepQueue.shift();
      if (this.onStepTick) {
        this.onStepTick(item.step, item.pattern);
      }
    }
  }

  /**
   * Advance to the next step
   */
  _advanceStep() {
    const stepDuration = this.getStepDuration();
    this.nextStepTime += stepDuration;

    const totalSteps = this.getPatternLength();
    this.currentStep++;
    if (this.currentStep >= totalSteps) {
      this.currentStep = 0;

      // Handle queued pattern transition on downbeat of next bar!
      if (this.queuedPatternIndex >= 0) {
        this.activePatternIndex = this.queuedPatternIndex;
        this.queuedPatternIndex = -1;
        if (this.patternChain.length > 1) {
          const chainIdx = this.patternChain.indexOf(this.activePatternIndex);
          if (chainIdx !== -1) {
            this.chainPosition = chainIdx;
          }
        }
        if (this.onPatternChange) {
          this.onPatternChange(this.activePatternIndex, this.chainPosition);
        }
        if (this.onPatternQueued) {
          this.onPatternQueued(-1);
        }
      } else if (this.patternChain.length > 1) {
        // Handle pattern chaining
        this.chainPosition = (this.chainPosition + 1) % this.patternChain.length;
        this.activePatternIndex = this.patternChain[this.chainPosition];
        if (this.onPatternChange) {
          this.onPatternChange(this.activePatternIndex, this.chainPosition);
        }
      }
    }
  }

  /**
   * Queue next pattern to switch smoothly on downbeat of next bar.
   * If stopped, switches immediately!
   */
  queuePattern(patternIdx) {
    if (patternIdx >= 0 && patternIdx < 16) {
      if (this.isPlaying) {
        this.queuedPatternIndex = patternIdx;
        if (this.onPatternQueued) {
          this.onPatternQueued(patternIdx);
        }
      } else {
        this.setPattern(patternIdx);
      }
    }
  }

  /**
   * Schedule audio nodes for all 16 tracks at a specific step with 128th-note micro-timing
   */
  _scheduleStep(stepIndex, time) {
    const pattern = this.getCurrentPattern();
    this.scheduledStepQueue.push({ step: stepIndex, time, pattern: this.activePatternIndex });

    const stepDur = this.getStepDuration();
    const zoom = (pattern && pattern.zoom) ? pattern.zoom : 1;
    const ticksPerStep = 128 / (16 * zoom);

    // Schedule Metronome click on quarter notes
    const quarterStepInterval = 4 * zoom;
    if (this.metronomeEnabled && stepIndex % quarterStepInterval === 0) {
      this._scheduleMetronomeClick(time, stepIndex === 0);
    }

    const hasSolo = (pattern && pattern.trackSolos) ? pattern.trackSolos.some(s => s === true) : false;

    // Iterate through all 16 tracks (sound slots)
    for (let slotIdx = 0; slotIdx < 16; slotIdx++) {
      if (pattern.trackMutes && pattern.trackMutes[slotIdx]) continue;
      if (hasSolo && !(pattern.trackSolos && pattern.trackSolos[slotIdx])) continue;

      const step = pattern.tracks[slotIdx][stepIndex];
      if (step && step.active) {
        // Apply 128th-note micro-timing offset
        const tickDuration = stepDur / ticksPerStep;
        const microOffset = (step.microTiming || 0) * tickDuration;
        const noteTime = Math.max(this.ctx.currentTime, time + microOffset);

        if (Array.isArray(step.notes) && step.notes.length > 1) {
          for (const n of step.notes) {
            this.audioEngine.playSlotDirect(
              slotIdx,
              n,
              step.velocity,
              noteTime,
              step.pLocks
            );
          }
        } else {
          this.audioEngine.playSlotDirect(
            slotIdx,
            step.noteOrSlice,
            step.velocity,
            noteTime,
            step.pLocks
          );
        }
      }
    }
  }

  _scheduleMetronomeClick(time, isDownbeat = false) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(isDownbeat ? 1600 : 900, time);

    gain.gain.setValueAtTime(0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);

    osc.connect(gain);
    gain.connect(this.audioEngine.masterGain);

    osc.start(time);
    osc.stop(time + 0.045);
  }

  toggleTrackMute(slotIndex) {
    const p = this.getCurrentPattern();
    p.trackMutes[slotIndex] = !p.trackMutes[slotIndex];
    if (this.onTrackMuteChange) {
      this.onTrackMuteChange(slotIndex, p.trackMutes[slotIndex]);
    }
    return p.trackMutes[slotIndex];
  }

  isTrackMuted(slotIndex) {
    const p = this.getCurrentPattern();
    return (p && p.trackMutes) ? !!p.trackMutes[slotIndex] : false;
  }

  toggleTrackSolo(slotIndex) {
    const p = this.getCurrentPattern();
    if (!p.trackSolos) {
      p.trackSolos = new Array(16).fill(false);
    }
    p.trackSolos[slotIndex] = !p.trackSolos[slotIndex];
    if (this.onTrackSoloChange) {
      this.onTrackSoloChange(slotIndex, p.trackSolos[slotIndex]);
    }
    return p.trackSolos[slotIndex];
  }

  isTrackSoloed(slotIndex) {
    const p = this.getCurrentPattern();
    return (p && p.trackSolos) ? !!p.trackSolos[slotIndex] : false;
  }

  toggleStep(slotIndex, stepIndex, velocity = 100) {
    const pattern = this.getCurrentPattern();
    if (!pattern || !pattern.tracks[slotIndex]) return false;
    const trackSteps = pattern.tracks[slotIndex];
    const safeIdx = stepIndex % trackSteps.length;
    const step = trackSteps[safeIdx];
    step.active = !step.active;

    if (step.active) {
      const activeSlot = this.audioEngine.slots[slotIndex];
      step.noteOrSlice = activeSlot.type === 'melodic' ? 60 : (activeSlot.selectedSliceIndex || 0);
      step.velocity = velocity;
      step.microTiming = 0;
    }

    return step.active;
  }

  /**
   * Nudge a step forward or backward across the 128th-note grid
   */
  nudgeStep(slotIndex, stepIndex, deltaTicks = 1) {
    const pattern = this.getCurrentPattern();
    if (!pattern) return null;
    const res = pattern.nudgeStep(slotIndex, stepIndex, deltaTicks);
    if (res && this.onStepRecorded) {
      this.onStepRecorded(slotIndex, res.newStep, res.microTiming);
    }
    return res;
  }

  /**
   * Transport: Record Toggle
   * In 'freeform' mode (default): Arms freeform recording waiting for first key strike.
   * If already recording in 'freeform' mode: finishes loop, calculates tempo, and maps to 128th grid.
   * In 'quantized' mode: standard loop overdubbing.
   */
  async toggleRecord() {
    await this.audioEngine.ensureAudioContext();

    if (this.recordMode === 'freeform') {
      if (!this.isRecording) {
        // Arm freeform recording: wait for first hit
        this.pause();
        this.isRecording = true;
        this.isWaitingForFirstHit = true;
        this.freeformEvents = [];
        this.freeformStartTime = 0;
      } else {
        // Complete freeform loop recording
        const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() / 1000 : this.ctx.currentTime;
        const durationSec = this.freeformStartTime > 0 ? (now - this.freeformStartTime) : 0;
        return this._finishFreeformLoop(durationSec);
      }
    } else {
      // Standard quantized overdub mode
      this.isRecording = !this.isRecording;
      if (this.isRecording) {
        if (!this.isPlaying) {
          this.currentStep = 0;
          await this.resume();
        }
      }
    }

    if (this.onRecordStateChange) {
      this.onRecordStateChange(this.isRecording, this.recordMode, this.isWaitingForFirstHit);
    }

    return this.isRecording;
  }

  /**
   * Process and finalize freeform loop: calculate BPM and map to 128th-note grid!
   */
  _finishFreeformLoop(durationSec) {
    if (durationSec < 0.4 || this.freeformEvents.length === 0) {
      this.isRecording = false;
      this.isWaitingForFirstHit = false;
      if (this.onRecordStateChange) {
        this.onRecordStateChange(false, this.recordMode, false);
      }
      return null;
    }

    // Auto-BPM detection: find musical bar count (1, 2, or 4 bars) closest to lo-fi / hip-hop groove (~92 BPM)
    let bestBpm = 92;
    let bestBarCount = 1;
    let minDiffFromLoFi = Infinity;

    for (const bars of [1, 2, 4]) {
      const candidateBpm = (bars * 4 * 60) / durationSec;
      if (candidateBpm >= 50 && candidateBpm <= 165) {
        const diff = Math.abs(candidateBpm - 92);
        if (diff < minDiffFromLoFi) {
          minDiffFromLoFi = diff;
          bestBpm = Math.round(candidateBpm);
          bestBarCount = bars;
        }
      }
    }

    if (minDiffFromLoFi === Infinity) {
      bestBpm = Math.max(50, Math.min(180, Math.round((4 * 60) / durationSec)));
      bestBarCount = 1;
    }

    this.setBpm(bestBpm);

    // Total bar length in seconds
    const barDuration = (4 * 60) / bestBpm;
    const pattern = this.getCurrentPattern();
    pattern.clear();
    const zoom = pattern.zoom || 1;
    const numSteps = pattern.length || (16 * zoom);
    const ticksPerStep = 128 / numSteps;
    const halfStep = Math.floor(ticksPerStep / 2);

    // Map each recorded event to the 128th-note grid with centered micro-timing [-T/2 .. T/2 - 1]
    for (const ev of this.freeformEvents) {
      const normalizedTime = ((ev.time % barDuration) + barDuration) % barDuration;
      // 128 ticks per bar (wrap 128 -> 0 for hits right on loop seam)
      const tick128 = Math.round((normalizedTime / barDuration) * 128) % 128;
      const unwrappedStep = Math.floor((tick128 + halfStep) / ticksPerStep);
      const targetStepIdx = unwrappedStep % numSteps;
      const microOffset = ticksPerStep > 1 ? (tick128 - (unwrappedStep * ticksPerStep)) : 0;

      const track = pattern.tracks[ev.slotIndex];
      if (track && track[targetStepIdx]) {
        const step = track[targetStepIdx];
        if (!step.active) {
          step.active = true;
          step.noteOrSlice = ev.noteOrSlice;
          step.velocity = ev.velocity;
          step.setMicroTiming(microOffset);
        } else {
          if (step.addNote) {
            step.addNote(ev.noteOrSlice);
          } else {
            step.noteOrSlice = ev.noteOrSlice;
          }
          step.velocity = Math.max(step.velocity, ev.velocity);
        }
      }
    }

    this.isRecording = false;
    this.isWaitingForFirstHit = false;
    this.currentStep = 0;

    const result = {
      bpm: bestBpm,
      barCount: bestBarCount,
      eventsCount: this.freeformEvents.length
    };

    if (this.onRecordStateChange) {
      this.onRecordStateChange(false, this.recordMode, false);
    }
    if (this.onFreeformLoopCaptured) {
      this.onFreeformLoopCaptured(result);
    }

    // Start playing seamlessly at detected tempo!
    this.resume();
    return result;
  }

  /**
   * Handle incoming live hit (from keys or pads)
   */
  handleLiveHit(slotIndex, noteOrSlice, velocity = 100) {
    if (this.isRecording && this.recordMode === 'freeform') {
      const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() / 1000 : this.ctx.currentTime;
      if (this.isWaitingForFirstHit) {
        this.isWaitingForFirstHit = false;
        this.freeformStartTime = now;
        this.freeformEvents.push({
          slotIndex,
          noteOrSlice,
          velocity,
          time: 0.0
        });
        if (this.onRecordStateChange) {
          this.onRecordStateChange(this.isRecording, this.recordMode, false);
        }
      } else {
        const relTime = now - this.freeformStartTime;
        this.freeformEvents.push({
          slotIndex,
          noteOrSlice,
          velocity,
          time: relTime
        });
      }
      return;
    }

    if (this.isPlaying && this.isRecording) {
      this.recordHit(slotIndex, noteOrSlice, velocity);
    }
  }

  /**
   * Record a live hit into current/quantized step with 128th micro-timing
   */
  recordHit(slotIndex, noteOrSlice, velocity = 100) {
    if (!this.isPlaying || !this.isRecording) return;

    const stepDur = this.getStepDuration();
    const totalSteps = this.getPatternLength();

    // Quantize step index
    const offsetFromNext = this.ctx.currentTime - this.nextStepTime;
    let targetStep;
    if (offsetFromNext >= -stepDur * 0.5) {
      targetStep = this.currentStep % totalSteps;
    } else {
      targetStep = (this.currentStep - 1 + totalSteps) % totalSteps;
    }

    const pattern = this.getCurrentPattern();
    const trackSteps = pattern.tracks[slotIndex];
    if (!trackSteps) return;

    const targetIdx = targetStep % trackSteps.length;
    const step = trackSteps[targetIdx];
    if (!step) return;

    // Calculate 128th micro-timing offset (-4 to +3)
    const zoom = pattern.zoom || 1;
    const ticksPerStep = 128 / (16 * zoom);
    const subTickDur = stepDur / ticksPerStep;
    const nominalStepTime = (targetStep === this.currentStep) ? (this.nextStepTime - stepDur) : (this.nextStepTime - (2 * stepDur));
    const offsetSec = this.ctx.currentTime - nominalStepTime;
    const calculatedSubTicks = Math.round(offsetSec / subTickDur);
    const halfTicks = Math.floor(ticksPerStep / 2);
    const microTiming = Math.max(-halfTicks, Math.min(halfTicks - 1, calculatedSubTicks));

    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const lastHitKey = `${this.activePatternIndex}_${slotIndex}_${targetIdx}`;
    const lastHitTime = this._lastRecordedStepTimes ? this._lastRecordedStepTimes.get(lastHitKey) : null;
    const isChordBurst = lastHitTime && (now - lastHitTime < 140);

    if (!this._lastRecordedStepTimes) {
      this._lastRecordedStepTimes = new Map();
    }
    this._lastRecordedStepTimes.set(lastHitKey, now);

    const slot = this.audioEngine ? this.audioEngine.slots[slotIndex] : null;
    const isDrumSlot = slot && slot.type === 'drum';
    const recordedVal = isDrumSlot ? (((Math.round(noteOrSlice) % 16) + 16) % 16) : noteOrSlice;

    step.active = true;
    step.velocity = velocity;
    step.setMicroTiming(microTiming);

    if (isDrumSlot && step.active) {
      if (step.addNote) {
        step.addNote(recordedVal, 6);
      } else {
        step.noteOrSlice = recordedVal;
      }
    } else if (isChordBurst && step.addNote) {
      step.addNote(recordedVal, 6);
    } else {
      step.noteOrSlice = recordedVal;
    }

    if (this.onStepRecorded) {
      this.onStepRecorded(slotIndex, targetIdx, microTiming);
    }
  }

  setStepParamLock(slotIndex, stepIndex, paramName, value, activateIfInactive = false) {
    const pattern = this.getCurrentPattern();
    if (!pattern || !pattern.tracks[slotIndex]) return;
    const step = pattern.tracks[slotIndex][stepIndex];
    if (!step) return;
    step.setLock(paramName, value);
    if (activateIfInactive) {
      step.active = true;
    }
  }

  clearStepParamLocks(slotIndex, stepIndex) {
    const pattern = this.getCurrentPattern();
    const step = pattern.tracks[slotIndex][stepIndex];
    if (step) step.clearAllLocks();
  }

  getTrackSteps(slotIndex) {
    const pattern = this.getCurrentPattern();
    return pattern.tracks[slotIndex].map(s => s.active);
  }

  setPattern(index) {
    if (index >= 0 && index < 16) {
      this.activePatternIndex = index;
      if (this.onPatternChange) {
        this.onPatternChange(index, this.chainPosition);
      }
    }
  }

  setPatternChain(chainArray) {
    if (Array.isArray(chainArray) && chainArray.length > 0) {
      this.patternChain = [...chainArray];
      this.chainPosition = 0;
    }
  }

  duplicateCurrentPattern() {
    const current = this.getCurrentPattern();
    const nextIdx = (this.activePatternIndex + 1) % 16;
    this.patterns[nextIdx].cloneFrom(current);
    this.setPattern(nextIdx);
    return nextIdx;
  }
}
