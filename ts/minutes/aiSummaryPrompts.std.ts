// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import {
  clampCustomSummaryInstructions,
  DEFAULT_AI_SUMMARY_STYLE,
  getAiOutputLanguageLabel,
  isCzechAiOutputLanguage,
  normalizeAiSummaryStyle,
  type AiSummaryStyle,
} from './aiSettings.std.ts';
import {
  SIGNAL_AI_SUMMARY_FORMAT_INSTRUCTIONS_CS,
  SIGNAL_AI_SUMMARY_FORMAT_INSTRUCTIONS_EN,
} from './signalChatText.std.ts';

/** Max tokenů pro stručné shrnutí — brání „rozběhnutým“ výstupům (Perplexity apod.). */
export const AI_CHAT_SUMMARY_MAX_TOKENS = 1100;

/** Max znaků výstupu stručného shrnutí (Signal zpráva + rezerva). */
export const AI_CHAT_SUMMARY_MAX_OUTPUT_CHARS = 3500;

export const AI_CHAT_SUMMARY_MAX_ACTION_ITEMS = 6;
export const AI_CHAT_SUMMARY_MAX_OPEN_ITEMS = 3;

const MAX_TRANSCRIPT_CHARS = 80_000;

export type AiChatSummaryLimits = Readonly<{
  maxTokens: number;
  maxOutputChars: number;
  maxActionItems: number;
  maxOpenItems: number;
}>;

export function getAiChatSummaryLimits(
  style: AiSummaryStyle = DEFAULT_AI_SUMMARY_STYLE
): AiChatSummaryLimits {
  if (style === 'brief') {
    return {
      maxTokens: AI_CHAT_SUMMARY_MAX_TOKENS,
      maxOutputChars: AI_CHAT_SUMMARY_MAX_OUTPUT_CHARS,
      maxActionItems: AI_CHAT_SUMMARY_MAX_ACTION_ITEMS,
      maxOpenItems: AI_CHAT_SUMMARY_MAX_OPEN_ITEMS,
    };
  }

  return {
    maxTokens: 3500,
    maxOutputChars: 9000,
    maxActionItems: 15,
    maxOpenItems: 8,
  };
}

