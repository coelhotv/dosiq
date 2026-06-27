# Spike iOS — Live Activity (Spec 039 / F0 · PO-0.1)

Prova de feasibility: Live Activity com **timer vivo** na Dynamic Island + Lock Screen,
**sem APNs** (server-free). Kit de spike — wiring manual no Xcode (com Mac+Xcode no loop;
automatizar criação de target via .pbxproj é frágil demais p/ spike descartável).

## Arquivos deste kit

| Arquivo | Target |
|---|---|
| `DoseActivityAttributes.swift` | **APP + WIDGET** (struct compartilhada) |
| `DoseLiveActivityWidget.swift` | **WIDGET** (UI da LA: Lock + Dynamic Island) |
| `DoseActivityBundle.swift` | **WIDGET** (@main do bundle) |
| `DoseActivityBridge.swift` | **APP** (bridge RN start/end via ActivityKit) |
| `DoseActivityBridge.m` | **APP** (expõe o bridge ao RN) |

JS: `src/features/_dev/devDoseActivitySpikeIOS.js` → DevHub (seção "Live Activity iOS").
Config plugin `withDoseLiveActivity.js` já injeta `NSSupportsLiveActivities` no Info.plist do app.

## Passos (após `npx expo prebuild -p ios` / `eas build --local`)

1. **Abrir** `ios/Dosiq.xcworkspace` no Xcode.
2. **File ▸ New ▸ Target… ▸ Widget Extension** → nome `DoseActivityWidget`.
   - DESMARCAR "Include Configuration App Intent" (spike é display-only).
   - Marcar "Include Live Activity".
   - Embed no app target.
3. **Remover** os .swift template gerados pelo Xcode no novo target (ficaremos com os nossos).
4. **Arrastar** para o Xcode os 5 arquivos deste diretório, definindo Target Membership:
   - `DoseActivityAttributes.swift` → ✅ Dosiq (app) **e** ✅ DoseActivityWidget.
   - `DoseLiveActivityWidget.swift`, `DoseActivityBundle.swift` → ✅ só DoseActivityWidget.
   - `DoseActivityBridge.swift`, `DoseActivityBridge.m` → ✅ só Dosiq (app).
5. **Deployment target** do widget ≥ iOS 16.2.
6. **Build & Run** no device físico (não simulador p/ Dynamic Island; simulador 16.2+ serve p/ Lock Screen).
7. No app: **Dev ▸ Spec 039 — Live Activity iOS ▸ "HORA — countdown na ilha (60s)"**.
   - Esperado: pílula na Dynamic Island com timer regredindo; segurar a ilha → expanded;
     bloquear a tela → card na Lock Screen com timer correndo. **Nenhuma chamada de rede.**
8. **Gravar vídeo** (ilha minimal/compact/expanded + Lock Screen contando) → evidência PO-0.1.

## Notas
- iOS 17+ só será exigido no MVP (botões interativos via App Intent). O spike é display-only.
- App Group não é necessário no spike (display-only); entra no MVP (handler escreve registro — PO-SEC-2).
- Se `DoseActivityBridge` aparecer "não linkado" no console: o `.m` não está no target do app, ou
  faltou o bridging header automático (Xcode pergunta ao adicionar Swift ao app — aceitar).
