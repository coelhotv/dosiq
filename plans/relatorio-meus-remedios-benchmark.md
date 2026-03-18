# Relatório de Benchmark – Meus Remédios vs Apps de Lembrete de Medicamentos

## 1. Contexto e objetivo do produto

O **Meus Remédios** é um app simples de controle e lembrete de medicamentos, pensado para uso rápido no dia a dia, com foco em:
- Cadastro rápido de remédios, horários e dosagens.
- Lembretes confiáveis para não perder doses.
- Visão clara do que tomar hoje e nos próximos dias.

Objetivo do benchmark: entender como líderes globais (MyTherapy, Medisafe, Pillo) estruturam proposta de valor, features core e monetização, e identificar oportunidades de diferenciação para o Meus Remédios, especialmente no contexto Brasil.

---

## 2. Jobs To Be Done principais

### JTBD 1 – "Não quero esquecer nenhum remédio"

- Situação: pessoa com 1+ medicamentos recorrentes (crônicos, pós-operatório, antibiótico, vitaminas) que precisa lembrar de tomar em horários específicos.
- Dor: esquecer doses, tomar duas vezes, não saber se tomou ou não.
- Resultado desejado: ser lembrado de forma confiável, com o mínimo de fricção possível, e ter certeza de que está em dia com o tratamento.

**Como os players atendem esse JTBD**
- MyTherapy: reminders configuráveis, complexos, com notificações para doses, exames, medidas e consultas.[web:17][web:18][web:23][web:26][web:29]
- Medisafe: app focado em pill reminder, com alarmes configuráveis e visual de "caixa de remédio", além de suporte a regimes complexos.[web:22][web:30]
- Pillo: alarmes persistentes, snooze inteligente, múltiplos tipos de agendamento (PRN, dias específicos, múltiplas doses por dia).[web:24][web:25]

O Meus Remédios deve, no mínimo, competir em confiabilidade do lembrete (não perder notificações, funcionar bem em modo economia de bateria, UX de confirmação de dose simples) e simplicidade de configuração (criar um medicamento com poucos toques).

### JTBD 2 – "Quero acompanhar se estou seguindo o tratamento"

- Situação: pessoas com tratamento de médio/longo prazo (antidepressivos, hipertensão, diabetes, etc.) ou pais/cuidadores que precisam comprovar adesão ao médico.
- Dor: não saber se está de fato aderindo, dificuldade em explicar para o médico o que aconteceu no mês.
- Resultado desejado: ter um log/histórico de doses tomadas/atrasadas, com visão de porcentagem de adesão e timeline.

**Como os players atendem esse JTBD**
- MyTherapy: logbook de intakes, métricas de saúde, sintomas e relatórios mensais.[web:17][web:18][web:21][web:23]
- Medisafe: histórico de doses, relatórios e algumas visualizações para adesão (no plano premium).[web:22][web:30]
- Pillo: logbook com status (tomada, perdida, atrasada), streaks de adesão e possibilidade de exportar/compartilhar.[web:24][web:25]

Aqui o Meus Remédios pode oferecer uma visão mais "orientada ao médico brasileiro": export rápido (PDF/WhatsApp) com tratamentos, adesão e observações, em vez de dashboards super complexos.

### JTBD 3 – "Não quero ficar sem medicamento em casa"

- Situação: uso contínuo ou recorrente (hipertensão, diabetes, etc.), ainda mais crítico em contexto de Farmácia Popular / SUS.
- Dor: acabar o remédio sem perceber, enfrentar períodos descobertos ou precisar correr atrás de receita / posto em cima da hora.
- Resultado desejado: ser lembrado quando estoque está acabando e ter tempo suficiente para renovar receita ou buscar no posto/farmácia.

**Como os players atendem esse JTBD**
- MyTherapy: reminders para refill/novo pacote com base nos intakes confirmados.[web:17][web:19][web:23]
- Pillo: controle de estoque, contagem de comprimidos e alertas de refill.[web:24][web:25]
- Medisafe: refill reminders presentes no pacote pago/premium em muitos mercados.[web:22][web:24][web:30]

O Meus Remédios pode diferenciar conectando o refill ao contexto brasileiro: lembrar da renovação de receita, agendamento em posto/UBS, e eventualmente integrar com Farmácia Popular ou farmácias parceiras.

### JTBD 4 – "Quero ajudar alguém a tomar os remédios"

- Situação: filhos cuidando de pais, cuidadores de idosos, pais gerenciando remédios de crianças.
- Dor: não saber se o familiar tomou ou não, dificuldade em coordenar entre múltiplos cuidadores.
- Resultado desejado: ter visibilidade remota ou compartilhada da rotina de medicação.

