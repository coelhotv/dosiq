# G3 Smoke Checklist — Medicamentos (Web)

> Checklist obrigatório anexado ao PR G3 (`feat/crud-medications` → `main`).
> PO valida em `dev` local antes do merge. Todos itens ✅ obrigatórios.
> Estágio: closed alpha (time interno). Reavaliar formalismo pré-beta externo.

---

## Pré-condições

- [ ] G2 mergeado em mãe (`feat/crud-medications`)
- [ ] PR G3 atômica: somente swap web (sem refactor adicional, sem outro domínio)
- [ ] `git diff main..HEAD --stat` ≤ ~5 arquivos
- [ ] `validate:agent` web 100% green local
- [ ] `npm run build` web OK local
- [ ] Decisão pré-G3 sobre `costAnalysisService` aplicada (opção A ou B documentada na spec Fase 1)

---

## Fluxos Críticos Web (executar em `dev` local após swap)

### Medicamentos CRUD básico

- [ ] Login com usuário de teste
- [ ] Lista de medicamentos carrega (não vazia)
- [ ] Detalhe de medicamento abre com dados corretos
- [ ] Criar medicamento novo — salva e aparece na lista
- [ ] Editar medicamento — atualiza e reflete
- [ ] Excluir medicamento sem dependências — remove

### Joins e relacionamentos

- [ ] Listagem mostra `stock` joined (badge/contador de estoque correto)
- [ ] Listagem mostra `purchases` joined (preço médio correto)
- [ ] `avg_price` (preço médio ponderado) exibido corretamente em pelo menos 1 medicamento com 2+ compras

### Cross-domain (regressão indireta)

- [ ] Tab **Estoque** — entradas listadas, valores corretos
- [ ] Tab **Tratamentos/Protocolos** — protocolos linkados a medicamentos renderizam
- [ ] Tab **Hoje** — doses do dia (que dependem de medicamentos) renderizam
- [ ] Tab **Calendário** — adesão calcula sem erro
- [ ] Tab **Relatórios** — pelo menos 1 relatório com agregação por medicamento renderiza

### Multi-tenancy / RLS

- [ ] Usuário A faz login → vê apenas seus medicamentos
- [ ] Logout + login com usuário B → vê apenas seus medicamentos (zero vazamento)

### Console / Network

- [ ] Console limpo (sem erros novos)
- [ ] Network: chamadas Supabase retornam 200; `user_id` filtra como esperado
- [ ] `validate:agent` ainda 100% green pós-fluxos (re-run)

---

## Rollback simples (closed alpha)

Em caso de regressão detectada pós-merge:

```bash
git revert <commit-merge>
git push
# Vercel redeploya em ~3min
```

Notificar time interno via canal padrão. Investigar root cause antes de re-tentar G3.

---

## Notas

- Checklist intencionalmente leve. Closed alpha + blast radius pequeno justifica.
- Pré-beta externo: expandir com (1) feature flag de swap, (2) playbook de incidente formal, (3) E2E automatizado mínimo.
- Atualizar este doc sempre que um bug pós-G3 escapar o checklist — sinal de gap real.
