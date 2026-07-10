// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check

import { createCanvas } from '@napi-rs/canvas';

/** Matches the rounded blue tile in app-icon-source.png (~iOS app icon radius). */
export const MINUTES_ICON_CORNER_RADIUS_RATIO = 0.22;

/**
 * Mask image to a rounded square so corner pixels are transparent (Windows .ico / tray).
 * @param {import('@napi-rs/canvas').SKRSContext2D} ctx
 * @param {number} size
 * @param {number} [cornerRadiusRatio]
 */
export function applyRoundedSquareAlphaMask(
  ctx,
  size,
  cornerRadiusRatio = MINUTES_ICON_CORNER_RADIUS_RATIO
) {
  const radius = Math.max(1, size * cornerRadiusRatio);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, radius);
  ctx.fillStyle = '#000';
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
}

/**
 * @param {import('@napi-rs/canvas').Image} image
 * @param {number} size
 * @param {number} [cornerRadiusRatio]
 */
export async function renderRoundedSquarePng(
  image,
  size,
  cornerRadiusRatio = MINUTES_ICON_CORNER_RADIUS_RATIO
) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(image, 0, 0, size, size);
  applyRoundedSquareAlphaMask(ctx, size, cornerRadiusRatio);
  return canvas.toBuffer('image/png');
}
