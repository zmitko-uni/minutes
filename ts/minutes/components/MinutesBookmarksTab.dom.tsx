// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';
import { useSelector } from 'react-redux';

import {
  NavSidebar,
  NavSidebarSearchHeader,
} from '../../components/NavSidebar.dom.tsx';
import { AxoButton } from '../../axo/AxoButton.dom.tsx';
import { SearchInput } from '../../components/SearchInput.dom.tsx';
import { getIntl } from '../../state/selectors/user.std.ts';
import {
  getNavTabsCollapsed,
  getPreferredLeftPaneWidth,
} from '../../state/selectors/items.dom.ts';
import { getOtherTabsUnreadStats } from '../../state/selectors/conversations.dom.ts';
import { getHasPendingUpdate } from '../../state/selectors/updates.std.ts';
import { getHasAnyFailedStorySends } from '../../state/selectors/stories.preload.ts';
import { useItemsActions } from '../../state/ducks/items.preload.ts';
import { renderToastManagerWithoutMegaphone } from '../../state/smart/ToastManager.preload.tsx';
import { getMessageById } from '../../messages/getMessageById.preload.ts';
import { getAuthor } from '../../messages/sources.preload.ts';
import { drop } from '../../util/drop.std.ts';
import type { MinutesBookmark } from '../bookmarks.std.ts';
import {
  listBookmarks,
  navigateToBookmark,
  removeBookmarkById,
  subscribeBookmarksOpen,
} from '../bookmarksService.preload.ts';
import { MinutesConfirmDialog } from './MinutesConfirmDialog.dom.tsx';
import { MinutesIconButton } from './MinutesIconButton.dom.tsx';

type BookmarkDetail = Readonly<{
  body: string;
  authorTitle: string;
  isOutgoing: boolean;
}>;

function formatWhen(timestamp: number): string {
  try {
    return new Date(timestamp).toLocaleString('cs-CZ');
  } catch {
    return '';
  }
}

function matchesQuery(bookmark: MinutesBookmark, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) {
    return true;
  }
  return (
    bookmark.conversationTitle.toLowerCase().includes(needle) ||
    bookmark.messagePreview.toLowerCase().includes(needle)
  );
}

/** Náhled vybrané záložky — celý text zprávy, autor a skok do chatu. */
function BookmarkPreview({
  bookmark,
  onOpen,
  onRemove,
}: Readonly<{
  bookmark: MinutesBookmark;
  onOpen: () => void;
  onRemove: () => void;
}>): JSX.Element {
  const [detail, setDetail] = useState<BookmarkDetail | null>(null);
  const [isMissing, setIsMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    setIsMissing(false);

    drop(
      (async () => {
        const message = await getMessageById(bookmark.messageId);
        if (cancelled) {
          return;
        }
        if (!message) {
          setIsMissing(true);
          return;
        }
        const isOutgoing = message.get('type') === 'outgoing';
        setDetail({
          body: message.get('body')?.trim() ?? '',
          authorTitle: isOutgoing
            ? 'Vy'
            : (getAuthor(message.attributes)?.getTitle() ??
              bookmark.conversationTitle),
          isOutgoing,
        });
      })()
    );

    return () => {
      cancelled = true;
    };
  }, [bookmark]);

  return (
    <div className="MinutesBookmarksTab__preview">
      <header className="MinutesBookmarksTab__previewHeader">
        <h2 className="MinutesBookmarksTab__previewTitle">
          {bookmark.conversationTitle}
        </h2>
        <p className="MinutesBookmarksTab__previewMeta">
          {detail ? `${detail.authorTitle} · ` : ''}
          {formatWhen(bookmark.messageTimestamp)}
        </p>

        <div className="MinutesBookmarksTab__previewActions">
          <AxoButton.Root variant="subtle-primary" size="sm" onClick={onOpen}>
            Otevřít chat této zprávy
          </AxoButton.Root>

          <span className="MinutesBookmarksTab__actionsSpacer" />

          <MinutesIconButton
            icon="trash"
            tone="danger"
            label="Odebrat záložku"
            onClick={onRemove}
          />
        </div>
      </header>

      <div className="MinutesBookmarksTab__previewBody">
        {isMissing ? (
          <p className="MinutesBookmarksTab__previewNote">
            Původní zpráva už v databázi není (mohla být smazána nebo vypršela).
            Záložku můžete odebrat.
          </p>
        ) : (
          (detail?.body ?? bookmark.messagePreview)
        )}
      </div>
    </div>
  );
}

