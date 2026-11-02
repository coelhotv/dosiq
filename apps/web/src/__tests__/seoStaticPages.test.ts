import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * Spec 114 — integridade das páginas estáticas de conteúdo (SEO/AEO/GEO).
 * Lê os arquivos de `public/` como texto: são HTML puro, sem JS de cliente (INV-5).
 */

const PUBLIC = path.resolve(__dirname, '../../public')
const LANDING_TSX = path.resolve(__dirname, '../views/landing/Landing.tsx')
const BASE = 'https://dosiq.app'

// 14 páginas de conteúdo (rota limpa → arquivo em public/)
const PAGES = [
  'glp-1',
  'insulina-e-glicemia',
  'injecao-mensal',
  'guia/rodizio-aplicacao',
  'guia/esqueci-dose-semanal',
  'guia/validade-caneta-aberta',
  'guia/horario-8-em-8-horas',
  'guia/horario-12-em-12-horas',
  'guia/horario-6-em-6-horas',
  'guia/alarme-remedio-silencioso-iphone-android',
  'guia/melhor-horario-remedio-pressao',
  'guia/melhor-horario-remedio-tireoide',
  'guia/melhor-horario-remedio-colesterol',
  'guia/melhor-horario-remedio-diabetes',
] as const

// Grupo canetas/insulina → páginas customizadas das lojas (CPP Apple / CSL Google, PO 2026-11-02)
const PEN_GROUP = new Set<string>([
  'glp-1',
  'insulina-e-glicemia',
  'guia/rodizio-aplicacao',
  'guia/esqueci-dose-semanal',
  'guia/validade-caneta-aberta',
])
const CPP_PPID = 'ppid=54dda8c3-f7f3-4a81-900a-1df0c0833a54'
const CSL_LISTING = 'listing=canetas-injetaveis'

// Marcas/princípios exigidos por página (matriz do dossiê §4 + clinical-verification.md)
const REQUIRED_TERMS: Record<string, string[]> = {
  'glp-1': ['Ozempic®', 'Wegovy®', 'Mounjaro®', 'Saxenda®', 'Rybelsus®', 'Olire®', 'Lirux®', 'semaglutida', 'tirzepatida', 'liraglutida'],
  'insulina-e-glicemia': ['Lantus®', 'Basaglar®', 'Tresiba®', 'NPH'],
  'injecao-mensal': ['Mesigyna®', 'Perlutan®', 'Depo-Provera®'],
  'guia/rodizio-aplicacao': ['Ozempic®', 'Mounjaro®', 'Lantus®'],
  'guia/esqueci-dose-semanal': ['Ozempic®', 'Wegovy®', 'Mounjaro®', 'Trulicity®', 'Dulaglutida', 'Saxenda®', '72 horas'],
  'guia/validade-caneta-aberta': ['Ozempic®', 'Wegovy®', 'Mounjaro®', 'Saxenda®', 'Victoza®', 'Olire®', 'Lirux®', '42 dias'],
  'guia/horario-8-em-8-horas': ['/guia/horario-12-em-12-horas', '/guia/horario-6-em-6-horas'],
  'guia/horario-12-em-12-horas': ['12 em 12 horas', '08:00 · 20:00', '07:00 · 19:00', '09:00 · 21:00', 'Clavulin®', '/guia/horario-8-em-8-horas'],
  'guia/horario-6-em-6-horas': ['6 em 6 horas', '06:00 · 12:00 · 18:00 · 00:00', '07:00 · 13:00 · 19:00 · 01:00', 'Keflex®', 'Tylenol®', 'Dipirona', '/guia/horario-8-em-8-horas'],
  'guia/alarme-remedio-silencioso-iphone-android': ['Alerta Crítico'],
  'guia/melhor-horario-remedio-pressao': ['Selozok®', 'Seloken®', 'Cozaar®', 'Renitec®', 'Norvasc®', 'Benicar®', 'Hidroclorotiazida', 'TIME', '30–40%'],
  'guia/melhor-horario-remedio-tireoide': ['Puran T4®', 'Euthyrox®', 'Synthroid®', 'Levotiroxina', '4 horas'],
  'guia/melhor-horario-remedio-colesterol': ['Zocor®', 'Crestor®', 'Citalor®', 'Trezete®', 'Sinvastatina', 'Rosuvastatina'],
  'guia/melhor-horario-remedio-diabetes': ['Glifage® XR', 'Diamicron® MR', 'Forxiga®', 'Jardiance®', 'Lantus®', 'Tresiba®', 'NPH'],
}

// Funcionalidades fora da loja ≤ 0.34 (allowlist §3.1) — pontes não podem prometer
const BLACKLIST = [/tela cheia/i, /assistente de bateria/i, /otimiza[çc][ãa]o de bateria/i, /cuidador/i, /21\s*\+\s*7/, /aviso de compra/i]

