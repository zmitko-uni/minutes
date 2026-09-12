// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

/** Max znaků zápisu v promptu — delší zápisy se zkrátí. */
export const MEETING_TASKS_MAX_INPUT_CHARS = 14_000;

export const MEETING_TASKS_MAX_TOKENS = 1400;

export type BuildMeetingTaskPromptsOptions = Readonly<{
  meetingName: string;
  meetingWhen: string;
  sourceChatTitle: string;
  /** Jména, mezi kterými má AI vybírat řešitele. */
  participants: ReadonlyArray<string>;
  minutesMarkdown: string;
}>;

/**
 * Návrh úkolů ze zápisu. Vyžadujeme čisté JSON pole, protože výsledek jde
 * do editovatelného seznamu, ne do textu zprávy.
 */
export function buildMeetingTaskPrompts(
  options: BuildMeetingTaskPromptsOptions
): { systemPrompt: string; userPrompt: string } {
  const minutes = options.minutesMarkdown
    .trim()
    .slice(0, MEETING_TASKS_MAX_INPUT_CHARS);

  const systemPrompt = [
    'Jsi asistent v aplikaci Minutes. Ze zápisu ze schůzky vytáhneš konkrétní úkoly a přiřadíš je lidem.',
    'Odpověz VÝHRADNĚ jedním JSON polem, bez komentáře, bez bloku ```.',
    'Každý prvek pole má právě tyto klíče:',
    '{"assignee": string, "title": string, "detail": string, "due": string}',
    '- assignee: jméno člověka ze seznamu účastníků. Pokud zápis řešitele neurčuje, dej prázdný řetězec.',
    '- title: krátký úkol v infinitivu, max 90 znaků (např. „Připravit návrh rozpočtu“).',
    '- detail: 1–2 věty kontextu ze zápisu. Nic si nevymýšlej.',
    '- due: termín, jen pokud ho zápis zmiňuje (např. „do pátku“, „do 20. 9.“). Jinak prázdný řetězec.',
    'Vše piš česky.',
    'Vrať maximálně 12 úkolů. Pokud zápis žádné úkoly neobsahuje, vrať prázdné pole [].',
    'Nevymýšlej úkoly, které v zápisu nejsou, ani obecná doporučení.',
  ].join('\n');

  const participantList =
    options.participants.length > 0
      ? options.participants.join(', ')
      : '(seznam není k dispozici — assignee nech prázdný, pokud jméno není v zápisu)';

  const userPrompt = [
    `Schůzka: ${options.meetingName}`,
    options.meetingWhen.length > 0
      ? `Termín schůzky: ${options.meetingWhen}`
      : null,
    `Chat: ${options.sourceChatTitle}`,
    `Účastníci: ${participantList}`,
    '',
    '--- Zápis ze schůzky ---',
    '',
    minutes,
    '',
    '---',
    '',
    'Vrať JSON pole úkolů podle instrukcí.',
  ]
    .filter((line): line is string => line != null)
    .join('\n');

  return { systemPrompt, userPrompt };
}
