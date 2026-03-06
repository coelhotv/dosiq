<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Resultado do Spike ANVISA

## Fontes Avaliadas

### Fonte 1: Dados Abertos de Medicamentos da ANVISA (Dados.gov.br)

- URL: `https://dados.anvisa.gov.br/dados/DADOS_ABERTOS_MEDICAMENTOS.csv` (via catálogo no portal `dados.gov.br` e mirror em AmeriGEOSS)[^1][^2]
- Formato: CSV estático, com ~150 mil registros (tamanho final em disco da ordem de dezenas de MB, tipicamente ~50–100 MB).[^2][^1]
- Campos disponíveis (parciais, conforme dicionário de dados):
    - Nome comercial (denominação de venda)
    - Princípio ativo (substância)
    - Registro ANVISA
    - Laboratório
    - Concentração, forma farmacêutica, dosagem
    - Situação (registro ativo, cancelado etc.)
Esses campos são suficientes para autocompleção de medicamentos e posterior check de interação (filtrando apenas ativos e populares).[^1][^2]
- Tamanho: dezenas de milhares de registros (da ordem de ~150k linhas).[^1]
- Licença: dados abertos, disponibilizados pela ANVISA via portal de dados governamentais; uso para integração em apps é permitido, sem restrição comercial explícita.[^3][^1]
- Atualização: atualizados diariamente a partir do Datavisa, com timestamp de última atualização explícito no catálogo.[^4][^2][^1]
- Viabilidade: **ALTA**
- Notas:
    - Arquivo CSV grande, mas pode ser processado em batch (ETL) para gerar um JSON compacto indexado por nome comercial e princípio ativo.
    - Ideal para download periódico (diário ou semanal) e uso “offline” dentro da app, com lazy‑import em runtime.[^2][^1]

***

### Fonte 2: Bulário Eletrônico ANVISA (bulas)

- URL: `https://consultas.anvisa.gov.br/#/bulario/` (via página de orientação oficial: `anvisa.gov.br/assuntos/medicamentos/bulas-e-rotulos/como-acessar-o-bulario-eletronico`).[^5][^6]
- Formato: interface web SPA + PDFs de bulas; não há API pública documentada para extrair o catálogo de medicamentos em JSON/CSV.[^6][^5]
- Campos disponíveis (via interface):
    - Nome comercial
    - Princípio ativo
    - Empresa/laboratório
    - Forma farmacêutica
    - Bulas (PF e PP) em PDF
Note que a funcionalidade de “autocomplete” do Bulário já existe na UI (ao digitar 3 letras aparecem sugestões), mas não há API pública estável para consumo programático.[^6]
- Tamanho: catálogo amplo, mas não há arquivo de download direto de todo o conjunto de medicamentos.[^6]
- Licença: dados de uso livre para consulta pública, mas os termos de uso da ANVISA não formalizam bem a extração massiva; risco de restrição legal para scraping.[^3][^6]
- Atualização: atualizado conforme aprovação de novas bulas, mas sem frequência explícita documentada para download.[^6]
- Viabilidade: **BAIXA** (para uso direto como source de autocomplete)
- Notas:
    - Bulário é excelente como referência de bulas, mas **não é adequado como fonte primária para autocomplete** em app de pacientes, sem uso de scraping ou API própria.
    - Ao usar scraping, há risco de bloqueio, CAPTCHA, e possível conflito com termos de uso da ANVISA.[^3][^6]

***

### Fonte 3: API de consulta simplificada (terceirizada) – Infosimples ANVISA / Produtos

- URL: `https://infosimples.com/consultas/anvisa-produtos/`[^7]
- Formato: API REST paga, com resposta em JSON, consulta por nome, registro ou processo.[^7]
- Campos disponíveis (documentados na página):
    - Nome do produto
    - CNPJ da empresa
    - Processo
    - Eventualmente registro e outros dados sumarizados.[^7]
