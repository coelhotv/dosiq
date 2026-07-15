---
title: "Política de Privacidade — v0.3 (vigente)"
description: "Política de privacidade e termos de tratamento de dados pessoais de pacientes em conformidade com a LGPD para o aplicativo dosiq."
version: "0.3.0"
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
updated_at: "2026-07-15"
---

# Política de Privacidade — dosiq (v0.3)

**Fonte de verdade** deste documento — publicação em `apps/web/public/politica-de-privacidade.html` (conversão mecânica, sem reescrita de conteúdo, ver `PLAYBOOK.md §Publicacao` da spec 046). Versão anterior arquivada em [`POLITICA_DE_PRIVACIDADE_v0.2.md`](POLITICA_DE_PRIVACIDADE_v0.2.md). Convenção: cada versão publicada ganha seu próprio arquivo (`_vX.Y.md`); a mais recente com `status: active` é a vigente.

---

## Versão do documento

**v0.3** · **15/07/2026**

### Changelog v0.2 → v0.3

- **Novo**: cláusula de consentimento específico e destacado para dado de saúde (seção 5), com o texto exato exibido no app.
- **Novo**: finalidades detalhadas por tipo de dado, cada uma com a base legal correspondente (seção 4).
- **Novo**: inventário nomeado de operadores/subcontratados — quem trata o quê e onde (seção 6).
- **Reescrita**: retenção (seção 11) — explica que a trilha de consentimento e o recibo de exclusão sobrevivem à exclusão da conta, pseudonimizados.
- **Reescrita**: exclusão de conta (seção 10) — passa a existir dentro do próprio app (não só por e-mail), com o fluxo de revogação e o prazo de 90 dias.
- **Novo**: seção "Como exercer seus direitos" com o caminho exato para cada direito. Revogação de consentimento é autoatendimento no app do celular **e** no computador; exclusão de conta é autoatendimento só no app do celular (pelo computador segue por e-mail, prazo de 15 dias úteis).
- **Preenchido**: responsável pelo tratamento e encarregado/DPO (seção 2) — pessoa física, admitido pela LGPD art. 5º VI/VIII mesmo sem MEI constituído.
- **Atualizado**: canal de contato de privacidade passa a ser privacidade@dosiq.app (dedicado, substitui contact@dosiq.app).
- **Confirmado**: classificação etária 16+ mantida (seção 12), com racional de melhor interesse do adolescente documentado.

---

## 1. Introdução

O **dosiq** é um aplicativo para organização da rotina de medicamentos, acompanhamento de tratamentos, registro de doses e controle de estoque.

Esta Política explica quais dados o dosiq trata, para quê, com que base legal, com quem eles podem ser compartilhados, por quanto tempo ficam guardados e quais escolhas e direitos você tem sobre eles.

---

## 2. Responsável pelo tratamento dos dados

**Controlador**: Antonio Carlos do C. G. Coelho (pessoa física), CPF 199.366.348-70.

**Encarregado (DPO)**: Antonio Carlos do C. G. Coelho — mesmo contato.

**Contato de suporte e privacidade**: privacidade@dosiq.app

---

## 3. Quais dados tratamos

### 3.1. Dados de cadastro e autenticação
- e-mail
- identificador interno da conta
- informações necessárias para autenticação e manutenção de sessão

### 3.2. Dados de saúde e rotina que você informa
- nomes de medicamentos
- tratamentos cadastrados (dose, horário, frequência)
- registros de doses tomadas
- estoque de medicamentos
- **biomarcadores** (glicemia, peso, pressão arterial)

Esses dados são **dados pessoais sensíveis**, nos termos da LGPD, por estarem relacionados à sua saúde.

### 3.3. Dados técnicos mínimos de funcionamento
- informações básicas de sessão
- identificadores técnicos da conta
- token de notificação push, quando você ativa lembretes (no computador ou no celular)
- identificador de vínculo com o Telegram, se você conectar o bot

### 3.4. O que não fazemos por padrão
- não vendemos seus dados pessoais
- não compartilhamos dados de saúde com anunciantes
- não usamos rastreamento publicitário como finalidade do produto

---

## 5. Consentimento específico e destacado para dados de saúde

> A LGPD (art. 11) exige que dado de saúde tenha consentimento **específico** (não misturado com o aceite geral de Termos) e **destacado** (visível, não escondido em letra miúda). Por isso, no cadastro, você vê uma caixa de marcação separada, com este texto exato:

