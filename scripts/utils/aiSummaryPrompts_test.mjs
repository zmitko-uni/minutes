// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { sanitizeAiChatSummary } from '../../ts/minutes/aiSummaryPrompts.std.ts';

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
});
