// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import loadBinding from 'bindings';

export type Availability =
  | 'available'
  | 'deviceBusy'
  | 'deviceNotPresent'
  | 'disabledByPolicy'
  | 'notConfiguredForUser'
  | 'unknown';

export type Verification =
  | 'verified'
  | 'deviceBusy'
  | 'deviceNotPresent'
  | 'disabledByPolicy'
  | 'notConfiguredForUser'
  | 'retriesExhausted'
  | 'canceled'
  | 'unknown';

type AsyncError = 'canceled' | 'error' | Error;

type BindingType = Readonly<{
  checkAvailability(
    callback: (result: Availability | AsyncError) => void,
  ): void;
  requestVerification(
    message: string,
    callback: (result: Verification | AsyncError) => void,
  ): void;
}>;

let binding: BindingType | undefined;

function getBinding(): BindingType | undefined {
  if (process.platform !== 'win32') {
    return undefined;
  }
  if (binding === undefined) {
    try {
      binding = loadBinding('windows-ucv');
    } catch {
      binding = undefined;
    }
  }
  return binding;
}

/**
 * Check if User Constant Verification is available.
 *
 * See: https://learn.microsoft.com/en-us/uwp/api/windows.security.credentials.ui.userconsentverifier.checkavailabilityasync?view=winrt-26100#windows-security-credentials-ui-userconsentverifier-checkavailabilityasync
 */
export async function checkAvailability(): Promise<Availability> {
  const activeBinding = getBinding();
  if (!activeBinding) {
    return 'unknown';
  }
  return new Promise((resolve, reject) => {
    activeBinding.checkAvailability((result) => {
      if (result === 'canceled') {
        return reject(new Error('Canceled'));
      }
      if (result === 'error') {
        return reject(new Error('Internal error'));
      }
      if (result instanceof Error) {
        return reject(result);
      }

      return resolve(result);
    });
  });
}

/**
 * Request User Constant Verification
 *
 * See: https://learn.microsoft.com/en-us/uwp/api/windows.security.credentials.ui.userconsentverifier.requestverificationasync?view=winrt-26100
 */
export async function requestVerification(
  message: string,
): Promise<Verification> {
  const activeBinding = getBinding();
  if (!activeBinding) {
    throw new Error('windows-ucv native module not available');
  }
  return new Promise((resolve, reject) => {
    activeBinding.requestVerification(message, (result) => {
      if (result === 'canceled') {
        return reject(new Error('Canceled'));
      }
      if (result === 'error') {
        return reject(new Error('Internal error'));
      }
      if (result instanceof Error) {
        return reject(result);
      }

      return resolve(result);
    });
  });
}
