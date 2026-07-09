// Copyright 2026 uuMinutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX, ReactNode } from 'react';

import { openLinkInWebBrowser } from '../../util/openLinkInWebBrowser.dom.ts';

function trimmedLine(lines: ReadonlyArray<string>, index: number): string {
  return lines[index]?.trim() ?? '';
}

type InlineToken =
  | Readonly<{ kind: 'text'; value: string }>
  | Readonly<{ kind: 'bold'; value: string }>
  | Readonly<{ kind: 'code'; value: string }>
  | Readonly<{ kind: 'link'; label: string; href: string }>;

function parseInline(text: string): ReadonlyArray<InlineToken> {
  const tokens: Array<InlineToken> = [];
  const pattern =
    /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match = pattern.exec(text);

  while (match != null) {
    if (match.index > lastIndex) {
      tokens.push({ kind: 'text', value: text.slice(lastIndex, match.index) });
    }

    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      tokens.push({ kind: 'bold', value: token.slice(2, -2) });
    } else if (token.startsWith('`') && token.endsWith('`')) {
      tokens.push({ kind: 'code', value: token.slice(1, -1) });
    } else {
      const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (linkMatch?.[1] != null && linkMatch[2] != null) {
        tokens.push({
          kind: 'link',
          label: linkMatch[1],
          href: linkMatch[2],
        });
      } else {
        tokens.push({ kind: 'text', value: token });
      }
    }

    lastIndex = match.index + token.length;
    match = pattern.exec(text);
  }

  if (lastIndex < text.length) {
    tokens.push({ kind: 'text', value: text.slice(lastIndex) });
  }

  return tokens;
}

function renderInline(text: string, keyPrefix: string): Array<ReactNode> {
  return parseInline(text).map((token, index) => {
    const key = `${keyPrefix}-${index}`;
    if (token.kind === 'text') {
      return token.value;
    }
    if (token.kind === 'bold') {
      return <strong key={key}>{renderInline(token.value, `${key}-b`)}</strong>;
    }
    if (token.kind === 'code') {
      return <code key={key}>{token.value}</code>;
    }
    return (
      <a
        key={key}
        href={token.href}
        onClick={event => {
          event.preventDefault();
          openLinkInWebBrowser(token.href);
        }}
      >
        {token.label}
      </a>
    );
  });
}

function isTableRow(line: string): boolean {
  return line.trimStart().startsWith('|');
}

function parseTableRow(line: string): ReadonlyArray<string> {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map(cell => cell.trim());
}

function isTableSeparator(line: string): boolean {
  return /^\|?[\s:-]+\|[\s|:-]*$/.test(line.trim());
}

type Block =
  | Readonly<{ kind: 'heading'; level: 1 | 2 | 3; text: string }>
  | Readonly<{ kind: 'paragraph'; text: string }>
  | Readonly<{ kind: 'ul'; items: ReadonlyArray<string> }>
  | Readonly<{ kind: 'ol'; items: ReadonlyArray<string> }>
  | Readonly<{ kind: 'blockquote'; text: string }>
  | Readonly<{ kind: 'hr' }>
  | Readonly<{ kind: 'table'; rows: ReadonlyArray<ReadonlyArray<string>> }>;

