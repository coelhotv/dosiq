---
title: "Política de Privacidade — v0.4 (vigente)"
description: "Política de privacidade e termos de tratamento de dados pessoais de pacientes em conformidade com a LGPD para o aplicativo dosiq."
version: "0.4.0"
status: active
category: legal
audience:
  - dev
  - legal
tags:
  - privacy
  - lgpd
  - security
  - consent
created_at: "2026-04-14"
updated_at: "2026-10-22"
---


# Política de Privacidade — dosiq (v0.4)

**Fonte de verdade** deste documento — publicação em `apps/web/public/politica-de-privacidade.html` (conversão mecânica, sem reescrita de conteúdo, ver `PLAYBOOK.md §Publicacao` da spec 046). Versão anterior arquivada em [`POLITICA_DE_PRIVACIDADE_v0.3.md`](POLITICA_DE_PRIVACIDADE_v0.3.md). Convenção: cada versão publicada ganha seu próprio arquivo (`_vX.Y.md`); a mais recente com `status: active` é a vigente.

---

## Versão do documento

**v0.4** · **22/10/2026**

### O que mudou da v0.3 para a v0.4

**Mudou quem é o responsável pelos seus dados.** Os dados que o dosiq usa e o que ele faz com eles continuam os mesmos. O que mudou é que esta versão explica tudo com mais detalhe e pede a sua confirmação para duas coisas que antes não estavam escritas com clareza.

- **Responsável pelo tratamento (seção 2)**: o dosiq passou a ser operado por uma empresa, a **DOSIQ DIGITAL HEALTH WEB DESIGN LTDA**. Ela assume o papel de controladora, que antes era do fundador como pessoa física.
- **Encarregado (seção 2)**: continua sendo o fundador, agora nomeado formalmente pela empresa. O canal de contato não muda: privacidade@dosiq.app.
- **Finalidades (seção 4)**: a tabela passa a listar também o que já acontecia e não estava escrito: a medição de como o app é usado, o diagnóstico de falhas, os e-mails de conta e a guarda dos registros de acesso exigida pelo Marco Civil da Internet.
- **Bases legais corrigidas (seções 4, 5 e 11)**: a v0.3 citava dispositivos da LGPD que não correspondiam ao que o dosiq faz. A v0.4 cita os dispositivos certos. Como você continua dando o mesmo consentimento, isso não muda o tratamento dos seus dados.
- **Operadores (seção 6)**: a tabela informa, para cada empresa que trata dados para nós, qual instrumento de proteção de dados temos com ela. A **Brevo** entra na lista. Ela já enviava os e-mails do dosiq, mas não constava da v0.3.
- **Transferência internacional (seção 13)**: a v0.4 informa onde os dados ficam e pede o seu **consentimento específico, e opcional,** para que dados ligados à sua saúde sejam processados fora do Brasil. Sem ele, o app funciona e os lembretes chegam com texto genérico.
- **Idade mínima (seção 12)**: passa de 16 para **18 anos**.
- **Assistente no Telegram**: foi desligado. O bot do Telegram continua enviando lembretes, mas não responde mais perguntas.

### Changelog v0.2 → v0.3

- **Novo**: cláusula de consentimento específico e destacado para dado de saúde (seção 5), com o texto exato exibido no app.
- **Novo**: finalidades detalhadas por tipo de dado, cada uma com a base legal correspondente (seção 4).
- **Novo**: inventário nomeado de operadores/subcontratados — quem trata o quê e onde (seção 6).
- **Reescrita**: retenção (seção 11) — explica que a trilha de consentimento e o recibo de exclusão sobrevivem à exclusão da conta, pseudonimizados.
- **Reescrita**: exclusão de conta (seção 10) — passa a existir dentro do próprio app (não só por e-mail), com o fluxo de revogação e o prazo de 90 dias.
- **Novo**: seção "Como exercer seus direitos" com o caminho exato para cada direito.
- **Preenchido**: responsável pelo tratamento e encarregado (seção 2) — pessoa física.
- **Atualizado**: canal de contato de privacidade passa a ser privacidade@dosiq.app.
- **Confirmado**: classificação etária 16+ (seção 12).

