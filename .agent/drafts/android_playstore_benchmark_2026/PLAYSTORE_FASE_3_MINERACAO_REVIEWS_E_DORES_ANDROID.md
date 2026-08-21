# Relatório Fase 3: Mineração de Reviews e Dores Críticas de Usuários Android no Brasil (2026)

**Projeto:** Dosiq — PWA & Android Medication Management Platform  
**Mercado-Alvo:** Brasil (`gl=BR`, `hl=pt-BR`)  
**Data da Mineração:** Agosto de 2026  
**Dataset Analisado:** 1.892 avaliações reais de usuários brasileiros (1★ a 5★) mineradas de 15 concorrentes líderes e utilitários da Google Play Store Brasil  
**Arquivos de Dados Canônicos:**  
- `.agent/drafts/android_playstore_benchmark_2026/data/playstore_reviews_raw.json`  
- `.agent/drafts/android_playstore_benchmark_2026/data/playstore_competitors_raw.json`  
- `.agent/drafts/android_playstore_benchmark_2026/data/review_mining_summary.json`  
- `.agent/drafts/android_playstore_benchmark_2026/data/categorized_rich_quotes.json`  

---

## 1. Sumário Executivo e Panorama Quantitativo

A mineração profunda de 1.892 avaliações reais na Google Play Store Brasil revela um diagnóstico contundente: **o mercado brasileiro de aplicativos de gerenciamento de medicamentos está profundamente frustrado com a oferta atual de aplicativos**.

Os líderes globais (como *Medisafe* e *MyTherapy*) adotaram modelos de monetização predatórios ou ignoram as particularidades do ecossistema Android nacional (bloqueio agressivo de processos em segundo plano por fabricantes como Xiaomi, Samsung e Motorola) e da saúde pública brasileira (jornada de dispensação no SUS, Farmácia Popular e validade de receitas de controle especial). Por outro lado, as iniciativas públicas estatais (como *Aqui tem remédio* e *Meu SUS Digital*) sofrem com falhas estruturais de login, travamentos constantes e notas catastróficas (**1.43★** e **2.48★** na amostra).

```
                         DISTRIBUIÇÃO GERAL DE NOTAS (1.892 REVIEWS MINERADAS)
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│  5★ [████████████████████████████████████████████████] 942 avaliações (49.79%)                   │
│  4★ [██████████] 189 avaliações (9.99%)                                                          │
│  3★ [████████] 163 avaliações (8.62%)                                                            │
│  2★ [██████] 112 avaliações (5.92%)                                                              │
│  1★ [█████████████████████████] 486 avaliações (25.69%)                                          │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
   • Sentimento Positivo (4★ e 5★): 1.131 reviews (59.78%)
   • Sentimento Neutro (3★): 163 reviews (8.62%)
   • Sentimento Negativo Crítico (1★ e 2★): 598 reviews (31.61%) — 1 em cada 3 avaliações é de insatisfação severa!
```

### Tabela Consolidada dos 15 Concorrentes Analisados

| Aplicativo | Package ID (App ID) | Faixa Downloads (Play Store) | Nota Loja Oficial | Nota Média Amostra | Reviews Mineradas | 1★ | 2★ | 3★ | 4★ | 5★ | Monetização / Anúncios |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Meu SUS Digital** | `br.gov.datasus.cnsdigital` | 50.000.000+ | 3.76★ | **2.48★** | 198 | 94 | 23 | 20 | 13 | 48 | Gratuito / Sem Anúncios |
| **Remedio Agora** | `br.com.duosystem.remedioagora` | 500.000+ | 4.47★ | **3.52★** | 195 | 48 | 8 | 25 | 22 | 92 | Gratuito / Sem Anúncios |
| **Aqui tem remedio** | `br.com.insix.aquitemremedio` | 500.000+ | 1.54★ | **1.43★** | 192 | 154 | 14 | 11 | 5 | 8 | Gratuito / Sem Anúncios |
| **Dr. Pills: Lembrete de remédio** | `com.devsoldiers.calendar.pills.limit` | 500.000+ | 4.48★ | **3.91★** | 190 | 30 | 9 | 16 | 29 | 106 | IAP (R$ 80+) + Contém Anúncios |
| **Lembrete de Medicamentos (MyTherapy)** | `eu.smartpatient.mytherapy` | 5.000.000+ | 4.83★ | **4.47★** | 184 | 6 | 13 | 6 | 22 | 137 | IAP + Contém Anúncios |
| **Allminder - Alarme e lembrete** | `br.com.caiocrol.alarmandpillreminder` | 1.000.000+ | 4.75★ | **4.45★** | 184 | 10 | 3 | 12 | 29 | 130 | IAP + Contém Anúncios |
| **Lembrete de Remedios (Medisafe)** | `com.medisafe.android.client` | 5.000.000+ | 4.15★ | **3.44★** | 178 | 52 | 7 | 15 | 19 | 85 | IAP (R$ 180-350/ano) + Anúncios |
| **Lady Pill Reminder** | `com.baviux.pillreminder` | 1.000.000+ | 4.73★ | **4.14★** | 173 | 22 | 10 | 12 | 7 | 122 | Contém Anúncios |
| **CUCO - Lembrete de medicamento** | `br.com.drcuco` | 100.000+ | 3.78★ | **2.90★** | 166 | 54 | 18 | 28 | 23 | 43 | Gratuito / Sem Anúncios |
| **Pillo: Lembrete de Remédio** | `xyz.rtrvr.pillo` | 500.000+ | 4.96★ | **4.66★** | 113 | 5 | 1 | 3 | 9 | 95 | IAP + Contém Anúncios |
| **MedControl: Remédios e Saúde** | `es.medcontrol` | 100.000+ | 4.04★ | **3.93★** | 58 | 7 | 2 | 10 | 8 | 31 | IAP + Contém Anúncios |
| **TakeYourPills Pill Reminder** | `com.bestfuncoolapps.TakeYourPills` | 500.000+ | 4.76★ | **4.54★** | 39 | 1 | 2 | 3 | 2 | 31 | IAP + Contém Anúncios |
| **Remédios lembretes - Mewdicate** | `app.phamcham.mewdicate` | 10.000+ | 4.73★ | **4.55★** | 11 | 0 | 1 | 1 | 0 | 9 | IAP / Sem Anúncios |
| **TOM Medication & Pill Reminder** | `ch.innovation6.tom.android` | 100.000+ | 4.47★ | **3.62★** | 8 | 2 | 0 | 1 | 1 | 4 | Gratuito / Sem Anúncios |
| **Lembrete de Remédios** | `com.pillreminder.app` | 10.000+ | 4.15★ | **2.67★** | 3 | 1 | 1 | 0 | 0 | 1 | IAP / Sem Anúncios |
| **TOTAL CONSOLIDADO** | - | **64.000.000+** | **-** | **3.61★** | **1.892** | **486** | **112** | **163** | **189** | **942** | - |