Não expõe todos os campos de interação (como concentração, dosagem, forma farmacêutica em detalhe), então é mais voltado a consulta esporádica do que a autocomplete completo.[^7]
- Tamanho: ilimitado por custo/batch, mas limitado por taxa (até 10 registros por consulta).[^7]
- Licença: uso comercial sob contrato pago, com regras de uso definidas pela Infosimples.[^7]
- Atualização: base aliada à ANVISA, mas sujeita a política de rate limit e cobrança.[^7]
- Viabilidade: **MÉDIA** (para autocomplete, mas não ideal para uso massivo contínuo)
- Notas:
    - Útil para validação pontual (por exemplo, ao selecionar um medicamento da base estática), mas **não é viável como fonte primária de autocomplete** para usuários de forma contínua, devido a custos e limites de taxa.[^7]

***

### Fonte 4: CMED / listas de preços (referência de campos)

- URL: dados da CMED também estão disponíveis via portais de dados abertos, parcialmente alinhados com registros ANVISA.[^8][^4]
- Formato: CSV, com campos de preço (PF, PMC), tarjas, restrições, etc.[^8][^4]
- Campos: princípio ativo, nome comercial, laboratório, PF/PMC, tarja, se comercializado.[^4][^8]
- Tamanho: algumas dezenas de milhares de registros.[^8]
- Licença: dados abertos, mas foco em **preço e comercialização**, não em preparo de autocomplete estruturado.[^4][^8]
- Atualização: regular (mensal / diária conforme fonte).[^9][^8]
- Viabilidade: **MÉDIA** apenas como fonte de enriquecimento (preço, tarja, restrição) em vez de base primária.[^8][^4]
- Notas:
    - Pode ser usada **posteriormente** para complementar interações (ex.: marcar medicamento com tarja vermelha, restrição hospitalar) mas não como fonte de partição de autocomplete.[^4][^8]

***

## Recomendação

### Cenário A: Viável com custo zero (recomendado)

- **Fonte recomendada primária**: Dados Abertos de Medicamentos da ANVISA (`https://dados.anvisa.gov.br/dados/DADOS_ABERTOS_MEDICAMENTOS.csv`).[^2][^1]
- **Formato de integração**:
    - Download periódico (diário ou semanal) do CSV.
    - Processamento em backend (ETL) para gerar um JSON indexado por:
        - `nome_comercial`
        - `principio_ativo`
        - `nome_comercial + forma_farmaceutica`
    - Importar esse JSON na app via lazy‑import (ex.: `import('./medicamentos.json')`) e oferecer autocomplete com fuzzy matching local.[^1][^2]
- **Tamanho estimado do dataset**:
    - CSV com ~150 mil registros, gerando JSON na ordem de ~20–40 MB, comprimido em runtime pode cair para ~5–10 MB na app.[^2][^1]
- **Plano**:

1. Criar **protótipo mínimo** de download e parse:
        - Script em Node.js/Python para baixar o CSV, converter em JSON estruturado e remover registros inativos.
        - Exportar um arquivo `medicamentos.json` otimizado para autocomplete.
2. Implementar **serviço de busca local** (ex.: função em JavaScript com fuzzy matching via `fuse.js` ou similar) para nome comercial e princípio ativo.[^1][^2]
3. Deixar o **Bulário Eletrônico ANVISA como referência secundária** (link direto na interface para exibir bulas quando o usuário selecionar o medicamento).[^6]

Este cenário é viável com **custo zero** e sem dependência de APIs pagas, além de trazer alta cobertura de medicamentos registrados e permitir controle total sobre atualizações e formato dentro da app.[^3][^2][^1]

### Cenário B: Parcialmente viável (plano secundário)

- **Base seed manual de ~500 medicamentos mais comuns**:
    - Pode ser alimentada via spreadsheet interna, com foco em patologias crônicas (diabetes, hipertensão, dislipidemia, etc.).
