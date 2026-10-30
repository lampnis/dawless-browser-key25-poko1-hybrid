/**
 * Open-KO: StepData
 * Data models for sequencer steps, parameter locks, tracks, and patterns.
 * Supports:
 * - 128th-note micro-timing resolution
 * - Zoom levels 1x (16th), 2x (32nd), 4x (64th), 8x (128th notes)
 * - Micro-timing nudge across the 128th-note grid
 * - Parameter locking per step
 * - Polyphonic chord layering
 */

export class StepData {
  constructor(active = false, noteOrSlice = 60, velocity = 100, microTiming = 0) {
    this.active = active;
    this.notes = Array.isArray(noteOrSlice) ? [...noteOrSlice] : [noteOrSlice];
    this.velocity = velocity;
    this.microTiming = Math.max(-4, Math.min(3, Math.round(microTiming || 0))); // -4 to +3 in 128th ticks
    this.pLocks = {}; // e.g. { pitch, trimStart, trimEnd, decay, poFilter }
  }

  get noteOrSlice() {
    return this.notes[0];
  }

  set noteOrSlice(val) {
    if (Array.isArray(val)) {
      this.notes = [...val];
    } else {
      this.notes = [val];
    }
  }

  addNote(note, maxPolyphony = 6) {
    if (!this.notes.includes(note)) {
      if (this.notes.length >= maxPolyphony) {
        this.notes.shift();
      }
      this.notes.push(note);
    }
  }

  setMicroTiming(offset) {
    this.microTiming = Math.max(-4, Math.min(3, Math.round(offset || 0)));
  }

  nudge(deltaTicks = 1) {
    this.microTiming = Math.max(-4, Math.min(3, this.microTiming + Math.round(deltaTicks)));
    return this.microTiming;
  }

  setLock(param, value) {
    this.pLocks[param] = value;
  }

  clearLock(param) {
    delete this.pLocks[param];
  }

  clearAllLocks() {
    this.pLocks = {};
  }

  clone() {
    const copy = new StepData(this.active, [...this.notes], this.velocity, this.microTiming);
    copy.pLocks = { ...this.pLocks };
    return copy;
  }
}

export class Pattern {
  constructor(id = 0, zoom = 1) {
    this.id = id;
    this.name = `Pattern ${id + 1}`;
    this.zoom = (zoom === 8 || zoom === 4 || zoom === 2) ? zoom : 1;
    this.length = 16 * this.zoom;

    // 16 tracks (one for each sound slot) x steps
    this.tracks = [];
    this.trackMutes = new Array(16).fill(false); // true = muted
    this.trackSolos = new Array(16).fill(false); // true = soloed

    for (let t = 0; t < 16; t++) {
      const defaultNote = t < 8 ? 60 : 0; // Root note C4 for melodic, slice 0 for drums
      const steps = [];
      for (let s = 0; s < this.length; s++) {
        steps.push(new StepData(false, defaultNote, 100, 0));
      }
      this.tracks.push(steps);
    }
  }

  /**
   * Set Pattern Zoom (1x = 16 steps, 2x = 32 steps, 4x = 64 steps, 8x = 128 steps)
   * Converts all notes to canonical 128th-tick positions to preserve exact musical timing!
   */
  setZoom(zoomFactor) {
    const validZoom = (zoomFactor === 8) ? 8 : (zoomFactor === 4 ? 4 : (zoomFactor === 2 ? 2 : 1));
    if (validZoom === this.zoom) return;

    const oldZoom = this.zoom || 1;
    const oldLen = 16 * oldZoom;
    const newLen = 16 * validZoom;

    this.zoom = validZoom;
    this.length = newLen;

    const oldTicksPerStep = 128 / oldLen; // e.g. 1x => 8 ticks, 2x => 4 ticks, 4x => 2 ticks, 8x => 1 tick
    const newTicksPerStep = 128 / newLen;

    for (let t = 0; t < 16; t++) {
      const defaultNote = t < 8 ? 60 : 0;
      const oldSteps = this.tracks[t] || [];
      const newSteps = [];
      for (let s = 0; s < newLen; s++) {
        newSteps.push(new StepData(false, defaultNote, 100, 0));
      }

      for (let s = 0; s < oldLen; s++) {
        const oldStep = oldSteps[s];
        if (oldStep && oldStep.active) {
          // Calculate canonical 128th-tick position (0..127 with bar wraparound bijection)
          const nominalTick = s * oldTicksPerStep;
          const canonicalTick = (((Math.round(nominalTick + (oldStep.microTiming || 0))) % 128) + 128) % 128;

          // Map canonical tick to nearest step index and centered sub-tick micro-timing [-T/2 .. T/2 - 1]
          const halfNew = Math.floor(newTicksPerStep / 2);
          const unwrappedStep = Math.floor((canonicalTick + halfNew) / newTicksPerStep);
          const targetStep = unwrappedStep % newLen;
          const remainderTick = canonicalTick - (unwrappedStep * newTicksPerStep);

          const target = newSteps[targetStep];
          if (!target.active) {
            target.active = true;
            target.notes = [...oldStep.notes];
            target.velocity = oldStep.velocity;
            target.setMicroTiming(newTicksPerStep > 1 ? remainderTick : 0);
            target.pLocks = { ...oldStep.pLocks };
          } else {
            // Merge polyphonic notes if multiple hits fall into the same step
            for (const n of oldStep.notes) {
              target.addNote(n);
            }
          }
        }
      }

      this.tracks[t] = newSteps;
    }
  }

