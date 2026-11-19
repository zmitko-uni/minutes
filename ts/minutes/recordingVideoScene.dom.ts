// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { VideoRequest } from '@signalapp/ringrtc';
import {
  localPresentationIdentity,
  type PresentationSourceController,
} from './presentationSourceController.std.ts';
import type { ActivePresentationSource } from './presentationSourceRegistry.std.ts';
import { RecordingIncomingVideo } from './recordingIncomingVideo.dom.ts';
import type {
  RecordingVideoBridge,
  RecordingVideoCapture,
} from './recordingVideoBridge.std.ts';
import type { RecordingGalleryTile } from './screenShareCompositor.dom.ts';

type Participant = Readonly<{
  name: string;
  level: number;
  videoEnabled: boolean;
}>;

type RemoteParticipant = Participant &
  Readonly<{ key: number | undefined; sharing: boolean }>;

export type RecordingCallVideoSnapshot = Readonly<{
  local: Participant;
  localSharing: boolean;
  remote: ReadonlyArray<RemoteParticipant>;
}>;

const MAX_BACKGROUND_CAMERAS = 12;
const SPEAKER_HOLD_MS = 400;
const LOCAL_CAMERA_MAX_AGE_MS = 3_000;

type Options = Readonly<{
  conversationId: string;
  bridge: RecordingVideoBridge;
  localPresentation: PresentationSourceController<HTMLCanvasElement>;
  readSnapshot(): RecordingCallVideoSnapshot | undefined;
  now?: () => number;
  createCanvas?: () => HTMLCanvasElement;
}>;

export class RecordingVideoScene {
  readonly #options: Options;
  readonly #incoming: RecordingIncomingVideo;
  readonly #now: () => number;
  readonly #createCanvas: () => HTMLCanvasElement;
  readonly #speakingUntil = new Map<string | number | undefined, number>();
  #capture: RecordingVideoCapture | undefined;
  #clearLocalAuthority: (() => void) | undefined;
  #gallery: ReadonlyArray<RecordingGalleryTile> = [];
  #localCamera: HTMLCanvasElement | undefined;
  #localCameraAt = -Infinity;
  #wantsLocalCamera = false;

