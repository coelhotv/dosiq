# Requirements Checklist: Universal Links / App Links & Web Smart Banner

**Feature Directory**: `plans/specs/019-universal-links-web-banner`  
**Created**: 2026-06-01  
**Source**: Migrated Legacy Plan  

---

## Completeness

- [ ] **CHK001**: Todos os critérios de aceitação e DoDs do plano original de Universal Links e Smart App Banners estão cobertos nos requisitos funcionais e nas tarefas técnicas?  
  *Critério: O redirecionamento de cadastro, redefinição, Smart Banner iOS, e banner customizado com localStorage e a11y estão explícitos.*
- [ ] **CHK002**: O arquivo lista claramente o que já foi entregue (Plano 1 estático) para que o desenvolvedor futuro saiba exatamente por onde começar?  
  *Critério: Arquivos `.well-known/` consolidados no plan.md.*

---

## Clarity

- [ ] **CHK003**: Os termos de roteamento (PKCE, implicit, standalone, display-mode, user agent) estão quantificados de forma precisa e técnica?  
  *Critério: Sem uso de termos abstratos para descrever o fluxo.*
- [ ] **CHK004**: O comportamento do banner de recomendação móvel e a sua persistência de dispensa (TTL) estão clarificados com exatidão?  
  *Critério: Definição clara da janela de 30 dias gravada sob a chave de localStorage.*

---

## Traceability

- [ ] **CHK005**: Cada um dos requisitos funcionais (FR-001 a FR-005) e critérios de sucesso (SC-001 a SC-004) do spec está mapeado para pelo menos uma tarefa de implementação na tasks.md?  
  *Critério: Rastreabilidade 1-para-1 verificável.*

---

## Constitution Alignment

- [ ] **CHK006**: O plano técnico respeita o limite de 12 funções serverless da Vercel Hobby (R-090)?  
  *Critério: Rota `/auth/callback` definida e implementada como SPA inteiramente no client-side.*
- [ ] **CHK007**: A inclusão de tarefas de qualidade e bumps de versão da governança SQP R-221 está explícita nas fases finais?  
  *Critério: Tarefas T018 a T021 cobrem SemVer, Changelog e validação de lint.*
- [ ] **CHK008**: O design do banner reativo customizado móvel segue o padrão de carregamento e performance mobile (R-117)?  
  *Critério: Carregamento assíncrono preguiçoso (lazy + Suspense) do componente de banner no layout raiz.*