> **"Autorizo o dosiq a tratar meus dados de saúde (medicamentos, doses, adesão e biomarcadores) para me enviar lembretes, registrar meu histórico e calcular minha adesão ao tratamento, e declaro ter 16 anos ou mais."**

Esse é o mesmo texto que aparece na tela de cadastro — não existem duas redações diferentes para o mesmo consentimento.

**Sem essa marcação, sua conta não é criada.** Isso não é um truque para forçar aceite: o dosiq é, por definição, um serviço que trata dado de saúde — não existe uma versão do app "sem dados de saúde" para oferecer como alternativa. A base legal aqui é o art. 11, II, alíneas 'a' e 'f' da LGPD: o tratamento é indispensável para a execução do próprio serviço que você pediu. Você pode ler mais sobre isso nos Termos de Uso.

Cada vez que você marca ou retira esse consentimento, o dosiq registra um evento numa trilha própria — com a data, a versão desta política que você aceitou e se foi pelo computador ou pelo celular. Essa trilha não pode ser adulterada nem por você mesmo: nem o próprio dosiq escreve linhas diretas nela, só através de uma rotina de banco de dados que carimba os dados automaticamente. É o que garante que, se um dia precisarmos provar que você consentiu (ou que revogou), a prova é confiável.

---

## 4. Para que tratamos cada dado, e com que base legal

| Finalidade | Dados envolvidos | Base legal (LGPD) |
|---|---|---|
| Lembretes de dose | tratamentos, horários, token de push/e-mail | consentimento específico (art. 11, dado de saúde) + execução do serviço solicitado |
| Registro de doses tomadas | registros de dose | consentimento específico (art. 11) + execução do serviço |
| Cálculo de adesão ao tratamento | registros de dose, tratamentos | consentimento específico (art. 11) + execução do serviço |
| Controle de estoque | estoque, compras | execução do serviço solicitado (art. 7º, V) |
| Biomarcadores (glicemia, peso, pressão) | biomarcadores | consentimento específico (art. 11) — você escolhe registrar cada medida |
| Login e segurança da conta | e-mail, sessão | execução do serviço + cumprimento de obrigação legal (segurança, art. 46) |
| Assistente de conversa (chatbot) | pergunta digitada + dados do seu painel usados como contexto da resposta | consentimento (você inicia a conversa) + legítimo interesse na qualidade da resposta |
| Vínculo com o Telegram | identificador de chat do Telegram | consentimento — você é quem inicia a vinculação (link direto no bot) |
| Prova de conformidade LGPD | trilha de consentimento, recibo de exclusão | exercício regular de direitos (art. 7º, VI · art. 16, III) — ver seção 11 |

O app não substitui acompanhamento médico, diagnóstico, prescrição ou atendimento de urgência.

---

## 6. Com quem seus dados podem ser compartilhados

Não vendemos dados pessoais. O compartilhamento existe só com **operadores** — empresas que processam dados por nós, sob instrução nossa, para o app funcionar:

| Operador | O que trata | Onde/como |
|---|---|---|
| **Supabase** | banco de dados, autenticação, todos os dados de cadastro e saúde | infraestrutura de banco de dados na nuvem que hospeda a persistência do app |
| **Vercel** | hospedagem da versão para computador e das funções de servidor de aplicações (envio de notificações, chatbot) | hospedagem/computação na nuvem |
| **Expo / push notifications** | token de notificação, para entregar lembretes no app do celular | serviço de push do ecossistema Expo (Android/iOS) |
| **Push do navegador (computador)** | inscrição de notificação do navegador, para lembretes na versão para computador | padrão de push do navegador (tecnicamente "Web Push/VAPID"), sem operador terceiro adicional além do próprio navegador |
| **Firebase Analytics** (Google) | eventos de uso do app do celular (telas vistas, ações realizadas) — não inclui conteúdo de doses/medicamentos no evento | serviço de analytics do Google, só no app do celular |
| **Telegram** | identificador de chat, se você optar por vincular o bot | serviço de mensageria do próprio Telegram; a vinculação é sempre uma ação sua, nunca automática |
| **Groq** | o texto da sua pergunta ao assistente + um resumo dos seus dados de tratamento, enviados como contexto para gerar a resposta | provedor de inferência de IA que processa a conversa. A Groq **não usa** o conteúdo das chamadas de API para treinar modelos, e retém logs de entrada/saída por até **30 dias**, só para resolução de falhas ou investigação de abuso — não como prática padrão de guarda. |

