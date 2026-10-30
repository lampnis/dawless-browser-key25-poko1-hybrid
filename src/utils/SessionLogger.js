/**
 * Open-KO: SessionLogger
 * Comprehensive Console & Architecture Logger with Automatic Session Rotation.
 *
 * Capabilities:
 * - Automatically hooks into console.log, console.info, console.warn, console.error
 * - Tracks timestamps, log levels, messages, and structured arguments
 * - On each new session, automatically archives the previous session log to historical storage,
 *   tagged with datetime filenames (e.g., session_log_2026-10-20T22-50-00.log)
 * - Automatically clears and initializes a fresh master log for the active session
 * - Provides export, copy, and browser file download for active master and historical logs
 */

export class SessionLogger {
  constructor() {
    this.ACTIVE_STORAGE_KEY = 'open_ko_active_session_log';
    this.HISTORY_INDEX_KEY = 'open_ko_session_history_index';
    this.HISTORY_PREFIX = 'open_ko_session_history_';
    this.MAX_HISTORY_SESSIONS = 25;
    this.MAX_ENTRIES_PER_SESSION = 2000;

    this.sessionId = null;
    this.sessionStartTime = null;
    this.entries = [];
    this.isInitialized = false;

    // Preserve native console methods
    this.nativeConsole = {
      log: console.log.bind(console),
      info: console.info.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
      debug: console.debug ? console.debug.bind(console) : console.log.bind(console)
    };

    this._saveThrottleTimer = null;
  }

  /**
   * Initialize or rotate session logs
   */
  init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // 1. Archive previous session if it exists and has content
    this._rotateAndArchivePreviousSession();

    // 2. Start new session
    const now = new Date();
    this.sessionId = `session_${now.getTime()}`;
    this.sessionStartTime = now.toISOString();
    this.entries = [];

    // 3. Hook console methods
    this._interceptConsole();

    // 4. Log initial session banner
    const initMeta = {
      sessionId: this.sessionId,
      startTime: this.sessionStartTime,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
      platform: typeof navigator !== 'undefined' ? (navigator.userAgentData?.platform || navigator.platform) : 'Unknown',
      screen: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : 'N/A'
    };

    this.logSystem('SESSION_START', 'Open-KO Audio Workstation Session Started', initMeta);

