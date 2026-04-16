/**
 * @jest-environment node
 */

// polyfills.test.js — Testar os monkey-patches do Hermes
// Como os polyfills só se aplicam se detectarem "not implemented",
// precisamos de simular esse comportamento para testar a nossa implementação.

const originalURL = global.URL;
const originalURLSearchParams = global.URLSearchParams;

describe('Hermes Polyfills Implementation', () => {
  beforeEach(() => {
    jest.resetModules();
    // Limpar o global para forçar o polyfill
    delete global.URL;
    delete global.URLSearchParams;
    
    // Simular uma URL "quebrada" do Hermes
    global.URL = function(href) {
      this.href = href;
    };
    
    global.URL.prototype = {
      get protocol() { throw new Error('not implemented'); },
      get hostname() { throw new Error('not implemented'); },
      get searchParams() { throw new Error('not implemented'); },
      toString() { return this.href; }
    };
    
    global.URLSearchParams = undefined;
    
    // Carregar o polyfill
    require('../../polyfills.js');
  });

  afterAll(() => {
    global.URL = originalURL;
    global.URLSearchParams = originalURLSearchParams;
  });

  describe('URL Object Patches', () => {
    it('should correctly parse and return protocol', () => {
      const url = new URL('https://example.com/api');
      expect(url.protocol).toBe('https:');
    });

    it('should correctly set protocol', () => {
      const url = new URL('http://example.com');
      url.protocol = 'https:';
      expect(url.href).toBe('https://example.com');
    });

    it('should handle protocol without colon', () => {
      const url = new URL('http://example.com');
      url.protocol = 'https';
      expect(url.href).toBe('https://example.com');
    });

    it('should correctly parsing and return hostname', () => {
      const url = new URL('https://api.meus-remedios.com/v1');
      expect(url.hostname).toBe('api.meus-remedios.com');
    });

    it('should handle URL with port in toString() correctly', () => {
      const url = new URL('http://localhost:3000/rest/v1');
      // toString() customizado para bypass de IP/localhost (R-118)
      expect(url.toString()).toBe('http://localhost:3000/rest/v1');
    });
  });

  describe('URLSearchParams via _searchPairs (Strategy A)', () => {
    it('accumulates parameters correctly', () => {
      const url = new URL('https://example.co/rest/v1/protocols');
      const sp = url.searchParams;
      sp.set('select', 'id,name');
      sp.append('user_id', 'eq.123');
      
      const result = url.toString();
      expect(result).toContain('select=id%2Cname');
      expect(result).toContain('user_id=eq.123');
    });

    it('removes trailing slash from path (PGRST125 fix)', () => {
      // O Hermes às vezes adiciona / no fim do path: /protocols/
      const url = new URL('https://example.co/rest/v1/protocols/');
      url.searchParams.set('select', 'id');
      
      const result = url.toString();
      expect(result).toContain('/protocols?'); // Sem a barra
      expect(result).not.toContain('/protocols/?');
    });

    it('manages set/get/delete correctly', () => {
      const url = new URL('https://example.co');
      const sp = url.searchParams;
      sp.set('test', '1');
      expect(sp.get('test')).toBe('1');
      
      sp.delete('test');
      expect(sp.get('test')).toBeNull();
    });
  });

  describe('Global URLSearchParams Patch', () => {
    it('should provide a working URLSearchParams class', () => {
      expect(global.URLSearchParams).toBeDefined();
      const params = new URLSearchParams('a=1&b=2');
      expect(params.get('a')).toBe('1');
      expect(params.get('b')).toBe('2');
    });

    it('should handle object initialization', () => {
      const params = new URLSearchParams({ x: '10', y: '20' });
      expect(params.get('x')).toBe('10');
      expect(params.get('y')).toBe('20');
      expect(params.toString()).toBe('x=10&y=20');
    });
  });
});
