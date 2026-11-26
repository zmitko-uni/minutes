// Copyright 2026 Minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type {
  CallSummaryExtensionPublic,
  WhisperGpuAccelerationPublic,
} from './callSummaryExtension.std.ts';
import type { WhisperBackend } from './whisperTranscribeSettings.std.ts';

export type WhisperBackendStatus = Readonly<{ ready: boolean; error?: string }>;

export type WhisperBackendPublic = Readonly<{
  preferred: WhisperBackend;
  effective: WhisperBackend | null;
  node: WhisperBackendStatus;
  cli: WhisperBackendStatus & { executable: string };
  reason: string | null;
}>;

export const DEFAULT_CLI_EXECUTABLE = 'whisper-cli';

export function describeCliMissing(executable: string): string {
  const display = executable === DEFAULT_CLI_EXECUTABLE ? 'PATH' : executable;
  return `whisper-cli nenalezen (${display})`;
}

function describeNodeMissing(node: WhisperBackendStatus): string {
  return `whisper.node není k dispozici: ${node.error ?? 'neznámá chyba'}`;
}

export function resolveWhisperBackend(input: {
  preferred: WhisperBackend;
  node: WhisperBackendStatus;
  cli: WhisperBackendStatus & { executable: string };
}): WhisperBackendPublic {
  const { preferred, node, cli } = input;
  const base = { preferred, node, cli };

  if (preferred === 'cli') {
    return cli.ready
      ? { ...base, effective: 'cli', reason: null }
      : {
          ...base,
          effective: null,
          reason: describeCliMissing(cli.executable),
        };
  }

  if (node.ready) {
    return { ...base, effective: 'node', reason: null };
  }
  if (cli.ready) {
    return { ...base, effective: 'cli', reason: null };
  }
  return {
    ...base,
    effective: null,
    reason: `${describeNodeMissing(node)}; ${describeCliMissing(cli.executable)}`,
  };
}

export function describeTranscriptionBlockedReason(
  state: CallSummaryExtensionPublic,
  hasPcmSidecar: boolean
): string | null {
  if (!hasPcmSidecar) {
    return 'Přepis vyžaduje PCM záznam z nahrávání v Minutes';
  }
  if (state.whisperBackend.reason) {
    return state.whisperBackend.reason;
  }
  if (!state.modelReady) {
    return 'Whisper model není stažený — Nastavení Přepisů (Minutes)';
  }
  if (!state.activated) {
    return 'Přepis není aktivovaný — Nastavení Přepisů (Minutes)';
  }
  return null;
}

export function buildCliGpuAcceleration(
  useGpuRequested: boolean,
  gpuDeviceIndex: number
): WhisperGpuAccelerationPublic {
  const selectedGpuDeviceIndex = Math.max(0, Math.round(gpuDeviceIndex));
  return {
    useGpuRequested,
    gpuDeviceCount: 0,
    primaryGpuDescription: null,
    selectedGpuDeviceIndex,
    selectedGpuDescription: null,
    devices: [],
    statusLabel: useGpuRequested
      ? `whisper-cli — GPU zapnuto (zařízení ${selectedGpuDeviceIndex})`
      : 'whisper-cli — CPU',
  };
}