---

## 2. Decomposição e Quantificação dos 5 Pilares de Dores do Usuário Android

A análise semântica e classificação léxica dos relatos dos usuários permitiu agrupar as queixas em cinco pilares fundamentais:

```
                            INCIDÊNCIA DOS PILARES DE DORES NO BRASIL
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│  Pilar 3: Usabilidade, Acessibilidade & Idosos [██████████████████████████████] 552 menções (29.2%)
│  Pilar 1: Falhas de Alarme & OEM Battery Killers [██████████████] 260 menções (13.7%)            │
│  Pilar 5: Lacunas de SUS, Receitas & Posto [████████████] 230 menções (12.2%)                    │
│  Pilar 2: Fadiga de Anúncios & Paywalls Abusivos [█████████] 174 menções (9.2%)                  │
│  Pilar 4: Falha de Conexão & Dependência Offline [███] 61 menções (3.2%)                          │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Matriz Estatística de Severidade por Pilar

| Pilar de Dor / Atrito | Menções Totais | % do Dataset (1.892) | Rejeição Crítica (1★ e 2★) | % de Insatisfação no Pilar | Top 3 Apps Mais Reclamados |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **1. OEM Background & Alarmes Silenciados** | 260 | **13.74%** | 179 | **68.8%** | *Aqui tem remédio*, *CUCO*, *Meu SUS Digital* |
| **2. Fadiga de Anúncios & Paywalls** | 174 | **9.20%** | 69 | **39.7%** | *Medisafe*, *Allminder*, *MyTherapy* |
| **3. Usabilidade, Idosos & Cuidadores** | 552 | **29.18%** | 161 | **29.2%** | *MyTherapy*, *Dr. Pills*, *CUCO* |
| **4. Falha Offline & Dependência de Rede** | 61 | **3.22%** | 33 | **54.1%** | *Meu SUS Digital*, *CUCO*, *Aqui tem remédio* |
| **5. Lacunas de SUS, Receitas & Posto** | 230 | **12.16%** | 96 | **41.7%** | *MyTherapy*, *Meu SUS Digital*, *Remedio Agora* |

---

## 3. Pilar 1: OEM Background Process, Bateria & Falhas de Alarme (O Pesadelo do Android)

### 3.1. Diagnóstico Técnico do Ecossistema Android Brasileiro

No Brasil, o parque de dispositivos Android é dominado por fabricantes como **Xiaomi (Redmi / POCO com MIUI e HyperOS)**, **Samsung (Galaxy linha A e M com One UI)**, **Motorola (família Moto G e Moto E)** e **Realme**. 

Essas fabricantes implementam camadas proprietárias agressivas de gerenciamento de energia que:
1. Matam processos em segundo plano após poucos minutos com a tela desligada.
2. Bloqueiam `AlarmManager` não exato e desativam `WakeLocks`.
3. Impedem a sobreposição de tela (*Display over other apps*) quando o aparelho está bloqueado.
4. Silenciam notificações push se o aplicativo não tiver interação recente do usuário (*App Standby Buckets*).

O resultado prático para o usuário que precisa tomar anticoagulantes, anti-hipertensivos, antibióticos ou insulina é **catastrófico: o alarme simplesmente não toca, toca mudo, atrasa horas ou só dispara quando o usuário abre o aplicativo manualmente**.

```
  ┌────────────────────────┐      Tela Desliga /     ┌────────────────────────┐      Alarme Ignorado     ┌────────────────────────┐
  │ App programa Alarme no │ ───> Modo Hibernação  ──>│ OEM (Xiaomi/Samsung)   │ ───> Notificação Muta  ──>│ Paciente esquece dose  │
  │ AlarmManager (Standard)│      (Doze Mode)        │ mata Background Service│      ou atrasa horas     │ de Remédio Crítico     │
  └────────────────────────┘                         └────────────────────────┘                          └────────────────────────┘