---

## 1. Introdução

O **dosiq** é um aplicativo para organizar a rotina de medicamentos: tratamentos, lembretes, registro de doses e controle de estoque.

Esta Política explica quais dados o dosiq trata, para que, com qual base legal, com quem eles são compartilhados, por quanto tempo ficam guardados e quais escolhas e direitos você tem sobre eles. Ela segue a Lei Geral de Proteção de Dados Pessoais (LGPD, Lei nº 13.709/2018) e o Marco Civil da Internet (Lei nº 12.965/2014).

---

## 2. Responsável pelo tratamento dos dados

**Controlador**: DOSIQ DIGITAL HEALTH WEB DESIGN LTDA, CNPJ 68.335.606/0001-11, com sede na Rua Pais Leme, 215, cj 1713, Pinheiros, São Paulo/SP, CEP 05424-150.

**Encarregado pelo tratamento de dados pessoais**: Antonio Carlos do C. G. Coelho, designado pela DOSIQ DIGITAL HEALTH WEB DESIGN LTDA (LGPD, art. 41). O encarregado recebe as suas solicitações e as comunicações da Autoridade Nacional de Proteção de Dados (ANPD).

**Canal de privacidade**: privacidade@dosiq.app

---

## 3. Quais dados tratamos

### 3.1. Dados de cadastro e autenticação
- e-mail
- identificador interno da conta
- informações necessárias para autenticação e manutenção de sessão

### 3.2. Dados de saúde e rotina que você informa
- nomes e concentrações de medicamentos
- tratamentos cadastrados (dose, horário, frequência)
- registros de doses tomadas, puladas ou adiadas
- estoque e compras de medicamentos
- locais de aplicação de injetáveis, se você os registrar
- **biomarcadores** (glicemia, peso, pressão arterial), se você os registrar

Esses dados são **dados pessoais sensíveis**, nos termos da LGPD (art. 5º, II), por estarem relacionados à sua saúde. Isso inclui o estoque: saber quais remédios alguém compra revela a condição de saúde dessa pessoa.

### 3.3. Dados técnicos de funcionamento
- informações de sessão e registros de acesso ao app (data, hora e endereço IP)
- identificadores técnicos da conta e do aparelho (modelo, sistema, versão do app)
- token de notificação push, quando você ativa lembretes (no computador ou no celular)
- identificador de vínculo com o Telegram, se você conectar o bot
- eventos de uso do app do celular e relatórios de falhas (seção 4)

### 3.4. O que não fazemos
- não vendemos seus dados pessoais
- não compartilhamos dados de saúde com anunciantes
- não usamos seus dados para publicidade nem montamos perfis comerciais

---

## 4. Para que tratamos cada dado, e com qual base legal

| Finalidade | Dados envolvidos | Base legal (LGPD) |
|---|---|---|
| Lembretes de dose (app, computador, e-mail e Telegram) | tratamentos, horários, nome do medicamento, token de push | consentimento específico e destacado para dado de saúde (art. 11, I) |
| Registro de doses e histórico | registros de dose | consentimento específico (art. 11, I) |
| Cálculo de adesão e relatórios que você gera (ex.: PDF para o médico) | registros de dose, tratamentos, biomarcadores | consentimento específico (art. 11, I) |
| Controle de estoque e compras | estoque, compras, leitura do código de barras da caixa | consentimento específico (art. 11, I) |
| Biomarcadores e locais de aplicação | medidas e locais que você registra | consentimento específico (art. 11, I) |
| Assistente de conversa no app | a pergunta digitada + um resumo dos seus tratamentos, usado como contexto da resposta | consentimento específico (art. 11, I) + consentimento para a transferência internacional (art. 33, VIII — seção 13) |
| Medir como o app é usado, para melhorá-lo (PostHog, só no app do celular) | eventos de uso (telas vistas e ações realizadas), **sem** nome de medicamento, dose ou valor de biomarcador; identificador pseudonimizado | consentimento específico (art. 11, I) + consentimento para a transferência internacional (art. 33, VIII). Sem esse segundo consentimento, o app não envia esses eventos |
| Diagnosticar e corrigir falhas (Sentry, só no app do celular) | relatório técnico do erro: aparelho, versão do app e identificador pseudonimizado da conta, sem conteúdo de saúde a partir da versão 0.34 (seção 6) | execução do serviço que você contratou (art. 7º, V): manter o app funcionando |
| Login, segurança da conta e e-mails de conta (Brevo) | e-mail, sessão | execução do serviço que você contratou (art. 7º, V) |
| Guardar os registros de acesso ao app por 6 meses | data, hora e IP de cada acesso | cumprimento de obrigação legal (art. 7º, II), imposta pelo Marco Civil da Internet (art. 15) |
| Vínculo com o Telegram | identificador do chat do Telegram | consentimento (art. 7º, I): é você quem inicia o vínculo no bot. Os lembretes enviados por lá seguem a primeira linha desta tabela |
| Provar que cumprimos a LGPD | trilha de consentimento, recibo de exclusão | exercício regular de direitos (art. 7º, VI e art. 11, II, "d") — seção 11 |

