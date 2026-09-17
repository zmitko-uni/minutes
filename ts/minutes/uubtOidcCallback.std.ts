// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

export type OidcCallbackParseResult =
  | Readonly<{ ok: true; code: string }>
  | Readonly<{ ok: false; reason: string }>;

export function isLoopbackRemoteAddress(
  remoteAddress: string | undefined
): boolean {
  return remoteAddress === '127.0.0.1' || remoteAddress === '::1';
}

export function parseOidcCallbackRequest(
  requestUrl: string,
  expectedPath: string,
  expectedState: string
): OidcCallbackParseResult {
  let parsed: URL;
  try {
    parsed = new URL(requestUrl, 'http://127.0.0.1');
  } catch {
    return { ok: false, reason: 'Neplatná callback URL' };
  }

  if (parsed.pathname !== expectedPath) {
    return { ok: false, reason: 'Neplatná callback cesta' };
  }

  const error = parsed.searchParams.get('error');
  if (error) {
    return { ok: false, reason: `Přihlášení zrušeno (${error})` };
  }

  const state = parsed.searchParams.get('state');
  if (!state || state !== expectedState) {
    return { ok: false, reason: 'Neplatný parametr state' };
  }

  const code = parsed.searchParams.get('code');
  if (!code || code.trim().length === 0) {
    return { ok: false, reason: 'Chybí autorizační kód' };
  }

  return { ok: true, code };
}

export function buildAuthorizationUrl(
  authorizationEndpoint: string,
  params: Readonly<{
    redirectUri: string;
    clientId: string;
    scope: string;
    state: string;
    nonce: string;
    codeChallenge: string;
  }>
): string {
  const url = new URL(authorizationEndpoint);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('client_id', params.clientId);
  url.searchParams.set('scope', params.scope);
  url.searchParams.set('state', params.state);
  url.searchParams.set('nonce', params.nonce);
  url.searchParams.set('code_challenge', params.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

/** Text jako v uu_appg01_oidc OAuthCode po úspěšném callbacku. */
export const UUBT_AUTHORIZATION_CODE_ACCEPTED_MESSAGE =
  'Access Token Code accepted by Client.';

/**
 * Stránka showAuthorizationCode si `clientId` dohledává v registru uuOIDC
 * klientů. Náhodné id unregistered klienta by vypsala surové, na název
 * aplikace nic nenajde a pole „Klient:“ nechá prázdné — to je čitelnější.
 */
export const UUBT_AUTHORIZATION_CODE_CLIENT_LABEL = 'Minutes';

export type AuthorizationCodeInfoPageParams = Readonly<{
  clientLabel?: string;
  code?: string;
  error?: string;
  message?: string;
}>;

export function buildAuthorizationCodeInfoPageUrl(
  infoPageUri: string,
  params: AuthorizationCodeInfoPageParams
): string {
  const url = new URL(infoPageUri);
  if (params.code) {
    url.searchParams.set('code', params.code);
  }
  if (params.error) {
    url.searchParams.set('error', params.error);
  }
  url.searchParams.set(
    'clientId',
    params.clientLabel ?? UUBT_AUTHORIZATION_CODE_CLIENT_LABEL
  );
  if (params.code && !params.error) {
    url.searchParams.set(
      'message',
      params.message ?? UUBT_AUTHORIZATION_CODE_ACCEPTED_MESSAGE
    );
    url.searchParams.set('close_page', 'now');
  } else if (params.message) {
    url.searchParams.set('message', params.message);
  }
  return url.toString();
}
