/**
 * Open-KO: Main Application Entry Point
 * Orchestrates Audio Engine, Midi Manager, Sequencer, Presets, and UI.
 */

import { AudioEngine } from './audio/AudioEngine.js';
import { DefaultKits } from './presets/DefaultKits.js';
import { Sequencer } from './sequencer/Sequencer.js';
import { MidiManager } from './midi/MidiManager.js';
import { UIManager } from './ui/UIManager.js';
import { GRID_LAYOUT_MODES, OPERATIONAL_MODES } from './midi/ApcConstants.js';
import { sessionLogger } from './utils/SessionLogger.js';
import { ProjectManager } from './project/ProjectManager.js';

// Initialize session logger immediately so all subsequent console activity is recorded
sessionLogger.init();

window.addEventListener('DOMContentLoaded', async () => {
  console.log('Initializing Open-KO Audio Workstation...');

  // 1. Initialize Audio Engine & Master Graph
  const audioEngine = new AudioEngine();

  // 2. Synthesize & Load Factory Presets (PO-33 Beat Kit & Melodic Synths)
  await DefaultKits.loadFactoryPresets(audioEngine);

  // 3. Initialize Sequencer with Lookahead Scheduling
  const sequencer = new Sequencer(audioEngine);

  // 4. Initialize Hardware Web MIDI Manager
  const midiManager = new MidiManager({
    layoutMode: GRID_LAYOUT_MODES.TOP_DOWN,
    operationalMode: OPERATIONAL_MODES.PATTERN
  });
  await midiManager.init();

  // 5. Initialize UI Manager
  const ui = new UIManager(audioEngine, sequencer, midiManager);
  try {
    ui.init();
  } catch (err) {
    console.error('Error during ui.init():', err);
  }

  // Global Audio Unlocker for browser autoplay policies
  const unlockAudio = () => {
    audioEngine.ensureAudioContext();
    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
    window.removeEventListener('touchstart', unlockAudio);
  };
  window.addEventListener('click', unlockAudio);
  window.addEventListener('keydown', unlockAudio);
  window.addEventListener('touchstart', unlockAudio);

  // Setup Header Actions, Modal Dialogs & Keyboard Shortcuts
  try {
    _bindControlsAndShortcuts(audioEngine, sequencer, midiManager, ui);
  } catch (err) {
    console.error('Error binding controls:', err);
  }

  // 6. Project Persistence & Default 4/4 Kick Start State
  try {
    const loaded = ProjectManager.loadProject(sequencer, audioEngine);
    if (!loaded) {
      ProjectManager.initDefaultProject(sequencer, audioEngine);
      console.log('[ProjectManager] Initialized default project with 4/4 kick (909 House Kick on steps 0, 4, 8, 12).');
    } else {
      console.log('[ProjectManager] Restored saved project from localStorage.');
    }
    ui.refreshAll();
  } catch (err) {
    console.error('Error initializing project:', err);
    ProjectManager.initDefaultProject(sequencer, audioEngine);
    ui.refreshAll();
  }

  console.log('Open-KO Ready. Connect Akai APC Key 25 & USB audio interface to begin.');
});