**Como os players atendem esse JTBD**
- Pillo: opção de adicionar caregiver que recebe alerta se a dose é perdida.[web:25]
- MyTherapy / Medisafe: em geral suporte a múltiplos perfis, relatórios e, em algumas versões, compartilhamento com familiares/médicos.[web:18][web:22][web:30]

No Brasil, isso é um ponto fortíssimo para diferenciação se o Meus Remédios oferecer uma UX ótima para "família" (multi-perfil, compartilhamento via WhatsApp, etc.).

---

## 3. Benchmark de features

### Tabela resumo

| Dimensão                     | MyTherapy                                      | Medisafe                                          | Pillo                                              |
|------------------------------|-----------------------------------------------|---------------------------------------------------|----------------------------------------------------|
| Plataforma                   | Android, iOS                                   | Android, iOS                                      | Android (e possivelmente outras)                   |
| Modelo de custo              | Gratuito / freemium, financiado via B2B/parcerias em vários mercados.[web:18][web:23][web:26][web:29] | Assinatura com múltiplos tiers; em 2026 restringiu fortemente o plano free em alguns mercados.[web:22][web:24][web:30] | Free com anúncios + upgrades opcionais; se posiciona como “free forever” no core.[web:24][web:25] |
| Lembretes de medicação       | Sim, altamente configuráveis e confiáveis.[web:17][web:18][web:20] | Sim, foco central, inclusive para regimes complexos.[web:22][web:30] | Sim, com alarmes persistentes e snooze flexível.[web:24][web:25] |
| Controle de estoque/refill   | Sim, com alertas de novo pacote/receita.[web:17][web:19][web:23] | Sim, em geral ligado ao plano premium.[web:22][web:24][web:30] | Sim, com contagem de comprimidos e refill reminders.[web:24][web:25] |
| Logbook / histórico          | Sim, com registro de intakes, sintomas e métricas.[web:17][web:18][web:21][web:23] | Sim, com mais detalhes no premium.[web:22][web:30] | Sim, com histórico, streaks e export em alguns casos.[web:24][web:25] |
| Métricas de saúde            | Sim (pressão, glicemia, peso, etc.).[web:17][web:18][web:21] | Básico (principalmente no premium).[web:22][web:30] | Vários trackers de saúde (até 9 tipos).[web:24] |
| Relatórios para médico       | Sim, com visão mensal/relatórios de adesão.[web:17][web:18][web:21][web:23] | Sim, melhores no plano pago.[web:22][web:30] | Exportes e relatórios para acompanhamento.[web:24][web:25] |
| Multiusuário/cuidadores      | Suporte a múltiplos perfis e compartilhamento.[web:18][web:21][web:29] | Suporte a familiares/médicos em alguns planos.[web:22][web:30] | Caregiver com notificação se dose é perdida.[web:24][web:25] |
| Checagem de interações       | Não é core (mais focado em adesão).[web:17][web:18][web:21] | Presente em alguns planos premium.[web:22][web:30] | Checker de interações e segurança com base em dados FDA.[web:14][web:24] |

---

## 4. Monetização e pricing – padrões do mercado

### Modelos predominantes

1. **Freemium com paywall de features avançadas**  
   - Caso Medisafe: aumento de paywall em 2026, limitando o free a 2 medicamentos em alguns mercados, com plano premium por volta de US$ 4,99/mês ou ~US$ 39,99/ano para liberar funcionalidades como múltiplos medicamentos, relatórios avançados e alguns recursos de segurança.[web:22][web:24][web:30]  
   - Risco: percepção negativa de "app que era grátis e agora bloqueia o básico", especialmente em segmentos sensíveis (idosos, baixa renda).

2. **Free com monetização B2B / parcerias**  
   - MyTherapy: comunicado como app gratuito ao usuário final, com foco em ser "health companion" e provavelmente monetização via pharma, clínicas, seguradoras e programas de adesão.[web:18][web:23][web:26][web:29]  
   - Benefício: experiência premium para o usuário final, sem paywall agressivo; boa percepção em saúde.

3. **Free + anúncios + upgrades pequenos (one-off ou baixo ticket)**  
   - Pillo: app gratuito, ad-supported com upgrades opcionais; foco em manter core "medication reminder" totalmente funcional sem assinatura obrigatória.[web:24][web:25]  
   - Outros apps menores: vendem upgrades pontuais (remover anúncios, tema escuro, export avançado) por tickets de ~US$ 1,99–25,99 dependendo do bundle (inclusive lifetime).[web:22][web:25][web:28][web:30]

### Possíveis estratégias para o Meus Remédios

