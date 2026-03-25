# Wave 6.5 — Dashboard Desktop Layout Fixes

**Status:** ⏳ PENDENTE EXECUÇÃO
**Data:** 2026-03-25
**Branch:** `fix/redesign/wave-6-desktop-layout`
**Dependências:** W6 ✅ completa (PR #425 mergeado em main)
**Estimativa:** 5 sprints sequenciais (6.5.1 → 6.5.2 → 6.5.3 → 6.5.4 → 6.5.5)
**Risco:** BAIXO — Dashboard.jsx original intocado; os sprints 6.5.1–6.5.3 são correções pontuais de layout; os sprints 6.5.4–6.5.5 adicionam camada de apresentação e animações sobre a mesma base de dados.

---

## Por que esta wave existe

A Wave 6 entregou todos os componentes novos corretamente (`RingGaugeRedesign`, `PriorityDoseCard`, `CronogramaPeriodo`, `StockAlertInline`), mas a **view de orquestração** (`DashboardRedesign.jsx`) foi implementada com um layout de coluna única que ignora o breakpoint desktop. O critério de conclusão da master spec (`EXEC_SPEC_REDESIGN_EXPERIENCIA_PACIENTE.md`, linha 1873) exige explicitamente:

> `Dashboard desktop: 2-col grid (ring+priority left, cronograma right)`

Em produção com `?redesign=1` ativo, o dashboard desktop exibe todos os componentes empilhados verticalmente — identicamente ao mobile.

**A causa raiz foi uma falha na spec de entrega da W6**, que forneceu código de exemplo somente para o layout linear, sem especificar a estrutura de grid responsiva. Esta wave corrige isso de forma cirúrgica.

---

## O que esta wave NÃO faz

- ❌ NÃO toca em `Dashboard.jsx` (view original intacta)
- ❌ NÃO modifica `RingGaugeRedesign.jsx`
- ❌ NÃO modifica `PriorityDoseCard.jsx`
- ❌ NÃO modifica `StockAlertInline.jsx`
- ❌ NÃO modifica `App.jsx`
- ❌ NÃO cria novos componentes
- ❌ NÃO altera schemas, hooks ou services

---

## Infraestrutura CSS disponível (não criar de novo)

A classe `.grid-dashboard` já está definida em `src/shared/styles/layout.redesign.css` e é exatamente o que precisamos:

```css
/* Mobile: 1 coluna */
.grid-dashboard {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
}

/* Desktop ≥1024px: 2 colunas (esquerda menor + direita maior) */
@media (min-width: 1024px) {
  .grid-dashboard {
    grid-template-columns: 1fr 2fr;
    gap: 2rem;
  }
}
```

O comentário no arquivo diz literalmente:
> "Coluna esquerda: ring gauge de adesão + card prioridade máxima — Coluna direita: cronograma do dia + alertas"

**A classe foi projetada para este dashboard. Use-a.**

---

## Layout alvo

### Mobile (<1024px) — coluna única, ordem top-down:
```
┌──────────────────────────────────────┐
│  [Ring Gauge + Streak]               │
│  Olá, Nome 👋                        │
│  Faltam N doses hoje                 │
├──────────────────────────────────────┤
│  [PriorityDoseCard — se urgentes]    │
├──────────────────────────────────────┤
│  Cronograma de Hoje                  │
│  ☀ MANHÃ                            │
│  • Losartana    [TOMAR]              │
│  • Omeprazol    [TOMAR]              │
│  🌙 NOITE                            │
│  • Sinvastatina [TOMAR]              │
├──────────────────────────────────────┤
│  [StockAlertInline — se crítico]     │
└──────────────────────────────────────┘
```

### Desktop (≥1024px) — 2 colunas (1fr + 2fr):
```
┌───────────────────────┬──────────────────────────────────────────┐
│  [Ring Gauge Large]   │  Cronograma de Hoje                      │
│  Olá, Nome 👋         │                                          │
│  Faltam N doses       │  ☀ MANHÃ                                 │
│                       │  ┌──────────────┐ ┌──────────────┐       │
│  [PriorityDoseCard]   │  │ Losartana    │ │ Omeprazol    │       │
│  ● PRIORIDADE MÁXIMA  │  │ [TOMAR]      │ │ [TOMAR]      │       │
│  08:00 · Em 15 min    │  └──────────────┘ └──────────────┘       │
│  • Losartana 50mg     │                                          │
│  [Confirmar Agora]    │  🌙 NOITE                                 │
│                       │  ┌──────────────┐                        │
│                       │  │ Sinvastatina │                        │
│                       │  └──────────────┘                        │
│                       │                                          │
│                       │  [StockAlertInline — se crítico]         │
└───────────────────────┴──────────────────────────────────────────┘
```

**Nota importante sobre o stock alert:** Na master spec mobile, o alerta de estoque aparece antes do PriorityDoseCard. Nesta implementação, ele fica no final da coluna direita (depois do cronograma), tanto em mobile quanto em desktop. Esta é a decisão de design deliberada desta wave — evita duplicar o componente com classes `mobile-only`/`desktop-only` e entrega o objetivo principal (desktop 2-col) sem complexidade desnecessária. O alerta está sempre visível; a posição é detalhe de menor impacto.

---

## Sprint 6.5.1 — Adicionar `.cronograma-doses` ao CSS

**Arquivo modificado:** `src/shared/styles/layout.redesign.css`

**Por que:** O `CronogramaPeriodo` usa inline style `flexDirection: 'column'` para listar doses. No desktop, a master spec quer grid 2-col dentro de cada período. Precisamos de uma classe CSS com media query para isso — inline styles não suportam media queries.

**O que adicionar:** Ao final do arquivo, após a seção `.safe-area-top`, adicione o seguinte bloco:

```css
/* ============================================
   CRONOGRAMA DOSES — lista de doses por período
   Mobile: coluna única
   Desktop: grid 2 colunas (melhor uso do espaço da col. direita)
   Usado por: CronogramaPeriodo.jsx
   ============================================ */
.cronograma-doses {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

@media (min-width: 1024px) {
  .cronograma-doses {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
  }
}
```

**Critério de conclusão Sprint 6.5.1:**
- [ ] Bloco `.cronograma-doses` adicionado ao final de `layout.redesign.css`
- [ ] Regra mobile: `display: flex; flex-direction: column; gap: 0.5rem`
- [ ] Regra desktop `@media (min-width: 1024px)`: `display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem`
- [ ] Nenhuma outra linha de `layout.redesign.css` foi alterada

---

## Sprint 6.5.2 — Corrigir `CronogramaPeriodo.jsx`

**Arquivo modificado:** `src/features/dashboard/components/CronogramaPeriodo.jsx`

**Dois problemas a corrigir:**

### Problema A — Touch target insuficiente

O botão "TOMAR" na linha 62 tem `minHeight: '36px'`. A master spec exige `≥ 56px` em todos os botões do redesign. Isso é crítico para usabilidade mobile.

### Problema B — Layout de doses sem CSS class

A `div` que envolve os `CronogramaDoseItem` (linha 137) usa `style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}`. Para aplicar o grid desktop, precisa usar a classe `.cronograma-doses` definida no Sprint 6.5.1.

### Implementação completa do arquivo

Substitua o conteúdo INTEGRAL de `CronogramaPeriodo.jsx` pelo seguinte (apenas as duas alterações marcadas com `// ← ALTERADO`):

```jsx
import { Sun, Moon, CheckCircle2, Circle } from 'lucide-react'

const PERIODS = [
  { id: 'morning',   label: 'Manhã',  Icon: Sun,  timeRange: [0,  12] },
  { id: 'afternoon', label: 'Tarde',  Icon: Sun,  timeRange: [12, 18] },
  { id: 'night',     label: 'Noite',  Icon: Moon, timeRange: [18, 24] },
]

function getHour(scheduledTime) {
  return parseInt(scheduledTime.split(':')[0], 10)
}

function CronogramaDoseItem({ dose, onRegister }) {
  const done = dose.isRegistered

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.75rem 1rem',
        borderRadius: 'var(--radius-lg, 1rem)',
        background: done ? 'transparent' : 'var(--color-surface-container-lowest, #ffffff)',
        boxShadow: done ? 'none' : 'var(--shadow-editorial, 0 4px 24px -4px rgba(25, 28, 29, 0.04))',
        opacity: done ? 0.55 : 1,
        transition: 'all 200ms ease-out',
      }}
    >
      {done
        ? <CheckCircle2 size={20} color="var(--color-primary, #006a5e)" aria-hidden="true" />
        : <Circle size={20} color="var(--color-outline, #6d7a76)" aria-hidden="true" />
      }

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-body, Lexend, sans-serif)',
          fontWeight: 'var(--font-weight-semibold, 600)',
          fontSize: 'var(--text-body-lg, 1rem)',
          color: 'var(--color-on-surface, #191c1d)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {dose.medicineName}
        </div>
        <div style={{
          fontFamily: 'var(--font-body, Lexend, sans-serif)',
          fontSize: 'var(--text-label-md, 0.75rem)',
          color: 'var(--color-on-surface-variant, #3e4946)',
        }}>
          {dose.dosagePerIntake} comprimido{dose.dosagePerIntake !== 1 ? 's' : ''} · {dose.scheduledTime}
        </div>
      </div>

      {!done && (
        <button
          onClick={() => onRegister?.(dose)}
          aria-label={`Registrar dose de ${dose.medicineName}`}
          style={{
            padding: '0.625rem 1.125rem',
            minHeight: '3.5rem',           // ← ALTERADO: era '36px', agora 56px (master spec §1877)
            background: 'var(--color-primary, #006a5e)',
            color: 'var(--color-on-primary, #ffffff)',
            border: 'none',
            borderRadius: 'var(--radius-full, 9999px)',
            fontFamily: 'var(--font-body, Lexend, sans-serif)',
            fontSize: 'var(--text-label-md, 0.75rem)',
            fontWeight: 'var(--font-weight-bold, 700)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all 150ms ease-out',
          }}
        >
          TOMAR
        </button>
      )}
    </div>
  )
}

/**
 * CronogramaPeriodo — Cronograma de doses agrupado por Manhã/Tarde/Noite.
 *
 * @param {Array} allDoses — Todas as doses do dia (flat: late+now+upcoming+later+done)
 * @param {Function} onRegister — callback: onRegister(dose)
 */
export default function CronogramaPeriodo({ allDoses = [], onRegister }) {
  const grouped = PERIODS.map(({ id, label, Icon, timeRange }) => {
    const [start, end] = timeRange
    const doses = allDoses
      .filter((d) => {
        const h = getHour(d.scheduledTime)
        return h >= start && h < end
      })
      .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))
    return { id, label, Icon, doses }
  }).filter(({ doses }) => doses.length > 0)

  if (grouped.length === 0) return null

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
      aria-label="Cronograma de doses de hoje"
    >
      {grouped.map(({ id, label, Icon, doses }) => {
        const PeriodIcon = Icon
        return (
        <section key={id} aria-label={`${label}: ${doses.length} dose${doses.length !== 1 ? 's' : ''}`}>
          {/* Header do período */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            marginBottom: '0.75rem', paddingLeft: '0.25rem',
          }}>
            <PeriodIcon size={16} color="var(--color-outline, #6d7a76)" aria-hidden="true" />
            <h3 style={{
              margin: 0,
              fontFamily: 'var(--font-body, Lexend, sans-serif)',
              fontSize: 'var(--text-label-md, 0.75rem)',
              fontWeight: 'var(--font-weight-bold, 700)',
              color: 'var(--color-outline, #6d7a76)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}>
              {label}
            </h3>
            <span style={{
              marginLeft: 'auto',
              fontSize: 'var(--text-label-sm, 0.625rem)',
              color: 'var(--color-outline, #6d7a76)',
            }}>
              {doses.filter(d => d.isRegistered).length}/{doses.length}
            </span>
          </div>

          <div className="cronograma-doses">  {/* ← ALTERADO: era inline style, agora usa classe CSS com responsividade */}
            {doses.map((dose) => (
              <CronogramaDoseItem
                key={`${dose.protocolId}-${dose.scheduledTime}`}
                dose={dose}
                onRegister={onRegister}
              />
            ))}
          </div>
        </section>
        )
      })}
    </div>
  )
}
```

**Critério de conclusão Sprint 6.5.2:**
- [ ] Botão "TOMAR": `minHeight` alterado de `'36px'` para `'3.5rem'` (= 56px)
- [ ] Botão "TOMAR": `padding` ajustado para `'0.625rem 1.125rem'` (proporcional ao novo height)
- [ ] Div de doses: `style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}` substituído por `className="cronograma-doses"`
- [ ] Todo o resto do arquivo permanece byte-a-byte idêntico ao estado pré-wave
- [ ] Nenhum import novo foi adicionado

---

## Sprint 6.5.3 — Reestruturar `DashboardRedesign.jsx`

**Arquivo modificado:** `src/views/redesign/DashboardRedesign.jsx`

Este é o sprint principal. O `return` do componente será reestruturado para usar `.grid-dashboard` com duas colunas explícitas. A lógica de dados, hooks e handlers **não muda absolutamente nada** — apenas a camada de renderização JSX.

### Regras de ouro para este sprint

1. **NÃO mova nenhum hook, state ou memo** — só o JSX do `return`
2. **NÃO use `useMediaQuery` ou JS para detectar viewport** — o CSS `.grid-dashboard` já resolve
3. **NÃO duplique componentes** com `mobile-only`/`desktop-only` — `StockAlertInline` aparece uma única vez, na coluna direita
4. **NÃO adicione imports** — todos os imports já existem no arquivo atual
5. **NÃO altere nenhuma prop passada aos componentes** — as props de `RingGaugeRedesign`, `PriorityDoseCard`, `CronogramaPeriodo`, `StockAlertInline` e `LogForm` permanecem idênticas

### Mapeamento coluna esquerda vs. direita

| Conteúdo | Coluna | Justificativa |
|----------|--------|---------------|
| `<header>` (ring + greeting) | **Esquerda** | Gauge é âncora visual do usuário |
| `<PriorityDoseCard>` | **Esquerda** | Ação imediata — ao lado da confirmação visual |
| `<section>` Cronograma | **Direita** | Conteúdo longo — beneficia da coluna maior (2fr) |
| `<StockAlertInline>` | **Direita** (ao fundo) | Contextual ao cronograma; rodapé da col. direita |
| Empty state | **Direita** | Preenche o espaço quando não há doses |
| `<Modal>` | **Fora do grid** | Modal é overlay — não pertence a nenhuma coluna |

### Implementação completa do `return`

Substitua **apenas o bloco `return (...)`** (linhas 107–243 do arquivo atual). Todo o código antes do `return` — imports, declaração da função, hooks, memos, effects e handlers — permanece **idêntico**.

```jsx
  return (
    <div
      className="page-container"
      style={{ paddingTop: '1.5rem', paddingBottom: '2rem' }}
      aria-label="Dashboard — Meus Remédios"
    >
      {/* ─── Grid responsivo: 1-col em mobile, 2-col em desktop ≥1024px ─── */}
      <div className="grid-dashboard">

        {/* ════════════════════════════════════════
            COLUNA ESQUERDA (1fr)
            Ring gauge + saudação + dose prioritária
            ════════════════════════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* ─── 1. Header: Ring de Adesão + Saudação ─── */}
          <header
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem',
              textAlign: 'center',
            }}
          >
            <RingGaugeRedesign
              score={adherenceScore}
              streak={streak}
              size={complexityMode === 'complex' ? 'medium' : 'large'}
            />

            <div>
              <h1 style={{
                margin: 0,
                fontFamily: 'var(--font-display, Public Sans, sans-serif)',
                fontSize: 'var(--text-headline-md, 1.75rem)',
                fontWeight: '700',
                color: 'var(--color-on-surface, #191c1d)',
                lineHeight: 1.2,
              }}>
                {userName ? `Olá, ${userName} 👋` : 'Olá! 👋'}
              </h1>

              <p style={{
                margin: '0.25rem 0 0',
                fontFamily: 'var(--font-body, Lexend, sans-serif)',
                fontSize: 'var(--text-body-lg, 1rem)',
                color: 'var(--color-on-surface-variant, #3e4946)',
              }}>
                {today}
              </p>

              {totals.remaining > 0 && (
                <p style={{
                  margin: '0.25rem 0 0',
                  fontFamily: 'var(--font-body, Lexend, sans-serif)',
                  fontSize: 'var(--text-body-lg, 1rem)',
                  color: 'var(--color-outline, #6d7a76)',
                }}>
                  {totals.remaining} dose{totals.remaining !== 1 ? 's' : ''} restante{totals.remaining !== 1 ? 's' : ''} hoje
                </p>
              )}

              {totals.remaining === 0 && totals.total > 0 && (
                <p style={{
                  margin: '0.25rem 0 0',
                  color: 'var(--color-primary, #006a5e)',
                  fontWeight: '600',
                  fontSize: 'var(--text-body-lg, 1rem)',
                }}>
                  ✅ Todas as doses registradas!
                </p>
              )}
            </div>
          </header>

          {/* ─── 2. Dose Prioritária (se houver doses urgentes) ─── */}
          {urgentDoses.length > 0 && (
            <section aria-label="Dose prioritária">
              <PriorityDoseCard
                doses={urgentDoses.slice(0, 3)}
                onRegister={handleRegisterDose}
                onRegisterAll={(doses) => handleRegisterDose(doses[0])}
              />
            </section>
          )}

        </div>
        {/* ════ fim coluna esquerda ════ */}


        {/* ════════════════════════════════════════
            COLUNA DIREITA (2fr)
            Cronograma do dia + alerta de estoque
            ════════════════════════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* ─── 3. Cronograma do Dia ─── */}
          {allDoses.length > 0 && (
            <section aria-label="Cronograma de hoje">
              <h2 style={{
                margin: '0 0 1rem',
                fontFamily: 'var(--font-display, Public Sans, sans-serif)',
                fontSize: 'var(--text-title-lg, 1.125rem)',
                fontWeight: '600',
                color: 'var(--color-on-surface, #191c1d)',
              }}>
                Cronograma de Hoje
              </h2>
              <CronogramaPeriodo allDoses={allDoses} onRegister={handleRegisterDose} />
            </section>
          )}

          {/* ─── 4. Alerta de Estoque Crítico ─── */}
          {criticalStockItems.length > 0 && (
            <section aria-label="Alertas de estoque">
              <StockAlertInline
                criticalItems={criticalStockItems}
                onNavigateToStock={() => onNavigate?.('stock')}
              />
            </section>
          )}

          {/* ─── 5. Empty state (somente quando sem doses e sem loading) ─── */}
          {allDoses.length === 0 && !contextLoading && (
            <div
              style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-outline, #6d7a76)' }}
              role="status"
            >
              <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💊</p>
              <p style={{ fontFamily: 'var(--font-body, Lexend, sans-serif)', fontSize: 'var(--text-body-lg, 1rem)' }}>
                Nenhuma dose agendada para hoje.
              </p>
              <button
                onClick={() => onNavigate?.('medicines')}
                style={{
                  marginTop: '1rem',
                  padding: '0.75rem 1.5rem',
                  minHeight: '3.5rem',
                  background: 'var(--gradient-primary, linear-gradient(135deg, #006a5e, #008577))',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 'var(--radius-button, 1.25rem)',
                  fontFamily: 'var(--font-body, Lexend, sans-serif)',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Adicionar Medicamento
              </button>
            </div>
          )}

        </div>
        {/* ════ fim coluna direita ════ */}

      </div>
      {/* ════ fim grid-dashboard ════ */}

      {/* ─── Modal de Registro de Dose ─── */}
      <Modal isOpen={isModalOpen} onClose={handleModalClose} title="Registrar Dose">
        <LogForm
          prefillData={prefillData}
          onSuccess={handleLogSuccess}
          onCancel={handleModalClose}
        />
      </Modal>
    </div>
  )
```

**Critério de conclusão Sprint 6.5.3:**
- [ ] Wrapper externo: `div.page-container` com `paddingTop: '1.5rem'` e `paddingBottom: '2rem'`
- [ ] Grid intermediário: `div.grid-dashboard` (sem inline style de gap — o CSS já define 1.5rem/2rem)
- [ ] Coluna esquerda (`display: flex; flexDirection: column; gap: 1.25rem`): `<header>` + `<PriorityDoseCard>`
- [ ] Coluna direita (`display: flex; flexDirection: column; gap: 1.25rem`): `<CronogramaPeriodo>` + `<StockAlertInline>` + empty state
- [ ] `<Modal>` fora do `div.grid-dashboard`, filho direto do `div.page-container`
- [ ] Nenhum hook, state, memo, effect ou handler foi alterado (linhas 1–106 idênticas)
- [ ] Nenhum import novo adicionado
- [ ] Props de todos os componentes filhos idênticas ao estado pré-wave
- [ ] Empty state: botão "Adicionar Medicamento" com `minHeight: '3.5rem'` (56px, corrigido também)
- [ ] Sem classes `mobile-only` ou `desktop-only` — StockAlertInline renderiza uma única vez

---

## Checklist de QA — validar em produção com `?redesign=1`

### Testes mobile (320px, 375px, 430px)

- [ ] Ring gauge centralizado, saudação abaixo
- [ ] PriorityDoseCard visível quando há doses urgentes, oculto quando não há
- [ ] Cronograma exibido abaixo do PriorityDoseCard, agrupado por Manhã/Tarde/Noite
- [ ] StockAlertInline exibido no final quando há estoque crítico, oculto quando não há
- [ ] Botão "TOMAR" tem altura visual de ~56px (tocável com polegar)
- [ ] Empty state visível quando sem protocolos cadastrados
- [ ] Tudo empilhado verticalmente (1 coluna)

### Testes desktop (1280px, 1440px, 1920px)

- [ ] **2 colunas visivelmente distintas** — verificar no browser com DevTools em 1280px+
- [ ] Coluna esquerda (~33% da largura): ring + greeting + priority card
- [ ] Coluna direita (~67% da largura): cronograma com doses em grid 2-col por período
- [ ] StockAlertInline aparece NO FINAL da coluna direita, abaixo do cronograma
- [ ] Sem gap excessivo ou conteúdo transbordando
- [ ] PriorityDoseCard oculto quando não há doses urgentes — coluna esquerda mostra só o header

### Testes de borda

- [ ] **Sem doses cadastradas:** empty state na coluna direita; coluna esquerda só com ring+greeting — layout não quebra
- [ ] **Sem estoque crítico:** nenhum StockAlertInline visível — sem espaço em branco residual
- [ ] **Sem doses urgentes:** PriorityDoseCard ausente — coluna esquerda fica com só o header — OK
- [ ] **Tema escuro:** verificar contraste nos dois layouts e na variante `simple` do PriorityDoseCard
- [ ] **Tablet 768px–1023px:** 1 coluna — cronograma em 2-col por período (`.cronograma-doses`); animações presentes

### Testes de persona (Sprint 6.5.4)

- [ ] **Modo simples (Dona Maria):** PriorityDoseCard branco com botão verde; stock alert no final da coluna direita
- [ ] **Modo complexo (Carlos):** PriorityDoseCard azul com lista; stock alert ACIMA do grid (quando crítico)
- [ ] **Transição de modo:** alternar entre simple/complex em Settings atualiza o dashboard sem reload (context reativo)
- [ ] **Mensagem motivacional:** "Perfeito! Todas as doses..." aparece quando `remaining === 0`; "Excelente progresso!" quando `score >= 80`; "Quase lá!" quando `score >= 50`; "Vamos retomar" nos demais casos

### Testes de período (Sprint 6.5.5)

- [ ] Dose às 03:30 → aparece em "Madrugada"
- [ ] Dose às 06:00 → aparece em "Manhã"
- [ ] Dose às 12:00 → aparece em "Tarde"
- [ ] Dose às 18:00 → aparece em "Noite"
- [ ] Sem doses na madrugada → seção "Madrugada" não aparece (filtro correto)
- [ ] Animação de entrada visível ao carregar o dashboard (Cascade Reveal nas seções)
- [ ] `prefers-reduced-motion: reduce` → animações desabilitadas, conteúdo aparece sem transição

### Verificação de regressão

- [ ] `Dashboard.jsx` original (sem `?redesign=1`) funciona normalmente — ZERO mudanças visuais
- [ ] Build sem erros: `npm run build`
- [ ] Lint limpo: `npm run lint`
- [ ] `npm run validate:agent` passa (10-min kill switch)

---

## Anti-patterns críticos — o que NÃO fazer

### ❌ NÃO use `useMediaQuery` ou `window.matchMedia` para o layout de colunas
A classe `.grid-dashboard` já resolve o breakpoint via CSS. JS para controlar layout é over-engineering aqui.

### ❌ NÃO duplique `StockAlertInline` com `mobile-only`/`desktop-only`
O `mobile-only`/`desktop-only` ativa em 768px, mas o grid de 2 colunas ativa em 1024px — há um intervalo de 256px onde a lógica de show/hide diverge do layout. Use um único elemento no DOM, na posição correta (coluna direita, ao fundo).

### ❌ NÃO adicione `style={{ gap: '...' }}` no `div.grid-dashboard`
O CSS já define `gap: 1.5rem` (mobile) e `gap: 2rem` (desktop). Inline style sobrescreve ambos e desfaz a responsividade do gap.

### ❌ NÃO mova nenhum hook para dentro do JSX
A ordem `States → Memos → Effects → Handlers → return` é mandatória (R-010). Este sprint altera APENAS o `return`.

### ❌ NÃO remova o `aria-label` do `div.page-container`
O `aria-label="Dashboard — Meus Remédios"` no wrapper externo é necessário para acessibilidade. Manter.

### ❌ NÃO use `className="page-container grid-dashboard"` em um único `div`
`page-container` deve ser o wrapper externo com `paddingTop/paddingBottom`. `grid-dashboard` deve ser o `div` filho imediato, sem padding extra — ele gerencia apenas a grid de colunas. Separação de responsabilidades.

---

---

## Sprint 6.5.4 — Motivação Contextual + Adaptação por Persona

**Arquivos modificados:** `DashboardRedesign.jsx` + `PriorityDoseCard.jsx`

> Os mocks de referência (`simple-hoje` e `complex-hoje`) inspiram esta sprint, mas são **referência de intenção**, não prescrição pixel-perfect. O objetivo UX é claro: usuários simples (Dona Maria) devem ver uma interface limpa com UMA ação dominante; usuários complexos (Carlos) devem ver densidade controlada com contexto clínico. O código abaixo realiza isso com os tokens e componentes existentes.

### Problema

O `DashboardRedesign.jsx` atual é cego à persona do usuário:
- **Dona Maria** vê o card azul "PRIORIDADE MÁXIMA" — visual denso demais para uma persona de baixa familiaridade tecnológica
- **Carlos** vê exatamente a mesma interface que Dona Maria — sem nenhuma informação extra ou densidade adequada
- Não há texto motivacional contextual — só data e "X doses restantes" em tom neutro
- Não há label "ADESÃO DIÁRIA" acima do ring — o ring aparece sem contexto semântico
- Estoque crítico tem a mesma posição para ambas as personas — Carlos prefere ver o alerta antes de qualquer outra coisa (urgência clínica)

### Mudança A — Helper `getMotivationalMessage()` em `DashboardRedesign.jsx`

Adicionar esta função **antes** da declaração `export default function DashboardRedesign(...)` (acima do componente, fora do JSX):

```jsx
/**
 * Retorna mensagem contextual de motivação baseada em adesão e doses restantes.
 * Nenhuma lógica de dados nova — só apresentação dos valores já calculados.
 * @returns {{ text: string, color: string, weight: string } | null}
 */
function getMotivationalMessage(score, remaining, total) {
  if (total === 0) return null
  if (remaining === 0) return {
    text: 'Perfeito! Todas as doses de hoje foram registradas! 🎉',
    color: 'var(--color-primary, #006a5e)',
    weight: '600',
  }
  if (score >= 80) return {
    text: `Excelente progresso! Você tomou ${total - remaining} de ${total} doses hoje.`,
    color: 'var(--color-primary, #006a5e)',
    weight: '600',
  }
  if (score >= 50) return {
    text: `Quase lá! Faltam ${remaining} dose${remaining !== 1 ? 's' : ''} hoje.`,
    color: 'var(--color-on-surface-variant, #3e4946)',
    weight: '400',
  }
  return {
    text: `Vamos retomar — ${remaining} dose${remaining !== 1 ? 's' : ''} ainda pendente${remaining !== 1 ? 's' : ''}.`,
    color: 'var(--color-on-surface-variant, #3e4946)',
    weight: '400',
  }
}
```

### Mudança B — `header` atualizado em `DashboardRedesign.jsx`

Substitua o bloco `<header>` completo dentro da coluna esquerda (Sprint 6.5.3) pelo seguinte.
As únicas diferenças do código anterior são: (1) label "ADESÃO DIÁRIA" adicionada acima do ring; (2) bloco motivacional substitui as `<p>` condicionais anteriores:

```jsx
<header
  style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
    textAlign: 'center',
  }}
>
  {/* Micro-label de contexto semântico */}
  <p style={{
    margin: 0,
    fontFamily: 'var(--font-body, Lexend, sans-serif)',
    fontSize: 'var(--text-label-sm, 0.625rem)',
    fontWeight: 'var(--font-weight-bold, 700)',
    color: 'var(--color-outline, #6d7a76)',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
  }}>
    Adesão Diária
  </p>

  <RingGaugeRedesign
    score={adherenceScore}
    streak={streak}
    size={complexityMode === 'complex' ? 'medium' : 'large'}
  />

  <div>
    <h1 style={{
      margin: 0,
      fontFamily: 'var(--font-display, Public Sans, sans-serif)',
      fontSize: 'var(--text-headline-md, 1.75rem)',
      fontWeight: '700',
      color: 'var(--color-on-surface, #191c1d)',
      lineHeight: 1.2,
    }}>
      {userName ? `Olá, ${userName} 👋` : 'Olá! 👋'}
    </h1>

    <p style={{
      margin: '0.25rem 0 0',
      fontFamily: 'var(--font-body, Lexend, sans-serif)',
      fontSize: 'var(--text-body-lg, 1rem)',
      color: 'var(--color-on-surface-variant, #3e4946)',
    }}>
      {today}
    </p>

    {/* Mensagem motivacional contextual — substitui as <p> condicionais anteriores */}
    {(() => {
      const msg = getMotivationalMessage(adherenceScore, totals.remaining, totals.total)
      return msg ? (
        <p style={{
          margin: '0.5rem 0 0',
          fontFamily: 'var(--font-body, Lexend, sans-serif)',
          fontSize: 'var(--text-body-lg, 1rem)',
          color: msg.color,
          fontWeight: msg.weight,
        }}>
          {msg.text}
        </p>
      ) : null
    })()}
  </div>
</header>
```

> **Por que IIFE para a mensagem:** evita criar uma variável fora do JSX (que quebraria a regra R-010 de ordem de hooks/declarações). Alternativa igualmente válida: declarar `const motivationalMsg = getMotivationalMessage(...)` antes do `return` — junto às outras `const` calculadas (linha ~101 do arquivo).

### Mudança C — `PriorityDoseCard` recebe prop `variant` (adaptação por persona)

Em `DashboardRedesign.jsx`, Sprint 6.5.3, a seção de dose prioritária passa a ser:

```jsx
{urgentDoses.length > 0 && (
  <section aria-label="Dose prioritária">
    <PriorityDoseCard
      doses={urgentDoses.slice(0, 3)}
      onRegister={handleRegisterDose}
      onRegisterAll={(doses) => handleRegisterDose(doses[0])}
      variant={complexityMode === 'simple' ? 'simple' : 'priority'}  {/* ← NOVO */}
    />
  </section>
)}
```

Em `PriorityDoseCard.jsx`, adicionar suporte à prop `variant`. O arquivo INTEIRO deve ser substituído pelo seguinte (a variante `'priority'` é **byte-a-byte idêntica** ao código atual — nenhuma mudança comportamental):

```jsx
import { Clock } from 'lucide-react'

/**
 * PriorityDoseCard — Destaque visual para doses urgentes (late + now).
 *
 * @param {Array} doses — DoseItem[] (late + now não registradas)
 * @param {Function} onRegister — onRegister(dose) — para dose única
 * @param {Function} onRegisterAll — onRegisterAll(doses) — para múltiplas
 * @param {'priority'|'simple'} variant — visual por persona:
 *   'simple'   → Dona Maria: card branco limpo, CTA verde gradiente 64px (1-tap action)
 *   'priority' → Carlos: card azul gradiente com lista de doses (padrão atual)
 */
export default function PriorityDoseCard({ doses = [], onRegister, onRegisterAll, variant = 'priority' }) {
  if (!doses || doses.length === 0) return null

  const nextTime = doses[0]?.scheduledTime || ''
  const now = new Date()
  const [hour, minute] = nextTime.split(':').map(Number)
  const scheduled = new Date()
  scheduled.setHours(hour, minute, 0, 0)
  const diffMin = Math.round((scheduled - now) / 60000)

  const timeLabel = diffMin <= 0
    ? 'Agora'
    : diffMin < 60
      ? `Em ${diffMin} minuto${diffMin !== 1 ? 's' : ''}`
      : `Às ${nextTime}`

  const handleCTA = () => {
    if (doses.length === 1) {
      onRegister?.(doses[0])
    } else {
      onRegisterAll?.(doses)
    }
  }

  // ── Variante simples — Dona Maria ──────────────────────────────────────────
  // Card branco com foco em UMA ação. Nome do medicamento em destaque editorial.
  // CTA verde gradiente full-width (64px) — 1-tap action.
  // Inspiração: simple-hoje reference mocks.
  if (variant === 'simple') {
    return (
      <div
        role="region"
        aria-label="Próxima dose"
        style={{
          background: 'var(--color-surface-container-lowest, #ffffff)',
          borderRadius: 'var(--radius-card, 2rem)',
          padding: '1.5rem',
          boxShadow: 'var(--shadow-editorial, 0 4px 24px -4px rgba(25, 28, 29, 0.04))',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
      >
        {/* Label contextual */}
        <span style={{
          fontFamily: 'var(--font-body, Lexend, sans-serif)',
          fontSize: 'var(--text-label-sm, 0.625rem)',
          fontWeight: 'var(--font-weight-bold, 700)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--color-outline, #6d7a76)',
        }}>
          ● Próxima Dose&ensp;·&ensp;{nextTime}
        </span>

        {/* Nome em destaque editorial */}
        <div>
          <p style={{
            margin: 0,
            fontFamily: 'var(--font-display, Public Sans, sans-serif)',
            fontSize: 'var(--text-headline-md, 1.75rem)',
            fontWeight: '700',
            color: 'var(--color-on-surface, #191c1d)',
            lineHeight: 1.2,
          }}>
            {doses[0].medicineName}
          </p>
          <p style={{
            margin: '0.25rem 0 0',
            fontFamily: 'var(--font-body, Lexend, sans-serif)',
            fontSize: 'var(--text-body-lg, 1rem)',
            color: 'var(--color-on-surface-variant, #3e4946)',
          }}>
            {doses[0].dosagePerIntake} comprimido{doses[0].dosagePerIntake !== 1 ? 's' : ''}
            &ensp;·&ensp;{timeLabel}
          </p>
        </div>

        {/* CTA verde — 1-tap action (design system: 64px min) */}
        <button
          onClick={handleCTA}
          aria-label={`Tomar ${doses[0].medicineName} agora`}
          style={{
            width: '100%',
            padding: '1rem',
            minHeight: '4rem',
            background: 'var(--gradient-primary, linear-gradient(135deg, #006a5e, #008577))',
            color: '#ffffff',
            border: 'none',
            borderRadius: 'var(--radius-button, 1.25rem)',
            fontFamily: 'var(--font-body, Lexend, sans-serif)',
            fontSize: 'var(--text-title-lg, 1.125rem)',
            fontWeight: 'var(--font-weight-bold, 700)',
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(0, 106, 94, 0.2)',
            transition: 'all 200ms ease-out',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          Tomar Agora
        </button>
      </div>
    )
  }

  // ── Variante prioritária — Carlos ──────────────────────────────────────────
  // Card azul gradiente com lista de doses e "Confirmar Agora".
  // Idêntica à implementação atual — zero mudança comportamental.
  return (
    <div
      role="region"
      aria-label="Dose prioritária"
      style={{
        background: 'linear-gradient(135deg, var(--color-secondary, #005db6), var(--color-secondary-container, #63a1ff))',
        borderRadius: 'var(--radius-card, 2rem)',
        padding: '1.5rem',
        color: '#ffffff',
        boxShadow: '0 8px 32px rgba(0, 93, 182, 0.25)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <span style={{
          background: 'rgba(255,255,255,0.2)',
          borderRadius: 'var(--radius-full, 9999px)',
          padding: '0.25rem 0.75rem',
          fontSize: 'var(--text-label-sm, 0.625rem)',
          fontWeight: 'var(--font-weight-bold, 700)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}>
          ● Prioridade Máxima
        </span>
        <span style={{
          display: 'flex', alignItems: 'center', gap: '0.25rem',
          fontSize: 'var(--text-title-lg, 1.125rem)',
          fontWeight: 'var(--font-weight-bold, 700)',
          fontFamily: 'var(--font-display, Public Sans, sans-serif)',
        }}>
          <Clock size={16} aria-hidden="true" />
          {nextTime}
        </span>
      </div>

      <p style={{
        margin: '0 0 1rem',
        fontSize: 'var(--text-body-lg, 1rem)',
        opacity: 0.85,
        fontFamily: 'var(--font-body, Lexend, sans-serif)',
      }}>
        {timeLabel}
      </p>

      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {doses.map((dose) => (
          <li
            key={`${dose.protocolId}-${dose.scheduledTime}`}
            style={{ fontSize: 'var(--text-body-lg, 1rem)', opacity: 0.9, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'rgba(255,255,255,0.7)', flexShrink: 0 }} aria-hidden="true" />
            <strong>{dose.medicineName}</strong>
            &nbsp;·&nbsp;{dose.dosagePerIntake} comprimido{dose.dosagePerIntake !== 1 ? 's' : ''}
          </li>
        ))}
      </ul>

      <button
        onClick={handleCTA}
        aria-label={`Confirmar ${doses.length} dose${doses.length !== 1 ? 's' : ''}`}
        style={{
          width: '100%',
          padding: '1rem',
          minHeight: '56px',
          background: 'rgba(255,255,255,0.95)',
          color: 'var(--color-secondary, #005db6)',
          border: 'none',
          borderRadius: 'var(--radius-button, 1.25rem)',
          fontFamily: 'var(--font-body, Lexend, sans-serif)',
          fontSize: 'var(--text-title-lg, 1.125rem)',
          fontWeight: 'var(--font-weight-bold, 700)',
          cursor: 'pointer',
          transition: 'all 200ms ease-out',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        Confirmar Agora
      </button>
    </div>
  )
}
```

### Mudança D — Stock alert sobe para o topo em modo complexo

Em `DashboardRedesign.jsx`, a posição do `StockAlertInline` passa a depender do `complexityMode`. Usuário complexo precisa ver alertas críticos antes de qualquer outra coisa — é como a referência complex-hoje trata a urgência clínica.

Substituir a estrutura do `return` (conforme especificada em Sprint 6.5.3) para incluir esta lógica:

```jsx
return (
  <div className="page-container" style={{ paddingTop: '1.5rem', paddingBottom: '2rem' }} aria-label="Dashboard — Meus Remédios">

    {/* ─── Alerta de estoque: modo complexo → topo (antes do grid), modo simples → col. direita ─── */}
    {complexityMode === 'complex' && criticalStockItems.length > 0 && (
      <section style={{ marginBottom: '1.25rem' }} aria-label="Alertas de estoque">
        <StockAlertInline
          criticalItems={criticalStockItems}
          onNavigateToStock={() => onNavigate?.('stock')}
        />
      </section>
    )}

    <div className="grid-dashboard">

      {/* Coluna esquerda: ring + saudação + dose prioritária */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <header style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', textAlign: 'center' }}>
          {/* ... conteúdo conforme Mudança B acima ... */}
        </header>

        {urgentDoses.length > 0 && (
          <section aria-label="Dose prioritária">
            <PriorityDoseCard
              doses={urgentDoses.slice(0, 3)}
              onRegister={handleRegisterDose}
              onRegisterAll={(doses) => handleRegisterDose(doses[0])}
              variant={complexityMode === 'simple' ? 'simple' : 'priority'}
            />
          </section>
        )}
      </div>

      {/* Coluna direita: cronograma + stock (apenas modo simples) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {allDoses.length > 0 && (
          <section aria-label="Cronograma de hoje">
            <h2 style={{ margin: '0 0 1rem', fontFamily: 'var(--font-display, Public Sans, sans-serif)', fontSize: 'var(--text-title-lg, 1.125rem)', fontWeight: '600', color: 'var(--color-on-surface, #191c1d)' }}>
              Cronograma de Hoje
            </h2>
            <CronogramaPeriodo allDoses={allDoses} onRegister={handleRegisterDose} />
          </section>
        )}

        {/* Stock alert: só renderiza aqui para modo simples — complexo já está no topo */}
        {complexityMode !== 'complex' && criticalStockItems.length > 0 && (
          <section aria-label="Alertas de estoque">
            <StockAlertInline
              criticalItems={criticalStockItems}
              onNavigateToStock={() => onNavigate?.('stock')}
            />
          </section>
        )}

        {allDoses.length === 0 && !contextLoading && (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-outline, #6d7a76)' }} role="status">
            <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💊</p>
            <p style={{ fontFamily: 'var(--font-body, Lexend, sans-serif)', fontSize: 'var(--text-body-lg, 1rem)' }}>
              Nenhuma dose agendada para hoje.
            </p>
            <button
              onClick={() => onNavigate?.('medicines')}
              style={{ marginTop: '1rem', padding: '0.75rem 1.5rem', minHeight: '3.5rem', background: 'var(--gradient-primary, linear-gradient(135deg, #006a5e, #008577))', color: '#ffffff', border: 'none', borderRadius: 'var(--radius-button, 1.25rem)', fontFamily: 'var(--font-body, Lexend, sans-serif)', fontWeight: '600', cursor: 'pointer' }}
            >
              Adicionar Medicamento
            </button>
          </div>
        )}
      </div>

    </div>

    <Modal isOpen={isModalOpen} onClose={handleModalClose} title="Registrar Dose">
      <LogForm prefillData={prefillData} onSuccess={handleLogSuccess} onCancel={handleModalClose} />
    </Modal>
  </div>
)
```

> **Nota:** `StockAlertInline` renderiza uma única vez no DOM — sem duplicação. A condição `complexityMode !== 'complex'` na col. direita e a condição `complexityMode === 'complex'` no topo são mutuamente exclusivas.

### Critério de conclusão Sprint 6.5.4

- [ ] `getMotivationalMessage()` declarada antes do componente (fora do JSX)
- [ ] Label "ADESÃO DIÁRIA" visível acima do RingGauge em ambas as personas
- [ ] Mensagem motivacional contextual substitui "X doses restantes hoje" — varia por score
- [ ] `PriorityDoseCard` com prop `variant` funcional:
  - [ ] `variant='simple'` → card branco, nome do remédio em `headline-md`, botão verde "Tomar Agora" `minHeight: '4rem'`
  - [ ] `variant='priority'` → comportamento atual preservado (zero regressão)
- [ ] `DashboardRedesign` passa `variant={complexityMode === 'simple' ? 'simple' : 'priority'}`
- [ ] Estoque crítico em modo complexo: aparece ACIMA do grid (primeiro elemento visível)
- [ ] Estoque crítico em modo simples: aparece no final da coluna direita (como antes)
- [ ] `StockAlertInline` nunca renderiza duas vezes no mesmo DOM

---

## Sprint 6.5.5 — Cronograma: Madrugada + Cascade Reveal

**Arquivo modificado:** `src/features/dashboard/components/CronogramaPeriodo.jsx`

### Problema A — Classificação imprecisa de períodos

O array `PERIODS` atual agrupa doses de madrugada (ex: 02:00, 05:00) junto com as de manhã (08:00), resultando num período "Manhã" que vai de 00:00 a 12:00. Qualquer medicamento noturno administrado após meia-noite aparece incorretamente em "Manhã". A referência visual indica 4 períodos distintos.

### Problema B — Ausência de animações de entrada

A PRODUCT_STRATEGY e o design system especificam "Cascade Reveal" para listas de itens. O `useMotion()` hook entregue na W5 tem `cascade.container` e `cascade.item` prontos, mas o `CronogramaPeriodo` não os usa — o componente monta sem nenhuma animação.

### Implementação completa do arquivo

Substitua o conteúdo INTEGRAL de `CronogramaPeriodo.jsx` pelo seguinte. Alterações marcadas com `// ← ALTERADO`:

```jsx
import { motion } from 'framer-motion'                              // ← NOVO
import { Sun, Sunrise, Moon, CheckCircle2, Circle } from 'lucide-react'  // ← ALTERADO: +Sunrise
import { useMotion } from '@shared/hooks/useMotion'                 // ← NOVO

// ← ALTERADO: 4 períodos; Manhã ajustada para 6h–12h; Madrugada = 0h–6h
const PERIODS = [
  { id: 'dawn',      label: 'Madrugada', Icon: Moon,    timeRange: [0,  6]  },
  { id: 'morning',   label: 'Manhã',     Icon: Sunrise, timeRange: [6,  12] },
  { id: 'afternoon', label: 'Tarde',     Icon: Sun,     timeRange: [12, 18] },
  { id: 'night',     label: 'Noite',     Icon: Moon,    timeRange: [18, 24] },
]

function getHour(scheduledTime) {
  return parseInt(scheduledTime.split(':')[0], 10)
}

function CronogramaDoseItem({ dose, onRegister }) {
  const done = dose.isRegistered

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.75rem 1rem',
        borderRadius: 'var(--radius-lg, 1rem)',
        background: done ? 'transparent' : 'var(--color-surface-container-lowest, #ffffff)',
        boxShadow: done ? 'none' : 'var(--shadow-editorial, 0 4px 24px -4px rgba(25, 28, 29, 0.04))',
        opacity: done ? 0.55 : 1,
        transition: 'all 200ms ease-out',
      }}
    >
      {done
        ? <CheckCircle2 size={20} color="var(--color-primary, #006a5e)" aria-hidden="true" />
        : <Circle size={20} color="var(--color-outline, #6d7a76)" aria-hidden="true" />
      }

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-body, Lexend, sans-serif)',
          fontWeight: 'var(--font-weight-semibold, 600)',
          fontSize: 'var(--text-body-lg, 1rem)',
          color: 'var(--color-on-surface, #191c1d)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {dose.medicineName}
        </div>
        <div style={{
          fontFamily: 'var(--font-body, Lexend, sans-serif)',
          fontSize: 'var(--text-label-md, 0.75rem)',
          color: 'var(--color-on-surface-variant, #3e4946)',
        }}>
          {dose.dosagePerIntake} comprimido{dose.dosagePerIntake !== 1 ? 's' : ''} · {dose.scheduledTime}
        </div>
      </div>

      {!done && (
        <button
          onClick={() => onRegister?.(dose)}
          aria-label={`Registrar dose de ${dose.medicineName}`}
          style={{
            padding: '0.625rem 1.125rem',
            minHeight: '3.5rem',           // ← Sprint 6.5.2: 56px (era 36px)
            background: 'var(--color-primary, #006a5e)',
            color: 'var(--color-on-primary, #ffffff)',
            border: 'none',
            borderRadius: 'var(--radius-full, 9999px)',
            fontFamily: 'var(--font-body, Lexend, sans-serif)',
            fontSize: 'var(--text-label-md, 0.75rem)',
            fontWeight: 'var(--font-weight-bold, 700)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all 150ms ease-out',
          }}
        >
          TOMAR
        </button>
      )}
    </div>
  )
}

/**
 * CronogramaPeriodo — Cronograma de doses agrupado por Manhã/Tarde/Noite.
 *
 * Animação de entrada: Cascade Reveal via useMotion() (respeita prefers-reduced-motion).
 * Períodos: Madrugada (0–6h), Manhã (6–12h), Tarde (12–18h), Noite (18–24h).
 *
 * @param {Array} allDoses — Todas as doses do dia (flat: late+now+upcoming+later+done)
 * @param {Function} onRegister — callback: onRegister(dose)
 */
export default function CronogramaPeriodo({ allDoses = [], onRegister }) {
  const motionKit = useMotion()                                     // ← NOVO

  const grouped = PERIODS.map(({ id, label, Icon, timeRange }) => {
    const [start, end] = timeRange
    const doses = allDoses
      .filter((d) => {
        const h = getHour(d.scheduledTime)
        return h >= start && h < end
      })
      .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))
    return { id, label, Icon, doses }
  }).filter(({ doses }) => doses.length > 0)

  if (grouped.length === 0) return null

  return (
    // ← ALTERADO: motion.div com cascade.container para stagger das seções
    <motion.div
      variants={motionKit.cascade.container}
      initial="hidden"
      animate="visible"
      style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
      aria-label="Cronograma de doses de hoje"
    >
      {grouped.map(({ id, label, Icon, doses }) => {
        const PeriodIcon = Icon
        return (
        // ← ALTERADO: motion.section com cascade.item (stagger aplicado pelo container)
        <motion.section key={id} variants={motionKit.cascade.item} aria-label={`${label}: ${doses.length} dose${doses.length !== 1 ? 's' : ''}`}>
          {/* Header do período */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            marginBottom: '0.75rem', paddingLeft: '0.25rem',
          }}>
            <PeriodIcon size={16} color="var(--color-outline, #6d7a76)" aria-hidden="true" />
            <h3 style={{
              margin: 0,
              fontFamily: 'var(--font-body, Lexend, sans-serif)',
              fontSize: 'var(--text-label-md, 0.75rem)',
              fontWeight: 'var(--font-weight-bold, 700)',
              color: 'var(--color-outline, #6d7a76)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}>
              {label}
            </h3>
            <span style={{
              marginLeft: 'auto',
              fontSize: 'var(--text-label-sm, 0.625rem)',
              color: 'var(--color-outline, #6d7a76)',
            }}>
              {doses.filter(d => d.isRegistered).length}/{doses.length}
            </span>
          </div>

          <div className="cronograma-doses">  {/* ← Sprint 6.5.2: classe CSS responsiva */}
            {doses.map((dose) => (
              <CronogramaDoseItem
                key={`${dose.protocolId}-${dose.scheduledTime}`}
                dose={dose}
                onRegister={onRegister}
              />
            ))}
          </div>
        </motion.section>
        )
      })}
    </motion.div>
  )
}
```

> **Nota sobre `timeRange`:** Medicamentos com horário `00:00`–`05:59` passarão a aparecer em "Madrugada" em vez de "Manhã". Esta é uma correção comportamental intencional — mais precisa clinicamente. Se o usuário não tiver doses nesse range, o período "Madrugada" simplesmente não aparece (filtro `filter(doses.length > 0)` já existente).

### Critério de conclusão Sprint 6.5.5

- [ ] Imports: `motion` de `framer-motion`, `Sunrise` de `lucide-react`, `useMotion` de `@shared/hooks/useMotion`
- [ ] `PERIODS` tem 4 entradas: Madrugada [0,6], Manhã [6,12], Tarde [12,18], Noite [18,24]
- [ ] Manhã usa ícone `Sunrise` (não mais `Sun` — visualmente distinto de Tarde)
- [ ] Wrapper externo é `motion.div` com `variants={motionKit.cascade.container}`
- [ ] Cada período é `motion.section` com `variants={motionKit.cascade.item}`
- [ ] `initial="hidden" animate="visible"` apenas no `motion.div` wrapper (o `cascade.container` propaga)
- [ ] `CronogramaDoseItem` permanece como componente regular (não `motion` — stagger no nível de seção é suficiente)
- [ ] Sem regressão em `prefers-reduced-motion` — `useMotion()` retorna `staticFallback` automaticamente
- [ ] Testes: dose às 03:30 aparece em "Madrugada"; dose às 06:00 aparece em "Manhã"

---

## Mapeamento de arquivos desta wave

| Sprint | Arquivo | Ação |
|--------|---------|------|
| 6.5.1 | `src/shared/styles/layout.redesign.css` | Adição ao final (+14 linhas — `.cronograma-doses`) |
| 6.5.2 | `src/features/dashboard/components/CronogramaPeriodo.jsx` | Edição pontual (minHeight, className) |
| 6.5.3 | `src/views/redesign/DashboardRedesign.jsx` | Substituição do `return` (layout 2-col) |
| 6.5.4 | `src/views/redesign/DashboardRedesign.jsx` | Helper `getMotivationalMessage` + header + `variant` + stock logic |
| 6.5.4 | `src/features/dashboard/components/PriorityDoseCard.jsx` | Prop `variant` com dois caminhos de render |
| 6.5.5 | `src/features/dashboard/components/CronogramaPeriodo.jsx` | Substituição integral: Madrugada + Cascade Reveal |

**Total de arquivos modificados: 4. Total de componentes novos: 0.**

> **Atenção à ordem:** Sprints 6.5.2 e 6.5.5 modificam o mesmo arquivo (`CronogramaPeriodo.jsx`). O 6.5.5 substitui o arquivo integralmente, já incorporando a correção de minHeight e className do 6.5.2. Se executando todos os sprints em sequência, pule o 6.5.2 e vá direto ao 6.5.5.

---

## Features identificadas nas referências — reservadas para waves futuras

Durante a revisão das referências visuais (`simple-hoje`, `complex-hoje`, PRODUCT_STRATEGY), foram identificados os seguintes elementos **intencionalmente excluídos** do escopo desta wave por requererem mudanças de dados ou backend:

| Feature | Referência | Por que não está em W6.5 | Wave sugerida |
|---------|------------|--------------------------|---------------|
| Botão "ADIAR" nas doses | `complex-hoje-*` | Requer endpoint de snooze no backend; stub sem backend = UX enganosa | W7+ |
| Ícone circular por tipo de medicamento | `complex-hoje-mobile` | Requer campo `medicine_type` no `DoseItem` shape (não exposto pelo `useDoseZones`) | W7 |
| Instruções de administração ("Após o café", "Em jejum") | `complex-hoje-*` | Requer campo `instructions` no protocolo (não existe no schema atual) | W7 |
| "Painel de Controle" como título da página | `complex-hoje-desktop` | Cosmético, menor impacto; pode ser feito em W7 junto com o resto da densificação | W7 |
| Streak proeminente no canto superior direito (desktop simples) | `simple-hoje-desktop` | Layout de header é contexto de W4 (Navigation Shell); alterar aqui quebraria responsabilidades | W7 |

> Estas features **não foram esquecidas** — estão documentadas aqui e na master spec para rastreabilidade. O agente que implementar W7 deve consultar este índice.

---

## Atualizar após merge

Ao fazer merge desta wave, atualizar em `EXEC_SPEC_REDESIGN_EXPERIENCIA_PACIENTE.md`:

```markdown
| W6.5 | Dashboard Desktop Layout Fixes | `WAVE_6_5_DASHBOARD_DESKTOP_FIXES.md` | ⏳ PENDENTE → ✅ MERGED #XXX |
```

E registrar em `.memory/journal/2026-W13.md` a lição aprendida: **spec de entrega sem desktop layout explícito + código de exemplo linear → agente implementa 1-col only**. Adicionar anti-pattern em `.memory/anti-patterns.md`.
