// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../logging/log.std.ts';
import type { UubtAppendResult } from './uubt.std.ts';
import {
  UUBT_SECTION_TAG_BOTTOM,
  UUBT_SECTION_TAG_MINUTES,
  UUBT_SECTION_TAG_PREPARATION,
} from './uubt.std.ts';
import {
  logUubtErrorMap,
  UubtApiError,
  uubtGet,
  uubtListUseCases,
  uubtPost,
} from './uubtClient.main.ts';
import type { UubtSectionContentItem } from './uubtUu5.std.ts';
import {
  buildMinutesMarker,
  buildMinutesSectionContent,
  extractSectionPlainText,
} from './uubtUu5.std.ts';

const log = createLogger('minutes/uubtMinutes');

/**
 * uuElementaryManagement nemá veřejně dokumentovaný zápisový uuCmd pro sekce,
 * takže se správný název zjistí ze `sys/getUseCases` dané instance a níže
 * uvedené varianty se zkoušejí v tomto pořadí.
 */
const CREATE_SECTION_USE_CASES: ReadonlyArray<string> = [
  'meeting/panel/section/add',
];

const UPDATE_SECTION_USE_CASES: ReadonlyArray<string> = [
  'meeting/section/update',
  'meeting/panel/section/update',
];

/** Sekce zápisu patří ke schůzce — uuCmd jiných artefaktů nezkoušíme. */
const MEETING_USE_CASE_PREFIX = /^meeting\//;

type RawSection = Record<string, unknown> & {
  oid?: string;
  bid?: string;
  id?: string;
  _id?: string;
  commitTs?: string;
  content?: unknown;
  readOnly?: boolean;
  sys?: { rev?: number };
};

type SectionRef = Record<string, unknown> & {
  section?: RawSection;
  oid?: string;
  orderIndex?: number;
};

type MeetingDetail = Record<string, unknown> & {
  name?: string;
  state?: string;
  uuEccRoot?: { oid?: string; bid?: string };
  uuEccMainPage?: string;
};

type MeetingPage = Record<string, unknown> & {
  commitTs?: string;
  readOnly?: boolean;
  panels?: Record<
    string,
    {
      sectionList?: ReadonlyArray<SectionRef>;
      oid?: string;
      id?: string;
      bid?: string;
      commitTs?: string;
      readOnly?: boolean;
    }
  >;
};

type MeetingContext = Readonly<{
  meetingName: string;
  pageOid: string;
  pageId: string | null;
  pageCommitTs: string | null;
  bid: string;
  panelName: string;
  panelOid: string | null;
  panelId: string | null;
  panelBid: string | null;
  panelCommitTs: string | null;
  minutesSections: ReadonlyArray<RawSection>;
  insertOrderIndex: number;
  /** Sekce, za kterou se nový zápis vloží — sekce jsou spojený seznam. */
  predecessorOid: string | null;
  predecessorId: string | null;
}>;

const useCaseCache = new Map<string, ReadonlyArray<string>>();

function unwrap<T>(response: unknown): T {
  if (response && typeof response === 'object' && 'data' in response) {
    const data = (response as { data?: unknown }).data;
    if (data && typeof data === 'object') {
      return data as T;
    }
  }
  return response as T;
}

function sectionHasTag(section: RawSection, tag: string): boolean {
  const content = section.content;
  if (!Array.isArray(content)) {
    return false;
  }
  return content.some(
    item =>
      item && typeof item === 'object' && (item as { tag?: string }).tag === tag
  );
}

function isSystemSection(section: RawSection): boolean {
  return (
    sectionHasTag(section, UUBT_SECTION_TAG_PREPARATION) ||
    sectionHasTag(section, UUBT_SECTION_TAG_MINUTES) ||
    sectionHasTag(section, UUBT_SECTION_TAG_BOTTOM) ||
    sectionHasTag(section, 'UuElementaryManagement.Meeting.DetailTop')
  );
}

