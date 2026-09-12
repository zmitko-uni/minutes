// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect, useState, type JSX } from 'react';

import { AxoDialog } from '../../axo/AxoDialog.dom.tsx';
import { tw } from '../../axo/tw.dom.tsx';
import { drop } from '../../util/drop.std.ts';
import { openLinkInWebBrowser } from '../../util/openLinkInWebBrowser.dom.ts';
import { formatAppDialogTitle } from '../branding.std.ts';
import { formatUserFacingError } from '../friendlyError.std.ts';
import type { UubtAppendResult, UubtMeeting } from '../uubt.std.ts';
import {
  formatUubtMeetingTimeRange,
  pickMeetingForRecording,
  toUubtDayString,
} from '../uubt.std.ts';
import { appendUubtMinutes, listUubtMeetings } from '../uubtService.preload.ts';

export type UubtSendTarget = Readonly<{
  recordingPath: string;
  conversationTitle: string;
  startedAt: number;
  endedAt: number;
  summaryMarkdown: string;
}>;

type Props = Readonly<{
  target: UubtSendTarget | null;
  onClose: () => void;
  /** Zápis prošel — nadřazený tab si uloží vazbu nahrávky na schůzku. */
  onWritten?: (
    target: UubtSendTarget,
    meeting: UubtMeeting,
    mode: UubtAppendResult['mode']
  ) => void;
}>;

function describeMeeting(meeting: UubtMeeting): string {
  const time = formatUubtMeetingTimeRange(meeting);
  const parts = [time, meeting.name].filter(part => part.length > 0);
  return meeting.organizer
    ? `${parts.join(' · ')} · ${meeting.organizer}`
    : parts.join(' · ');
}

