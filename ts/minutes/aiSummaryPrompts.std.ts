// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import {
  getAiOutputLanguageLabel,
  isCzechAiOutputLanguage,
} from './aiSettings.std.ts';
import {
  SIGNAL_AI_SUMMARY_FORMAT_INSTRUCTIONS_CS,
  SIGNAL_AI_SUMMARY_FORMAT_INSTRUCTIONS_EN,
} from './signalChatText.std.ts';

/** Max tokenů pro shrnutí chatu — brání „rozběhnutým“ výstupům (Perplexity apod.). */
export const AI_CHAT_SUMMARY_MAX_TOKENS = 1100;

/** Max znaků výstupu shrnutí (Signal zpráva + rezerva). */
export const AI_CHAT_SUMMARY_MAX_OUTPUT_CHARS = 3500;

export const AI_CHAT_SUMMARY_MAX_ACTION_ITEMS = 6;
export const AI_CHAT_SUMMARY_MAX_OPEN_ITEMS = 3;

const MAX_TRANSCRIPT_CHARS = 80_000;

const CHAT_SUMMARY_CONTENT_RULES_CS = [
  'Délka celého výstupu: maximálně 2800 znaků.',
  'Sekce Shrnutí: 2–5 vět souvislého textu (hlavní téma, průběh, závěr). Žádný seznam funkcí produktu.',
  'Sekce Rozhodnutí a úkoly: maximálně 6 odrážek. Pouze explicitní závazky nebo úkoly, které někdo v chatu převzal, slíbil nebo byl požádán.',
  'Zákaz úkolů: nepřeváděj popis funkcí, vlastností nebo stavu produktu na úkoly (špatně: „Zajistit, že nástroj umí X“).',
  'Zákaz: neopakuj stejný bod, parafrázu ani stejného člověka se stejným úkolem.',
  'Pokud v chatu nejsou žádné úkoly, sekci Rozhodnutí a úkoly vynech úplně.',
  'Sekce Otevřené body: max 3 odrážky — nevyřešené otázky nebo otevřená témata. Vynech sekci, pokud nic nezůstalo.',
  'Nevymýšlej fakta mimo přepis. Zachovej jména účastníků.',
  'Když jsou řádky ve tvaru [Jméno]:, přiřaď úkoly správným lidem.',
].join('\n');

const CHAT_SUMMARY_CONTENT_RULES_EN = [
  'Total output length: at most 2800 characters.',
  'Summary section: 2–5 sentences (main topic, flow, outcome). No feature list.',
  'Decisions and action items: at most 6 bullets. Only explicit commitments someone accepted, promised, or was asked to do.',
  'Forbidden: do not turn product features or descriptions into action items (bad: "Ensure the tool supports X").',
  'Do not repeat the same point, paraphrase, or duplicate assignee + task.',
  'Omit the Decisions section entirely if there are no action items.',
  'Open items: at most 3 bullets — unresolved questions or topics. Omit section if none.',
  'Do not invent facts beyond the transcript. Keep participant names.',
  'When lines use [Speaker Name]:, attribute tasks to the correct people.',
].join('\n');

const CHAT_SUMMARY_FORMAT_TEMPLATE_CS = [
  'Výstup musí mít přesně tuto strukturu (nic navíc):',
  '',
  'Shrnutí:',
  '{2–5 vět}',
  '',
  'Rozhodnutí a úkoly:',
  '- {Jméno}: {konkrétní úkol}',
  '(max 6 řádků; celou sekci vynech, pokud nejsou úkoly)',
  '',
  'Otevřené body:',
  '- {otázka nebo téma}',
  '(max 3 řádky; celou sekci vynech, pokud nic nezůstalo)',
].join('\n');

const CHAT_SUMMARY_FORMAT_TEMPLATE_EN = [
  'Output must follow exactly this structure (nothing extra):',
  '',
  'Summary:',
  '{2–5 sentences}',
  '',
  'Decisions and action items:',
  '- {Name}: {concrete task}',
  '(max 6 lines; omit entire section if no tasks)',
  '',
  'Open items:',
  '- {question or topic}',
  '(max 3 lines; omit section if none)',
].join('\n');

export type BuildChatSummaryPromptsOptions = Readonly<{
  outputLanguage: string;
  conversationTitle: string;
  scopeLabel: string;
  transcript: string;
}>;

