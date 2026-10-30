/**
 * Tests for SessionLogger: console interception, session rotation,
 * datetime-tagged historical filenames, and master log generation.
 */

import { SessionLogger } from '../src/utils/SessionLogger.js';

export function runSessionLoggerTests(test) {
  test('SessionLogger: Generates ISO and datetime-tagged filenames correctly', (assert) => {
    const logger = new SessionLogger();
    const d = new Date(2026, 9, 20, 22, 48, 57); // Month is 0-indexed: 9 = October
    const tag = logger._formatDateForFilename(d);
    assert.strictEqual(tag, '2026-10-20T22-48-57');
  });

  test('SessionLogger: Intercepts console and records structured entries', (assert) => {
    const logger = new SessionLogger();
    logger.init();

    const initialCount = logger.entries.length;
    console.log('Open-KO Test Log Message', 42);

    assert.ok(logger.entries.length > initialCount);
    const last = logger.entries[logger.entries.length - 1];
    assert.strictEqual(last.level, 'LOG');
    assert.ok(last.msg.includes('Open-KO Test Log Message'));
  });

  test('SessionLogger: Generates formatted master log text with session metadata', (assert) => {
    const logger = new SessionLogger();
    logger.sessionId = 'test_session_123';
    logger.sessionStartTime = '2026-10-20T22:00:00.000Z';
    logger.entries = [
      { t: '2026-10-20T22:00:01.000Z', loc: '22:00:01', level: 'INFO', msg: 'System booted' },
      { t: '2026-10-20T22:00:02.000Z', loc: '22:00:02', level: 'ERROR', msg: 'Simulated warning/error' }
    ];

    const text = logger.formatMasterLogText();
    assert.ok(text.includes('OPEN-KO AUDIO WORKSTATION // MASTER LOG'));
    assert.ok(text.includes('test_session_123'));
    assert.ok(text.includes('[INFO  ] System booted'));
    assert.ok(text.includes('[ERROR ] Simulated warning/error'));
    assert.ok(text.includes('Total Errors:    1'));
  });

  test('SessionLogger: Archives previous session to history on rotation', (assert) => {
    const logger = new SessionLogger();
    const mockStorage = new Map();

    if (typeof globalThis.localStorage === 'undefined') {
      globalThis.localStorage = {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {}
      };
    }

    // Mock localStorage safely for isolated unit testing
    const origGet = globalThis.localStorage.getItem;
    const origSet = globalThis.localStorage.setItem;
    const origRem = globalThis.localStorage.removeItem;

    try {
      globalThis.localStorage.getItem = (k) => mockStorage.get(k) || null;
      globalThis.localStorage.setItem = (k, v) => mockStorage.set(k, v);
      globalThis.localStorage.removeItem = (k) => mockStorage.delete(k);

      // Seed previous session
      const prevData = {
        sessionId: 'session_old_1',
        startTime: '2026-10-20T20:00:00.000Z',
        lastActiveTime: '2026-10-20T20:30:00.000Z',
        entries: [
          { t: '2026-10-20T20:00:00.000Z', level: 'LOG', msg: 'Session 1 started' }
        ]
      };
      mockStorage.set(logger.ACTIVE_STORAGE_KEY, JSON.stringify(prevData));

      // Trigger rotation
      logger._rotateAndArchivePreviousSession();

      // Active key should be cleared
      assert.strictEqual(mockStorage.get(logger.ACTIVE_STORAGE_KEY), undefined);

      // History index should contain the archived session
      const historyIdx = JSON.parse(mockStorage.get(logger.HISTORY_INDEX_KEY));
      assert.strictEqual(historyIdx.length, 1);
      assert.ok(historyIdx[0].filename.startsWith('session_log_2026-10-20'));
      assert.strictEqual(historyIdx[0].entryCount, 1);
    } finally {
      localStorage.getItem = origGet;
      localStorage.setItem = origSet;
      localStorage.removeItem = origRem;
    }
  });
}
