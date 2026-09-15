// Copyright 2026 Minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

export type DownloadProgressSnapshot = Readonly<{
  loadedBytes: number;
  totalBytes: number | null;
  percent?: number;
  bytesPerSecond?: number;
  etaSeconds?: number;
}>;

const GB = 1024 ** 3;
const MB = 1024 ** 2;

function formatDecimal(value: number, fractionDigits: number): string {
  return value.toFixed(fractionDigits).replace('.', ',');
}

export function formatDownloadSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return '—';
  }
  if (bytes >= GB) {
    return `${formatDecimal(bytes / GB, 1)} GB`;
  }
  if (bytes >= MB) {
    return `${formatDecimal(bytes / MB, 0)} MB`;
  }
  if (bytes >= 1024) {
    return `${formatDecimal(bytes / 1024, 0)} kB`;
  }
  return `${Math.round(bytes)} B`;
}

export function formatDownloadRate(bytesPerSecond: number | undefined): string | null {
  if (bytesPerSecond == null || !Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) {
    return null;
  }
  if (bytesPerSecond >= MB) {
    return `${formatDecimal(bytesPerSecond / MB, 0)} MB/s`;
  }
  if (bytesPerSecond >= 1024) {
    return `${formatDecimal(bytesPerSecond / 1024, 0)} kB/s`;
  }
  return `${Math.round(bytesPerSecond)} B/s`;
}

export function formatDownloadEta(etaSeconds: number | undefined): string | null {
  if (etaSeconds == null || !Number.isFinite(etaSeconds) || etaSeconds < 0) {
    return null;
  }
  if (etaSeconds < 5) {
    return 'zbývá chvilka';
  }
  if (etaSeconds < 60) {
    return `zbývá ~${Math.round(etaSeconds)} s`;
  }
  const minutes = Math.round(etaSeconds / 60);
  if (minutes < 60) {
    return `zbývá ~${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return `zbývá ~${hours} h`;
  }
  return `zbývá ~${hours} h ${remainingMinutes} min`;
}

export function formatDownloadDetail(snapshot: {
  loadedBytes?: number;
  totalBytes?: number | null;
  bytesPerSecond?: number;
  etaSeconds?: number;
}): string | null {
  const loadedBytes = snapshot.loadedBytes;
  if (loadedBytes == null || !Number.isFinite(loadedBytes)) {
    return null;
  }

  const parts: Array<string> = [];
  const totalBytes = snapshot.totalBytes;
  if (totalBytes != null && totalBytes > 0) {
    parts.push(
      `${formatDownloadSize(loadedBytes)} / ${formatDownloadSize(totalBytes)}`
    );
    const percent = Math.min(100, Math.round((loadedBytes / totalBytes) * 100));
    parts.push(`${percent} %`);
  } else {
    parts.push(formatDownloadSize(loadedBytes));
  }

  const rate = formatDownloadRate(snapshot.bytesPerSecond);
  if (rate) {
    parts.push(rate);
  }

  const eta = formatDownloadEta(snapshot.etaSeconds);
  if (eta) {
    parts.push(eta);
  }

  return parts.length > 0 ? parts.join(' · ') : null;
}

function computePercent(loaded: number, total: number | null): number | undefined {
  if (total == null || total <= 0) {
    return undefined;
  }
  return Math.min(99, Math.round((loaded / total) * 100));
}

function computeSpeedAndEta(
  loaded: number,
  total: number | null,
  startedAtMs: number,
  nowMs: number
): { bytesPerSecond?: number; etaSeconds?: number } {
  const elapsedSeconds = (nowMs - startedAtMs) / 1000;
  if (elapsedSeconds <= 0 || loaded <= 0) {
    return {};
  }

  const bytesPerSecond = loaded / elapsedSeconds;
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) {
    return {};
  }

  if (total == null || total <= loaded) {
    return { bytesPerSecond };
  }

  const remainingBytes = total - loaded;
  const etaSeconds = remainingBytes / bytesPerSecond;
  if (!Number.isFinite(etaSeconds) || etaSeconds < 0) {
    return { bytesPerSecond };
  }

  return { bytesPerSecond, etaSeconds };
}

export type DownloadProgressReporter = Readonly<{
  onProgress: (loaded: number, total: number | null) => void;
  flush: () => void;
}>;

export function createDownloadProgressReporter({
  onReport,
  intervalMs = 250,
  now = () => Date.now(),
}: {
  onReport: (snapshot: DownloadProgressSnapshot) => void;
  intervalMs?: number;
  now?: () => number;
}): DownloadProgressReporter {
  let lastReportAtMs = 0;
  let startedAtMs: number | null = null;
  let lastLoaded = 0;
  let lastTotal: number | null = null;
  let pendingFlush = false;

  const emit = (force: boolean): void => {
    if (startedAtMs == null) {
      return;
    }

    const currentMs = now();
    if (!force && currentMs - lastReportAtMs < intervalMs) {
      pendingFlush = true;
      return;
    }

    pendingFlush = false;
    lastReportAtMs = currentMs;

    const { bytesPerSecond, etaSeconds } = computeSpeedAndEta(
      lastLoaded,
      lastTotal,
      startedAtMs,
      currentMs
    );

    onReport({
      loadedBytes: lastLoaded,
      totalBytes: lastTotal,
      percent: computePercent(lastLoaded, lastTotal),
      bytesPerSecond,
      etaSeconds,
    });
  };

  const onProgress = (loaded: number, total: number | null): void => {
    if (startedAtMs == null) {
      startedAtMs = now();
      lastReportAtMs = 0;
      emit(true);
    }

    lastLoaded = loaded;
    lastTotal = total;
    emit(false);
  };

  const flush = (): void => {
    if (pendingFlush) {
      emit(true);
    }
  };

  return { onProgress, flush };
}
