// Copyright 2026 Minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import {
  buildWhisperCliArgs,
  encodePcmF32ToWav16k,
  parseWhisperCliJson,
  parseWhisperCliProgress,
} from '../../minutes/whisperCli.std.ts';

const REQUEST = {
  modelPath: '/m/ggml-small.bin',
  useGpu: true,
  gpuDeviceIndex: 1,
  threadCount: 6,
  language: 'cs',
  prompt: 'Schůzka',
  profile: { temperature: 0.2, beam_size: 8, best_of: 3 },
  useVad: true,
  vadModelPath: '/m/vad.bin',
};

describe('minutes/whisperCli', () => {
  describe('buildWhisperCliArgs', () => {
    it('GPU on + VAD on', () => {
      assert.deepEqual(buildWhisperCliArgs(REQUEST, '/t/in.wav', '/t/out'), [
        '-m',
        '/m/ggml-small.bin',
        '-f',
        '/t/in.wav',
        '-l',
        'cs',
        '-t',
        '6',
        '-tp',
        '0.2',
        '-bs',
        '8',
        '-bo',
        '3',
        '--prompt',
        'Schůzka',
        '-sow',
        '-oj',
        '-of',
        '/t/out',
        '-pp',
        '-np',
        '-dev',
        '1',
        '-fa',
        '--vad',
        '-vm',
        '/m/vad.bin',
        '-vt',
        '0.45',
        '-vspd',
        '120',
        '-vsd',
        '80',
        '-vp',
        '180',
      ]);
    });

    it('GPU off passes -ng -nfa and no -dev/-fa; VAD off has no VAD flags', () => {
      const args = buildWhisperCliArgs(
        { ...REQUEST, useGpu: false, useVad: false },
        '/t/in.wav',
        '/t/out'
      );
      assert.include(args, '-ng');
      assert.include(args, '-nfa');
      assert.notInclude(args, '-dev');
      assert.notInclude(args, '-fa');
      assert.notInclude(args, '--vad');
      assert.notInclude(args, '-vm');
    });
  });

  describe('parseWhisperCliProgress', () => {
    it('parses percent', () => {
      assert.equal(
        parseWhisperCliProgress(
          'whisper_print_progress_callback: progress =  42%'
        ),
        42
      );
      assert.equal(
        parseWhisperCliProgress(
          'whisper_print_progress_callback: progress = 100%'
        ),
        100
      );
    });

    it('returns null for unrelated line', () => {
      assert.isNull(parseWhisperCliProgress('ggml_cuda_init: found 1 CUDA'));
    });
  });

  describe('parseWhisperCliJson', () => {
    const segment = {
      timestamps: { from: '00:00:00,000', to: '00:00:04,000' },
      offsets: { from: 0, to: 4000 },
      text: ' jsme chkěry, tady ten konfigurovat autofnemory.',
    };

    it('maps segments and language', () => {
      const result = parseWhisperCliJson({
        systeminfo: '',
        result: { language: 'cs' },
        transcription: [segment, { ...segment, text: '   ' }],
      });
      assert.deepEqual(result, {
        segments: [
          {
            start: '00:00:00,000',
            end: '00:00:04,000',
            text: 'jsme chkěry, tady ten konfigurovat autofnemory.',
          },
        ],
        language: 'cs',
      });
    });

    it('throws when transcription is not an array', () => {
      assert.throws(
        () => parseWhisperCliJson({ transcription: 'x' }),
        'whisper-cli: neplatný JSON výstup'
      );
    });
  });

  describe('encodePcmF32ToWav16k', () => {
    it('writes a 16 kHz mono s16le RIFF file', () => {
      const wav = encodePcmF32ToWav16k(new Float32Array([0, 1, -1, 2]));
      assert.equal(wav.length, 44 + 8);
      const text = (from: number, to: number): string =>
        String.fromCharCode(...wav.slice(from, to));
      assert.equal(text(0, 4), 'RIFF');
      assert.equal(text(8, 12), 'WAVE');
      const view = new DataView(wav.buffer);
      assert.equal(view.getUint32(24, true), 16000);
      assert.equal(view.getUint16(22, true), 1);
      assert.deepEqual(
        [0, 1, 2, 3].map(i => view.getInt16(44 + i * 2, true)),
        [0, 32767, -32768, 32767]
      );
    });
  });
});