- **Fonte para enriquecimento futuro**:
    - Dados CMED (preço e tarja) para marcar medicamentos com tarja vermelha, restrição hospitalar, etc.[^8][^4]
    - Possível uso da API de consulta Infosimples apenas para **validação pontual** (ex.: ver detalhes de um medicamento específico), não para autocomplete em massa.[^7]

Esse cenário é útil se, por alguma razão, o time não quiser carregar o JSON completo de 150k registros na app (por limites de tamanho ou política de store), mas **não é ideal** para maximizar aderência e conveniência, pois reduz cobertura.[^4][^8][^7]

### Cenário C: Inviável (não recomendado)

- **Motivos**:
    - Scraping direto do Bulário Eletrônico ANVISA é tecnologicamente viável, mas com risco jurídico e de bloqueio devido à falta de API pública documentada e termos de uso restritivos.[^3][^6]
    - Uso de APIs terceirizadas como Infosimples como fonte primária de autocomplete é **caro e limitado por rate limit**, dificultando uso contínuo em app de pacientes.[^7]
- **Alternativa**:
    - Manter cadastro manual de medicamentos (com base de 500 medicamentos mais comuns) e usar freelas para pesquisa e atualização, mas isso **não escala** para um produto voltado a aderência de protocolos de longa duração.[^8][^4]

***

### Decisão documentada

- **Prosseguir com autocomplete**: SIM, via **Cenário A** (dados abertos ANVISA em CSV → JSON estático para autocomplete local).[^2][^3][^1]
- **Próximo passo técnico**:
    - Implementar um **script de download e parse** do CSV da ANVISA para gerar o JSON otimizado.
    - Criar um **serviço de busca em JS/TS** com fuzzy matching para `nome_comercial` e `principio_ativo`, conforme o comentário no código fornecido.

Se quiser, o próximo passo pode ser um **mini‑protótipo de código** (Node.js + script para gerar o JSON) para você integrar diretamente na arquitetura da app.
<span style="display:none">[^10][^11][^12][^13][^14][^15]</span>

<div align="center">⁂</div>

[^1]: https://data.amerigeoss.org/dataset/medicamentos-registrados-no-brasil/resource/6eaa7154-4b47-4007-a6ed-8e7cbd1061a1

[^2]: https://data.amerigeoss.org/dataset/medicamentos-registrados-no-brasil

[^3]: https://www.gov.br/anvisa/pt-br/acessoainformacao/dadosabertos

[^4]: https://m2farma.com/blog/anvisa-plataforma-consulta/

[^5]: https://www.saude.sp.gov.br/ses/perfil/profissional-da-saude/servicos/bulario-eletronico-anvisa

[^6]: https://www.gov.br/anvisa/pt-br/assuntos/medicamentos/bulas-e-rotulos/como-acessar-o-bulario-eletronico

[^7]: https://infosimples.com/consultas/anvisa-produtos/

[^8]: https://ictq.com.br/assuntos-regulatorios/2289-anvisa-abre-dados-sobre-medicamentos-controlados-e-antimicrobianos

[^9]: https://crf-rj.org.br/noticias/4317-medicamentos-controlados-e-antimicrobianos-dados-abertos.html

[^10]: https://www.gov.br/anvisa/pt-br/assuntos/noticias-anvisa/2020/banco-de-dados-traz-informacoes-de-produtos-para-saude

[^11]: https://github.com/rogerleite/anvisa-bot

[^12]: http://saude.sp.gov.br/ses/perfil/profissional-da-saude/servicos/bulario-eletronico-anvisa

[^13]: https://github.com/breno12321/medAnvisaPrice

[^14]: https://www.gov.br/anvisa/pt-br/assuntos/noticias-anvisa/2025/sngpc-anvisa-disponibiliza-nova-ferramenta-para-envio-de-informacoes

[^15]: https://crf-rj.org.br/noticias/4309-consulte-informacoes-sobre-venda-de-medicamentos-controlados.html

