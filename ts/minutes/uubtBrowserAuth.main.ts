// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { createServer, type Server } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';

import { BrowserWindow, dialog, shell } from 'electron';

import { createLogger } from '../logging/log.std.ts';
import {
  resolveAuthorizationCodeInfoPageUri,
  UUBT_REQUEST_TIMEOUT_MS,
} from './uubt.std.ts';
import {
  buildAuthorizationCodeInfoPageUrl,
  buildAuthorizationUrl,
  isLoopbackRemoteAddress,
  parseOidcCallbackRequest,
  type AuthorizationCodeInfoPageParams,
} from './uubtOidcCallback.std.ts';
import { pkceChallengeFromVerifier, randomUrlSafeString } from './uubtOidcPkce.std.ts';
import {
  clearUubtJwksCache,
  verifyUubtIdToken,
} from './uubtOidcJwt.main.ts';
import {
  clearBrowserSession,
  getOidcClientCredentials,
  getOidcBaseUri,
  saveBrowserSession,
} from './uubtSettings.main.ts';
import { primeUubtTokenAfterBrowserLogin } from './uubtAuth.main.ts';
import { clearUubtTokenCache } from './uubtTokenCache.main.ts';

const log = createLogger('minutes/uubtBrowserAuth');

const BROWSER_LOGIN_TIMEOUT_MS = 180_000;
const CALLBACK_SCOPE = 'openid https offline_access';

type OidcDiscovery = Readonly<{
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  code_challenge_methods_supported?: ReadonlyArray<string>;
}>;

type ActiveBrowserLogin = Readonly<{
  abort: AbortController;
  server: Server;
  timeout: NodeJS.Timeout;
}>;

let activeLogin: ActiveBrowserLogin | null = null;

/**
 * Celé přihlášení včetně potvrzovacího dialogu je single-flight. Vizitky
 * načítají fotku pro každý výsledek zvlášť, takže bez sdílené promisy by se
 * dialog otevřel pro každý paralelní požadavek.
 */
let loginInFlight: Promise<void> | null = null;

function assertHttpsUrl(value: string, label: string): void {
  const url = new URL(value);
  if (url.protocol !== 'https:') {
    throw new Error(`${label} musí používat HTTPS`);
  }
}

async function fetchDiscovery(oidcBaseUri: string): Promise<OidcDiscovery> {
  const discoveryUrl = `${oidcBaseUri.replace(/\/+$/, '')}/.well-known/openid-configuration`;
  const response = await fetch(discoveryUrl, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(UUBT_REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`OIDC discovery vrátil chybu ${response.status}`);
  }
  const metadata = (await response.json()) as OidcDiscovery;
  if (!metadata.issuer || !metadata.authorization_endpoint || !metadata.token_endpoint || !metadata.jwks_uri) {
    throw new Error('OIDC discovery neobsahuje povinné endpointy');
  }
  assertHttpsUrl(metadata.issuer, 'issuer');
  assertHttpsUrl(metadata.authorization_endpoint, 'authorization_endpoint');
  assertHttpsUrl(metadata.token_endpoint, 'token_endpoint');
  assertHttpsUrl(metadata.jwks_uri, 'jwks_uri');
  const pkce = metadata.code_challenge_methods_supported ?? [];
  if (!pkce.includes('S256')) {
    throw new Error('uuOIDC nepodporuje PKCE S256');
  }
  return metadata;
}

function basicAuthHeader(clientId: string, clientSecret: string): string {
  const username = encodeURIComponent(clientId);
  return `Basic ${Buffer.from(`${username}:${clientSecret}`, 'utf8').toString('base64')}`;
}