const BRIEF_CONTENT_RULES_CS = [
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

const BRIEF_CONTENT_RULES_EN = [
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

const DETAILED_CONTENT_RULES_CS = [
  'Délka celého výstupu: maximálně 8000 znaků.',
  'Sekce Shrnutí: 1–3 odstavce. Pokryj všechna podstatná témata, průběh diskuze a závěr. Žádný marketingový seznam funkcí produktu.',
  'Sekce Rozhodnutí a úkoly: maximálně 15 odrážek. U každého úkolu uveď kdo, co konkrétně a termín, pokud zazněl.',
  'Rozepiš i implicitně převzaté závazky, ale nevymýšlej nové úkoly.',
  'Zákaz úkolů: nepřeváděj popis funkcí, vlastností nebo stavu produktu na úkoly (špatně: „Zajistit, že nástroj umí X“).',
  'Zákaz: neopakuj stejný bod, parafrázu ani stejného člověka se stejným úkolem.',
  'Pokud v chatu nejsou žádné úkoly, sekci Rozhodnutí a úkoly vynech úplně.',
  'Sekce Otevřené body: max 8 odrážek — nevyřešené otázky, neshody, věci k dořešení. Vynech sekci, pokud nic nezůstalo.',
  'Nevymýšlej fakta mimo přepis. Zachovej jména účastníků.',
  'Když jsou řádky ve tvaru [Jméno]:, přiřaď úkoly správným lidem.',
].join('\n');

const DETAILED_CONTENT_RULES_EN = [
  'Total output length: at most 8000 characters.',
  'Summary section: 1–3 paragraphs covering every substantial topic, discussion flow, and outcome. No product feature list.',
  'Decisions and action items: at most 15 bullets. For each task include who, the concrete action, and a deadline if mentioned.',
  'Expand implicit commitments, but do not invent new tasks.',
  'Forbidden: do not turn product features or descriptions into action items (bad: "Ensure the tool supports X").',
  'Do not repeat the same point, paraphrase, or duplicate assignee + task.',
  'Omit the Decisions section entirely if there are no action items.',
  'Open items: at most 8 bullets — unresolved questions, disagreements, follow-ups. Omit section if none.',
  'Do not invent facts beyond the transcript. Keep participant names.',
  'When lines use [Speaker Name]:, attribute tasks to the correct people.',
].join('\n');

const SMART_CONTENT_RULES_CS = [
  'Nejdřív odhadni rozsah a důležitost přepisu a podle toho zvol podrobnost.',
  'Krátký stand-up, small talk nebo pár zpráv → stručné shrnutí (2–5 vět, málo odrážek).',
  'Dlouhý meeting, hodně rozhodnutí nebo úkolů → detailní pokrytí (odstavce; u úkolů kdo / co / termín).',
  'Střední rozsah → něco mezi — nepíš zbytečně dlouho, ale nevynech podstatné závazky.',
  'Délka celého výstupu: maximálně 8000 znaků; u krátkého obsahu zůstaň výrazně kratší.',
  'Sekce Rozhodnutí a úkoly: maximálně 15 odrážek. Pouze závazky, které někdo převzal, slíbil nebo byl požádán.',
  'Zákaz úkolů: nepřeváděj popis funkcí na úkoly (špatně: „Zajistit, že nástroj umí X“).',
  'Zákaz: neopakuj stejný bod, parafrázu ani stejného člověka se stejným úkolem.',
  'Pokud nejsou úkoly, sekci Rozhodnutí a úkoly vynech. Otevřené body: max 8 odrážek, vynech pokud nic.',
  'Nevymýšlej fakta mimo přepis. Zachovej jména. Při [Jméno]: přiřaď úkoly správným lidem.',
].join('\n');

const CUSTOM_CONTENT_RULES_CS = [
  'Délku a podrobnost řiď instrukcemi uživatele níže. Strop: 8000 znaků, max 15 úkolů, max 8 otevřených bodů.',
  'Pokud instrukce neurčí jinak, piš stručně (2–5 vět) a jen explicitní závazky.',
  'Zákaz úkolů: nepřeváděj popis funkcí na úkoly (špatně: „Zajistit, že nástroj umí X“).',
  'Zákaz: neopakuj stejný bod. Pokud nejsou úkoly nebo otevřené body, příslušnou sekci vynech.',
  'Nevymýšlej fakta mimo přepis. Zachovej jména. Při [Jméno]: přiřaď úkoly správným lidem.',
].join('\n');

const CUSTOM_CONTENT_RULES_EN = [
  'Follow the user instructions below for length and detail. Ceiling: 8000 characters, at most 15 tasks, at most 8 open items.',
  'If the instructions do not say otherwise, stay brief (2–5 sentences) and list only explicit commitments.',
  'Forbidden: do not turn product features into action items (bad: "Ensure the tool supports X").',
  'Do not repeat the same point. Omit empty sections.',
  'Do not invent facts. Keep names. When lines use [Speaker Name]:, attribute tasks correctly.',
].join('\n');

const SMART_CONTENT_RULES_EN = [
  'First estimate the transcript scope and importance, then choose how detailed to be.',
  'Short standup, small talk, or a few messages → brief summary (2–5 sentences, few bullets).',
  'Long meeting with many decisions or tasks → detailed coverage (paragraphs; who / what / deadline on tasks).',
  'Medium length → in between — do not pad, but do not drop real commitments.',
  'Total output length: at most 8000 characters; stay much shorter for short content.',
  'Decisions and action items: at most 15 bullets. Only commitments someone accepted, promised, or was asked to do.',
  'Forbidden: do not turn product features into action items (bad: "Ensure the tool supports X").',
  'Do not repeat the same point, paraphrase, or duplicate assignee + task.',
  'Omit the Decisions section if there are no tasks. Open items: at most 8 bullets; omit if none.',
  'Do not invent facts. Keep names. When lines use [Speaker Name]:, attribute tasks correctly.',
].join('\n');

function getContentRules(style: AiSummaryStyle, isCzech: boolean): string {
  if (style === 'detailed') {
    return isCzech ? DETAILED_CONTENT_RULES_CS : DETAILED_CONTENT_RULES_EN;
  }
  if (style === 'smart') {
    return isCzech ? SMART_CONTENT_RULES_CS : SMART_CONTENT_RULES_EN;
  }
  if (style === 'custom') {
    return isCzech ? CUSTOM_CONTENT_RULES_CS : CUSTOM_CONTENT_RULES_EN;
  }
  return isCzech ? BRIEF_CONTENT_RULES_CS : BRIEF_CONTENT_RULES_EN;
}

function getFormatTemplate(style: AiSummaryStyle, isCzech: boolean): string {
  const limits = getAiChatSummaryLimits(style);

  if (isCzech) {
    const summaryHint =
      style === 'detailed'
        ? '{1–3 odstavce}'
        : style === 'smart'
          ? '{délka podle rozsahu přepisu}'
          : style === 'custom'
            ? '{souvislý text podle instrukcí}'
            : '{2–5 vět}';
    const taskHint =
      style === 'detailed'
        ? '- {Jméno}: {konkrétní úkol; termín pokud zazněl}'
        : '- {Jméno}: {konkrétní úkol}';

    return [
      'Výstup musí mít přesně tuto strukturu (nic navíc):',
      '',
      'Shrnutí:',
      summaryHint,
      '',
      'Rozhodnutí a úkoly:',
      taskHint,
      `(max ${limits.maxActionItems} řádků; celou sekci vynech, pokud nejsou úkoly)`,
      '',
      'Otevřené body:',
      '- {otázka nebo téma}',
      `(max ${limits.maxOpenItems} řádky; celou sekci vynech, pokud nic nezůstalo)`,
    ].join('\n');
  }

  const summaryHint =
    style === 'detailed'
      ? '{1–3 paragraphs}'
      : style === 'smart'
        ? '{length according to transcript scope}'
        : style === 'custom'
          ? '{prose according to user instructions}'
          : '{2–5 sentences}';
  const taskHint =
    style === 'detailed'
      ? '- {Name}: {concrete task; deadline if mentioned}'
      : '- {Name}: {concrete task}';

  return [
    'Output must follow exactly this structure (nothing extra):',
    '',
    'Summary:',
    summaryHint,
    '',
    'Decisions and action items:',
    taskHint,
    `(max ${limits.maxActionItems} lines; omit entire section if no tasks)`,
    '',
    'Open items:',
    '- {question or topic}',
    `(max ${limits.maxOpenItems} lines; omit entire section if none)`,
  ].join('\n');
}

function getCustomInstructionsBlock(
  customInstructions: string,
  isCzech: boolean
): string | undefined {
  const trimmed = clampCustomSummaryInstructions(customInstructions).trim();
  if (!trimmed) {
    return undefined;
  }

  if (isCzech) {
    return [
      'Následují doplňující instrukce od uživatele. Platí pro tón, důraz a výběr obsahu.',
      'Strukturu sekcí (Shrnutí / Rozhodnutí a úkoly / Otevřené body) a zákaz markdownu neměň. Nevymýšlej fakta.',
      'Pokud instrukce odporují formátu prostého textu pro Signal, formát má přednost.',
      '',
      '--- Instrukce uživatele ---',
      trimmed,
      '---',
    ].join('\n');
  }

  return [
    'The following are extra instructions from the user. They apply to tone, emphasis, and what to include.',
    'Do not change the section structure (Summary / Decisions and action items / Open items) or use markdown. Do not invent facts.',
    'If the instructions conflict with plain-text Signal formatting, the format wins.',
    '',
    '--- User instructions ---',
    trimmed,
    '---',
  ].join('\n');
}

export type BuildChatSummarySystemPromptOptions = Readonly<{
  outputLanguage: string;
  style?: AiSummaryStyle;
  customInstructions?: string;
}>;

export function buildChatSummarySystemPrompt(
  options: BuildChatSummarySystemPromptOptions
): string {
  const style = normalizeAiSummaryStyle(options.style);
  const isCzech = isCzechAiOutputLanguage(options.outputLanguage);
  const parts: Array<string> = [];

  if (isCzech) {
    parts.push(
      'Shrnuješ konverzace ze Signalu pro uživatele. Výstup půjde jako jedna zpráva v chatu.',
      'Celé shrnutí piš výhradně v češtině.',
      SIGNAL_AI_SUMMARY_FORMAT_INSTRUCTIONS_CS,
      getContentRules(style, true),
      getFormatTemplate(style, true)
    );
  } else {
    const languageLabel = getAiOutputLanguageLabel(options.outputLanguage);
    parts.push(
      'You summarize Signal chat conversations. Output goes as a single chat message.',
      `Write the ENTIRE summary only in ${languageLabel}.`,
      SIGNAL_AI_SUMMARY_FORMAT_INSTRUCTIONS_EN,
      getContentRules(style, false),
      getFormatTemplate(style, false)
    );
  }

  if (style === 'custom') {
    const customBlock = getCustomInstructionsBlock(
      options.customInstructions ?? '',
      isCzech
    );
    if (customBlock) {
      parts.push(customBlock);
    }
  }

  return parts.join('\n\n');
}

export type BuildChatSummaryPromptsOptions = Readonly<{
  outputLanguage: string;
  conversationTitle: string;
  scopeLabel: string;
  transcript: string;
  style?: AiSummaryStyle;
  customInstructions?: string;
}>;

export function buildChatSummaryPrompts(
  options: BuildChatSummaryPromptsOptions
): { systemPrompt: string; userPrompt: string } {
  const transcript = options.transcript.slice(0, MAX_TRANSCRIPT_CHARS);
  const systemPrompt = buildChatSummarySystemPrompt(options);
  const style = normalizeAiSummaryStyle(options.style);
  const closingCs =
    style === 'detailed'
      ? 'Napiš shrnutí podle struktury a pravidel. Buď důkladný, ale drž se přepisu.'
      : style === 'smart'
        ? 'Napiš shrnutí podle struktury a pravidel. Délku přizpůsob rozsahu přepisu.'
        : style === 'custom'
          ? 'Napiš shrnutí podle struktury, pravidel a instrukcí uživatele.'
          : 'Napiš shrnutí podle struktury a pravidel. Buď stručný.';

  if (isCzechAiOutputLanguage(options.outputLanguage)) {
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
      closingCs,
    ].join('\n');

    return { systemPrompt, userPrompt };
  }

  const languageLabel = getAiOutputLanguageLabel(options.outputLanguage);
  const closingEn =
    style === 'detailed'
      ? `Write the summary per structure and rules, exclusively in ${languageLabel}. Be thorough, but stay within the transcript.`
      : style === 'smart'
        ? `Write the summary per structure and rules, exclusively in ${languageLabel}. Match length to the transcript scope.`
        : style === 'custom'
          ? `Write the summary per structure, rules, and user instructions, exclusively in ${languageLabel}.`
          : `Write the summary per structure and rules, exclusively in ${languageLabel}. Be concise.`;
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
    closingEn,
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
export function sanitizeAiChatSummary(
  text: string,
  limits: AiChatSummaryLimits = getAiChatSummaryLimits('brief')
): string {
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
    limits.maxActionItems
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
    limits.maxOpenItems
  );
  if (openBullets.length > 0) {
    const header = buffers.open.find(l => !l.startsWith('-')) ?? 'Otevřené body:';
    rebuilt.push('');
    rebuilt.push(header);
    rebuilt.push(...openBullets);
  }

  let result = rebuilt.join('\n').replace(/\n{3,}/g, '\n\n').trim();

  if (result.length > limits.maxOutputChars) {
    result = `${result.slice(0, limits.maxOutputChars - 1)}…`;
  }

  return result;
}
