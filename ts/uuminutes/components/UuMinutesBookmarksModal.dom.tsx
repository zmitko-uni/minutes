// Copyright 2026 uuMinutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect, useState, type JSX } from 'react';
import { ipcRenderer } from 'electron';

import { AxoDialog } from '../../axo/AxoDialog.dom.tsx';
import { tw } from '../../axo/tw.dom.tsx';
import { drop } from '../../util/drop.std.ts';
import type { UuMinutesBookmark } from '../bookmarks.std.ts';
import {
  listBookmarks,
  navigateToBookmark,
  removeBookmarkById,
} from '../bookmarksService.preload.ts';

type Props = Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
}>;

function formatWhen(timestamp: number): string {
  try {
    return new Date(timestamp).toLocaleString('cs-CZ');
  } catch {
    return '';
  }
}

export function UuMinutesBookmarksModal({
  open,
  onOpenChange,
}: Props): JSX.Element | null {
  const [bookmarks, setBookmarks] = useState<Array<UuMinutesBookmark>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setIsLoading(true);
    setErrorMessage(null);
    drop(
      (async () => {
        try {
          setBookmarks(await listBookmarks());
        } catch (error) {
          setErrorMessage(
            error instanceof Error ? error.message : 'Nepodařilo se načíst záložky.'
          );
        } finally {
          setIsLoading(false);
        }
      })()
    );
  }, []);

  useEffect(() => {
    if (open) {
      refresh();
    }
  }, [open, refresh]);

  const handleOpen = useCallback(
    (bookmark: UuMinutesBookmark) => {
      navigateToBookmark(bookmark);
      onOpenChange(false);
    },
    [onOpenChange]
  );

  const handleRemove = useCallback(
    (bookmark: UuMinutesBookmark) => {
      drop(
        (async () => {
          await removeBookmarkById(bookmark.id);
          refresh();
        })()
      );
    },
    [refresh]
  );

  if (!open) {
    return null;
  }

  return (
    <AxoDialog.Root open={open} onOpenChange={onOpenChange}>
      <AxoDialog.Content size="md" escape="cancel-is-noop">
        <AxoDialog.Header>
          <AxoDialog.Title>Záložky</AxoDialog.Title>
          <AxoDialog.Close />
        </AxoDialog.Header>

        <AxoDialog.Body>
          <AxoDialog.Description>
            <p className={tw('mb-4 text-label-medium leading-relaxed')}>
              Uložené zprávy z libovolného chatu. Přidejte je pravým tlačítkem na
              zprávu → <strong>Přidat do záložek</strong>.
            </p>
          </AxoDialog.Description>

          {isLoading && (
            <p className={tw('text-label-secondary')}>Načítám…</p>
          )}

          {errorMessage && (
            <p className="UuMinutesBookmarksModal__error">{errorMessage}</p>
          )}

          {!isLoading && bookmarks.length === 0 && (
            <p className={tw('text-label-secondary')}>
              Zatím nemáte žádné záložky.
            </p>
          )}

          {!isLoading && bookmarks.length > 0 && (
            <ul className="UuMinutesBookmarksModal__list">
              {bookmarks.map(bookmark => (
                <li key={bookmark.id} className="UuMinutesBookmarksModal__item">
                  <button
                    type="button"
                    className="UuMinutesBookmarksModal__open"
                    onClick={() => handleOpen(bookmark)}
                  >
                    <span className="UuMinutesBookmarksModal__title">
                      {bookmark.conversationTitle}
                    </span>
                    <span className="UuMinutesBookmarksModal__preview">
                      {bookmark.messagePreview}
                    </span>
                    <span className="UuMinutesBookmarksModal__meta">
                      {formatWhen(bookmark.messageTimestamp)}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="UuMinutesBookmarksModal__remove"
                    aria-label="Odebrat záložku"
                    onClick={() => handleRemove(bookmark)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </AxoDialog.Body>

        <AxoDialog.Footer>
          <AxoDialog.Actions>
            <AxoDialog.Action variant="secondary" onClick={refresh}>
              Obnovit
            </AxoDialog.Action>
            <AxoDialog.Action variant="primary" onClick={() => onOpenChange(false)}>
              Zavřít
            </AxoDialog.Action>
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}

export function UuMinutesBookmarksHost(): JSX.Element {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (): void => {
      setOpen(true);
    };
    ipcRenderer.on('uuminutes:open-bookmarks', handler);
    return () => {
      ipcRenderer.removeListener('uuminutes:open-bookmarks', handler);
    };
  }, []);

  return <UuMinutesBookmarksModal open={open} onOpenChange={setOpen} />;
}
