# Draft: Abordagens para Viabilização de Estatísticas Avançadas em Notificações Push

Este rascunho analisa possíveis abordagens de arquitetura para viabilizar estatísticas de engajamento clinicamente ricas (pontualidade, streaks consecutivos, turnos de esquecimento) nas notificações de adesão do Dosiq, contornando a limitação de timeout de 60 segundos do cron/serverless no Vercel.

---

## O Desafio Tecnológico
Calcular métricas complexas para múltiplos usuários em lote durante a execução do cron pode causar:
1. **CPU/Memory Exceeded:** Operações de ordenação e comparação temporal de múltiplos arrays de instâncias em JS.
2. **I/O Overhead:** Múltiplas queries SQL por usuário (ex: carregar todos os logs de medicamentos recentes e todas as doses agendadas).
3. **Cron Timeout (60s):** Estouro do tempo limite de execução concorrente da Serverless Function.

Abaixo, detalhamos três abordagens possíveis para contornar esses limites.

---

## 1. Abordagem: Rollups Incrementais (Tabelas de Agregação Diária)

### Conceito
Em vez de calcular o histórico em tempo de envio do relatório, mantemos uma tabela de estatísticas consolidadas por usuário para o dia (`user_daily_adherence_stats`). 
Cada vez que uma dose é marcada como `taken`, `missed` ou `skipped`, incrementamos as colunas correspondentes de forma atômica no banco de dados.

### Exemplo de Schema
```sql
CREATE TABLE user_daily_adherence_stats (
  user_id           uuid REFERENCES auth.users(id),
  date              date NOT NULL,  -- YYYY-MM-DD local
  expected_count    int DEFAULT 0,
  taken_count       int DEFAULT 0,
  taken_late_count  int DEFAULT 0,  -- tomadas após a tolerância
  missed_count      int DEFAULT 0,
  skipped_count     int DEFAULT 0,
  current_streak    int DEFAULT 0,
  PRIMARY KEY (user_id, date)
);
```

### Como o Relatório consome
Às 9:00 AM, o cron executa uma query simples e indexada:
```sql
SELECT * FROM user_daily_adherence_stats 
WHERE user_id = $1 AND date = yesterday();
```
O tempo de processamento cai para **$O(1)$ por usuário**, pois todos os dados já estão calculados.

### Prós
*   **Performance excepcional:** Query de apenas uma linha no momento do cron.
*   **Histórico persistido:** Fácil de plotar gráficos de histórico e heatmaps sem processamento pesado.

### Contras
*   **Complexidade de escrita:** O código que realiza o registro de medicamentos (`markTaken`, `markMissed`) precisa incrementar esses contadores de forma atômica ou via triggers de banco de dados (PG Triggers).

---

## 2. Abordagem: Fila de Tarefas / Background Workers (Desacoplamento Assíncrono)

### Conceito
Desacoplar o agendamento do processamento do relatório. Às 9:00 AM, a cron do Vercel apenas dispara uma tarefa leve de orquestração que enfileira "mensagens de cálculo" para cada usuário ativo em um serviço de filas assíncronas (como Inngest, BullMQ ou QStash). 

### Como funciona
1. A cron do Vercel busca usuários ativos e publica mensagens na fila: `{ userId: "abc", reportType: "daily_adherence" }`.
2. Um worker externo ou uma rota serverless dedicada é acionada de forma assíncrona por mensagem.
3. Como cada execução assíncrona calcula e envia a notificação para **apenas um usuário individual**, a função tem seu próprio limite de tempo (ex: 10s individual), eliminando o risco de timeout coletivo.

### Prós
*   **Isolamento total:** Um erro ou lentidão no cálculo de um usuário não afeta os demais.
*   **Alta escalabilidade:** Consegue processar milhares de usuários concorrentemente distribuídos na fila.

### Contras
*   **Dependência de infraestrutura externa:** Requer a configuração de um sistema de filas e workers robusto.

---

## 3. Abordagem: Rollup Mensal Pré-existente (`dose_adherence_monthly`)

### Conceito
Aproveitar o rollup de banco de dados planejado na tabela `dose_adherence_monthly` para armazenar metadados adicionais durante o cron de consolidação mensal (ou semanal). 

### Como funciona
A cada fechamento de período (ex: domingo de madrugada ou dia 1 do mês), um script em lote calcula de forma otimizada os dados agregados para o período e salva na tabela de rollup. O envio do relatório lê diretamente dessa tabela no dia seguinte.

### Prós
*   **Baixo impacto de infraestrutura:** Reusa tabelas e modelos planejados.
*   **Processamento em horário de baixo tráfego:** O cálculo pesado roda de madrugada, enquanto o envio da notificação ocorre às 9h sem custo.

### Contras
*   Não resolve para o relatório diário (que requer dados imediatos do dia anterior), servindo prioritariamente para relatórios semanais e mensais.