export function MinutesSendToUubtModal({
  target,
  onClose,
  onWritten,
}: Props): JSX.Element | null {
  const [day, setDay] = useState('');
  const [meetings, setMeetings] = useState<ReadonlyArray<UubtMeeting>>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [duplicateMessage, setDuplicateMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!target) {
      return;
    }
    setDay(toUubtDayString(target.startedAt));
    setMeetings([]);
    setSelectedMeetingId('');
    setStatusMessage(null);
    setDuplicateMessage(null);
  }, [target]);

  useEffect(() => {
    if (!target || day.length === 0) {
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setStatusMessage(null);

    drop(
      (async () => {
        try {
          const loaded = await listUubtMeetings(day);
          if (cancelled) {
            return;
          }
          setMeetings(loaded);
          const preselected = pickMeetingForRecording(loaded, {
            startedAt: target.startedAt,
            endedAt: target.endedAt,
          });
          setSelectedMeetingId(preselected?.meetingId ?? '');
          if (loaded.length === 0) {
            setStatusMessage('Pro tento den nemáte v Plus4U žádnou schůzku.');
          }
        } catch (error) {
          if (!cancelled) {
            setMeetings([]);
            setStatusMessage(formatUserFacingError(error));
          }
        } finally {
          if (!cancelled) {
            setIsLoading(false);
          }
        }
      })()
    );

    return () => {
      cancelled = true;
    };
  }, [day, target]);

  const handleSend = useCallback(
    (allowDuplicate: boolean) => {
      const meeting = meetings.find(
        item => item.meetingId === selectedMeetingId
      );
      if (!target || !meeting) {
        return;
      }

      setIsSending(true);
      setStatusMessage(null);
      setDuplicateMessage(null);

      drop(
        (async () => {
          try {
            const response = await appendUubtMinutes({
              meetingBaseUri: meeting.meetingBaseUri,
              meetingId: meeting.meetingId,
              meetingUrl: meeting.meetingUrl,
              conversationTitle: target.conversationTitle,
              recordedAt: target.startedAt,
              summaryMarkdown: target.summaryMarkdown,
              allowDuplicate,
            });

            if (response.status === 'duplicate') {
              setDuplicateMessage(response.message);
              return;
            }

            setStatusMessage(
              `Zápis vložen do schůzky „${response.result.meetingName}".`
            );
            onWritten?.(target, meeting, response.result.mode);
            onClose();
          } catch (error) {
            setStatusMessage(formatUserFacingError(error));
          } finally {
            setIsSending(false);
          }
        })()
      );
    },
    [meetings, onClose, onWritten, selectedMeetingId, target]
  );

  if (!target) {
    return null;
  }

  const selectedMeeting = meetings.find(
    item => item.meetingId === selectedMeetingId
  );

  return (
    <AxoDialog.Root
      open
      onOpenChange={nextOpen => {
        if (!nextOpen) {
          onClose();
        }
      }}
    >
      <AxoDialog.Content size="lg" escape="cancel-is-noop">
        <AxoDialog.Header>
          <AxoDialog.Title>
            {formatAppDialogTitle('Zapsat ke schůzce Plus4U')}
          </AxoDialog.Title>
          <AxoDialog.Close />
        </AxoDialog.Header>
        <AxoDialog.Body>
          <AxoDialog.Description>
            <p className={tw('text-label-medium mb-4 opacity-90')}>
              AI shrnutí hovoru &bdquo;{target.conversationTitle}&ldquo; se
              vloží na konec sekce Zápis vybrané schůzky.
            </p>
          </AxoDialog.Description>

          <div className={tw('flex flex-col gap-4')}>
            <label className={tw('flex flex-col gap-1')}>
              <span>Den</span>
              <input
                type="date"
                className={tw(
                  'rounded-md border border-solid px-3 py-2',
                  'border-label-disabled bg-background-primary text-label-primary'
                )}
                value={day}
                onChange={event => setDay(event.target.value)}
              />
            </label>

            <label className={tw('flex flex-col gap-1')}>
              <span>Schůzka</span>
              <select
                className={tw(
                  'rounded-md border border-solid px-3 py-2',
                  'border-label-disabled bg-background-primary'
                )}
                value={selectedMeetingId}
                disabled={isLoading || meetings.length === 0}
                onChange={event => setSelectedMeetingId(event.target.value)}
              >
                {meetings.length === 0 ? (
                  <option value="">
                    {isLoading ? 'Načítám schůzky…' : 'Žádná schůzka'}
                  </option>
                ) : null}
                {meetings.map(meeting => (
                  <option key={meeting.meetingId} value={meeting.meetingId}>
                    {describeMeeting(meeting)}
                  </option>
                ))}
              </select>
              {selectedMeeting?.meetingUrl ? (
                <span className={tw('text-label-small opacity-70')}>
                  <button
                    type="button"
                    className={tw('underline')}
                    onClick={() => {
                      openLinkInWebBrowser(selectedMeeting.meetingUrl ?? '');
                    }}
                  >
                    Otevřít schůzku v prohlížeči
                  </button>
                </span>
              ) : null}
            </label>

            <label className={tw('flex flex-col gap-1')}>
              <span>Co se vloží</span>
              <textarea
                readOnly
                rows={10}
                className={tw(
                  'w-full rounded-md border border-solid px-3 py-2',
                  'border-label-disabled bg-background-primary text-label-primary'
                )}
                value={target.summaryMarkdown}
              />
            </label>
          </div>
        </AxoDialog.Body>
        <AxoDialog.Footer>
          {duplicateMessage || statusMessage ? (
            <AxoDialog.FooterContent>
              <p className={tw('text-label-small')} role="status">
                {duplicateMessage ?? statusMessage}
              </p>
            </AxoDialog.FooterContent>
          ) : null}
          <AxoDialog.Actions>
            <AxoDialog.Action variant="subtle-secondary" onClick={onClose}>
              Zavřít
            </AxoDialog.Action>
            {duplicateMessage ? (
              <AxoDialog.Action
                variant="strong-secondary"
                disabled={isSending}
                onClick={() => handleSend(true)}
              >
                Vložit znovu
              </AxoDialog.Action>
            ) : (
              <AxoDialog.Action
                variant="strong-primary"
                disabled={isSending || isLoading || !selectedMeeting}
                onClick={() => handleSend(false)}
              >
                {isSending ? 'Odesílám…' : 'Vložit zápis'}
              </AxoDialog.Action>
            )}
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}
