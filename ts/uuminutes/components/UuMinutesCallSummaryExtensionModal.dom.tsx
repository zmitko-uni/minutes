// Copyright 2026 uuMinutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect, useState, type JSX } from 'react';
import { ipcRenderer } from 'electron';

import { AxoDialog } from '../../axo/AxoDialog.dom.tsx';
import { tw } from '../../axo/tw.dom.tsx';
import { drop } from '../../util/drop.std.ts';
import {
  getCallSummaryExtensionState,
  installCallSummaryExtension,
  refreshCallSummaryExtension,
  subscribeCallSummaryExtensionProgress,
} from '../callSummaryExtensionService.preload.ts';
import { callSummaryExtensionEvents } from '../callSummaryExtensionEvents.std.ts';
import {
  type CallSummaryExtensionProgress,
  type CallSummaryExtensionPublic,
} from '../callSummaryExtension.std.ts';

type Props = Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
}>;

function formatSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) {
    return '—';
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatInstallError(error: unknown): string {
  const raw = error instanceof Error ? error.message : 'Instalace selhala.';
  const ipcMatch = raw.match(
    /Error invoking remote method[^:]*:\s*(?:Error:\s*)?(.+)/s
  );
  const message = (ipcMatch?.[1] ?? raw).trim();

  if (/index\.mjs|whisper-cpp-node/i.test(message)) {
    return 'Nelze načíst lokální Whisper modul. Restartujte aplikaci a zkuste znovu.';
  }

  return message;
}

function StatusRow({
  label,
  value,
  valueClassName,
}: Readonly<{
  label: string;
  value: string;
  valueClassName?: string;
}>): JSX.Element {
  return (
    <div className="UuMinutesCallSummaryExtensionModal__row">
      <span className="UuMinutesCallSummaryExtensionModal__rowLabel">{label}</span>
      <span
        className={tw(
          'UuMinutesCallSummaryExtensionModal__rowValue',
          valueClassName
        )}
      >
        {value}
      </span>
    </div>
  );
}

function getModelLabel(
  state: CallSummaryExtensionPublic,
  fileName: string
): string {
  return (
    state.availableModels.find(model => model.fileName === fileName)?.label ??
    fileName
  );
}

export function UuMinutesCallSummaryExtensionModal({
  open,
  onOpenChange,
}: Props): JSX.Element | null {
  const [state, setState] = useState<CallSummaryExtensionPublic>(
    getCallSummaryExtensionState()
  );
  const [selectedModelFileName, setSelectedModelFileName] = useState(
    state.recommendedModelFileName
  );
  const [progress, setProgress] = useState<CallSummaryExtensionProgress | null>(
    null
  );
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setProgress(null);
    setErrorMessage(null);
    drop(
      refreshCallSummaryExtension().then(next => {
        setState(next);
        setSelectedModelFileName(
          next.modelFileName ?? next.recommendedModelFileName
        );
      })
    );
  }, [open]);

  useEffect(() => {
    return callSummaryExtensionEvents.on(setState);
  }, []);

  useEffect(() => {
    return subscribeCallSummaryExtensionProgress(setProgress);
  }, []);

  const runInstall = useCallback(
    (options: { modelFileName: string; forceRedownload?: boolean }) => {
      setIsBusy(true);
      setErrorMessage(null);
      setProgress({
        phase: 'checking',
        message: options.forceRedownload
          ? 'Připravuji přeinstalaci…'
          : 'Připravuji instalaci…',
      });

      drop(
        (async () => {
          try {
            const next = await installCallSummaryExtension(options);
            setState(next);
            setSelectedModelFileName(next.modelFileName ?? options.modelFileName);
            setProgress({
              phase: 'complete',
              message: options.forceRedownload
                ? 'Model byl znovu stažen. Rozšíření je aktivní.'
                : 'Rozšíření je aktivní. Nahrávání hovorů je povoleno.',
              percent: 100,
            });
          } catch (error) {
            const message = formatInstallError(error);
            setErrorMessage(message);
            setProgress({ phase: 'error', message });
          } finally {
            setIsBusy(false);
          }
        })()
      );
    },
    []
  );

  const isActive =
    state.activated && state.modelReady && state.whisperRuntimeReady;
  const activeModelFileName = state.modelFileName;
  const selectedModel =
    state.availableModels.find(
      model => model.fileName === selectedModelFileName
    ) ?? null;
  const isModelChange =
    isActive &&
    activeModelFileName != null &&
    selectedModelFileName !== activeModelFileName;
  const canReinstall =
    isActive &&
    activeModelFileName != null &&
    selectedModelFileName === activeModelFileName;

  if (!open) {
    return null;
  }

  return (
    <AxoDialog.Root open={open} onOpenChange={onOpenChange}>
      <AxoDialog.Content size="md" escape="cancel-is-noop">
        <AxoDialog.Header>
          <AxoDialog.Title>Sumarizace hovoru</AxoDialog.Title>
          <AxoDialog.Close />
        </AxoDialog.Header>

        <AxoDialog.Body>
          <AxoDialog.Description>
            <p className={tw('mb-5 text-label-medium leading-relaxed')}>
              Rozšíření pro sumarizaci hovorů a meetingů (1:1 i skupinové). Po
              aktivaci můžete nahrát zvukový záznam, lokálně ho převést na text
              pomocí Whisperu a výsledek shrnout pomocí AI (nastavení v{' '}
              <strong>Nastavení AI</strong>). Přepis probíhá v češtině na vašem
              počítači.
            </p>
          </AxoDialog.Description>

          <div className="UuMinutesCallSummaryExtensionModal__statusCard">
            <StatusRow
              label="Stav rozšíření"
              value={isActive ? 'Aktivní' : 'Neaktivní'}
              valueClassName={
                isActive
                  ? 'UuMinutesCallSummaryExtensionModal__rowValue--ok'
                  : 'UuMinutesCallSummaryExtensionModal__rowValue--muted'
              }
            />
            <StatusRow
              label="Whisper runtime"
              value={state.whisperRuntimeReady ? 'Nainstalován' : 'Chybí'}
              valueClassName={
                state.whisperRuntimeReady
                  ? 'UuMinutesCallSummaryExtensionModal__rowValue--ok'
                  : undefined
              }
            />
            <StatusRow
              label="Aktivní model"
              value={
                activeModelFileName && state.modelReady
                  ? `${getModelLabel(state, activeModelFileName)} (${formatSize(state.modelSizeBytes)})`
                  : activeModelFileName
                    ? `${getModelLabel(state, activeModelFileName)} — nestáhnut`
                    : '—'
              }
              valueClassName={
                state.modelReady
                  ? 'UuMinutesCallSummaryExtensionModal__rowValue--ok'
                  : undefined
              }
            />
            <StatusRow
              label="Nahrávání hovorů"
              value={isActive ? 'Povoleno' : 'Zakázáno'}
              valueClassName={
                isActive
                  ? 'UuMinutesCallSummaryExtensionModal__rowValue--ok'
                  : undefined
              }
            />
          </div>

          <fieldset className="UuMinutesCallSummaryExtensionModal__modelField">
            <legend className="UuMinutesCallSummaryExtensionModal__modelLegend">
              Whisper model pro přepis
            </legend>
            <label className="UuMinutesCallSummaryExtensionModal__modelLabel">
              <span>Model</span>
              <select
                className="UuMinutesCallSummaryExtensionModal__modelSelect"
                value={selectedModelFileName}
                disabled={isBusy}
                onChange={event => setSelectedModelFileName(event.target.value)}
              >
                {state.availableModels.map(model => (
                  <option key={model.fileName} value={model.fileName}>
                    {model.label} ({model.downloadLabel})
                    {model.ready ? ' ✓' : ''}
                  </option>
                ))}
              </select>
            </label>
            {selectedModel && (
              <p className="UuMinutesCallSummaryExtensionModal__modelHint">
                {selectedModel.description}
                {selectedModel.installed && (
                  <>
                    {' '}
                    — na disku {formatSize(selectedModel.installedSizeBytes)}
                    {!selectedModel.ready ? ' (neúplný, stáhněte znovu)' : ''}
                  </>
                )}
              </p>
            )}
          </fieldset>

          {!isActive && (
            <p className={tw('mt-4 text-label-small text-label-secondary')}>
              Při první aktivaci se stáhne zvolený jazykový model Whisperu.
              Bez něj nelze hovory přepisovat.
            </p>
          )}

          {progress && (
            <div
              className={tw(
                'UuMinutesCallSummaryExtensionModal__progress',
                progress.phase === 'error' &&
                  'UuMinutesCallSummaryExtensionModal__progress--error',
                progress.phase === 'complete' &&
                  'UuMinutesCallSummaryExtensionModal__progress--complete'
              )}
            >
              <span>{progress.message}</span>
              {typeof progress.percent === 'number' &&
                progress.phase === 'downloading' && (
                  <div className="UuMinutesCallSummaryExtensionModal__bar">
                    <div
                      className="UuMinutesCallSummaryExtensionModal__barFill"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                )}
            </div>
          )}

          {errorMessage && (
            <p className="UuMinutesCallSummaryExtensionModal__error">
              {errorMessage}
            </p>
          )}
        </AxoDialog.Body>

        <AxoDialog.Footer>
          <AxoDialog.Actions>
            <AxoDialog.Action
              variant="secondary"
              onClick={() => onOpenChange(false)}
            >
              Zavřít
            </AxoDialog.Action>
            {canReinstall && (
              <AxoDialog.Action
                variant="secondary"
                disabled={isBusy}
                onClick={() =>
                  runInstall({
                    modelFileName: selectedModelFileName,
                    forceRedownload: true,
                  })
                }
              >
                {isBusy ? 'Stahuji…' : 'Přeinstalovat model'}
              </AxoDialog.Action>
            )}
            {(!isActive || isModelChange) && (
              <AxoDialog.Action
                variant="primary"
                disabled={isBusy}
                onClick={() =>
                  runInstall({ modelFileName: selectedModelFileName })
                }
              >
                {isBusy
                  ? 'Stahuji…'
                  : isModelChange
                    ? 'Změnit model'
                    : 'Stáhnout a aktivovat'}
              </AxoDialog.Action>
            )}
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}

export function UuMinutesCallSummaryExtensionHost(): JSX.Element {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (): void => {
      setOpen(true);
    };
    ipcRenderer.on('uuminutes:open-call-summary-extension', handler);
    return () => {
      ipcRenderer.removeListener(
        'uuminutes:open-call-summary-extension',
        handler
      );
    };
  }, []);

  return (
    <UuMinutesCallSummaryExtensionModal open={open} onOpenChange={setOpen} />
  );
}
