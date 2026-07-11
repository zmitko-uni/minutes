// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only
//
// Generate minutes app + taskbar (.ico) icons from app-icon-source.png.
// Run via `pnpm run build:minutes-icons` after changing the source PNG.
// Skips when outputs are newer than the source (no-op on ordinary builds).
// @ts-check

import { loadImage } from '@napi-rs/canvas';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { assert } from './utils/assert.mjs';
import { areIconOutputsUpToDate } from './utils/iconBuildUpToDate.mjs';
import {
  renderRoundedSquarePng,
  MINUTES_ICON_CORNER_RADIUS_RATIO,
} from './utils/minutesIconMask.mjs';

const baseDir = join(import.meta.dirname, '..');
const sourcePath = join(baseDir, 'images', 'minutes', 'app-icon-source.png');
const outputRoot = join(baseDir, 'build', 'icons', 'minutes');
const pngDir = join(outputRoot, 'png');
const winDir = join(outputRoot, 'win');

const PNG_SIZES = [16, 32, 48, 64, 128, 256, 512];

/**
 * @param {ReadonlyArray<{ width: number; height: number; buffer: Buffer }>} images
 */
function encodeIco(images) {
  const count = images.length;
  const headerSize = 6 + count * 16;
  let offset = headerSize;
  const header = Buffer.alloc(headerSize);

  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  const chunks = [header];

  images.forEach((image, index) => {
    const entry = 6 + index * 16;
    header.writeUInt8(image.width >= 256 ? 0 : image.width, entry);
    header.writeUInt8(image.height >= 256 ? 0 : image.height, entry + 1);
    header.writeUInt8(0, entry + 2);
    header.writeUInt8(0, entry + 3);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(image.buffer.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += image.buffer.length;
    chunks.push(Buffer.from(image.buffer));
  });

  return Buffer.concat(chunks);
}

/**
 * @param {import('@napi-rs/canvas').Image} image
 * @param {number} size
 */
async function renderSquarePng(image, size) {
  return renderRoundedSquarePng(image, size, MINUTES_ICON_CORNER_RADIUS_RATIO);
}

async function main() {
  const outputPaths = [
    ...PNG_SIZES.map(size => join(pngDir, `${size}x${size}.png`)),
    join(winDir, 'icon.ico'),
  ];

  if (!(process.argv.includes('--force') || process.env.MINUTES_FORCE_ICON_BUILD === '1')) {
    if (await areIconOutputsUpToDate(sourcePath, outputPaths)) {
      // eslint-disable-next-line no-console
      console.log('minutes app icons up to date — skip');
      return;
    }
  }

  const image = await loadImage(sourcePath);
  assert(image.width > 0 && image.height > 0, `Invalid icon source: ${sourcePath}`);

  await mkdir(pngDir, { recursive: true });
  await mkdir(winDir, { recursive: true });

  const icoImages = [];

  for (const size of PNG_SIZES) {
    const png = await renderSquarePng(image, size);
    const fileName = `${size}x${size}.png`;
    await writeFile(join(pngDir, fileName), png);
    if (size <= 256) {
      icoImages.push({ width: size, height: size, buffer: png });
    }
  }

  const ico = encodeIco(icoImages);
  await writeFile(join(winDir, 'icon.ico'), ico);

  // eslint-disable-next-line no-console
  console.log(`minutes icons generated in ${outputRoot}`);
}

main().catch(error => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
