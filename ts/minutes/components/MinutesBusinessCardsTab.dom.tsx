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
  PersonCardDetail,
  PersonCardSource,
  PersonContact,
  PersonName,
  PersonSearchResult,
  PersonSignalCandidate,
  PersonSourceError,
} from '../personCard.std.ts';
import {
  describePersonSources,
  formatPersonName,
  getPersonInitials,
  normalizeUuIdentityKey,
  PERSON_CARD_MIN_SEARCH_LENGTH,
  PERSON_CARD_SOURCE_LABELS,
  PERSON_CARD_SOURCES,
} from '../personCard.std.ts';
import { getUubemPersonDetailUrl } from '../uubem.std.ts';
import type { TaskRecipient } from '../taskRecipients.preload.ts';
import { listTaskRecipients } from '../taskRecipients.preload.ts';
import {
  loadMyPersonCard,
  loadPersonCardDetail,
  loadPersonPhoto,
  openPersonSignalConversation,
  searchPersonCards,
  sharePersonCard,
} from '../personCardService.preload.ts';
import { useUubtIntegrationEnabled } from '../uubtIntegration.preload.ts';
import { MinutesIcon } from './MinutesIcon.dom.tsx';

/** Hledá se až po dopsání, ať se oba zdroje nevolají na každé písmeno. */
const SEARCH_DEBOUNCE_MS = 350;

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.length > 0
    ? error.message
    : fallback;
}

type CardSelection = Readonly<{ uuIdentity: string; uubemId: string | null }>;

function toSelection(person: PersonSearchResult): CardSelection {
  return { uuIdentity: person.uuIdentity, uubemId: person.uubemId };
}

/** Fotka se přednačte kousek před tím, než na řádek dojede scroll. */
const PHOTO_PRELOAD_MARGIN = '200px';

/**
 * Fotka osoby z Plus4U. Dokud nedorazí — a u lidí, kteří ji nemají, trvale —
 * zůstane kolečko s iniciálami, takže se řádky seznamu nehýbou.
 *
 * V seznamu se o fotku říká, až je řádek na dohled. Bez toho by se při každém
 * hledání tahaly desítky fotek naráz a Plus4U by je odbavil timeoutem.
 */
function PersonAvatar({
  uuIdentity,
  name,
  variant,
}: Readonly<{
  uuIdentity: string;
  name: PersonName;
  variant: 'list' | 'detail';
}>): JSX.Element {
  const [photo, setPhoto] = useState<string | null>(null);
  const [shouldLoad, setShouldLoad] = useState(variant === 'detail');
  const [node, setNode] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (shouldLoad || node == null) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          setShouldLoad(true);
        }
      },
      { rootMargin: PHOTO_PRELOAD_MARGIN }
    );
    observer.observe(node);

    return () => observer.disconnect();
  }, [shouldLoad, node]);

  useEffect(() => {
    if (!shouldLoad) {
      return undefined;
    }

    let cancelled = false;
    setPhoto(null);

    drop(
      (async () => {
        const loaded = await loadPersonPhoto(uuIdentity);
        if (!cancelled) {
          setPhoto(loaded);
        }
      })()
    );

    return () => {
      cancelled = true;
    };
  }, [uuIdentity, shouldLoad]);

  const className = `MinutesBusinessCardsTab__avatar MinutesBusinessCardsTab__avatar--${variant}`;

  if (photo != null) {
    return (
      <img ref={setNode} className={className} src={photo} alt="" aria-hidden />
    );
  }

  return (
    <span ref={setNode} className={className} aria-hidden role="presentation">
      {getPersonInitials(name)}
    </span>
  );
}

/** Odkud údaj pochází — „uuBEM“, „Plus4U People“, nebo obojí. */
function SourceTag({
  sources,
}: Readonly<{
  sources: ReadonlyArray<PersonCardSource>;
}>): JSX.Element | null {
  if (sources.length === 0) {
    return null;
  }
  return (
    <span className="MinutesBusinessCardsTab__sourceTag">
      {describePersonSources(sources)}
    </span>
  );
}