O app não substitui acompanhamento médico, diagnóstico, prescrição ou atendimento de urgência.

---

## 5. Consentimento específico e destacado para dados de saúde

A LGPD exige que o tratamento de dado de saúde tenha consentimento **específico**, separado do aceite geral dos Termos, e **destacado**, ou seja, visível e fora da letra miúda (art. 11, I). Por isso, no fluxo de cadastro, há uma caixa de marcação própria, com este texto exato:

"Autorizo o uso dos meus dados de saúde para lembretes, histórico, adesão e melhoria do app. Tenho 18 anos ou mais."

Ao lado da caixa, o link "Detalhes" explica em linguagem simples o que cada item significa, o que acontece sem a autorização e como retirá-la.

Esse é o mesmo texto que aparece no fluxo de cadastro. Não existem duas redações para o mesmo consentimento.

**Sem essa marcação, o app não é liberado.** No celular, você vê esse pedido no fim da configuração inicial, antes de qualquer dado ser salvo: até lá, o que você digita fica só no seu aparelho. No computador, ele aparece antes do cadastro. O dosiq é, por definição, um serviço que trata dados de saúde: sem eles não há lembrete, histórico nem adesão para mostrar. Por isso não existe uma versão do app "sem dados de saúde" para oferecer como alternativa. A LGPD permite condicionar o serviço ao consentimento quando o tratamento é indispensável a ele, desde que você seja informado disso com destaque (art. 9º, § 3º). Este parágrafo cumpre esse dever.

Você pode retirar o consentimento a qualquer momento, de graça e pelo próprio app (art. 8º, § 5º). A seção 9 explica o que acontece depois.

Cada vez que você dá ou retira esse consentimento, o dosiq registra o evento numa trilha própria, com a data, a versão desta política que você aceitou e se foi pelo computador ou pelo celular. Ninguém escreve diretamente nessa trilha, nem você nem o próprio dosiq: os registros só entram por uma rotina do banco de dados que carimba os dados automaticamente. Assim, se um dia for preciso provar que você consentiu ou revogou, a prova é confiável.

---

## 6. Com quem seus dados podem ser compartilhados

Não vendemos dados pessoais. Só compartilhamos dados com **operadores**: empresas que processam dados para nós, seguindo nossas instruções, para o app funcionar. A última coluna da tabela informa qual instrumento de proteção de dados existe com cada uma:

- **DPA assinado**: acordo de tratamento de dados assinado entre a DOSIQ e o operador.
- **DPA do provedor**: acordo de tratamento de dados publicado pelo operador, que passa a valer para a DOSIQ quando ela contrata o serviço.
- **Termos do serviço**: o operador não oferece acordo específico. Valem os termos de uso e a política de privacidade que ele publica.

