# Guia — Upload da Base ANVISA para Supabase Storage

> **Contexto**: Sprint P.2 (Fase 0 CRUD Native) — disponibiliza a base de medicamentos ANVISA via Supabase Storage para que o app mobile faça download + cache local (`useMedicineDatabase`).
> **Tarefa**: P2.3 do `EXEC_SPEC_PRE_REQUISITOS.md`
> **Executor**: Humano (PO)
> **Tempo estimado**: 10 minutos

---

## 1. Pré-requisitos

- Acesso ao projeto Supabase **`kwqjtdsqkkbebfiaxubb`** (dashboard web)
- Permissão de admin no projeto
- Arquivos locais disponíveis em:
  - `apps/web/src/features/medications/data/medicineDatabase.json` (≈ 1.34 MB)
  - `apps/web/src/features/medications/data/laboratoryDatabase.json` (≈ 14 KB)

---

## 2. Estrutura final esperada no bucket

```
dosiq-assets/                 ← bucket (público, leitura anônima)
└── anvisa/
    └── v1/                   ← versão do dataset
        ├── manifest.json     ← metadados (versão + timestamps + tamanhos)
        ├── medicineDatabase.json
        └── laboratoryDatabase.json
```

URLs públicas resultantes:

```
https://kwqjtdsqkkbebfiaxubb.supabase.co/storage/v1/object/public/dosiq-assets/anvisa/v1/manifest.json
https://kwqjtdsqkkbebfiaxubb.supabase.co/storage/v1/object/public/dosiq-assets/anvisa/v1/medicineDatabase.json
https://kwqjtdsqkkbebfiaxubb.supabase.co/storage/v1/object/public/dosiq-assets/anvisa/v1/laboratoryDatabase.json
```

---

## 3. Passo a passo (Dashboard Supabase)

### 3.1 — Criar o bucket `dosiq-assets`

1. Abra https://supabase.com/dashboard/project/kwqjtdsqkkbebfiaxubb/storage/buckets
2. Clique em **"New bucket"**
3. Configure:
   - **Name**: `dosiq-assets`
   - **Public bucket**: ✅ ATIVADO (leitura anônima — clientes mobile precisam baixar sem auth)
   - **File size limit**: deixe em branco (default 50 MB cobre nossos arquivos)
   - **Allowed MIME types**: deixe em branco
4. Clique em **"Save"**

> ⚠️ **Atenção**: Bucket público permite leitura anônima de TUDO dentro dele. Não suba arquivos sensíveis aqui.

### 3.2 — Criar a estrutura de pastas

1. Entre no bucket `dosiq-assets` recém-criado
2. Clique em **"Create folder"** → digite `anvisa` → Save
3. Entre em `anvisa/`, clique em **"Create folder"** → digite `v1` → Save
4. Você deve estar agora em `dosiq-assets/anvisa/v1/`

### 3.3 — Gerar o `manifest.json` localmente

No teu Mac, no diretório do projeto:

```bash
cd "/Users/coelhotv/git-icloud/dosiq/apps/web/src/features/medications/data"

cat > manifest.json <<EOF
{
  "version": "1.0.0",
  "generatedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "files": {
    "medicineDatabase": {
      "path": "anvisa/v1/medicineDatabase.json",
      "size": $(wc -c < medicineDatabase.json),
      "count": $(node -e "console.log(JSON.parse(require('fs').readFileSync('medicineDatabase.json','utf8')).length)")
    },
    "laboratoryDatabase": {
      "path": "anvisa/v1/laboratoryDatabase.json",
      "size": $(wc -c < laboratoryDatabase.json),
      "count": $(node -e "console.log(JSON.parse(require('fs').readFileSync('laboratoryDatabase.json','utf8')).length)")
    }
  },
  "source": "ANVISA · base interna Dosiq",
  "ttlDays": 7
}
EOF

cat manifest.json
```

Resultado esperado (exemplo):

