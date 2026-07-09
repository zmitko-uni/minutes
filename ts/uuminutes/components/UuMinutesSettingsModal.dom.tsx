// Copyright 2026 uuMinutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';
import { ipcRenderer } from 'electron';

import { AxoDialog } from '../../axo/AxoDialog.dom.tsx';
import { AxoSwitch } from '../../axo/AxoSwitch.dom.tsx';
import { AxoTextField } from '../../axo/AxoTextField.dom.tsx';
import { tw } from '../../axo/tw.dom.tsx';
import { drop } from '../../util/drop.std.ts';
import { openLinkInWebBrowser } from '../../util/openLinkInWebBrowser.dom.ts';
import { formatAppDialogTitle } from '../branding.std.ts';
import {
  AI_PROVIDER_DEFINITIONS,
  DEFAULT_AI_SETTINGS,
  getAiProviderDefinition,
  type AiProvider,
  type AiSettingsPublic,
} from '../aiSettings.std.ts';
import {
  getAiSettings,
  saveAiSettings,
  testAiSettings,
} from '../aiSettingsService.preload.ts';

type Props = Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
}>;

type ApiKeyDrafts = Partial<Record<AiProvider, string>>;
type RemoveKeyFlags = Partial<Record<AiProvider, boolean>>;

function formatUserFacingError(error: unknown): string {
  const raw = error instanceof Error ? error.message : 'Neznámá chyba';
  const ipcMatch = raw.match(
    /Error invoking remote method[^:]*:\s*(?:Error:\s*)?(.+)/s
  );
  const message = (ipcMatch?.[1] ?? raw).trim();

  if (/exceeded your current quota/i.test(message)) {
    return `${message} Doplňte kredit u poskytovatele. Klíč je platný — uložení funguje.`;
  }
  if (/invalid_api_key|incorrect api key|API key not valid/i.test(message)) {
    return `${message} Zkontrolujte API klíč u zvoleného poskytovatele.`;
  }

  return message;
}

function resolveModelForProvider(
  settings: AiSettingsPublic,
  nextProvider: AiProvider
): string {
  const def = getAiProviderDefinition(nextProvider);
  const saved = settings.modelsByProvider[nextProvider];
  if (saved && def.models.includes(saved)) {
    return saved;
  }
  return def.defaultModel;
}

