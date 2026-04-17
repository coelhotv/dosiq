# Exec Spec Addendum: Native App UX Testing and Visual Validation

> **Status:** Addendum normativo e prescritivo
> **Base obrigatoria:** `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_ADDENDUM_TESTING_MOBILE.md`
> **Objetivo:** definir como validar o revamp UX com testes automatizados e checklist visual objetivo

---

## 1. Estrategia de testes por camada

### Camada 1. Componentes base

Testar:

- renderizacao
- variantes
- estados
- acessibilidade minima

### Camada 2. Screen composition

Testar:

- ordem de blocos
- estados `loading`, `error`, `empty`, `ready`
- comportamento com flags

### Camada 3. Navegacao preservada

Testar:

- tab principal inalterada
- stacks aninhadas ainda funcionais

### Camada 4. Validacao manual

Testar:

- safe area
- toque
- leitura real
- contraste

---

## 2. Componentes criticos a testar

- `MobileScreenScaffold`
- `ScreenHeader`
- `HeroCard`
- `MetricCard`
- `MetricRingCard`
- `StatusBadge`
- `AdSlotCard`
- `UtilityActionCard`

---

## 3. Telas criticas a testar

- `TodayScreen`
- `TreatmentsScreen`
- `StockScreen`
- `ProfileScreen`

Para cada uma:

- `loading`
- `error`
- `empty`
- `success`
- `stale` quando aplicavel

---

## 4. Testes de estados

Regras:

- cada tela precisa de pelo menos 1 teste feliz e 1 teste de erro/ausencia
- componentes base precisam de cobertura de variantes importantes
- `AdSlotCard` precisa de testes para `hidden`, `placeholder` e `provider_unavailable`

---

## 5. Snapshots controlados

Snapshots sao permitidos para:

- scaffold base
- estado pronto de uma tela
- componentes de badge e hero

Snapshots nao substituem:

- asserts semanticos
- testes de props e comportamento

---

## 6. Regressao visual/manual

Checklist visual por tela:

- titulo legivel
- CTA principal claro
- nomes longos truncados com dignidade
- safe area correta
- tab bar sem clipping
- badges legiveis
- slot patrocinado secundario ao conteudo principal

---

## 7. Checklist iOS e Android

### iOS

- home indicator respeitado
- hero cards nao colam no topo
- tab bar nao sobrepoe conteudo

### Android

- espacamento inferior funcional
- textos nao estouram facilmente
- elevation/sombras aceitaveis

---

## 8. Criterios de aceite por sprint

### UX.2

- componentes base renderizam
- tokens semanticos aplicados

### UX.3-UX.6

- tela alvo cobre estados principais
- navegacao preservada
- validacao manual minima feita

### UX.7

- slots com flags corretas
- nenhuma tela quebra sem provider

### UX.8

- consistencia transversal
- checklist final iOS/Android executado

---

## 9. Validacao humana obrigatoria

Antes de merge de sprint de tela:

- verificar em simulator ou device
- validar legibilidade real
- confirmar que a acao principal esta mais clara, nao menos

Template minimo de validacao manual:

```md
## Validacao manual necessaria

- [ ] Tela abre normalmente
- [ ] CTA principal esta claro
- [ ] Safe area esta correta
- [ ] Nomes longos nao quebram layout
- [ ] Tab bar continua funcional
```

---

## 10. Cobertura minima congelada

- testes dos componentes base
- testes das 4 telas com estados principais
- testes de navegacao preservada
- testes de feature flags de ads
- checklist manual de contraste, truncamento, safe area e touch targets

---

## 11. Criterio de aceite do addendum

Este addendum estara satisfeito quando:

1. cada sprint tiver testes proporcionais ao seu escopo
2. validacao visual nao ficar apenas "no olho"
3. os riscos principais de regressao estiverem cobertos por checklist ou teste automatizado
