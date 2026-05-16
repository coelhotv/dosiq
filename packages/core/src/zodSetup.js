// zodSetup.js — mensagens de erro Zod amigáveis em PT-BR (Dona Maria friendly).
//
// Estratégia: customError tem prioridade sobre locale. Cobrimos os códigos
// mais comuns com texto curto e sem jargão técnico. Casos não cobertos
// caem no locale PT padrão do Zod 4.

import { z } from 'zod'
import pt from 'zod/v4/locales/pt'

// Mensagens base por código (sem mencionar tipo/recebido/expected etc).
// eslint-disable-next-line complexity
function friendlyMessage(issue) {
  switch (issue.code) {
    case 'invalid_type': {
      // Vazio/null/undefined → obrigatório.
      if (
        issue.input === undefined ||
        issue.input === null ||
        issue.input === ''
      ) {
        return 'Este campo é obrigatório'
      }
      // Tipo numérico esperado mas veio outra coisa.
      if (issue.expected === 'number') {
        return 'Use apenas números'
      }
      return 'Valor inválido'
    }
    case 'too_small': {
      if (issue.origin === 'string') {
        return issue.minimum === 1
          ? 'Este campo é obrigatório'
          : `Use pelo menos ${issue.minimum} caracteres`
      }
      if (issue.origin === 'number') {
        return issue.minimum === 0
          ? 'O valor deve ser maior que zero'
          : `O valor deve ser maior ou igual a ${issue.minimum}`
      }
      return 'Valor abaixo do mínimo'
    }
    case 'too_big': {
      if (issue.origin === 'string') {
        return `Use no máximo ${issue.maximum} caracteres`
      }
      if (issue.origin === 'number') {
        return `O valor deve ser menor ou igual a ${issue.maximum}`
      }
      return 'Valor acima do máximo'
    }
    case 'invalid_format': {
      if (issue.format === 'email') return 'E-mail inválido'
      if (issue.format === 'url') return 'Endereço web inválido'
      return 'Formato inválido'
    }
    case 'invalid_value':
    case 'invalid_enum_value':
      return 'Escolha uma das opções disponíveis'
    case 'not_multiple_of':
      return 'Valor inválido'
    default:
      return null
  }
}

const ptLocale = pt().localeError

z.config({
  customError: (issue) => {
    const friendly = friendlyMessage(issue)
    if (friendly) return friendly
    // Fallback no locale PT padrão do Zod 4
    return ptLocale(issue)
  },
})