| Operador | O que trata | Onde | Instrumento |
|---|---|---|---|
| **Supabase** | banco de dados e autenticação: todos os dados de cadastro e de saúde | Brasil (São Paulo) | DPA do provedor |
| **Vercel** | hospedagem da versão para computador e das funções de servidor (envio de lembretes, assistente) | funções no Brasil (São Paulo); a entrega de arquivos do site usa a rede global da Vercel | Termos do serviço |
| **Expo** | entrega das notificações do app do celular: o token do aparelho e o texto do lembrete, que pode incluir o nome do medicamento | Estados Unidos | Termos do serviço |
| **Apple / Google** | entregam as notificações aos aparelhos (APNs e FCM), a pedido da Expo | Estados Unidos | termos do sistema do seu aparelho |
| **Push do navegador (computador)** | inscrição de notificação do navegador e texto do lembrete | serviço de push do seu navegador | termos do navegador |
| **PostHog** | eventos de uso do app do celular (telas vistas e ações realizadas). Os eventos **não incluem** nome de medicamento, dose ou valor de biomarcador | Estados Unidos | DPA assinado |
| **Sentry** | relatório técnico de falhas do app do celular: o erro, o aparelho, a versão do app e um identificador pseudonimizado da conta. A partir da versão 0.34, o relatório **não inclui** o conteúdo das consultas ao banco de dados, as mensagens internas do app, o seu e-mail nem o seu IP. Versões anteriores do app podem incluir o rastro técnico das últimas ações antes da falha, como endereços de consulta ao banco de dados com identificadores dos seus registros. Atualize o app para ter a versão mais protetiva | Estados Unidos | DPA assinado |
| **Brevo** | seu e-mail e o conteúdo dos e-mails de conta (confirmação de cadastro, recuperação de senha, avisos sobre a conta) | União Europeia (França e Bélgica) | DPA do provedor |
| **Telegram** | identificador do chat e o texto dos lembretes, se você vincular o bot. O vínculo é sempre feito por você, nunca automaticamente | fora do Brasil | Termos do serviço |
| **Groq** | o texto da sua pergunta ao assistente do app + um resumo dos seus tratamentos, usados como contexto para gerar a resposta. A Groq **não usa** o conteúdo das chamadas para treinar modelos e guarda os registros por até **30 dias**, só para resolver falhas ou investigar abuso | Estados Unidos | DPA do provedor |

Só compartilhamos dados com autoridades quando houver obrigação legal ou ordem de autoridade competente.

---

## 7. Segurança das informações

Adotamos medidas técnicas e administrativas para proteger os dados pessoais contra acesso não autorizado, uso indevido, alteração, divulgação ou destruição (art. 46):

- autenticação de usuário;
- controle de acesso por conta: cada registro só pode ser lido pelo próprio titular, regra aplicada no próprio banco de dados;
- tráfego criptografado entre o app e os servidores;
- as rotinas que gravam ou apagam a trilha de consentimento rodam com permissões restritas dentro do banco de dados. Nem o próprio dosiq tem acesso direto a esses registros: só por rotinas auditadas;
- o identificador usado para localizar a sua trilha depois da exclusão da conta não pode ser revertido (seção 11).

Nenhum sistema é totalmente invulnerável. Se acontecer um incidente de segurança que possa causar risco ou dano relevante a você, avisaremos você e a ANPD (art. 48). Também é importante que você proteja as suas credenciais de acesso.

---

## 8. Direitos do titular e como exercer cada um

Você tem os direitos previstos no art. 18 da LGPD. A maioria pode ser exercida pelo próprio app, com efeito imediato:

| Direito | Onde |
|---|---|
| Confirmação de tratamento e acesso aos dados | Perfil → Privacidade e dados (celular) / Perfil (computador) |
| Exportar uma cópia completa dos seus dados (portabilidade, art. 18, V) | Perfil → Privacidade e dados → Exportar dados (celular) / Perfil → Exportar dados (computador) |
| Revogar o consentimento | Perfil → Privacidade e dados → Revogar consentimento (celular) / Perfil → "Consentimento" → Revogar (computador) |
| Excluir a conta e os dados | Perfil → Privacidade e dados → Excluir conta (**só no app do celular**; veja a nota abaixo) |
| Correção de dados incompletos ou desatualizados | nas próprias telas de cadastro, medicamentos e tratamentos |
| Informação sobre com quem compartilhamos os dados | seção 6 desta Política |
| Reclamar à ANPD | pelo site da ANPD (gov.br/anpd) |

