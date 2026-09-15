// Copyright 2026 Minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';

import { tw } from '../../axo/tw.dom.tsx';
import { formatDownloadDetail } from '../downloadProgress.std.ts';

export type MinutesDownloadProgressPhase =
  | 'checking'
  | 'downloading'
  | 'verifying'
  | 'complete'
  | 'cancelled'
  | 'error';

export type MinutesDownloadProgressView = Readonly<{
  phase: MinutesDownloadProgressPhase;
  message: string;
  percent?: number;
  loadedBytes?: number;
  totalBytes?: number | null;
  bytesPerSecond?: number;
  etaSeconds?: number;
}>;

type Props = Readonly<{
  progress: MinutesDownloadProgressView;
  className?: string;
  barClassName?: string;
  barFillClassName?: string;
}>;

export function MinutesDownloadProgress({
  progress,
  className,
  barClassName,
  barFillClassName,
}: Props): JSX.Element {
  const detail = formatDownloadDetail(progress);
  const isDownloading = progress.phase === 'downloading';
  const hasPercent =
    typeof progress.percent === 'number' &&
    progress.totalBytes != null &&
    progress.totalBytes > 0;
  const showIndeterminate =
    isDownloading &&
    !hasPercent &&
    (progress.loadedBytes != null || progress.percent == null);

  return (
    <div
      className={tw(
        'text-label-small rounded-md px-3 py-2',
        progress.phase === 'error' && 'bg-fill-secondary text-label-primary',
        progress.phase === 'cancelled' && 'opacity-80',
        progress.phase === 'complete' && 'opacity-80',
        className
      )}
    >
      <span>{progress.message}</span>
      {detail && isDownloading && (
        <p className={tw('mt-1 opacity-80')}>{detail}</p>
      )}
      {isDownloading && (hasPercent || showIndeterminate) && (
        <div
          className={tw(
            'bg-fill-secondary mt-2 h-1.5 overflow-hidden rounded-full',
            barClassName
          )}
        >
          {hasPercent ? (
            <div
              className={tw('bg-label-primary h-full', barFillClassName)}
              style={{ width: `${progress.percent}%` }}
            />
          ) : (
            <div
              className={tw(
                'bg-label-primary h-full w-1/3 animate-pulse',
                barFillClassName
              )}
            />
          )}
        </div>
      )}
    </div>
  );
}
