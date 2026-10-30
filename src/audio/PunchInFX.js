/**
 * Open-KO: PunchInFX
 * Overhauled 8 Momentary Performance FX Bank:
 * 0: 1/8 Stutter (Beat Freeze Repeater)
 * 1: 1/16 Beat Roll (Machine-gun Glitch Fill)
 * 2: 12-Bit SP-1200 Bitcrush (Vintage Lo-Fi Crunch)
 * 3: Vinyl Brake / Tape Stop (Authentic Turntable Slow-down & Restart)
 * 4: Resonant HPF Sweep (Crisp High-Pass Sweep)
 * 5: Resonant LPF Sub-Drop (Heavy Low-Pass Bass Drop)
 * 6: French House / Sidechain Duck Pump (Rhythmic 4/4 Pumping)
 * 7: Dub Space Echo Wash (Analog Tape Delay Wash)
 */

export class PunchInFX {
  constructor(audioContext) {
    this.ctx = audioContext;
    this.bpm = 120;

    // Active state set
    this.activeFx = new Set();

    // Master FX Inserts
    this.input = this.ctx.createGain();
    this.output = this.ctx.createGain();

    // 1. Bitcrusher Stage (12-bit / 8-bit SP-1200 vintage crunch)
    this.bitcrushNode = this.ctx.createWaveShaper();
    this.bitcrushNode.curve = this._createBitcrushCurve(6);
    this.bitcrushFilter = this.ctx.createBiquadFilter();
    this.bitcrushFilter.type = 'lowpass';
    this.bitcrushFilter.frequency.value = 7500; // Warm analog anti-aliasing
    this.bitcrushBypass = this.ctx.createGain();
    this.bitcrushWet = this.ctx.createGain();
    this.bitcrushWet.gain.value = 0.0;
    this.bitcrushBypass.gain.value = 1.0;

    // 2. Dual Stutter & Beat Roll Delays
    this.stutterDelay = this.ctx.createDelay(2.0);
    this.stutterDelay.delayTime.value = 0.25;
    this.stutterFilter = this.ctx.createBiquadFilter(); // Cuts mud < 140Hz
    this.stutterFilter.type = 'highpass';
    this.stutterFilter.frequency.value = 140;
    this.stutterFeedback = this.ctx.createGain();
    this.stutterFeedback.gain.value = 0.0;
    this.stutterWet = this.ctx.createGain();
    this.stutterWet.gain.value = 0.0;
    this.stutterDry = this.ctx.createGain();
    this.stutterDry.gain.value = 1.0;

    // 3. Vinyl Brake / Tape Stop Delay & Lowpass
    this.tapeDelay = this.ctx.createDelay(1.5);
    this.tapeDelay.delayTime.value = 0.0;
    this.tapeFilter = this.ctx.createBiquadFilter();
    this.tapeFilter.type = 'lowpass';
    this.tapeFilter.frequency.value = 20000;

    // 4. Dedicated HPF Sweep Branch
    this.hpfSweep = this.ctx.createBiquadFilter();
    this.hpfSweep.type = 'highpass';
    this.hpfSweep.frequency.value = 20;
    this.hpfSweep.Q.value = 3.6;
    this.hpfWet = this.ctx.createGain();
    this.hpfWet.gain.value = 0.0;

    // 5. Dedicated LPF Sub-Drop Branch
    this.lpfSweep = this.ctx.createBiquadFilter();
    this.lpfSweep.type = 'lowpass';
    this.lpfSweep.frequency.value = 20000;
    this.lpfSweep.Q.value = 3.5;
    this.lpfWet = this.ctx.createGain();
    this.lpfWet.gain.value = 0.0;

    // 6. Sidechain Duck Pump Gain
    this.pumpGain = this.ctx.createGain();
    this.pumpGain.gain.value = 1.0;
    this.pumpIntervalId = null;

    // 7. Dub Space Echo (Warm, tape saturated, non-screeching)
    this.spaceDelay = this.ctx.createDelay(2.0);
    this.spaceDelay.delayTime.value = 0.28;
    this.spaceFeedback = this.ctx.createGain();
    this.spaceFeedback.gain.value = 0.52;
    this.spaceFilter = this.ctx.createBiquadFilter();
    this.spaceFilter.type = 'lowpass';
    this.spaceFilter.frequency.value = 1800;
    this.spaceFilter.Q.value = 0.707;
    this.spaceSaturation = this.ctx.createWaveShaper();
    this.spaceSaturation.curve = this._createSoftSaturatorCurve();
    this.spaceWet = this.ctx.createGain();
    this.spaceWet.gain.value = 0.0;

    this._setupGraph();
  }

