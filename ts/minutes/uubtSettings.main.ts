// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { app, safeStorage } from 'electron';

import { createLogger } from '../logging/log.std.ts';
import {
  AI_SETTINGS_DIR_NAME,
  UUBT_SETTINGS_FILE_NAME,
} from './constants.std.ts';
import type { UubtSettingsPublic, UubtSettingsSaveInput } from './uubt.std.ts';
import {
  DEFAULT_UUBT_SETTINGS,
  UUBT_DEFAULT_OIDC_BASE_URI,
} from './uubt.std.ts';

const log = createLogger('minutes/uubtSettings');

type StoredUubtSettings = {
  enabled: boolean;
  oidcBaseUri: string;
  encryptedAccessCode1?: string;
  encryptedAccessCode2?: string;
};

export type UubtCredentials = Readonly<{
  accessCode1: string;
  accessCode2: string;
  oidcBaseUri: string;
}>;

function getSettingsPath(): string {
  return join(
    app.getPath('userData'),
    AI_SETTINGS_DIR_NAME,
    UUBT_SETTINGS_FILE_NAME
  );
}

function encryptSecret(value: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(value).toString('hex');
  }
  log.warn('safeStorage unavailable; storing access code with base64 encoding');
  return `b64:${Buffer.from(value, 'utf8').toString('base64')}`;
}

function decryptSecret(encrypted: string): string {
  if (encrypted.startsWith('b64:')) {
    return Buffer.from(encrypted.slice(4), 'base64').toString('utf8');
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Bez safeStorage nelze přístupové kódy rozšifrovat');
  }
  return safeStorage.decryptString(Buffer.from(encrypted, 'hex'));
}

function tryDecryptSecret(encrypted: string | undefined): string | null {
  if (!encrypted) {
    return null;
  }
  try {
    const value = decryptSecret(encrypted);
    return value.length > 0 ? value : null;
  } catch (error) {
    log.warn(`uubt: cannot decrypt stored access code: ${String(error)}`);
    return null;
  }
}

function maskAccessCode1(value: string): string {
  const at = value.indexOf('@');
  if (at > 0) {
    const name = value.slice(0, at);
    const visible = name.slice(0, Math.min(3, name.length));
    return `${visible}••••${value.slice(at)}`;
  }
  if (value.length <= 4) {
    return '••••';
  }
  return `${value.slice(0, 2)}••••${value.slice(-2)}`;
}

function normalizeOidcBaseUri(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return UUBT_DEFAULT_OIDC_BASE_URI;
  }
  return value.trim().replace(/\/+$/, '');
}

async function readStoredSettings(): Promise<StoredUubtSettings> {
  try {
    const raw = await readFile(getSettingsPath(), 'utf8');
    const parsed = JSON.parse(raw) as Partial<StoredUubtSettings>;
    return {
      enabled: Boolean(parsed.enabled),
      oidcBaseUri: normalizeOidcBaseUri(parsed.oidcBaseUri),
      encryptedAccessCode1: parsed.encryptedAccessCode1,
      encryptedAccessCode2: parsed.encryptedAccessCode2,
    };
  } catch {
    return {
      enabled: false,
      oidcBaseUri: UUBT_DEFAULT_OIDC_BASE_URI,
    };
  }
}

async function writeStoredSettings(stored: StoredUubtSettings): Promise<void> {
  await mkdir(join(app.getPath('userData'), AI_SETTINGS_DIR_NAME), {
    recursive: true,
  });
  await writeFile(getSettingsPath(), JSON.stringify(stored, null, 2), 'utf8');
}

function toPublicSettings(stored: StoredUubtSettings): UubtSettingsPublic {
  const accessCode1 = tryDecryptSecret(stored.encryptedAccessCode1);
  const accessCode2 = tryDecryptSecret(stored.encryptedAccessCode2);

  return {
    enabled: stored.enabled,
    hasCredentials: accessCode1 != null && accessCode2 != null,
    accessCode1Masked: accessCode1 ? maskAccessCode1(accessCode1) : null,
    oidcBaseUri: stored.oidcBaseUri,
  };
}

export async function getUubtSettingsPublic(): Promise<UubtSettingsPublic> {
  try {
    return toPublicSettings(await readStoredSettings());
  } catch (error) {
    log.warn(`uubt: cannot read settings: ${String(error)}`);
    return DEFAULT_UUBT_SETTINGS;
  }
}

/** Přihlašovací údaje pro uuOIDC, nebo null když nejsou kompletní. */
export async function getUubtCredentials(): Promise<UubtCredentials | null> {
  const stored = await readStoredSettings();
  const accessCode1 = tryDecryptSecret(stored.encryptedAccessCode1);
  const accessCode2 = tryDecryptSecret(stored.encryptedAccessCode2);

  if (!accessCode1 || !accessCode2) {
    return null;
  }

  return {
    accessCode1,
    accessCode2,
    oidcBaseUri: stored.oidcBaseUri,
  };
}

export async function isUubtEnabled(): Promise<boolean> {
  const settings = await getUubtSettingsPublic();
  return settings.enabled && settings.hasCredentials;
}

function applySecretUpdate(
  current: string | undefined,
  next: string | undefined
): string | undefined {
  if (next === undefined) {
    return current;
  }
  const trimmed = next.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  return encryptSecret(trimmed);
}

export async function saveUubtSettings(
  input: UubtSettingsSaveInput
): Promise<UubtSettingsPublic> {
  const stored = await readStoredSettings();

  const next: StoredUubtSettings = {
    enabled: input.enabled,
    oidcBaseUri:
      input.oidcBaseUri === undefined
        ? stored.oidcBaseUri
        : normalizeOidcBaseUri(input.oidcBaseUri),
    encryptedAccessCode1: applySecretUpdate(
      stored.encryptedAccessCode1,
      input.accessCode1
    ),
    encryptedAccessCode2: applySecretUpdate(
      stored.encryptedAccessCode2,
      input.accessCode2
    ),
  };

  await writeStoredSettings(next);
  log.info(
    `uubt settings saved (enabled=${next.enabled}, hasCredentials=${
      next.encryptedAccessCode1 != null && next.encryptedAccessCode2 != null
    })`
  );

  return toPublicSettings(next);
}
