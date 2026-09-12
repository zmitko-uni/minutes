// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

/** Jeden blok obsahu uuEcc sekce. */
export type UubtSectionContentItem = Readonly<{
  uu5Tag: string;
  tag?: string;
  props: Readonly<Record<string, unknown>>;
  children?: null;
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

  // Stejný tvar, jaký ukládá samotné uuElementaryManagement — jinak se
  // vložený text v sekci nezobrazí.
  return [
    {
      uu5Tag: 'UU5.RichText.Block',
      tag: 'UU5.RichText.Block',
      props: { uu5string: [uu5String] },
      children: null,
    },
  ];
}

function collectUu5Strings(content: unknown, out: Array<string>): void {
  if (Array.isArray(content)) {
    for (const item of content) {
      collectUu5Strings(item, out);
    }
    return;
  }
  if (content == null || typeof content !== 'object') {
    return;
  }

  const props = (content as { props?: Record<string, unknown> }).props;
  const value = props?.uu5string;
  if (typeof value === 'string') {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === 'string') {
        out.push(item);
      }
    }
  }

  for (const nested of Object.values(content as Record<string, unknown>)) {
    if (nested != null && typeof nested === 'object') {
      collectUu5Strings(nested, out);
    }
  }
}

/**
 * Čitelný text sekce schůzky — z uu5string se udělá prostý text s odřádkováním
 * a odrážkami, aby šel zobrazit v Minutes a poslat do chatu.
 */
export function extractSectionDisplayText(content: unknown): string {
  const parts: Array<string> = [];
  collectUu5Strings(content, parts);

  return parts
    .join('\n')
    .replace(/<uu5string[^>]*\/?>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<\/(p|div|li|h[1-6]|ul|ol|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
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
