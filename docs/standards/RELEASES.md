---
title: "Releases externos — Notas de loja (dosiq mobile)"
description: "Releases para as versões dos apps Android e iOS"
version: "1.2.0"
status: active
category: standard
audience:
  - product
  - agent
tags:
  - release
  - changelog
  - versioning
created_at: "2026-07-15"
updated_at: "2026-07-28"
---
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

## v0.30.1 — a publicar — Base renovada, alarme de dose crítica corrigido, correções que chegam sem esperar a loja

> Cobre tudo desde a `0.28.3` publicada (última que esteve em produção): bump do Expo SDK 53→54
> (0.29.0), migração da exportação LGPD para a API nova de arquivos (0.29.1), edge-to-edge do
> Android 16 e a correção de teclado em 12 telas de formulário (0.29.2), o kill switch de versão
> mínima (0.29.3), o cliente de atualização OTA (0.30.0), a preferência de estoque sobrevivendo
> offline (OTA sobre a 0.30.0) e, na `0.30.1`, o enxugamento do binário Android + **a correção do
> alarme de dose crítica** (PR #782).
>
> ⚠️ **A nota foi reenquadrada de `0.30.0` para `0.30.1`** porque a 0.30.0 nunca chegou à loja: o
> PO segurou a publicação ao encontrar, no smoke, falha justamente em dose crítica — a superfície
> de maior responsabilidade clínica do produto (ver `AP-327`).
>
> **0.30.0 é a primeira versão alcançável por OTA** e o benefício **não é retroativo** — só quem
> instalar desta em diante recebe correção sem passar pela loja.
>
> **Assimetria de plataforma nesta versão:** os dois ganhos novos da `0.30.1` são **Android-only** —
> o alarme em tela cheia já funcionava no iOS (lá o takeover depende de um toque do usuário, que
> sempre acontece; no Android quem abre é o sistema, sem toque), e o enxugamento do binário veio de
> uma dependência de desenvolvimento que só vazava no Android. Por isso **nenhum dos dois entra na
> nota da Apple**: descrever como novidade um problema que o usuário de iPhone nunca teve é ruído.
>
> **Fora da copy, de propósito:**
> - **Kill switch de versão mínima** — capacidade de operação, não benefício ao usuário.
>   Anunciar "podemos bloquear seu app" é ruído negativo na ficha.
> - **Troca de Firebase por Sentry + PostHog** — mudança de fornecedor de telemetria, invisível
>   na tela. A revisão de privacidade correspondente é a spec 059 (pendente); se ela alterar o
>   texto de privacidade da ficha, é entrega separada.
> - **Edge-to-edge** é correção Android; a nota da Apple descreve o efeito em termos neutros
>   ("área segura"), porque o `FormActions` também recebeu inset no iOS.
> - **A causa técnica do bug do alarme** (notificação de resumo criada pelo próprio Android,
>   ciclo de vida do processo). A copy diz o que voltou a funcionar, não por que quebrou.
> - **Redução de tamanho do APK** (59 → 38 MB, -36%): benefício real, mas a Google Play já exibe o
>   tamanho na ficha. Citar número na nota envelhece mal a cada release.

### Apple App Store (pt-BR)

```
Esta versão renova a base técnica do dosiq e prepara o app para as próximas melhorias.

O que muda para você:
• Formulários mais confortáveis — o teclado não cobre mais os campos nem o botão de salvar, e os botões de ação respeitam a área segura da tela em todos os aparelhos.
• Sua preferência de estoque é respeitada offline — se você desligou o controle de estoque, ele continua desligado mesmo que o app abra sem conexão. Antes, uma falha de rede podia reativá-lo sozinho.
• Exportação de dados corrigida — o download do seu histórico completo voltou a funcionar em todos os aparelhos, com o formato de arquivo atualizado.
• Correções mais rápidas — a partir desta versão, ajustes e correções podem chegar até você sem esperar uma nova revisão da loja. Nada é aplicado sozinho no meio do seu uso: quando uma atualização estiver pronta, o app avisa e só reinicia quando você toca no aviso. Nenhum registro de dose ou formulário em andamento é perdido.
• Base atualizada — o app foi migrado para a versão mais recente da plataforma, mantendo compatibilidade com os sistemas operacionais novos e com os recursos de tela dos aparelhos atuais.
```

### Google Play (pt-BR — 496 chars)

```
Base do app atualizada para a versão do Android mais recente.
Correções e melhorias:
• O alarme de dose crítica volta a abrir em tela cheia, com a dose e os botões para registrar — inclusive com o celular bloqueado
• O teclado não cobre mais os campos e o botão de salvar nos formulários
• Botões de ação deixam de ficar colados na barra de gestos
• Exportação dos seus dados corrigida
• O app ocupa menos espaço no aparelho
• A partir desta versão, correções chegam sem esperar a revisão da loja
```

---

## v0.28.0 — publicada — Evolução do tratamento (escada de doses)

> Cobre tudo desde a `0.27.0` publicada: a Evolução do tratamento chegando ao app (0.27.2),
> a troca de medicamento acionável pelo paciente (0.27.3), a porta para quem já está em
> manutenção (0.28.0), a troca de concentração deixando de fatiar o tratamento (0.28.2) e o
> fix de app inacessível offline (0.27.1). Patches 0.28.1/0.28.3 entram como estabilidade.
>
> **Publicada** — a versão que esteve em produção nas duas lojas até a `0.30.0` foi a `0.28.3`
> (confirmado pelo PO em 2026-07-28). A nota abaixo é o texto que saiu.
>
> **Enquadramento obrigatório (ADR-062 / SaMD):** o dosiq **registra** a escada que o médico
> prescreveu e avisa quando a data chega — **nunca sugere, calcula ou recomenda dose**. Toda
> frase da copy precisa deixar o médico como origem da decisão ("que seu médico prescreveu",
> "quando seu médico indicar"). Copy que sugira automatismo clínico muda a classificação
> regulatória do produto.

### Apple App Store (pt-BR)

```
Chegou a Evolução do tratamento no dosiq — para quem não toma sempre a mesma dose.

- Sua escada de doses, do jeito que o médico prescreveu
Muitos tratamentos aumentam a dose aos poucos. Agora você cadastra esse plano no app: cada etapa com a dose, a duração e o medicamento. O dosiq mostra em qual etapa você está, quanto falta para a próxima e avisa quando chega a hora — seguindo exatamente o que foi prescrito.

- Trocar de concentração não recomeça o tratamento
Quando a evolução pede uma caneta ou apresentação diferente, o tratamento continua sendo o mesmo. Sua história fica toda junta, num lugar só, em vez de virar uma pilha de tratamentos encerrados.

- Já está na dose de manutenção?
Se o seu médico decidir aumentar de novo, agora existe uma porta clara para registrar isso — a etapa nova só começa quando você tocar em iniciar.

- Acompanhe a evolução de perto
A linha do tempo mostra as etapas concluídas, a atual e as que ainda vêm, com as datas de cada mudança. Na lista de tratamentos, um selo indica quais estão em evolução.

Correção importante
O app voltou a abrir normalmente quando você está sem internet.
Além disso: melhorias de estabilidade e correções.

O dosiq acompanha o plano do seu médico. Ele nunca sugere nem calcula doses por conta própria.
```

### Google Play (pt-BR — 452 chars)

```
Chegou a 'Evolução de Tratamento' no dosiq:
- Cadastre a escada de doses que seu médico prescreveu e veja em qual etapa você está.
- Trocou de concentração? Continua sendo o mesmo tratamento, com sua história toda junta.
- Já está na dose de manutenção? Registre um novo aumento quando seu médico indicar.

Estabilidade e correções:
- Correção: quando sem internet, o app volta a abrir normalmente.

Sua evolução, do jeito que seu médico prescreveu.
```

---

## v0.27.0 — publicada — Estoque opcional + Portabilidade e Privacidade

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
Uma grande atualização no dosiq:

- Controle de estoque agora é OPCIONAL — só registrar doses ficou bem mais rápido. Ligue ou desligue quando quiser, sem perder histórico.
- Exporte todo o histórico em JSON ou CSV direto pelo app.
- Novo hub 'Privacidade e dados': exportação, política e exclusão de conta num lugar só.
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
