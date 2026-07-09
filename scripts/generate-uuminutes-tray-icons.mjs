// Generate uuMinutes system tray icons (base + unread badges) from app-icon-source.png.
// @ts-check
import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas';
import { join } from 'node:path';
import { mkdir, rm, writeFile } from 'node:fs/promises';

import { assert } from './utils/assert.mjs';

const baseDir = join(import.meta.dirname, '..');
const sourcePath = join(baseDir, 'images', 'uuminutes', 'app-icon-source.png');
const fontsDir = join(baseDir, 'fonts');
const trayIconsDir = join(baseDir, 'images', 'tray-icons');
const trayIconsBaseDir = join(trayIconsDir, 'base');
const trayIconsAlertsDir = join(trayIconsDir, 'alert');

const PREFIX = 'uuminutes-tray-icon';

const TrayIconSizes = /** @type {const} */ ({
  Size16: '16',
  Size32: '32',
  Size48: '48',
  Size256: '256',
});

/** @typedef {typeof TrayIconSizes[keyof typeof TrayIconSizes]} TrayIconSize */

GlobalFonts.loadFontsFromDir(fontsDir);
const Inter = GlobalFonts.families.find(family => family.family === 'Inter');
assert(Inter != null, `Failed to load fonts from ${fontsDir}`);

const Constants = {
  fontFamily: 'Inter',
  badgeColor: 'rgb(244, 67, 54)',
  badgeShadowColor: 'rgba(0, 0, 0, 0.25)',
};

/** @type {Record<TrayIconSize, { size: number; maxCount: number; badgePadding: number; fontSize: number; fontWeight: string; fontOffsetY: number; badgeShadowBlur: number; badgeShadowOffsetY: number; }>} */
const Variants = {
  [TrayIconSizes.Size16]: {
    size: 16,
    maxCount: 9,
    badgePadding: 2,
    fontSize: 8,
    fontWeight: '500',
    fontOffsetY: 0,
    badgeShadowBlur: 0,
    badgeShadowOffsetY: 0,
  },
  [TrayIconSizes.Size32]: {
    size: 32,
    maxCount: 9,
    badgePadding: 4,
    fontSize: 12,
    fontWeight: '500',
    fontOffsetY: 0,
    badgeShadowBlur: 1,
    badgeShadowOffsetY: 1,
  },
  [TrayIconSizes.Size48]: {
    size: 48,
    maxCount: 9,
    badgePadding: 6,
    fontSize: 16,
    fontWeight: '500',
    fontOffsetY: -1,
    badgeShadowBlur: 1,
    badgeShadowOffsetY: 1,
  },
  [TrayIconSizes.Size256]: {
    size: 256,
    maxCount: 9,
    fontSize: 72,
    fontWeight: '600',
    fontOffsetY: 0,
    badgePadding: 32,
    badgeShadowBlur: 8,
    badgeShadowOffsetY: 8,
  },
};

/**
 * @param {import('@napi-rs/canvas').Image} image
 * @param {number} size
 */
async function renderBaseTrayIcon(image, size) {
  const canvas = createCanvas(size, size);
  const context = canvas.getContext('2d');
  assert(context != null, 'Failed to create 2d canvas context');
  context.clearRect(0, 0, size, size);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, size, size);
  return canvas.toBuffer('image/png');
}

/**
 * @param {number | string | null} value
 * @param {{ maxCount: number }} variant
 */
function trayIconValueToText(value, variant) {
  if (value == null) {
    return '';
  }
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new RangeError(`Unread count must be positive integer ${value}`);
    }
    if (value === 0) {
      return '';
    }
    if (value > variant.maxCount) {
      return `${variant.maxCount}+`;
    }
    return `${value}`;
  }
  throw new TypeError(`Invalid value ${value}`);
}

/**
 * @param {Buffer} baseImageBuffer
 * @param {TrayIconSize} size
 * @param {number | string | null} value
 */