export function UuMinutesSettingsModal({
  open,
  onOpenChange,
}: Props): JSX.Element | null {
  const [loaded, setLoaded] = useState<AiSettingsPublic>(DEFAULT_AI_SETTINGS);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [provider, setProvider] = useState<AiProvider>(
    DEFAULT_AI_SETTINGS.provider
  );
  const [model, setModel] = useState(DEFAULT_AI_SETTINGS.model);
  const [outputLanguage, setOutputLanguage] = useState(
    DEFAULT_AI_SETTINGS.outputLanguage
  );
  const [transcriptCorrectionEnabled, setTranscriptCorrectionEnabled] =
    useState(DEFAULT_AI_SETTINGS.transcriptCorrectionEnabled);
  const [apiKeyDrafts, setApiKeyDrafts] = useState<ApiKeyDrafts>({});
  const [removeKeyFlags, setRemoveKeyFlags] = useState<RemoveKeyFlags>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const providerDef = useMemo(
    () => getAiProviderDefinition(provider),
    [provider]
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    drop(
      (async () => {
        const settings = await getAiSettings();
        setLoaded(settings);
        setAiEnabled(settings.aiEnabled);
        setProvider(settings.provider);
        setModel(settings.model);
        setOutputLanguage(settings.outputLanguage);
        setTranscriptCorrectionEnabled(settings.transcriptCorrectionEnabled);
        setApiKeyDrafts({});
        setRemoveKeyFlags({});
        setStatusMessage(null);
      })()
    );
  }, [open]);

  const handleProviderChange = useCallback(
    (nextProvider: AiProvider) => {
      setProvider(nextProvider);
      setModel(resolveModelForProvider(loaded, nextProvider));
    },
    [loaded]
  );

  const buildApiKeysPayload = useCallback((): Partial<
    Record<AiProvider, string | undefined>
  > => {
    const apiKeys: Partial<Record<AiProvider, string | undefined>> = {};
    for (const def of AI_PROVIDER_DEFINITIONS) {
      if (removeKeyFlags[def.id]) {
        apiKeys[def.id] = '';
        continue;
      }
      const draft = apiKeyDrafts[def.id];
      if (draft !== undefined && draft.trim().length > 0) {
        apiKeys[def.id] = draft.trim();
      }
    }
    return apiKeys;
  }, [apiKeyDrafts, removeKeyFlags]);

  const handleSave = useCallback(() => {
    setIsBusy(true);
    setStatusMessage(null);
    drop(
      (async () => {
        try {
          const saved = await saveAiSettings({
            aiEnabled,
            provider,
            model,
            outputLanguage,
            transcriptCorrectionEnabled,
            apiKeys: buildApiKeysPayload(),
          });
          setLoaded(saved);
          setApiKeyDrafts({});
          setRemoveKeyFlags({});
          setStatusMessage('Nastavení uloženo.');
          onOpenChange(false);
        } catch (error) {
          setStatusMessage(formatUserFacingError(error));
        } finally {
          setIsBusy(false);
        }
      })()
    );
  }, [
    aiEnabled,
    buildApiKeysPayload,
    model,
    onOpenChange,
    outputLanguage,
    provider,
    transcriptCorrectionEnabled,
  ]);

  const handleTest = useCallback(() => {
    setIsBusy(true);
    setStatusMessage(null);
    drop(
      (async () => {
        try {
          const draftKey = apiKeyDrafts[provider]?.trim();
          const result = await testAiSettings({
            provider,
            model,
            apiKey: draftKey && draftKey.length > 0 ? draftKey : undefined,
          });
          setStatusMessage(`Připojení OK (${result.message})`);
        } catch (error) {
          setStatusMessage(formatUserFacingError(error));
        } finally {
          setIsBusy(false);
        }
      })()
    );
  }, [apiKeyDrafts, model, provider]);

  if (!open) {
    return null;
  }

  return (
    <AxoDialog.Root open={open} onOpenChange={onOpenChange}>
      <AxoDialog.Content size="md" escape="cancel-is-noop">
        <AxoDialog.Header>
          <AxoDialog.Title>{formatAppDialogTitle('nastavení AI')}</AxoDialog.Title>
          <AxoDialog.Close />
        </AxoDialog.Header>
        <AxoDialog.Body>
          <AxoDialog.Description>
            <p className={tw('mb-4 text-label-medium')}>
              Zadejte API klíče u poskytovatelů, které chcete používat. Klíče
              zůstávají uložené — můžete mít najednou Gemini i ChatGPT. Níže
              zvolte, který poskytovatel a model se má používat pro sumarizaci.
            </p>
          </AxoDialog.Description>

          <div className={tw('flex flex-col gap-5')}>
            <label className={tw('flex items-center justify-between gap-3')}>
              <span>Povolit AI shrnutí po exportu</span>
              <AxoSwitch.Root
                checked={aiEnabled}
                onCheckedChange={setAiEnabled}
              />
            </label>

            <label className={tw('flex items-center justify-between gap-3')}>
              <span>Opravit přepis hovoru pomocí AI</span>
              <AxoSwitch.Root
                checked={transcriptCorrectionEnabled}
                disabled={!aiEnabled}
                onCheckedChange={setTranscriptCorrectionEnabled}
              />
            </label>
            <p className={tw('-mt-2 text-label-small opacity-70')}>
              Po lokálním Whisper přepisu opraví zjevné chyby rozpoznání řeči
              (např. „jak se máš“ místo nesmyslných slov). Vyžaduje API klíč u
              aktivního poskytovatele.
            </p>

            <fieldset className={tw('m-0 flex flex-col gap-3 border-0 p-0')}>
              <legend className={tw('mb-1 text-label-medium font-medium')}>
                API klíče
              </legend>
              {AI_PROVIDER_DEFINITIONS.map(def => {
                const keyStatus = loaded.keyStatusByProvider[def.id];
                const hasSavedKey = keyStatus?.hasApiKey ?? false;
                const markedForRemoval = removeKeyFlags[def.id] ?? false;
                const draft = apiKeyDrafts[def.id] ?? '';

                let placeholder = def.keyPlaceholder;
                if (markedForRemoval) {
                  placeholder = 'Klíč bude po uložení odstraněn';
                } else if (hasSavedKey && draft.length === 0) {
                  placeholder = `Uloženo (${keyStatus?.apiKeyMasked ?? '••••'})`;
                }

                return (
                  <label
                    key={def.id}
                    className={tw('flex flex-col gap-1')}
                  >
                    <span className={tw('flex flex-wrap items-center gap-2')}>
                      <span>{def.keyLabel}</span>
                      {provider === def.id && (
                        <span
                          className={tw(
                            'rounded px-1.5 py-0.5 text-label-small',
                            'bg-fill-secondary opacity-80'
                          )}
                        >
                          aktivní
                        </span>
                      )}
                    </span>
                    <input
                      type="password"
                      autoComplete="off"
                      className={tw(
                        'w-full rounded-md border border-solid px-3 py-2',
                        'border-label-disabled bg-background-primary text-label-primary',
                        'not-forced-colors:outline-none focus:border-label-primary'
                      )}
                      placeholder={placeholder}
                      value={draft}
                      disabled={markedForRemoval}
                      onChange={event => {
                        const value = event.target.value;
                        setApiKeyDrafts(prev => ({ ...prev, [def.id]: value }));
                        if (value.length > 0) {
                          setRemoveKeyFlags(prev => ({
                            ...prev,
                            [def.id]: false,
                          }));
                        }
                      }}
                    />
                    <span className={tw('text-label-small opacity-70')}>
                      Klíč získáte na{' '}
                      <button
                        type="button"
                        className={tw('underline')}
                        onClick={() => {
                          openLinkInWebBrowser(def.keyHelpUrl);
                        }}
                      >
                        {def.keyHelpLabel}
                      </button>
                      . Prázdné pole = ponechat stávající klíč.
                      {hasSavedKey && !markedForRemoval && (
                        <>
                          {' '}
                          <button
                            type="button"
                            className={tw('underline')}
                            onClick={() => {
                              setRemoveKeyFlags(prev => ({
                                ...prev,
                                [def.id]: true,
                              }));
                              setApiKeyDrafts(prev => ({
                                ...prev,
                                [def.id]: '',
                              }));
                            }}
                          >
                            Odstranit uložený klíč
                          </button>
                        </>
                      )}
                      {markedForRemoval && (
                        <>
                          {' '}
                          <button
                            type="button"
                            className={tw('underline')}
                            onClick={() => {
                              setRemoveKeyFlags(prev => ({
                                ...prev,
                                [def.id]: false,
                              }));
                            }}
                          >
                            Zrušit odstranění
                          </button>
                        </>
                      )}
                    </span>
                  </label>
                );
              })}
            </fieldset>

            <fieldset className={tw('m-0 flex flex-col gap-3 border-0 p-0')}>
              <legend className={tw('mb-1 text-label-medium font-medium')}>
                Aktivní poskytovatel pro sumarizaci
              </legend>

              <label className={tw('flex flex-col gap-1')}>
                <span>Poskytovatel</span>
                <select
                  className={tw(
                    'rounded-md border border-solid px-3 py-2',
                    'border-label-disabled bg-background-primary'
                  )}
                  value={provider}
                  onChange={event =>
                    handleProviderChange(event.target.value as AiProvider)
                  }
                >
                  {AI_PROVIDER_DEFINITIONS.map(def => (
                    <option key={def.id} value={def.id}>
                      {def.label}
                      {loaded.keyStatusByProvider[def.id]?.hasApiKey
                        ? ' ✓'
                        : ''}
                    </option>
                  ))}
                </select>
                <span className={tw('text-label-small opacity-70')}>
                  {providerDef.billingNote}
                </span>
              </label>

              <label className={tw('flex flex-col gap-1')}>
                <span>Model</span>
                <select
                  className={tw(
                    'rounded-md border border-solid px-3 py-2',
                    'border-label-disabled bg-background-primary'
                  )}
                  value={model}
                  onChange={event => setModel(event.target.value)}
                >
                  {providerDef.models.map(option => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>

            <label className={tw('flex flex-col gap-1')}>
              <span>Jazyk shrnutí (např. cs, en)</span>
              <AxoTextField.Root width="full">
                <AxoTextField.Input
                  placeholder="cs"
                  value={outputLanguage}
                  onValueChange={setOutputLanguage}
                  maxGraphemes={16}
                  maxBytes={32}
                />
              </AxoTextField.Root>
            </label>

            {statusMessage && (
              <p className={tw('text-label-small')}>{statusMessage}</p>
            )}
          </div>
        </AxoDialog.Body>
        <AxoDialog.Footer>
          <AxoDialog.Actions>
            <AxoDialog.Action
              variant="secondary"
              disabled={isBusy}
              onClick={handleTest}
            >
              Otestovat aktivního
            </AxoDialog.Action>
            <AxoDialog.Action
              variant="primary"
              disabled={isBusy}
              onClick={handleSave}
            >
              Uložit
            </AxoDialog.Action>
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}

export function UuMinutesSettingsHost(): JSX.Element {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (): void => {
      setOpen(true);
    };
    ipcRenderer.on('uuminutes:open-settings', handler);
    return () => {
      ipcRenderer.removeListener('uuminutes:open-settings', handler);
    };
  }, []);

  return <UuMinutesSettingsModal open={open} onOpenChange={setOpen} />;
}
