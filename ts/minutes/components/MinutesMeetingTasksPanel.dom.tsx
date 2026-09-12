// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useMemo, useState, type JSX } from 'react';

import { AxoButton } from '../../axo/AxoButton.dom.tsx';
import { drop } from '../../util/drop.std.ts';
import { formatUserFacingError } from '../friendlyError.std.ts';
import {
  createEmptyMeetingTask,
  formatMeetingTaskMessage,
  groupMeetingTasksByAssignee,
  isMeetingTaskSendable,
  type MeetingTaskDraft,
} from '../meetingTasks.std.ts';
import { proposeMeetingTasks } from '../meetingTasksService.preload.ts';
import { sendSignalChatMessage } from '../sendSignalChatMessage.preload.ts';
import {
  listTaskRecipients,
  matchTaskRecipient,
  type TaskRecipient,
} from '../taskRecipients.preload.ts';
import { MinutesIconButton } from './MinutesIconButton.dom.tsx';
import { MinutesIcon } from './MinutesIcon.dom.tsx';

const NO_AI_HINT =
  'Bez zapnutého AI shrnutí úkoly nenavrhneme. Zapněte ho v Minutes → Nastavení AI…';

function TaskRow({
  task,
  recipients,
  isSending,
  onChange,
  onRemove,
  onSend,
}: Readonly<{
  task: MeetingTaskDraft;
  recipients: ReadonlyArray<TaskRecipient>;
  isSending: boolean;
  onChange: (task: MeetingTaskDraft) => void;
  onRemove: () => void;
  onSend: () => void;
}>): JSX.Element {
  return (
    <li className="MinutesMeetingTasks__task">
      <input
        type="text"
        className="MinutesMeetingTasks__title"
        aria-label="Název úkolu"
        placeholder="Co se má udělat"
        value={task.title}
        onChange={event => onChange({ ...task, title: event.target.value })}
      />

      <textarea
        className="MinutesMeetingTasks__detail"
        aria-label="Popis úkolu"
        placeholder="Kontext ze zápisu (nepovinné)"
        rows={2}
        value={task.detail}
        onChange={event => onChange({ ...task, detail: event.target.value })}
      />

      <div className="MinutesMeetingTasks__taskMeta">
        <input
          type="text"
          className="MinutesMeetingTasks__due"
          aria-label="Termín"
          placeholder="Termín (nepovinné)"
          value={task.dueLabel}
          onChange={event =>
            onChange({ ...task, dueLabel: event.target.value })
          }
        />

        <select
          className="MinutesMeetingTasks__recipient"
          aria-label="Komu úkol poslat"
          value={task.conversationId ?? ''}
          onChange={event =>
            onChange({
              ...task,
              conversationId:
                event.target.value.length > 0 ? event.target.value : null,
            })
          }
        >
          <option value="">Vyberte chat příjemce…</option>
          {recipients.map(recipient => (
            <option key={recipient.id} value={recipient.id}>
              {recipient.title}
            </option>
          ))}
        </select>

        <AxoButton.Root
          variant="subtle-primary"
          size="sm"
          disabled={isSending || !isMeetingTaskSendable(task)}
          onClick={onSend}
        >
          Odeslat úkol
        </AxoButton.Root>

        <MinutesIconButton
          icon="trash"
          tone="danger"
          label="Smazat úkol"
          onClick={onRemove}
        />
      </div>
    </li>
  );
}

/**
 * Návrh úkolů ze zápisu. Úkoly jsou jen podklad — uživatel je upraví
 * a pak je Minutes pošlou jako formální zprávu do chatu daného člověka.
 */
