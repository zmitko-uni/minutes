// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { useMemo, useRef, type JSX, type ReactNode } from 'react';

import {
  getSpeakerColorIndex,
  listTranscriptSpeakers,
  parseTranscriptInline,
  parseTranscriptSegments,
} from '../transcriptDisplay.std.ts';
import {
  createMinutesTextRenderer,
  useScrollToActiveHighlight,
  type MinutesTextHighlight,
  type MinutesTextRenderer,
} from './MinutesTextHighlight.dom.tsx';

function renderSegmentText(
  text: string,
  keyPrefix: string,
  renderText: MinutesTextRenderer
): Array<ReactNode> {
  return parseTranscriptInline(text).map((token, index) => {
    const key = `${keyPrefix}-${index}`;
    const content = renderText(token.value, key);
    return token.bold ? (
      <strong key={key}>{content}</strong>
    ) : (
      <span key={key}>{content}</span>
    );
  });
}

/** Přepis se čte jako dialog — každý řečník má svou barvu a svůj řádek. */
export function MinutesTranscriptView({
  transcript,
  highlight,
}: Readonly<{
  transcript: string;
  highlight?: MinutesTextHighlight | null;
}>): JSX.Element {
  const segments = useMemo(
    () => parseTranscriptSegments(transcript),
    [transcript]
  );
  const speakers = useMemo(() => listTranscriptSpeakers(segments), [segments]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Zvýrazňovač se spotřebuje během tohoto renderu, proto se nemémuje.
  const renderText = createMinutesTextRenderer(highlight ?? null);
  useScrollToActiveHighlight(containerRef, highlight ?? null, segments.length);

  return (
    <div className="MinutesTranscriptView" ref={containerRef}>
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
              {renderSegmentText(segment.text, `seg-${index}`, renderText)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
