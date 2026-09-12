// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { useMemo, type JSX } from 'react';

import {
  getSpeakerColorIndex,
  listTranscriptSpeakers,
  parseTranscriptInline,
  parseTranscriptSegments,
} from '../transcriptDisplay.std.ts';

function InlineText({ text }: Readonly<{ text: string }>): JSX.Element {
  return (
    <>
      {parseTranscriptInline(text).map((token, index) =>
        token.bold ? (
          <strong key={index}>{token.value}</strong>
        ) : (
          <span key={index}>{token.value}</span>
        )
      )}
    </>
  );
}

/** Přepis se čte jako dialog — každý řečník má svou barvu a svůj řádek. */
export function MinutesTranscriptView({
  transcript,
}: Readonly<{ transcript: string }>): JSX.Element {
  const segments = useMemo(
    () => parseTranscriptSegments(transcript),
    [transcript]
  );
  const speakers = useMemo(() => listTranscriptSpeakers(segments), [segments]);

  return (
    <div className="MinutesTranscriptView">
      {speakers.length > 1 && (
        <div className="MinutesTranscriptView__legend">
          {speakers.map(speaker => (
            <span
              key={speaker}
              className="MinutesTranscriptView__legendItem"
              data-speaker={getSpeakerColorIndex(speaker)}
            >
              {speaker}
            </span>
          ))}
        </div>
      )}

      <div className="MinutesTranscriptView__segments">
        {segments.map((segment, index) => (
          <div
            key={index}
            className="MinutesTranscriptView__segment"
            data-speaker={
              segment.speaker != null
                ? getSpeakerColorIndex(segment.speaker)
                : undefined
            }
          >
            {segment.speaker != null && (
              <span className="MinutesTranscriptView__speaker">
                {segment.speaker}
                {segment.timeRange != null && (
                  <span className="MinutesTranscriptView__time">
                    {segment.timeRange}
                  </span>
                )}
              </span>
            )}
            <p className="MinutesTranscriptView__text">
              <InlineText text={segment.text} />
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