async function exchangeAuthorizationCode(
  discovery: OidcDiscovery,
  options: Readonly<{
    code: string;
    redirectUri: string;
    codeVerifier: string;
    clientId: string;
    clientSecret: string;
  }>
): Promise<Record<string, unknown>> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: options.code,
    redirect_uri: options.redirectUri,
    client_id: options.clientId,
    code_verifier: options.codeVerifier,
    scope: CALLBACK_SCOPE,
  });

  const response = await fetch(discovery.token_endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      Authorization: basicAuthHeader(options.clientId, options.clientSecret),
    },
    body: body.toString(),
    signal: AbortSignal.timeout(UUBT_REQUEST_TIMEOUT_MS),
  });

  const text = await response.text();
  if (!response.ok) {
    log.warn(`uubt browser token exchange failed status=${response.status}`);
    throw new Error(
      `Výměna autorizačního kódu selhala (HTTP ${response.status})`
    );
  }

  return JSON.parse(text) as Record<string, unknown>;
}

function maskIdentityFromClaims(claims: Record<string, unknown>): string {
  const name = typeof claims.name === 'string' ? claims.name.trim() : '';
  if (name.length > 0) {
    return name.length > 40 ? `${name.slice(0, 37)}…` : name;
  }
  const sub = typeof claims.sub === 'string' ? claims.sub : 'Plus4U';
  return sub.length > 24 ? `${sub.slice(0, 21)}…` : sub;
}

function sendAuthorizationCodeInfoRedirect(
  response: ServerResponse,
  infoPageUri: string,
  params: AuthorizationCodeInfoPageParams
): void {
  response.writeHead(302, {
    Location: buildAuthorizationCodeInfoPageUrl(infoPageUri, params),
  });
  response.end();
}

function cleanupActiveLogin(): void {
  if (!activeLogin) {
    return;
  }
  clearTimeout(activeLogin.timeout);
  activeLogin.server.close();
  activeLogin = null;
}

export function cancelUubtBrowserLogin(): void {
  if (!activeLogin) {
    return;
  }
  activeLogin.abort.abort();
  cleanupActiveLogin();
}

export async function logoutUubtBrowserSession(): Promise<void> {
  cancelUubtBrowserLogin();
  await clearBrowserSession();
  clearUubtTokenCache();
  clearUubtJwksCache();
}

/**
 * Prohlížeč se otevírá i automaticky (vizitky, schůzky), takže se uživatele
 * nejdřív zeptáme — jinak by mu okno vyskočilo bez vysvětlení.
 */
async function confirmBrowserLogin(): Promise<boolean> {
  const options = {
    type: 'question' as const,
    buttons: ['Otevřít prohlížeč', 'Zrušit'],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
    title: 'Přihlášení do Plus4U',
    message: 'Otevřít přihlášení do Plus4U v prohlížeči?',
    detail:
      'Minutes nemá platnou relaci Plus4U. Přihlášení proběhne v systémovém prohlížeči včetně druhého faktoru; pak se vraťte do Minutes.',
  };

  const parent =
    BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  const { response } = parent
    ? await dialog.showMessageBox(parent, options)
    : await dialog.showMessageBox(options);

  return response === 0;
}

export function runUubtBrowserLogin(): Promise<void> {
  if (loginInFlight) {
    return loginInFlight;
  }
  loginInFlight = performBrowserLogin().finally(() => {
    loginInFlight = null;
  });
  return loginInFlight;
}

