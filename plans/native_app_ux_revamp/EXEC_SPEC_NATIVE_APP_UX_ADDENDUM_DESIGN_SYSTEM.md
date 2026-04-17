# Exec Spec Addendum: Native App UX Design System

> **Status:** Addendum normativo e prescritivo
> **Base obrigatoria:** `plans/native_app_ux_revamp/EXEC_SPEC_NATIVE_APP_UX_ARCHITECTURE.md`
> **Base complementar:** `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_ADDENDUM_DESIGN_TOKENS.md`
> **Objetivo:** traduzir a linguagem visual dos mocks hi-fi em sistema consistente e implementavel para o mobile

---

## 1. Tese visual do revamp

O app deve transmitir:

- confianca clinica
- calma premium
- foco em acao

A referencia mais correta nao e "app genérico bonito". A referencia e:

- editorial clinico
- superficie limpa
- tipografia com contraste
- cards com peso e respiracao
- status visiveis sem poluicao

---

## 2. Principios de hierarquia

1. Cada tela precisa de um bloco de maior prioridade.
2. Cards de resumo e cards de acao nao podem ter o mesmo peso visual.
3. Titulo de tela, hero e listas devem formar tres niveis claros.
4. Status semantico deve ser identificavel em menos de uma leitura longa.

---

## 3. Tipografia

### Escala recomendada

| Uso | Tamanho sugerido | Peso |
|-----|------------------|------|
| Titulo de tela | 28-32 | 700-800 |
| Subtitulo | 14-16 | 400-500 |
| Titulo de hero card | 22-28 | 700 |
| Titulo de card | 16-20 | 600-700 |
| Body primario | 14-16 | 400-500 |
| Meta/caption | 11-13 | 500-600 |

### Regras

- evitar muitos tamanhos por tela
- usar contraste de peso para hierarquia
- meta-informacao nao pode competir com o dado principal

---

## 4. Cores semanticas

### Paleta funcional

- brand principal: azul profundo existente
- apoio editorial: verde/teal clinico
- sucesso: verde suave
- warning: amarelo/amber controlado
- erro/critico: vermelho com alta legibilidade
- neutros: off-white, cinzas frios, texto escuro quase grafite

### Regras

- no maximo 2 acentos fortes por tela
- critico e atencao nao podem se confundir
- verde de sucesso nao deve parecer call-to-action primario por acidente

---

## 5. Superficies

Superficies obrigatorias:

- `screen`
- `card`
- `hero`
- `subtle`
- `dangerTint`
- `successTint`
- `adSlot`

Regras:

- hero tem mais contraste e profundidade
- card comum privilegia leitura
- ad slot deve ser neutro e identificavel como patrocinado

---

## 6. Bordas e radii

Radii recomendados:

- cards comuns: `lg`
- hero cards: `xl` ou `xxl`
- badges: pill/full
- ad slots: `lg` com linguagem mais discreta

Regra:

- a iniciativa deve parecer macia e premium, mas sem virar estilo lúdico infantil

---

## 7. Sombras

Sombras devem ser:

- leves
- difusas
- consistentes entre hero, cards e slots

Proibido:

- sombra muito escura
- sombra forte em todo elemento
- sombra e borda agressiva simultaneamente em excesso

---

## 8. Densidade e spacing

Regras:

- usar respiracao vertical generosa
- listas precisam de ritmo consistente
- secoes devem parecer agrupadas, nao empilhadas aleatoriamente

Escala preferida:

- multiples dos tokens existentes `4, 8, 12, 16, 20, 24, 32, 40`

---

## 9. Icones e ornamentacao

Principios:

- icones servem suporte semantico, nao decoracao solta
- manter coerencia com `lucide-react-native`
- usar iconografia para reforco de categoria, estado ou acao

---

## 10. Regras de badges e status

### Estados canonicos

- `estavel`
- `normal`
- `em_dia`
- `atencao`
- `baixo_estoque`
- `critico`

### Regras

- badge precisa de texto, nao apenas cor
- badge critico usa maior contraste
- badge de estado calmo deve ser mais leve e menos chamativo

---

## 11. Regras de CTA

### CTA primario

- alto contraste
- texto curto
- posicionado no bloco que pede acao

### CTA secundario

- mais discreto
- nunca competir com o primario

### Proibicoes

- muitos botoes do mesmo peso no mesmo card
- CTA secundario com cor mais forte que o principal

---

## 12. Tab bar

Diretrizes:

- preservar IA atual
- melhorar acabamento visual
- diferenciar ativo e inativo sem excessos
- respeitar safe area e home indicator

---

## 13. Placeholders patrocinados

Regras:

- identificar claramente patrocinio
- layout reservado consistente
- visual neutro o bastante para nao competir com o bloco clinico superior

---

## 14. Motion minima permitida

Permitido:

- fades curtos
- pequenas transicoes de estado
- micro-realce de confirmacao

Proibido nesta iniciativa:

- reanimated como dependencia estrutural
- motion coreografada pesada
- paridade forçada com motion web

---

## 15. Tabela de tokens semanticos

| Token | Uso |
|-------|-----|
| `surface.screen` | fundo geral |
| `surface.card` | cards padrao |
| `surface.hero` | card principal da tela |
| `surface.criticalTint` | contexto de risco |
| `surface.successTint` | contexto positivo |
| `surface.adSlot` | area patrocinada |
| `text.primary` | titulos e dados |
| `text.secondary` | apoio e subtitulo |
| `text.inverse` | texto sobre hero escuro |
| `accent.primary` | CTA principal |
| `accent.clinical` | pequenos destaques de categoria |
| `badge.critical` | risco elevado |
| `badge.warning` | atencao |
| `badge.success` | estado positivo |
| `badge.neutral` | estado informativo |

---

## 16. Tabela mock -> token -> uso

| Elemento do mock | Token dominante | Uso recomendado |
|------------------|-----------------|-----------------|
| Card hero verde/teal | `surface.hero` | prioridade do momento |
| Ring de adesao | `accent.primary` + `badge.success` | resumo/score |
| Alertas vermelhos | `badge.critical` + `surface.criticalTint` | risco/estoque |
| Slot patrocinado | `surface.adSlot` | reserva de monetizacao |

---

## 17. Tabela de estados por componente

| Componente | Estados minimos |
|------------|-----------------|
| `HeroCard` | default, loading, disabled, warning-context |
| `MetricCard` | default, loading, stale |
| `StatusBadge` | success, warning, critical, neutral |
| `AdSlotCard` | hidden, placeholder, active-provider, unavailable |
| `UtilityActionCard` | default, pressed, disabled |

---

## 18. Proibicoes visuais

- copiar layout do mock sem considerar dados reais
- usar 3 ou mais acentos saturados na mesma tela
- criar card com CTA e status concorrentes demais
- misturar muitas linguagens diferentes por tela
- usar placeholder de ad com destaque maior que hero clinico

---

## 19. Checklist de consistencia por tela

### Hoje

- existe um bloco principal inequvoco?
- a agenda abaixo parece secundaria, mas importante?

### Tratamentos

- progresso e status estao legiveis?
- os cards parecem da mesma familia visual?

### Estoque

- o risco critico salta aos olhos?
- a lista regular nao parece igual a critica?

### Perfil

- o usuario entende o que e identidade, configuracao e utilitario?
- a tela parece pessoal e util, nao burocratica?
