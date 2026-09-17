// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { getUubtToken, type UubtToken } from './uubtAuth.main.ts';
import { isUubtInteractiveLoginRequiredError } from './uubtAuthErrors.std.ts';
import { runUubtBrowserLogin } from './uubtBrowserAuth.main.ts';
import type { UubtCredentials } from './uubtSettings.main.ts';

/**
 * Token pro běžné volání uuApp API. Když kódy nestačí (2FA / chybí relace),
 * jednou otevře systémový prohlížeč a po úspěchu zopakuje získání tokenu.
 */
export async function getUubtTokenWithInteractiveLogin(
  options: Readonly<{
    credentials?: UubtCredentials;
    forceRefresh?: boolean;
  }> = {}
): Promise<UubtToken> {
  try {
    return await getUubtToken(options);
  } catch (error) {
    if (!isUubtInteractiveLoginRequiredError(error)) {
      throw error;
    }
    await runUubtBrowserLogin();
    const { clearUubtCalendarCache } = await import('./uubtCalendar.main.ts');
    clearUubtCalendarCache();
    // Bez forceRefresh — token z právě dokončeného loginu je v cache a uuOIDC
    // nemusí k unregistered klientovi vydat refresh token.
    return await getUubtToken({ credentials: options.credentials });
  }
}
