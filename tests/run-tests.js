/**
 * Open-KO: Standalone Node.js Automated Test Runner
 * Run with: node tests/run-tests.js
 */

import { runMidiTests } from './midi.test.js';
import { runTransientTests } from './transient.test.js';
import { runAudioTests } from './audio.test.js';
import { runSequencerTests } from './sequencer.test.js';
import { runModeTests } from './modes.test.js';
import { runTransportTests } from './transport.test.js';
import { runSessionLoggerTests } from './logger.test.js';
import { runGuidedTesterTests } from './guidedTester.test.js';
import { runLibraryAndPolyphonyTests } from './libraryAndPolyphony.test.js';
import { runZoomAndSlicesTests } from './zoomAndSlices.test.js';
import { runProjectAndChainingTests } from './projectAndChaining.test.js';
import { runMicroTimingAndSidechainTests } from './microTimingAndSidechain.test.js';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const asyncTestPromises = [];

const assert = {
  strictEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(message || `Expected: ${expected}, but got: ${actual}`);
    }
  },
  deepStrictEqual(actual, expected, message) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(message || `Expected: ${JSON.stringify(expected)}, but got: ${JSON.stringify(actual)}`);
    }
  },
  ok(condition, message) {
    if (!condition) {
      throw new Error(message || `Assertion failed: condition is falsy`);
    }
  }
};

function test(name, fn) {
  totalTests++;
  try {
    const res = fn(assert);
    if (res && typeof res.then === 'function') {
      const p = res.then(() => {
        passedTests++;
        console.log(`  \x1b[32m✔\x1b[0m ${name}`);
      }).catch((err) => {
        failedTests++;
        console.error(`  \x1b[31m✖\x1b[0m ${name}`);
        console.error(`    \x1b[31m${err.message}\x1b[0m`);
      });
      asyncTestPromises.push(p);
    } else {
      passedTests++;
      console.log(`  \x1b[32m✔\x1b[0m ${name}`);
    }
  } catch (err) {
    failedTests++;
    console.error(`  \x1b[31m✖\x1b[0m ${name}`);
    console.error(`    \x1b[31m${err.message}\x1b[0m`);
  }
}

async function runAll() {
  console.log('\n======================================================');
  console.log('   OPEN-KO: Automated Hardware & DSP Test Suite');
  console.log('======================================================\n');

  console.log('\x1b[36m[1/6] MIDI & APC Key 25 Protocols\x1b[0m');
  runMidiTests(test);

  console.log('\n\x1b[36m[2/6] 3-Way Mode Switching (Sample, Pattern, Performance)\x1b[0m');
  runModeTests(test);

  console.log('\n\x1b[36m[3/6] Transport Controls (Play/Pause, Stop & Reset, Chaining)\x1b[0m');
  runTransportTests(test);

  console.log('\n\x1b[36m[4/6] Transient Detection & 16-Slice Slicing\x1b[0m');
  runTransientTests(test);

  console.log('\n\x1b[36m[5/6] Audio DSP, Pitch Ratios & PO Dual Filter Math\x1b[0m');
  runAudioTests(test);

  console.log('\n\x1b[36m[6/7] Sequencer, Step Patterns & Parameter Locking\x1b[0m');
  runSequencerTests(test);

  console.log('\n\x1b[36m[7/8] Session Logger, Auto-Rotation & Historical Archive\x1b[0m');
  runSessionLoggerTests(test);

  console.log('\n\x1b[36m[8/9] Guided Hardware Tester & Calibration\x1b[0m');
  runGuidedTesterTests(test);

  console.log('\n\x1b[36m[9/10] Sample Library, Chord Polyphony & Arrow Navigation\x1b[0m');
  runLibraryAndPolyphonyTests(test);

  console.log('\n\x1b[36m[10/10] Pattern Zoom, Drum Slices, Space Delay & Sample Loop/Stretch\x1b[0m');
  runZoomAndSlicesTests(test);

  console.log('\n\x1b[36m[11/11] Default 4/4 Kick Project, Persistence & PO-33 PATTERN/SOUND Modifiers\x1b[0m');
  runProjectAndChainingTests(test);

  console.log('\n\x1b[36m[12/12] 128th-Note Micro-Timing, Auto-BPM, Sidechain Ducking & Punch-In FX\x1b[0m');
  runMicroTimingAndSidechainTests(test);

  // Await any async tests
  if (asyncTestPromises.length > 0) {
    await Promise.all(asyncTestPromises);
  }

  console.log('\n======================================================');
  if (failedTests === 0) {
    console.log(`\x1b[32mSUCCESS: All ${passedTests}/${totalTests} tests passed cleanly!\x1b[0m`);
  } else {
    console.log(`\x1b[31mFAILURE: ${failedTests} of ${totalTests} tests failed.\x1b[0m`);
    process.exitCode = 1;
  }
  console.log('======================================================\n');
  process.exit(failedTests === 0 ? 0 : 1);
}

runAll();
