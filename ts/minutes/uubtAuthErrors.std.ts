// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

export const UUBT_GRANT_UNSUPPORTED_CREDENTIALS =
  'uu-oidc-main/grantToken/unsupportedCredentials';

export function extractUuOidcErrorCodes(body: string): ReadonlyArray<string> {
  try {
    const parsed = JSON.parse(body) as {
      uuAppErrorMap?: Record<string, unknown>;
    };
    return Object.keys(parsed.uuAppErrorMap ?? {}).map(key => key.trim());
  } catch {
    return [];
  }
}

export class UubtInteractiveLoginRequiredError extends Error {
  override readonly name = 'UubtInteractiveLoginRequiredError';

  constructor(message: string) {
    super(message);
  }
}

export function isUubtInteractiveLoginRequiredError(
  error: unknown
): boolean {
  return error instanceof UubtInteractiveLoginRequiredError;
}

export function throwIfUnsupportedCredentials(
  status: number,
  body: string
): void {
  const codes = extractUuOidcErrorCodes(body);
  if (
    codes.some(code => code.includes('unsupportedCredentials')) ||
    (status === 500 &&
      body.includes('unsupportedCredentials') &&
      body.includes('acr'))
  ) {
    throw new UubtInteractiveLoginRequiredError(
      'Účet Plus4U vyžaduje přihlášení přes prohlížeč (2FA).'
    );
  }
}
