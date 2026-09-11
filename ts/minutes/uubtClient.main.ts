// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../logging/log.std.ts';
import { UUBT_REQUEST_TIMEOUT_MS } from './uubt.std.ts';
import { getUubtToken } from './uubtAuth.main.ts';

const log = createLogger('minutes/uubtClient');

export class UubtApiError extends Error {
  readonly status: number;

  readonly errorCodes: ReadonlyArray<string>;

  readonly body: unknown;

  constructor(
    message: string,
    options: Readonly<{
      status: number;
      errorCodes: ReadonlyArray<string>;
      body: unknown;
    }>
  ) {
    super(message);
    this.name = 'UubtApiError';
    this.status = options.status;
    this.errorCodes = options.errorCodes;
    this.body = options.body;
  }

  /** uuApp nezná tento uuCmd — zkusíme jiný název příkazu. */
  get isUnsupportedCommand(): boolean {
    return (
      this.status === 404 ||
      this.errorCodes.some(code =>
        /unsupportedUseCase|notSupported/i.test(code)
      )
    );
  }

  get isInvalidDtoIn(): boolean {
    return this.errorCodes.some(code => /invalidDtoIn/i.test(code));
  }
}

type UuAppErrorEntry = Readonly<{
  type?: string;
  message?: string;
  paramMap?: unknown;
}>;

function collectErrors(
  body: unknown
): Array<{ code: string; entry: UuAppErrorEntry }> {
  if (!body || typeof body !== 'object') {
    return [];
  }
  const map = (body as Record<string, unknown>).uuAppErrorMap;
  if (!map || typeof map !== 'object') {
    return [];
  }

  return Object.entries(map as Record<string, UuAppErrorEntry>)
    .filter(([, entry]) => (entry?.type ?? 'error') === 'error')
    .map(([code, entry]) => ({ code, entry }));
}

function describeApiFailure(
  status: number,
  body: unknown,
  url: string
): string {
  const errors = collectErrors(body);
  const first = errors[0];
  if (first) {
    const detail = first.entry.message?.trim();
    return detail
      ? `${detail} (${first.code})`
      : `uuApp vrátil chybu ${first.code}`;
  }

  if (status === 401) {
    return 'uuBT odmítl token (401). Zkuste znovu uložit přístupové kódy v Nastavení AI.';
  }
  if (status === 403) {
    return 'K tomuto artefaktu v uuBT nemáte oprávnění (403).';
  }

  return `uuApp ${new URL(url).pathname} vrátil chybu ${status}`;
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.trim().length === 0) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

async function call<T>(
  url: string,
  init: Readonly<{ method: 'GET' | 'POST'; dtoIn?: unknown }>,
  attempt = 0
): Promise<T> {
  const { token } = await getUubtToken({ forceRefresh: attempt > 0 });

  let response: Response;
  try {
    response = await fetch(url, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(init.method === 'POST'
          ? { 'Content-Type': 'application/json' }
          : {}),
      },
      body:
        init.method === 'POST' ? JSON.stringify(init.dtoIn ?? {}) : undefined,
      signal: AbortSignal.timeout(UUBT_REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new Error(`Volání uuBT selhalo (${url}): ${String(error)}`);
  }

  const body = await parseBody(response);

  if (response.status === 401 && attempt === 0) {
    log.warn('uubt: 401, refreshing token and retrying once');
    return call<T>(url, init, attempt + 1);
  }

  if (!response.ok) {
    throw new UubtApiError(describeApiFailure(response.status, body, url), {
      status: response.status,
      errorCodes: collectErrors(body).map(item => item.code),
      body,
    });
  }

  return body as T;
}

export async function uubtGet<T>(
  baseUri: string,
  useCase: string,
  params: Readonly<Record<string, string | number | undefined>> = {}
): Promise<T> {
  const url = new URL(`${baseUri.replace(/\/+$/, '')}/${useCase}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }
  return call<T>(url.toString(), { method: 'GET' });
}

export async function uubtPost<T>(
  baseUri: string,
  useCase: string,
  dtoIn: unknown
): Promise<T> {
  const url = `${baseUri.replace(/\/+$/, '')}/${useCase}`;
  return call<T>(url, { method: 'POST', dtoIn });
}

/** Seznam uuCmd, které daná instance uuApp podporuje. */
export async function uubtListUseCases(
  baseUri: string
): Promise<ReadonlyArray<string>> {
  const response = await uubtGet<unknown>(baseUri, 'sys/getUseCases');
  const found = new Set<string>();

  const visit = (value: unknown): void => {
    if (typeof value === 'string') {
      if (/^[a-zA-Z][\w-]*(\/[\w-]+)+$/.test(value)) {
        found.add(value);
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (value && typeof value === 'object') {
      for (const [key, nested] of Object.entries(
        value as Record<string, unknown>
      )) {
        if (/^[a-zA-Z][\w-]*(\/[\w-]+)+$/.test(key)) {
          found.add(key);
        }
        visit(nested);
      }
    }
  };

  visit(response);
  return [...found].sort();
}