/** Přepínače zdrojů nad seznamem. Vypnutý zdroj se ani nedotazuje. */
function SourceFilters({
  enabled,
  onToggle,
}: Readonly<{
  enabled: ReadonlyArray<PersonCardSource>;
  onToggle: (source: PersonCardSource) => void;
}>): JSX.Element {
  return (
    <div
      className="MinutesBusinessCardsTab__filters"
      role="group"
      aria-label="Zdroje vizitek"
    >
      {PERSON_CARD_SOURCES.map(source => (
        <button
          key={source}
          type="button"
          className="MinutesBusinessCardsTab__filter"
          aria-pressed={enabled.includes(source)}
          onClick={() => onToggle(source)}
        >
          {PERSON_CARD_SOURCE_LABELS[source]}
        </button>
      ))}
    </div>
  );
}

/** Zdroj, který při hledání neodpověděl — výsledky jsou pak neúplné. */
function SearchSourceWarning({
  errors,
}: Readonly<{ errors: ReadonlyArray<PersonSourceError> }>): JSX.Element | null {
  const [first] = errors;
  if (first == null) {
    return null;
  }

  return (
    <p className="MinutesBusinessCardsTab__empty">
      {errors.length > 1
        ? 'Neodpověděl ani jeden ze zdrojů. Podrobnosti jsou v Menu → Minutes → Zobrazit log.'
        : `${PERSON_CARD_SOURCE_LABELS[first.source]} se nepodařilo prohledat, výsledky jsou jen z druhého zdroje.`}
    </p>
  );
}

