// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import {
  createPublicKey,
  createVerify,
  type KeyObject,
} from 'node:crypto';

import { UUBT_REQUEST_TIMEOUT_MS } from './uubt.std.ts';

type JwksKey = Readonly<{
  kid?: string;
  kty?: string;
  n?: string;
  e?: string;
  alg?: string;
  use?: string;
}>;

type JwksDocument = Readonly<{
  keys?: ReadonlyArray<JwksKey>;
}>;

const JWT_PARTS = /^[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/;
const CLOCK_SKEW_SEC = 120;

let cachedJwksUri: string | null = null;
let cachedKeys: ReadonlyArray<JwksKey> | null = null;

function decodeJwtPart(part: string): Record<string, unknown> {
  const normalized = part.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    '='
  );
  return JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as Record<
    string,
    unknown
  >;
}

function keyObjectFromRsaJwk(jwk: JwksKey): KeyObject {
  if (jwk.kty !== 'RSA' || !jwk.n || !jwk.e) {
    throw new Error('JWKS neobsahuje podporovaný RSA klíč');
  }
  return createPublicKey({
    key: { kty: 'RSA', n: jwk.n, e: jwk.e },
    format: 'jwk',
  });
}

async function loadJwks(jwksUri: string): Promise<ReadonlyArray<JwksKey>> {
  if (cachedJwksUri === jwksUri && cachedKeys) {
    return cachedKeys;
  }
  const response = await fetch(jwksUri, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(UUBT_REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`JWKS endpoint vrátil chybu ${response.status}`);
  }
  const document = (await response.json()) as JwksDocument;
  const keys = document.keys ?? [];
  if (keys.length === 0) {
    throw new Error('JWKS neobsahuje žádné klíče');
  }
  cachedJwksUri = jwksUri;
  cachedKeys = keys;
  return keys;
}

function audienceMatches(
  aud: unknown,
  clientId: string
): boolean {
  if (typeof aud === 'string') {
    return aud === clientId;
  }
  if (Array.isArray(aud)) {
    return aud.some(item => item === clientId);
  }
  return false;
}

export async function verifyUubtIdToken(
  idToken: string,
  options: Readonly<{
    jwksUri: string;
    issuer: string;
    clientId: string;
    nonce?: string;
  }>
): Promise<Record<string, unknown>> {
  if (!JWT_PARTS.test(idToken)) {
    throw new Error('ID token má neočekávaný formát');
  }

  const parts = idToken.split('.');
  const headerPart = parts[0];
  const payloadPart = parts[1];
  const signaturePart = parts[2];
  if (!headerPart || !payloadPart || !signaturePart) {
    throw new Error('ID token má neočekávaný formát');
  }
  const header = decodeJwtPart(headerPart);
  const claims = decodeJwtPart(payloadPart);

  if (header.alg !== 'RS256') {
    throw new Error('ID token má nepodporovaný algoritmus');
  }

  const kid = typeof header.kid === 'string' ? header.kid : undefined;
  const keys = await loadJwks(options.jwksUri);
  const jwk =
    (kid ? keys.find(key => key.kid === kid) : undefined) ??
    keys.find(key => key.use === 'sig') ??
    keys[0];

  if (!jwk) {
    throw new Error('V JWKS nebyl nalezen podpisový klíč');
  }

  const keyObject = keyObjectFromRsaJwk(jwk);
  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${headerPart}.${payloadPart}`);
  verifier.end();
  const signature = Buffer.from(
    signaturePart.replace(/-/g, '+').replace(/_/g, '/'),
    'base64'
  );
  if (!verifier.verify(keyObject, signature)) {
    throw new Error('Podpis ID tokenu je neplatný');
  }

  if (claims.iss !== options.issuer) {
    throw new Error('ID token má neplatného vydavatele');
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const exp = typeof claims.exp === 'number' ? claims.exp : null;
  const iat = typeof claims.iat === 'number' ? claims.iat : null;
  if (exp != null && nowSec > exp + CLOCK_SKEW_SEC) {
    throw new Error('ID token vypršel');
  }
  if (iat != null && iat > nowSec + CLOCK_SKEW_SEC) {
    throw new Error('ID token má neplatné vydání');
  }

  const audOk =
    audienceMatches(claims.aud, options.clientId) ||
    claims.azp === options.clientId;
  if (!audOk) {
    throw new Error('ID token není určen tomuto klientu');
  }

  if (options.nonce != null && claims.nonce !== options.nonce) {
    throw new Error('ID token má neplatný nonce');
  }

  return claims;
}

export function clearUubtJwksCache(): void {
  cachedJwksUri = null;
  cachedKeys = null;
}