export function MinutesMeetingTasksPanel({
  meetingName,
  meetingWhen,
  sourceChatTitle,
  minutesMarkdown,
  participants,
}: Readonly<{
  meetingName: string;
  meetingWhen: string;
  sourceChatTitle: string;
  minutesMarkdown: string;
  participants: ReadonlyArray<string>;
}>): JSX.Element {
  const [tasks, setTasks] = useState<ReadonlyArray<MeetingTaskDraft> | null>(
    null
  );
  const [isProposing, setIsProposing] = useState(false);
  const [sendingKey, setSendingKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const recipients = useMemo(() => listTaskRecipients(), []);

  const propose = useCallback(() => {
    setIsProposing(true);
    setErrorMessage(null);
    setStatusMessage(null);

    drop(
      (async () => {
        try {
          const proposed = await proposeMeetingTasks({
            meetingName,
            meetingWhen,
            sourceChatTitle,
            participants,
            minutesMarkdown,
          });

          if (proposed.length === 0) {
            setTasks([]);
            setStatusMessage(
              'AI v zápisu nenašla konkrétní úkoly. Můžete si přidat vlastní.'
            );
            return;
          }

          setTasks(
            proposed.map(task => ({
              ...task,
              conversationId: matchTaskRecipient(task.assignee, recipients),
            }))
          );
        } catch (error) {
          setErrorMessage(formatUserFacingError(error));
        } finally {
          setIsProposing(false);
        }
      })()
    );
  }, [
    meetingName,
    meetingWhen,
    minutesMarkdown,
    participants,
    recipients,
    sourceChatTitle,
  ]);

  const updateTask = useCallback((updated: MeetingTaskDraft) => {
    setTasks(current =>
      (current ?? []).map(task => (task.id === updated.id ? updated : task))
    );
  }, []);

  const removeTask = useCallback((id: string) => {
    setTasks(current => (current ?? []).filter(task => task.id !== id));
  }, []);

  const addTask = useCallback((assignee: string) => {
    setTasks(current => [...(current ?? []), createEmptyMeetingTask(assignee)]);
  }, []);

  const sendTasks = useCallback(
    (
      key: string,
      assignee: string,
      conversationId: string,
      selected: ReadonlyArray<MeetingTaskDraft>
    ) => {
      setSendingKey(key);
      setErrorMessage(null);
      setStatusMessage(null);

      drop(
        (async () => {
          try {
            const body = formatMeetingTaskMessage({
              meetingName,
              meetingDay: meetingWhen,
              meetingTimeRange: '',
              sourceChatTitle,
              assignee,
              tasks: selected,
            });
            const sent = await sendSignalChatMessage(
              conversationId,
              body,
              'meetingTasks'
            );
            if (sent) {
              setStatusMessage(
                selected.length === 1
                  ? `Úkol odeslán: ${assignee}`
                  : `Odesláno ${selected.length} úkolů: ${assignee}`
              );
            }
          } catch (error) {
            setErrorMessage(formatUserFacingError(error));
          } finally {
            setSendingKey(null);
          }
        })()
      );
    },
    [meetingName, meetingWhen, sourceChatTitle]
  );

  const groups = useMemo(
    () => groupMeetingTasksByAssignee(tasks ?? []),
    [tasks]
  );

  return (
    <section className="MinutesMeetingTasks">
      <div className="MinutesMeetingTasks__header">
        <h4 className="MinutesMeetingTasks__heading">Úkoly ze zápisu</h4>
        <span
          className="MinutesTranscriptsTab__hintWrap"
          title={minutesMarkdown.trim().length > 0 ? undefined : NO_AI_HINT}
        >
          <AxoButton.Root
            variant="subtle-primary"
            size="sm"
            disabled={isProposing || minutesMarkdown.trim().length === 0}
            onClick={propose}
          >
            <span className="MinutesMeetingTasks__buttonLabel">
              <MinutesIcon name="ai" />
              {isProposing
                ? 'Čtu zápis…'
                : tasks == null
                  ? 'Navrhnout úkoly'
                  : 'Navrhnout znovu'}
            </span>
          </AxoButton.Root>
        </span>
      </div>

      {errorMessage != null && (
        <p className="MinutesMeetingPane__error">{errorMessage}</p>
      )}
      {statusMessage != null && (
        <p className="MinutesMeetingTasks__status">{statusMessage}</p>
      )}

      {tasks == null ? (
        <p className="MinutesMeetingTasks__hint">
          AI projde zápis a navrhne, jaké úkoly z něj komu vyplývají. Návrhy pak
          můžete upravit, smazat a poslat konkrétním lidem do chatu.
        </p>
      ) : (
        <>
          {groups.map(group => {
            const sendable = group.tasks.filter(isMeetingTaskSendable);
            const bulkConversationId =
              sendable.length > 0 &&
              sendable.every(
                task => task.conversationId === sendable[0]?.conversationId
              )
                ? (sendable[0]?.conversationId ?? null)
                : null;

            return (
              <div key={group.assignee} className="MinutesMeetingTasks__group">
                <div className="MinutesMeetingTasks__groupHeader">
                  <span className="MinutesMeetingTasks__assignee">
                    {group.assignee === '—' ? 'Bez řešitele' : group.assignee}
                  </span>
                  <span className="MinutesMeetingTasks__groupActions">
                    <AxoButton.Root
                      variant="subtle-primary"
                      size="sm"
                      disabled={
                        sendingKey != null ||
                        bulkConversationId == null ||
                        sendable.length < 2
                      }
                      onClick={() => {
                        if (bulkConversationId != null) {
                          sendTasks(
                            `group:${group.assignee}`,
                            group.assignee,
                            bulkConversationId,
                            sendable
                          );
                        }
                      }}
                    >
                      {`Odeslat všechny (${sendable.length})`}
                    </AxoButton.Root>
                    <MinutesIconButton
                      icon="plus"
                      label="Přidat úkol této osobě"
                      onClick={() => addTask(group.assignee)}
                    />
                  </span>
                </div>

                <ul className="MinutesMeetingTasks__list">
                  {group.tasks.map(task => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      recipients={recipients}
                      isSending={sendingKey != null}
                      onChange={updateTask}
                      onRemove={() => removeTask(task.id)}
                      onSend={() => {
                        if (task.conversationId != null) {
                          sendTasks(
                            `task:${task.id}`,
                            task.assignee,
                            task.conversationId,
                            [task]
                          );
                        }
                      }}
                    />
                  ))}
                </ul>
              </div>
            );
          })}

          <AxoButton.Root
            variant="subtle-secondary"
            size="sm"
            onClick={() => addTask('')}
          >
            Přidat úkol
          </AxoButton.Root>
        </>
      )}
    </section>
  );
}