  /**
   * Nudge a note forward or backward on the 128th-note grid
   */
  nudgeStep(slotIndex, stepIndex, deltaTicks = 1) {
    const track = this.tracks[slotIndex];
    if (!track || !track[stepIndex] || !track[stepIndex].active) return null;

    const step = track[stepIndex];
    const ticksPerStep = 128 / this.length;

    if (ticksPerStep === 1) {
      // At 8x zoom (128 discrete steps), move directly to neighboring step
      const targetStep = Math.max(0, Math.min(this.length - 1, stepIndex + deltaTicks));
      if (targetStep !== stepIndex) {
        const dest = track[targetStep];
        if (!dest.active) {
          track[targetStep] = step.clone();
        } else {
          for (const n of step.notes) dest.addNote(n);
        }
        track[stepIndex] = new StepData(false, slotIndex < 8 ? 60 : 0, 100, 0);
        return { newStep: targetStep, microTiming: 0 };
      }
    } else {
      // At 1x, 2x, 4x zoom, nudge micro-timing sub-ticks across [-T/2 .. T/2 - 1]
      const curMicro = step.microTiming || 0;
      const newMicro = curMicro + deltaTicks;

      const minMicro = -Math.floor(ticksPerStep / 2);
      const maxMicro = Math.floor(ticksPerStep / 2) - 1;

      if (newMicro > maxMicro && stepIndex < this.length - 1) {
        // Shift into next step seamlessly on 128th grid
        const nextStep = track[stepIndex + 1];
        if (!nextStep.active) {
          nextStep.active = true;
          nextStep.notes = [...step.notes];
          nextStep.velocity = step.velocity;
          nextStep.setMicroTiming(newMicro - ticksPerStep);
          nextStep.pLocks = { ...step.pLocks };
        } else {
          for (const n of step.notes) nextStep.addNote(n);
        }
        step.active = false;
        step.microTiming = 0;
        step.clearAllLocks();
        return { newStep: stepIndex + 1, microTiming: nextStep.microTiming };
      } else if (newMicro < minMicro && stepIndex > 0) {
        // Shift into previous step seamlessly on 128th grid
        const prevStep = track[stepIndex - 1];
        if (!prevStep.active) {
          prevStep.active = true;
          prevStep.notes = [...step.notes];
          prevStep.velocity = step.velocity;
          prevStep.setMicroTiming(newMicro + ticksPerStep);
          prevStep.pLocks = { ...step.pLocks };
        } else {
          for (const n of step.notes) prevStep.addNote(n);
        }
        step.active = false;
        step.microTiming = 0;
        step.clearAllLocks();
        return { newStep: stepIndex - 1, microTiming: prevStep.microTiming };
      } else {
        const clamped = Math.max(minMicro, Math.min(maxMicro, newMicro));
        step.setMicroTiming(clamped);
        return { newStep: stepIndex, microTiming: step.microTiming };
      }
    }
    return { newStep: stepIndex, microTiming: step.microTiming };
  }

  clear() {
    for (let t = 0; t < 16; t++) {
      this.clearTrack(t);
    }
  }

  clearTrack(slotIndex) {
    if (this.tracks[slotIndex]) {
      const len = this.tracks[slotIndex].length;
      for (let s = 0; s < len; s++) {
        this.tracks[slotIndex][s].active = false;
        this.tracks[slotIndex][s].clearAllLocks();
        this.tracks[slotIndex][s].microTiming = 0;
      }
    }
  }

  cloneFrom(otherPattern) {
    this.zoom = otherPattern.zoom || 1;
    this.length = otherPattern.length || (16 * this.zoom);
    for (let t = 0; t < 16; t++) {
      this.trackMutes[t] = (otherPattern.trackMutes && otherPattern.trackMutes[t]) || false;
      this.trackSolos[t] = (otherPattern.trackSolos && otherPattern.trackSolos[t]) || false;
      const otherSteps = otherPattern.tracks[t] || [];
      this.tracks[t] = otherSteps.map(s => s.clone());
    }
  }

  shiftTrackSteps(slotIndex, delta = 1) {
    const steps = this.tracks[slotIndex];
    if (!steps) return;
    const len = steps.length;
    const cloned = steps.map(s => s.clone());
    for (let i = 0; i < len; i++) {
      const newIdx = (i + delta + len) % len;
      steps[newIdx] = cloned[i];
    }
  }

  humanizeTrackVelocity(slotIndex, amount = 15) {
    const steps = this.tracks[slotIndex];
    if (!steps) return;
    for (const step of steps) {
      if (step.active) {
        const rand = Math.round((Math.random() * 2 - 1) * amount);
        step.velocity = Math.max(20, Math.min(127, step.velocity + rand));
      }
    }
  }
}