export function MinutesBookmarksTab(): JSX.Element {
  const i18n = useSelector(getIntl);
  const navTabsCollapsed = useSelector(getNavTabsCollapsed);
  const preferredLeftPaneWidth = useSelector(getPreferredLeftPaneWidth);
  const otherTabsUnreadStats = useSelector(getOtherTabsUnreadStats);
  const hasPendingUpdate = useSelector(getHasPendingUpdate);
  const hasFailedStorySends = useSelector(getHasAnyFailedStorySends);
  const { savePreferredLeftPaneWidth, toggleNavTabsCollapse } =
    useItemsActions();

  const [bookmarks, setBookmarks] = useState<ReadonlyArray<MinutesBookmark>>(
    []
  );
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<MinutesBookmark | null>(
    null
  );

  const refresh = useCallback(() => {
    setErrorMessage(null);
    drop(
      (async () => {
        try {
          setBookmarks(await listBookmarks());
        } catch (error) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'Nepodařilo se načíst záložky.'
          );
        }
      })()
    );
  }, []);

  useEffect(() => {
    refresh();
    // Menu i zkratka přepnou na tento tab; když už je otevřený, jen obnovíme.
    return subscribeBookmarksOpen(refresh);
  }, [refresh]);

  const visibleBookmarks = useMemo(() => {
    return bookmarks.filter(bookmark => matchesQuery(bookmark, query));
  }, [bookmarks, query]);

  const selectedBookmark = useMemo(() => {
    return visibleBookmarks.find(item => item.id === selectedId) ?? null;
  }, [visibleBookmarks, selectedId]);

  const handleRemove = useCallback(
    (bookmark: MinutesBookmark) => {
      setPendingRemoval(null);
      drop(
        (async () => {
          await removeBookmarkById(bookmark.id);
          setSelectedId(current => (current === bookmark.id ? null : current));
          refresh();
        })()
      );
    },
    [refresh]
  );

  return (
    <div className="MinutesBookmarksTab">
      {pendingRemoval != null && (
        <MinutesConfirmDialog
          title="Odebrat záložku?"
          description={`Záložka na zprávu z chatu „${pendingRemoval.conversationTitle}“ se odebere. Samotná zpráva v chatu zůstane.`}
          confirmLabel="Odebrat záložku"
          cancelLabel="Ponechat"
          onCancel={() => setPendingRemoval(null)}
          onConfirm={() => handleRemove(pendingRemoval)}
        />
      )}

      <NavSidebar
        i18n={i18n}
        title="Záložky"
        hasFailedStorySends={hasFailedStorySends}
        hasPendingUpdate={hasPendingUpdate}
        navTabsCollapsed={navTabsCollapsed}
        onToggleNavTabsCollapse={toggleNavTabsCollapse}
        otherTabsUnreadStats={otherTabsUnreadStats}
        preferredLeftPaneWidth={preferredLeftPaneWidth}
        requiresFullWidth={false}
        savePreferredLeftPaneWidth={savePreferredLeftPaneWidth}
        renderToastManager={renderToastManagerWithoutMegaphone}
      >
        <NavSidebarSearchHeader>
          <SearchInput
            i18n={i18n}
            placeholder="Hledat v záložkách"
            label="Hledat v záložkách"
            value={query}
            onChange={event => setQuery(event.target.value)}
            onClear={() => setQuery('')}
          />
        </NavSidebarSearchHeader>

        {errorMessage != null && (
          <p className="MinutesBookmarksTab__error">{errorMessage}</p>
        )}

        {visibleBookmarks.length === 0 ? (
          <p className="MinutesBookmarksTab__empty">
            {bookmarks.length === 0
              ? 'Zatím nemáte žádné záložky. Přidáte je pravým tlačítkem na zprávu → Přidat do záložek.'
              : 'Hledání nic nenašlo.'}
          </p>
        ) : (
          <ul className="MinutesBookmarksTab__list">
            {visibleBookmarks.map(bookmark => (
              <li key={bookmark.id} className="MinutesBookmarksTab__row">
                <button
                  type="button"
                  className="MinutesBookmarksTab__item"
                  aria-current={bookmark.id === selectedId}
                  onClick={() => setSelectedId(bookmark.id)}
                  onDoubleClick={() => navigateToBookmark(bookmark)}
                >
                  <span className="MinutesBookmarksTab__itemTitle">
                    {bookmark.conversationTitle}
                  </span>
                  <span className="MinutesBookmarksTab__itemPreview">
                    {bookmark.messagePreview}
                  </span>
                  <span className="MinutesBookmarksTab__itemMeta">
                    {formatWhen(bookmark.messageTimestamp)}
                  </span>
                </button>

                <span className="MinutesBookmarksTab__rowActions">
                  <MinutesIconButton
                    icon="chat"
                    label="Otevřít chat této zprávy"
                    onClick={() => navigateToBookmark(bookmark)}
                  />
                  <MinutesIconButton
                    icon="trash"
                    tone="danger"
                    label="Odebrat záložku"
                    onClick={() => setPendingRemoval(bookmark)}
                  />
                </span>
              </li>
            ))}
          </ul>
        )}
      </NavSidebar>

      {selectedBookmark == null ? (
        <div className="MinutesBookmarksTab__emptyState">
          <p>Vyberte záložku vlevo a zobrazí se tady celá zpráva.</p>
        </div>
      ) : (
        <BookmarkPreview
          key={selectedBookmark.id}
          bookmark={selectedBookmark}
          onOpen={() => navigateToBookmark(selectedBookmark)}
          onRemove={() => setPendingRemoval(selectedBookmark)}
        />
      )}
    </div>
  );
}
