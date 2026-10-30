/**
 * Open-KO: ProjectManager
 * Manages project persistence in localStorage and default 4/4 kick project initialization.
 */

export const PROJECT_STORAGE_KEY = 'open_ko_project_v1';

export class ProjectManager {
  /**
   * Initializes the default starting project:
   * Exactly 4 kick drums in 4/4 time signature (quarter notes: steps 0, 4, 8, 12)
   * on drum track (TR-909 House Kit Kick at Slice 0) and NOTHING ELSE in the arrangement!
   */
  static initDefaultProject(sequencer, audioEngine) {
    // 1. Reset tempo and swing for 4/4 dance/house groove
    sequencer.setBpm(120);
    sequencer.setSwing(50);
    sequencer.setPatternChain([0]);
    sequencer.chainPosition = 0;
    sequencer.activePatternIndex = 0;

    // 2. Clear all tracks across all 16 patterns completely
    for (let pIdx = 0; pIdx < 16; pIdx++) {
      const pat = sequencer.patterns[pIdx];
      pat.clear();
      pat.setZoom(1);
      pat.trackMutes.fill(false);
      pat.trackSolos.fill(false);
    }

    // 3. Configure starting drum slot (Slot 8, Track 9) with 909 Kick (Slice 0)
    const drumSlotIdx = 8;
    const drumSlot = audioEngine.slots[drumSlotIdx];
    drumSlot.type = 'drum';
    drumSlot.selectedSliceIndex = 0;

    // 4. Program exactly 4 kick drums on quarter notes (steps 0, 4, 8, 12 in 4/4 signature)
    const pat0 = sequencer.patterns[0];
    const drumTrack = pat0.tracks[drumSlotIdx];

    const kickQuarterNotes = [0, 4, 8, 12];
    for (const stepIdx of kickQuarterNotes) {
      if (drumTrack[stepIdx]) {
        drumTrack[stepIdx].active = true;
        drumTrack[stepIdx].noteOrSlice = 0; // Slice 0 = 909 Kick
        drumTrack[stepIdx].velocity = 100;
        drumTrack[stepIdx].clearAllLocks();
      }
    }

    // 5. Select drum track as active slot so the 4 kicks are visible in UI immediately
    audioEngine.setActiveSlot(drumSlotIdx);

    return true;
  }