O compartilhamento com autoridades só ocorre mediante obrigação legal ou ordem de autoridade competente.

---

## 7. Segurança das informações

São adotadas medidas razoáveis para proteger os dados pessoais contra acesso não autorizado, uso indevido, alteração, divulgação ou destruição indevida:

- autenticação de usuário;
- controle de acesso por conta;
- segregação lógica de dados;
- uso de infraestrutura com mecanismos adequados de segurança;
- as rotinas que gravam ou apagam sua trilha de consentimento rodam com permissões restritas dentro do banco de dados — nem o próprio dosiq acessa esses registros por um caminho direto, só por rotinas auditadas;
- o identificador usado para localizar sua trilha após a exclusão da conta é irreversível (explicado na seção 11) — mesmo em caso de vazamento do banco, não é possível transformar esse identificador de volta no seu e-mail.

Ainda assim, nenhum sistema é totalmente invulnerável. Por isso, também é importante que você proteja suas credenciais de acesso.

---

## 8. Direitos do titular e como exercer cada um

As ações abaixo são de **autoatendimento, com efeito imediato**, tanto no app do celular quanto no computador (Perfil → seção "Consentimento" / "Privacidade e dados", conforme a plataforma):

| Direito | Onde |
|---|---|
| Confirmação de tratamento e acesso aos dados | Perfil → Privacidade e dados (celular) / Perfil (computador) |
| Exportar uma cópia completa dos seus dados (portabilidade, art. 18, V) | Perfil → Privacidade e dados → Exportar dados (celular) / Perfil → Exportar dados (computador) |
| Revogar o consentimento de dados de saúde | Perfil → Privacidade e dados → Revogar consentimento (celular) / Perfil → "Consentimento" → Revogar (computador) |
| Excluir a conta e os dados | Perfil → Privacidade e dados → Excluir conta (**só no app do celular** — ver nota abaixo) |
| Correção de dados incompletos ou desatualizados | diretamente nas telas de cadastro/medicamentos/tratamentos |

**Exclusão de conta pelo computador**: essa ação ainda não tem botão de autoatendimento na versão para computador. Você tem duas opções:

1. **Baixar o app no celular** — mesma conta, ação imediata; ou
2. **Escrever para privacidade@dosiq.app** pedindo a exclusão. Respondemos e executamos em **até 15 dias úteis** a partir da confirmação da sua identidade (nos alinhamos ao prazo do art. 19 da LGPD para confirmação/acesso, e adotamos o mesmo prazo por padrão para os demais pedidos que ainda dependem de e-mail). Podemos pedir uma confirmação simples de identidade (ex.: responder de dentro do próprio e-mail de cadastro) antes de agir, para proteger sua conta contra pedidos indevidos de terceiros.

Confirmação/acesso e correção de dados também podem ser pedidos por e-mail, com o mesmo prazo, se por algum motivo você preferir não usar o app.

---

## 9. O que acontece quando você revoga o consentimento

Revogar não é a mesma coisa que excluir a conta — é um estado intermediário, para você decidir com calma o que fazer. A revogação é **autoatendimento tanto no app do celular quanto no computador** (Perfil → Revogar consentimento).

1. Ao revogar, o app **para de te enviar lembretes de dose** imediatamente e trava numa tela única, com exatamente três saídas: **exportar seus dados**, **excluir a conta** ou **voltar a consentir**.
2. Você consegue exportar seus dados e excluir a conta mesmo estando nesse estado travado — essas duas ações nunca ficam bloqueadas.
3. Se você não tomar nenhuma dessas três ações em **90 dias**, o dosiq apaga automaticamente sua conta e seus dados, do mesmo jeito que uma exclusão manual. Você recebe avisos antes disso acontecer (dois avisos genéricos, sem menção a medicamento ou condição de saúde, para não expor sua situação em uma notificação bloqueada na tela do celular).

---

## 10. Exclusão de conta e dados

