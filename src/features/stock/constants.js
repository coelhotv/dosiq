/**
 * Constantes compartilhadas do módulo de Estoque.
 */

// Prefixos de notas geradas automaticamente pelo sistema ao deletar doses.
// stockService.increase() cria entradas reais na tabela stock — não são compras reais.
// Usados para filtrar o histórico de compras (lastPurchase e EntradaHistorico).
export const SYSTEM_NOTE_PREFIXES = ['Dose excluída', 'Ajuste de dose']