- **Posicionamento ético em saúde**: manter o core (lembretes ilimitados, multi-medicamento, histórico básico) totalmente gratuito, sem bloqueio de funcionalidades que impactam diretamente a saúde.
- **Monetização via extras de conveniência**, por exemplo:
  - Export avançado (PDFs customizados, relatórios extensos para especialistas).
  - Recursos premium de família (multi-perfil ilimitado, histórico longo, backups automáticos, sincronização multi-dispositivo).
  - Personalização visual e temas.
- **Caminho B2B / parcerias Brasil**:
  - Integrações com farmácias (descontos, programa de fidelidade, lembrando sempre de não "empurrar" medicação nem fazer recomendação clínica).
  - Parcerias com clínicas, hospitais, operadoras ou healthtechs para programas de adesão.

---

## 5. Oportunidades de diferenciação (foco Brasil)

### 5.1. UX e linguagem para o usuário brasileiro

- Linguagem em português natural e exemplos alinhados à realidade local (Farmácia Popular, SUS, receitas controladas).
- Onboarding com poucos passos, focado em criar o primeiro medicamento em menos de 30 segundos.
- Fluxos pensados para idosos e cuidadores: fonte maior, contraste adequado, poucas ações por tela.

### 5.2. Integração com contexto SUS / Farmácia Popular

- Campo opcional para marcar medicamentos obtidos via SUS / Farmácia Popular, com lembretes para:
  - Renovar receita e marcar consulta em UBS.
  - Data limite aproximada para nova retirada em farmácia conveniada.[web:9]
- Módulo de "roteiro" para consulta: gerar lista com medicamentos usados, doses, horários e dúvidas para levar ao médico (via PDF ou compartilhamento pelo WhatsApp).

### 5.3. Família e cuidadores como primeira classe de usuários

- Multi-perfil simples: "Meus remédios", "Remédios da minha mãe", "Remédios do meu pai", "Remédios do meu filho".
- Compartilhamento por link/WhatsApp para que outro cuidador veja a agenda e marque doses como tomadas.
- Notificações inteligentes para cuidadores: por exemplo, se a dose não for confirmada em 15–30 minutos, enviar alerta para um cuidador configurado.

### 5.4. Dados e privacidade

- Comunicação forte de privacidade e transparência: dados criptografados, sem venda de dados de saúde, opção de usar app somente local/offline se possível.
- Diferencial frente a players que monetizam com dados e parceiros, o que é sensível em saúde.

### 5.5. Simplicidade versus "super apps" de saúde

- MyTherapy e similares atacam muitos casos: múltiplas métricas, sintomas, atividades, etc.[web:17][web:18][web:21]  
- O Meus Remédios pode ser "o app que só faz uma coisa e faz muito bem": lembrar remédios da família, com foco em confiabilidade, UX simples e contexto Brasil.

---

## 6. Recomendações práticas de próximo passo de produto

1. **Consolidar o core de lembretes e histórico**  
   - Garantir que o fluxo de cadastro de medicamento seja extremamente enxuto.
   - Testar se o app funciona bem em condições reais (economia de bateria, Doze mode, etc.).

2. **Adicionar camada de família/cuidadores**  
   - Suporte a múltiplos perfis no mesmo dispositivo.
   - Visual da agenda por pessoa.
   - Compartilhamento simples com outros cuidadores.

3. **Experimentar diferenciais Brasil-first**  
   - Campos opcionais para SUS/Farmácia Popular.
   - Lembretes de receita/retirada com cópia fácil do nome do medicamento.

4. **Planejar monetização sem agredir o core**  
   - Definir quais features serão sempre gratuitas (lembretes ilimitados, múltiplos medicamentos, histórico básico).
   - Listar 2–3 features realmente "nice to have" para um futuro plano Pro (ex.: export avançado, backup em nuvem, temas), possivelmente com precificação baixa/média em R$ e opção lifetime.

5. **Métricas chave para acompanhar**  
   - % de usuários que cadastram mais de 1 medicamento.
   - Adesão diária (quantidade de doses confirmadas vs planejadas).
   - Retenção 7/30/90 dias.
   - Uso de features de família/cuidadores.

---

## 7. Resumo estratégico

- O espaço de apps de lembrete de medicação é maduro globalmente, mas ainda pouco adaptado ao contexto brasileiro.
- Players como MyTherapy, Medisafe e Pillo focam em amplitude de features, monetização via assinatura e/ou B2B, e em alguns casos passaram a restringir os planos gratuitos.[web:18][web:22][web:24][web:25][web:26][web:29][web:30]
- Há espaço para um produto como Meus Remédios se posicionar como:
  - App extremamente simples e confiável para lembretes de medicação.
  - Otimizado para famílias e cuidadores brasileiros.
  - Com monetização que respeita o caráter crítico de saúde (core gratuito, upsell em conveniência e serviços, e explorações B2B no médio prazo).
