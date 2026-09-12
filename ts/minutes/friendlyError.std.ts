// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Převod technických chyb (IPC, HTTP od poskytovatelů AI, chyby souborů) na
 * hlášky, které uživateli řeknou co se stalo a co s tím. Původní text se
 * nezahazuje — zůstává v `detail` pro log a rozbalovací podrobnosti.
 */
export type FriendlyError = Readonly<{
  /** Krátký titulek — vejde se do řádku seznamu. */
  title: string;
  /** Jedna věta: co se stalo a co má uživatel udělat. */
  message: string;
  /** Původní technický text, pokud se od `message` liší. */
  detail: string | null;
}>;

type ErrorPattern = Readonly<{
  pattern: RegExp;
  title: string;
  message: string;
}>;

const PATTERNS: ReadonlyArray<ErrorPattern> = [
  {
    pattern: /exceeded your current quota|insufficient_quota|billing details/i,
    title: 'Vyčerpaný kredit u poskytovatele AI',
    message:
      'Poskytovatel požadavek odmítl — máte vyčerpaný kredit nebo limit plánu. Doplňte kredit u poskytovatele a zkuste to znovu. API klíč je v pořádku.',
  },
  {
    pattern: /rate limit|too many requests|\b429\b/i,
    title: 'Poskytovatel AI odmítá další požadavky',
    message:
      'Překročili jste povolený počet požadavků za minutu. Zkuste to za chvíli znovu.',
  },
  {
    pattern:
      /invalid_api_key|incorrect api key|api key not valid|unauthorized|\b401\b/i,
    title: 'Neplatný API klíč',
    message:
      'Poskytovatel klíč nepřijal. Zkontrolujte ho v Nastavení AI u zvoleného poskytovatele.',
  },
  {
    pattern:
      /no longer available to new users|is deprecated|has been shut down|model_not_found|model .* does not exist/i,
    title: 'Model už není dostupný',
    message:
      'Poskytovatel tento model vypnul. Zvolte v Nastavení AI jiný model a uložte nastavení.',
  },
  {
    pattern:
      /ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|fetch failed|socket hang up/i,
    title: 'Nepodařilo se připojit',
    message:
      'Server poskytovatele neodpověděl. Zkontrolujte internetové připojení nebo firewall a zkuste to znovu.',
  },
  {
    pattern: /ENOSPC/i,
    title: 'Na disku není místo',
    message: 'Uvolněte místo na disku s nahrávkami a spusťte akci znovu.',
  },
  {
    pattern: /ENOENT|no such file/i,
    title: 'Soubor chybí',
    message:
      'Nahrávka nebo její pomocný soubor už na disku není — mohl být přesunutý nebo smazaný.',
  },
  {
    pattern: /EACCES|EPERM|operation not permitted/i,
    title: 'Chybí oprávnění k souboru',
    message:
      'Systém odepřel přístup k souboru. Zkontrolujte oprávnění složky s nahrávkami, případně antivirus.',
  },
];

/** Uživatele nezajímá, že chyba přišla přes IPC z main procesu. */
export function stripTechnicalPrefixes(raw: string): string {
  let message = raw.trim();
  let previous = '';

  while (message !== previous) {
    previous = message;
    message = message
      .replace(/^Error invoking remote method\s+'[^']*':\s*/i, '')
      .replace(/^(?:Error|Chyba):\s*/i, '')
      .trim();
  }

  return message;
}

function toRawMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return '';
}

export function toFriendlyError(error: unknown): FriendlyError {
  const raw = stripTechnicalPrefixes(toRawMessage(error));
  const match = PATTERNS.find(entry => entry.pattern.test(raw));

  if (match == null) {
    return {
      title: 'Něco se nepovedlo',
      message: raw.length > 0 ? raw : 'Akci se nepodařilo dokončit.',
      detail: null,
    };
  }

  return {
    title: match.title,
    message: match.message,
    detail: raw.length > 0 ? raw : null,
  };
}

/** Jednořádková hláška do stavových lišt a toastů. */
export function formatUserFacingError(error: unknown): string {
  return toFriendlyError(error).message;
}
