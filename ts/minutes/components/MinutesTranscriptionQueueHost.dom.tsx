// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useMemo, useState, type JSX } from 'react';
import { createPortal } from 'react-dom';
import { ipcRenderer } from 'electron';

import { showMinutesTranscriptsTab } from '../navTabsService.preload.ts';
import type { TranscriptionQueueSnapshot } from '../transcriptionQueue.std.ts';
import { subscribeTranscriptionQueue } from '../transcriptionQueueEvents.std.ts';
import { formatQueuePillLabel } from '../transcriptionStatusFormat.std.ts';

const EMPTY_SNAPSHOT: TranscriptionQueueSnapshot = {
  jobs: [],
  queuePaused: false,
  activeJobId: null,
  panelOpen: false,
};

/**
 * Plovoucí pilulka s průběhem fronty. Celá správa přepisů žije v tabu
 * Přepisy; pilulka jen ukazuje, že se něco zpracovává, a přepne na něj.
 */
export function MinutesTranscriptionQueueHost(): JSX.Element | null {
  const [snapshot, setSnapshot] =
    useState<TranscriptionQueueSnapshot>(EMPTY_SNAPSHOT);
  // Překresluje odhad zbývajícího času v pilulce.
  const [, setEtaTick] = useState(0);

  useEffect(() => subscribeTranscriptionQueue(setSnapshot), []);

  useEffect(() => {
    // Akce z menu (Ctrl+Shift+M) přepne levou navigaci na tab Přepisy.
    ipcRenderer.on(
      'minutes:open-transcription-queue',
      showMinutesTranscriptsTab
    );
    return () => {
      ipcRenderer.removeListener(
        'minutes:open-transcription-queue',
        showMinutesTranscriptsTab
      );
    };
  }, []);

  const activeCount = useMemo(
    () =>
      snapshot.jobs.filter(
        job => job.status === 'queued' || job.status === 'processing'
      ).length,
    [snapshot.jobs]
  );

  useEffect(() => {
    if (activeCount === 0) {
      return;
    }
    const timer = window.setInterval(
      () => setEtaTick(value => value + 1),
      5000
    );
    return () => window.clearInterval(timer);
  }, [activeCount]);

  if (activeCount === 0) {
    return null;
  }

  const label = formatQueuePillLabel(snapshot);

  return createPortal(
    <div
      className="MinutesTranscriptionQueue MinutesTranscriptionQueue--pill"
      role="button"
      tabIndex={0}
      title="Zobrazit přepisy"
      aria-label="Zobrazit přepisy"
      onClick={showMinutesTranscriptsTab}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          showMinutesTranscriptsTab();
        }
      }}
    >
      <span className="MinutesTranscriptionQueue__pill-text">{label}</span>
    </div>,
    document.body
  );
}
