// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type JSX,
  type ReactNode,
} from 'react';
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
import { drop } from '../../util/drop.std.ts';
import { openLinkInWebBrowser } from '../../util/openLinkInWebBrowser.dom.ts';
import type {
  UubemBusinessCard,
  UubemBusinessCardDetail,
} from '../uubem.std.ts';
import {
  describeUubemSignalContact,
  formatUubemCardName,
  getUubemCardInitials,
  getUubemPersonDetailUrl,
  parseUubemSignalContact,
  UUBEM_MIN_SEARCH_LENGTH,
} from '../uubem.std.ts';
import type { TaskRecipient } from '../taskRecipients.preload.ts';
import { listTaskRecipients } from '../taskRecipients.preload.ts';
import {
  findUubemBusinessCards,
  loadUubemBusinessCard,
  loadUubemPersonPhoto,
  shareUubemBusinessCard,
  openUubemSignalConversation,
} from '../uubemService.preload.ts';
import { useUubtIntegrationEnabled } from '../uubtIntegration.preload.ts';
import { formatUserFacingError } from '../friendlyError.std.ts';
import { MinutesIcon } from './MinutesIcon.dom.tsx';

/** Hledá se až po dopsání, ať se uuBEM nevolá na každé písmeno. */
const SEARCH_DEBOUNCE_MS = 350;

function toErrorMessage(error: unknown, fallback: string): string {
  const friendly = formatUserFacingError(error);
  return friendly.length > 0 ? friendly : fallback;
}

type CardSelection = Readonly<{ id: string; uuIdentity: string }>;

/**
 * Fotka osoby z Plus4U. Dokud nedorazí — a u lidí, kteří ji nemají, trvale —
 * zůstane kolečko s iniciálami, takže se řádky seznamu nehýbou.
 */
function BusinessCardAvatar({
  card,
  variant,
}: Readonly<{
  card: Readonly<{ uuIdentity: string; name: string; surname: string }>;
  variant: 'list' | 'detail';
}>): JSX.Element {
  const [photo, setPhoto] = useState<string | null>(null);
  const { uuIdentity } = card;

  useEffect(() => {
    let cancelled = false;
    setPhoto(null);

    drop(
      (async () => {
        const loaded = await loadUubemPersonPhoto(uuIdentity);
        if (!cancelled) {
          setPhoto(loaded);
        }
      })()
    );

    return () => {
      cancelled = true;
    };
  }, [uuIdentity]);

  const className = `MinutesBusinessCardsTab__avatar MinutesBusinessCardsTab__avatar--${variant}`;

  if (photo != null) {
    return <img className={className} src={photo} alt="" aria-hidden />;
  }

  return (
    <span className={className} aria-hidden role="presentation">
      {getUubemCardInitials(card)}
    </span>
  );
}

function CardDetailRow({
  label,
  children,
}: Readonly<{ label: string; children: ReactNode }>): JSX.Element {
  return (
    <div className="MinutesBusinessCardsTab__detailRow">
      <span className="MinutesBusinessCardsTab__detailLabel">{label}</span>
      <span className="MinutesBusinessCardsTab__detailValue">{children}</span>
    </div>
  );
}

/** Kolik chatů ukázat, než uživatel začne hledat — celý seznam je dlouhý. */
const SHARE_RESULT_LIMIT = 30;

function normalizeForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/** Výběr Signal chatu, do kterého se vizitka pošle. */
function ShareCardPanel({
  card,
  onClose,
  onShared,
}: Readonly<{
  card: UubemBusinessCardDetail;
  onClose: () => void;
  onShared: (conversationTitle: string) => void;
}>): JSX.Element {
  const [query, setQuery] = useState('');
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Seznam chatů se během otevřeného panelu nemění, stačí ho vzít raz.
  const recipients = useMemo(() => listTaskRecipients(), []);

  const matches = useMemo(() => {
    const needle = normalizeForSearch(query);
    const filtered =
      needle.length === 0
        ? recipients
        : recipients.filter(recipient =>
            normalizeForSearch(recipient.title).includes(needle)
          );
    return filtered.slice(0, SHARE_RESULT_LIMIT);
  }, [query, recipients]);

  const share = useCallback(
    (recipient: TaskRecipient) => {
      setSendingId(recipient.id);
      setErrorMessage(null);

      drop(
        (async () => {
          const ok = await shareUubemBusinessCard({
            card,
            conversationId: recipient.id,
          });
          setSendingId(null);
          if (ok) {
            onShared(recipient.title);
          } else {
            setErrorMessage('Vizitku se nepodařilo odeslat.');
          }
        })()
      );
    },
    [card, onShared]
  );

  return (
    <div className="MinutesBusinessCardsTab__share">
      <div className="MinutesBusinessCardsTab__shareHeader">
        <span className="MinutesBusinessCardsTab__detailLabel">
          Komu vizitku poslat
        </span>
        <AxoButton.Root variant="implied-secondary" size="sm" onClick={onClose}>
          Zavřít
        </AxoButton.Root>
      </div>

      <input
        className="MinutesBusinessCardsTab__shareInput"
        type="text"
        autoFocus
        placeholder="Hledat v Signal kontaktech"
        aria-label="Hledat v Signal kontaktech"
        value={query}
        onChange={event => setQuery(event.target.value)}
      />

      {errorMessage != null && (
        <p className="MinutesBusinessCardsTab__error">{errorMessage}</p>
      )}

      {matches.length === 0 ? (
        <p className="MinutesBusinessCardsTab__detailNote">
          Žádný chat neodpovídá hledání.
        </p>
      ) : (
        <ul className="MinutesBusinessCardsTab__shareList">
          {matches.map(recipient => (
            <li key={recipient.id}>
              <button
                type="button"
                className="MinutesBusinessCardsTab__shareItem"
                disabled={sendingId != null}
                onClick={() => share(recipient)}
              >
                <span>{recipient.title}</span>
                {sendingId === recipient.id && <span>Odesílám…</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Detail vybrané vizitky — kontakty a tlačítko do Signalu. */
function BusinessCardDetail({
  selection,
}: Readonly<{ selection: CardSelection }>): JSX.Element {
  const [card, setCard] = useState<UubemBusinessCardDetail | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [messageNote, setMessageNote] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setCard(null);
    setErrorMessage(null);
    setMessageNote(null);
    setIsSharing(false);
    setShareNote(null);

    drop(
      (async () => {
        try {
          const loaded = await loadUubemBusinessCard(selection);
          if (!cancelled) {
            setCard(loaded);
          }
        } catch (error) {
          if (!cancelled) {
            setErrorMessage(
              toErrorMessage(error, 'Vizitku se nepodařilo načíst.')
            );
          }
        }
      })()
    );

    return () => {
      cancelled = true;
    };
  }, [selection]);

  const signalContact = useMemo(() => {
    return card ? parseUubemSignalContact(card.signalUri) : null;
  }, [card]);

  const hasAnyContactDetails =
    card != null &&
    (card.phoneList.length > 0 ||
      card.emailList.length > 0 ||
      card.addressList.length > 0);

  const handleWriteMessage = useCallback(() => {
    if (signalContact == null) {
      return;
    }
    setIsSending(true);
    setMessageNote(null);
    drop(
      (async () => {
        const result = await openUubemSignalConversation(signalContact);
        setIsSending(false);
        if (result.status === 'not-found') {
          setMessageNote(
            'Signal kontakt z vizitky se nepodařilo dohledat — osoba možná Signal nepoužívá nebo je údaj na vizitce neplatný.'
          );
        } else if (result.status === 'error') {
          setMessageNote(result.message);
        }
      })()
    );
  }, [signalContact]);

  if (errorMessage != null) {
    return (
      <div className="MinutesBusinessCardsTab__detail">
        <p className="MinutesBusinessCardsTab__error">{errorMessage}</p>
      </div>
    );
  }

  if (card == null) {
    return (
      <div className="MinutesBusinessCardsTab__detail">
        <p className="MinutesBusinessCardsTab__detailNote">Načítám vizitku…</p>
      </div>
    );
  }

  return (
    <div className="MinutesBusinessCardsTab__detail">
      <header className="MinutesBusinessCardsTab__detailHeader">
        <BusinessCardAvatar card={card} variant="detail" />

        <div className="MinutesBusinessCardsTab__detailHeading">
          <h2 className="MinutesBusinessCardsTab__detailTitle">
            {formatUubemCardName(card)}
          </h2>
          <p className="MinutesBusinessCardsTab__detailMeta">
            uuIdentity {card.uuIdentity}
          </p>
        </div>
      </header>

      <div className="MinutesBusinessCardsTab__detailActions">
        {signalContact != null && (
          <>
            <span className="MinutesBusinessCardsTab__signalHint">
              <MinutesIcon name="chat" />
              {describeUubemSignalContact(signalContact)}
            </span>

            <AxoButton.Root
              variant="strong-primary"
              size="md"
              disabled={isSending}
              onClick={handleWriteMessage}
            >
              {isSending ? 'Hledám v Signalu…' : 'Napsat zprávu'}
            </AxoButton.Root>
          </>
        )}

        <AxoButton.Root
          variant="subtle-secondary"
          size="md"
          onClick={() => openLinkInWebBrowser(getUubemPersonDetailUrl(card.id))}
        >
          Otevřít v uuBEM
        </AxoButton.Root>

        <AxoButton.Root
          variant="subtle-secondary"
          size="md"
          onClick={() => setIsSharing(current => !current)}
        >
          Sdílet vizitku
        </AxoButton.Root>
      </div>

      {isSharing && (
        <ShareCardPanel
          card={card}
          onClose={() => setIsSharing(false)}
          onShared={title => {
            setIsSharing(false);
            setShareNote(`Vizitka odeslána do chatu ${title}.`);
          }}
        />
      )}

      {shareNote != null && (
        <p className="MinutesBusinessCardsTab__detailNote">{shareNote}</p>
      )}

      {messageNote != null && (
        <p className="MinutesBusinessCardsTab__error">{messageNote}</p>
      )}

      {card.phoneList.length > 0 && (
        <CardDetailRow label="Telefon">
          <ul className="MinutesBusinessCardsTab__contactList">
            {card.phoneList.map(item => (
              <li key={item.phone}>
                {item.phone}
                {item.description.length > 0 ? ` · ${item.description}` : ''}
              </li>
            ))}
          </ul>
        </CardDetailRow>
      )}

      {card.emailList.length > 0 && (
        <CardDetailRow label="E-mail">
          <ul className="MinutesBusinessCardsTab__contactList">
            {card.emailList.map(item => (
              <li key={item.email}>
                {item.email}
                {item.description.length > 0 ? ` · ${item.description}` : ''}
              </li>
            ))}
          </ul>
        </CardDetailRow>
      )}

      {card.addressList.length > 0 && (
        <CardDetailRow label="Adresa">
          <ul className="MinutesBusinessCardsTab__contactList">
            {card.addressList.map(item => (
              <li key={item.lines.join('|')}>
                {[...item.lines, item.zip, item.country]
                  .filter(part => part.length > 0)
                  .join(', ')}
              </li>
            ))}
          </ul>
        </CardDetailRow>
      )}

      {!hasAnyContactDetails && (
        <p className="MinutesBusinessCardsTab__detailNote">
          Tahle vizitka nemá v uuBEM vyplněný žádný telefon, e-mail ani adresu —
          víc než jméno a uuIdentity o osobě uuBEM nevede.
        </p>
      )}

      {signalContact == null && (
        <p className="MinutesBusinessCardsTab__detailNote">
          Vizitka nemá vyplněný Signal kontakt, takže z ní zprávu poslat nejde.
        </p>
      )}
    </div>
  );
}

export function MinutesBusinessCardsTab(): JSX.Element {
  const i18n = useSelector(getIntl);
  const navTabsCollapsed = useSelector(getNavTabsCollapsed);
  const preferredLeftPaneWidth = useSelector(getPreferredLeftPaneWidth);
  const otherTabsUnreadStats = useSelector(getOtherTabsUnreadStats);
  const hasPendingUpdate = useSelector(getHasPendingUpdate);
  const hasFailedStorySends = useSelector(getHasAnyFailedStorySends);
  const { savePreferredLeftPaneWidth, toggleNavTabsCollapse } =
    useItemsActions();
  const integrationEnabled = useUubtIntegrationEnabled();

  const [query, setQuery] = useState('');
  const [cards, setCards] = useState<ReadonlyArray<UubemBusinessCard>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selection, setSelection] = useState<CardSelection | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const trimmedQuery = query.trim();

  useEffect(() => {
    if (!integrationEnabled) {
      return;
    }
    if (trimmedQuery.length < UUBEM_MIN_SEARCH_LENGTH) {
      setCards([]);
      setHasSearched(false);
      setErrorMessage(null);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    setIsSearching(true);
    const timer = setTimeout(() => {
      drop(
        (async () => {
          try {
            const found = await findUubemBusinessCards(trimmedQuery);
            if (!cancelled) {
              setCards(found);
              setErrorMessage(null);
            }
          } catch (error) {
            if (!cancelled) {
              setCards([]);
              setErrorMessage(
                toErrorMessage(error, 'Hledání v uuBEM se nepodařilo.')
              );
            }
          } finally {
            if (!cancelled) {
              setIsSearching(false);
              setHasSearched(true);
            }
          }
        })()
      );
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmedQuery, integrationEnabled]);

  const listContent = (): ReactNode => {
    if (!integrationEnabled) {
      return (
        <p className="MinutesBusinessCardsTab__empty">
          Vizitky potřebují zapnutou integraci Plus4U. Zapněte ji v Nastavení AI
          a doplňte access code 1 a 2.
        </p>
      );
    }
    if (trimmedQuery.length < UUBEM_MIN_SEARCH_LENGTH) {
      return (
        <p className="MinutesBusinessCardsTab__empty">
          Zadejte jméno nebo příjmení osoby (alespoň {UUBEM_MIN_SEARCH_LENGTH}{' '}
          znaky).
        </p>
      );
    }
    if (isSearching) {
      return <p className="MinutesBusinessCardsTab__empty">Hledám v uuBEM…</p>;
    }
    if (cards.length === 0) {
      return hasSearched ? (
        <p className="MinutesBusinessCardsTab__empty">Hledání nic nenašlo.</p>
      ) : null;
    }

    return (
      <ul className="MinutesBusinessCardsTab__list">
        {cards.map(card => (
          <li key={card.id} className="MinutesBusinessCardsTab__row">
            <button
              type="button"
              className="MinutesBusinessCardsTab__item"
              aria-current={card.id === selection?.id}
              onClick={() =>
                setSelection({ id: card.id, uuIdentity: card.uuIdentity })
              }
            >
              <BusinessCardAvatar card={card} variant="list" />

              <span className="MinutesBusinessCardsTab__itemText">
                <span className="MinutesBusinessCardsTab__itemTitle">
                  {formatUubemCardName(card)}
                </span>
                <span className="MinutesBusinessCardsTab__itemMeta">
                  {card.uuIdentity}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="MinutesBusinessCardsTab">
      <NavSidebar
        i18n={i18n}
        title="Vizitky"
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
            placeholder="Hledat osobu v uuBEM"
            label="Hledat osobu v uuBEM"
            value={query}
            onChange={event => setQuery(event.target.value)}
            onClear={() => setQuery('')}
          />
        </NavSidebarSearchHeader>

        {errorMessage != null && (
          <p className="MinutesBusinessCardsTab__error">{errorMessage}</p>
        )}

        {listContent()}
      </NavSidebar>

      {selection == null ? (
        <div className="MinutesBusinessCardsTab__emptyState">
          <p>Vyberte osobu vlevo a zobrazí se tady její vizitka.</p>
        </div>
      ) : (
        <BusinessCardDetail
          key={`${selection.id}:${selection.uuIdentity}`}
          selection={selection}
        />
      )}
    </div>
  );
}
