// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { assert } from 'chai';

import {
  buildChatSummaryPrompts,
  buildChatSummarySystemPrompt,
  getAiChatSummaryLimits,
  sanitizeAiChatSummary,
} from '../../ts/minutes/aiSummaryPrompts.std.ts';

describe('sanitizeAiChatSummary', () => {
  it('removes hallucinated Zajistit že action items and dedupes', () => {
    const input = `Shrnutí:
Martin představil nástroj Minutes.

Rozhodnutí a úkoly:
- Martin Zmítko: Odladit Whisper do konce týdne.
- Bohuslav Franc: Pomoci s Whisperem.
- Martin Zmítko: Zajistit, že nástroj umí sumarizovat texty.
- Martin Zmítko: Zajistit, že nástroj je na tajno.
- Martin Zmítko: Odladit Whisper do konce týdne.
- Michal Gregor: Připravit PR pro macOS.`;

    const output = sanitizeAiChatSummary(input);

    assert.include(output, 'Shrnutí:');
    assert.include(output, 'Martin Zmítko: Odladit Whisper');
    assert.notInclude(output, 'Zajistit, že nástroj');
    assert.notInclude(output, 'Zajistit, že nástroj je na tajno');
    const actionLines = output
      .split('\n')
      .filter(line => line.trim().startsWith('-'));
    assert.isAtMost(actionLines.length, 6);
    const whisperCount = actionLines.filter(line =>
      line.includes('Odladit Whisper')
    ).length;
    assert.equal(whisperCount, 1);
  });

  it('keeps more action items in detailed style', () => {
    const bullets = Array.from(
      { length: 12 },
      (_, index) => `- Osoba ${index}: Úkol ${index}.`
    ).join('\n');
    const input = `Shrnutí:\nDlouhý meeting.\n\nRozhodnutí a úkoly:\n${bullets}`;
    const brief = sanitizeAiChatSummary(input);
    const detailed = sanitizeAiChatSummary(
      input,
      getAiChatSummaryLimits('detailed')
    );
    const briefCount = brief.split('\n').filter(line => line.startsWith('-'))
      .length;
    const detailedCount = detailed
      .split('\n')
      .filter(line => line.startsWith('-')).length;
    assert.equal(briefCount, 6);
    assert.equal(detailedCount, 12);
  });
});

describe('buildChatSummarySystemPrompt', () => {
  it('uses Czech brief rules by default', () => {
    const prompt = buildChatSummarySystemPrompt({ outputLanguage: 'cs' });
    assert.include(prompt, 'výhradně v češtině');
    assert.include(prompt, 'maximálně 2800 znaků');
    assert.include(prompt, 'nepoužívej markdown');
    assert.notInclude(prompt, 'Instrukce uživatele');
  });

  it('uses detailed rules and English when requested', () => {
    const prompt = buildChatSummarySystemPrompt({
      outputLanguage: 'en',
      style: 'detailed',
    });
    assert.include(prompt, 'only in English');
    assert.include(prompt, '1–3 paragraphs');
    assert.include(prompt, 'at most 15 bullets');
  });

  it('appends custom instructions only in custom style', () => {
    const custom = buildChatSummarySystemPrompt({
      outputLanguage: 'cs',
      style: 'custom',
      customInstructions: 'Tykej a ignoruj small talk.',
    });
    assert.include(custom, '--- Instrukce uživatele ---');
    assert.include(custom, 'Tykej a ignoruj small talk.');
    assert.include(custom, 'formát má přednost');

    const brief = buildChatSummarySystemPrompt({
      outputLanguage: 'cs',
      style: 'brief',
      customInstructions: 'Tykej a ignoruj small talk.',
    });
    assert.notInclude(brief, 'Tykej a ignoruj small talk.');
  });

  it('smart prompt asks the model to scale length', () => {
    const prompt = buildChatSummarySystemPrompt({
      outputLanguage: 'cs',
      style: 'smart',
    });
    assert.include(prompt, 'odhadni rozsah');
    assert.include(prompt, 'délka podle rozsahu přepisu');
  });
});

describe('buildChatSummaryPrompts', () => {
  it('does not put the transcript into the system prompt', () => {
    const { systemPrompt, userPrompt } = buildChatSummaryPrompts({
      outputLanguage: 'cs',
      conversationTitle: 'Test chat',
      scopeLabel: 'Celý chat',
      transcript: 'TAJNY_PREPIS_XYZ',
      style: 'brief',
    });
    assert.notInclude(systemPrompt, 'TAJNY_PREPIS_XYZ');
    assert.include(userPrompt, 'TAJNY_PREPIS_XYZ');
    assert.include(userPrompt, 'Test chat');
  });
});