function SourceErrorNotes({
  errors,
}: Readonly<{ errors: ReadonlyArray<PersonSourceError> }>): JSX.Element | null {
  if (errors.length === 0) {
    return null;
  }
  return (
    <>
      {errors.map(error => (
        <p
          key={`${error.source}:${error.message}`}
          className="MinutesBusinessCardsTab__detailNote"
        >
          {PERSON_CARD_SOURCE_LABELS[error.source]} neodpověděl: {error.message}
        </p>
      ))}
    </>
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

function ContactRows({
  label,
  items,
  showSources,
}: Readonly<{
  label: string;
  items: ReadonlyArray<PersonContact>;
  showSources: boolean;
}>): JSX.Element | null {
  if (items.length === 0) {
    return null;
  }

  return (
    <CardDetailRow label={label}>
      <ul className="MinutesBusinessCardsTab__contactList">
        {items.map(item => (
          <li key={item.value}>
            {item.value}
            {item.description.length > 0 ? ` · ${item.description}` : ''}
            {showSources && <SourceTag sources={item.sources} />}
          </li>
        ))}
      </ul>
    </CardDetailRow>
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
  card: PersonCardDetail;
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
          const ok = await sharePersonCard({
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

/**
 * Stav odesílání sdílený všemi tlačítky „Napsat zprávu“. uuBEM a Plus4U
 * People se v Signal kontaktu i v telefonu běžně rozcházejí, takže tlačítko
 * může být za každý kontakt — hledat se ale smí vždycky jen jedno.
 */
function useSignalWriter(): Readonly<{
  sendingKey: string | null;
  note: string | null;
  write: (candidate: PersonSignalCandidate) => void;
}> {
  const [sendingKey, setSendingKey] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const write = useCallback((candidate: PersonSignalCandidate) => {
    setSendingKey(candidate.key);
    setNote(null);
    drop(
      (async () => {
        const result = await openPersonSignalConversation(candidate.contact);
        setSendingKey(null);
        if (result.status === 'not-found') {
          setNote(
            `Kontakt ${candidate.label} se v Signalu nepodařilo dohledat — zkuste druhý kontakt, nebo osoba Signal nepoužívá.`
          );
        } else if (result.status === 'error') {
          setNote(result.message);
        }
      })()
    );
  }, []);

  return { sendingKey, note, write };
}

/** Vysvětlivky pod řadou tlačítek — odkud kontakt je a co se nepovedlo. */
function SignalNotes({
  candidates,
  note,
}: Readonly<{
  candidates: ReadonlyArray<PersonSignalCandidate>;
  note: string | null;
}>): JSX.Element {
  const [onlyCandidate] = candidates.length === 1 ? candidates : [];

  return (
    <>
      {onlyCandidate != null && (
        <span className="MinutesBusinessCardsTab__signalHint">
          <MinutesIcon name="chat" />
          {onlyCandidate.label}
          <SourceTag sources={onlyCandidate.sources} />
        </span>
      )}

      {candidates.length > 1 && (
        <p className="MinutesBusinessCardsTab__detailNote">
          Kontakty se ve zdrojích liší:{' '}
          {candidates
            .map(
              candidate =>
                `${candidate.label} (${describePersonSources(candidate.sources)})`
            )
            .join(', ')}
          . Vyberte, kterému zkusit napsat.
        </p>
      )}

      {candidates.length > 0 &&
        candidates.every(candidate => candidate.fromPhoneNumber) && (
          <p className="MinutesBusinessCardsTab__detailNote">
            Signal kontakt vyplněný není, zkouší se telefon.
          </p>
        )}

      {candidates.length === 0 && (
        <p className="MinutesBusinessCardsTab__detailNote">
          Ani uuBEM, ani Plus4U People u téhle osoby nemají Signal kontakt ani
          telefon, takže z vizitky zprávu poslat nejde.
        </p>
      )}

      {note != null && <p className="MinutesBusinessCardsTab__error">{note}</p>}
    </>
  );
}

/** Detail vybrané osoby — sloučená data z uuBEM i Plus4U People. */
function PersonCardDetailPane({
  selection,
  isMe,
}: Readonly<{ selection: CardSelection; isMe: boolean }>): JSX.Element {
  const [card, setCard] = useState<PersonCardDetail | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const { sendingKey, note: signalNote, write } = useSignalWriter();

  useEffect(() => {
    let cancelled = false;
    setCard(null);
    setErrorMessage(null);
    setIsSharing(false);
    setShareNote(null);

    drop(
      (async () => {
        try {
          const loaded = await loadPersonCardDetail(selection);
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

  const hasAnyContactDetails =
    card.phoneList.length > 0 ||
    card.emailList.length > 0 ||
    card.addressList.length > 0;

  // Odkud co je, má smysl rozepisovat jen u lidí, které vedou oba zdroje.
  const showSources = card.sources.length > 1;
  const { uubemId } = card;
  // Sám sobě na Signalu nepíšu, takže u vlastní vizitky tlačítko nedává smysl.
  const signalCandidates = isMe ? [] : card.signalCandidates;
  const [onlyCandidate] = signalCandidates.length === 1 ? signalCandidates : [];

  return (
    <div className="MinutesBusinessCardsTab__detail">
      <header className="MinutesBusinessCardsTab__detailHeader">
        <PersonAvatar
          uuIdentity={card.uuIdentity}
          name={card.name}
          variant="detail"
        />

        <div className="MinutesBusinessCardsTab__detailHeading">
          <h2 className="MinutesBusinessCardsTab__detailTitle">
            {formatPersonName(card.name)}
          </h2>
          <p className="MinutesBusinessCardsTab__detailMeta">
            uuIdentity {card.uuIdentity}
            {card.sources.length > 0 && (
              <> · údaje z {describePersonSources(card.sources)}</>
            )}
          </p>
        </div>
      </header>

      <div className="MinutesBusinessCardsTab__detailActions">
        {onlyCandidate != null && (
          <AxoButton.Root
            variant="strong-primary"
            size="md"
            disabled={sendingKey != null}
            onClick={() => write(onlyCandidate)}
          >
            {sendingKey != null ? 'Hledám v Signalu…' : 'Napsat zprávu'}
          </AxoButton.Root>
        )}

        {signalCandidates.length > 1 &&
          signalCandidates.map(candidate => (
            <AxoButton.Root
              key={candidate.key}
              variant="strong-primary"
              size="md"
              disabled={sendingKey != null}
              onClick={() => write(candidate)}
            >
              {sendingKey === candidate.key
                ? 'Hledám v Signalu…'
                : `Napsat na ${candidate.label}`}
            </AxoButton.Root>
          ))}

        {uubemId != null && (
          <AxoButton.Root
            variant="subtle-secondary"
            size="md"
            onClick={() =>
              openLinkInWebBrowser(getUubemPersonDetailUrl(uubemId))
            }
          >
            Otevřít v uuBEM
          </AxoButton.Root>
        )}

        <AxoButton.Root
          variant="subtle-secondary"
          size="md"
          onClick={() => setIsSharing(current => !current)}
        >
          Sdílet vizitku
        </AxoButton.Root>
      </div>

      {!isMe && <SignalNotes candidates={signalCandidates} note={signalNote} />}

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

      <ContactRows
        label="Telefon"
        items={card.phoneList}
        showSources={showSources}
      />
      <ContactRows
        label="E-mail"
        items={card.emailList}
        showSources={showSources}
      />

      {card.addressList.length > 0 && (
        <CardDetailRow label="Adresa">
          <ul className="MinutesBusinessCardsTab__contactList">
            {card.addressList.map(address => (
              <li key={address.text}>{address.text}</li>
            ))}
          </ul>
        </CardDetailRow>
      )}

      {!hasAnyContactDetails && (
        <p className="MinutesBusinessCardsTab__detailNote">
          Ani jeden ze zdrojů u téhle osoby nevede telefon, e-mail nebo adresu —
          víc než jméno a uuIdentity o ní Plus4U neví.
        </p>
      )}

      <SourceErrorNotes errors={card.sourceErrors} />
    </div>
  );
}

/** Vizitka přihlášeného uživatele nad hledáním — otevře stejný detail. */
function MyCardHeader({
  card,
  isSelected,
  onSelect,
}: Readonly<{
  card: PersonSearchResult;
  isSelected: boolean;
  onSelect: () => void;
}>): JSX.Element {
  return (
    <button
      type="button"
      className="MinutesBusinessCardsTab__myCard"
      aria-current={isSelected}
      onClick={onSelect}
    >
      <PersonAvatar
        uuIdentity={card.uuIdentity}
        name={card.name}
        variant="list"
      />
      <span className="MinutesBusinessCardsTab__itemText">
        <span className="MinutesBusinessCardsTab__myCardLabel">
          Vaše vizitka
        </span>
        <span className="MinutesBusinessCardsTab__itemTitle">
          {formatPersonName(card.name) || card.uuIdentity}
        </span>
      </span>
    </button>
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
  const [people, setPeople] = useState<ReadonlyArray<PersonSearchResult>>([]);
  const [searchSourceErrors, setSearchSourceErrors] = useState<
    ReadonlyArray<PersonSourceError>
  >([]);
  const [isSearching, setIsSearching] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selection, setSelection] = useState<CardSelection | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [myCard, setMyCard] = useState<PersonSearchResult | null>(null);
  // Oba zdroje zapnuté — filtr slouží k zúžení, ne k opatrnému zapínání.
  const [enabledSources, setEnabledSources] =
    useState<ReadonlyArray<PersonCardSource>>(PERSON_CARD_SOURCES);

  const trimmedQuery = query.trim();

  const toggleSource = useCallback((source: PersonCardSource) => {
    setEnabledSources(current =>
      current.includes(source)
        ? current.filter(item => item !== source)
        : PERSON_CARD_SOURCES.filter(
            item => item === source || current.includes(item)
          )
    );
  }, []);

  // Pole místo objektu by v závislostech efektu měnilo identitu při každém
  // překreslení, takže se hledání sleduje podle textového klíče.
  const sourcesKey = enabledSources.join(',');

  // Vlastní vizitka se dohledává jednou; když se nepovede, jen se nezobrazí.
  useEffect(() => {
    if (!integrationEnabled) {
      setMyCard(null);
      return;
    }

    let cancelled = false;
    drop(
      (async () => {
        try {
          const loaded = await loadMyPersonCard();
          if (!cancelled) {
            setMyCard(loaded);
          }
        } catch {
          if (!cancelled) {
            setMyCard(null);
          }
        }
      })()
    );

    return () => {
      cancelled = true;
    };
  }, [integrationEnabled]);

  useEffect(() => {
    if (!integrationEnabled) {
      return;
    }
    if (
      trimmedQuery.length < PERSON_CARD_MIN_SEARCH_LENGTH ||
      sourcesKey.length === 0
    ) {
      setPeople([]);
      setSearchSourceErrors([]);
      setTotalCount(null);
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
            const found = await searchPersonCards(
              trimmedQuery,
              sourcesKey.split(',') as ReadonlyArray<PersonCardSource>
            );
            if (!cancelled) {
              setPeople(found.items);
              setSearchSourceErrors(found.sourceErrors);
              setTotalCount(found.totalCount);
              setErrorMessage(null);
            }
          } catch (error) {
            if (!cancelled) {
              setPeople([]);
              setSearchSourceErrors([]);
              setTotalCount(null);
              setErrorMessage(
                toErrorMessage(error, 'Hledání osob se nepodařilo.')
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
  }, [trimmedQuery, integrationEnabled, sourcesKey]);

  const listContent = (): ReactNode => {
    if (!integrationEnabled) {
      return (
        <p className="MinutesBusinessCardsTab__empty">
          Vizitky potřebují zapnutou integraci Plus4U. Zapněte ji v Nastavení AI
          a doplňte access code 1 a 2.
        </p>
      );
    }
    if (enabledSources.length === 0) {
      return (
        <p className="MinutesBusinessCardsTab__empty">
          Zapněte alespoň jeden zdroj, jinak není kde hledat.
        </p>
      );
    }
    if (trimmedQuery.length < PERSON_CARD_MIN_SEARCH_LENGTH) {
      return (
        <p className="MinutesBusinessCardsTab__empty">
          Zadejte jméno nebo příjmení osoby (alespoň{' '}
          {PERSON_CARD_MIN_SEARCH_LENGTH} znaky).
        </p>
      );
    }
    if (isSearching) {
      return (
        <p className="MinutesBusinessCardsTab__empty">
          Hledám v uuBEM a Plus4U People…
        </p>
      );
    }
    if (people.length === 0) {
      return hasSearched ? (
        <p className="MinutesBusinessCardsTab__empty">Hledání nic nenašlo.</p>
      ) : null;
    }

    return (
      <>
        {totalCount != null && (
          <p className="MinutesBusinessCardsTab__empty">
            Zobrazeno prvních {people.length} z {totalCount} nalezených osob —
            upřesněte hledání.
          </p>
        )}

        <ul className="MinutesBusinessCardsTab__list">
          {people.map(person => (
            <li
              key={person.uuIdentity}
              className="MinutesBusinessCardsTab__row"
            >
              <button
                type="button"
                className="MinutesBusinessCardsTab__item"
                aria-current={person.uuIdentity === selection?.uuIdentity}
                onClick={() => setSelection(toSelection(person))}
              >
                <PersonAvatar
                  uuIdentity={person.uuIdentity}
                  name={person.name}
                  variant="list"
                />

                <span className="MinutesBusinessCardsTab__itemText">
                  <span className="MinutesBusinessCardsTab__itemTitle">
                    {formatPersonName(person.name) || person.uuIdentity}
                  </span>
                  <span className="MinutesBusinessCardsTab__itemMeta">
                    {person.uuIdentity}
                    <SourceTag sources={person.sources} />
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </>
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
        {myCard != null && (
          <MyCardHeader
            card={myCard}
            isSelected={myCard.uuIdentity === selection?.uuIdentity}
            onSelect={() => setSelection(toSelection(myCard))}
          />
        )}

        <NavSidebarSearchHeader>
          <SearchInput
            i18n={i18n}
            placeholder="Hledat osobu v uuBEM a Plus4U People"
            label="Hledat osobu v uuBEM a Plus4U People"
            value={query}
            onChange={event => setQuery(event.target.value)}
            onClear={() => setQuery('')}
          />
        </NavSidebarSearchHeader>

        <SourceFilters enabled={enabledSources} onToggle={toggleSource} />

        {errorMessage != null && (
          <p className="MinutesBusinessCardsTab__error">{errorMessage}</p>
        )}

        <SearchSourceWarning errors={searchSourceErrors} />

        {listContent()}
      </NavSidebar>

      {selection == null ? (
        <div className="MinutesBusinessCardsTab__emptyState">
          <p>Vyberte osobu vlevo a zobrazí se tady její vizitka.</p>
        </div>
      ) : (
        <PersonCardDetailPane
          key={`${selection.uuIdentity}:${selection.uubemId ?? ''}`}
          selection={selection}
          isMe={
            myCard != null &&
            normalizeUuIdentityKey(myCard.uuIdentity) ===
              normalizeUuIdentityKey(selection.uuIdentity)
          }
        />
      )}
    </div>
  );
}
