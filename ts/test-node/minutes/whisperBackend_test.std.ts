// Copyright 2026 Minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { DEFAULT_CALL_SUMMARY_EXTENSION } from '../../minutes/callSummaryExtension.std.ts';
import type { CallSummaryExtensionPublic } from '../../minutes/callSummaryExtension.std.ts';
import {
  describeTranscriptionBlockedReason,
  resolveWhisperBackend,
} from '../../minutes/whisperBackend.std.ts';

const CLI_DEFAULT = { executable: 'whisper-cli' };

describe('minutes/whisperBackend', () => {
  describe('resolveWhisperBackend', () => {
    it('node preferred and ready -> node', () => {
      const r = resolveWhisperBackend({
        preferred: 'node',
        node: { ready: true },
        cli: { ready: false, ...CLI_DEFAULT },
      });
      assert.equal(r.effective, 'node');
      assert.isNull(r.reason);
    });

    it('node preferred but unavailable, cli ready -> cli', () => {
      const r = resolveWhisperBackend({
        preferred: 'node',
        node: { ready: false, error: 'x' },
        cli: { ready: true, ...CLI_DEFAULT },
      });
      assert.equal(r.effective, 'cli');
      assert.isNull(r.reason);
    });

    it('node preferred, both unavailable -> null with joined reason', () => {
      const r = resolveWhisperBackend({
        preferred: 'node',
        node: { ready: false, error: 'Unsupported platform' },
        cli: { ready: false, ...CLI_DEFAULT },
      });
      assert.isNull(r.effective);
      assert.equal(
        r.reason,
        'whisper.node není k dispozici: Unsupported platform; whisper-cli nenalezen (PATH)'
      );
    });

    it('uses unknown error text when node.error is missing', () => {
      const r = resolveWhisperBackend({
        preferred: 'node',
        node: { ready: false },
        cli: { ready: false, ...CLI_DEFAULT },
      });
      assert.equal(
        r.reason,
        'whisper.node není k dispozici: neznámá chyba; whisper-cli nenalezen (PATH)'
      );
    });

    it('cli preferred and ready -> cli', () => {
      const r = resolveWhisperBackend({
        preferred: 'cli',
        node: { ready: true },
        cli: { ready: true, ...CLI_DEFAULT },
      });
      assert.equal(r.effective, 'cli');
      assert.isNull(r.reason);
    });

    it('cli preferred, cli missing -> null, never falls back to node', () => {
      const r = resolveWhisperBackend({
        preferred: 'cli',
        node: { ready: true },
        cli: { ready: false, ...CLI_DEFAULT },
      });
      assert.isNull(r.effective);
      assert.equal(r.reason, 'whisper-cli nenalezen (PATH)');
    });

    it('shows configured path in the reason', () => {
      const r = resolveWhisperBackend({
        preferred: 'cli',
        node: { ready: true },
        cli: { ready: false, executable: '/opt/whisper/whisper-cli' },
      });
      assert.equal(
        r.reason,
        'whisper-cli nenalezen (/opt/whisper/whisper-cli)'
      );
    });
  });

  describe('describeTranscriptionBlockedReason', () => {
    const okState: CallSummaryExtensionPublic = {
      ...DEFAULT_CALL_SUMMARY_EXTENSION,
      activated: true,
      modelReady: true,
      whisperBackend: {
        ...DEFAULT_CALL_SUMMARY_EXTENSION.whisperBackend,
        effective: 'node',
        reason: null,
      },
    };

    it('missing PCM sidecar wins over everything', () => {
      const state = {
        ...DEFAULT_CALL_SUMMARY_EXTENSION,
        whisperBackend: {
          ...DEFAULT_CALL_SUMMARY_EXTENSION.whisperBackend,
          reason: 'backend problem',
        },
      };
      assert.equal(
        describeTranscriptionBlockedReason(state, false),
        'Přepis vyžaduje PCM záznam z nahrávání v Minutes'
      );
    });

    it('backend reason comes before model and activation', () => {
      const state = {
        ...DEFAULT_CALL_SUMMARY_EXTENSION,
        whisperBackend: {
          ...DEFAULT_CALL_SUMMARY_EXTENSION.whisperBackend,
          reason: 'backend problem',
        },
      };
      assert.equal(
        describeTranscriptionBlockedReason(state, true),
        'backend problem'
      );
    });

    it('model not ready', () => {
      assert.equal(
        describeTranscriptionBlockedReason(
          { ...okState, modelReady: false },
          true
        ),
        'Whisper model není stažený — Nastavení Přepisů (Minutes)'
      );
    });

    it('not activated', () => {
      assert.equal(
        describeTranscriptionBlockedReason(
          { ...okState, activated: false },
          true
        ),
        'Přepis není aktivovaný — Nastavení Přepisů (Minutes)'
      );
    });

    it('all ok -> null', () => {
      assert.isNull(describeTranscriptionBlockedReason(okState, true));
    });
  });
});
