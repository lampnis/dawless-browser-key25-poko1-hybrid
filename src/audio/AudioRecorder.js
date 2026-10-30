/**
 * Open-KO: AudioRecorder
 * High-fidelity hardware sampling module for USB interfaces (e.g. PreSonus AudioBox USB 96)
 * and microphone inputs with direct slot assignment and buffer normalization.
 */

export class AudioRecorder {
  constructor(audioContext) {
    this.ctx = audioContext;
    this.mediaStream = null;
    this.sourceNode = null;
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;

    this.isRecording = false;
    this.isArmed = false;
    this.activeDeviceId = null;

    // Recorded PCM sample chunks
    this.recordedChunks = [];
    this.recordNode = null;

    // Callbacks
    this.onLevelUpdate = null; // (peak, rms) => {}
    this.onRecordComplete = null; // (AudioBuffer) => {}

    this._meterInterval = null;
  }

  /**
   * Request microphone / USB interface access with studio-grade settings
   * (disabling aggressive speech enhancements for raw sampler fidelity)
   */
  async initStream(deviceId = null) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('getUserMedia is not supported in this browser.');
    }

    // Stop existing stream if any
    this.stopStream();

    const constraints = {
      audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 2
      }
    };

    this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
    this.activeDeviceId = deviceId;

    // Connect source to analyser for VU metering
    this.sourceNode = this.ctx.createMediaStreamSource(this.mediaStream);
    this.sourceNode.connect(this.analyser);

    this._startMeter();
    return true;
  }

  /**
   * Request direct Computer / Browser Tab / System audio stream (e.g. YouTube, Spotify)
   * via getDisplayMedia with echoCancellation/noiseSuppression disabled for studio sampling.
   */
  async initDisplayStream() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      throw new Error('Tab/Screen audio capture is not supported in this browser. Please use Chrome, Edge, or Brave.');
    }

    this.stopStream();

    // Request display media with audio enabled
    this.mediaStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 2
      }
    });

    const audioTracks = this.mediaStream.getAudioTracks();
    if (!audioTracks || audioTracks.length === 0) {
      this.stopStream();
      throw new Error('No audio track selected! When the browser popup appears, select a Chrome Tab (YouTube, Spotify, etc.) and make sure the "Also share tab audio" checkbox is checked.');
    }

    this.activeDeviceId = 'display_media_tab_audio';
    this.sourceNode = this.ctx.createMediaStreamSource(this.mediaStream);
    this.sourceNode.connect(this.analyser);

    this._startMeter();
    return true;
  }

  /**
   * List available audio input devices (e.g. "AudioBox USB 96")
   */
  async getInputDevices() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return [];
    }
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(d => d.kind === 'audioinput');
  }

  /**
   * Start recording raw PCM data into memory
   */
  startRecording() {
    if (this.isRecording) return;
    if (!this.sourceNode) {
      console.warn('Cannot record: No audio input stream initialized.');
      return;
    }

    this.recordedChunks = [];
    this.isRecording = true;

    // Create ScriptProcessor or AudioWorklet for sample-accurate capture
    const bufferSize = 4096;
    this.recordNode = this.ctx.createScriptProcessor(bufferSize, 2, 2);

    this.recordNode.onaudioprocess = (e) => {
      if (!this.isRecording) return;
      const left = e.inputBuffer.getChannelData(0);
      const right = e.inputBuffer.numberOfChannels > 1 ? e.inputBuffer.getChannelData(1) : left;

      // Copy slices
      this.recordedChunks.push({
        left: new Float32Array(left),
        right: new Float32Array(right)
      });
    };

    this.sourceNode.connect(this.recordNode);
    // Route to a silent gain node before destination to prevent speaker feedback loop / squeal
    if (!this.silentSink) {
      this.silentSink = this.ctx.createGain();
      this.silentSink.gain.value = 0.0;
      this.silentSink.connect(this.ctx.destination);
    }
    this.recordNode.connect(this.silentSink);
  }

  /**
   * Stop recording, assemble and normalize AudioBuffer
   */
  stopRecording() {
    if (!this.isRecording) return null;
    this.isRecording = false;

    if (this.recordNode) {
      try {
        this.recordNode.disconnect();
        this.sourceNode.disconnect(this.recordNode);
      } catch (e) {}
      this.recordNode = null;
    }

    if (this.recordedChunks.length === 0) return null;

    // Calculate total sample length
    let totalSamples = 0;
    for (const chunk of this.recordedChunks) {
      totalSamples += chunk.left.length;
    }

    if (totalSamples === 0) return null;

    // Create target AudioBuffer
    const audioBuffer = this.ctx.createBuffer(2, totalSamples, this.ctx.sampleRate);
    const outL = audioBuffer.getChannelData(0);
    const outR = audioBuffer.getChannelData(1);

    let offset = 0;
    let peak = 0;

    for (const chunk of this.recordedChunks) {
      outL.set(chunk.left, offset);
      outR.set(chunk.right, offset);

      for (let i = 0; i < chunk.left.length; i++) {
        const absL = Math.abs(chunk.left[i]);
        const absR = Math.abs(chunk.right[i]);
        if (absL > peak) peak = absL;
        if (absR > peak) peak = absR;
      }
      offset += chunk.left.length;
    }

    this.recordedChunks = [];

    // Normalize buffer to 0.95 peak (-0.5 dB)
    if (peak > 0.001) {
      const gain = 0.95 / peak;
      for (let i = 0; i < totalSamples; i++) {
        outL[i] *= gain;
        outR[i] *= gain;
      }
    }

    if (this.onRecordComplete) {
      this.onRecordComplete(audioBuffer);
    }

    return audioBuffer;
  }

  stopStream() {
    this._stopMeter();
    if (this.recordNode) {
      try { this.recordNode.disconnect(); } catch (e) {}
      this.recordNode = null;
    }
    if (this.sourceNode) {
      try { this.sourceNode.disconnect(); } catch (e) {}
      this.sourceNode = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
  }

  _startMeter() {
    this._stopMeter();
    const data = new Uint8Array(this.analyser.frequencyBinCount);

    this._meterInterval = setInterval(() => {
      if (!this.sourceNode) return;
      this.analyser.getByteTimeDomainData(data);

      let sum = 0;
      let peak = 0;
      for (let i = 0; i < data.length; i++) {
        const floatVal = (data[i] - 128) / 128;
        const abs = Math.abs(floatVal);
        if (abs > peak) peak = abs;
        sum += floatVal * floatVal;
      }
      const rms = Math.sqrt(sum / data.length);

      if (this.onLevelUpdate) {
        this.onLevelUpdate(peak, rms);
      }
    }, 40);
  }

  _stopMeter() {
    if (this._meterInterval) {
      clearInterval(this._meterInterval);
      this._meterInterval = null;
    }
  }
}
