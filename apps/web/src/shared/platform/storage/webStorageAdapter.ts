/**
 * webStorageAdapter — Adapter de storage para web (localStorage)
 *
 * Instancia do adapter web criada a partir do contrato H3.1.
 * Unico local na web onde window.localStorage e acessado diretamente.
 * packages/storage NAO acessa window — apenas este arquivo de bootstrap.
 */
import { createWebStorageAdapter } from '@dosiq/storage'

// Safe access for window.localStorage to avoid crashes in some test environments
const storage = (typeof window !== 'undefined' && window.localStorage) 
  ? window.localStorage 
  : { getItem: () => null, setItem: () => {}, removeItem: () => {} };

export const webStorageAdapter = createWebStorageAdapter(storage)
