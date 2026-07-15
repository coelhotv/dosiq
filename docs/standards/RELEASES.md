# Releases externos — Notas de loja (dosiq mobile)

> **Fonte de verdade das notas de loja.** Este arquivo guarda o texto **publicado** (ou a publicar)
> na Apple App Store e na Google Play. É a face externa do produto — escrito para o usuário final,
> não para o time.
>
> Separação de papéis (ver `CHANGELOG_AND_RELEASES.md`):
> - **`CHANGELOG.md`** = log **interno** de mudanças (por PR/versão, técnico, para o time/agente).
> - **`RELEASES.md`** (este) = notas **externas** de loja (por versão publicada, para o usuário).
>
> **Regras da copy de loja:**
> - Português, tom acolhedor, sem jargão técnico nem detalhe interno.
> - **Sem emojis** — nenhuma das duas lojas aceita (Apple e Google rejeitam/removem).
> - Apple aceita texto longo (~4000 chars); **Google Play tem limite rígido de 500 chars** — manter a variante curta abaixo desse teto.
> - Uma release de loja = um bump **minor** de mobile (convenção 0.x — ver `CHANGELOG_AND_RELEASES.md`).
>   Patches intermediários entram na próxima nota de loja como "estabilidade e correções".
> - Terminologia de UI: "tratamento" (nunca "protocolo").

---

## v0.27.0 — a publicar — Estoque opcional + Portabilidade e Privacidade

> Une as entregas 044 (estoque opcional — a mais sentida no dia a dia), 008 (exportação + hub de
> privacidade) e 046 (consentimento LGPD). Cobre tudo desde a última publicação (`0.24.5`),
> incluindo as melhorias de estabilidade das versões 0.24.6–0.26.x.

### Apple App Store (pt-BR)

```
Chegou uma grande atualização do dosiq — mais controle no dia a dia e mais transparência com os dados.

Controle de estoque agora é OPCIONAL
Só quer registrar doses? Pule caixas, quantidades e compras: o cadastro ficou muito mais rápido. Prefere acompanhar o estoque? Continua tudo lá — e dá pra ligar ou desligar quando quiser, sem perder nada do histórico.

Exportação completa de dados
Baixe todo o histórico em JSON ou CSV direto pelo app, a qualquer momento. Medicamentos, doses, adesão, medidas e biomarcadores — tudo num pacote.

Novo hub "Privacidade e dados"
Exportar dados, ler a política de privacidade e excluir a conta agora ficam reunidos num só lugar, fácil de achar.

Consentimento claro e reversível
O uso de dados de saúde passa a ser autorizado de forma explícita — e esse consentimento pode ser retirado a qualquer momento, com total transparência sobre o que o dosiq faz com as informações.

Mais rapidez para quem só quer registrar doses, mais controle para quem gosta de acompanhar o estoque, e mais tranquilidade para todo mundo.
```

### Google Play (pt-BR — 500 chars)

```
Grande atualização do dosiq:

- Controle de estoque agora é OPCIONAL — só registrar doses ficou bem mais rápido. Ligue ou desligue quando quiser, sem perder histórico.
- Exporte todo o histórico em JSON ou CSV direto pelo app.
- Novo hub Privacidade e dados: exportação, política e exclusão de conta num lugar só.
- Consentimento de dados de saúde explícito e reversível a qualquer momento.

Mais controle, mais transparência, mais tranquilidade.
```

---

## v0.22.0 — 2026-06-28 — Dose na barra de notificações (Android)

> Nota de loja específica do Android (ongoing notification / dose como estado contínuo).

### Google Play (pt-BR)

```
Os tratamentos com alerta crítico agora acompanham a dose direto na barra de notificações: um lembrete contínuo que mostra quanto falta, avisa a hora e deixa você registrar com um toque — sem abrir o app.
```

---

## v0.21.0 — 2026-06-24 — Assistente IA no app

### Apple App Store / Google Play (pt-BR)

```
Chegou o Assistente IA do dosiq no celular:

- Converse com o assistente direto do app: toque no ícone do robô no topo das telas Hoje, Tratamentos e Estoque e pergunte sobre suas doses, adesão e estoque.
- Respostas no contexto do seu tratamento — incluindo medicamentos líquidos e injetáveis com a unidade certa (mL, UI, gotas) e tratamentos semanais com o dia agendado.
- Limpe a conversa quando quiser começar do zero, com um toque.
- O assistente não substitui orientação médica e nunca recomenda doses.
```

---

## v0.19.1 — 2026-06-17 — Pressão arterial + Histórico integrado + Alarme mais seguro

> Agrega as novidades desde a última publicada (`0.17.1`): pressão arterial (0.18.0), histórico
> integrado (0.19.0) e o alarme com transparência clínica (0.19.1).

