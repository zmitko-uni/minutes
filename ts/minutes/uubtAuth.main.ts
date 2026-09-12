// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../logging/log.std.ts';
import { maskUuValueShape, UUBT_REQUEST_TIMEOUT_MS } from './uubt.std.ts';
import type { UubtCredentials } from './uubtSettings.main.ts';
import { getUubtCredentials } from './uubtSettings.main.ts';

const log = createLogger('minutes/uubtAuth');

/** Token se obnoví o něco dřív, než doopravdy vyprší. */
const TOKEN_EXPIRY_SAFETY_MS = 60_000;

export type UubtToken = Readonly<{
  token: string;
  /** První kandidát na uuIdentity — jen pro zobrazení. */
  uuIdentity: string;
  /** Hodnoty z tokenu, které mohou být uuIdentity, v pořadí podle pravděpodobnosti. */
  identityCandidates: ReadonlyArray<string>;
  expiresAt: number;
}>;

type TokenCacheEntry = UubtToken & { cacheKey: string };

let cachedToken: TokenCacheEntry | null = null;

export function clearUubtTokenCache(): void {
  cachedToken = null;
}

function buildCacheKey(credentials: UubtCredentials): string {
  return `${credentials.oidcBaseUri}|${credentials.accessCode1}`;
}

function decodeJwtClaims(token: string): Record<string, unknown> {
  const payload = token.split('.')[1];
  if (!payload) {
    throw new Error('uuOIDC vrátil token v neočekávaném formátu');
  }
  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    '='
  );
  const json = Buffer.from(padded, 'base64').toString('utf8');
  return JSON.parse(json) as Record<string, unknown>;
}

/** uuIdentity je 16 číslic, obvykle po čtveřicích s pomlčkami. */
const UU_IDENTITY_LIKE = /^\d{4}-\d{4}-\d{4}-\d{4}$|^\d{16}$/;

/** Claimy, které uuOIDC instance používají pro uuIdentity (lowercase). */
const IDENTITY_CLAIM_NAMES = [
  'uuidentity',
  'uu_identity',
  'uuidentityname',
  'identity',
  'preferred_username',
  'uid',
  'sub',
];

/**
 * Název claimu s uuIdentity se mezi instancemi uuOIDC liší, proto bereme
 * všechny hodnoty, které jako uuIdentity vypadají, a až pak známé názvy.
 */
function resolveIdentityCandidates(
  claims: Record<string, unknown>
): ReadonlyArray<string> {
  const strings = Object.entries(claims)
    .filter(
      (entry): entry is [string, string] =>
        typeof entry[1] === 'string' && entry[1].trim().length > 0
    )
    .map(([key, value]) => [key, value.trim()] as const);

  // Jen názvy claimů, žádné hodnoty — log jde přiložit k hlášení chyby.
  log.info(
    `uubt token claims: [${strings
      .map(([key]) => key)
      .sort()
      .join(', ')}]`
  );

  const ordered: Array<string> = [];
  const add = (value: string): void => {
    if (!ordered.includes(value)) {
      ordered.push(value);
    }
  };

  for (const [, value] of strings) {
    if (UU_IDENTITY_LIKE.test(value)) {
      add(value);
    }
  }
  for (const name of IDENTITY_CLAIM_NAMES) {
    const hit = strings.find(([key]) => key.toLowerCase() === name);
    if (hit) {
      add(hit[1]);
    }
  }

  if (ordered.length === 0) {
    throw new Error('V tokenu z uuOIDC chybí uuIdentity');
  }

  log.info(
    `uubt identity candidates: ${ordered.map(maskUuValueShape).join(', ')}`
  );
  return ordered;
}

function resolveExpiry(
  claims: Record<string, unknown>,
  fallbackSeconds: unknown
): number {
  if (typeof claims.exp === 'number' && Number.isFinite(claims.exp)) {
    return claims.exp * 1000;
  }
  if (typeof fallbackSeconds === 'number' && Number.isFinite(fallbackSeconds)) {
    return Date.now() + fallbackSeconds * 1000;
  }
  return Date.now() + 3_600_000;
}

function extractIdToken(body: string): { idToken: string; raw: unknown } {
  const trimmed = body.trim();

  if (trimmed.startsWith('{')) {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const idToken = parsed.id_token ?? parsed.idToken ?? parsed.access_token;
    if (typeof idToken !== 'string' || idToken.length === 0) {
      throw new Error('uuOIDC nevrátil id_token');
    }
    return { idToken, raw: parsed };
  }

  // Některé instance vrací holý token jako text/plain.
  const bare = trimmed.replace(/^"|"$/g, '');
  if (bare.split('.').length !== 3) {
    throw new Error('uuOIDC nevrátil id_token');
  }
  return { idToken: bare, raw: null };
}

function describeGrantFailure(status: number): string {
  if (status === 400 || status === 401) {
    return 'Přihlášení do uuBT selhalo — zkontrolujte access code 1 a access code 2 v Nastavení AI.';
  }
  if (status === 403) {
    return 'uuOIDC odmítl přihlášení (403). Ověřte, že účet smí používat přihlášení přístupovými kódy.';
  }

  // Tělo odpovědi se úmyslně nepřebírá — může obsahovat údaje o účtu.
  return `uuOIDC vrátil chybu ${status}`;
}

async function requestToken(credentials: UubtCredentials): Promise<UubtToken> {
  const url = `${credentials.oidcBaseUri}/grantToken`;
  const body = new URLSearchParams({
    accessCode1: credentials.accessCode1,
    accessCode2: credentials.accessCode2,
    grant_type: 'password',
    scope: 'openid https',
  });

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
      signal: AbortSignal.timeout(UUBT_REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new Error(
      `Nepodařilo se spojit s uuOIDC (${credentials.oidcBaseUri}): ${String(error)}`
    );
  }

  const text = await response.text();
  if (!response.ok) {
    log.warn(`uubt grantToken failed with status ${response.status}`);
    throw new Error(describeGrantFailure(response.status));
  }

  const { idToken, raw } = extractIdToken(text);
  const claims = decodeJwtClaims(idToken);
  const expiresIn =
    raw && typeof raw === 'object'
      ? (raw as Record<string, unknown>).expires_in
      : undefined;

  const identityCandidates = resolveIdentityCandidates(claims);

  return {
    token: idToken,
    uuIdentity: identityCandidates[0] ?? '',
    identityCandidates,
    expiresAt: resolveExpiry(claims, expiresIn),
  };
}

/**
 * Platný token pro volání uuApp API. Drží se jen v paměti main procesu
 * a obnoví se automaticky před vypršením.
 */
export async function getUubtToken(
  options: Readonly<{
    credentials?: UubtCredentials;
    forceRefresh?: boolean;
  }> = {}
): Promise<UubtToken> {
  const credentials = options.credentials ?? (await getUubtCredentials());
  if (!credentials) {
    throw new Error(
      'uuBT není nastaveno — doplňte access code 1 a 2 v Nastavení AI.'
    );
  }

  const cacheKey = buildCacheKey(credentials);
  if (
    !options.forceRefresh &&
    cachedToken &&
    cachedToken.cacheKey === cacheKey &&
    cachedToken.expiresAt - TOKEN_EXPIRY_SAFETY_MS > Date.now()
  ) {
    return cachedToken;
  }

  const token = await requestToken(credentials);
  cachedToken = { ...token, cacheKey };
  // Bez uuIdentity — log si uživatelé přikládají k hlášení chyb.
  log.info(
    `uubt token obtained, expires ${new Date(token.expiresAt).toISOString()}`
  );
  return token;
}