async function generateTrayIconImage(baseImageBuffer, size, value) {
  const variant = Variants[size];
  const text = trayIconValueToText(value, variant);
  const image = await loadImage(baseImageBuffer);
  const canvas = createCanvas(variant.size, variant.size);
  const context = canvas.getContext('2d');
  assert(context != null, 'Failed to create 2d canvas context');

  context.imageSmoothingEnabled = false;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, variant.size, variant.size);

  if (text !== '') {
    let currentFontSize = variant.fontSize;
    while (currentFontSize > 4) {
      context.font = `${variant.fontWeight} ${currentFontSize}px ${Constants.fontFamily}`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';

      const capMetrics = context.measureText('X');
      const textMetrics = context.measureText(text);
      const textWidth = Math.ceil(
        textMetrics.actualBoundingBoxRight + textMetrics.actualBoundingBoxLeft
      );
      const textHeight = Math.ceil(
        capMetrics.actualBoundingBoxAscent + capMetrics.actualBoundingBoxDescent
      );

      const boxHeight = textHeight + variant.badgePadding * 2;
      const boxWidth = Math.max(boxHeight, textWidth + variant.badgePadding * 2);
      const boxMargin = variant.badgeShadowBlur;
      const boxWidthWithMargins = boxWidth + boxMargin * 2;

      if (boxWidthWithMargins > variant.size) {
        currentFontSize -= 1;
        continue;
      }

      const boxX = variant.size - boxWidth - boxMargin;
      const boxY = boxMargin;
      const boxMidX = boxX + boxWidth / 2;
      const boxMidY = boxY + boxHeight / 2;
      const boxRadius = Math.ceil(boxHeight / 2);

      context.save();
      context.beginPath();
      context.roundRect(boxX, boxY, boxWidth, boxHeight, boxRadius);
      context.fillStyle = Constants.badgeColor;
      if (variant.badgeShadowBlur !== 0 || variant.badgeShadowOffsetY !== 0) {
        context.shadowBlur = variant.badgeShadowBlur;
        context.shadowOffsetX = 0;
        context.shadowOffsetY = variant.badgeShadowOffsetY;
        context.shadowColor = Constants.badgeShadowColor;
      }
      context.fill();
      context.restore();

      context.fillStyle = 'white';
      context.fillText(text, boxMidX, boxMidY + variant.fontOffsetY);
      break;
    }
  }

  return canvas.toBuffer('image/png');
}

/** @param {number} start @param {number} end */
function range(start, end) {
  const length = end - start + 1;
  return Array.from({ length }, (_, index) => start + index);
}

async function main() {
  const sourceImage = await loadImage(sourcePath);
  assert(sourceImage.width > 0, `Invalid icon source: ${sourcePath}`);

  await mkdir(trayIconsBaseDir, { recursive: true });

  /** @type {Record<TrayIconSize, Buffer>} */
  const baseBuffers = /** @type {Record<TrayIconSize, Buffer>} */ ({});

  for (const size of Object.values(TrayIconSizes)) {
    const variant = Variants[size];
    const fileName = `${PREFIX}-${variant.size}x${variant.size}-base.png`;
    const buffer = await renderBaseTrayIcon(sourceImage, variant.size);
    baseBuffers[size] = buffer;
    await writeFile(join(trayIconsBaseDir, fileName), buffer);
    console.log(`Wrote base ${fileName}`);
  }

  try {
    await rm(trayIconsAlertsDir, { recursive: true });
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  await mkdir(trayIconsAlertsDir, { recursive: true });

  for (const size of Object.values(TrayIconSizes)) {
    const variant = Variants[size];
    for (const value of range(1, variant.maxCount + 1)) {
      const text = trayIconValueToText(value, variant);
      const fileName = `${PREFIX}-${size}x${size}-alert-${text}.png`;
      const buffer = await generateTrayIconImage(baseBuffers[size], size, value);
      await writeFile(join(trayIconsAlertsDir, fileName), buffer);
      console.log(`Wrote alert ${fileName}`);
    }
  }

  console.log(`uuMinutes tray icons generated in ${trayIconsDir}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
