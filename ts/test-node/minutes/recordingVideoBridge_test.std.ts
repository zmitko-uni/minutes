// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import type { VideoFrameSource, VideoRequest } from '@signalapp/ringrtc';
import { RecordingVideoBridge } from '../../minutes/recordingVideoBridge.std.ts';

function setup() {
  const sent: Array<[string, Array<VideoRequest>, number]> = [];
  const source: VideoFrameSource = {
    receiveVideoFrame: () => [2, 2],
  };
  const bridge = new RecordingVideoBridge();
  bridge.bind({
    requestGroupVideo: (...args) => sent.push(args),
    getIncomingSource: () => source,
    isOutgoingSender: () => false,
  });
  return { bridge, sent, source };
}

describe('RecordingVideoBridge', () => {
  it('keeps requesting the presentation when the hidden UI requests no video and restores the UI on stop', () => {
    const { bridge, sent } = setup();
    const recording = bridge.startCapture('group', {});
    recording.setGroupRequests([
      { demuxId: 10, width: 1920, height: 1080, framerate: undefined },
    ]);

    bridge.requestFromUi(
      'group',
      [
        { demuxId: 10, width: 0, height: 0, framerate: undefined },
        { demuxId: 20, width: 0, height: 0, framerate: undefined },
      ],
      0
    );
    assert.deepEqual(sent.at(-1), [
      'group',
      [
        { demuxId: 10, width: 1920, height: 1080, framerate: undefined },
        { demuxId: 20, width: 0, height: 0, framerate: undefined },
      ],
      0,
    ]);

    recording.stop();
    assert.deepEqual(sent.at(-1), [
      'group',
      [
        { demuxId: 10, width: 0, height: 0, framerate: undefined },
        { demuxId: 20, width: 0, height: 0, framerate: undefined },
      ],
      0,
    ]);
  });

  it('preserves a larger visible tile request and never changes requests for another call', () => {
    const { bridge, sent } = setup();
    const recording = bridge.startCapture('group', {});
    recording.setGroupRequests([
      { demuxId: 10, width: 320, height: 180, framerate: undefined },
    ]);
    bridge.requestFromUi(
      'group',
      [{ demuxId: 10, width: 640, height: 360, framerate: undefined }],
      240
    );
    bridge.requestFromUi(
      'other',
      [{ demuxId: 10, width: 0, height: 0, framerate: undefined }],
      0
    );

    assert.deepEqual(sent.slice(-2), [
      [
        'group',
        [{ demuxId: 10, width: 640, height: 360, framerate: undefined }],
        240,
      ],
      [
        'other',
        [{ demuxId: 10, width: 0, height: 0, framerate: undefined }],
        0,
      ],
    ]);
  });

  it('leaves a display reader unchanged when no recorder is attached to that call', () => {
    const { bridge, source } = setup();
    const display = bridge.wrapDisplaySource('group', 10, source);
    bridge.startCapture('other', {
      readForDisplay: () => undefined,
    });
    assert.deepEqual(
      display.receiveVideoFrame(new Uint8Array(16), 2, 2),
      [2, 2]
    );
  });
});
