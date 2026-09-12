// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Převod mezi Markdownem (shrnutí se ukládá jako `.summary.md`) a HTML pro
 * `contenteditable`. Podporuje jen to, co umí nabídnout editor shrnutí:
 * nadpisy, odstavce, odrážky, číslování, tučně, kurzíva, kód a odkazy.
 */

const ESCAPE_MAP: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
};

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>]/g,
    character => ESCAPE_MAP[character] ?? character
  );
}

function inlineToHtml(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/(^|[\s(])_([^_\n]+)_/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(
      /\[([^\]]+)\]\(([^)\s]+)\)/g,
      (_match, label: string, href: string) =>
        `<a href="${href.replace(/"/g, '&quot;')}">${label}</a>`
    );
}

export function markdownToEditorHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const html: Array<string> = [];
  let listTag: 'ul' | 'ol' | null = null;

  const closeList = (): void => {
    if (listTag != null) {
      html.push(`</${listTag}>`);
      listTag = null;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line.length === 0) {
      closeList();
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading?.[1] != null && heading[2] != null) {
      closeList();
      const level = heading[1].length;
      html.push(`<h${level}>${inlineToHtml(heading[2])}</h${level}>`);
      continue;
    }

    const bullet = /^[-*]\s+(.*)$/.exec(line);
    if (bullet != null) {
      if (listTag !== 'ul') {
        closeList();
        html.push('<ul>');
        listTag = 'ul';
      }
      html.push(`<li>${inlineToHtml(bullet[1] ?? '')}</li>`);
      continue;
    }

    const numbered = /^\d+\.\s+(.*)$/.exec(line);
    if (numbered != null) {
      if (listTag !== 'ol') {
        closeList();
        html.push('<ol>');
        listTag = 'ol';
      }
      html.push(`<li>${inlineToHtml(numbered[1] ?? '')}</li>`);
      continue;
    }

    closeList();
    html.push(`<p>${inlineToHtml(line)}</p>`);
  }

  closeList();
  return html.join('');
}

function inlineFromNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.textContent ?? '').replace(/\s+/g, ' ');
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }

  const element = node as Element;
  const inner = [...element.childNodes].map(inlineFromNode).join('');
  const tag = element.tagName.toLowerCase();

  switch (tag) {
    case 'strong':
    case 'b':
      return inner.trim().length > 0 ? `**${inner.trim()}**` : '';
    case 'em':
    case 'i':
      return inner.trim().length > 0 ? `*${inner.trim()}*` : '';
    case 'code':
      return inner.trim().length > 0 ? `\`${inner.trim()}\`` : '';
    case 'a': {
      const href = element.getAttribute('href') ?? '';
      const label = inner.trim();
      if (label.length === 0) {
        return '';
      }
      return href.length > 0 ? `[${label}](${href})` : label;
    }
    case 'br':
      return '\n';
    default:
      return inner;
  }
}

function blockFromElement(element: Element, blocks: Array<string>): void {
  const tag = element.tagName.toLowerCase();

  switch (tag) {
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6': {
      const level = Math.min(Number(tag.slice(1)), 3);
      const text = inlineFromNode(element).trim();
      if (text.length > 0) {
        blocks.push(`${'#'.repeat(level)} ${text}`);
      }
      return;
    }
    case 'ul':
    case 'ol': {
      const items = [...element.children]
        .filter(child => child.tagName.toLowerCase() === 'li')
        .map(child => inlineFromNode(child).trim())
        .filter(text => text.length > 0)
        .map((text, index) =>
          tag === 'ol' ? `${index + 1}. ${text}` : `- ${text}`
        );
      if (items.length > 0) {
        blocks.push(items.join('\n'));
      }
      return;
    }
    case 'blockquote': {
      const text = inlineFromNode(element).trim();
      if (text.length > 0) {
        blocks.push(`> ${text}`);
      }
      return;
    }
    case 'hr':
      blocks.push('---');
      return;
    default: {
      // Prohlížeč vrací i vnořené divy — rozpad na bloky musí pokračovat.
      const hasBlockChild = [...element.children].some(child =>
        ['div', 'p', 'ul', 'ol', 'h1', 'h2', 'h3', 'blockquote'].includes(
          child.tagName.toLowerCase()
        )
      );
      if (hasBlockChild) {
        for (const child of element.childNodes) {
          collectBlocks(child, blocks);
        }
        return;
      }
      const text = inlineFromNode(element).trim();
      if (text.length > 0) {
        blocks.push(text);
      }
    }
  }
}

function collectBlocks(node: Node, blocks: Array<string>): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = (node.textContent ?? '').trim();
    if (text.length > 0) {
      blocks.push(text);
    }
    return;
  }
  if (node.nodeType === Node.ELEMENT_NODE) {
    blockFromElement(node as Element, blocks);
  }
}

export function editorHtmlToMarkdown(html: string): string {
  const container = document.createElement('div');
  container.innerHTML = html;

  const blocks: Array<string> = [];
  for (const node of container.childNodes) {
    collectBlocks(node, blocks);
  }

  return blocks
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