export function buildChatSummaryPrompts(
  options: BuildChatSummaryPromptsOptions
): { systemPrompt: string; userPrompt: string } {
  const transcript = options.transcript.slice(0, MAX_TRANSCRIPT_CHARS);

  if (isCzechAiOutputLanguage(options.outputLanguage)) {
    const systemPrompt = [
      'Shrnuješ konverzace ze Signalu pro uživatele. Výstup půjde jako jedna zpráva v chatu.',
      'Celé shrnutí piš výhradně v češtině.',
      SIGNAL_AI_SUMMARY_FORMAT_INSTRUCTIONS_CS,
      CHAT_SUMMARY_CONTENT_RULES_CS,
      CHAT_SUMMARY_FORMAT_TEMPLATE_CS,
    ].join('\n\n');

    const userPrompt = [
      `Chat: ${options.conversationTitle}`,
      `Rozsah: ${options.scopeLabel}`,
      '',
      '--- Přepis ---',
      '',
      transcript,
      '',
      '---',
      '',
      'Napiš shrnutí podle struktury a pravidel. Buď stručný.',
    ].join('\n');

    return { systemPrompt, userPrompt };
  }

  const languageLabel = getAiOutputLanguageLabel(options.outputLanguage);
  const systemPrompt = [
    'You summarize Signal chat conversations. Output goes as a single chat message.',
    `Write the ENTIRE summary only in ${languageLabel}.`,
    SIGNAL_AI_SUMMARY_FORMAT_INSTRUCTIONS_EN,
    CHAT_SUMMARY_CONTENT_RULES_EN,
    CHAT_SUMMARY_FORMAT_TEMPLATE_EN,
  ].join('\n\n');

  const userPrompt = [
    `Chat: ${options.conversationTitle}`,
    `Scope: ${options.scopeLabel}`,
    '',
      '--- Transcript ---',
      '',
      transcript,
      '',
      '---',
      '',
      `Write the summary per structure and rules, exclusively in ${languageLabel}. Be concise.`,
  ].join('\n');

  return { systemPrompt, userPrompt };
}

export type BuildUnreadConversationPromptsOptions = Readonly<{
  outputLanguage: string;
  conversationTitle: string;
  unreadCount: number;
  transcript: string;
}>;

export function buildUnreadConversationPrompts(
  options: BuildUnreadConversationPromptsOptions
): { systemPrompt: string; userPrompt: string } {
  const transcript = options.transcript.slice(0, MAX_TRANSCRIPT_CHARS);

  if (isCzechAiOutputLanguage(options.outputLanguage)) {
    const systemPrompt = [
      'Shrnuješ nepřečtené zprávy z jedné konverzace Signal pro IT pracovníka.',
      'Celá odpověď musí být výhradně v češtině.',
      'Pokud jde jen o neformální small talk bez pracovní relevance (počasí, pozdravy, emoji, meme, off-topic mimo práci), odpověz přesně jedním slovem: SKIP',
      'Jinak urči typ konverzace: neformální, běžná, důležitá nebo kritická.',
      'Neformální = lehká pracovní komunikace; běžná = standardní koordinace; důležitá = rozhodnutí, termíny, blokery; kritická = výpadek, incident, urgentní eskalace.',
      'Zákaz: nepiš úvodní věty typu „Rozumím“, „Shrnutí“, „Zde je“ ani název chatu — ten doplní aplikace.',
      'Nevymýšlej úkoly ani fakta mimo přepis. Max 4 odrážky, žádné opakování.',
      'Odpověz POUZE tímto přesným formátem (nic navíc):',
      'TÉMA: {jedna věta hlavního tématu}',
      '- {co se řeší / důležitý bod}',
      '- {další bod}',
      'TYP: {neformální|běžná|důležitá|kritická}',
    ].join('\n');

    const userPrompt = [
      `Chat: ${options.conversationTitle}`,
      `Nepřečtených zpráv: ${options.unreadCount}`,
      '',
      '---',
      '',
      transcript,
    ].join('\n');

    return { systemPrompt, userPrompt };
  }

  const languageLabel = getAiOutputLanguageLabel(options.outputLanguage);
  const systemPrompt = [
    'You summarize unread messages from one Signal conversation for an IT professional.',
    `Write the entire response only in ${languageLabel}.`,
    'If the messages are trivial small talk with no work relevance (weather, greetings only, memes), reply with exactly: SKIP',
    'Otherwise classify the conversation: informal, normal, important, or critical.',
    'Do NOT write intro phrases or the chat title — the app adds the title.',
    'Do not invent tasks or facts. Max 4 bullets, no repetition.',
    'Reply ONLY in this exact format:',
    'TÉMA: {one sentence main topic}',
    '- {bullet}',
    '- {bullet}',
    'TYP: {informal|normal|important|critical}',
  ].join('\n');

  const userPrompt = [
    `Chat: ${options.conversationTitle}`,
    `Unread messages: ${options.unreadCount}`,
    '',
    '---',
    '',
    transcript,
  ].join('\n');

  return { systemPrompt, userPrompt };
}

