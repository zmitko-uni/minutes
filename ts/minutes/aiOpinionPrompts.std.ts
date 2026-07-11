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

/** Max znaků odpovědi AI (zůstává rezerva pro hlavičku v limitu Signal 64 KiB). */
export const AI_OPINION_MAX_OUTPUT_CHARS = 3200;

/** Max tokenů pro všechny AI wrappery. */
export const AI_OPINION_MAX_TOKENS = 1100;

/** Max znaků vybrané zprávy v promptu. */
export const AI_OPINION_MAX_INPUT_CHARS = 8000;

export type BuildAiOpinionPromptsOptions = Readonly<{
  outputLanguage: string;
  conversationTitle: string;
  messageAuthorLabel: string;
  messageText: string;
  isNoteToSelf: boolean;
}>;

export function buildAiOpinionPrompts(
  options: BuildAiOpinionPromptsOptions
): { systemPrompt: string; userPrompt: string } {
  const messageText = options.messageText
    .trim()
    .slice(0, AI_OPINION_MAX_INPUT_CHARS);

  if (isCzechAiOutputLanguage(options.outputLanguage)) {
    const contextHint = options.isNoteToSelf
      ? 'Jde o osobní poznámku v chatu „Poznámka pro sebe“ — uživatel chce zpětnou vazbu k vlastní myšlence, otázce nebo plánu.'
      : `Jde o zprávu v konverzaci „${options.conversationTitle}“ — poskytni názor v kontextu této komunikace.`;

    const systemPrompt = [
      'Jsi asistent v aplikaci Minutes (Signal). Uživatel vybral jednu zprávu a chce tvůj názor — ne shrnutí.',
      contextHint,
      'Celá odpověď musí být výhradně v češtině.',
      SIGNAL_AI_SUMMARY_FORMAT_INSTRUCTIONS_CS,
      `Délka: maximálně ${AI_OPINION_MAX_OUTPUT_CHARS} znaků — odpověď musí vejít do jedné Signal zprávy.`,
      'Struktura (dodrž pořadí, každá sekce na vlastním řádku s dvojtečkou):',
      'Názor:',
      '- {1–3 věty — přímá odpověď / hodnocení}',
      'Klíčové body:',
      '- {rizika, přednosti, co přehlédnout}',
      'Doporučení:',
      '- {konkrétní další krok, pokud dává smysl}',
      'Zákaz: úvodní fráze („Rozumím“, „Jistě“, „Shrnutí“), opakování celé původní zprávy, vymyšlené fakty mimo text zprávy.',
      'Pokud je zpráva nejasná, v sekci Názor polož jednu krátkou doplňující otázku místo dlouhého textu.',
      'Piš stručně a prakticky pro IT / znalostní práci.',
    ].join('\n');

    const userPrompt = [
      `Konverzace: ${options.conversationTitle}`,
      options.isNoteToSelf
        ? 'Typ: poznámka pro sebe'
        : `Autor zprávy: ${options.messageAuthorLabel}`,
      '',
      '--- Vybraná zpráva ---',
      '',
      messageText,
      '',
      '---',
      '',
      'Napiš názor AI podle instrukcí (ne shrnutí).',
    ].join('\n');

    return { systemPrompt, userPrompt };
  }

  const languageLabel = getAiOutputLanguageLabel(options.outputLanguage);
  const contextHint = options.isNoteToSelf
    ? 'This is a personal note in "Note to Self" — the user wants feedback on their own thought, question, or plan.'
    : `This is a message in the "${options.conversationTitle}" conversation — give an opinion in that context.`;

  const systemPrompt = [
    'You are an assistant in the Minutes app (Signal). The user selected one message and wants your opinion — not a summary.',
    contextHint,
    `Write the entire response only in ${languageLabel}.`,
    SIGNAL_AI_SUMMARY_FORMAT_INSTRUCTIONS_EN,
    `Length: at most ${AI_OPINION_MAX_OUTPUT_CHARS} characters — the reply must fit in a single Signal message.`,
    'Structure (keep this order, each section title on its own line ending with a colon):',
    'Opinion:',
    '- {1–3 sentences — direct answer or assessment}',
    'Key points:',
    '- {risks, strengths, blind spots}',
    'Recommendation:',
    '- {concrete next step when useful}',
    'Do not use intro phrases, repeat the full original message, or invent facts not in the message.',
    'If the message is unclear, ask one short clarifying question in the Opinion section.',
    'Be concise and practical.',
  ].join('\n');

  const userPrompt = [
    `Conversation: ${options.conversationTitle}`,
    options.isNoteToSelf
      ? 'Type: note to self'
      : `Message author: ${options.messageAuthorLabel}`,
    '',
    '--- Selected message ---',
    '',
    messageText,
    '',
    '---',
    '',
    `Write an AI opinion per the instructions (not a summary), in ${languageLabel}.`,
  ].join('\n');

  return { systemPrompt, userPrompt };
}

export function trimAiOpinionResponse(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= AI_OPINION_MAX_OUTPUT_CHARS) {
    return trimmed;
  }
  return `${trimmed.slice(0, AI_OPINION_MAX_OUTPUT_CHARS - 1)}…`;
}
