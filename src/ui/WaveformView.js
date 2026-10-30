/**
 * Open-KO: WaveformView
 * Real-time canvas waveform visualizer with draggable start/end trim handles,
 * 16 slice markers, playhead tracking, and audio drag-and-drop loading.
 */

export class WaveformView {
  constructor(canvasElement, onTrimChange = null, onSliceChange = null) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.onTrimChange = onTrimChange; // (start, end) => {}
    this.onSliceChange = onSliceChange; // (sliceIndex, start, end) => {}

    this.activeSlot = null;
    this.draggingHandle = null; // 'start', 'end', or sliceIndex
    this.playheadPos = -1; // 0.0 to 1.0

    this._initEvents();
  }

  setSlot(slot) {
    this.activeSlot = slot;
    this.render();
  }

  setPlayhead(pos) {
    this.playheadPos = pos;
    this.render();
  }

  render() {
    const canvas = this.canvas;
    const ctx = this.ctx;
    const width = canvas.width;
    const height = canvas.height;

    // Background: Dark matte retro LCD slate
    ctx.fillStyle = '#1c1f24';
    ctx.fillRect(0, 0, width, height);

    // Center grid line
    ctx.strokeStyle = '#2d333b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    if (!this.activeSlot || !this.activeSlot.buffer) {
      // Empty slot placeholder
      ctx.fillStyle = '#6e7681';
      ctx.font = '12px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('[ NO SAMPLE LOADED - DRAG AUDIO HERE OR LIVE SAMPLE ]', width / 2, height / 2 + 4);
      return;
    }

    const buffer = this.activeSlot.buffer;
    const data = buffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    const amp = height / 2;

    // Draw waveform
    ctx.strokeStyle = '#e67e22'; // Retro amber waveform
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    for (let x = 0; x < width; x++) {
      let min = 1.0;
      let max = -1.0;
      const startIdx = x * step;
      const endIdx = Math.min(startIdx + step, data.length);

      for (let j = startIdx; j < endIdx; j++) {
        const val = data[j];
        if (val < min) min = val;
        if (val > max) max = val;
      }

      ctx.moveTo(x, amp + min * amp * 0.88);
      ctx.lineTo(x, amp + max * amp * 0.88);
    }
    ctx.stroke();

    const duration = buffer.duration;

    // Draw Drum Slices if Drum Slot
    if (this.activeSlot.type === 'drum' && this.activeSlot.slices) {
      for (let i = 0; i < this.activeSlot.slices.length; i++) {
        const slice = this.activeSlot.slices[i];
        const sliceX = (slice.start / duration) * width;
        const isSelected = i === this.activeSlot.selectedSliceIndex;

        // Slice line
        ctx.strokeStyle = isSelected ? '#ff3838' : '#3498db';
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.setLineDash(isSelected ? [] : [4, 4]);
        ctx.beginPath();
        ctx.moveTo(sliceX, 0);
        ctx.lineTo(sliceX, height);
        ctx.stroke();
        ctx.setLineDash([]);

        // Slice number badge
        ctx.fillStyle = isSelected ? '#ff3838' : '#2980b9';
        ctx.fillRect(sliceX + 2, 4, 16, 14);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${i + 1}`, sliceX + 4, 15);
      }
    }

    // Draw Trim Start & End overlays (Melodic slot or global trim)
    const startX = this.activeSlot.trimStart * width;
    const endX = this.activeSlot.trimEnd * width;

    // Dim regions outside trim
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(0, 0, startX, height);
    ctx.fillRect(endX, 0, width - endX, height);

    // Start handle (Green)
    ctx.strokeStyle = '#2ecc71';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(startX, 0);
    ctx.lineTo(startX, height);
    ctx.stroke();

    ctx.fillStyle = '#2ecc71';
    ctx.beginPath();
    ctx.moveTo(startX, 0);
    ctx.lineTo(startX + 10, 0);
    ctx.lineTo(startX, 14);
    ctx.fill();

    // End handle (Red)
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(endX, 0);
    ctx.lineTo(endX, height);
    ctx.stroke();

    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.moveTo(endX, 0);
    ctx.lineTo(endX - 10, 0);
    ctx.lineTo(endX, 14);
    ctx.fill();

    // Playhead indicator
    if (this.playheadPos >= 0 && this.playheadPos <= 1) {
      const playX = this.playheadPos * width;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playX, 0);
      ctx.lineTo(playX, height);
      ctx.stroke();
    }
  }

  _initEvents() {
    const canvas = this.canvas;

    const getXNorm = (e) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    };

    const onDown = (e) => {
      if (!this.activeSlot || !this.activeSlot.buffer) return;
      const xNorm = getXNorm(e);
      const startDist = Math.abs(xNorm - this.activeSlot.trimStart);
      const endDist = Math.abs(xNorm - this.activeSlot.trimEnd);

      if (startDist < 0.04) {
        this.draggingHandle = 'start';
      } else if (endDist < 0.04) {
        this.draggingHandle = 'end';
      } else if (this.activeSlot.type === 'drum' && this.activeSlot.slices) {
        // Find closest slice
        const dur = this.activeSlot.buffer.duration;
        let closestIdx = -1;
        let minD = 0.05;

        for (let i = 0; i < this.activeSlot.slices.length; i++) {
          const sNorm = this.activeSlot.slices[i].start / dur;
          const d = Math.abs(xNorm - sNorm);
          if (d < minD) {
            minD = d;
            closestIdx = i;
          }
        }

        if (closestIdx !== -1) {
          this.activeSlot.selectedSliceIndex = closestIdx;
          this.draggingHandle = `slice_${closestIdx}`;
        }
      }
      this.render();
    };

    const onMove = (e) => {
      if (!this.draggingHandle || !this.activeSlot) return;
      const xNorm = getXNorm(e);

      if (this.draggingHandle === 'start') {
        this.activeSlot.trimStart = Math.min(xNorm, this.activeSlot.trimEnd - 0.01);
        if (this.onTrimChange) this.onTrimChange(this.activeSlot.trimStart, this.activeSlot.trimEnd);
      } else if (this.draggingHandle === 'end') {
        this.activeSlot.trimEnd = Math.max(xNorm, this.activeSlot.trimStart + 0.01);
        if (this.onTrimChange) this.onTrimChange(this.activeSlot.trimStart, this.activeSlot.trimEnd);
      } else if (this.draggingHandle.startsWith('slice_')) {
        const sliceIdx = parseInt(this.draggingHandle.split('_')[1], 10);
        const dur = this.activeSlot.buffer.duration;
        const slice = this.activeSlot.slices[sliceIdx];
        if (slice) {
          slice.start = xNorm * dur;
          if (this.onSliceChange) this.onSliceChange(sliceIdx, slice.start, slice.end);
        }
      }
      this.render();
    };

    const onUp = () => {
      this.draggingHandle = null;
    };

    canvas.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    canvas.addEventListener('touchstart', onDown, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onUp);

    // Drag-and-drop audio file loading
    canvas.addEventListener('dragover', (e) => {
      e.preventDefault();
      canvas.style.outline = '2px solid #e67e22';
    });
    canvas.addEventListener('dragleave', () => {
      canvas.style.outline = 'none';
    });
    canvas.addEventListener('drop', async (e) => {
      e.preventDefault();
      canvas.style.outline = 'none';
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.type.includes('audio') || file.name.match(/\.(wav|mp3|ogg|m4a|flac)$/i)) {
          const arrayBuffer = await file.arrayBuffer();
          const audioCtx = this.activeSlot.buffer ? this.activeSlot.buffer.sampleRate : 44100;
          // Decode audio
          const tempCtx = new (window.AudioContext || window.webkitAudioContext)();
          const decoded = await tempCtx.decodeAudioData(arrayBuffer);
          this.activeSlot.loadBuffer(decoded);
          this.activeSlot.name = file.name.replace(/\.[^/.]+$/, '').slice(0, 14);
          this.render();
        }
      }
    });
  }
}
