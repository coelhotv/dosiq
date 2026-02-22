/**
 * Testes de validação do GEMINI_AGENT_PROTOCOL.md
 *
 * Estes testes garantem que:
 * 1. Todos os endpoints estão documentados
 * 2. Os exemplos JSON são válidos
 * 3. Os schemas estão consistentes
 *
 * @module geminiAgentProtocolTests
 */

import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'fs'
import path from 'path'

// ============================================================================
// FIXTURES E HELPERS
// ============================================================================

const PROTOCOL_PATH = path.join(process.cwd(), 'docs/standards/GEMINI_AGENT_PROTOCOL.md')

/**
 * Extrai blocos de código JSON de um conteúdo Markdown
 * @param {string} content - Conteúdo do arquivo Markdown
 * @returns {Array<{language: string, code: string}>} Blocos de código encontrados
 */
function extractCodeBlocks(content) {
  const blocks = []
  // Regex para capturar blocos de código com ou sem especificação de linguagem
  const regex = /```(\w+)?\n([\s\S]*?)```/g
  let match

  while ((match = regex.exec(content)) !== null) {
    blocks.push({
      language: match[1] || 'text',
      code: match[2].trim()
    })
  }

  return blocks
}

/**
 * Verifica se um JSON é válido
 * @param {string} jsonString - String JSON a ser validada
 * @returns {{valid: boolean, error?: string, data?: any}} Resultado da validação
 */
function validateJson(jsonString) {
  try {
    const data = JSON.parse(jsonString)
    return { valid: true, data }
  } catch (error) {
    return { valid: false, error: error.message }
  }
}

// ============================================================================
// SUITE DE TESTES
// ============================================================================

