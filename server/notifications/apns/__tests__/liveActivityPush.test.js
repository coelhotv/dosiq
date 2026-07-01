import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { getApnsConfig, sendLiveActivityStart, _resetJwtCache } from '../liveActivityPush.js';

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
    const c = getApnsConfig(ENV);
    expect(c.bundleId).toBe('com.x.dosiq');
    expect(c.host).toContain('api.push.apple.com');
  });
});

// Mock http2: simula a resposta APNs (status configurável).
function makeHttp2(status, body = '') {
  const handlers = {};
  const req = {
    on: (ev, cb) => { handlers[ev] = cb; return req; },
    setEncoding: () => {},
    end: () => {
      handlers.response?.({ ':status': status });
      if (body) handlers.data?.(body);
      handlers.end?.();
    },
  };
  return { connect: () => ({ on: () => {}, request: () => req, close: () => {} }) };
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
