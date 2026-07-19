// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only
//
// afterPack hook for the unsigned / ad-hoc Minutes macOS build.
//
// Signal's afterPack (scripts/after-pack.mjs) flips Electron fuses, which
// rewrites the main binary and invalidates its (linker-generated) code
// signature. Because Minutes packages with `identity: null`, electron-builder
// then SKIPS its own signing step, leaving the fuse-modified binary with a
// stale signature. On Apple Silicon macOS refuses to launch such a process,
// killing it at startup with "Code Signature Invalid" (EXC_BAD_ACCESS /
// SIGKILL inside electron::fuses::IsRunAsNodeEnabled).
//
// Fix: after the upstream afterPack runs, re-sign the whole bundle ad-hoc.
// hardenedRuntime is disabled in electron-builder.minutes.mjs (it gives no
// benefit without notarization and only restricts capabilities), so no
// entitlements are required — microphone and screen-recording access is
// governed by TCC via the Info.plist usage strings.
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { afterPack as signalAfterPack } from './after-pack.mjs';

/** @import { AfterPackContext } from 'electron-builder' */

/**
 * @param {AfterPackContext} context
 * @returns {Promise<void>}
 */
export async function afterPack(context) {
  await signalAfterPack(context);

  if (context.electronPlatformName !== 'darwin') {
    return;
  }

  const appPath = join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`
  );

  console.log(`[minutes] ad-hoc signing ${appPath}`);
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], {
    stdio: 'inherit',
  });
  execFileSync('codesign', ['--verify', '--deep', '--strict', appPath], {
    stdio: 'inherit',
  });
}
