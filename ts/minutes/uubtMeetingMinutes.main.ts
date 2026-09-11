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
  'meeting/page/panel/createSection',
  'meeting/page/section/create',
  'meeting/page/panel/addSection',
  'meeting/panel/createSection',
  'meeting/section/create',
];

const UPDATE_SECTION_USE_CASES: ReadonlyArray<string> = [
  'meeting/page/section/update',
  'meeting/page/section/updateByOid',
  'meeting/section/update',
  'meeting/section/updateByOid',
];

type RawSection = Record<string, unknown> & {
  oid?: string;
  bid?: string;
  id?: string;
  content?: unknown;
  sys?: { rev?: number };
};

type SectionRef = Record<string, unknown> & {
  section?: RawSection;
  oid?: string;
  orderIndex?: number;
};

type MeetingDetail = Record<string, unknown> & {
  name?: string;
  uuEccRoot?: { bid?: string };
  uuEccMainPage?: string;
};

type MeetingPage = Record<string, unknown> & {
  panels?: Record<
    string,
    { sectionList?: ReadonlyArray<SectionRef>; oid?: string }
  >;
};

type MeetingContext = Readonly<{
  meetingName: string;
  pageOid: string;
  bid: string;
  panelName: string;
  panelOid: string | null;
  minutesSections: ReadonlyArray<RawSection>;
  insertOrderIndex: number;
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

  return {
    meetingName: typeof detail.name === 'string' ? detail.name : 'Schůzka',
    pageOid,
    bid,
    panelName,
    panelOid: typeof panel?.oid === 'string' ? panel.oid : null,
    minutesSections,
    insertOrderIndex,
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
    useCase => extraPattern.test(useCase) && !known.includes(useCase)
  );

  return known.length > 0 || discovered.length > 0
    ? [...known, ...discovered]
    : candidates;
}

/**
 * Zkusí kandidátní uuCmd, dokud jeden neprojde. Přeskakuje jen chyby
 * "příkaz neexistuje" a "špatný dtoIn" — ostatní chyby (oprávnění, stav
 * artefaktu) hlásí hned, opakování by nepomohlo.
 */
async function tryUseCases(
  meetingBaseUri: string,
  useCases: ReadonlyArray<string>,
  buildDtoIn: (useCase: string) => unknown
): Promise<boolean> {
  for (const useCase of useCases) {
    try {
      // Záměrně sériově — paralelní pokus by zápis vložil vícekrát.
      // oxlint-disable-next-line no-await-in-loop
      await uubtPost(meetingBaseUri, useCase, buildDtoIn(useCase));
      log.info(`uubt: zápis vložen přes ${useCase}`);
      return true;
    } catch (error) {
      if (
        error instanceof UubtApiError &&
        (error.isUnsupportedCommand || error.isInvalidDtoIn)
      ) {
        log.warn(`uubt: ${useCase} nepoužitelné — ${error.message}`);
        continue;
      }
      throw error;
    }
  }
  return false;
}

async function logWriteApiDiagnostics(meetingBaseUri: string): Promise<void> {
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

  return tryUseCases(meetingBaseUri, useCases, () => ({
    id: meetingId,
    meetingId,
    oid: context.pageOid,
    bid: context.bid,
    uuEccPage: { oid: context.pageOid, bid: context.bid },
    uuEccData: {
      pageOid: context.pageOid,
      panelOid: context.panelOid ?? undefined,
      panelName: context.panelName,
      orderIndex: context.insertOrderIndex,
      content,
    },
    panelName: context.panelName,
    panelOid: context.panelOid ?? undefined,
    orderIndex: context.insertOrderIndex,
    content,
  }));
}

async function appendToLastMinutesSection(
  meetingBaseUri: string,
  meetingId: string,
  context: MeetingContext,
  content: ReadonlyArray<UubtSectionContentItem>,
  supported: ReadonlyArray<string> | null
): Promise<boolean> {
  const target = context.minutesSections[context.minutesSections.length - 1];
  if (!target) {
    return false;
  }

  const sectionOid = target.oid ?? target.id;
  if (!sectionOid) {
    return false;
  }

  const existingContent = Array.isArray(target.content) ? target.content : [];
  const mergedContent = [...existingContent, ...content];
  const useCases = orderCandidates(
    UPDATE_SECTION_USE_CASES,
    supported,
    /section\/update/i
  );

  return tryUseCases(meetingBaseUri, useCases, () => ({
    id: meetingId,
    meetingId,
    oid: context.pageOid,
    bid: context.bid,
    uuEccPage: { oid: context.pageOid, bid: context.bid },
    uuEccSection: { oid: sectionOid, bid: target.bid ?? context.bid },
    uuEccData: {
      pageOid: context.pageOid,
      sectionOid,
      content: mergedContent,
    },
    sectionOid,
    revision: target.sys?.rev,
    content: mergedContent,
  }));
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

  await logWriteApiDiagnostics(options.meetingBaseUri);
  throw new Error(
    'uuBT odmítlo všechny známé způsoby zápisu do sekce Zápis. Podrobnosti jsou v logu (Minutes → Log).'
  );
}
