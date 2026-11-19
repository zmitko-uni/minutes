// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { CallMode } from '../types/CallDisposition.std.ts';
import {
  getActiveCallState,
  getCallSelector,
} from '../state/selectors/calling.std.ts';
import { getLocalSpeakerDisplayName } from './localSpeakerName.preload.ts';
import type { RecordingCallVideoSnapshot } from './recordingVideoScene.dom.ts';

export function readRecordingVideoSnapshot(
  conversationId: string,
  callMode: CallMode.Direct | CallMode.Group
): RecordingCallVideoSnapshot | undefined {
  const state = window.reduxStore.getState();
  const active = getActiveCallState(state);
  if (
    active?.conversationId !== conversationId ||
    active.callMode !== callMode
  ) {
    return undefined;
  }
  const call = getCallSelector(state)(conversationId);
  if (!call || call.callMode !== callMode) {
    return undefined;
  }
  const local = {
    name: getLocalSpeakerDisplayName(),
    level: active.hasLocalAudio ? active.localAudioLevel : 0,
    videoEnabled: active.hasLocalVideo,
  };
  const localSharing = Boolean(active.presentingSource);
  if (call.callMode === CallMode.Direct) {
    const conversation = window.ConversationController.get(conversationId);
    return {
      local,
      localSharing,
      remote: [
        {
          key: undefined,
          name:
            conversation?.getTitle() ??
            window.SignalContext.i18n('icu:unknownContact'),
          level: call.hasRemoteAudio === false ? 0 : call.remoteAudioLevel,
          videoEnabled:
            Boolean(call.hasRemoteVideo) && !conversation?.isBlocked(),
          sharing: Boolean(call.isSharingScreen),
        },
      ],
    };
  }
  return {
    local,
    localSharing,
    remote: call.remoteParticipants.map(participant => {
      const conversation = window.ConversationController.get(participant.aci);
      return {
        key: participant.demuxId,
        name:
          conversation?.getTitle() ??
          window.SignalContext.i18n('icu:unknownContact'),
        level: participant.hasRemoteAudio
          ? (call.remoteAudioLevels?.get(participant.demuxId) ?? 0)
          : 0,
        videoEnabled:
          participant.hasRemoteVideo &&
          participant.mediaKeysReceived &&
          !conversation?.isBlocked(),
        sharing: participant.sharingScreen,
      };
    }),
  };
}
