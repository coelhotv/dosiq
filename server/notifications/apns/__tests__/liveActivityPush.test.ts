import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import type * as http2 from 'node:http2';
import { getApnsConfig, sendLiveActivityStart, sendLiveActivityUpdate, sendLiveActivityEnd, _resetJwtCache } from '../liveActivityPush';

// Espelha o type local do módulo (não exportado). Mock implementa a superfície mínima
// connect→request→{on,setEncoding,end} — cast único e documentado no helper.
type Http2Lib = Pick<typeof http2, 'connect'>;
type Handlers = Record<string, ((arg?: unknown) => void) | undefined>;
interface CapturedBody { aps: { event?: string; attributes?: unknown; 'content-state'?: unknown; 'dismissal-date'?: number } }
interface Sink { body?: CapturedBody; headers?: Record<string, string> }

// .p8 EC P-256 REAL gerada em runtime (não é segredo; só p/ assinar o JWT no unit).
const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const TEST_P8 = privateKey.export({ type: 'pkcs8', format: 'pem' });
const TEST_P8_B64 = Buffer.from(TEST_P8).toString('base64');

const ENV = { APNS_AUTH_KEY: TEST_P8_B64, APNS_KEY_ID: 'KEY123', APNS_TEAM_ID: 'TEAM123', APNS_BUNDLE_ID: 'com.x.dosiq' };

describe('getApnsConfig', () => {
  it('retorna null se faltar qualquer credencial (R-088 fail-closed)', () => {
    expect(getApnsConfig({})).toBeNull();
    expect(getApnsConfig({ ...ENV, APNS_AUTH_KEY: undefined })).toBeNull();
  });
  it('base64 inválido (não é .p8) → null', () => {
    expect(getApnsConfig({ ...ENV, APNS_AUTH_KEY: Buffer.from('lixo').toString('base64') })).toBeNull();
  });
  it('credenciais completas → config com host de produção', () => {
    const c = getApnsConfig(ENV)!;
    expect(c.bundleId).toBe('com.x.dosiq');
    expect(c.host).toContain('api.push.apple.com');
  });
});

// Mock http2: simula a resposta APNs (status configurável).
function makeHttp2(status: number, body = ''): Http2Lib {
  const handlers: Handlers = {};
  const req = {
    on: (ev: string, cb: (arg?: unknown) => void) => { handlers[ev] = cb; return req; },
    setEncoding: () => {},
    end: () => {
      handlers.response?.({ ':status': status });
      if (body) handlers.data?.(body);
      handlers.end?.();
    },
  };
  return { connect: () => ({ on: () => {}, request: () => req, close: () => {} }) } as unknown as Http2Lib;
}

describe('sendLiveActivityStart', () => {
  beforeEach(() => _resetJwtCache());
  afterEach(() => vi.clearAllMocks());

  const base = { pushToStartToken: 'abc123', attributes: {}, contentState: { state: 'upcoming' }, config: getApnsConfig(ENV) };

  it('sem config → fail-open (ok:false, apns_not_configured), nunca lança', async () => {
    const r = await sendLiveActivityStart({ ...base, config: null });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('apns_not_configured');
  });

  it('200 → ok', async () => {
    const r = await sendLiveActivityStart({ ...base, http2lib: makeHttp2(200) });
    expect(r.ok).toBe(true);
    expect(r.status).toBe(200);
  });

  it('410 → deactivate (revogar token, S-6)', async () => {
    const r = await sendLiveActivityStart({ ...base, http2lib: makeHttp2(410, 'Unregistered') });
    expect(r.ok).toBe(false);
    expect(r.deactivate).toBe(true);
  });

  it('400 BadDeviceToken → deactivate', async () => {
    const r = await sendLiveActivityStart({ ...base, http2lib: makeHttp2(400, '{"reason":"BadDeviceToken"}') });
    expect(r.deactivate).toBe(true);
  });

  it('500 → falha sem deactivate (transitório)', async () => {
    const r = await sendLiveActivityStart({ ...base, http2lib: makeHttp2(500, 'InternalServerError') });
    expect(r.ok).toBe(false);
    expect(r.deactivate).toBeFalsy();
  });

  it('sem token → no_token', async () => {
    const r = await sendLiveActivityStart({ ...base, pushToStartToken: '' });
    expect(r.reason).toBe('no_token');
  });
});

// Captura headers + body do request p/ asserção de payload (event/priority/dismissal).
function makeCapturingHttp2(status: number, sink: Sink): Http2Lib {
  const handlers: Handlers = {};
  const req = {
    on: (ev: string, cb: (arg?: unknown) => void) => { handlers[ev] = cb; return req; },
    setEncoding: () => {},
    end: (payload: string) => { sink.body = JSON.parse(payload); handlers.response?.({ ':status': status }); handlers.end?.(); },
  };
  return { connect: () => ({ on: () => {}, request: (h: Record<string, string>) => { sink.headers = h; return req; }, close: () => {} }) } as unknown as Http2Lib;
}

describe('sendLiveActivityUpdate', () => {
  beforeEach(() => _resetJwtCache());
  const cfg = getApnsConfig(ENV);

  it('payload event=update, priority 5, sem attributes', async () => {
    const sink: Sink = {};
    const r = await sendLiveActivityUpdate({ pushToken: 'tok', contentState: { state: 'late' }, config: cfg, http2lib: makeCapturingHttp2(200, sink) });
    expect(r.ok).toBe(true);
    expect(sink.body!.aps.event).toBe('update');
    expect(sink.body!.aps['content-state']).toEqual({ state: 'late' });
    expect(sink.body!.aps.attributes).toBeUndefined();
    expect(sink.headers!['apns-priority']).toBe('5');
    expect(sink.headers!['apns-push-type']).toBe('liveactivity');
  });

  it('sem token → no_token; sem config → apns_not_configured', async () => {
    expect((await sendLiveActivityUpdate({ pushToken: '', contentState: {}, config: cfg })).reason).toBe('no_token');
    expect((await sendLiveActivityUpdate({ pushToken: 't', contentState: {}, config: null })).reason).toBe('apns_not_configured');
  });
});

describe('sendLiveActivityEnd', () => {
  beforeEach(() => _resetJwtCache());
  const cfg = getApnsConfig(ENV);

  it('payload event=end com dismissal-date', async () => {
    const sink: Sink = {};
    const r = await sendLiveActivityEnd({ pushToken: 'tok', contentState: { state: 'done' }, dismissEpochSec: 1000, config: cfg, http2lib: makeCapturingHttp2(200, sink) });
    expect(r.ok).toBe(true);
    expect(sink.body!.aps.event).toBe('end');
    expect(sink.body!.aps['dismissal-date']).toBe(1000);
    expect(sink.body!.aps['content-state']).toEqual({ state: 'done' });
  });

  it('410 → deactivate', async () => {
    const r = await sendLiveActivityEnd({ pushToken: 'tok', contentState: {}, config: cfg, http2lib: makeHttp2(410, 'Unregistered') });
    expect(r.deactivate).toBe(true);
  });
});
