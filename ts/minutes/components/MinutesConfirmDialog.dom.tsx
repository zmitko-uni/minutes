// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX, ReactNode } from 'react';

import { AxoDialog } from '../../axo/AxoDialog.dom.tsx';
import { tw } from '../../axo/tw.dom.tsx';

/** Potvrzení nevratné akce — mazání nahrávky, odebrání záložky, uzavření schůzky. */
export function MinutesConfirmDialog({
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone,
  onConfirm,
  onCancel,
}: Readonly<{
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'destructive' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}>): JSX.Element {
  return (
    <AxoDialog.Root
      open
      onOpenChange={nextOpen => {
        if (!nextOpen) {
          onCancel();
        }
      }}
    >
      <AxoDialog.Content size="md" escape="cancel-is-noop">
        <AxoDialog.Header>
          <AxoDialog.Title>{title}</AxoDialog.Title>
          <AxoDialog.Close />
        </AxoDialog.Header>
        <AxoDialog.Body>
          <AxoDialog.Description>
            <p className={tw('text-label-medium')}>{description}</p>
          </AxoDialog.Description>
        </AxoDialog.Body>
        <AxoDialog.Footer>
          <AxoDialog.Actions>
            <AxoDialog.Action variant="subtle-secondary" onClick={onCancel}>
              {cancelLabel ?? 'Zrušit'}
            </AxoDialog.Action>
            <AxoDialog.Action
              variant={
                tone === 'primary' ? 'strong-primary' : 'strong-destructive'
              }
              onClick={onConfirm}
            >
              {confirmLabel}
            </AxoDialog.Action>
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}