const HALLUCINATED_TASK_PATTERN_CS =
  /^-\s*.+?:\s*Zajistit,?\s*že\s+/i;
const HALLUCINATED_TASK_PATTERN_EN =
  /^-\s*.+?:\s*(Ensure|Ensuring|Make sure)\s+(that\s+)?/i;

function normalizeBulletKey(line: string): string {
  const content = line.replace(/^-\s*/, '').trim();
  const withoutAssignee = content.replace(/^[^:]+:\s*/, '');
  return withoutAssignee.toLowerCase().replace(/\s+/g, ' ').trim();
}

function isHallucinatedTaskBullet(line: string): boolean {
  return (
    HALLUCINATED_TASK_PATTERN_CS.test(line) ||
    HALLUCINATED_TASK_PATTERN_EN.test(line)
  );
}

function isActionSectionHeader(line: string): boolean {
  const trimmed = line.trim();
  return (
    /^Rozhodnutí a úkoly:\s*$/i.test(trimmed) ||
    /^Decisions and action items:\s*$/i.test(trimmed)
  );
}

function isOpenSectionHeader(line: string): boolean {
  const trimmed = line.trim();
  return (
    /^Otevřené body:\s*$/i.test(trimmed) ||
    /^Open items:\s*$/i.test(trimmed)
  );
}

function isSummarySectionHeader(line: string): boolean {
  const trimmed = line.trim();
  return /^Shrnutí:\s*$/i.test(trimmed) || /^Summary:\s*$/i.test(trimmed);
}

function dedupeAndCapBullets(
  lines: ReadonlyArray<string>,
  maxItems: number
): Array<string> {
  const seen = new Set<string>();
  const result: Array<string> = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('-')) {
      continue;
    }
    if (isHallucinatedTaskBullet(trimmed)) {
      continue;
    }
    const key = normalizeBulletKey(trimmed);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(trimmed);
    if (result.length >= maxItems) {
      break;
    }
  }

  return result;
}

/**
 * Normalizes AI chat summary output across providers: drops hallucinated
 * “ensure that…” tasks, dedupes bullets, caps section sizes.
 */
export function sanitizeAiChatSummary(text: string): string {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return normalized;
  }

  const lines = normalized.split('\n');
  let currentSection: 'summary' | 'actions' | 'open' | 'preamble' = 'preamble';
  const buffers = {
    summary: [] as Array<string>,
    actions: [] as Array<string>,
    open: [] as Array<string>,
    preamble: [] as Array<string>,
  };

  for (const line of lines) {
    if (isSummarySectionHeader(line)) {
      currentSection = 'summary';
      buffers.summary.push(line.trim());
      continue;
    }
    if (isActionSectionHeader(line)) {
      currentSection = 'actions';
      buffers.actions.push(line.trim());
      continue;
    }
    if (isOpenSectionHeader(line)) {
      currentSection = 'open';
      buffers.open.push(line.trim());
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    buffers[currentSection].push(trimmed);
  }

  const rebuilt: Array<string> = [];

  if (buffers.summary.length > 0) {
    rebuilt.push(...buffers.summary);
  } else if (buffers.preamble.length > 0) {
    rebuilt.push(...buffers.preamble);
  }

  const actionBullets = dedupeAndCapBullets(
    buffers.actions.filter(l => l.startsWith('-')),
    AI_CHAT_SUMMARY_MAX_ACTION_ITEMS
  );
  if (actionBullets.length > 0) {
    const header =
      buffers.actions.find(l => !l.startsWith('-')) ?? 'Rozhodnutí a úkoly:';
    if (rebuilt.length > 0) {
      rebuilt.push('');
    }
    rebuilt.push(header);
    rebuilt.push(...actionBullets);
  }

  const openBullets = dedupeAndCapBullets(
    buffers.open.filter(l => l.startsWith('-')),
    AI_CHAT_SUMMARY_MAX_OPEN_ITEMS
  );
  if (openBullets.length > 0) {
    const header = buffers.open.find(l => !l.startsWith('-')) ?? 'Otevřené body:';
    rebuilt.push('');
    rebuilt.push(header);
    rebuilt.push(...openBullets);
  }

  let result = rebuilt.join('\n').replace(/\n{3,}/g, '\n\n').trim();

  if (result.length > AI_CHAT_SUMMARY_MAX_OUTPUT_CHARS) {
    result = `${result.slice(0, AI_CHAT_SUMMARY_MAX_OUTPUT_CHARS - 1)}…`;
  }

  return result;
}
