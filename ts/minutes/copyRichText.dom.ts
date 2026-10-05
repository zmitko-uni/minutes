// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { clipboard } from 'electron';

/** Shrnutí a jeho editor. Mimo ně necháváme kopírování Signálu. */
const RICH_TEXT_ROOT_SELECTOR =
  '.MinutesMarkdown, .MinutesSummaryEditor__surface';

const INLINE_TAGS = new Set(['strong', 'b', 'em', 'i', 'code', 'a']);

function selectionElement(node: Node | null): Element | null {
  if (node == null) {
    return null;
  }
  return node instanceof Element ? node : node.parentElement;
}

function selectionInRichText(): boolean {
  const selection = document.getSelection();
  if (
    selection == null ||
    selection.isCollapsed ||
    selection.rangeCount === 0
  ) {
    return false;
  }
  return (
    selectionElement(selection.anchorNode)?.closest(RICH_TEXT_ROOT_SELECTOR) !=
    null
  );
}

function unwrapMarks(root: ParentNode): void {
  for (const mark of [...root.querySelectorAll('mark')]) {
    const parent = mark.parentNode;
    if (parent == null) {
      continue;
    }
    while (mark.firstChild != null) {
      parent.insertBefore(mark.firstChild, mark);
    }
    parent.removeChild(mark);
  }
}

function stripPresentation(root: ParentNode): void {
  for (const node of [...root.querySelectorAll('*')]) {
    node.removeAttribute('class');
    node.removeAttribute('style');
  }
}

/** Čisté HTML (tučně, seznamy, nadpisy) bez tříd Minutes — vhodné pro vložení jinam. */
export function elementToClipboardHtml(element: HTMLElement): string {
  const clone = element.cloneNode(true) as HTMLElement;
  unwrapMarks(clone);
  stripPresentation(clone);
  return clone.innerHTML.trim();
}

function wrapInheritedFormatting(
  selection: Selection,
  fragment: HTMLElement
): void {
  if (
    fragment.querySelector('strong, b, em, i, ul, ol, h1, h2, h3, p, li') !=
    null
  ) {
    return;
  }

  const wrappers: Array<Element> = [];
  let current = selectionElement(selection.anchorNode);
  while (
    current != null &&
    !current.matches(RICH_TEXT_ROOT_SELECTOR) &&
    current.closest(RICH_TEXT_ROOT_SELECTOR) != null
  ) {
    wrappers.push(current);
    current = current.parentElement;
  }

  for (const source of wrappers) {
    const tag = source.tagName.toLowerCase();
    if (tag === 'li') {
      const listTag =
        source.parentElement?.tagName.toLowerCase() === 'ol' ? 'ol' : 'ul';
      const list = document.createElement(listTag);
      const item = document.createElement('li');
      while (fragment.firstChild != null) {
        item.appendChild(fragment.firstChild);
      }
      list.appendChild(item);
      fragment.appendChild(list);
      continue;
    }
    if (!INLINE_TAGS.has(tag)) {
      continue;
    }
    const wrapper = document.createElement(tag);
    if (tag === 'a') {
      const href = source.getAttribute('href');
      if (href != null && href.length > 0) {
        wrapper.setAttribute('href', href);
      }
    }
    while (fragment.firstChild != null) {
      wrapper.appendChild(fragment.firstChild);
    }
    fragment.appendChild(wrapper);
  }
}

function selectionToClipboardHtml(selection: Selection): string {
  const container = document.createElement('div');
  for (let index = 0; index < selection.rangeCount; index += 1) {
    container.appendChild(selection.getRangeAt(index).cloneContents());
  }
  wrapInheritedFormatting(selection, container);
  unwrapMarks(container);
  stripPresentation(container);
  return container.innerHTML.trim();
}

export function copyFormattedHtml(html: string, plain: string): void {
  const fragment = html.trim();
  if (fragment.length === 0) {
    throw new Error('Není co kopírovat.');
  }
  clipboard.write({
    text: plain.trim().length > 0 ? plain : fragment,
    html: fragment,
  });
}

/**
 * Signal při každém Ctrl+C smaže HTML a nechá jen prostý text. U shrnutí
 * chceme tučné písmo, odrážky a nadpisy, aby šly vložit třeba do Plus4U.
 */
export function initializeMinutesRichClipboard(): void {
  document.addEventListener(
    'copy',
    event => {
      if (!selectionInRichText()) {
        return;
      }
      const selection = document.getSelection();
      if (selection == null) {
        return;
      }
      const html = selectionToClipboardHtml(selection);
      const plain = selection.toString();
      if (html.length === 0 && plain.trim().length === 0) {
        return;
      }
      const fallbackHtml = `<p>${plain
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')}</p>`;
      clipboard.write({
        text: plain,
        html: html.length > 0 ? html : fallbackHtml,
      });
      event.preventDefault();
      event.stopPropagation();
    },
    true
  );
}