function parseBlocks(source: string): ReadonlyArray<Block> {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: Array<Block> = [];
  let index = 0;

  while (index < lines.length) {
    const trimmed = trimmedLine(lines, index);

    if (trimmed === '') {
      index += 1;
      continue;
    }

    if (trimmed === '---') {
      blocks.push({ kind: 'hr' });
      index += 1;
      continue;
    }

    const headingMatch = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (headingMatch?.[1] != null && headingMatch[2] != null) {
      blocks.push({
        kind: 'heading',
        level: headingMatch[1].length as 1 | 2 | 3,
        text: headingMatch[2],
      });
      index += 1;
      continue;
    }

    if (trimmed.startsWith('> ')) {
      const quoteLines: Array<string> = [];
      while (index < lines.length && trimmedLine(lines, index).startsWith('> ')) {
        quoteLines.push(trimmedLine(lines, index).slice(2));
        index += 1;
      }
      blocks.push({ kind: 'blockquote', text: quoteLines.join(' ') });
      continue;
    }

    if (isTableRow(trimmed)) {
      const rows: Array<Array<string>> = [];
      while (index < lines.length && isTableRow(trimmedLine(lines, index))) {
        const rowLine = trimmedLine(lines, index);
        if (!isTableSeparator(rowLine)) {
          rows.push([...parseTableRow(rowLine)]);
        }
        index += 1;
      }
      if (rows.length > 0) {
        blocks.push({ kind: 'table', rows });
      }
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: Array<string> = [];
      while (index < lines.length && /^[-*]\s+/.test(trimmedLine(lines, index))) {
        items.push(trimmedLine(lines, index).replace(/^[-*]\s+/, ''));
        index += 1;
      }
      blocks.push({ kind: 'ul', items });
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: Array<string> = [];
      while (index < lines.length && /^\d+\.\s+/.test(trimmedLine(lines, index))) {
        items.push(trimmedLine(lines, index).replace(/^\d+\.\s+/, ''));
        index += 1;
      }
      blocks.push({ kind: 'ol', items });
      continue;
    }

    const paragraphLines: Array<string> = [trimmed];
    index += 1;
    while (
      index < lines.length &&
      trimmedLine(lines, index) !== '' &&
      !trimmedLine(lines, index).startsWith('#') &&
      !trimmedLine(lines, index).startsWith('> ') &&
      !/^[-*]\s+/.test(trimmedLine(lines, index)) &&
      !/^\d+\.\s+/.test(trimmedLine(lines, index)) &&
      !isTableRow(trimmedLine(lines, index)) &&
      trimmedLine(lines, index) !== '---'
    ) {
      paragraphLines.push(trimmedLine(lines, index));
      index += 1;
    }
    blocks.push({ kind: 'paragraph', text: paragraphLines.join(' ') });
  }

  return blocks;
}

function renderBlock(block: Block, index: number): JSX.Element {
  switch (block.kind) {
    case 'heading': {
      const Tag = block.level === 1 ? 'h1' : block.level === 2 ? 'h2' : 'h3';
      return (
        <Tag key={index} className={`UuMinutesMarkdown__h${block.level}`}>
          {renderInline(block.text, `h-${index}`)}
        </Tag>
      );
    }
    case 'paragraph':
      return (
        <p key={index} className="UuMinutesMarkdown__p">
          {renderInline(block.text, `p-${index}`)}
        </p>
      );
    case 'ul':
      return (
        <ul key={index} className="UuMinutesMarkdown__ul">
          {block.items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInline(item, `ul-${index}-${itemIndex}`)}</li>
          ))}
        </ul>
      );
    case 'ol':
      return (
        <ol key={index} className="UuMinutesMarkdown__ol">
          {block.items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInline(item, `ol-${index}-${itemIndex}`)}</li>
          ))}
        </ol>
      );
    case 'blockquote':
      return (
        <blockquote key={index} className="UuMinutesMarkdown__quote">
          {renderInline(block.text, `q-${index}`)}
        </blockquote>
      );
    case 'hr':
      return <hr key={index} className="UuMinutesMarkdown__hr" />;
    case 'table':
      return (
        <div key={index} className="UuMinutesMarkdown__tableWrap">
          <table className="UuMinutesMarkdown__table">
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => {
                    const CellTag = rowIndex === 0 ? 'th' : 'td';
                    return (
                      <CellTag key={cellIndex}>
                        {renderInline(cell, `t-${index}-${rowIndex}-${cellIndex}`)}
                      </CellTag>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    default:
      return <div key={index} />;
  }
}

export function UuMinutesMarkdown({
  source,
}: Readonly<{ source: string }>): JSX.Element {
  const blocks = parseBlocks(source);
  return (
    <div className="UuMinutesMarkdown">
      {blocks.map((block, index) => renderBlock(block, index))}
    </div>
  );
}