  /**
   * Saves current project state to localStorage
   */
  static saveProject(sequencer, audioEngine) {
    if (typeof localStorage === 'undefined') return false;

    try {
      const patternsData = sequencer.patterns.map(p => ({
        id: p.id,
        zoom: p.zoom || 1,
        length: p.length || 16,
        trackMutes: [...p.trackMutes],
        trackSolos: [...p.trackSolos],
        tracks: p.tracks.map(track => {
          return track
            .map((s, idx) => {
              if (!s.active) return null;
              return {
                idx,
                noteOrSlice: s.noteOrSlice,
                notes: s.notes ? [...s.notes] : [s.noteOrSlice],
                velocity: s.velocity,
                microTiming: s.microTiming || 0,
                pLocks: { ...s.pLocks }
              };
            })
            .filter(Boolean);
        })
      }));

      const slotsData = audioEngine.slots.map(slot => ({
        name: slot.name,
        type: slot.type,
        pitch: slot.pitch,
        trimStart: slot.trimStart,
        trimEnd: slot.trimEnd,
        decay: slot.decay,
        volume: slot.volume,
        loop: !!slot.loop,
        stretchMode: slot.stretchMode || 'pitch_only',
        sidechainDucked: slot.sidechainDucked !== false,
        chokeGroup: slot.chokeGroup,
        selectedSliceIndex: slot.selectedSliceIndex || 0
      }));

      const projectData = {
        version: 2,
        savedAt: Date.now(),
        bpm: sequencer.bpm,
        swing: sequencer.swing,
        recordMode: sequencer.recordMode || 'freeform',
        activePatternIndex: sequencer.activePatternIndex,
        patternChain: [...sequencer.patternChain],
        activeSlotIndex: audioEngine.activeSlotIndex,
        sidechain: {
          enabled: audioEngine.sidechainEnabled !== false,
          source: audioEngine.sidechainSource !== undefined ? audioEngine.sidechainSource : 8,
          depth: audioEngine.sidechainDepth !== undefined ? audioEngine.sidechainDepth : 0.65,
          release: audioEngine.sidechainRelease !== undefined ? audioEngine.sidechainRelease : 0.18
        },
        patterns: patternsData,
        slots: slotsData
      };

      localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(projectData));
      return true;
    } catch (err) {
      console.warn('Failed to save project to localStorage:', err);
      return false;
    }
  }

  /**
   * Loads saved project from localStorage if it exists
   */
  static loadProject(sequencer, audioEngine) {
    if (typeof localStorage === 'undefined') return false;

    try {
      const raw = localStorage.getItem(PROJECT_STORAGE_KEY);
      if (!raw) return false;

      const projectData = JSON.parse(raw);
      if (!projectData || !projectData.patterns) return false;

      // Restore Sequencer tempo, record mode & arrangement
      if (typeof projectData.bpm === 'number') sequencer.setBpm(projectData.bpm);
      if (typeof projectData.swing === 'number') sequencer.setSwing(projectData.swing);
      if (projectData.recordMode === 'freeform' || projectData.recordMode === 'quantized') {
        if (typeof sequencer.setRecordMode === 'function') {
          sequencer.setRecordMode(projectData.recordMode);
        } else {
          sequencer.recordMode = projectData.recordMode;
        }
      }
      if (Array.isArray(projectData.patternChain) && projectData.patternChain.length > 0) {
        sequencer.patternChain = [...projectData.patternChain];
        sequencer.chainPosition = 0;
      }
      if (typeof projectData.activePatternIndex === 'number') {
        sequencer.activePatternIndex = projectData.activePatternIndex;
      }

      // Restore Sidechain Ducking settings
      if (projectData.sidechain) {
        const sc = projectData.sidechain;
        if (typeof sc.enabled === 'boolean') audioEngine.sidechainEnabled = sc.enabled;
        if (typeof sc.source === 'number') audioEngine.sidechainSource = sc.source;
        if (typeof sc.depth === 'number') audioEngine.sidechainDepth = sc.depth;
        if (typeof sc.release === 'number') audioEngine.sidechainRelease = sc.release;
      }

      // Restore Patterns & Tracks
      for (let pIdx = 0; pIdx < Math.min(sequencer.patterns.length, projectData.patterns.length); pIdx++) {
        const pData = projectData.patterns[pIdx];
        const pat = sequencer.patterns[pIdx];
        pat.clear();

        if (pData.zoom) pat.setZoom(pData.zoom);
        if (Array.isArray(pData.trackMutes)) pat.trackMutes = [...pData.trackMutes];
        if (Array.isArray(pData.trackSolos)) pat.trackSolos = [...pData.trackSolos];

        if (Array.isArray(pData.tracks)) {
          for (let tIdx = 0; tIdx < Math.min(pat.tracks.length, pData.tracks.length); tIdx++) {
            const activeSteps = pData.tracks[tIdx];
            if (Array.isArray(activeSteps)) {
              for (const s of activeSteps) {
                if (s && typeof s.idx === 'number' && pat.tracks[tIdx][s.idx]) {
                  const targetStep = pat.tracks[tIdx][s.idx];
                  targetStep.active = true;
                  targetStep.noteOrSlice = s.noteOrSlice;
                  if (Array.isArray(s.notes)) targetStep.notes = [...s.notes];
                  targetStep.velocity = s.velocity || 100;
                  if (typeof s.microTiming === 'number') {
                    if (typeof targetStep.setMicroTiming === 'function') {
                      targetStep.setMicroTiming(s.microTiming);
                    } else {
                      targetStep.microTiming = s.microTiming;
                    }
                  }
                  if (s.pLocks) targetStep.pLocks = { ...s.pLocks };
                }
              }
            }
          }
        }
      }

      // Restore Slot parameters
      if (Array.isArray(projectData.slots)) {
        for (let sIdx = 0; sIdx < Math.min(audioEngine.slots.length, projectData.slots.length); sIdx++) {
          const sData = projectData.slots[sIdx];
          const slot = audioEngine.slots[sIdx];
          if (sData.pitch !== undefined) slot.pitch = sData.pitch;
          if (sData.trimStart !== undefined) slot.trimStart = sData.trimStart;
          if (sData.trimEnd !== undefined) slot.trimEnd = sData.trimEnd;
          if (sData.decay !== undefined) slot.decay = sData.decay;
          if (sData.volume !== undefined) slot.volume = sData.volume;
          if (sData.loop !== undefined) slot.loop = sData.loop;
          if (sData.stretchMode) {
            if (typeof slot.setStretchMode === 'function') {
              slot.setStretchMode(sData.stretchMode);
            } else {
              slot.stretchMode = sData.stretchMode;
            }
          }
          if (sData.sidechainDucked !== undefined) slot.sidechainDucked = sData.sidechainDucked;
          if (sData.selectedSliceIndex !== undefined) slot.selectedSliceIndex = sData.selectedSliceIndex;
        }
      }

      if (typeof projectData.activeSlotIndex === 'number') {
        audioEngine.setActiveSlot(projectData.activeSlotIndex);
      }

      return true;
    } catch (err) {
      console.warn('Failed to load project from localStorage:', err);
      return false;
    }
  }

  static clearProject() {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(PROJECT_STORAGE_KEY);
    }
  }
}