```json
{
  "version": "1.0.0",
  "generatedAt": "2026-05-14T20:55:00Z",
  "files": {
    "medicineDatabase": {
      "path": "anvisa/v1/medicineDatabase.json",
      "size": 1340397,
      "count": 4521
    },
    "laboratoryDatabase": {
      "path": "anvisa/v1/laboratoryDatabase.json",
      "size": 14378,
      "count": 213
    }
  },
  "source": "ANVISA · base interna Dosiq",
  "ttlDays": 7
}
```

### 3.4 — Upload dos 3 arquivos

Ainda dentro de `dosiq-assets/anvisa/v1/` no dashboard:

1. Clique em **"Upload file"** (botão no canto superior direito)
2. Selecione os 3 arquivos:
   - `manifest.json` (recém-gerado)
   - `medicineDatabase.json`
   - `laboratoryDatabase.json`
3. Aguarde upload (≈ 5-10s para o `medicineDatabase.json`)
4. Confirme que aparecem na listagem

### 3.5 — Validar leitura anônima

Abra cada URL no browser (sem estar logado no Supabase):

```
https://kwqjtdsqkkbebfiaxubb.supabase.co/storage/v1/object/public/dosiq-assets/anvisa/v1/manifest.json
```

Deve retornar o JSON do manifest. Se voltar `403` ou `not found`, o bucket não está público — volte ao 3.1.

```
https://kwqjtdsqkkbebfiaxubb.supabase.co/storage/v1/object/public/dosiq-assets/anvisa/v1/medicineDatabase.json
```

Deve baixar/renderizar 1.34 MB de JSON.

```
https://kwqjtdsqkkbebfiaxubb.supabase.co/storage/v1/object/public/dosiq-assets/anvisa/v1/laboratoryDatabase.json
```

Deve baixar/renderizar 14 KB de JSON.

### 3.6 — (Opcional) Configurar cache CDN

No dashboard do bucket → **"Configuration"** → **"Cache control"**:

- `manifest.json`: cache `max-age=3600` (1h — manifest muda raramente, mas controla invalidação)
- `medicineDatabase.json` / `laboratoryDatabase.json`: cache `max-age=604800, immutable` (7 dias — dados versionados via path `/v1/`, novas versões ficarão em `/v2/`)

> Se preferir não configurar, o default Supabase já é razoável (60s).

---

## 4. Atualizações futuras (versionamento)

Quando atualizar a base ANVISA:

1. Substitua os arquivos em `anvisa/v1/` (mesma versão) → app mobile detecta via `manifest.generatedAt` e re-baixa em background
2. **OU** crie nova pasta `anvisa/v2/` para mudança breaking → bump da constante `ANVISA_VERSION` no código mobile (`useMedicineDatabase.js`) → app mobile reseta cache e baixa do zero

---

## 5. Validação no app mobile (após Sprint P.2 implementada)

Quando o hook `useMedicineDatabase` estiver pronto e a tela `AnvisaSearchScreen` integrada ao `FormAutocomplete`:

1. Build dev client mobile com a Sprint P.2 mergeada
2. No app, ir para tela de cadastro de medicamento → digitar 3+ caracteres no autocomplete
3. Resultados ANVISA devem aparecer
4. Verificar logs no Metro: `[useMedicineDatabase] manifest fetched` + `[useMedicineDatabase] data cached (1.34 MB)`
5. Force-quit + reopen → resultados aparecem instantaneamente (cache local AsyncStorage)

---

## 6. Rollback

Se algo der errado:

- **Bucket criado errado**: Storage → `dosiq-assets` → Delete bucket (perde tudo dentro)
- **Arquivo errado**: Storage → bucket → arquivo → Delete file
- **App mobile cacheou versão errada**: bump `ANVISA_VERSION` no código → próximo build invalida cache

---

## 7. Checklist final

- [x] Bucket `dosiq-assets` criado como **public**
- [x] Pasta `anvisa/v1/` criada
- [x] `manifest.json` gerado localmente e uploaded
- [x] `medicineDatabase.json` (1.34 MB) uploaded
- [x] `laboratoryDatabase.json` (14 KB) uploaded
- [x] 3 URLs públicas retornam conteúdo correto em browser anônimo
- [ ] (Opcional) Cache CDN configurado

Quando todos os ✅ estiverem marcados, avise o time/agente para destravar P2.8 (smoke test E2E).
