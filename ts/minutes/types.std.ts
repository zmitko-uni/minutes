// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { CallMode } from '../types/CallDisposition.std.ts';

export function isRecordableCallMode(callMode: CallMode): boolean {
  return callMode === CallMode.Direct || callMode === CallMode.Group;
}

export type CallRecordingMetadata = Readonly<{
  conversationId: string;
  conversationTitle: string;
  eraId?: string;
  startedAt: number;
  endedAt: number;
  filePath: string;
  durationMs: number;
}>;

export type ChatSummaryScope =
  | Readonly<{
      kind: 'fromMessage';
      fromSentAt: number;
      fromReceivedAt: number;
      messageId: string;
    }>
  | Readonly<{ kind: 'lastHours'; hours: 1 | 8 | 24 }>
  | Readonly<{ kind: 'recent'; limit: number }>;

export type ChatSummaryResult = Readonly<{
  conversationId: string;
  conversationTitle: string;
  messageCount: number;
  generatedAt: number;
  summaryText: string;
  filePath: string;
  scope: ChatSummaryScope;
  aiSummary?: string;
  /** Plný text přepisu hovoru (pro odeslání do chatu) */
  transcriptText?: string;
  /** AI nebylo voláno — vypnuto v nastavení */
  aiSkippedReason?: 'disabled' | 'no_key';
  /** AI bylo voláno, ale selhalo */
  aiError?: string;
}>;

/** Názor AI připravený k odeslání (banner Odeslat do chatu / Poslat sobě). */
export type AiOpinionResult = Readonly<{
  conversationId: string;
  conversationTitle: string;
  opinionText: string;
  generatedAt: number;
}>;

/** Výstup přepisu hovoru po dokončení fronty Whisperu */
export type CallRecordingOutput = Readonly<{
  conversationId: string;
  conversationTitle: string;
  transcriptPath: string;
  /** Přepis pro chat — s AI korekcí, pokud byla zapnutá */
  transcriptText: string;
  summaryPath?: string;
  summaryText?: string;
}>;

export type MinutesRecordingState =
  | Readonly<{ status: 'idle' }>
  | Readonly<{
      status: 'recording';
      conversationId: string;
      conversationTitle: string;
      callMode: CallMode.Direct | CallMode.Group;
      eraId?: string;
      startedAt: number;
    }>
  | Readonly<{
      status: 'paused';
      conversationId: string;
      conversationTitle: string;
      callMode: CallMode.Direct | CallMode.Group;
      eraId?: string;
      startedAt: number;
      pausedAt: number;
    }>;
