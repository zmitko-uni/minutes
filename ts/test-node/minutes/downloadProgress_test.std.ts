// Copyright 2026 Minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import {
  createDownloadProgressReporter,
  formatDownloadDetail,
  formatDownloadEta,
  formatDownloadRate,
  formatDownloadSize,
} from '../../minutes/downloadProgress.std.ts';

describe('minutes/downloadProgress', () => {
  it('formats sizes with Czech decimal comma', () => {
    assert.equal(formatDownloadSize(512), '512 B');
    assert.equal(formatDownloadSize(2048), '2 kB');
    assert.equal(formatDownloadSize(5 * 1024 * 1024), '5 MB');
    assert.equal(formatDownloadSize(1.2 * 1024 ** 3), '1,2 GB');
  });

  it('formats rate and eta', () => {
    assert.equal(formatDownloadRate(25 * 1024 * 1024), '25 MB/s');
    assert.equal(formatDownloadEta(42), 'zbývá ~42 s');
    assert.equal(formatDownloadEta(240), 'zbývá ~4 min');
  });

  it('builds detail line with and without total size', () => {
    assert.equal(
      formatDownloadDetail({
        loadedBytes: 1.2 * 1024 ** 3,
        totalBytes: 7.1 * 1024 ** 3,
        bytesPerSecond: 24 * 1024 * 1024,
        etaSeconds: 240,
      }),
      '1,2 GB / 7,1 GB · 17 % · 24 MB/s · zbývá ~4 min'
    );

    assert.equal(
      formatDownloadDetail({
        loadedBytes: 50 * 1024 * 1024,
        totalBytes: null,
        bytesPerSecond: 10 * 1024 * 1024,
      }),
      '50 MB · 10 MB/s'
    );
  });

  it('throttles progress reports but always flushes the last update', () => {
    let nowMs = 0;
    const reports: Array<{ loadedBytes: number; percent?: number }> = [];

    const reporter = createDownloadProgressReporter({
      intervalMs: 100,
      now: () => nowMs,
      onReport: snapshot => {
        reports.push({
          loadedBytes: snapshot.loadedBytes,
          percent: snapshot.percent,
        });
      },
    });

    reporter.onProgress(0, 1000);
    nowMs += 10;
    reporter.onProgress(100, 1000);
    nowMs += 10;
    reporter.onProgress(200, 1000);
    nowMs += 150;
    reporter.onProgress(300, 1000);
    reporter.flush();

    assert.deepEqual(reports.map(report => report.loadedBytes), [0, 300]);
    assert.equal(reports[1]?.percent, 30);
  });

  it('computes speed and eta from elapsed time', () => {
    let nowMs = 0;
    let lastEta: number | undefined;

    const reporter = createDownloadProgressReporter({
      intervalMs: 0,
      now: () => nowMs,
      onReport: snapshot => {
        lastEta = snapshot.etaSeconds;
      },
    });

    reporter.onProgress(0, 1000);
    nowMs = 1000;
    reporter.onProgress(250, 1000);
    reporter.flush();

    assert.approximately(lastEta ?? 0, 3, 0.1);
  });
});
