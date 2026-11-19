// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import type { VideoFrameSource } from '@signalapp/ringrtc';
import { RecordingIncomingVideo } from '../../minutes/recordingIncomingVideo.dom.ts';

function setup() {
  let nextPixel: number | undefined;
  let now = 0;
  const rendered: Array<number> = [];
  const source: VideoFrameSource = {
    receiveVideoFrame: buffer => {
      if (nextPixel === undefined) {
        return undefined;
      }
      buffer.fill(nextPixel, 0, 32);
      nextPixel = undefined;
      return [4, 2];
    },
  };
  const incoming = new RecordingIncomingVideo({
    getSource: () => source,
    now: () => now,
    createCanvas: () =>
      ({
        width: 0,
        height: 0,
        getContext: () => ({
          createImageData: (width: number, height: number) => ({
            width,
            height,
            data: new Uint8ClampedArray(width * height * 4),
          }),
          putImageData: (data: ImageData) => rendered.push(data.data[0] ?? -1),
        }),
      }) as unknown as HTMLCanvasElement,
  });
  return {
    incoming,
    rendered,
    source,
    advance: (ms: number) => {
      now += ms;
    },
    frame: (pixel: number) => {
      nextPixel = pixel;
    },
  };
}

describe('RecordingIncomingVideo', () => {
  it('polls RingRTC without a display reader and lets the display reuse that frame once', () => {
    const { incoming, frame, rendered, source } = setup();
    incoming.setTargets(new Map([[7, 'presentation']]));
    frame(42);
    incoming.poll();

    assert.exists(incoming.getCanvas(7));
    assert.deepEqual(rendered, [42]);
    const output = new Uint8Array(32);
    assert.deepEqual(incoming.readForDisplay(7, source, output, 4, 2), [4, 2]);
    assert.strictEqual(output[0], 42);
    assert.isUndefined(incoming.readForDisplay(7, source, output, 4, 2));
  });

  it('records a frame even when the display consumed it first', () => {
    const { incoming, frame, rendered, source } = setup();
    incoming.setTargets(new Map([[7, 'presentation']]));
    frame(17);
    const output = new Uint8Array(32);
    assert.deepEqual(incoming.readForDisplay(7, source, output, 4, 2), [4, 2]);
    output.fill(99);
    incoming.poll();

    assert.exists(incoming.getCanvas(7));
    assert.deepEqual(rendered, [17]);
  });

  it('does not use cached camera pixels when the same participant starts sharing', () => {
    const { incoming, frame } = setup();
    incoming.setTargets(new Map([[7, 'camera']]));
    frame(18);
    incoming.poll();
    assert.exists(incoming.getCanvas(7));

    incoming.setTargets(new Map([[7, 'presentation']]));
    assert.isUndefined(incoming.getCanvas(7));
  });

  it('keeps a static presentation but no longer shows a stale camera frame', () => {
    const { incoming, advance, frame } = setup();
    incoming.setTargets(new Map([[7, 'camera']]));
    frame(11);
    incoming.poll();
    advance(4_000);
    assert.isUndefined(incoming.getCanvas(7));

    incoming.setTargets(new Map([[10, 'presentation']]));
    frame(12);
    incoming.poll();
    advance(4_000);
    assert.exists(incoming.getCanvas(10));
  });
});
