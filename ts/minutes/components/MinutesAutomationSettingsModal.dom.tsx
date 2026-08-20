// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
/* oxlint-disable signal-desktop/enforce-file-suffix */

import { ipcRenderer } from 'electron';
import { useEffect, useState, type JSX } from 'react';

import { AxoDialog } from '../../axo/AxoDialog.dom.tsx';
import { formatAppDialogTitle } from '../branding.std.ts';
import { MinutesAutomationSettingsPanel } from './MinutesAutomationSettingsPanel.dom.tsx';

type Props = Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
}>;

export function MinutesAutomationSettingsModal({
  open,
  onOpenChange,
}: Props): JSX.Element {
  return (
    <AxoDialog.Root open={open} onOpenChange={onOpenChange}>
      <AxoDialog.Content size="lg" escape="cancel-is-noop">
        <AxoDialog.Header>
          <AxoDialog.Title>
            {formatAppDialogTitle('Nastavení MCP')}
          </AxoDialog.Title>
          <AxoDialog.Close />
        </AxoDialog.Header>
        <AxoDialog.Body>
          <AxoDialog.Description>
            <MinutesAutomationSettingsPanel />
          </AxoDialog.Description>
        </AxoDialog.Body>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}

export function MinutesAutomationSettingsHost(): JSX.Element {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (): void => {
      setOpen(true);
    };
    ipcRenderer.on('minutes:open-automation-settings', handler);
    return () => {
      ipcRenderer.removeListener('minutes:open-automation-settings', handler);
    };
  }, []);

  return <MinutesAutomationSettingsModal open={open} onOpenChange={setOpen} />;
}
