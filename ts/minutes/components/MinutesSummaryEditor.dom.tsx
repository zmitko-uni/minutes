// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useRef, useState, type JSX } from 'react';

import { AxoButton } from '../../axo/AxoButton.dom.tsx';
import {
  editorHtmlToMarkdown,
  markdownToEditorHtml,
} from '../richTextMarkdown.dom.ts';
import { MinutesIconButton } from './MinutesIconButton.dom.tsx';

/** Formátování v contenteditable — jinou cestu Chromium nenabízí. */
function applyFormat(command: string, value?: string): void {
  // oxlint-disable-next-line no-document-exec-command
  document.execCommand(command, false, value);
}

/**
 * Bez tohoto by Chromium formátoval přes `<span style>`, což převod
 * zpátky na Markdown neumí přečíst.
 */
function preferSemanticTags(): void {
  // oxlint-disable-next-line no-document-exec-command
  document.execCommand('styleWithCSS', false, 'false');
}

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeHtmlAttribute(value: string): string {
  return escapeHtmlText(value).replace(/"/g, '&quot;');
}

function normalizeHref(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/**
 * Editace shrnutí. Ukládá se zpátky jako Markdown, takže výsledek zůstane
 * čitelný i mimo Minutes (soubor `.summary.md`).
 */
export function MinutesSummaryEditor({
  markdown,
  isSaving,
  onSave,
  onCancel,
}: Readonly<{
  markdown: string;
  isSaving: boolean;
  onSave: (markdown: string) => void;
  onCancel: () => void;
}>): JSX.Element {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const [linkDraft, setLinkDraft] = useState<string | null>(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (editor != null) {
      editor.innerHTML = markdownToEditorHtml(markdown);
      editor.focus();
      preferSemanticTags();
    }
  }, [markdown]);

  // Kliknutí na lištu vezme focus, takže si poslední výběr v editoru pamatujeme.
  useEffect(() => {
    const onSelectionChange = (): void => {
      const editor = editorRef.current;
      const selection = window.getSelection();
      if (editor == null || selection == null || selection.rangeCount === 0) {
        return;
      }
      const range = selection.getRangeAt(0);
      if (editor.contains(range.commonAncestorContainer)) {
        savedRangeRef.current = range.cloneRange();
      }
    };

    document.addEventListener('selectionchange', onSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', onSelectionChange);
    };
  }, []);

  const restoreSelection = (): void => {
    const editor = editorRef.current;
    if (editor == null) {
      return;
    }
    editor.focus();

    const range = savedRangeRef.current;
    const selection = window.getSelection();
    if (range != null && selection != null) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
  };

  const runFormat = (command: string, value?: string): void => {
    restoreSelection();
    preferSemanticTags();
    applyFormat(command, value);
  };

  const submitLink = (): void => {
    const href = linkDraft != null ? normalizeHref(linkDraft) : null;
    if (href == null) {
      setLinkDraft(null);
      return;
    }

    restoreSelection();
    preferSemanticTags();

    // `createLink` umí jen obalit označený text. Když nic označené není,
    // vložíme odkaz i s jeho textem sami — jinak by kliknutí nic neudělalo.
    if (savedRangeRef.current?.collapsed !== false) {
      applyFormat(
        'insertHTML',
        `<a href="${escapeHtmlAttribute(href)}">${escapeHtmlText(href)}</a>&nbsp;`
      );
    } else {
      applyFormat('createLink', href);
    }

    setLinkDraft(null);
  };

  return (
    <div className="MinutesSummaryEditor">
      <div className="MinutesSummaryEditor__toolbar">
        <MinutesIconButton
          icon="bold"
          label="Tučně"
          keepFocus
          onClick={() => runFormat('bold')}
        />
        <MinutesIconButton
          icon="italic"
          label="Kurzíva"
          keepFocus
          onClick={() => runFormat('italic')}
        />
        <MinutesIconButton
          icon="bullets"
          label="Odrážky"
          keepFocus
          onClick={() => runFormat('insertUnorderedList')}
        />
        <MinutesIconButton
          icon="numbers"
          label="Číslovaný seznam"
          keepFocus
          onClick={() => runFormat('insertOrderedList')}
        />
        <MinutesIconButton
          icon="link"
          label="Odkaz"
          keepFocus
          isActive={linkDraft != null}
          onClick={() => setLinkDraft(current => (current == null ? '' : null))}
        />
      </div>

      {linkDraft != null && (
        <div className="MinutesSummaryEditor__linkRow">
          <input
            type="url"
            className="MinutesSummaryEditor__linkInput"
            placeholder="https://…"
            aria-label="Adresa odkazu"
            value={linkDraft}
            onChange={event => setLinkDraft(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault();
                submitLink();
              }
            }}
          />
          <AxoButton.Root
            variant="subtle-primary"
            size="sm"
            onClick={submitLink}
          >
            Vložit odkaz
          </AxoButton.Root>
        </div>
      )}

      <div
        ref={editorRef}
        className="MinutesSummaryEditor__surface"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Text shrnutí"
        // Editor je nově plnohodnotný, takže vkládáme jen text — cizí HTML
        // by se do Markdownu nepřevedlo.
        onPaste={event => {
          event.preventDefault();
          applyFormat('insertText', event.clipboardData.getData('text/plain'));
        }}
      />

      <div className="MinutesSummaryEditor__actions">
        <AxoButton.Root
          variant="strong-primary"
          size="sm"
          disabled={isSaving}
          onClick={() =>
            onSave(editorHtmlToMarkdown(editorRef.current?.innerHTML ?? ''))
          }
        >
          {isSaving ? 'Ukládám…' : 'Uložit shrnutí'}
        </AxoButton.Root>
        <AxoButton.Root
          variant="subtle-primary"
          size="sm"
          disabled={isSaving}
          onClick={onCancel}
        >
          Zrušit úpravy
        </AxoButton.Root>
        <p className="MinutesSummaryEditor__hint">
          Uloží se do souboru shrnutí u nahrávky. Odkaz obalí označený text; bez
          označení se vloží jako adresa.
        </p>
      </div>
    </div>
  );
}