**Exclusão de conta pelo computador**: a versão para computador ainda não tem botão para isso. Você tem duas opções:

1. **Excluir pelo app do celular**, com a mesma conta e efeito imediato; ou
2. **Escrever para privacidade@dosiq.app** pedindo a exclusão. Executamos o pedido em até **15 dias** a partir da confirmação da sua identidade, mesmo prazo que a LGPD fixa para a resposta completa sobre os seus dados (art. 19, II). Podemos pedir uma confirmação simples de identidade, como responder a partir do e-mail de cadastro, para proteger a sua conta contra pedidos de terceiros.

Confirmação, acesso e correção também podem ser pedidos por e-mail, com o mesmo prazo.

---

## 9. O que acontece quando você revoga o consentimento

Revogar não é o mesmo que excluir a conta. A revogação é um estado intermediário, para você decidir com calma o que fazer, e pode ser feita tanto no app do celular quanto no computador.

1. Ao revogar, o app **para de enviar lembretes de dose** imediatamente e fica numa tela única, com três saídas: **exportar seus dados**, **excluir a conta** ou **voltar a consentir**.
2. Exportar e excluir continuam funcionando nesse estado. Essas duas ações nunca ficam bloqueadas.
3. Se você não escolher nenhuma das três saídas em **90 dias**, o dosiq apaga a sua conta e os seus dados, como numa exclusão manual, em até 15 dias depois desse prazo. Cada exclusão desse tipo é conferida por uma pessoa antes de acontecer. Antes disso você recebe dois avisos genéricos, sem mencionar medicamento ou condição de saúde, para não expor a sua situação numa notificação na tela bloqueada.

Retirar só o consentimento para a transferência internacional (seção 13) **não trava o app**. Os alarmes do próprio celular continuam completos; os avisos enviados pelos nossos servidores chegam com um texto genérico, sem medicamento, concentração ou dose. O assistente de conversa e a medição de uso ficam desligados. Você pode fazer isso em Perfil → Privacidade e dados → Processamento fora do Brasil, e voltar atrás quando quiser.

---

## 10. Exclusão de conta e dados

**No app do celular**, você pode excluir a conta a qualquer momento em **Perfil → Privacidade e dados → Excluir conta**, com efeito imediato. **Pelo computador**, o pedido é feito por e-mail (privacidade@dosiq.app) e executado em até **15 dias** a partir da confirmação da sua identidade (seção 8).

Quando a exclusão é confirmada:

- todos os seus dados de saúde e de uso são apagados: medicamentos, tratamentos, registros de dose, estoque, biomarcadores e preferências;
- a sua conta de login é apagada;
- **exceção deliberada**: a trilha do seu consentimento e um recibo da própria exclusão continuam existindo, mas sem nenhum dado clínico. A seção 11 explica por quê.

Os registros de acesso exigidos pelo Marco Civil (seção 4) são guardados pelo prazo legal de 6 meses e apagados depois disso.

Se você tiver um tratamento ativo, o app pede uma confirmação a mais antes de excluir, para evitar que um tratamento em curso seja perdido por engano. Você pode exportar os seus dados antes de excluir, e essa é a forma recomendada de manter uma cópia pessoal.

---

## 11. Retenção de dados: o que sobrevive à exclusão da conta, e por quê

**Regra geral**: quando você exclui a conta, apagamos tudo, sem exceção para os dados clínicos. Não guardamos em lugar nenhum uma cópia "por precaução" do seu histórico de medicamentos, doses ou biomarcadores. Se você quiser uma cópia, exporte antes de excluir (seção 8).

**O que sobrevive** é um registro mínimo: que você consentiu ou revogou em determinada data e que a sua conta foi excluída em determinado momento. Esse registro não é o dado em si. É a **prova de que havia base legal** para tratar os seus dados enquanto eles existiam.

