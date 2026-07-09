// Copyright 2026 uuMinutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { app, BrowserWindow } from 'electron';

import { createLogger } from '../ts/logging/log.std.ts';
import { initializeUuMinutesChannel } from './uuminutes_channel.main.ts';
import { runCallPipelineTest } from '../ts/uuminutes/testCallPipeline.main.ts';

const log = createLogger('uuminutes/testPipeline');

export async function runTestPipelineFromMain(): Promise<void> {
  log.info('call pipeline test started (UUMINUTES_TEST_PIPELINE=1)');

  initializeUuMinutesChannel();

  const code = await runCallPipelineTest({ BrowserWindow });

  log.info(`call pipeline test finished (exit ${code})`);
  app.exit(code);
}