async function performBrowserLogin(): Promise<void> {
  if (!(await confirmBrowserLogin())) {
    log.info('uubt browser login declined by user');
    throw new Error('Přihlášení do Plus4U bylo zrušeno.');
  }

  const oidcBaseUri = await getOidcBaseUri();
  const { clientId, clientSecret } = await getOidcClientCredentials();
  const discovery = await fetchDiscovery(oidcBaseUri);
  const authorizationCodeInfoPageUri =
    resolveAuthorizationCodeInfoPageUri(oidcBaseUri);

  const state = randomUrlSafeString(24);
  const nonce = randomUrlSafeString(24);
  const codeVerifier = randomUrlSafeString(48);
  const codeChallenge = pkceChallengeFromVerifier(codeVerifier);
  const callbackPath = `/minutes-oidc/${randomUrlSafeString(16)}`;

  const abort = new AbortController();

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error): void => {
      if (settled) {
        return;
      }
      settled = true;
      cleanupActiveLogin();
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };

    const server = createServer((request: IncomingMessage, response: ServerResponse) => {
      void (async () => {
        if (request.method !== 'GET') {
          sendAuthorizationCodeInfoRedirect(
            response,
            authorizationCodeInfoPageUri,
            { error: 'Invalid callback HTTP method.' }
          );
          finish(new Error('Callback přijal neplatnou metodu'));
          return;
        }

        if (!isLoopbackRemoteAddress(request.socket.remoteAddress)) {
          sendAuthorizationCodeInfoRedirect(
            response,
            authorizationCodeInfoPageUri,
            { error: 'Callback was not received from loopback.' }
          );
          finish(new Error('Callback nepřijat z lokálního rozhraní'));
          return;
        }

        const host = request.headers.host ?? '';
        const port = server.address();
        const expectedPort =
          port && typeof port === 'object' ? String(port.port) : '';
        if (
          expectedPort.length > 0 &&
          host !== `127.0.0.1:${expectedPort}` &&
          host !== `localhost:${expectedPort}`
        ) {
          sendAuthorizationCodeInfoRedirect(
            response,
            authorizationCodeInfoPageUri,
            { error: 'Invalid callback Host header.' }
          );
          finish(new Error('Neplatná hlavička Host'));
          return;
        }

        const parsed = parseOidcCallbackRequest(
          request.url ?? '/',
          callbackPath,
          state
        );
        if (!parsed.ok) {
          sendAuthorizationCodeInfoRedirect(
            response,
            authorizationCodeInfoPageUri,
            { error: parsed.reason }
          );
          finish(new Error(parsed.reason));
          return;
        }

        try {
          const tokenBody = await exchangeAuthorizationCode(discovery, {
            code: parsed.code,
            redirectUri: `http://127.0.0.1:${expectedPort}${callbackPath}`,
            codeVerifier,
            clientId,
            clientSecret,
          });

          const idToken = tokenBody.id_token;
          if (typeof idToken !== 'string' || idToken.length === 0) {
            throw new Error('Token endpoint nevrátil id_token');
          }

          const claims = await verifyUubtIdToken(idToken, {
            jwksUri: discovery.jwks_uri,
            issuer: discovery.issuer,
            clientId,
            nonce,
          });

          const refreshToken = tokenBody.refresh_token;
          if (typeof refreshToken !== 'string' || refreshToken.length === 0) {
            log.warn('uubt browser login: refresh_token nebyl vydán');
          }

          await saveBrowserSession({
            refreshToken:
              typeof refreshToken === 'string' ? refreshToken : null,
            identityMasked: maskIdentityFromClaims(claims),
          });
          await primeUubtTokenAfterBrowserLogin(
            idToken,
            tokenBody.expires_in
          );
          sendAuthorizationCodeInfoRedirect(
            response,
            authorizationCodeInfoPageUri,
            { code: parsed.code }
          );
          log.info('uubt browser login completed');
          finish();
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          sendAuthorizationCodeInfoRedirect(
            response,
            authorizationCodeInfoPageUri,
            { error: message }
          );
          finish(
            error instanceof Error
              ? error
              : new Error(String(error))
          );
        }
      })();
    });

    const timeout = setTimeout(() => {
      abort.abort();
      finish(
        new Error(
          'Čas pro přihlášení vypršel — dokončete 2FA v prohlížeči a zkuste to znovu.'
        )
      );
    }, BROWSER_LOGIN_TIMEOUT_MS);

    abort.signal.addEventListener('abort', () => {
      finish(new Error('Přihlášení přes prohlížeč bylo zrušeno'));
    });

    server.once('error', error => {
      finish(error instanceof Error ? error : new Error(String(error)));
    });

    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        finish(new Error('Callback server nemá TCP port'));
        return;
      }

      const redirectUri = `http://127.0.0.1:${address.port}${callbackPath}`;
      const authorizeUrl = buildAuthorizationUrl(discovery.authorization_endpoint, {
        redirectUri,
        clientId,
        scope: CALLBACK_SCOPE,
        state,
        nonce,
        codeChallenge,
      });

      activeLogin = { abort, server, timeout };

      shell.openExternal(authorizeUrl).catch(error => {
        finish(
          error instanceof Error
            ? error
            : new Error(String(error))
        );
      });
    });
  });
}