async function loadMeetingContext(
  meetingBaseUri: string,
  meetingId: string
): Promise<MeetingContext> {
  const detail = unwrap<MeetingDetail>(
    await uubtGet(meetingBaseUri, 'meeting/load', { id: meetingId })
  );

  const bid = detail.uuEccRoot?.bid;
  const pageOid = detail.uuEccMainPage;
  if (!bid || !pageOid) {
    throw new Error(
      'Schůzka nemá stránku se zápisem (chybí uuEcc data). Otevřete ji v uuBT a zkuste to znovu.'
    );
  }

  const page = unwrap<MeetingPage>(
    await uubtGet(meetingBaseUri, 'meeting/page/load', {
      meetingId,
      id: meetingId,
      'uuEccPage.oid': pageOid,
      'uuEccPage.bid': bid,
      oid: pageOid,
      bid,
    })
  );

  const panelName = page.panels?.mainPanel
    ? 'mainPanel'
    : (Object.keys(page.panels ?? {})[0] ?? 'mainPanel');
  const panel = page.panels?.[panelName];
  const sectionRefs = panel?.sectionList ?? [];

  // Do sekce jen pro čtení selže každá uuEcc operace bez bližší příčiny.
  if (page.readOnly === true || panel?.readOnly === true) {
    throw new Error(
      `Stránka schůzky je jen pro čtení (stav schůzky: ${String(
        detail.state ?? 'neznámý'
      )}). Zápis lze doplnit jen do schůzky, kterou můžete v uuBT editovat.`
    );
  }

  let region: 'before' | 'preparation' | 'minutes' | 'after' = 'before';
  const minutesSections: Array<RawSection> = [];
  let insertOrderIndex = sectionRefs.length;

  sectionRefs.forEach((ref, index) => {
    const section = ref.section;
    if (!section) {
      return;
    }

    if (isSystemSection(section)) {
      if (sectionHasTag(section, UUBT_SECTION_TAG_PREPARATION)) {
        region = 'preparation';
      } else if (sectionHasTag(section, UUBT_SECTION_TAG_MINUTES)) {
        region = 'minutes';
      } else if (sectionHasTag(section, UUBT_SECTION_TAG_BOTTOM)) {
        if (region === 'minutes') {
          insertOrderIndex = index;
        }
        region = 'after';
      }
      return;
    }

    if (region === 'minutes') {
      minutesSections.push(section);
    }
  });

  if (region === 'before') {
    throw new Error(
      'Na stránce schůzky se nepodařilo najít sekci Zápis. Zkontrolujte, že jde o standardní schůzku uuElementaryManagement.'
    );
  }

  const predecessor = sectionRefs[insertOrderIndex - 1]?.section;

  return {
    meetingName: typeof detail.name === 'string' ? detail.name : 'Schůzka',
    pageOid,
    pageId: typeof page.id === 'string' ? page.id : null,
    pageCommitTs: typeof page.commitTs === 'string' ? page.commitTs : null,
    bid,
    panelName,
    panelOid: typeof panel?.oid === 'string' ? panel.oid : null,
    panelId: typeof panel?.id === 'string' ? panel.id : null,
    panelBid: typeof panel?.bid === 'string' ? panel.bid : null,
    panelCommitTs: typeof panel?.commitTs === 'string' ? panel.commitTs : null,
    minutesSections,
    insertOrderIndex,
    predecessorOid: predecessor?.oid ?? null,
    predecessorId: predecessor?.id ?? null,
  };
}

async function resolveSupportedUseCases(
  meetingBaseUri: string
): Promise<ReadonlyArray<string> | null> {
  const cached = useCaseCache.get(meetingBaseUri);
  if (cached) {
    return cached;
  }

  try {
    const useCases = await uubtListUseCases(meetingBaseUri);
    useCaseCache.set(meetingBaseUri, useCases);
    return useCases;
  } catch (error) {
    log.warn(`uubt: sys/getUseCases nedostupné: ${String(error)}`);
    return null;
  }
}

function orderCandidates(
  candidates: ReadonlyArray<string>,
  supported: ReadonlyArray<string> | null,
  extraPattern: RegExp
): ReadonlyArray<string> {
  if (!supported) {
    return candidates;
  }

  const known = candidates.filter(candidate => supported.includes(candidate));
  const discovered = supported.filter(
    useCase =>
      MEETING_USE_CASE_PREFIX.test(useCase) &&
      extraPattern.test(useCase) &&
      !known.includes(useCase)
  );

  return known.length > 0 || discovered.length > 0
    ? [...known, ...discovered]
    : candidates;
}

/** Tvar dtoIn se mezi verzemi uuEcc liší, proto zkoušíme víc variant. */
type DtoInVariant = Readonly<{ label: string; dtoIn: unknown }>;

/**
 * Zkouší kombinace uuCmd a tvarů dtoIn, dokud jedna neprojde. Přeskakuje jen
 * chyby "příkaz neexistuje", "špatný dtoIn" a "operace selhala" — ostatní
 * chyby (oprávnění, stav artefaktu) hlásí hned, opakování by nepomohlo.
 */
