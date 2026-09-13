// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useState } from 'react';

import {
  isUubtIntegrationEnabled,
  subscribeUubtIntegrationEnabled,
} from './uubtService.preload.ts';

/**
 * Je zapnutá integrace Plus4U? Funkce na ní postavené (tab Vizitky) se bez ní
 * v UI vůbec neukazují.
 */
export function useUubtIntegrationEnabled(): boolean {
  const [enabled, setEnabled] = useState(isUubtIntegrationEnabled);

  useEffect(() => {
    // Nastavení se načítá asynchronně při startu — může dorazit dřív než mount.
    setEnabled(isUubtIntegrationEnabled());
    return subscribeUubtIntegrationEnabled(setEnabled);
  }, []);

  return enabled;
}