**No app do celular**, você pode excluir sua conta a qualquer momento em **Perfil → Privacidade e dados → Excluir conta**, sem precisar de e-mail — ação imediata. **No computador**, o pedido é por e-mail (privacidade@dosiq.app), com prazo de execução de até **15 dias úteis** a partir da confirmação da sua identidade (mesmo prazo da seção 8) — continua valendo enquanto o computador não tiver o botão de autoatendimento.

Ao confirmar a exclusão:

- todos os seus dados de saúde e uso são apagados — medicamentos, tratamentos, registros de dose, estoque, biomarcadores, preferências;
- sua conta de login é apagada;
- **exceção deliberada**: a trilha do seu consentimento e um recibo da própria exclusão continuam existindo, mas sem o seu e-mail nem qualquer dado clínico — ver seção 11 para o porquê.

Se você tiver um tratamento marcado como ativo no momento, o app pede confirmação extra antes de excluir (para evitar que você perca o controle de um tratamento em curso por engano). Você pode exportar seus dados antes de excluir — é a forma recomendada de manter uma cópia pessoal.

---

## 11. Retenção de dados — o que sobrevive à exclusão da conta, e por quê

Esta é a parte que mais gera dúvida, então vamos com calma.

**Regra geral**: quando você exclui sua conta, apagamos tudo — sem exceção para os dados clínicos. Nenhuma cópia de "backup por precaução" do seu histórico de medicamentos, doses ou biomarcadores fica guardada em lugar nenhum. Se você quiser uma cópia, exporte antes de excluir (seção 8) — essa é a única cópia que existe depois.

**A única coisa que sobrevive** é um registro mínimo de que você existiu como usuário, consentiu (ou revogou) em determinada data, e que sua conta foi excluída em determinado momento. Não é o dado — é a **prova de que houve base legal** para tratar o dado enquanto ele existiu.

Por que guardamos essa prova, e por quanto tempo? Porque se um dia alguém questionar judicialmente se o dosiq tratou os dados de saúde de uma pessoa de forma correta, o dosiq precisa conseguir mostrar: "sim, essa pessoa consentiu nesta data, com este texto, e quando pediu para sair, apagamos tudo nesta outra data". Sem esse registro, "apagar direito" e "nunca ter cuidado direito" ficam indistinguíveis. A LGPD prevê exatamente essa retenção mínima, sob a base legal de **exercício regular de direitos** (art. 7º, VI e art. 16, III), pelo prazo de **5 anos** — o mesmo prazo geral de prescrição usado no Código de Defesa do Consumidor.

**Como isso é guardado sem manter seu e-mail**: em vez do seu e-mail, guardamos uma versão embaralhada dele (um "hash" com uma chave secreta que só existe dentro do banco de dados). Esse embaralhamento é **de mão única** — não existe operação que transforme o resultado de volta no seu e-mail. Ele só serve para uma coisa: se um dia recebermos um requerimento judicial nomeando você especificamente, conseguimos embaralhar o e-mail informado no requerimento da mesma forma e comparar, para confirmar que a linha é sua — sem nunca ter mantido seu e-mail em claro depois da exclusão. Se a chave secreta usada nesse embaralhamento for perdida, essa trilha vira permanentemente anônima — e essa chave nunca é trocada, exatamente para não correr esse risco.

---

## 12. Crianças e adolescentes

O dosiq é classificado para maiores de **16 anos** nas lojas de aplicativo. O dosiq não é direcionado a crianças (0-12 anos, definição do Estatuto da Criança e do Adolescente) em nenhuma circunstância.

Para adolescentes de 16-17 anos, o dosiq trata o consentimento de dados de saúde conforme o princípio do melhor interesse do adolescente (LGPD, art. 14, caput): seus dados nunca são usados para publicidade direcionada, perfilamento comercial ou qualquer finalidade além da organização do próprio tratamento medicamentoso que você mesmo cadastra. A linguagem do consentimento (seção 5) é a mesma para todos os usuários — simples e direta, sem juridiquês.

---

## 13. Transferência internacional

Dependendo dos provedores de infraestrutura utilizados, alguns dados podem ser processados em servidores localizados fora do Brasil. Quando isso ocorrer, serão buscados fornecedores com padrões adequados de segurança e proteção de dados.

---

## 14. Alterações desta política

Esta Política de Privacidade poderá ser atualizada periodicamente para refletir evolução do produto, mudanças legais ou alterações técnicas relevantes. A versão atualizada passará a ser disponibilizada no canal oficial do produto.