  _createSoftSaturatorCurve() {
    const n = 256;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = Math.tanh(x * 1.2) * 0.85;
    }
    return curve;
  }

  _createBitcrushCurve(bits = 6) {
    const samples = 1024;
    const curve = new Float32Array(samples);
    const step = Math.pow(0.5, bits);
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = step * Math.round(x / step);
    }
    return curve;
  }

  _setupGraph() {
    const ctx = this.ctx;

    // Bitcrush branch
    this.input.connect(this.bitcrushBypass);
    this.input.connect(this.bitcrushNode);
    this.bitcrushNode.connect(this.bitcrushFilter);
    this.bitcrushFilter.connect(this.bitcrushWet);

    const postBitcrush = ctx.createGain();
    this.bitcrushBypass.connect(postBitcrush);
    this.bitcrushWet.connect(postBitcrush);

    // Stutter / Beat Roll loop
    postBitcrush.connect(this.stutterDry);
    postBitcrush.connect(this.stutterDelay);
    this.stutterDelay.connect(this.stutterFilter);
    this.stutterFilter.connect(this.stutterFeedback);
    this.stutterFeedback.connect(this.stutterDelay);
    this.stutterFilter.connect(this.stutterWet);

    const postStutter = ctx.createGain();
    this.stutterDry.connect(postStutter);
    this.stutterWet.connect(postStutter);

    // Vinyl Brake Delay & Filter
    postStutter.connect(this.tapeDelay);
    this.tapeDelay.connect(this.tapeFilter);

    // Sweep Filters in parallel crossfade
    const preSweeps = ctx.createGain();
    this.tapeFilter.connect(preSweeps);

    preSweeps.connect(this.hpfSweep);
    this.hpfSweep.connect(this.hpfWet);

    preSweeps.connect(this.lpfSweep);
    this.lpfSweep.connect(this.lpfWet);

    const postSweeps = ctx.createGain();
    preSweeps.connect(postSweeps); // Dry thru
    this.hpfWet.connect(postSweeps);
    this.lpfWet.connect(postSweeps);

    // Sidechain Pump Gain
    postSweeps.connect(this.pumpGain);

    // Main line to output
    this.pumpGain.connect(this.output);

    // Dub Space Delay Send
    this.pumpGain.connect(this.spaceDelay);
    this.spaceDelay.connect(this.spaceFilter);
    this.spaceFilter.connect(this.spaceFeedback);
    this.spaceFeedback.connect(this.spaceSaturation);
    this.spaceSaturation.connect(this.spaceDelay);
    this.spaceFilter.connect(this.spaceWet);
    this.spaceWet.connect(this.output);
  }

  setBpm(bpm) {
    this.bpm = Math.max(40, Math.min(260, Math.round(bpm)));
  }

  /**
   * Trigger or release a punch-in FX (0 to 7)
   */
  trigger(fxIndex, active, velocity = 100) {
    const now = this.ctx.currentTime;
    const beatSec = 60 / this.bpm;

    if (active) {
      this.activeFx.add(fxIndex);
    } else {
      this.activeFx.delete(fxIndex);
    }

    switch (fxIndex) {
      // FX 0: Stutter 1/8 (Smooth Crossfaded Beat Freeze)
      case 0: {
        const stutterTime = beatSec / 2;
        if (active) {
          try {
            this.stutterDelay.delayTime.setValueAtTime(stutterTime, now);
            this.stutterFeedback.gain.cancelScheduledValues(now);
            this.stutterFeedback.gain.setTargetAtTime(0.93, now, 0.015);
            this.stutterWet.gain.setTargetAtTime(1.0, now, 0.015);
            this.stutterDry.gain.setTargetAtTime(0.08, now, 0.015);
          } catch (e) {}
        } else {
          try {
            this.stutterFeedback.gain.setTargetAtTime(0.0, now, 0.02);
            this.stutterWet.gain.setTargetAtTime(0.0, now, 0.02);
            this.stutterDry.gain.setTargetAtTime(1.0, now, 0.02);
          } catch (e) {}
        }
        break;
      }

      // FX 1: 1/16 Beat Roll (Machine-Gun Glitch Fill)
      case 1: {
        const rollTime = beatSec / 4;
        if (active) {
          try {
            this.stutterDelay.delayTime.setValueAtTime(rollTime, now);
            this.stutterFeedback.gain.cancelScheduledValues(now);
            this.stutterFeedback.gain.setTargetAtTime(0.94, now, 0.01);
            this.stutterWet.gain.setTargetAtTime(1.0, now, 0.01);
            this.stutterDry.gain.setTargetAtTime(0.08, now, 0.01);
          } catch (e) {}
        } else {
          try {
            this.stutterFeedback.gain.setTargetAtTime(0.0, now, 0.02);
            this.stutterWet.gain.setTargetAtTime(0.0, now, 0.02);
            this.stutterDry.gain.setTargetAtTime(1.0, now, 0.02);
          } catch (e) {}
        }
        break;
      }

      // FX 2: 12-Bit SP-1200 Vintage Bitcrush
      case 2: {
        try {
          if (active) {
            this.bitcrushBypass.gain.setTargetAtTime(0.0, now, 0.01);
            this.bitcrushWet.gain.setTargetAtTime(0.95, now, 0.01);
          } else {
            this.bitcrushBypass.gain.setTargetAtTime(1.0, now, 0.01);
            this.bitcrushWet.gain.setTargetAtTime(0.0, now, 0.01);
          }
        } catch (e) {}
        break;
      }

      // FX 3: Vinyl Brake / Tape Stop
      case 3: {
        try {
          if (active) {
            this.tapeDelay.delayTime.cancelScheduledValues(now);
            this.tapeDelay.delayTime.setValueAtTime(0.0, now);
            this.tapeDelay.delayTime.linearRampToValueAtTime(0.42, now + 0.38);
            this.tapeFilter.frequency.cancelScheduledValues(now);
            this.tapeFilter.frequency.exponentialRampToValueAtTime(320, now + 0.38);
          } else {
            this.tapeDelay.delayTime.cancelScheduledValues(now);
            this.tapeDelay.delayTime.linearRampToValueAtTime(0.0, now + 0.22);
            this.tapeFilter.frequency.cancelScheduledValues(now);
            this.tapeFilter.frequency.exponentialRampToValueAtTime(20000, now + 0.22);
          }
        } catch (e) {}
        break;
      }

      // FX 4: Resonant HPF Sweep
      case 4: {
        try {
          if (active) {
            this.hpfSweep.frequency.cancelScheduledValues(now);
            this.hpfSweep.frequency.setValueAtTime(30, now);
            this.hpfSweep.frequency.exponentialRampToValueAtTime(3800, now + 0.35);
            this.hpfWet.gain.setTargetAtTime(0.9, now, 0.015);
          } else {
            this.hpfWet.gain.setTargetAtTime(0.0, now, 0.04);
            this.hpfSweep.frequency.setValueAtTime(30, now + 0.05);
          }
        } catch (e) {}
        break;
      }

      // FX 5: Resonant LPF Sub-Drop
      case 5: {
        try {
          if (active) {
            this.lpfSweep.frequency.cancelScheduledValues(now);
            this.lpfSweep.frequency.setValueAtTime(19000, now);
            this.lpfSweep.frequency.exponentialRampToValueAtTime(220, now + 0.35);
            this.lpfWet.gain.setTargetAtTime(0.9, now, 0.015);
          } else {
            this.lpfWet.gain.setTargetAtTime(0.0, now, 0.04);
            this.lpfSweep.frequency.setValueAtTime(20000, now + 0.05);
          }
        } catch (e) {}
        break;
      }

      // FX 6: French House / Sidechain Duck Pump
      case 6: {
        if (active) {
          this._startPump(beatSec);
        } else {
          this._stopPump();
        }
        break;
      }

      // FX 7: Dub Space Echo Wash
      case 7: {
        try {
          if (active) {
            const targetDelay = Math.min(1.2, Math.max(0.08, beatSec * 0.75));
            this.spaceDelay.delayTime.setTargetAtTime(targetDelay, now, 0.04);
            this.spaceFeedback.gain.setTargetAtTime(0.62, now, 0.03);
            this.spaceWet.gain.setTargetAtTime(0.85, now, 0.02);
          } else {
            this.spaceWet.gain.linearRampToValueAtTime(0.0, now + 0.5);
            this.spaceFeedback.gain.setTargetAtTime(0.0, now, 0.15);
          }
        } catch (e) {}
        break;
      }
    }
  }

  _startPump(beatSec) {
    this._stopPump();
    const pumpQuarter = () => {
      const now = this.ctx.currentTime;
      const g = this.pumpGain.gain;
      try {
        g.cancelScheduledValues(now);
        g.setValueAtTime(0.08, now);
        g.exponentialRampToValueAtTime(1.0, now + (beatSec * 0.7));
      } catch (e) {}
    };
    pumpQuarter();
    this.pumpIntervalId = setInterval(pumpQuarter, beatSec * 1000);
  }

  _stopPump() {
    if (this.pumpIntervalId) {
      clearInterval(this.pumpIntervalId);
      this.pumpIntervalId = null;
    }
    const now = this.ctx.currentTime;
    try {
      this.pumpGain.gain.cancelScheduledValues(now);
      this.pumpGain.gain.setValueAtTime(1.0, now);
    } catch (e) {}
  }
}
