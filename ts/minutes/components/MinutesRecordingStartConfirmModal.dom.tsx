// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';

import { AxoAlertDialog } from '../../axo/AxoAlertDialog.dom.tsx';

type Props = Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}>;

export function MinutesRecordingStartConfirmModal({
  open,
  onOpenChange,
  onConfirm,
}: Props): JSX.Element {
  return (
    <AxoAlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AxoAlertDialog.Content escape="cancel-is-noop">
        <AxoAlertDialog.Body>
          <AxoAlertDialog.Title>
            Nahrávání se chystá spustit
          </AxoAlertDialog.Title>
          <AxoAlertDialog.Description>
            Informujte všechny účastníky, že se tento hovor nahrává.
          </AxoAlertDialog.Description>
        </AxoAlertDialog.Body>
        <AxoAlertDialog.Footer>
          <AxoAlertDialog.Cancel>Zrušit</AxoAlertDialog.Cancel>
          <AxoAlertDialog.Action variant="strong-primary" onClick={onConfirm}>
            Spustit nahrávání
          </AxoAlertDialog.Action>
        </AxoAlertDialog.Footer>
      </AxoAlertDialog.Content>
    </AxoAlertDialog.Root>
  );
}
