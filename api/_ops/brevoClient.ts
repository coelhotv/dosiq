// brevoClient.ts — cliente mínimo da API de contatos da Brevo (spec 026 Slice 2A, ADR-118).
//
// Contrato verificado na API real em 2026-10-29 (analysis-2a.md, PO-2A-5):
//   - POST /contacts é chaveado por E-MAIL; e-mail novo com ext_id já usado ⇒ 400 duplicate_parameter
//     ⇒ PUT /contacts/{ext_id}?identifierType=ext_id com attributes.EMAIL atualiza o mesmo contato (C-2A-2).
//   - DELETE por ext_id; ausente ⇒ 404 = já removido = sucesso (F-6).
//   - upsert não remove blocklist (FR-2A-08).
// Erro carrega só status + code da Brevo — nunca body/message, que podem ecoar o e-mail (F-5).

const BREVO_API = 'https://api.brevo.com/v3';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const BREVO_TIMEOUT_MS = 10_000;

export class BrevoError extends Error {
  readonly status: number;
  readonly code: string | null;
  constructor(status: number, code: string | null) {
    super(`brevo ${status}${code ? ` ${code}` : ''}`);
    this.name = 'BrevoError';
    this.status = status;
    this.code = code;
  }
}

export interface BrevoContact {
  email: string;
  extId: string;
  attributes: Record<string, string | boolean>;
  listIds: number[];
}

export interface BrevoClient {
  upsertContact(contact: BrevoContact): Promise<void>;
  deleteByExtId(extId: string): Promise<void>;
}

type FetchFn = (url: string, init: NonNullable<Parameters<typeof fetch>[1]>) => Promise<Response>;

async function errorCode(res: Response): Promise<string | null> {
  try {
    const body = await res.json();
    return typeof body?.code === 'string' ? body.code : null;
  } catch {
    return null;
  }
}

function assertUuid(extId: string) {
  if (!UUID_RE.test(extId)) throw new BrevoError(0, 'invalid_ext_id');
}

export function createBrevoClient(apiKey: string, fetchFn: FetchFn = fetch, timeoutMs = BREVO_TIMEOUT_MS): BrevoClient {
  async function call(method: string, path: string, body?: unknown): Promise<Response> {
    try {
      return await fetchFn(`${BREVO_API}${path}`, {
        method,
        headers: { 'api-key': apiKey, accept: 'application/json', 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      // Rede/timeout: sem status HTTP. Nada da requisição vai para a mensagem.
      throw new BrevoError(0, 'network');
    }
  }

  return {
    async upsertContact({ email, extId, attributes, listIds }) {
      assertUuid(extId);
      const res = await call('POST', '/contacts', { email, ext_id: extId, attributes, listIds, updateEnabled: true });
      if (res.ok) return;
      const code = await errorCode(res);
      if (res.status === 400 && code === 'duplicate_parameter') {
        const put = await call('PUT', `/contacts/${encodeURIComponent(extId)}?identifierType=ext_id`, {
          attributes: { ...attributes, EMAIL: email },
          listIds,
        });
        if (put.ok) return;
        throw new BrevoError(put.status, await errorCode(put));
      }
      throw new BrevoError(res.status, code);
    },

    async deleteByExtId(extId) {
      assertUuid(extId);
      const res = await call('DELETE', `/contacts/${encodeURIComponent(extId)}?identifierType=ext_id`);
      if (res.ok || res.status === 404) return;
      throw new BrevoError(res.status, await errorCode(res));
    },
  };
}
