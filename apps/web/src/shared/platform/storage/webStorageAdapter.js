/**
 * webStorageAdapter — Adapter de storage para web (localStorage)
 *
 * Instancia do adapter web criada a partir do contrato H3.1.
 * Unico local na web onde window.localStorage e acessado diretamente.
 * packages/storage NAO acessa window — apenas este arquivo de bootstrap.
 */
import { createWebStorageAdapter } from '@meus-remedios/storage'

export const webStorageAdapter = createWebStorageAdapter(window.localStorage)
