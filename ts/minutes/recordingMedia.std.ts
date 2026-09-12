// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Vlastní schéma pro přehrávání uložených nahrávek v rendereru. Renderer se
 * k souborům na disku jinak nedostane (CSP nedovoluje `file:`), takže je
 * servíruje main proces a hlídá, že cesta leží ve složce nahrávek.
 */
export const RECORDING_MEDIA_SCHEME = 'minutesmedia';

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  ogg: 'audio/ogg',
  webm: 'video/webm',
  mp4: 'video/mp4',
};

export function getRecordingMediaUrl(filePath: string): string {
  return `${RECORDING_MEDIA_SCHEME}://media/?path=${encodeURIComponent(filePath)}`;
}

export function getRecordingMediaContentType(filePath: string): string {
  const extension = /\.([a-z0-9]+)$/i.exec(filePath)?.[1]?.toLowerCase();
  return (
    (extension != null ? CONTENT_TYPES[extension] : undefined) ??
    'application/octet-stream'
  );
}

/** Video se vykresluje do `<video>`, zvuk do `<audio>`. */
export function isRecordingMediaVideo(filePath: string): boolean {
  return getRecordingMediaContentType(filePath).startsWith('video/');
}
