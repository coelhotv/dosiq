# Exec Spec Addendum: Native App UX Ads and Monetization

> **Status:** Addendum normativo e prescritivo
> **Base obrigatoria:** `plans/native_app_ux_revamp/PRD_NATIVE_APP_UX_REVAMP.md`
> **Objetivo:** documentar ads como trilha real de monetizacao, mas desacoplada do redesign visual inicial

---

## 1. Papel dos ads na estrategia mobile

Ads existem nesta iniciativa como:

- requisito de negocio real
- preocupacao arquitetural antecipada
- necessidade de reserva de espaco coerente

Ads **nao** existem aqui como:

- provider obrigatorio imediato
- driver principal da hierarquia da tela
- justificativa para poluir a experiencia clinica

---

## 2. Principios de monetizacao responsavel

1. Conteudo clinico critico sempre vence anuncio.
2. Anuncio nunca substitui CTA de saude.
3. O usuario deve reconhecer visualmente um placement patrocinado.
4. Ads nao podem parecer recomendacao medica.

---

## 3. Placements permitidos por tela

### Hoje

Permitido:

- apos resumo principal e agenda, ou no terco inferior da tela

Proibido:

- acima da prioridade do momento
- entre um alerta critico e seu CTA

### Tratamentos

Permitido:

- entre grupos, desde que nao interrompa leitura do card prioritario
- no fim da lista ou antes do rodape

### Estoque

Permitido:

- abaixo do resumo de criticidade e antes do bloco regular

Proibido:

- entre item critico e botao de reposicao

### Perfil

Permitido:

- apos utilitarios principais
- no terco inferior da tela

---

## 4. Placements proibidos

- primeira dobra acima do CTA clinico principal
- no meio de fluxo de confirmacao
- dentro de modal de dose
- junto de mensagens de erro ou risco grave

---

## 5. Prioridade de conteudo vs anuncio

Hierarquia obrigatoria:

1. acao clinica primaria
2. risco e status de saude
3. conteudo funcional da tela
4. anuncio

Se o placement disputar atencao com item acima, o placement esta errado.

---

## 6. Contrato tecnico do `AdSlotCard`

Props minimas recomendadas:

```js
{
  slotId,
  placement,
  state,
  label,
  minHeight,
  renderMode
}
```

Estados permitidos:

- `hidden`
- `placeholder`
- `provider_active`
- `provider_unavailable`

Regra:

- a tela consome apenas `AdSlotCard`
- SDK real nao entra espalhado pela UI

---

## 7. Feature flags de ativacao

Flags recomendadas:

- `mobileAdsSlotsEnabled`
- `mobileAdsProviderEnabled`

Comportamento:

- `slots=false` -> nada renderiza
- `slots=true`, `provider=false` -> placeholder padronizado
- `slots=true`, `provider=true` -> wrapper real do provider

---

## 8. Fallback sem provider

O fallback oficial inicial e:

- placeholder neutro
- label clara de patrocinio reservado
- altura padrao por placement

Nao usar:

- area em branco quebrada
- componente colapsando layout

---

## 9. Metricas de monetizacao e impacto

### Metricas de readiness

- slots presentes nas telas corretas
- zero conflito com conteudo principal
- zero regressao de navegacao

### Metricas futuras

- fill rate
- CTR
- impacto em retencao
- impacto em tempo ate primeira acao clinica

---

## 10. Riscos de confianca do usuario

| Risco | Mitigacao |
|------|-----------|
| parecer que o app vende recomendacao medica | rotulagem clara e posicionamento secundario |
| anuncio competir com item critico | regras de placement proibido |
| UX parecer oportunista | ativacao apos base visual consolidada |

---

## 11. Compliance e revisao humana

Antes de ativar provider real:

- revisar politica de conteudo
- revisar tipo de anuncios permitidos
- revisar impacto nas capturas de loja
- validar em device real

Dependencia humana explicita:

- aprovacao do maintainer para provider e placements finais

---

## 12. Decisoes congeladas

1. a primeira entrega usa placeholders e contratos
2. ativacao real do provider fica em wave posterior
3. nenhum ad entra acima da acao principal clinica
4. `AdSlotCard` e o unico ponto de integracao de UI com monetizacao
