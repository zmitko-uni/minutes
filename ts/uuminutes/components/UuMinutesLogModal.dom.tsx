// Copyright 2026 uuMinutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect, useState, type JSX } from 'react';
import { ipcRenderer } from 'electron';

import { AxoDialog } from '../../axo/AxoDialog.dom.tsx';
import { tw } from '../../axo/tw.dom.tsx';
import { drop } from '../../util/drop.std.ts';
import { APP_DISPLAY_NAME, formatAppDialogTitle } from '../branding.std.ts';
import {
  clearUuMinutesLogBuffer,
  getUuMinutesLogText,
} from '../logBuffer.preload.ts';

type Props = Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
}>;

export function UuMinutesLogModal({
  open,
  onOpenChange,
}: Props): JSX.Element | null {
  const [logText, setLogText] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(() => {
    setIsLoading(true);
    setStatusMessage(null);
    drop(
      (async () => {
        try {
          setLogText(await getUuMinutesLogText());
        } catch (error) {
          setStatusMessage(
            error instanceof Error ? error.message : 'Failed to load logs'
          );
        } finally {
          setIsLoading(false);
        }
      })()
    );
  }, []);

  useEffect(() => {
    if (open) {
      refresh();
    }
  }, [open, refresh]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(logText);
      setStatusMessage('Copied to clipboard.');
    } catch {
      setStatusMessage('Copy failed — select text manually.');
    }
  }, [logText]);

  const handleClearBuffer = useCallback(() => {
    clearUuMinutesLogBuffer();
    setStatusMessage('Session buffer cleared. Refresh to reload file tail.');
  }, []);

  if (!open) {
    return null;
  }

  return (
    <AxoDialog.Root open={open} onOpenChange={onOpenChange}>
      <AxoDialog.Content size="lg" escape="cancel-is-noop">
        <AxoDialog.Header>
          <AxoDialog.Title>{formatAppDialogTitle('log')}</AxoDialog.Title>
          <AxoDialog.Close />
        </AxoDialog.Header>
        <AxoDialog.Body>
          <AxoDialog.Description>
            <p className={tw('mb-3 text-label-medium')}>
              Nedávné řádky logu {APP_DISPLAY_NAME} a konec souboru{' '}
              <code>logs/app.log</code>. Copy and share for debugging.
            </p>
          </AxoDialog.Description>
          <textarea
            className={tw(
              'h-80 w-full resize-y rounded-md border border-solid p-3',
              'border-label-disabled bg-background-primary font-mono text-label-small'
            )}
            readOnly
            value={isLoading ? 'Loading…' : logText}
          />
          {statusMessage && (
            <p className={tw('mt-2 text-label-small')}>{statusMessage}</p>
          )}
        </AxoDialog.Body>
        <AxoDialog.Footer>
          <AxoDialog.Actions>
            <AxoDialog.Action
              variant="secondary"
              disabled={isLoading}
              onClick={handleClearBuffer}
            >
              Clear buffer
            </AxoDialog.Action>
            <AxoDialog.Action
              variant="secondary"
              disabled={isLoading}
              onClick={refresh}
            >
              Refresh
            </AxoDialog.Action>
            <AxoDialog.Action
              variant="secondary"
              disabled={isLoading || logText.length === 0}
              onClick={() => drop(handleCopy())}
            >
              Copy
            </AxoDialog.Action>
            <AxoDialog.Action
              variant="primary"
              onClick={() => onOpenChange(false)}
            >
              Close
            </AxoDialog.Action>
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}

export function UuMinutesLogHost(): JSX.Element {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (): void => {
      setOpen(true);
    };
    ipcRenderer.on('uuminutes:open-log', handler);
    return () => {
      ipcRenderer.removeListener('uuminutes:open-log', handler);
    };
  }, []);

  return <UuMinutesLogModal open={open} onOpenChange={setOpen} />;
}