const read = (rel: string) => fs.readFileSync(path.join(PUBLIC, rel), 'utf8')
const html = (p: string) => read(`${p}.html`)
const md = (p: string) => read(`${p}.md`)

const decode = (s: string) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()

type Node = Record<string, unknown> & { '@type'?: string }

function jsonLd(page: string): Node[] {
  const m = html(page).match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
  expect(m, `${page}: sem JSON-LD`).toBeTruthy()
  const doc = JSON.parse((m as RegExpMatchArray)[1]) as { '@graph': Node[] }
  return doc['@graph']
}

const byType = (graph: Node[], type: string) => graph.find((n) => n['@type'] === type)

/** Texto visível do `<article class="qa__item">` cujo heading h2/h3 é exatamente a pergunta. */
function visibleAnswer(page: string, question: string): string | null {
  const src = html(page)
  for (const m of src.matchAll(/<article class="qa__item">([\s\S]*?)<\/article>/g)) {
    const h = m[1].match(/^\s*<h([23])>([\s\S]*?)<\/h\1>([\s\S]*)$/)
    if (h && decode(h[2]) === question) return decode(h[3].replace(/<\/(p|li)>/g, ' '))
  }
  return null
}

const storeHrefs = (src: string, host: string) =>
  [...src.matchAll(/<a href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&')).filter((h) => h.includes(host))

function footerHrefs(src: string, marker: string): Set<string> {
  const start = src.indexOf(marker)
  expect(start, `rodapé ${marker} ausente`).toBeGreaterThan(-1)
  const end = src.indexOf('</nav>', start) > -1 && marker.includes('lp-footer') ? src.indexOf('</nav>', start) : src.indexOf('ft__bottom', start)
  return new Set([...src.slice(start, end).matchAll(/href="(\/[^"]*)"/g)].map((m) => m[1]))
}

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

const CONTENT_ROUTES = new Set(PAGES.map((p) => `/${p}`))

describe.each(PAGES)('página %s', (page) => {
  it('existe em .html e .md', () => {
    expect(fs.existsSync(path.join(PUBLIC, `${page}.html`))).toBe(true)
    expect(fs.existsSync(path.join(PUBLIC, `${page}.md`))).toBe(true)
  })

  it('tem canonical, title e h1 próprios', () => {
    const src = html(page)
    expect(src).toContain(`<link rel="canonical" href="${BASE}/${page}">`)
    expect(src).toContain(`<link rel="alternate" type="text/markdown" href="${BASE}/${page}.md">`)
    expect(src).toMatch(/<title>[^<]+<\/title>/)
    expect(src).toMatch(/<h1>[\s\S]+?<\/h1>/)
  })

  it('JSON-LD: MedicalWebPage + FAQPage + Organization com desambiguação, sem citar o clone', () => {
    const graph = jsonLd(page)
    const pageNode = byType(graph, 'MedicalWebPage')
    expect(pageNode?.url).toBe(`${BASE}/${page}`)
    expect(byType(graph, 'FAQPage')).toBeTruthy()
    const org = byType(graph, 'Organization')
    const dis = String(org?.disambiguatingDescription ?? '')
    expect(dis).toContain('68.335.606/0001-11')
    expect(dis).toContain('6762740948')
    expect(dis).toContain('com.coelhotv.dosiq')
    const sameAs = (org?.sameAs ?? []) as string[]
    expect(sameAs).toContain('https://www.linkedin.com/company/dosiq/')
    expect(sameAs).toContain('https://github.com/dosiq-app/dosiq')
    expect(sameAs.some((u) => u.includes('play.google.com'))).toBe(true)
    expect(sameAs.some((u) => u.includes('apps.apple.com'))).toBe(true)
    expect(html(page)).not.toContain('com.dosiq.app')
    expect(html(page)).not.toContain('Aura Management')
  })

  it('FAQ visível = FAQPage do JSON-LD (1:1, INV-4)', () => {
    const faq = byType(jsonLd(page), 'FAQPage') as { mainEntity: Array<{ name: string; acceptedAnswer: { text: string } }> }
    expect(faq.mainEntity.length).toBeGreaterThanOrEqual(3)
    for (const q of faq.mainEntity) {
      expect(visibleAnswer(page, decode(q.name)), `${page}: pergunta sem par visível: ${q.name}`).toBe(
        decode(q.acceptedAnswer.text),
      )
    }
  })

  it('tem a ponte "Como fazer isso no dosiq" no .html e no .md (INV-2)', () => {
    expect(html(page)).toContain('Como fazer isso no dosiq')
    expect(md(page)).toContain('Como fazer isso no dosiq')
  })

  it('cita as marcas/termos exigidos no .html e no .md', () => {
    for (const term of REQUIRED_TERMS[page]) {
      // marca com ® exige grafia exata; princípio ativo/termo aceita caixa diferente
      const norm = (s: string) => (term.includes('®') ? s : s.toLowerCase())
      expect(norm(html(page)), `${page}.html sem ${term}`).toContain(norm(term))
      if (!term.startsWith('/')) expect(norm(md(page)), `${page}.md sem ${term}`).toContain(norm(term))
    }
  })

  it('marca registrada citada ⇒ cláusula de não-afiliação (INV-3)', () => {
    for (const src of [html(page), md(page)]) {
      if (src.includes('®')) expect(src).toMatch(/não é afiliado/)
    }
  })

  it('links de loja com atribuição válida; grupo canetas/insulina usa CPP/CSL', () => {
    const src = html(page)
    const apple = storeHrefs(src, 'apps.apple.com')
    const play = storeHrefs(src, 'play.google.com')
    expect(apple.length).toBeGreaterThanOrEqual(2)
    expect(play.length).toBeGreaterThanOrEqual(2)
    for (const h of apple) {
      expect(h).toContain('apps.apple.com/br/app/')
      expect(h).toContain('pt=128807500')
      expect(h).toMatch(/ct=landing_[a-z0-9-]+/)
      expect(h.includes(CPP_PPID)).toBe(PEN_GROUP.has(page))
    }
    for (const h of play) {
      expect(h).toContain('id=com.coelhotv.dosiq')
      expect(h).toMatch(/referrer=utm_source%3Dguia_[a-z0-9-]+/)
      expect(h.includes(CSL_LISTING)).toBe(PEN_GROUP.has(page))
    }
  })

  it('não promete funcionalidade fora da loja (PO-114-6)', () => {
    for (const src of [html(page), md(page)]) for (const re of BLACKLIST) expect(src).not.toMatch(re)
  })

  it('zero JavaScript de cliente (INV-5)', () => {
    const scripts = [...html(page).matchAll(/<script([^>]*)>/g)].map((m) => m[1])
    for (const attrs of scripts) expect(attrs).toContain('application/ld+json')
  })

  it('rodapé = mini-sitemap com os 14 conteúdos, todos resolvendo para arquivo', () => {
    const hrefs = footerHrefs(html(page), '<footer class="ft">')
    for (const r of CONTENT_ROUTES) expect(hrefs.has(r), `${page}: rodapé sem ${r}`).toBe(true)
    for (const h of hrefs) {
      if (h === '/') continue
      expect(fs.existsSync(path.join(PUBLIC, `${h.slice(1)}.html`)), `${page}: link quebrado ${h}`).toBe(true)
    }
  })
})

describe('erros clínicos no ar corrigidos (FR-016 / clinical-verification §A)', () => {
  const files = PAGES.flatMap((p) => [`${p}.html`, `${p}.md`])

  it.each(files)('%s não traz "Dulaglutina"', (f) => {
    expect(read(f)).not.toContain('Dulaglutina')
  })

  it.each(files.filter((f) => [...PEN_GROUP].some((p) => f.startsWith(`${p}.`))))(
    '%s não associa semaglutida a 56 dias / 8 semanas',
    (f) => {
      expect(read(f)).not.toMatch(/56 dias|8 semanas|21 e 56|28 a 56/)
    },
  )

  it('esqueci-dose-semanal não usa 48 horas como intervalo de troca de dia', () => {
    expect(html('guia/esqueci-dose-semanal')).not.toContain('48 horas')
    expect(md('guia/esqueci-dose-semanal')).not.toContain('48 horas')
  })
})

describe('llms.txt (desambiguação e descoberta)', () => {
  const llms = read('llms.txt')

  it('lista as 14 rotas HTML e os 14 .md', () => {
    for (const p of PAGES) {
      expect(llms).toContain(`${BASE}/${p}`)
      expect(llms).toContain(`${BASE}/${p}.md`)
    }
  })

  it('declara a entidade e se desambigua do app homônimo', () => {
    expect(llms).toContain('68.335.606/0001-11')
    expect(llms).toContain('com.dosiq.app')
    expect(llms).toContain('Aura Management LLC')
    expect(llms).not.toContain('não marcas comerciais')
  })
})

describe('sitemap.xml', () => {
  const locs = [...read('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])

  it('tem 17 URLs: home + 14 conteúdos + privacidade + termos', () => {
    expect(locs).toHaveLength(17)
    for (const p of PAGES) expect(locs).toContain(`${BASE}/${p}`)
    expect(locs).toContain(`${BASE}/`)
    expect(locs).toContain(`${BASE}/politica-de-privacidade`)
    expect(locs).toContain(`${BASE}/termos-de-uso`)
  })
})

describe('paridade de rodapé Landing SPA × estático (FR-015)', () => {
  it('lp-footer__nav tem o mesmo conjunto de links internos do rodapé estático', () => {
    const spa = footerHrefs(fs.readFileSync(LANDING_TSX, 'utf8'), 'lp-footer__nav')
    const stat = footerHrefs(html('glp-1'), '<footer class="ft">')
    expect([...spa].sort()).toEqual([...stat].sort())
  })
})

