// Copyright 2026 Minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

export type LocalLlmModelDefinition = Readonly<{
  id: string;
  fileName: string;
  label: string;
  description: string;
  downloadUrl: string;
  minBytes: number;
  downloadLabel: string;
  recommended?: boolean;
}>;

const HF_UNSLOTH = 'https://huggingface.co/unsloth';

/**
 * Lokální GGUF modely pro AI sumarizaci — text-only (bez mmproj).
 * Gemma 4 vyžaduje llama.cpp s podporou architektury `gemma4`
 * (node-llama-cpp ≥ 3.19.0, llama.cpp ≥ b9842). Používáme distribuci
 * unsloth (Q4_K_M) — má opravené chat/tokenizer metadata (build ggml-org
 * vracel přes chat wrapper prázdný výstup) a je nejrozšířenější.
 */
export const LOCAL_LLM_MODEL_CATALOG: ReadonlyArray<LocalLlmModelDefinition> = [
  {
    id: 'gemma-4-e4b',
    fileName: 'gemma-4-E4B-it-Q4_K_M.gguf',
    label: 'Lehčí (Gemma 4 E4B)',
    description:
      'Menší a rychlejší varianta Gemma 4, vhodná od 8 GB RAM. Dobrý kompromis pro slabší PC.',
    downloadUrl: `${HF_UNSLOTH}/gemma-4-E4B-it-GGUF/resolve/main/gemma-4-E4B-it-Q4_K_M.gguf`,
    minBytes: 4_600_000_000,
    downloadLabel: 'cca 5 GB',
  },
  {
    id: 'gemma-4-12b',
    fileName: 'gemma-4-12b-it-Q4_K_M.gguf',
    label: 'Doporučený (Gemma 4 12B)',
    description:
      'Nejlepší kvalita sumarizace. Doporučeno od 16 GB RAM nebo VRAM.',
    downloadUrl: `${HF_UNSLOTH}/gemma-4-12b-it-GGUF/resolve/main/gemma-4-12b-it-Q4_K_M.gguf`,
    minBytes: 6_600_000_000,
    downloadLabel: 'cca 7,1 GB',
    recommended: true,
  },
];

export const DEFAULT_LOCAL_LLM_MODEL: LocalLlmModelDefinition =
  LOCAL_LLM_MODEL_CATALOG.find(model => model.recommended) ??
  LOCAL_LLM_MODEL_CATALOG[LOCAL_LLM_MODEL_CATALOG.length - 1]!;

export const LOCAL_LLM_MODELS_DIR = 'minutes/models/llm';

/**
 * Staré/chybné názvy souborů z dřívějších verzí katalogu → aktuální soubor.
 * Katalog dříve odkazoval na neexistující / nevhodné buildy Gemma 4
 * (chybný soubor Q4_K_M z ggml-org → HTTP 404, resp. Q4_0 s prázdným
 * výstupem přes chat wrapper). Přesměruj uloženou volbu na funkční unsloth
 * build Gemma 4 12B.
 */
const LOCAL_LLM_MODEL_FILE_ALIASES: Readonly<Record<string, string>> = {
  'gemma-4-12B-it-Q4_K_M.gguf': 'gemma-4-12b-it-Q4_K_M.gguf',
  'gemma-4-12B-it-Q4_0.gguf': 'gemma-4-12b-it-Q4_K_M.gguf',
};

export function normalizeLocalLlmModelFileName(fileName: string): string {
  return LOCAL_LLM_MODEL_FILE_ALIASES[fileName] ?? fileName;
}

export function getLocalLlmModelDefinition(
  fileName: string
): LocalLlmModelDefinition | undefined {
  return LOCAL_LLM_MODEL_CATALOG.find(model => model.fileName === fileName);
}

export function getLocalLlmModelMinBytes(fileName: string): number {
  return getLocalLlmModelDefinition(fileName)?.minBytes ?? 2_000_000_000;
}

export function getLocalLlmModelDownloadUrl(fileName: string): string {
  return (
    getLocalLlmModelDefinition(fileName)?.downloadUrl ??
    DEFAULT_LOCAL_LLM_MODEL.downloadUrl
  );
}

export function getLocalLlmModelDownloadLabel(fileName: string): string {
  return (
    getLocalLlmModelDefinition(fileName)?.downloadLabel ??
    DEFAULT_LOCAL_LLM_MODEL.downloadLabel
  );
}

export function getLocalLlmModelLabel(fileName: string): string {
  return getLocalLlmModelDefinition(fileName)?.label ?? fileName;
}
