// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

/** Jeden blok obsahu uuEcc sekce. */
export type UubtSectionContentItem = Readonly<{
  uu5Tag: string;
  props: Readonly<Record<string, unknown>>;
}>;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatInline(value: string): string {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/(^|[\s(])_([^_\n]+)_/g, '$1<em>$2</em>');
}

type ListState = 'ul' | 'ol' | null;

/**
 * Převede Markdown shrnutí na uu5string pro Uu5RichTextBricks.Block.
 * Pokrývá to, co produkují AI shrnutí: nadpisy, odrážky, číslované
 * seznamy, tučné, kurzívu, inline kód a odstavce.
 */
export function markdownToUu5String(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const out: Array<string> = [];
  let list: ListState = null;
  let paragraph: Array<string> = [];

  const closeList = (): void => {
    if (list) {
      out.push(`</${list}>`);
      list = null;
    }
  };

  const flushParagraph = (): void => {
    if (paragraph.length > 0) {
      out.push(`<p>${paragraph.join(' ')}</p>`);
      paragraph = [];
    }
  };

  const openList = (next: Exclude<ListState, null>): void => {
    if (list !== next) {
      closeList();
      out.push(`<${next}>`);
      list = next;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line.length === 0) {
      flushParagraph();
      closeList();
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      closeList();
      // Nadpis sekce v uuBT je nad obsahem, takže začínáme o dvě úrovně níž.
      const level = Math.min(6, (heading[1] ?? '#').length + 2);
      out.push(`<h${level}>${formatInline(heading[2] ?? '')}</h${level}>`);
      continue;
    }

    if (/^([-*_])\1{2,}$/.test(line)) {
      flushParagraph();
      closeList();
      out.push('<hr/>');
      continue;
    }

    const bullet = line.match(/^[-*+]\s+(.*)$/);
    if (bullet) {
      flushParagraph();
      openList('ul');
      out.push(`<li>${formatInline(bullet[1] ?? '')}</li>`);
      continue;
    }

    const numbered = line.match(/^\d+[.)]\s+(.*)$/);
    if (numbered) {
      flushParagraph();
      openList('ol');
      out.push(`<li>${formatInline(numbered[1] ?? '')}</li>`);
      continue;
    }

    closeList();
    paragraph.push(formatInline(line));
  }

  flushParagraph();
  closeList();

  return `<uu5string/>${out.join('')}`;
}

function formatMinutesHeader(
  options: Readonly<{ conversationTitle: string; recordedAt: number }>
): string {
  const stamp = new Date(options.recordedAt).toLocaleString('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return `Zápis z nahrávky Minutes — ${options.conversationTitle} (${stamp})`;
}

/**
 * Text, podle kterého se pozná už vložený zápis ze stejné nahrávky.
 * Časové razítko nahrávky je v hlavičce, takže stačí porovnat hlavičku.
 */
export function buildMinutesMarker(
  options: Readonly<{ conversationTitle: string; recordedAt: number }>
): string {
  return formatMinutesHeader(options);
}

/** Obsah nové sekce zápisu: hlavička s původem + převedené AI shrnutí. */
export function buildMinutesSectionContent(
  options: Readonly<{
    conversationTitle: string;
    recordedAt: number;
    summaryMarkdown: string;
  }>
): ReadonlyArray<UubtSectionContentItem> {
  const header = formatMinutesHeader(options);
  const uu5String = markdownToUu5String(
    `**${header}**\n\n${options.summaryMarkdown.trim()}`
  );

  return [
    {
      uu5Tag: 'Uu5RichTextBricks.Block',
      props: { uu5String },
    },
  ];
}

/** Prostý text obsahu sekce — pro detekci duplicit. */
export function extractSectionPlainText(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content.map(extractSectionPlainText).join(' ');
  }
  if (content && typeof content === 'object') {
    return Object.values(content as Record<string, unknown>)
      .map(extractSectionPlainText)
      .join(' ');
  }
  return '';
}
