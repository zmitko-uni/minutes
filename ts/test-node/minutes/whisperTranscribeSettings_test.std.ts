// Copyright 2026 Minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import {
  DEFAULT_WHISPER_TRANSCRIBE_SETTINGS,
  normalizeWhisperTranscribeSettings,
} from '../../minutes/whisperTranscribeSettings.std.ts';

describe('minutes/whisperTranscribeSettings', () => {
  it('keeps defaults when input is empty', () => {
    assert.deepEqual(
      normalizeWhisperTranscribeSettings(null),
      DEFAULT_WHISPER_TRANSCRIBE_SETTINGS
    );
  });

  it('normalizes gpuDeviceIndex to a non-negative integer', () => {
    assert.equal(
      normalizeWhisperTranscribeSettings({ gpuDeviceIndex: 2.7 }).gpuDeviceIndex,
      3
    );
    assert.equal(
      normalizeWhisperTranscribeSettings({ gpuDeviceIndex: -4 }).gpuDeviceIndex,
      0
    );
    assert.equal(
      normalizeWhisperTranscribeSettings({ gpuDeviceIndex: Number.NaN })
        .gpuDeviceIndex,
      DEFAULT_WHISPER_TRANSCRIBE_SETTINGS.gpuDeviceIndex
    );
  });

  it('preserves useGpu and decodeMode', () => {
    const normalized = normalizeWhisperTranscribeSettings({
      useGpu: false,
      decodeMode: 'fast',
      gpuDeviceIndex: 1,
      threadCount: 4,
    });
    assert.deepEqual(normalized, {
      threadCount: 4,
      useGpu: false,
      gpuDeviceIndex: 1,
      decodeMode: 'fast',
      autoTranscribe: true,
      whisperBackend: 'node',
      whisperCliPath: '',
    });
  });

  it('defaults autoTranscribe to true and keeps an explicit false', () => {
    assert.isTrue(normalizeWhisperTranscribeSettings(null).autoTranscribe);
    assert.isFalse(
      normalizeWhisperTranscribeSettings({ autoTranscribe: false })
        .autoTranscribe
    );
  });

  it('ignores non-boolean autoTranscribe values', () => {
    assert.isTrue(
      normalizeWhisperTranscribeSettings({
        autoTranscribe: 'no' as unknown as boolean,
      }).autoTranscribe
    );
  });

  it('defaults whisperBackend to node and whisperCliPath to empty', () => {
    const s = normalizeWhisperTranscribeSettings(null);
    assert.equal(s.whisperBackend, 'node');
    assert.equal(s.whisperCliPath, '');
  });

  it('keeps cli backend and trims cli path', () => {
    const s = normalizeWhisperTranscribeSettings({
      whisperBackend: 'cli',
      whisperCliPath: '  /usr/bin/whisper-cli ',
    });
    assert.equal(s.whisperBackend, 'cli');
    assert.equal(s.whisperCliPath, '/usr/bin/whisper-cli');
  });

  it('rejects unknown backend values', () => {
    assert.equal(
      normalizeWhisperTranscribeSettings({ whisperBackend: 'python' as never })
        .whisperBackend,
      'node'
    );
  });
});
