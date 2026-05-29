# [DEPRECATED] Protocolo Padronizado para Agents - Gemini Reviews

⚠️ **ATENÇÃO: ESTE DOCUMENTO ESTÁ DEPRECIADO E ARQUIVADO.**

A partir da versão **2.0.0** da integração (Spec 3 - Maio de 2026), todos os endpoints API Vercel de persistência e sincronização de reviews (`api/gemini-reviews.js` e diretório `api/gemini-reviews/`), a camada de transporte Vercel Blob (`@vercel/blob`) e as tabelas correspondentes no Supabase foram **completamente decommissionadas e deletadas** do projeto.

A inteligência de reviews do Gemini, classificação de severidades e auditoria local de resoluções de PR agora rodam **100% de forma local e offline em containers GitHub Actions**, sem comunicação externa de rede ou webhooks.

Para entender a arquitetura ativa de reviews locais, consulte o documento oficial:
- [GEMINI_INTEGRATION.md](./GEMINI_INTEGRATION.md)

---

### Histórico de Deprecação
- **Decommission Endpoints**: `POST /api/gemini-reviews/persist`, `POST /api/gemini-reviews/create-issues`, `POST /api/gemini-reviews/update-status` deletados.
- **Decommission DB**: Tabelas `gemini_reviews` no Supabase removidas da sincronização de produção.
- **Decommission Transport**: Dependência `@vercel/blob` desinstalada.
- **Data do Decommission**: 2026-05-29 (PR #608).