**Por que guardamos essa prova, e por quanto tempo.** Se alguém questionar na Justiça ou na ANPD se o dosiq tratou corretamente os dados de saúde de uma pessoa, o dosiq precisa conseguir mostrar que essa pessoa consentiu em tal data, com tal texto, e que, quando pediu para sair, os dados foram apagados em outra data. A LGPD permite guardar o mínimo necessário para essa defesa: a base é o **exercício regular de direitos** (art. 7º, VI e art. 11, II, "d"), uma das hipóteses que autorizam conservar dados depois do fim do tratamento (art. 16, I). O prazo é de **5 anos**, o mesmo prazo de prescrição das ações de reparação do Código de Defesa do Consumidor (art. 27).

---

## 12. Crianças e adolescentes

O dosiq é destinado a maiores de **18 anos** e está classificado assim nas lojas de aplicativo. O dosiq não é direcionado a crianças nem a adolescentes. Se soubermos que uma conta pertence a alguém com menos de 18 anos, ela será encerrada e os dados serão apagados como numa exclusão (seção 10). Se o sistema do seu aparelho ou a loja de aplicativos informarem a sua faixa etária, o dosiq respeita essa informação.


---

## 13. Transferência internacional

**Onde seus dados ficam.** O banco de dados do dosiq, com os seus dados de cadastro e de saúde, fica **no Brasil**, na região de São Paulo.

**O que sai do Brasil, e por quê.** Alguns operadores da seção 6 processam dados em servidores fora do país, principalmente nos Estados Unidos e, no caso da Brevo, na União Europeia. As funções de servidor do dosiq rodam no Brasil. Esses países não foram reconhecidos pela ANPD como tendo proteção de dados equivalente à brasileira, e os operadores não oferecem as cláusulas-padrão aprovadas pela ANPD. Por isso a transferência se apoia em duas bases diferentes, conforme o tipo de dado:

| O que é transferido | Para quem | Base legal (LGPD, art. 33) |
|---|---|---|
| **Dados ligados à sua saúde**: o conteúdo dos avisos de dose enviados pelos nossos servidores (medicamento, concentração, dose e horário), inclusive a atividade da dose na tela de bloqueio do iPhone, a pergunta ao assistente com o resumo dos tratamentos, os eventos de uso | Expo (e, por meio dela, Apple e Google), serviço de push do seu navegador, Telegram (se você vincular), Groq, PostHog | **seu consentimento específico e em destaque para a transferência** (inciso VIII), numa caixa própria, separada do consentimento da seção 5. **É opcional** |
| **Dados sem conteúdo de saúde**: o identificador do aparelho e um lembrete genérico ("Hora do seu remédio"), e-mail e conteúdo dos e-mails de conta, relatórios de falha sem conteúdo de saúde | Expo/Apple/Google, Brevo, Sentry | **necessidade para executar o serviço que você contratou** (inciso IX, combinado com o art. 7º, V) |

O texto da caixa de consentimento para a transferência é:

"Autorizo enviar meus dados de saúde para fora do Brasil (EUA) para notificações detalhadas, assistente IA e medições de uso. Opcional."

**Se você não der esse consentimento, ou retirá-lo**, nenhum dado ligado à sua saúde é enviado para fora do Brasil. Os alarmes agendados pelo próprio celular continuam completos, porque não saem do aparelho. Os avisos enviados pelos nossos servidores chegam com um texto genérico, sem medicamento, concentração ou dose. O assistente e a medição de uso ficam desligados. Os seus dados continuam guardados no Brasil.

Em todos os casos, o operador só pode usar os dados para prestar o serviço ao dosiq, nunca para uma finalidade própria, e deve aplicar medidas de segurança compatíveis com as da seção 7.

---

## 14. Alterações desta política

Esta Política pode ser atualizada para acompanhar a evolução do produto, mudanças na lei ou alterações técnicas relevantes. A versão vigente fica sempre publicada no canal oficial do produto.

Quando uma alteração mudar o responsável pelos dados, a finalidade, a forma ou a duração do tratamento, ou com quem os dados são compartilhados, o app avisa você com destaque na próxima vez que for aberto e informa o que mudou (LGPD, art. 8º, § 6º e art. 9º, § 2º). Se você não concordar, pode revogar o consentimento ou excluir a conta pelo próprio aviso.
