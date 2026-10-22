# Guia Operacional — Molde de Landings Estáticas (SEO & AEO/GEO)

> **Documento Canônico:** `docs/operations/GUIA_MOLDE_LANDINGS_SEO_AEO.md`  
> **Origem:** `Spec 048` (Slices A e C) · **Versão:** 1.0.0 (Atualizado pós-v0.34.0)  
> **Finalidade:** Referência técnica e contratual para criação de novas páginas públicas de aquisição orgânica para motores de busca (Google) e motores de resposta IA (ChatGPT, Perplexity, Claude, Gemini).

---

## 1. Princípios de Arquitetura do Molde

1. **HTML Estático Puro (Zero JavaScript no Client):**
   - As páginas públicas de aquisição residem em `apps/web/public/` e são servidas diretamente pelo CDN/edge da Vercel.
   - Zero hidratação React, zero overhead de bundle: pontuação 100/100 no Google PageSpeed / Core Web Vitals.
2. **Estilo Unificado e Compacto (`landing-static.css`):**
   - Todas as páginas estáticas compartilham uma única folha de estilos: [`/landing-static.css`](file:///Users/coelhotv/git/dosiq/apps/web/public/landing-static.css).
   - Paleta de cores oficial *Therapeutic Sanctuary* (`--brand: #004d45`, `--brand-light: #e6f4f1`, `--slate-900: #0f172a`).
   - Tipografia da marca: **`Comfortaa` Bold (700)** em minúsculas (`dosiq`) no logo, combinada com `Public Sans` para títulos e `Lexend` para corpo de texto.
3. **Ponte de Conversão para os Apps e Web:**
   - O cabeçalho estático traz botões de entrada direta na aplicação: `Entrar` (`/?login=1`) e `Criar conta` (`/?signup=1`).
   - Os CTAs trazem badges oficiais da **Apple App Store** e **Google Play Store** devidamente parametrizados com UTMs exclusivas de atribuição.

---

## 2. Contrato de Invariantes Obrigatórias (`INV-1` a `INV-6`)

Qualquer página criada com o molde deve atender estritamente às 6 invariantes regulatórias e técnicas:

| Invariante | Regra | Exemplo Válido | Exemplo Proibido (Bug / Infração) |
|---|---|---|---|
| **`INV-1`** | **INN-Only em Metadados:** Proibido citar marcas comerciais em `<title>`, `<meta description>`, `<meta og:title>` e `<h1>`. Usar exclusivamente a Denominação Comum Brasileira (DCB) / Internacional (INN) ou termos de procedimento clínico. | `Titulação de semaglutida e tirzepatida` | `Titulação de Ozempic e Mounjaro` |
| **`INV-2`** | **Funcionalidade Real:** O guia/landing só pode recomendar recursos que já estejam 100% implementados e no ar na release atual do Dosiq. | Alerta Crítico no silencioso, código de barras ANVISA, mapa do corpo, PDF médico. | "Em breve integração com smartwatch", "Suporte no WhatsApp". |
| **`INV-3`** | **Fronteira SaMD Estrita:** O texto é puramente informativo e descritivo; nunca sugere, calcula, diagnostica ou altera dosagens por conta própria. | "A conduta depende da bula e do profissional que prescreveu." | "Tome 0,5 mg se esquecer por 2 dias." |
| **`INV-4`** | **Disclaimer de Autoria:** O rodapé deve declarar data de revisão e explicitar que o conteúdo não substitui consulta nem foi revisado individualmente por médico. | `"Revisado em 21 de outubro de 2026 · Não houve revisão por profissional de saúde."` | `"Artigo revisado clinicamente pelo Dr. X."` |
| **`INV-5`** | **UTM Canônica e Exclusiva:** Cada página deve possuir sua própria UTM de origem nos links para as lojas. | `utm_source=guia_rodizio-aplicacao` | `utm_source=landing_glp1` em página de rodízio |
| **`INV-6`** | **Transparência Legal (PJ ativa):** O rodapé deve exibir a identificação completa da entidade legal mantenedora. | `DOSIQ DIGITAL HEALTH WEB DESIGN LTDA · CNPJ 68.335.606/0001-11 · Rua Pais Leme, 215, cj 1713, Pinheiros, São Paulo/SP` | Rodapé genérico sem CNPJ |

---

## 3. Anatomia Estrutural da Página (Seções Obrigatórias)

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title><TERMO INN / PROCEDIMENTO>: <PROPOSTA DE VALOR> | dosiq</title>
  <meta name="description" content="<RESPOSTA DIRETA EM 150-160 CARACTERES>">
  <link rel="canonical" href="https://dosiq.app/<ROTA_LIMPA>">
  <meta name="robots" content="index,follow,max-snippet:-1,max-image-preview:large">
  
  <!-- OpenGraph / Twitter (Card 1200x630) -->
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="dosiq">
  <meta property="og:url" content="https://dosiq.app/<ROTA_LIMPA>">
  <meta property="og:title" content="<TITULO INN>">
  <meta property="og:description" content="<DESCRICAO>">
  <meta property="og:image" content="https://dosiq.app/og-<SLUG>.png">
  
  <!-- Fontes & Estilos -->
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Comfortaa:wght@700&family=Lexend:wght@400;500;600;700&family=Public+Sans:wght@800;900&display=swap">
  <link rel="stylesheet" href="/landing-static.css">
</head>
<body>
  <a class="skip" href="#conteudo">Ir para o conteúdo</a>
  
  <!-- Header -->
  <header class="hd">
    <div class="shell hd__in">
      <a class="brand" href="/"><img src="/dosiq-logo-verde.svg" alt="" width="32" height="32"><span>dosiq</span></a>
      <div class="hd__acts">
        <a class="btn btn--ghost" href="/?login=1">Entrar</a>
        <a class="btn btn--primary" href="/?signup=1">Criar conta</a>
      </div>
    </div>
  </header>

  <main id="conteudo">
    <!-- Hero com Badges das Lojas -->
    <section class="hero"> ... </section>

    <!-- Artigos Q&A (Estrutura AEO: pergunta no H2 + resposta direta nas 2 primeiras frases) -->
    <section class="sec">
      <div class="shell qa">
        <article class="qa__item">
          <h2><Pergunta real do paciente>?</h2>
          <p class="qa__answer"><Resposta concisa e direta que a IA pode citar>.</p>
          <p><Parágrafo de contexto adicional com base na bula>.</p>
        </article>
      </div>
    </section>

    <!-- Como o Dosiq Resolve (Vitrine das Features v0.34) -->
    <section class="sec sec--muted"> ... </section>

    <!-- Por que confiar + Disclaimer SaMD -->
    <section class="sec">
      <div class="shell">
        <div class="samd">
          <p><strong>Aviso importante:</strong> O dosiq organiza e lembra os tratamentos prescritos pelo seu médico. O app não calcula doses, não faz prescrições e não substitui a orientação do seu endocrinologista ou clínico.</p>
        </div>
      </div>
    </section>

    <!-- CTA Final -->
    <section class="sec sec--muted"> ... </section>
  </main>

  <!-- Rodapé com Dados da PJ -->
  <footer class="ft"> ... </footer>

  <!-- JSON-LD Estruturado -->
  <script type="application/ld+json"> ... </script>
</body>
</html>
```

---

## 4. Template Canônico de JSON-LD (`MedicalWebPage` + `FAQPage`)

O schema deve ser injetado como um grafo único (`@graph`):

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://dosiq.app/#org",
      "name": "dosiq",
      "legalName": "DOSIQ DIGITAL HEALTH WEB DESIGN LTDA",
      "taxID": "68.335.606/0001-11",
      "url": "https://dosiq.app",
      "logo": "https://dosiq.app/dosiq-logo-verde.png",
      "sameAs": [
        "https://apps.apple.com/br/app/dosiq-intelig%C3%AAncia-em-doses/id6762740948",
        "https://play.google.com/store/apps/details?id=com.coelhotv.dosiq",
        "https://github.com/coelhotv/dosiq"
      ]
    },
    {
      "@type": "MedicalWebPage",
      "@id": "https://dosiq.app/<ROTA_LIMPA>#page",
      "url": "https://dosiq.app/<ROTA_LIMPA>",
      "name": "<TITULO>",
      "inLanguage": "pt-BR",
      "dateModified": "2026-10-22",
      "publisher": { "@id": "https://dosiq.app/#org" },
      "about": [
        { "@type": "Drug", "name": "<DCB_1>", "nonProprietaryName": "<DCB_1>" }
      ],
      "audience": { "@type": "Patient" },
      "specialty": "Endocrinology"
    },
    {
      "@type": "FAQPage",
      "@id": "https://dosiq.app/<ROTA_LIMPA>#faq",
      "inLanguage": "pt-BR",
      "isPartOf": { "@id": "https://dosiq.app/<ROTA_LIMPA>#page" },
      "mainEntity": [
        {
          "@type": "Question",
          "name": "<Pergunta 1>?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "<Resposta 1>."
          }
        }
      ]
    },
    {
      "@type": "MobileApplication",
      "name": "dosiq",
      "operatingSystem": "iOS, Android",
      "applicationCategory": "HealthApplication",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "BRL" },
      "publisher": { "@id": "https://dosiq.app/#org" }
    }
  ]
}
```

---

## 5. Roteamento e Infraestrutura de Publicação

1. **Configuração de Rotas Limpas em [`vercel.json`](file:///Users/coelhotv/git/dosiq/vercel.json):**
   Adicionar os rewrites antes da regra catch-all `/(.*)`:
   ```json
   {
     "source": "/<ROTA_LIMPA>",
     "destination": "/<ARQUIVO>.html"
   }
   ```
2. **Sincronização com [`sitemap.xml`](file:///Users/coelhotv/git/dosiq/apps/web/public/sitemap.xml):**
   Toda nova URL pública deve ser incluída no `<urlset>` com `<loc>https://dosiq.app/<ROTA_LIMPA></loc>`.
3. **Padrão Canônico do [`llms.txt`](file:///Users/coelhotv/git/dosiq/apps/web/public/llms.txt) e Companions em Markdown (`.md`):**
   O ecossistema de motores de resposta com IA (AEO/GEO) segue a especificação oficial [llmstxt.org](https://llmstxt.org/). Toda nova página do molde **deve obrigatoriamente** cumprir duas regras de indexação para agentes:
   
   - **Formato Rígido do `llms.txt`:**
     - O arquivo reside na raiz: `apps/web/public/llms.txt`.
     - Inicia com H1 (`# dosiq`) e um blockquote (`> ...`) de sumário do projeto.
     - As listas sob seções H2 (`## Guias e Documentação`) devem usar **obrigatoriamente** o formato de link Markdown:
       ```markdown
       - [Título da Página](URL): Descrição concisa e direta do conteúdo.
       ```
     - **Proibido:** URLs cruas/soltas (ex: `- https://dosiq.app/pagina — descrição`). Parsers e validadores do Lighthouse/AEO rejeitam o arquivo se não houver links formatados em Markdown.
   
   - **Geração Obrigatória do Companion em Markdown (`.md`):**
     - Para cada nova landing estática `apps/web/public/<rota>.html`, deve ser criado um arquivo irmão em puro Markdown: `apps/web/public/<rota>.md`.
     - Esse companion deve conter o texto limpo, perguntas/respostas (Q&A), proposta de valor e disclaimers legais, sem tags HTML, scripts ou CSS. Isso permite que LLMs e agentes leiam o conteúdo com baixo consumo de tokens e sem ruído de layout.
     - No `llms.txt`, adicionar duas entradas para o tópico:
       ```markdown
       - [Nome do Guia](https://dosiq.app/<rota>): Guia explicativo completo...
       - [Nome do Guia (Markdown)](https://dosiq.app/<rota>.md): Versão em texto puro Markdown para ingestão direta por agentes de IA.
       ```

---

## 6. Comandos Automatizados de Validação

Antes de abrir PR com novas páginas do molde, executar o checklist via terminal:

```bash
# 1. Validar sintaxe JSON do vercel.json
node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8')); console.log('vercel.json OK')"

# 2. Validar sintaxe de todos os blocos JSON-LD nos arquivos HTML
node -e "
const fs = require('fs');
const files = ['apps/web/public/glp-1.html', 'apps/web/public/guia/rodizio-aplicacao.html'];
for (const f of files) {
  const html = fs.readFileSync(f, 'utf8');
  const m = html.match(/<script type=\"application\/ld\+json\">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('JSON-LD ausente em ' + f);
  JSON.parse(m[1]);
}
console.log('Todos os JSON-LD são válidos.');
"

# 3. Validar ausência de termos proibidos (SaMD INV-4)
! rtk grep -i "revisado clinicamente" apps/web/public/*.html apps/web/public/guia/*.html

# 4. Validar caminhos absolutos de assets (evita 404 em rotas de subdiretório)
! rtk grep -E 'src="\.\./|href="\.\./' apps/web/public/*.html apps/web/public/guia/*.html

# 5. Validar formatação do llms.txt (todas as entradas sob H2 devem ser links Markdown com descrição)
node -e "
const fs = require('fs');
const content = fs.readFileSync('apps/web/public/llms.txt', 'utf8');
const afterFirstH2 = content.split(/^##\s+/m).slice(1).join('\n');
const listLines = afterFirstH2.split('\n').filter(l => l.startsWith('- '));
for (const l of listLines) {
  if (!l.match(/^- \[[^\]]+\]\(https?:\/\/[^\)]+\): .+$/)) {
    throw new Error('Link no llms.txt viola a especificação llmstxt.org: ' + l);
  }
}
console.log('llms.txt: todas as ' + listLines.length + ' entradas sob H2 seguem rigorosamente a especificação llmstxt.org.');
"
```
