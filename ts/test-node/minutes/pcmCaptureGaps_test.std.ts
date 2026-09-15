// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import {
  isPcmCaptureSeverelyDamaged,
  measurePcmCaptureGaps,
} from '../../minutes/pcmCaptureGaps.std.ts';

const SAMPLE_RATE = 16_000;

function buildPcm(
  seconds: number,
  fill: (index: number) => number
): Float32Array {
  const pcm = new Float32Array(seconds * SAMPLE_RATE);
  for (let index = 0; index < pcm.length; index += 1) {
    pcm[index] = fill(index);
  }
  return pcm;
}

/** Mirrors the broken recordings: 100 ms captured, then 900 ms of zeros. */
function buildStarvedCapture(seconds: number): Float32Array {
  return buildPcm(seconds, index => {
    const offsetInSecond = index % SAMPLE_RATE;
    return offsetInSecond < SAMPLE_RATE * 0.1 ? Math.sin(index / 8) * 0.3 : 0;
  });
}

describe('measurePcmCaptureGaps', () => {
  it('reports no gaps for continuous audio', () => {
    const report = measurePcmCaptureGaps(
      buildPcm(5, index => Math.sin(index / 8) * 0.3),
      SAMPLE_RATE
    );
    assert.equal(report.gapRatio, 0);
    assert.equal(report.longestGapMs, 0);
    assert.isFalse(isPcmCaptureSeverelyDamaged(report));
  });

  it('ignores short pauses between words', () => {
    // 50 ms of silence every second is normal speech, not a lost buffer.
    const report = measurePcmCaptureGaps(
      buildPcm(10, index =>
        index % SAMPLE_RATE < SAMPLE_RATE * 0.05 ? 0 : Math.sin(index / 8) * 0.3
      ),
      SAMPLE_RATE
    );
    assert.equal(report.gapRatio, 0);
    assert.isFalse(isPcmCaptureSeverelyDamaged(report));
  });

  it('detects a starved capture that only kept 100 ms per second', () => {
    const report = measurePcmCaptureGaps(buildStarvedCapture(10), SAMPLE_RATE);
    assert.closeTo(report.gapRatio, 0.9, 0.02);
    assert.closeTo(report.longestGapMs, 900, 20);
    assert.isTrue(isPcmCaptureSeverelyDamaged(report));
  });

  it('flags a recording whose capture died part way through', () => {
    const halfway = 5 * SAMPLE_RATE;
    const report = measurePcmCaptureGaps(
      buildPcm(10, index => (index < halfway ? Math.sin(index / 8) * 0.3 : 0)),
      SAMPLE_RATE
    );
    assert.closeTo(report.gapRatio, 0.5, 0.01);
    assert.closeTo(report.longestGapMs, 5_000, 20);
    assert.isTrue(isPcmCaptureSeverelyDamaged(report));
  });

  it('treats empty PCM as gap free', () => {
    const report = measurePcmCaptureGaps(new Float32Array(), SAMPLE_RATE);
    assert.equal(report.gapRatio, 0);
    assert.equal(report.longestGapMs, 0);
  });
});
