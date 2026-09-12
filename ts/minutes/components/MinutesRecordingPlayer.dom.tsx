// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { useState, type JSX } from 'react';

import {
  getRecordingMediaUrl,
  isRecordingMediaVideo,
} from '../recordingMedia.std.ts';
import type { RecordingListItem } from '../recordingsListModel.std.ts';

/**
 * WebM z MediaRecorderu nemá cue body, takže se v něm skoro nedá přetáčet.
 * Když existuje MP4 export, přehráváme radši ten.
 */
function resolveSourcePath(item: RecordingListItem): Readonly<{
  path: string;
  isSeekingLimited: boolean;
}> {
  const mp4Path = item.entry?.mp4Path;
  if (mp4Path != null) {
    return { path: mp4Path, isSeekingLimited: false };
  }
  return {
    path: item.recordingPath,
    isSeekingLimited: item.mediaKind === 'screen-share-video',
  };
}

export function MinutesRecordingPlayer({
  item,
}: Readonly<{ item: RecordingListItem }>): JSX.Element {
  const [hasError, setHasError] = useState(false);
  const { path, isSeekingLimited } = resolveSourcePath(item);
  const url = getRecordingMediaUrl(path);

  if (hasError) {
    return (
      <p className="MinutesTranscriptsTab__note">
        Nahrávku se nepodařilo přehrát. Soubor mohl být přesunut nebo smazán —
        zkuste ho otevřít přes nabídku Soubory.
      </p>
    );
  }

  return (
    <div className="MinutesTranscriptsTab__player">
      {isRecordingMediaVideo(path) ? (
        <video
          key={url}
          className="MinutesTranscriptsTab__video"
          src={url}
          controls
          preload="metadata"
          aria-label={`Video z hovoru ${item.conversationTitle}`}
          onError={() => setHasError(true)}
        />
      ) : (
        <audio
          key={url}
          className="MinutesTranscriptsTab__audio"
          src={url}
          controls
          preload="metadata"
          aria-label={`Nahrávka hovoru ${item.conversationTitle}`}
          onError={() => setHasError(true)}
        />
      )}

      {isSeekingLimited && (
        <p className="MinutesTranscriptsTab__note">
          Ve WebM záznamu nejde spolehlivě přetáčet. Vytvořte MP4 přes nabídku
          Soubory a přehrávač pak umožní posun v čase.
        </p>
      )}
    </div>
  );
}