describe('GEMINI_AGENT_PROTOCOL.md', () => {
  let protocolContent

  beforeAll(() => {
    protocolContent = fs.readFileSync(PROTOCOL_PATH, 'utf-8')
  })

  // ========================================================================
  // Testes de Estrutura
  // ========================================================================

  describe('Estrutura do Documento', () => {
    it('deve ter título principal', () => {
      expect(protocolContent).toMatch(/^# Protocolo Padronizado para Agents/)
    })

    it('deve especificar a versão', () => {
      expect(protocolContent).toMatch(/\*\*Versão:\*\*\s+\d+\.\d+\.\d+/)
    })

    it('deve ter seção de Visão Geral', () => {
      expect(protocolContent).toContain('## 📋 Visão Geral')
      expect(protocolContent).toContain('### Propósito')
    })

    it('deve ter seção de Endpoints da API', () => {
      expect(protocolContent).toContain('## 🔌 Endpoints da API')
    })

    it('deve ter seção de Estados do Review', () => {
      expect(protocolContent).toContain('## 🔄 Estados do Review')
    })

    it('deve ter seção de Resoluções', () => {
      expect(protocolContent).toContain('## ✅ Resoluções')
    })

    it('deve ter seção de Exemplos de Uso', () => {
      expect(protocolContent).toContain('## 📖 Exemplos de Uso')
    })

    it('deve ter seção de Autenticação', () => {
      expect(protocolContent).toContain('## 🔐 Autenticação')
    })

    it('deve ter seção de Webhooks', () => {
      expect(protocolContent).toContain('## 🔔 Webhooks')
    })
  })

  // ========================================================================
  // Testes de Endpoints
  // ========================================================================

  describe('Endpoints Documentados', () => {
    it('deve documentar endpoint GET /gemini-reviews (listar)', () => {
      expect(protocolContent).toContain('GET /gemini-reviews')
      expect(protocolContent).toContain('Listar Reviews')
    })

    it('deve documentar endpoint GET /gemini-reviews/:id (obter)', () => {
      expect(protocolContent).toContain('GET /gemini-reviews/:id')
      expect(protocolContent).toContain('Obter Review Específica')
    })

    it('deve documentar endpoint PATCH /gemini-reviews/:id (atualizar)', () => {
      expect(protocolContent).toContain('PATCH /gemini-reviews/:id')
      expect(protocolContent).toContain('Atualizar Status da Review')
    })
  })

  // ========================================================================
  // Testes de Estados
  // ========================================================================

  describe('Estados do Review', () => {
    const expectedStatuses = ['pendente', 'em_progresso', 'corrigido', 'descartado']

    expectedStatuses.forEach(status => {
      it(`deve documentar o estado '${status}'`, () => {
        expect(protocolContent).toContain(`\`${status}\``)
      })
    })

    it('deve ter tabela de transições permitidas', () => {
      expect(protocolContent).toContain('Transições Permitidas')
      expect(protocolContent).toMatch(/\| Estado \| Descrição \|/)
    })
  })

  // ========================================================================
  // Testes de Resoluções
  // ========================================================================

  describe('Resoluções', () => {
    const expectedResolutions = ['fixed', 'rejected', 'partial']

    expectedResolutions.forEach(resolution => {
      it(`deve documentar a resolução '${resolution}'`, () => {
        expect(protocolContent).toContain(`\`${resolution}\``)
      })
    })

    it('deve ter tabela de tipos de resolução', () => {
      expect(protocolContent).toContain('Tipos de Resolução')
      expect(protocolContent).toMatch(/\| Resolução \| Descrição \|/)
    })
  })

  // ========================================================================
  // Testes de JSON Válido
  // ========================================================================

  describe('Exemplos JSON Válidos', () => {
    it('deve ter pelo menos 5 blocos JSON', () => {
      const jsonBlocks = extractCodeBlocks(protocolContent).filter(
        block => block.language === 'json'
      )
      expect(jsonBlocks.length).toBeGreaterThanOrEqual(5)
    })

    it('todos os blocos JSON devem ser válidos', () => {
      const jsonBlocks = extractCodeBlocks(protocolContent).filter(
        block => block.language === 'json'
      )

      const invalidBlocks = []
      jsonBlocks.forEach((block, index) => {
        const result = validateJson(block.code)
        if (!result.valid) {
          invalidBlocks.push({ index: index + 1, error: result.error })
        }
      })

      expect(invalidBlocks).toEqual([])
    })
  })

  // ========================================================================
  // Testes de Schema JSON
  // ========================================================================

  describe('Schema JSON de Validação', () => {
    it('deve conter schema JSON para requisição de atualização', () => {
      expect(protocolContent).toContain('JSON Schema - Requisição de Atualização')
      expect(protocolContent).toContain('$schema')
      expect(protocolContent).toContain('"required": ["status"]')
    })

    it('deve validar enum de status no schema', () => {
      const statusEnumMatch = protocolContent.match(
        /"enum":\s*\[\s*"pendente"\s*,\s*"em_progresso"\s*,\s*"corrigido"\s*,\s*"descartado"\s*\]/
      )
      expect(statusEnumMatch).toBeTruthy()
    })

    it('deve validar enum de resolução no schema', () => {
      const resolutionEnumMatch = protocolContent.match(
        /"enum":\s*\[\s*"fixed"\s*,\s*"rejected"\s*,\s*"partial"\s*\]/
      )
      expect(resolutionEnumMatch).toBeTruthy()
    })
  })

  // ========================================================================
  // Testes de Autenticação
  // ========================================================================

  describe('Autenticação', () => {
    it('deve documentar Bearer Token', () => {
      expect(protocolContent).toContain('Bearer Token')
      expect(protocolContent).toContain('Authorization: Bearer')
    })

    it('deve documentar Service Role Key', () => {
      expect(protocolContent).toContain('SUPABASE_SERVICE_ROLE_KEY')
    })

    it('deve ter aviso de segurança sobre a Service Role Key', () => {
      expect(protocolContent).toMatch(/⚠️.*ATENÇÃO.*Service Role Key/)
    })
  })

  // ========================================================================
  // Testes de Webhook
  // ========================================================================

  describe('Webhooks', () => {
    it('deve documentar evento gemini_review_available', () => {
      expect(protocolContent).toContain('gemini_review_available')
    })

    it('deve ter exemplo de payload de webhook', () => {
      expect(protocolContent).toContain('Payload do Webhook')
      expect(protocolContent).toMatch(/"event":\s*"gemini_review_available"/)
    })

    it('deve ter exemplo de handler de webhook', () => {
      expect(protocolContent).toContain('Como Responder ao Webhook')
    })
  })

  // ========================================================================
  // Testes de Códigos HTTP
  // ========================================================================

  describe('Códigos de Resposta HTTP', () => {
    const expectedCodes = ['200', '201', '400', '401', '403', '404', '422', '429', '500']

    expectedCodes.forEach(code => {
      it(`deve documentar código HTTP ${code}`, () => {
        expect(protocolContent).toContain(`\`${code}\``)
      })
    })

    it('deve ter tabela de códigos HTTP', () => {
      expect(protocolContent).toContain('Códigos de Resposta HTTP')
      expect(protocolContent).toMatch(/\| Código \| Significado \|/)
    })
  })

  // ========================================================================
  // Testes de Exemplos cURL
  // ========================================================================

  describe('Exemplos cURL', () => {
    it('deve ter exemplo de listar reviews', () => {
      expect(protocolContent).toContain('Listar Reviews Pendentes')
      expect(protocolContent).toMatch(/curl.*GET.*gemini-reviews/)
    })

    it('deve ter exemplo de obter review', () => {
      expect(protocolContent).toContain('Obter Review Específica')
      expect(protocolContent).toMatch(/curl.*GET.*gemini-reviews/)
    })

    it('deve ter exemplo de atualizar review', () => {
      expect(protocolContent).toContain('Atualizar Status')
      expect(protocolContent).toMatch(/curl.*PATCH.*gemini-reviews/)
    })

    it('deve ter exemplo de descartar review', () => {
      expect(protocolContent).toContain('Descartar Review')
    })

    it('deve ter exemplo em JavaScript/Node.js', () => {
      expect(protocolContent).toContain('Usando JavaScript/Node.js')
    })
  })

  // ========================================================================
  // Testes de Consistência com Schemas
  // ========================================================================

  describe('Consistência com Schemas do Projeto', () => {
    it('deve usar status consistentes com REVIEW_STATUSES', () => {
      // Status no schema: pendente, em_progresso, corrigido, descartado
      const statusesInDoc = ['pendente', 'em_progresso', 'corrigido', 'descartado']
      statusesInDoc.forEach(status => {
        expect(protocolContent).toContain(status)
      })
    })

    it('deve usar categorias válidas', () => {
      const categories = ['estilo', 'bug', 'seguranca', 'performance', 'manutenibilidade']
      categories.forEach(category => {
        expect(protocolContent).toContain(category)
      })
    })

    it('deve usar prioridades válidas', () => {
      const priorities = ['critica', 'alta', 'media', 'baixa']
      priorities.forEach(priority => {
        expect(protocolContent).toContain(priority)
      })
    })
  })

  // ========================================================================
  // Testes de Headers
  // ========================================================================

  describe('Headers Obrigatórios', () => {
    it('deve documentar header Content-Type', () => {
      expect(protocolContent).toContain('Content-Type')
      expect(protocolContent).toContain('application/json')
    })

    it('deve documentar header Authorization', () => {
      expect(protocolContent).toContain('Authorization')
    })

    it('deve documentar header Accept', () => {
      expect(protocolContent).toContain('Accept')
    })
  })

  // ========================================================================
  // Testes de Referências
  // ========================================================================

  describe('Referências Cruzadas', () => {
    it('deve referenciar GEMINI_INTEGRATION.md', () => {
      expect(protocolContent).toContain('[GEMINI_INTEGRATION.md]')
    })

    it('deve referenciar TESTING.md', () => {
      expect(protocolContent).toContain('[TESTING.md]')
    })

    it('deve referenciar GIT_WORKFLOW.md', () => {
      expect(protocolContent).toContain('[GIT_WORKFLOW.md]')
    })
  })

  // ========================================================================
  // Testes de Changelog
  // ========================================================================

  describe('Changelog', () => {
    it('deve ter seção de changelog', () => {
      expect(protocolContent).toContain('## 📝 Changelog')
    })

    it('deve ter versão 1.0.0 documentada', () => {
      expect(protocolContent).toMatch(/\|\s*1\.0\.0\s*\|/)
    })
  })
})

// ============================================================================
// Testes de Smoke
// ============================================================================

describe('GEMINI_AGENT_PROTOCOL.md - Smoke Tests', () => {
  let smokeContent

  beforeAll(() => {
    smokeContent = fs.readFileSync(PROTOCOL_PATH, 'utf-8')
  })

  it('arquivo existe e é legível', () => {
    expect(fs.existsSync(PROTOCOL_PATH)).toBe(true)
    expect(smokeContent.length).toBeGreaterThan(0)
  })

  it('arquivo tem mais de 5000 caracteres (documentação completa)', () => {
    expect(smokeContent.length).toBeGreaterThan(5000)
  })

  it('arquivo contém pelo menos 10 blocos de código', () => {
    const codeBlocks = extractCodeBlocks(smokeContent)
    expect(codeBlocks.length).toBeGreaterThanOrEqual(10)
  })
})