### Apple App Store (pt-BR)

```
Mais controle da sua saúde, com lembretes mais seguros:

- Pressão arterial: registre sua pressão (sistólica e diastólica) em segundos, com o contexto da medição (em repouso, ao acordar, após exercício...) e acompanhe a tendência ao longo do tempo.
- Histórico integrado: glicemia, peso e pressão agora aparecem na sua linha do tempo, lado a lado com as doses do dia — edite ou exclua um registro sem sair da tela.
- Alarme mais claro e seguro: a tela do alarme agora mostra a concentração do remédio e exatamente quanto tomar, na unidade certa (mg, UI, mL, gotas), com o ícone da forma do medicamento.
- Correção importante: o alarme não reabre mais para uma dose que você já registrou por outro caminho (linha do tempo, web ou bot) — sem risco de contar a dose duas vezes.
- Pequenas correções e melhorias de estabilidade.

Continuamos cuidando da sua rotina com carinho e zero complicação.
```

### Google Play (pt-BR)

```
Mais controle da sua saúde e lembretes mais seguros:

- Pressão arterial: registre sistólica e diastólica em segundos, com o contexto da medição (em repouso, ao acordar, após exercício) e veja a evolução ao longo do tempo.
- Histórico integrado: glicemia, peso e pressão aparecem na linha do tempo do dia, junto das doses — com edição e exclusão direto pela tela.
- Alarme mais claro: agora mostra a concentração do remédio e quanto tomar, na unidade certa (mg, UI, mL, gotas), com o ícone da forma do medicamento.
- Correção: o alarme não reabre mais para uma dose já registrada por outro caminho, evitando contar a dose duas vezes.
- Estabilidade e pequenas correções.

Cuidando da sua rotina com carinho e zero complicação.
```

---

## v0.17.0 — 2026-06-15 — Suporte a diabetes tipo 2 (épico 012)

> Consolida as Fases A–D do épico 012 (injetáveis + validade biológica, GLP-1/titulação,
> biomarcadores, insulina basal), entregues ao longo das 0.16.x.

### Apple App Store (pt-BR)

```
Agora o dosiq cuida de quem tem diabetes tipo 2 — de ponta a ponta:

- Canetas e injetáveis: cadastre insulina e GLP-1 (Ozempic, Mounjaro, Wegovy) com a dose na unidade certa (UI, mg) e acompanhe a validade após aberto da caneta/frasco.
- Glicemia e medidas: registre glicemia, peso e outras medidas em segundos e veja a evolução na sua linha do tempo, junto das doses.
- Estoque inteligente: o app mostra quantas aplicações restam (não mililitros soltos) e avisa com antecedência quando está acabando.
- Titulação guiada: tratamentos com aumento gradual de dose avançam sozinhos conforme o cronograma do seu médico.
- Lembretes mais claros: notificações de dose de líquidos agora mostram a dose exata (ex.: 10 UI).

Continuamos cuidando da sua rotina com carinho e zero complicação.
```

### Google Play (pt-BR)

```
Suporte completo a diabetes tipo 2 no dosiq:

- Insulina e GLP-1 (Ozempic, Mounjaro, Wegovy) com dose em UI/mg e controle de validade da caneta após aberta.
- Registro rápido de glicemia, peso e outras medidas, com tendência ao lado das doses.
- Estoque em "aplicações restantes" e aviso antecipado de recompra.
- Titulação que avança sozinha conforme o cronograma do médico.
- Lembretes de dose de líquidos mais precisos (ex.: 10 UI).

Simples para quem mais precisa.
```

---

## Releases anteriores (formato de nota curta, pré-0.17)

Notas de loja de uma linha registradas no `CHANGELOG.md` antes da adoção do formato completo Apple/Google:

- **v0.12.0** — Novo: Histórico de Doses — veja tudo o que aconteceu com as suas doses nos últimos 30 dias, semana a semana. Encontre qualquer dose no calendário, confira a taxa de adesão e a sequência atual, e corrija ou apague registros com um toque.
- **v0.11.0** — Adicionada área interna para envio de feedback diretamente pelo app.
- **v0.10.0** — Melhoria no sistema de lembretes de doses críticas: se você tem mais de um remédio no mesmo horário, o alarme toca uma vez só e permite confirmar todos de uma vez.
- **Notas de melhoria (0.16.x)** — suporte completo a medicamentos líquidos (gotas, mL, insulina UI com estoque convertido e custo por dose); dicas contextuais na tela inicial; histórico mais limpo (tratamentos pausados não geram doses perdidas); doses semanais atrasadas continuam visíveis e registráveis.
