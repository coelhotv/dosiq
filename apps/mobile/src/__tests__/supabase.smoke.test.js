/**
 * @jest-environment node
 */

// supabase.smoke.test.js — Validar integração Supabase + Polyfills
// Garante que o PostgrestBuilder usa o nosso patch de URLSearchParams/toString.

// Mock environment variables before importing nativePublicAppConfig
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'dummy-key';

const { supabase } = require('../platform/supabase/nativeSupabaseClient');

describe('Supabase + Polyfills Smoke Test', () => {
  // Mock fetch global para interceptar as chamadas do Supabase
  let originalFetch;
  
  beforeAll(() => {
    originalFetch = global.fetch;
    global.fetch = jest.fn(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
        headers: new Map(),
      })
    );
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('should build a query URL correctly using polyfilled searchParams', async () => {
    // Fazer uma query básica
    await supabase
      .from('protocols')
      .select('id,name')
      .eq('user_id', 'user-123')
      .order('name', { ascending: true });

    // Verificar a URL chamada no fetch
    // No Supabase, a URL é construída via toString() da URL do Postgrest
    expect(global.fetch).toHaveBeenCalled();
    const callUrl = global.fetch.mock.calls[0][0];
    
    // Validar se contém os parâmetros e não tem a barra final problemática (PGRST125)
    expect(callUrl).toContain('rest/v1/protocols?');
    expect(callUrl).not.toContain('protocols/?'); // R-168: trailing slash fix
    expect(callUrl).toContain('select=id%2Cname');
    expect(callUrl).toContain('user_id=eq.user-123');
    expect(callUrl).toContain('order=name.asc');
  });

  it('should build an RPC URL correctly', async () => {
    await supabase.rpc('generate_telegram_token', { user_id: '123' });

    const lastCall = global.fetch.mock.calls[global.fetch.mock.calls.length - 1][0];
    expect(lastCall).toContain('rest/v1/rpc/generate_telegram_token');
    expect(lastCall).not.toContain('generate_telegram_token/');
  });
});