async function tryUseCases(
  meetingBaseUri: string,
  useCases: ReadonlyArray<string>,
  buildVariants: (useCase: string) => ReadonlyArray<DtoInVariant>
): Promise<boolean> {
  for (const useCase of useCases) {
    for (const variant of buildVariants(useCase)) {
      try {
        // Záměrně sériově — paralelní pokus by zápis vložil vícekrát.
        // oxlint-disable-next-line no-await-in-loop
        await uubtPost(meetingBaseUri, useCase, variant.dtoIn);
        log.info(`uubt: zápis vložen přes ${useCase} (${variant.label})`);
        return true;
      } catch (error) {
        if (
          error instanceof UubtApiError &&
          (error.isUnsupportedCommand ||
            error.isInvalidDtoIn ||
            error.isOperationFailed)
        ) {
          log.warn(
            `uubt: ${useCase} / ${variant.label} nepoužitelné — ${error.message}`
          );
          continue;
        }
        throw error;
      }
    }
  }
  return false;
}

/**
 * Validátor uuApp je jediná dokumentace, kterou k zápisovému API máme:
 * prázdný dtoIn vrátí seznam povinných klíčů, přeplněný dtoIn zas seznam
 * klíčů, které schéma nezná. Z obojího jde tvar dtoIn odvodit.
 */
