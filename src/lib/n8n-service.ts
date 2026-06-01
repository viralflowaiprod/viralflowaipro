/**
 * n8nService — camada centralizada de comunicação com o backend de automação (n8n).
 *
 * Toda automação (geração de conteúdo, publicação, agendamento, etc.) deve
 * passar por aqui. Isso garante que possamos expandir, trocar endpoints,
 * adicionar retries, observabilidade, etc., sem refatorar callers.
 */

export const N8N_WEBHOOK_URL =
  "https://viralflowai-production-production.up.railway.app/webhook/viralflow";

export type N8nAction =
  | "generate_content"
  | "schedule_post"
  | "publish_post"
  | "generate_carousel"
  | "generate_script";

export interface GenerateContentPayload {
  topic: string;
  platform: string;
  contentType: string;
  tone: string;
  language: string;
  userId: string;
  timestamp: string;
  /** Permite expansão futura sem quebrar contrato */
  [key: string]: unknown;
}

export interface N8nResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  raw?: unknown;
}

/** Envia qualquer payload ao webhook do n8n. Base para todas as ações. */
async function sendToN8N<T = unknown>(
  action: N8nAction,
  payload: Record<string, unknown>,
): Promise<N8nResponse<T>> {
  try {
    const res = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
    });

    if (!res.ok) {
      return handleError(`n8n respondeu com status ${res.status}`);
    }

    const text = await res.text();
    let parsed: unknown = text;
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      // resposta não-JSON — devolvemos texto cru
    }
    return handleResponse<T>(parsed);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return handleError(`Falha de rede ao contatar o n8n: ${msg}`);
  }
}

function handleResponse<T>(raw: unknown): N8nResponse<T> {
  return { ok: true, data: raw as T, raw };
}

function handleError(message: string): N8nResponse {
  return { ok: false, error: message };
}

/** Geração de conteúdo — usado pelo formulário principal. */
async function generateContent(
  input: Omit<GenerateContentPayload, "timestamp">,
): Promise<N8nResponse> {
  const payload: GenerateContentPayload = {
    ...input,
    timestamp: new Date().toISOString(),
  };
  return sendToN8N("generate_content", payload);
}

export const n8nService = {
  sendToN8N,
  generateContent,
  handleResponse,
  handleError,
};
