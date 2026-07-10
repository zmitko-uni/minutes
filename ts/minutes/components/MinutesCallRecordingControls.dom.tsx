// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect, useState, type JSX, type MouseEvent } from 'react';
import classNames from 'classnames';

import { CallMode } from '../../types/CallDisposition.std.ts';
import { Tooltip, TooltipPlacement } from '../../components/Tooltip.dom.tsx';
import { Theme } from '../../util/theme.std.ts';
import { isRecordableCallMode } from '../types.std.ts';
import {
  callRecordingService,
  RECORDING_STATE_CHANGED,
} from '../callRecordingService.preload.ts';
import { recordingStateEvents } from '../recordingStateEvents.std.ts';
import { isCallSummaryExtensionActive } from '../callSummaryExtensionService.preload.ts';
import { callSummaryExtensionEvents } from '../callSummaryExtensionEvents.std.ts';
import { formatMenuActionLabel } from '../branding.std.ts';
import type { MinutesRecordingState } from '../types.std.ts';

type PropsType = Readonly<{
  conversationId: string;
  callMode: CallMode;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}>;

type ControlButtonPropsType = Readonly<{
  className: string;
  label: string;
  onClick: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}>;

function MinutesCallControlButton({
  className,
  label,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: ControlButtonPropsType): JSX.Element {
  const handleClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      onClick();
    },
    [onClick]
  );

  return (
    <div className="CallingButton">
      <Tooltip
        className="CallingButton__tooltip"
        wrapperClassName="CallingButton__button-container"
        content={label}
        direction={TooltipPlacement.Top}
        theme={Theme.Dark}
      >
        <button
          type="button"
          className={classNames('CallingButton__icon', className)}
          aria-label={label}
          onClick={handleClick}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        />
      </Tooltip>
    </div>
  );
}

export function MinutesCallRecordingControls({
  conversationId,
  callMode,
  onMouseEnter,
  onMouseLeave,
}: PropsType): JSX.Element | null {
  const [state, setState] = useState<MinutesRecordingState>(
    callRecordingService.getState()
  );
  const [extensionActive, setExtensionActive] = useState(
    isCallSummaryExtensionActive()
  );

  useEffect(() => {
    const handler = (next: MinutesRecordingState) => setState(next);
    recordingStateEvents.on(RECORDING_STATE_CHANGED, handler);
    return () => {
      recordingStateEvents.off(RECORDING_STATE_CHANGED, handler);
    };
  }, []);

  useEffect(() => {
    return callSummaryExtensionEvents.on(next => {
      setExtensionActive(
        next.activated && next.modelReady && next.whisperRuntimeReady
      );
    });
  }, []);

  const start = useCallback(() => {
    void callRecordingService.startRecording({ conversationId, callMode });
  }, [callMode, conversationId]);

  const pause = useCallback(() => {
    callRecordingService.pauseRecording();
  }, []);

  const resume = useCallback(() => {
    callRecordingService.resumeRecording();
  }, []);

  const stop = useCallback(() => {
    void callRecordingService.stopRecording();
  }, []);

  if (!isRecordableCallMode(callMode)) {
    return null;
  }

  const isThisCall =
    state.status !== 'idle' && state.conversationId === conversationId;

  if (!isThisCall && state.status !== 'idle') {
    return null;
  }

  if (state.status === 'idle') {
    const recordLabel = extensionActive
      ? formatMenuActionLabel('Spustit nahrávání')
      : formatMenuActionLabel(
          'Spustit nahrávání (přepis vyžaduje rozšíření Whisper)'
        );

    return (
      <MinutesCallControlButton
        className="MinutesCallRecordingControls__button MinutesCallRecordingControls__button--record"
        label={recordLabel}
        onClick={start}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      />
    );
  }

  return (
    <>
      {state.status === 'recording' ? (
        <MinutesCallControlButton
          className="MinutesCallRecordingControls__button MinutesCallRecordingControls__button--pause MinutesCallRecordingControls__button--active"
          label={formatMenuActionLabel('Pozastavit nahrávání')}
          onClick={pause}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        />
      ) : (
        <MinutesCallControlButton
          className="MinutesCallRecordingControls__button MinutesCallRecordingControls__button--resume MinutesCallRecordingControls__button--active"
          label={formatMenuActionLabel('Obnovit nahrávání')}
          onClick={resume}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        />
      )}
      <MinutesCallControlButton
        className="MinutesCallRecordingControls__button MinutesCallRecordingControls__button--stop MinutesCallRecordingControls__button--active"
        label={formatMenuActionLabel('Ukončit a uložit nahrávku')}
        onClick={stop}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      />
    </>
  );
}