function _bindControlsAndShortcuts(audioEngine, sequencer, midiManager, ui) {
  // BPM Increment / Decrement
  const bpmUp = document.getElementById('btn-bpm-up');
  const bpmDown = document.getElementById('btn-bpm-down');
  if (bpmUp) {
    bpmUp.addEventListener('click', () => {
      sequencer.setBpm(sequencer.bpm + 1);
      ui.lcdBpm.textContent = `${sequencer.bpm}`;
    });
  }
  if (bpmDown) {
    bpmDown.addEventListener('click', () => {
      sequencer.setBpm(sequencer.bpm - 1);
      ui.lcdBpm.textContent = `${sequencer.bpm}`;
    });
  }

  // Tap Tempo
  const tapBtn = document.getElementById('btn-tap-tempo');
  let tapTimes = [];
  if (tapBtn) {
    tapBtn.addEventListener('click', () => {
      const now = performance.now();
      tapTimes.push(now);
      if (tapTimes.length > 4) tapTimes.shift();
      if (tapTimes.length >= 2) {
        let diffSum = 0;
        for (let i = 1; i < tapTimes.length; i++) {
          diffSum += (tapTimes[i] - tapTimes[i - 1]);
        }
        const avgMs = diffSum / (tapTimes.length - 1);
        const calcBpm = Math.round(60000 / avgMs);
        if (calcBpm >= 40 && calcBpm <= 240) {
          sequencer.setBpm(calcBpm);
          ui.lcdBpm.textContent = `${calcBpm}`;
        }
      }
    });
  }

  // Clear Track
  const clearTrackBtn = document.getElementById('btn-clear-track');
  if (clearTrackBtn) {
    clearTrackBtn.addEventListener('click', () => {
      const curSlot = audioEngine.getActiveSlot();
      if (confirm(`Clear track steps for ${curSlot.name}?`)) {
        sequencer.getCurrentPattern().clearTrack(audioEngine.activeSlotIndex);
        ui._syncSequencerLeds();
        ui._updateTouchStepGrid();
      }
    });
  }

  // Live Sample Button (Line/Mic)
  const recBtn = document.getElementById('btn-live-sample');
  if (recBtn) {
    recBtn.addEventListener('click', () => {
      ui._toggleLiveSampling('mic');
    });
  }

  // Direct Browser Tab / Computer Audio Capture (YouTube, Spotify, etc.)
  const tabRecBtn = document.getElementById('btn-tab-sample');
  if (tabRecBtn) {
    tabRecBtn.addEventListener('click', () => {
      ui._toggleLiveSampling('tab');
    });
  }

  // Guide Modal
  const guideBtn = document.getElementById('btn-guide-modal');
  const guideModal = document.getElementById('guide-modal');
  const closeGuideBtn = document.getElementById('btn-close-guide');
  if (guideBtn && guideModal) {
    guideBtn.addEventListener('click', () => guideModal.classList.add('open'));
  }
  if (closeGuideBtn && guideModal) {
    closeGuideBtn.addEventListener('click', () => guideModal.classList.remove('open'));
  }

  // Audio & MIDI Settings Dialog
  const settingsBtn = document.getElementById('btn-settings');
  const modal = document.getElementById('settings-modal');
  const closeModal = document.getElementById('btn-close-modal');
  const inputSelect = document.getElementById('select-audio-input');
  const midiInSelect = document.getElementById('select-midi-in');
  const midiOutSelect = document.getElementById('select-midi-out');
  const gridOrientationSelect = document.getElementById('select-grid-orientation');
  const deviceModeSelect = document.getElementById('select-device-mode');

  if (settingsBtn && modal) {
    settingsBtn.addEventListener('click', async () => {
      modal.classList.add('open');

      if (inputSelect) {
        inputSelect.innerHTML = '<option value="">Default Audio Input</option>';
        try {
          const devices = await audioEngine.recorder.getInputDevices();
          devices.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.deviceId;
            opt.textContent = d.label || `Audio Interface (${d.deviceId.slice(0, 8)})`;
            if (audioEngine.recorder.activeDeviceId === d.deviceId) opt.selected = true;
            inputSelect.appendChild(opt);
          });
        } catch (e) {}
      }

      if (midiInSelect) {
        midiInSelect.innerHTML = '<option value="">None</option>';
        midiManager.getInputs().forEach(inp => {
          const opt = document.createElement('option');
          opt.value = inp.id;
          opt.textContent = inp.name;
          if (midiManager.activeInput && midiManager.activeInput.id === inp.id) opt.selected = true;
          midiInSelect.appendChild(opt);
        });
      }

      if (midiOutSelect) {
        midiOutSelect.innerHTML = '<option value="">None</option>';
        midiManager.getOutputs().forEach(out => {
          const opt = document.createElement('option');
          opt.value = out.id;
          opt.textContent = out.name;
          if (midiManager.activeOutput && midiManager.activeOutput.id === out.id) opt.selected = true;
          midiOutSelect.appendChild(opt);
        });
      }
    });
  }

  if (closeModal && modal) {
    closeModal.addEventListener('click', () => {
      modal.classList.remove('open');
    });
  }

  if (inputSelect) {
    inputSelect.addEventListener('change', async (e) => {
      await audioEngine.recorder.initStream(e.target.value);
    });
  }

  if (midiInSelect) {
    midiInSelect.addEventListener('change', (e) => {
      const devId = e.target.value;
      const inp = midiManager.getInputs().find(i => i.id === devId);
      midiManager.setInput(inp || null);
    });
  }

  if (midiOutSelect) {
    midiOutSelect.addEventListener('change', (e) => {
      const devId = e.target.value;
      const out = midiManager.getOutputs().find(o => o.id === devId);
      midiManager.setOutput(out || null);
      ui.refreshAll();
    });
  }

  if (gridOrientationSelect) {
    gridOrientationSelect.addEventListener('change', (e) => {
      midiManager.setLayoutMode(e.target.value);
      ui.refreshAll();
    });
  }

  if (deviceModeSelect) {
    deviceModeSelect.addEventListener('change', (e) => {
      midiManager.setDeviceMode(e.target.value);
      ui.refreshAll();
    });
  }

  // Logs Modal & Architecture Review
  const logsBtn = document.getElementById('btn-open-logs');
  const logsModal = document.getElementById('logs-modal');
  const closeLogsBtn = document.getElementById('btn-close-logs');
  const masterLogPreview = document.getElementById('master-log-preview');
  const historicalList = document.getElementById('historical-sessions-list');
  const downloadMasterBtn = document.getElementById('btn-download-master-log');
  const copyMasterBtn = document.getElementById('btn-copy-master-log');
  const clearHistoryBtn = document.getElementById('btn-clear-log-history');

  function renderLogsModal() {
    if (masterLogPreview) {
      masterLogPreview.textContent = sessionLogger.formatMasterLogText();
      masterLogPreview.scrollTop = masterLogPreview.scrollHeight;
    }
    if (historicalList) {
      const history = sessionLogger.getHistoricalSessions();
      if (history.length === 0) {
        historicalList.innerHTML = '<div style="color: #5c6370; font-size: 11px; padding: 6px;">No archived historical sessions yet (sessions are auto-archived upon each new page load / restart).</div>';
      } else {
        historicalList.innerHTML = history.map(item => `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px; border-bottom: 1px solid #202428; font-size: 11px;">
            <div>
              <strong style="color: #61afef;">${item.filename}</strong>
              <span style="color: #7f8c8d; font-size: 9px; margin-left: 8px;">${item.entryCount} logs (${item.errorCount} err, ${item.warnCount} warn)</span>
              <div style="color: #5c6370; font-size: 9px;">Started: ${new Date(item.startTime).toLocaleString()}</div>
            </div>
            <button class="btn-tactile btn-download-hist" data-id="${item.id}" style="font-size: 9px; padding: 3px 8px;">DOWNLOAD</button>
          </div>
        `).join('');

        historicalList.querySelectorAll('.btn-download-hist').forEach(b => {
          b.addEventListener('click', () => {
            sessionLogger.downloadHistoricalSession(b.dataset.id);
          });
        });
      }
    }
  }

  if (logsBtn && logsModal) {
    logsBtn.addEventListener('click', () => {
      renderLogsModal();
      logsModal.classList.add('open');
    });
  }
  if (closeLogsBtn && logsModal) {
    closeLogsBtn.addEventListener('click', () => logsModal.classList.remove('open'));
  }
  if (downloadMasterBtn) {
    downloadMasterBtn.addEventListener('click', () => sessionLogger.downloadMasterLog());
  }
  if (copyMasterBtn) {
    copyMasterBtn.addEventListener('click', () => {
      const text = sessionLogger.formatMasterLogText();
      navigator.clipboard.writeText(text).then(() => {
        alert('Master log copied to clipboard!');
      }).catch(err => {
        console.warn('Clipboard write failed:', err);
      });
    });
  }
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', () => {
      if (confirm('Clear all historical session logs?')) {
        sessionLogger.clearAllHistory();
        renderLogsModal();
      }
    });
  }

  // Keyboard Shortcuts:
  // Space: Play / Pause
  // Esc: Stop & Reset to start
  // 1: Sample Mode, 2: Pattern Mode, 3: Performance Mode
  // Tab: Toggle Minimal vs Debug view
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

    if (e.code === 'Space') {
      e.preventDefault();
      sequencer.togglePlayPause();
    } else if (e.code === 'Escape') {
      e.preventDefault();
      sequencer.stopAndReset();
      ui._updateLcdStatus('STOPPED // RESET TO START');
    } else if (e.key === '1') {
      ui.setMode(OPERATIONAL_MODES.SAMPLE);
    } else if (e.key === '2') {
      ui.setMode(OPERATIONAL_MODES.PATTERN);
    } else if (e.key === '3') {
      ui.setMode(OPERATIONAL_MODES.PERFORMANCE);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      ui.toggleViewMode();
    }
  });

  // Project Save & Reset Controls
  const saveProjBtn = document.getElementById('btn-save-project');
  if (saveProjBtn) {
    saveProjBtn.addEventListener('click', () => {
      ProjectManager.saveProject(sequencer, audioEngine);
      ui._updateLcdStatus('PROJECT SAVED TO STORAGE');
      if (ui.minimalPoView) ui.minimalPoView.triggerPunch('SAVED!');
    });
  }

  const newProjBtn = document.getElementById('btn-new-project');
  if (newProjBtn) {
    newProjBtn.addEventListener('click', () => {
      if (confirm('Create new project? This will reset the arrangement to a clean 4/4 kick.')) {
        ProjectManager.clearProject();
        ProjectManager.initDefaultProject(sequencer, audioEngine);
        ui.refreshAll();
        ui._updateLcdStatus('NEW PROJECT: 4/4 KICK ONLY');
        if (ui.minimalPoView) ui.minimalPoView.triggerPunch('RESET');
      }
    });
  }
}
