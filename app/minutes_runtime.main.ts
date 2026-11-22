// minutes fork - default config profile for packaged builds and local dev.
import { app } from 'electron';

import { resolveMinutesConfigEnv } from '../ts/minutes/configEnv.std.ts';

export function applyMinutesConfigEnv(): void {
  process.env.NODE_CONFIG_ENV = resolveMinutesConfigEnv({
    isPackaged: app.isPackaged,
    currentValue: process.env.NODE_CONFIG_ENV,
  });
}

// minutes-beta uses the same runtime defaults as minutes (separate data dir at runtime).
applyMinutesConfigEnv();
