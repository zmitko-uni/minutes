// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import type { VideoRequest } from '@signalapp/ringrtc';
import { PresentationSourceController } from '../../minutes/presentationSourceController.std.ts';
import { RecordingVideoBridge } from '../../minutes/recordingVideoBridge.std.ts';
import {
  RecordingVideoScene,
  type RecordingCallVideoSnapshot,
} from '../../minutes/recordingVideoScene.dom.ts';

function setup() {
  const requests: Array<Array<VideoRequest>> = [];
  const bridge = new RecordingVideoBridge();
  const local = { name: 'Me', level: 0, videoEnabled: true };
  const alice = {
    key: 7,
    name: 'Alice',
    level: 1,
    videoEnabled: true,
    sharing: false,
  };
  const bob = {
    key: 10,
    name: 'Bob',
    level: 0,
    videoEnabled: false,
    sharing: false,
  };
  let snapshot: RecordingCallVideoSnapshot = {
    local,
    localSharing: false,
    remote: [alice, bob],
  };
  const sender = {};
  const drawLocal: Array<VideoFrame> = [];
  bridge.bind({
    requestGroupVideo: (_call, targets) => requests.push(targets),
    getIncomingSource: () => ({ receiveVideoFrame: () => [4, 2] }),
    isOutgoingSender: (call, candidate) =>
      call === 'call' && candidate === sender,
  });
  const scene = new RecordingVideoScene({
    conversationId: 'call',
    bridge,
    localPresentation: new PresentationSourceController<HTMLCanvasElement>(),
    readSnapshot: () => snapshot,
    now: () => 0,
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
          putImageData: () => undefined,
          drawImage: (frame: VideoFrame) => drawLocal.push(frame),
        }),
      }) as unknown as HTMLCanvasElement,
  });
  return {
    alice,
    bob,
    bridge,
    drawLocal,
    local,
    requests,
    scene,
    sender,
    setSnapshot: (next: RecordingCallVideoSnapshot) => {
      snapshot = next;
    },
  };
}

describe('RecordingVideoScene', () => {
  it('subscribes to the active presentation instead of camera recording feeds and restores them afterwards', () => {
    const { scene, requests, local, alice, bob, setSnapshot } = setup();
    scene.start();
    assert.isUndefined(scene.getActiveSource());
    assert.deepEqual(requests.at(-1), [
      { demuxId: 7, width: 320, height: 180, framerate: undefined },
    ]);
    assert.deepEqual(
      scene
        .getGallery()
        .map(tile => [tile.name, tile.speaking, Boolean(tile.camera)]),
      [
        ['Me', false, false],
        ['Alice', true, true],
        ['Bob', false, false],
      ]
    );

    setSnapshot({
      local,
      localSharing: false,
      remote: [alice, { ...bob, videoEnabled: true, sharing: true }],
    });
    assert.exists(scene.getActiveSource());
    assert.deepEqual(requests.at(-1), [
      { demuxId: 10, width: 1920, height: 1080, framerate: undefined },
    ]);

    setSnapshot({ local, localSharing: false, remote: [alice, bob] });
    assert.isUndefined(scene.getActiveSource());
    assert.deepEqual(requests.at(-1), [
      { demuxId: 7, width: 320, height: 180, framerate: undefined },
    ]);
    scene.stop();
    assert.deepEqual(requests.at(-1), []);
  });

  it('records only a local camera frame already sent in this call and hides it when the camera turns off', () => {
    const { scene, bridge, sender, drawLocal, local, alice, setSnapshot } =
      setup();
    const frame = { displayWidth: 640, displayHeight: 360 } as VideoFrame;
    scene.start();
    scene.getActiveSource();
    bridge.onSentCameraFrame({}, frame);
    assert.isEmpty(drawLocal);
    bridge.onSentCameraFrame(sender, frame);
    scene.getActiveSource();
    assert.deepEqual(drawLocal, [frame]);
    assert.exists(scene.getGallery()[0]?.camera);

    setSnapshot({
      local: { ...local, videoEnabled: false },
      localSharing: false,
      remote: [alice],
    });
    scene.getActiveSource();
    bridge.onSentCameraFrame(sender, frame);
    assert.deepEqual(drawLocal, [frame]);
    assert.isUndefined(scene.getGallery()[0]?.camera);

    scene.stop();
    bridge.onSentCameraFrame(sender, frame);
    assert.deepEqual(drawLocal, [frame]);
  });
});