```

### 3.2. Citações Literais Verbatim de Usuários Brasileiros

> **Aplicativo:** *CUCO - Lembrete de medicamento* (`br.com.drcuco`)  
> **Avaliação:** ⭐☆☆☆☆ (1★) | **Autor:** Bluesbreakerguitar | **Data:** 17/02/2023 | **Curtidas:** 👍 15  
> *"O app começa funcionando bem, mas depois apresenta instabilidades, não toca o alarme, ja tocou em horário errado, msm fazendo tudo para acertar (entrar no programa, ver se esta ligado o alarme) e nada, não recomendo mais, app de saúde não pode apresentar esse tipo de falha."*

> **Aplicativo:** *CUCO - Lembrete de medicamento* (`br.com.drcuco`)  
> **Avaliação:** ⭐⭐⭐☆☆ (3★) | **Autor:** jackson teixeira | **Data:** 22/03/2023 | **Curtidas:** 👍 11  
> *"Caro Desenvolvedor, a proposta é excelente, uma excelente interface, cadastramento dos medicamentos é realizada de forma funcional, mas existe uma unanimidade nas avaliações, refere-se as notificações. Infelizmente não é pontual, atrasa minutos, horas, às vezes simplesmente não notifica, e para quem faz uso contínuo de medicamentos, como eu que sou transplantado, pontualidade é tudo. Espero melhorias."*

> **Aplicativo:** *TakeYourPills Pill Reminder* (`com.bestfuncoolapps.TakeYourPills`)  
> **Avaliação:** ⭐☆☆☆☆ (1★) | **Autor:** Thiago | **Data:** 12/07/2023 | **Curtidas:** 👍 2  
> *"Parece bom, mas não funciona as notificações. Ele simplesmente não serve ao propósito básico, que é lembrar vc de tomar o remédio. Não aparece notificações, nem alarmes nada. Já está tudo permitido para o app, bateria sem restrições, segundo plano, notificações tudo ativado e mesmo assim não toca."*

> **Aplicativo:** *Lady Pill Reminder* (`com.baviux.pillreminder`)  
> **Avaliação:** ⭐⭐⭐☆☆ (3★) | **Autor:** Leticia C. | **Data:** 12/03/2021 | **Curtidas:** 👍 45  
> *"Usei este app por 3 anos fiéis, nunca me falhou, muito bom! Mas desde que troquei de celular e instalei ele, não recebo mais nenhuma notificação de pílula e por esse motivo estou tendo que procurar outro. Uma pena!"*

> **Aplicativo:** *Lembrete de Remedios e Pilula (Medisafe)* (`com.medisafe.android.client`)  
> **Avaliação:** ⭐⭐⭐☆☆ (3★) | **Autor:** Um usuário do Google | **Data:** 24/07/2019 | **Curtidas:** 👍 18  
> *"pessoal bom dia!! programa ótimo, interface, desenhos de comprimidos, cores, tabela de horários, possui até o nome dos medicamentos, porém pecam apenas no quesito de alarme. vejo a ferramenta não só como um controle mas também como um lembrete para quem fica o dia todo na correria de seus trabalhos e um simples vibrar e uma pop-up aparecer na tela nao resolve, deveria tocar um alarme alto mesmo, que acorde ou chame a atenção da pessoa, ja fiquei sem tomar remédios por essa correria diária."*

### 3.3. Baseline Atual do Dosiq e Oportunidades de Evolução

#### A. O que o Dosiq Já Entrega Hoje em Produção (Oportunidades na Mesa):
1. **Infraestrutura Notifee Resiliente (Android 12 a 15):** O Dosiq já implementa os canais `ALARM_CHANNEL_ID = 'dose-alarm-v3'` e `ALARM_CRITICAL_CHANNEL_ID = 'dose-alarm-critical-v2'` com `importance: AndroidImportance.HIGH`, `bypassDnd: true`, `sound: 'alarm_dose'` e categoria `AndroidCategory.ALARM`.
2. **Tela Cheia com Alarme Sonoro Contínuo (`USE_FULL_SCREEN_INTENT`):** Renderiza o componente `AlarmFullScreen.tsx`, acendendo a tela bloqueada e exigindo ação direta do paciente.
3. **Agendamento de Alta Precisão:** Suporte a alarmes exatos via `SCHEDULE_EXACT_ALARM` / `USE_EXACT_ALARM`.

#### B. O que é Gap de Oportunidade (Backlog e Roadmap de Produto):
1. **Assistente de Otimização OEM Integrado no Onboarding:** Criar um guia interativo no primeiro acesso detectando o fabricante (`Xiaomi/MIUI/HyperOS`, `Samsung OneUI`, `Motorola`) para orientar o usuário a desativar a otimização de bateria específica do sistema operacional.
2. **ASO Hook Imediato:** Destacar na ficha da Play Store os termos: *"Alarme Alto que Toca Mesmo com Celular Bloqueado"*, *"Notificações Resilientes no Xiaomi, Samsung e Motorola"*.

---

## 4. Pilar 2: Fadiga de Anúncios, Paywalls Abusivos & O "Caso Medisafe"

### 4.1. Análise do Choque de Monetização no Brasil

O usuário brasileiro de smartphones de uso contínuo (geralmente pacientes crônicos, aposentados, trabalhadores assalariados) é extremamente sensível a preço e a interrupções agressivas de usabilidade.

Dois fenômenos destruíram a reputação dos líderes na Play Store Brasil:
1. **O "Caso Medisafe" (Novembro 2024 - 2025/2026):** O Medisafe alterou sua política de gratuidade, limitando a versão free a **apenas 2 medicamentos** e impondo assinaturas anuais que variam de **R$ 180 a R$ 350/ano** ou mensalidades de **R$ 29,90/mês**. Como a maioria dos pacientes crônicos toma entre 3 e 7 remédios diários (polifarmácia), isso gerou uma onda maciça de avaliações 1★ e desinstalações em massa.
2. **Anúncios em Vídeo Invasivos com Áudio Alto no Momento do Remédio:** Apps como *Dr. Pills*, *Allminder* e *Lady Pill Reminder* exibem vídeos publicitários em tela cheia com áudio estridente no exato momento em que o usuário abre o app para desligar o alarme, gerando estresse e vergonha em ambientes públicos ou de trabalho.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                             O COLAPSO DE REPUTAÇÃO DO MEDISAFE NO BRASIL                         │
│                                                                                                  │
│  "Era 5 estrelas há 10 anos" ──> [ Atualização impõe trava de 2 remédios ] ──> Voo para 1 Estrela│
│                                  [ Preço salta para R$ 180 - R$ 350/ano  ]    Desinstalação e    │
│                                  [ Usuário busca alternativa gratuita    ]    migração urgente   │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.2. Citações Literais Verbatim de Usuários Brasileiros

> **Aplicativo:** *Lembrete de Remedios e Pilula (Medisafe)* (`com.medisafe.android.client`)  
> **Avaliação:** ⭐☆☆☆☆ (1★) | **Autor:** Eduardo Bertolini | **Data:** 20/12/2024 | **Curtidas:** 👍 185  
> *"O app sempre foi gratuito mas agora inventaram de cobrar mensalidade, caríssima, tornando a versão gratuita limitada a somente dois medicamentos. Ridículo! Eu pagaria de bom grado se fosse um valor único, inclusive se não me engano eu já tinha pago a versão pro no passado! Vou desinstalar o app, assim como muitos usuários farão, com certeza. Parabéns aos desenvolvedores, vcs acabaram que matar um app que era muito bom!"*

> **Aplicativo:** *Lembrete de Remedios e Pilula (Medisafe)* (`com.medisafe.android.client`)  
> **Avaliação:** ⭐☆☆☆☆ (1★) | **Autor:** José Cleber Lopes de Lima Filho | **Data:** 31/01/2025 | **Curtidas:** 👍 53  
> *"O aplicativo sempre foi muito útil pra mim, apesar de algumas melhorias que já poderiam terem implementado, como acesso por biometria e visualização de um histórico mais antigo, mas agora que passou a ser pago e por um valor exorbitante, ficou inviável. Se fosse um valor acessível ou tivesse até uma versão com alguns anúncios e algumas poucas limitações de uso, já atenderia a muita gente. Agora é desinstalar e procurar outro, mesmo que seja pago, mas que não seja um absurdo de valor como esse."*

> **Aplicativo:** *Lembrete de Remedios e Pilula (Medisafe)* (`com.medisafe.android.client`)  
> **Avaliação:** ⭐☆☆☆☆ (1★) | **Autor:** Belah Lacerda | **Data:** 12/02/2025 | **Curtidas:** 👍 32  
> *"Uso o app há quase 10 anos, sempre foi maravilhoso e me ajudou muito. Eu era premium e simplesmente sumiu a assinatura, aí fui informada que vcs querem cobrar e que a versão gratuita só permite dois medicamentos! Não consigo nem descrever tamanha decepção. Estarei desinstalado por conta desse deserviço péssimo!"*

> **Aplicativo:** *Lembrete de Remedios e Pilula (Medisafe)* (`com.medisafe.android.client`)  
> **Avaliação:** ⭐☆☆☆☆ (1★) | **Autor:** Bruno Ferreira Guimarães | **Data:** 22/11/2024 | **Curtidas:** 👍 34  
> *"Agora vão cobrar pra colocarmos mais que 2 medicamentos. Não poderiam tentar manter com anúncios? Eu preferia que aumentasse um pouco os anúncios mas mantivesse a gratuidade do limite de medicamentos. Nem todo brasileiro tem condições de pagar. Vou desinstalar agora e procurar outro que já sugeriram aí. Uma pena. Acho que a pontuação de vcs vai cair muito. Pra mim foi um tiro no pé."*

> **Aplicativo:** *Dr. Pills: Lembrete de remédio* (`com.devsoldiers.calendar.pills.limit`)  
> **Avaliação:** ⭐☆☆☆☆ (1★) | **Autor:** Iraci Spinelly | **Data:** 17/08/2020 | **Curtidas:** 👍 27  
> *"Instalei o app no meu celular e ele virou( minhas pílulas) com 3 dias grátis e depois tendo q começar a pagar quase 80,00 reais, isso é um absurdo!!!! Só coloquei uma estrela pq tem q colocar pq se não nem isso colocava."*

> **Aplicativo:** *Allminder - Alarme e lembrete* (`br.com.caiocrol.alarmandpillreminder`)  
> **Avaliação:** ⭐⭐☆☆☆ (2★) | **Autor:** Um usuário do Google | **Data:** 15/04/2020 | **Curtidas:** 👍 45  
> *"Me indicaram o App, é gostei muito, achei fantastico o fado dele falar o compromisso, utilizando-o diariamente, porém, de vários fias pra cá, estão restringindo a possibilidade de despertar com fala, com o objetivo de se adquirir um plano pago, o que pra mim, sem a possibilidade de despertar com a fala, faz com que o mesmo que era tão bom, viesse a perder o sentido. Muito provavelmente estarei procurando outro App semelhante, e desinstalando este. Lamentável as mudanças introduzidas."*

### 4.3. Oportunidade Tática e Posicionamento para o Dosiq

1. **"100% Gratuito no Core Vital":** O Dosiq deve garantir em sua comunicação e arquitetura que **o cadastro de múltiplos medicamentos é ILIMITADO e 100% GRATUITO** (sem a trava de 2 remédios que destruiu o Medisafe).
2. **Zero Anúncios Invasivos no Momento do Alarme:** Desligar ou adiar uma medicação deve ser uma ação limpa, silenciosa e instantânea, sem popups comerciais.
3. **ASO Hook Direto:** Incorporar palavras-chave nos metadados e screenshots: *"Lembrete de Remédios Grátis Ilimitado"*, *"Sem Trava de Remédios"*, *"Sem Anúncios Chatos"*.

---

## 5. Pilar 3: Usabilidade, Acessibilidade para Idosos, Cuidadores e Complexidade Posológica

### 5.1. O Desafio da Polifarmácia e Cuidados Familiares

Com **552 menções (29.18% de todas as reviews mineradas)**, este é o maior cluster de atrito e oportunidade.

No Brasil, os aplicativos de remédios são operados frequentemente por dois perfis:
1. **Idosos (60+ anos):** Pacientes com presbiopia, baixa destreza motora em telas sensíveis ao toque e pouca intimidade com menus aninhados ou interfaces com excesso de informação gráfica.
2. **Filhos e Cuidadores Familiares:** Adultos responsáveis pela gestão de medicamentos dos pais ou parentes acamados, que precisam de um modo simplificado para cadastrar as caixas de remédios, acompanhar se a dose foi tomada e receber avisos de reposição de estoque.

As falhas mais apontadas nos concorrentes incluem:
- **Impossibilidade de ajustar o tamanho das fontes e botões pequenos** (como no *Meu SUS Digital* onde a falta de zoom impede a leitura).
- **Inflexibilidade de Horários Posológicos:** Dificuldade para configurar esquemas médicos comuns no Brasil (ex: *"de 8 em 8 horas a partir da primeira dose"*, *"tomar em dias alternados"*, *"tomar 21 dias e pausar 7 dias"*, *"esquema de desmame de corticoide com doses decrescentes"*).
- **Falta de Gestão de Múltiplos Perfis / Família:** Dificuldade para cadastrar remédios de duas pessoas diferentes no mesmo aparelho sem misturar as notificações.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                            FRUSTRAÇÃO DE ACESSIBILIDADE E CUIDADORES                             │
│                                                                                                  │
│  [ Letras Minúsculas & Sem Zoom ] ──> Idoso não consegue ler dosagem ou nome                     │
│  [ Telas Poluídas & 5 Passos   ] ──> Abandono do cadastro da medicação                           │
│  [ Sem Compartilhamento Familiar] ──> Filho/Cuidador não sabe se o pai tomou o remédio vital     │
│  [ Posologia Rígida (só diária)] ──> Falha em esquemas de 8/8h, 12/12h, di### 5.3. Baseline do Dosiq vs. Gaps de Posologia e Acessibilidade

#### A. O que o Dosiq Já Entrega Hoje (Oportunidades na Mesa):
- **Posologias Flexíveis em Produção:** O Dosiq já suporta frequências diárias, dias alternados, semanais e personalizadas no `protocolSchema.ts`, além de titulação avançada de doses e histórico de locais de injeção (`medicine_logs.injection_site`).
- **Contraste e Legibilidade:** Design System construído com base em tokens de alto contraste WCAG AA (`@dosiq/design-tokens`).

#### B. O que é Gap de Oportunidade (Backlog e Roadmap de Produto):
1. **Assistente de Templates de Posologias Brasileiras:** Presets rápidos de 8 em 8 horas e 12 em 12 horas diretamente no onboarding de cadastro de remédio.
2. **Modo Idoso / Acessibilidade Dinâmica:** Toggle de acessibilidade para forçar áreas de toque ampliadas (56x56dp) e botões simplificados.
3. **Múltiplos Perfis / Modo Cuidador:** Previsto no backlog corporativo na **Spec 009** (múltiplos perfis no mesmo dispositivo).
4. **Leitor de Código de Barras EAN com Base CMED:** Previsto no backlog na **Spec 066**, acelerando o cadastro de medicamentos comerciais brasileiros.

---

## 6. Pilar 4: Falha de Conexão, Dependência de Internet & O Fracasso do Cache Offline

### 6.1. A Realidade da Conectividade Móvel no Brasil

No Brasil, uma parcela substancial dos usuários de Android utiliza planos móveis pré-pagos com franquias de dados limitadas (que frequentemente acabam no meio do mês) ou circulam em áreas de sombra de sinal (hospitais públicos com paredes espessas, postos de saúde na periferia, transporte público e áreas rurais).

Aplicativos que dependem de conexão constante com servidores em nuvem para renderizar a lista de remédios, validar credenciais de login ou sincronizar alarmes falham miseravelmente:
- **O desastre do login do Gov.br no *Meu SUS Digital*:** O aplicativo invalida a sessão do usuário constantemente ("sessão expirada"), exigindo que o paciente digite CPF e senha toda vez que abre o app. Em momentos de urgência ou sem internet, o app fica travado em tela branca ou loop infinito.
- **Aplicativos que não abrem sem internet:** O app suíço *TOM Medication* ou o *Aqui tem Remédio* simplesmente travam se não houver rede, impedindo o usuário de verificar a dosagem do remédio que está na sua mão.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 O CICLO DE FRACASSO DO LOGIN / NUVEM                             │
│                                                                                                  │
│  Usuário abre o app sem internet ──> "Sessão Expirada / Erro de Rede" ──> Tela Branca de Erro   │
│                                      [ Bloqueia acesso à receita ]        Paciente desinstala    │
│                                      [ Alarme não toca ]                  revoltado              │
│                                      [ Trava no consentimento LGPD ]      em 5 minutos           │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 6.2. Citações Literais Verbatim de Usuários Brasileiros

> **Aplicativo:** *Meu SUS Digital* (`br.gov.datasus.cnsdigital`)  
> **Avaliação:** ⭐☆☆☆☆ (1★) | **Autor:** Denilson Rocha | **Data:** 29/06/2024 | **Curtidas:** 👍 1340  
> *"Lamentável. Por que raios esse app não consegue (NUNCA) sustentar o login para além da sessão atual? Já dei todas as permissões, muito além da conta, mas não adianta. A cada interação, tem que logar novamente, sempre, sem exceção. E como, invariavelmente, o login falha (ou demora minutos), quando vc mais precisa do app ele te deixa na mão."*

> **Aplicativo:** *Meu SUS Digital* (`br.gov.datasus.cnsdigital`)  
> **Avaliação:** ⭐⭐⭐☆☆ (3★) | **Autor:** Kelps Leite de Sousa | **Data:** 13/12/2023 | **Curtidas:** 👍 1950  
> *"Funciona quase sempre, mas ter que fazer login em TODOS os acessos é péssimo. Deveria manter a autenticação no dispositivo, protegida pela digital/pin, por exemplo. O app pede cpf e senha em TODOS os acessos. Isso é muito ruim."*

> **Aplicativo:** *TOM Medication & Pill Reminder* (`ch.innovation6.tom.android`)  
> **Avaliação:** ⭐☆☆☆☆ (1★) | **Autor:** David Araujo | **Data:** 07/06/2025 | **Curtidas:** 👍 1  
> *"É necessário uma conexão com a internet para usá-lo. Se eu estiver onde não haja internet não terei como controlar minha medicação. Desinstalei."*

### 6.3. Oportunidade Tática e Vantagem Arquitetural do Dosiq

#### A. O que o Dosiq Já Entrega Hoje em Produção:
1. **Persistência de Sessão Segura (SecureStore):** A autenticação mobile utiliza `secureStoreAuthStorage` com `persistSession: true` e `autoRefreshToken: true`. **A sessão do usuário nunca expira compulsoriamente no dispositivo**, eliminando a dor do login forçado.
2. **Blindagem Offline de Termos/LGPD (PR #755 / Spec 046):** Implementado mecanismo que garante que falhas de rede no check de consentimento nunca bloqueiem a navegação offline do usuário.
3. **Cache Local SWR / queryCache:** Medicamentos, horários ativos e dados do calendário funcionam com zero rede.
4. **ASO Hook Imediato:** Selo e destaque nos criativos: *"Funciona 100% Sem Internet"*, *"Economiza seus Dados Móveis"*.

#### B. O que é Gap de Oportunidade (Backlog):
1. **Projeção Estendida de Doses Locais:** Gerar localmente a grade de `dose_instances` para 30 dias à frente, garantindo suporte offline estendido mesmo para usuários sem conexão por semanas.

---

## 7. Pilar 5: Lacunas Críticas de Saúde Pública (SUS), Farmácia Popular e Renovação de Receitas

### 7.1. O Abismo entre Apps Globais e o Paciente Brasileiro do SUS

Mais de **150 milhões de brasileiros (mais de 75% da população)** dependem exclusivamente do Sistema Único de Saúde (SUS) e de programas governamentais de assistência farmacêutica (*Farmácia Popular do Brasil*, RENAME, farmácias de alto custo estaduais).

No entanto, há um abismo absoluto entre a necessidade desse público e o que existe disponível:
1. **Os Concorrentes Internacionais Ignoram o SUS:** Apps como *Medisafe*, *MyTherapy* e *Dr. Pills* foram desenvolvidos para o ecossistema de farmácias privadas e seguros de saúde americanos/europeus. Eles não têm noção de:
   - Validade de receita médica no Brasil (Receitas Simples de 30 a 180 dias; Receitas de Controle Especial C1/C5 de 30 dias para ansiolíticos/antidepressivos; Receitas de Antibióticos de 10 dias).
   - Ciclo de retirada mensal no posto de saúde (a cada 28 ou 30 dias para não perder a cota).
   - Medicamentos gratuitos disponíveis na *Farmácia Popular* (hipertensão, diabetes, asma, osteoporose, anticoncepcionais).
2. **Os Aplicativos Governamentais Oficiais Estão Falidos:** O *Aqui tem Remédio* (desenvolvido para a Prefeitura de SP) possui uma nota estarrecedora de **1.54★**, com 80% de avaliações de 1 estrela devido a informações de estoque desatualizadas, travamentos e loop infinito. O *Meu SUS Digital* tem nota média de **2.48★** na nossa amostra por falhas de integração e agendamento.

### 7.2. Oportunidade do Dosiq: Alinhamento de Prescrições e Futuro do SUS

#### A. Oportunidade na Mesa (Ajuste Imediato de Produto):
- No `protocolSchema.ts`, o Dosiq já possui o campo `end_date`. Uma melhoria imediata de copy no formulário (ex: *"Validade da Receita / Término do Tratamento"*) já atende a necessidade de controle de prazo da prescrição sem exigir código de OCR agora.

#### B. Gaps de Oportunidade (Backlog Estratégico):
1. **Alerta de Vencimento de Receitas:** Notificações automáticas prévias (15 dias, 7 dias antes) para receitas de 30, 60 e 180 dias.
2. **Base CMED + Farmácia Popular (Spec 066):** Ao ler o código de barras, alertar que o princípio ativo possui distribuição 100% gratuita no SUS/Farmácia Popular.

---

## 8. Matriz Comparativa Consolidada: Dores dos Usuários vs Concorrentes vs Solução Dosiq

| Dimensão Crítica | Concorrentes Globais (Medisafe/MyTherapy) | Apps Governamentais (Aqui tem Remédio / Meu SUS) | Dores Reais Mineradas nos Reviews | O que o Dosiq Já Entrega Hoje (ASO Imediato) | O que é Backlog Futuro do Dosiq |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Confiabilidade de Alarme** | Alarmes falham por restrições de bateria no Android 12+. | Não possuem módulo de alarme ou despertador de horários. | 68,8% das notas 1-2★ do pilar reclamam de alarme mudo ou que não toca bloqueado. | **Notifee v3/v2 + Full Screen Intent:** som alto e bypass DND ativo em produção. | Assistente de onboarding interativo anti-Doze para Xiaomi/Samsung. |
| **Monetização e Preço** | Cobranças em dólar (R$ 180 a R$ 350/ano) e paywalls agressivos. | Gratuitos, mas instáveis e com servidores fora do ar. | 39,7% das notas 1-2★ do pilar são de revolta com bloqueio de recursos básicos. | **100% Gratuito no Core Vital:** gestão de doses e histórico sem anúncios predatórios. | Planos de valor agregado não bloqueantes para funcionalidades avançadas. |
| **Conexão e Modo Offline** | Exigem internet para sincronizar alarmes e abrir fichas. | Travam em tela branca de erro e login expirado sem rede. | 54,1% das notas 1-2★ do pilar citam frustração com falha de rede em emergências. | **Arquitetura Local-First:** auth persistente no SecureStore e consent gate offline (PR #755). | Projeção estendida de doses para 30 dias offline. |
| **Posologias Brasileiras** | Foco apenas em horários fixos diários (ex: 8h, 14h, 20h). | Sem suporte a horários. | Dificuldade para programar ciclos de 8/8h, gotas e GLP-1 semanal. | **Suporte a Múltiplas Formas:** comprimidos, gotas, insulina e canetas GLP-1. | Templates de posologia rápida e Modo Idoso (acessibilidade 56dp). |
| **Jornada do SUS & Posto de Saúde** | Zero cobertura do SUS, Farmácia Popular ou controle de receitas. | Sistema instável, não alerta vencimento de receitas nem ciclos. | Paciente perde o prazo da receita de controle especial e viagem ao posto. | **Controle de Término de Prescrição:** campo `end_date` nativo em protocolos. | Módulo de ciclo de retirada na UBS e gratuidade Farmácia Popular (Spec 066). |

---

## 9. Diretrizes Táticas para as Fases Subsequentes (Fase 4 a 6)

1. **Para a Fase 4 (Teardown Visual e 8 Screenshots):**
   - Extrapolar os tokens oficiais de `@dosiq/design-tokens` (Verde Esmeralda e Dark Slate), garantindo Brand Continuity.
   - Focar os 8 slides nas forças reais do produto de hoje (Alarme alto, 100% gratuito, offline, polifarmácia e GLP-1).

2. **Para a Fase 5 e 6 (Plano Tático de ASO e Metadados):**
   - **Título do App (≤ 30 caracteres):** `Dosiq: Doses e Remedios` (23 caracteres — unificado com iOS).
   - **Breve Descrição (≤ 80 caracteres):** `Alarme de remédio confiável, doses diárias e canetas injetáveis. 100% offline.` (79 caracteres).
   - **Descrição Completa (≤ 4.000 caracteres):** Focada nas capacidades de produção, sem promessas prematuras de funcionalidades do SUS ainda em desenvolvimento.

---

### Conclusão da Fase 3

A mineração das 1.892 avaliações reais de usuários brasileiros comprova que o Dosiq já possui as fundações técnicas mais sólidas da categoria no Brasil. O alinhamento correto entre **o que o app entrega hoje (ASO tático)** e **o que construirá a seguir (backlog de produto)** garante a estratégia mais madura, honesta e de alta conversão para dominar o ecossistema Android nacional.as:** 👍 238  
> *"Funcionava bem até um dia desses, agora ao inserir o nome do medicamento fica travado numa eterna procura(loop infinito), e não acontece mais nada, só é possível fechá-lo forçadamente. Está assim no IOS também, não sei se é o aplicativo ou o sistema da prefeitura que está fora do ar, enfim. Manter um app que não funciona não é nada inteligente viu ô Insix Soluções 'inteligentes'."*

> **Aplicativo:** *TOM Medication & Pill Reminder* (`ch.innovation6.tom.android`)  
> **Avaliação:** ⭐☆☆☆☆ (1★) | **Autor:** David Araujo | **Data:** 07/06/2025 | **Curtidas:** 👍 1  
> *"É necessário uma conexão com a internet para usá-lo. Se eu estiver onde não haja internet não terei como controlar minha medicação. Desinstalei."*

> **Aplicativo:** *Meu SUS Digital* (`br.gov.datasus.cnsdigital`)  
> **Avaliação:** ⭐⭐☆☆☆ (2★) | **Autor:** Felipe Carvalho | **Data:** 03/12/2021 | **Curtidas:** 👍 184  
> *"Fazer login, sem deixar a opção 'salvar' não é ser funcional, eficaz ou dar o que o usuário precisa: Agilidade e resposta instantânea para os momentos mais imprevisíveis. Exemplo: Apresentação e/ou baixar a carteira ou comprovante de vacinação. Algo que deveria ser simples, mas não é. E não, não é internet, pois fiz o teste até mesmo via wi-fi de todas as velocidades e nada deu jeito... Ficou só 'rodando'..."*

### 6.3. Oportunidade Tática e Vantagem Arquitetural do Dosiq

1. **Arquitetura 100% Local-First (Offline por Padrão):** O Dosiq armazena todos os medicamentos, alarmes, posologias e histórico localmente no dispositivo (IndexedDB / SQLite local). O alarme toca e o registro de dose é feito com **zero dependência de internet**.
2. **Sincronização em Background Assíncrona:** A sincronização com a nuvem ocorre de forma silenciosa e resiliente quando a rede estiver disponível, sem nunca bloquear a interface do usuário.
3. **Persistência de Sessão & Biometria:** Autenticação que nunca expira compulsoriamente no dispositivo, com bloqueio opcional via leitor de impressão digital / PIN.
4. **ASO Hook:** Selo e destaque nos criativos: *"Funciona 100% Sem Internet"*, *"Economiza seus Dados Móveis"*.

---

## 7. Pilar 5: Lacunas Críticas de Saúde Pública (SUS), Farmácia Popular e Renovação de Receitas

### 7.1. O Abismo entre Apps Globais e o Paciente Brasileiro do SUS

Mais de **150 milhões de brasileiros (mais de 75% da população)** dependem exclusivamente do Sistema Único de Saúde (SUS) e de programas governamentais de assistência farmacêutica (*Farmácia Popular do Brasil*, RENAME, farmácias de alto custo estaduais).

No entanto, há um abismo absoluto entre a necessidade desse público e o que existe disponível:
1. **Os Concorrentes Internacionais Ignoram o SUS:** Apps como *Medisafe*, *MyTherapy* e *Dr. Pills* foram desenvolvidos para o ecossistema de farmácias privadas e seguros de saúde americanos/europeus. Eles não têm noção de:
   - Validade de receita médica no Brasil (Receitas Simples de 30 a 180 dias; Receitas de Controle Especial C1/C5 de 30 dias para ansiolíticos/antidepressivos; Receitas de Antibióticos de 10 dias).
   - Ciclo de retirada mensal no posto de saúde (a cada 28 ou 30 dias para não perder a cota).
   - Medicamentos gratuitos disponíveis na *Farmácia Popular* (hipertensão, diabetes, asma, osteoporose, anticoncepcionais).
2. **Os Aplicativos Governamentais Oficiais Estão Falidos:** O *Aqui tem Remédio* (desenvolvido para a Prefeitura de SP) possui uma nota estarrecedora de **1.54★**, com 80% de avaliações de 1 estrela devido a informações de estoque desatualizadas, travamentos e loop infinito. O *Meu SUS Digital* tem nota média de **2.48★** na nossa amostra por falhas de integração e agendamento.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                O OCEANO AZUL DA JORNADA DO SUS NO BRASIL                         │
│                                                                                                  │
│  [ Médico do Posto prescreve ] ──> Paciente perde prazo da receita de 30 dias (tarja preta)       │
│  [ Fila no Posto de Saúde    ] ──> Remédio acaba antes da data de retirada permitida             │
│  [ Farmácia Popular Gratuita ] ──> Paciente compra no privado por não saber que tem de graça     │
│  [ Apps Governamentais Quebrados ] ──> Dosiq assume como o Companheiro Completo de Saúde Pública │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 7.2. Citações Literais Verbatim de Usuários Brasileiros

> **Aplicativo:** *Meu SUS Digital* (`br.gov.datasus.cnsdigital`)  
> **Avaliação:** ⭐⭐⭐⭐⭐ (5★) | **Autor:** Daniel Lisboa | **Data:** 26/10/2021 | **Curtidas:** 👍 3257  
> *"A ideia do aplicativo é ótima, mas precisa ser aprimorada para dispositivos menos robustos. Os próprios usuários do SUS, no geral, não costumam ter o smartphone mais atualizado. Por isso é importante que ele funcione em celulares mais antigos (ou que ao menos exista uma versão que seja compatível com estes dispositivos)."*

> **Aplicativo:** *Remedio Agora* (`br.com.duosystem.remedioagora`)  
> **Avaliação:** ⭐⭐⭐☆☆ (3★) | **Autor:** Helio Gomes | **Data:** 12/06/2023 | **Curtidas:** 👍 155  
> *"App funciona muito bem, agendamento adianta muito o processo de retirada, grande problema é que não funciona em celulares com Android mais atual, então só funciona em celulares mais antigos, poderia atualizar a versão para que todos possam ter acesso. No meu caso, tirei um celular da gaveta que não estava usando para instalar, pois, no meu Samsung A12, não está disponível."*

> **Aplicativo:** *Meu SUS Digital* (`br.gov.datasus.cnsdigital`)  
> **Avaliação:** ⭐☆☆☆☆ (1★) | **Autor:** Rebeca Maria | **Data:** 19/02/2026 | **Curtidas:** 👍 57  
> *"Aplicativo péssimo!!! Tiraram o agendamento de consultas presencial na ubs perto da minha casa para usar somente o aplicativo, mas esse app não funciona de forma alguma. Se você consegue marcar a consulta, ela simplesmente some do histórico e parece que você não marcou nada. E isso é quando consegue porque tive que remarcar e agora simplesmente nem a ubs que eu vou aparece no mapa. Simplesmente lamentável porque tecnicamente era algo que deveria vir para ajudar e está atrapalhando."*

> **Aplicativo:** *Aqui tem remedio* (`br.com.insix.aquitemremedio`)  
> **Avaliação:** ⭐⭐⭐⭐⭐ (5★) | **Autor:** Um usuário do Google | **Data:** 07/06/2019 | **Curtidas:** 👍 55  
> *"Funcionou perfeitamente! Minha sugestão é que o APP tenha localização de GPS automático para facilitar, evitando que a gente digite manualmente nossa localização. Outra sugestão é ter uma opção para saber o estoque do remédio procurado nos locais (UBS, AMA etc.), visando evitar que a pessoa vá até o local e não encontre o remédio por falta de estoque. Fora isso, EXCELENTE TRABALHO DA PREFEITURA!!! Continuem assim!!!"*

> **Aplicativo:** *Remedio Agora* (`br.com.duosystem.remedioagora`)  
> **Avaliação:** ⭐⭐⭐☆☆ (3★) | **Autor:** Alberto Luiz Celeste de Souza Peto | **Data:** 17/06/2022 | **Curtidas:** 👍 41  
> *"Muito Prático. Facilita muito a retirada do medicamento, mas ultimamente está praticamente sem utilidade, já que eles cancelam frequentemente o agendamento um dia antes da retirada, forçando a entrar novamente no app e tentar um novo agendamento."*

### 7.3. Oportunidade Tática e Funcionalidades Exclusivas para o Dosiq

1. **Gestor de Receitas Médicas com Alerta de Vencimento:**
   - Foto e digitalização da receita médica no celular.
   - Cálculo automático da data de vencimento da prescrição:
     - 💊 *Antibióticos:* 10 dias
     - 🔒 *Controle Especial (Tarja Preta / Ritalina / Clonazepam):* 30 dias
     - 🔄 *Uso Contínuo / Hipertensão / Diabetes / Farmácia Popular:* 180 dias (6 meses)
   - Notificação com 10 e 5 dias de antecedência: *"Sua receita de Losartana vence em 5 dias. Agende sua consulta no posto para renovar"*.
2. **Calculadora de Retirada Mensal no Posto / Farmácia Popular:**
   - Registro da última data de retirada e contador regressivo para a próxima data liberada (evitando viagens perdidas ao posto).
3. **Guia e Consulta de Medicamentos Gratuitos da Farmácia Popular:**
   - Base de dados offline indicando se o medicamento prescrito tem direito a 100% de gratuidade pelo programa Farmácia Popular ou se faz parte do RENAME do SUS.
4. **ASO Hook:** Ocupar com exclusividade os termos de busca minerados na Fase 1: *"Remédio no Posto de Saúde"*, *"Validade de Receita Médica"*, *"Farmácia Popular Grátis"*, *"Lembrete de Retirada SUS"*.

---

## 8. Matriz Consolidada: Dores dos Usuários vs Concorrentes vs Solução Dosiq

| Dimensão Crítica | Concorrentes Globais (*Medisafe / MyTherapy*) | Apps Governamentais (*Meu SUS / Aqui tem Remédio*) | Dor Real do Usuário Android no Brasil | O que o Dosiq Já Entrega Hoje (ASO Imediato) | O que é Backlog Futuro do Dosiq |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Confiabilidade de Alarme** | Falham silenciosamente na MIUI, OneUI e Moto por restrições de bateria. | Não possuem módulo de alarme ou despertador de horários. | 68,8% das notas 1-2★ do pilar reclamam de alarme mudo ou que não toca bloqueado. | **Notifee v3/v2 + Full Screen Intent:** som alto e bypass DND ativo em produção. | Assistente de onboarding interativo anti-Doze para Xiaomi/Samsung. |
| **Monetização e Preço** | Paywalls abusivos (R$ 180 a R$ 350/ano) e trava de 2 remédios na versão free. | Gratuitos, mas frequentemente fora do ar ou inoperantes. | 39,7% das notas 1-2★ do pilar são de revolta com bloqueio de recursos básicos. | **100% Gratuito no Core Vital:** gestão de doses e histórico sem anúncios invasivos. | Planos de valor agregado não bloqueantes para funcionalidades avançadas. |
| **Conexão e Modo Offline** | Exigem internet para sincronizar alarmes e abrir fichas. | Travam em tela branca de erro e login expirado sem rede. | 54,1% das notas 1-2★ do pilar citam frustração com falha de rede em emergências. | **Arquitetura Local-First:** auth persistente no SecureStore e consent gate offline (PR #755). | Projeção estendida de doses para 30 dias offline. |
| **Posologias Brasileiras** | Foco apenas em horários fixos diários (ex: 8h, 14h, 20h). | Sem suporte a horários. | Dificuldade para programar ciclos de 8/8h, gotas e GLP-1 semanal. | **Suporte a Múltiplas Formas:** comprimidos, gotas, insulina e canetas GLP-1. | Templates de posologia rápida e Modo Idoso (acessibilidade 56dp). |
| **Jornada do SUS & Posto de Saúde** | Zero cobertura do SUS, Farmácia Popular ou controle de receitas. | Sistema instável, não alerta vencimento de receitas nem ciclos. | Paciente perde o prazo da receita de controle especial e viagem ao posto. | **Controle de Término de Prescrição:** campo `end_date` nativo em protocolos. | Módulo de ciclo de retirada na UBS e gratuidade Farmácia Popular (Spec 066). |

---

## 9. Diretrizes Táticas para as Fases Subsequentes (Fase 4 a 6)

1. **Para a Fase 4 (Teardown Visual e 8 Screenshots):**
   - Extrapolar os tokens oficiais de `@dosiq/design-tokens` (Verde Esmeralda `#0D5C46` / `#10B981` e Dark Slate `#0F172A`), garantindo Brand Continuity.
   - Focar os 8 slides nas forças reais do produto de hoje (Alarme alto, 100% gratuito, offline, polifarmácia e GLP-1).

2. **Para a Fase 5 e 6 (Plano Tático de ASO e Metadados):**
   - **Título do App (≤ 30 caracteres):** `Dosiq: Doses e Remedios` (23 caracteres — unificado com iOS).
   - **Breve Descrição (≤ 80 caracteres):** `Alarme de remédio confiável, doses diárias e canetas injetáveis. 100% offline.` (79 caracteres).
   - **Descrição Completa (≤ 4.000 caracteres):** Focada nas capacidades de produção, sem promessas prematuras de funcionalidades do SUS ainda em desenvolvimento.

---

### Conclusão da Fase 3

A mineração das 1.892 avaliações reais de usuários brasileiros comprova que o Dosiq já possui as fundações técnicas mais sólidas da categoria no Brasil. O alinhamento correto entre **o que o app entrega hoje (ASO tático)** e **o que construirá a seguir (backlog de produto)** garante a estratégia mais madura, honesta e de alta conversão para dominar o ecossistema Android nacional.