async function probeDtoInSchema(
  meetingBaseUri: string,
  useCase: string,
  dtoIn: unknown,
  label: string
): Promise<void> {
  try {
    const response = await uubtPost<unknown>(meetingBaseUri, useCase, dtoIn);
    log.info(`uubt probe ${useCase} (${label}): prošlo`);
    logUubtErrorMap(`probe ${useCase} (${label})`, response);
  } catch (error) {
    log.info(
      `uubt probe ${useCase} (${label}) selhalo — ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    if (error instanceof UubtApiError) {
      logUubtErrorMap(`probe ${useCase} (${label})`, error.body);
    }
  }
}

async function logWriteApiDiagnostics(meetingBaseUri: string): Promise<void> {
  await probeDtoInSchema(
    meetingBaseUri,
    'meeting/section/lock',
    {},
    'prázdný dtoIn'
  );

  const supported = await resolveSupportedUseCases(meetingBaseUri);
  if (!supported) {
    log.warn('uubt: diagnostika zápisového API není dostupná');
    return;
  }
  const related = supported.filter(useCase =>
    /section|panel|page/i.test(useCase)
  );
  log.warn(
    `uubt: žádný známý zápisový uuCmd neprošel. Dostupné příbuzné uuCmd: ${related.join(', ')}`
  );
}

async function createMinutesSection(
  meetingBaseUri: string,
  meetingId: string,
  context: MeetingContext,
  content: ReadonlyArray<UubtSectionContentItem>,
  supported: ReadonlyArray<string> | null
): Promise<boolean> {
  const useCases = orderCandidates(
    CREATE_SECTION_USE_CASES,
    supported,
    /section\/(create|add)|panel\/(create|add)Section/i
  );

  const panelOid = context.panelOid;
  if (!panelOid) {
    return false;
  }

  const panel = { meetingId, bid: context.bid, oid: panelOid };

  return tryUseCases(meetingBaseUri, useCases, () => [
    {
      label: 'panel + order + content',
      dtoIn: buildEccDtoIn({
        ...panel,
        payload: {
          commitTs: context.panelCommitTs ?? undefined,
          order: context.insertOrderIndex,
          content,
        },
      }),
    },
    {
      label: 'panel + content',
      dtoIn: buildEccDtoIn({ ...panel, payload: { content } }),
    },
  ]);
}

/**
 * Tvar dtoIn podle skutečného webového klienta uuBT: `id` je identifikátor
 * schůzky, cílová uuEcc entita se adresuje přes `oid` + `bid` a tentýž blok
 * se duplikuje do obálek `uuEccData`, `uuEccDtoIn` a `uuEccPage`.
 */
function buildEccDtoIn(
  options: Readonly<{
    meetingId: string;
    bid: string;
    oid: string;
    payload?: Readonly<Record<string, unknown>>;
  }>
): Record<string, unknown> {
  const ecc = { oid: options.oid, bid: options.bid, ...options.payload };

  return {
    meetingId: options.meetingId,
    id: options.meetingId,
    ...ecc,
    uuEccData: ecc,
    uuEccDtoIn: ecc,
    uuEccPage: ecc,
  };
}

/** Zamkne sekci pro úpravu; vrací její aktuální data, nebo null. */
async function lockSection(
  meetingBaseUri: string,
  dtoIn: Record<string, unknown>
): Promise<RawSection | null> {
  try {
    const response = await uubtPost<unknown>(
      meetingBaseUri,
      'meeting/section/lock',
      dtoIn
    );
    return unwrap<RawSection>(response);
  } catch (error) {
    if (
      error instanceof UubtApiError &&
      (error.isUnsupportedCommand ||
        error.isInvalidDtoIn ||
        error.isOperationFailed)
    ) {
      log.warn(`uubt: zamknutí sekce selhalo — ${error.message}`);
      return null;
    }
    throw error;
  }
}

async function unlockSection(
  meetingBaseUri: string,
  dtoIn: Record<string, unknown>
): Promise<void> {
  try {
    await uubtPost(meetingBaseUri, 'meeting/section/unlock', dtoIn);
  } catch (error) {
    // Zámek vyprší sám, takže tohle uživatele nemusí zajímat.
    log.warn(`uubt: odemknutí sekce selhalo — ${String(error)}`);
  }
}

async function appendToLastMinutesSection(
  meetingBaseUri: string,
  meetingId: string,
  context: MeetingContext,
  content: ReadonlyArray<UubtSectionContentItem>,
  supported: ReadonlyArray<string> | null
): Promise<boolean> {
  const target = context.minutesSections[context.minutesSections.length - 1];
  const sectionOid = target?.oid;
  if (!target || !sectionOid) {
    return false;
  }

  const existingContent = Array.isArray(target.content) ? target.content : [];
  const mergedContent = [...existingContent, ...content];
  const useCases = orderCandidates(
    UPDATE_SECTION_USE_CASES,
    supported,
    /section\/update/i
  );

  const identity = { meetingId, bid: context.bid, oid: sectionOid };
  const locked = await lockSection(
    meetingBaseUri,
    buildEccDtoIn({ ...identity })
  );
  const commitTs = locked?.commitTs ?? target.commitTs;

  try {
    return await tryUseCases(meetingBaseUri, useCases, () => [
      {
        label: 'uuEcc obálky + commitTs',
        dtoIn: buildEccDtoIn({
          ...identity,
          payload: { commitTs, content: mergedContent },
        }),
      },
      {
        label: 'uuEcc obálky bez commitTs',
        dtoIn: buildEccDtoIn({
          ...identity,
          payload: { content: mergedContent },
        }),
      },
    ]);
  } finally {
    await unlockSection(meetingBaseUri, buildEccDtoIn({ ...identity }));
  }
}

export class UubtDuplicateMinutesError extends Error {
  constructor(meetingName: string) {
    super(`Zápis z této nahrávky už je ve schůzce „${meetingName}“ vložený.`);
    this.name = 'UubtDuplicateMinutesError';
  }
}

/** Vloží AI shrnutí jako nový blok do sekce Zápis dané schůzky. */
export async function appendMinutesToMeeting(
  options: Readonly<{
    meetingBaseUri: string;
    meetingId: string;
    meetingUrl: string | null;
    conversationTitle: string;
    recordedAt: number;
    summaryMarkdown: string;
    allowDuplicate?: boolean;
  }>
): Promise<UubtAppendResult> {
  const summary = options.summaryMarkdown.trim();
  if (summary.length === 0) {
    throw new Error('Shrnutí je prázdné, není co odeslat.');
  }

  const context = await loadMeetingContext(
    options.meetingBaseUri,
    options.meetingId
  );

  const marker = buildMinutesMarker({
    conversationTitle: options.conversationTitle,
    recordedAt: options.recordedAt,
  });

  if (!options.allowDuplicate) {
    const alreadyPresent = context.minutesSections.some(section =>
      extractSectionPlainText(section.content).includes(marker)
    );
    if (alreadyPresent) {
      throw new UubtDuplicateMinutesError(context.meetingName);
    }
  }

  const content = buildMinutesSectionContent({
    conversationTitle: options.conversationTitle,
    recordedAt: options.recordedAt,
    summaryMarkdown: summary,
  });

  const supported = await resolveSupportedUseCases(options.meetingBaseUri);

  // Přednostně doplnit stávající sekci Zápis — nová sekce jen když žádná není.
  if (
    await appendToLastMinutesSection(
      options.meetingBaseUri,
      options.meetingId,
      context,
      content,
      supported
    )
  ) {
    return {
      meetingName: context.meetingName,
      meetingUrl: options.meetingUrl,
      mode: 'appended-to-section',
    };
  }

  if (
    await createMinutesSection(
      options.meetingBaseUri,
      options.meetingId,
      context,
      content,
      supported
    )
  ) {
    return {
      meetingName: context.meetingName,
      meetingUrl: options.meetingUrl,
      mode: 'created-section',
    };
  }

  await logWriteApiDiagnostics(options.meetingBaseUri);
  throw new Error(
    'uuBT odmítlo všechny známé způsoby zápisu do sekce Zápis. Podrobnosti jsou v logu (Minutes → Log).'
  );
}
