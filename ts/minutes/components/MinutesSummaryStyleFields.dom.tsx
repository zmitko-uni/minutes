// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useMemo, useState, type JSX } from 'react';

import { tw } from '../../axo/tw.dom.tsx';
import {
  AI_CUSTOM_SUMMARY_INSTRUCTIONS_MAX_CHARS,
  AI_SUMMARY_STYLE_OPTIONS,
  type AiSummaryStyle,
} from '../aiSettings.std.ts';
import { buildChatSummarySystemPrompt } from '../aiSummaryPrompts.std.ts';

type Props = Readonly<{
  outputLanguage: string;
  summaryStyle: AiSummaryStyle;
  customInstructions: string;
  onSummaryStyleChange: (style: AiSummaryStyle) => void;
  onCustomInstructionsChange: (value: string) => void;
}>;

export function MinutesSummaryStyleFields({
  outputLanguage,
  summaryStyle,
  customInstructions,
  onSummaryStyleChange,
  onCustomInstructionsChange,
}: Props): JSX.Element {
  const [promptPreviewOpen, setPromptPreviewOpen] = useState(
    summaryStyle === 'custom'
  );

  useEffect(() => {
    if (summaryStyle === 'custom') {
      setPromptPreviewOpen(true);
    }
  }, [summaryStyle]);

  const systemPromptPreview = useMemo(
    () =>
      buildChatSummarySystemPrompt({
        outputLanguage,
        style: summaryStyle,
        customInstructions,
      }),
    [customInstructions, outputLanguage, summaryStyle]
  );

  return (
    <div
      className={tw(
        'flex flex-col gap-3 border-t border-solid pt-3',
        'border-label-disabled'
      )}
    >
      <p className={tw('m-0 text-label-medium font-medium')}>Styl shrnutí</p>

      <p className={tw('m-0 text-label-small opacity-70')}>
        Platí pro shrnutí chatů i hovorů. Nepřečtené zprávy mají vlastní krátký
        formát.
      </p>

      <div className={tw('flex flex-col gap-2')}>
        {AI_SUMMARY_STYLE_OPTIONS.map(option => (
          <label
            key={option.id}
            className={tw('flex cursor-pointer items-start gap-2')}
          >
            <input
              type="radio"
              name="minutes-summary-style"
              className={tw('mt-1')}
              value={option.id}
              checked={summaryStyle === option.id}
              onChange={() => onSummaryStyleChange(option.id)}
            />
            <span>
              <span className={tw('font-medium')}>{option.label}</span>
              <span className={tw('block text-label-small opacity-70')}>
                {option.description}
              </span>
            </span>
          </label>
        ))}
      </div>

      {summaryStyle === 'custom' ? (
        <label className={tw('flex flex-col gap-1')}>
          <span>Vaše instrukce</span>
          <textarea
            rows={6}
            className={tw(
              'w-full resize-y rounded-md border border-solid px-3 py-2',
              'border-label-disabled bg-background-primary font-mono text-label-small'
            )}
            value={customInstructions}
            maxLength={AI_CUSTOM_SUMMARY_INSTRUCTIONS_MAX_CHARS}
            placeholder="Např. tykej, ignoruj small talk, úkoly jen pro mě…"
            onChange={event => onCustomInstructionsChange(event.target.value)}
          />
          <span className={tw('flex justify-between text-label-small opacity-70')}>
            <span>
              Přidají se na konec system promptu. Formát Signalu nelze změnit.
            </span>
            <span>
              {customInstructions.length}/
              {AI_CUSTOM_SUMMARY_INSTRUCTIONS_MAX_CHARS}
            </span>
          </span>
        </label>
      ) : null}

      <div className={tw('flex flex-col gap-2')}>
        <button
          type="button"
          className={tw('self-start text-label-small underline')}
          onClick={() => setPromptPreviewOpen(open => !open)}
        >
          {promptPreviewOpen
            ? 'Skrýt prompt'
            : 'Zobrazit prompt tohoto režimu'}
        </button>
        {promptPreviewOpen ? (
          <>
            <p className={tw('m-0 text-label-small opacity-70')}>
              Co model vždy dostane. Tuto část nelze měnit — drží formát zprávy
              v Signalu.
              {summaryStyle === 'custom'
                ? ' Vaše instrukce se přidají na konec.'
                : ''}
            </p>
            <textarea
              readOnly
              rows={16}
              className={tw(
                'w-full resize-y rounded-md border border-solid px-3 py-2',
                'border-label-disabled bg-background-secondary font-mono text-label-small'
              )}
              value={systemPromptPreview}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