  constructor(options: Options) {
    this.#options = options;
    this.#now = options.now ?? (() => performance.now());
    this.#createCanvas =
      options.createCanvas ?? (() => document.createElement('canvas'));
    this.#incoming = new RecordingIncomingVideo({
      getSource: key =>
        options.bridge.getIncomingSource(options.conversationId, key),
      now: this.#now,
      createCanvas: this.#createCanvas,
    });
  }

  start(): void {
    const { bridge, conversationId } = this.#options;
    this.#capture = bridge.startCapture(conversationId, {
      readForDisplay: (...args) => this.#incoming.readForDisplay(...args),
      onLocalCamera: frame => this.#onLocalCamera(frame),
    });
  }

  stop(): void {
    const capture = this.#capture;
    this.#capture = undefined;
    this.#reset();
    capture?.stop();
  }

  #reset(): void {
    this.#clearLocalAuthority?.();
    this.#clearLocalAuthority = undefined;
    this.#incoming.clear();
    this.#speakingUntil.clear();
    this.#gallery = [];
    this.#wantsLocalCamera = false;
    this.#localCamera = undefined;
    this.#localCameraAt = -Infinity;
  }

  getGallery(): ReadonlyArray<RecordingGalleryTile> {
    return this.#gallery;
  }

  getActiveSource(): ActivePresentationSource<HTMLCanvasElement> | undefined {
    const snapshot = this.#capture && this.#options.readSnapshot();
    if (!snapshot) {
      this.#reset();
      this.#capture?.setGroupRequests([]);
      return undefined;
    }

    const { localSharing, remote } = snapshot;
    const presenter = localSharing ? undefined : remote.find(p => p.sharing);
    const usingGallery = !localSharing && !presenter;
    const now = this.#now();
    const activeKeys = new Set<string | number | undefined>([
      'local',
      ...remote.map(p => p.key),
    ]);
    for (const key of this.#speakingUntil.keys()) {
      if (!activeKeys.has(key)) {
        this.#speakingUntil.delete(key);
      }
    }
    const isSpeaking = (key: string | number | undefined, level: number) => {
      if (level > 0) {
        this.#speakingUntil.set(key, now + SPEAKER_HOLD_MS);
      }
      return (this.#speakingUntil.get(key) ?? -Infinity) > now;
    };
    const localSpeaking = isSpeaking('local', snapshot.local.level);
    const people = remote.map(p => ({
      ...p,
      speaking: isSpeaking(p.key, p.level),
    }));
    const eligibleCameras = usingGallery
      ? people.filter(p => p.videoEnabled)
      : [];
    if (eligibleCameras.length > MAX_BACKGROUND_CAMERAS) {
      eligibleCameras.sort((a, b) => Number(b.speaking) - Number(a.speaking));
      eligibleCameras.length = MAX_BACKGROUND_CAMERAS;
    }
    const targets = new Map<number | undefined, 'camera' | 'presentation'>();
    if (presenter?.videoEnabled) {
      targets.set(presenter.key, 'presentation');
    } else {
      for (const { key } of eligibleCameras) {
        targets.set(key, 'camera');
      }
    }
    const requests: Array<VideoRequest> = [];
    for (const [key, kind] of targets) {
      if (key !== undefined) {
        requests.push({
          demuxId: key,
          width: kind === 'presentation' ? 1920 : 320,
          height: kind === 'presentation' ? 1080 : 180,
          framerate: undefined,
        });
      }
    }
    requests.sort((a, b) => a.demuxId - b.demuxId);
    this.#capture?.setGroupRequests(requests);
    this.#incoming.setTargets(targets);
    this.#incoming.poll();

    this.#wantsLocalCamera = usingGallery && snapshot.local.videoEnabled;
    if (!this.#wantsLocalCamera) {
      this.#localCamera = undefined;
      this.#localCameraAt = -Infinity;
    }
    const localCamera =
      now - this.#localCameraAt <= LOCAL_CAMERA_MAX_AGE_MS
        ? this.#localCamera
        : undefined;
    this.#gallery = [
      {
        name: snapshot.local.name,
        speaking: localSpeaking,
        camera: localCamera,
      },
      ...people.map(({ key, name, speaking }) => ({
        name,
        speaking,
        camera: usingGallery ? this.#incoming.getCanvas(key) : undefined,
      })),
    ];

    if (localSharing) {
      this.#clearLocalAuthority ??=
        this.#options.localPresentation.setAuthoritative(
          localPresentationIdentity(this.#options.conversationId)
        );
      return this.#options.localPresentation.getActiveSource();
    }
    this.#clearLocalAuthority?.();
    this.#clearLocalAuthority = undefined;
    if (!presenter) {
      return undefined;
    }
    const screen = this.#incoming.getCanvas(presenter.key);
    if (!screen) {
      return undefined;
    }
    return {
      identity: String(presenter.key),
      source: screen,
      sourceGeneration: 1,
      presentationGeneration: 1,
    };
  }

  #onLocalCamera(frame: VideoFrame): void {
    const now = this.#now();
    if (!this.#wantsLocalCamera || now - this.#localCameraAt < 1000 / 20) {
      return;
    }
    const { displayWidth, displayHeight } = frame;
    if (!displayWidth || !displayHeight) {
      return;
    }
    this.#localCamera ??= this.#createCanvas();
    const canvas = this.#localCamera;
    if (canvas.width !== displayWidth) {
      canvas.width = displayWidth;
    }
    if (canvas.height !== displayHeight) {
      canvas.height = displayHeight;
    }
    canvas
      .getContext('2d')
      ?.drawImage(frame, 0, 0, displayWidth, displayHeight);
    this.#localCameraAt = now;
  }
}
