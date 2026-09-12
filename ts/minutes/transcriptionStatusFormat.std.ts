// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { TranscriptionProgressPhase } from './transcriptionProgress.std.ts';
import type {
  TranscriptionJob,
  TranscriptionQueueSnapshot,
} from './transcriptionQueue.std.ts';

export function formatClockDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function formatRecordingDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
  }

  if (totalMinutes > 0) {
    return `${totalMinutes} min`;
  }

  return formatClockDuration(ms);
}

export function formatRecordingWhen(timestamp: number): string {
  try {
    return new Date(timestamp).toLocaleString('cs-CZ');
  } catch {
    return '';
  }
}

export function formatPhaseLabel(phase?: TranscriptionProgressPhase): string {
  switch (phase) {
    case 'prepare':
      return 'Příprava';
    case 'whisper':
      return 'Whisper';
    case 'ai-correction':
      return 'AI';
    case 'finalize':
      return 'Dokončení';
    default:
      return 'Zpracování';
  }
}

export function formatEta(job: TranscriptionJob): string | null {
  if (
    job.status !== 'processing' ||
    job.progress < 3 ||
    job.startedAt == null
  ) {
    return null;
  }

  const elapsed = Date.now() - job.startedAt;
  const remainingMs = (elapsed / job.progress) * (100 - job.progress);
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    return null;
  }

  return `zbývá cca ${formatRecordingDuration(remainingMs)}`;
}

export function formatQueuedPosition(
  job: TranscriptionJob,
  jobs: ReadonlyArray<TranscriptionJob>
): string | null {
  if (job.status !== 'queued') {
    return null;
  }

  const queued = jobs.filter(entry => entry.status === 'queued');
  const index = queued.findIndex(entry => entry.id === job.id);
  if (index < 0) {
    return null;
  }

  return `Pozice ve frontě: ${index + 1}/${queued.length}`;
}

function formatProcessingSummary(job: TranscriptionJob): string {
  const eta = formatEta(job);
  if (job.kind === 'summary') {
    return eta
      ? `Generování shrnutí · ${job.progress} % · ${eta}`
      : `Generování shrnutí · ${job.progress} %`;
  }
  const phase = formatPhaseLabel(job.progressPhase);
  return eta
    ? `${phase} · ${job.progress} % · ${eta}`
    : `${phase} · ${job.progress} %`;
}

export function formatJobStatus(
  job: TranscriptionJob,
  jobs: ReadonlyArray<TranscriptionJob>
): string {
  if (job.status === 'processing' && job.cancelRequested) {
    return 'Rušení…';
  }

  switch (job.status) {
    case 'queued':
      return (
        formatQueuedPosition(job, jobs) ??
        (job.kind === 'summary' ? 'Čeká ve frontě (shrnutí)' : 'Čeká ve frontě')
      );
    case 'processing':
      return formatProcessingSummary(job);
    case 'completed':
      return job.kind === 'summary' ? 'Shrnutí hotovo' : 'Hotovo';
    // Podrobnosti k chybě patří do detailu, ne do řádku seznamu.
    case 'failed':
      return job.kind === 'summary' ? 'Shrnutí selhalo' : 'Přepis selhal';
    case 'cancelled':
      return 'Zrušeno';
    default:
      return job.status;
  }
}

/** Text plovoucí pilulky s celkovým průběhem fronty. */
export function formatQueuePillLabel(
  snapshot: TranscriptionQueueSnapshot
): string {
  const processing = snapshot.jobs.find(job => job.status === 'processing');
  if (processing) {
    const eta = formatEta(processing);
    return eta
      ? `Přepis ${processing.progress}% · ${eta}`
      : `Přepis ${processing.progress}%`;
  }

  const activeCount = snapshot.jobs.filter(
    job => job.status === 'queued' || job.status === 'processing'
  ).length;
  return activeCount > 0 ? `Fronta ${activeCount}` : 'Přepisy';
}