    // Initial flush to storage
    this._persistActiveLog();
  }

  _getStorage() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.getItem === 'function') {
        return localStorage;
      }
    } catch (e) {}
    return null;
  }

  /**
   * Rotate previous session to history tagged with datetime in filename
   */
  _rotateAndArchivePreviousSession() {
    const storage = this._getStorage();
    if (!storage) return;

    try {
      const raw = storage.getItem(this.ACTIVE_STORAGE_KEY);
      if (!raw) return;

      const prevSession = JSON.parse(raw);
      if (prevSession && prevSession.entries && prevSession.entries.length > 0) {
        const startDate = new Date(prevSession.startTime || Date.now());
        const dateTag = this._formatDateForFilename(startDate);
        const filename = `session_log_${dateTag}.log`;

        const historyItem = {
          id: prevSession.sessionId || `session_${startDate.getTime()}`,
          filename,
          startTime: prevSession.startTime || startDate.toISOString(),
          endTime: prevSession.lastActiveTime || new Date().toISOString(),
          entryCount: prevSession.entries.length,
          errorCount: prevSession.entries.filter(e => e.level === 'ERROR').length,
          warnCount: prevSession.entries.filter(e => e.level === 'WARN').length,
          data: prevSession
        };

        // Save archive payload
        storage.setItem(`${this.HISTORY_PREFIX}${historyItem.id}`, JSON.stringify(historyItem));

        // Update history index
        let historyIndex = [];
        try {
          const rawIdx = storage.getItem(this.HISTORY_INDEX_KEY);
          if (rawIdx) historyIndex = JSON.parse(rawIdx);
        } catch (e) {
          historyIndex = [];
        }

        // Prepend newest archive
        historyIndex.unshift({
          id: historyItem.id,
          filename: historyItem.filename,
          startTime: historyItem.startTime,
          endTime: historyItem.endTime,
          entryCount: historyItem.entryCount,
          errorCount: historyItem.errorCount,
          warnCount: historyItem.warnCount
        });

        // Trim old history if exceeding MAX_HISTORY_SESSIONS
        if (historyIndex.length > this.MAX_HISTORY_SESSIONS) {
          const removed = historyIndex.splice(this.MAX_HISTORY_SESSIONS);
          for (const item of removed) {
            storage.removeItem(`${this.HISTORY_PREFIX}${item.id}`);
          }
        }

        storage.setItem(this.HISTORY_INDEX_KEY, JSON.stringify(historyIndex));
      }
    } catch (err) {
      this.nativeConsole.warn('Failed to archive previous session log:', err);
    } finally {
      // Clear active master log key for the fresh session
      try {
        storage.removeItem(this.ACTIVE_STORAGE_KEY);
      } catch (e) {}
    }
  }

  /**
   * Intercept console methods to record every log while keeping native output
   */
  _interceptConsole() {
    const levels = ['log', 'info', 'warn', 'error', 'debug'];

    levels.forEach(level => {
      const orig = this.nativeConsole[level];
      console[level] = (...args) => {
        // Output to native console first
        orig(...args);

        // Record entry
        this._recordEntry(level.toUpperCase(), args);
      };
    });
  }

  /**
   * Record entry into in-memory buffer and schedule storage write
   */
  _recordEntry(level, args) {
    const now = new Date();
    const formattedArgs = args.map(arg => this._sanitizeArg(arg));
    const message = formattedArgs.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');

    const entry = {
      t: now.toISOString(),
      loc: now.toLocaleTimeString(),
      level,
      msg: message,
      args: formattedArgs
    };

    this.entries.push(entry);

    // Keep memory buffer capped
    if (this.entries.length > this.MAX_ENTRIES_PER_SESSION) {
      this.entries.shift();
    }

    this._schedulePersist();
  }

  /**
   * Internal system message recorder
   */
  logSystem(category, message, details = null) {
    const now = new Date();
    const entry = {
      t: now.toISOString(),
      loc: now.toLocaleTimeString(),
      level: 'SYSTEM',
      cat: category,
      msg: message,
      details: details ? this._sanitizeArg(details) : null
    };

    this.entries.push(entry);
    this._schedulePersist();
  }

  /**
   * Throttled persist to localStorage
   */
  _schedulePersist() {
    if (this._saveThrottleTimer) return;
    this._saveThrottleTimer = setTimeout(() => {
      this._saveThrottleTimer = null;
      this._persistActiveLog();
    }, 1000);
  }

  _persistActiveLog() {
    const storage = this._getStorage();
    if (!storage) return;

    try {
      const payload = {
        sessionId: this.sessionId,
        startTime: this.sessionStartTime,
        lastActiveTime: new Date().toISOString(),
        entries: this.entries
      };
      storage.setItem(this.ACTIVE_STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
      // In case quota is exceeded, drop older half of entries
      if (err.name === 'QuotaExceededError' && this.entries.length > 100) {
        this.entries = this.entries.slice(Math.floor(this.entries.length / 2));
        try {
          const payload = {
            sessionId: this.sessionId,
            startTime: this.sessionStartTime,
            lastActiveTime: new Date().toISOString(),
            entries: this.entries
          };
          storage.setItem(this.ACTIVE_STORAGE_KEY, JSON.stringify(payload));
        } catch (e) {}
      }
    }
  }

  /**
   * Format Date to string for filenames (e.g. 2026-10-20T22-48-57)
   */
  _formatDateForFilename(date) {
    const pad = (n) => String(n).padStart(2, '0');
    const y = date.getFullYear();
    const m = pad(date.getMonth() + 1);
    const d = pad(date.getDate());
    const h = pad(date.getHours());
    const min = pad(date.getMinutes());
    const s = pad(date.getSeconds());
    return `${y}-${m}-${d}T${h}-${min}-${s}`;
  }

  /**
   * Safe serialization of arguments
   */
  _sanitizeArg(arg) {
    if (arg === null) return 'null';
    if (arg === undefined) return 'undefined';
    if (typeof arg === 'string' || typeof arg === 'number' || typeof arg === 'boolean') {
      return arg;
    }
    if (arg instanceof Error) {
      return {
        name: arg.name,
        message: arg.message,
        stack: arg.stack
      };
    }
    if (typeof arg === 'function') {
      return `[Function: ${arg.name || 'anonymous'}]`;
    }
    try {
      // Circular reference guard
      const seen = new WeakSet();
      return JSON.parse(JSON.stringify(arg, (key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) return '[Circular Reference]';
          seen.add(value);
        }
        return value;
      }));
    } catch (e) {
      return String(arg);
    }
  }

  /**
   * Generate clean formatted plain text master log file
   */
  formatMasterLogText(entries = this.entries, sessionMeta = {}) {
    const startStr = sessionMeta.startTime || this.sessionStartTime || new Date().toISOString();
    const sessionId = sessionMeta.sessionId || this.sessionId;

    const errorCount = entries.filter(e => e.level === 'ERROR').length;
    const warnCount = entries.filter(e => e.level === 'WARN').length;

    let out = [];
    out.push('================================================================================');
    out.push('                     OPEN-KO AUDIO WORKSTATION // MASTER LOG                    ');
    out.push('================================================================================');
    out.push(`Session ID:      ${sessionId}`);
    out.push(`Session Start:   ${startStr}`);
    out.push(`Generated:       ${new Date().toISOString()}`);
    out.push(`Total Entries:   ${entries.length}`);
    out.push(`Total Errors:    ${errorCount}`);
    out.push(`Total Warnings:  ${warnCount}`);
    out.push('================================================================================\n');

    entries.forEach((e) => {
      const levelTag = `[${e.level.padEnd(6, ' ')}]`;
      out.push(`${e.t} ${levelTag} ${e.msg}`);
    });

    out.push('\n================================================================================');
    out.push('                            END OF SESSION MASTER LOG                           ');
    out.push('================================================================================\n');

    return out.join('\n');
  }

  /**
   * Trigger browser download of the active master log
   */
  downloadMasterLog() {
    const text = this.formatMasterLogText();
    const dateTag = this._formatDateForFilename(new Date());
    const filename = `open_ko_master_session_${dateTag}.log`;
    this._downloadFile(filename, text, 'text/plain');
  }

  /**
   * Trigger browser download of a historical session
   */
  downloadHistoricalSession(sessionId) {
    const storage = this._getStorage();
    if (!storage) return;

    try {
      const raw = storage.getItem(`${this.HISTORY_PREFIX}${sessionId}`);
      if (!raw) {
        alert('Historical session not found.');
        return;
      }
      const item = JSON.parse(raw);
      const text = this.formatMasterLogText(item.data.entries, item.data);
      this._downloadFile(item.filename, text, 'text/plain');
    } catch (e) {
      alert('Failed to read historical session: ' + e.message);
    }
  }

  /**
   * Get list of all historical sessions
   */
  getHistoricalSessions() {
    const storage = this._getStorage();
    if (!storage) return [];

    try {
      const rawIdx = storage.getItem(this.HISTORY_INDEX_KEY);
      if (rawIdx) return JSON.parse(rawIdx);
    } catch (e) {}
    return [];
  }

  /**
   * Clear all historical logs
   */
  clearAllHistory() {
    const storage = this._getStorage();
    if (!storage) return;

    try {
      const history = this.getHistoricalSessions();
      history.forEach(item => {
        storage.removeItem(`${this.HISTORY_PREFIX}${item.id}`);
      });
      storage.removeItem(this.HISTORY_INDEX_KEY);
    } catch (e) {}
  }

  _downloadFile(filename, content, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

// Global Singleton
export const sessionLogger = new SessionLogger();
if (typeof window !== 'undefined') {
  window.__OPEN_KO_LOGGER__ = sessionLogger;
}
