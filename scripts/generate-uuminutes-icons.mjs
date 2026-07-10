// Copyright 2026 uuMinutes contributors
// SPDX-License-Identifier: AGPL-3.0-only
//
// Generate uuMinutes app + taskbar (.ico) + system tray icons from app-icon-source.png.
// Run via `pnpm run build:uuminutes-icons` after every change to the source PNG.
// @ts-check

import { createCanvas, loadImage } from '@napi-rs/canvas';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { assert } from './utils/assert.mjs';

const baseDir = join(import.meta.dirname, '..');
const sourcePath = join(baseDir, 'images', 'uuminutes', 'app-icon-source.png');
const outputRoot = join(baseDir, 'build', 'icons', 'uuminutes');
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
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(image, 0, 0, size, size);
  return canvas.toBuffer('image/png');
}

async function main() {
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
  console.log(`uuMinutes icons generated in ${outputRoot}`);
}

main().catch(error => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
