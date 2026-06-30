// withDoseActivityBridge.js — config plugin (Spec 039 / F3)
//
// O @bacons/apple-targets cuida do target do WIDGET (targets/dose-activity/). Este plugin cuida do
// lado do APP: injeta no target principal os fontes nativos do bridge RN (DoseActivityBridge.swift/.m)
// + a struct COMPARTILHADA DoseActivityAttributes.swift (ActivityKit casa por tipo → app e widget
// PRECISAM compilar a MESMA struct). Sem isto, os fontes em ios-native/ se perderiam no
// `expo prebuild --clean` (ios/ é efêmero). RE-001: app.config.js é canônico; registrado em plugins.
//
// Estratégia: withDangerousMod copia os 3 arquivos p/ ios/<SUBDIR>/; withXcodeProject os adiciona ao
// build do target do app, anexando ao **mainGroup** (sem path) e referenciando por `<SUBDIR>/<nome>`
// relativo à raiz do projeto (ios/). NÃO criar grupo com path próprio — isso dobra o caminho
// (ios/DoseActivity/DoseActivity/…, BUILD FAILED). SUBDIR distinto do nome do widget ("DoseActivity")
// p/ não colidir com a pasta do target gerado pelo apple-targets.
//
// ⚠️ AP-250: a cópia app-side só atualiza no PREBUILD (withDangerousMod); o widget pega `targets/`
// via synchronized folder (sempre fresco). Editar DoseActivityAttributes/Bridge + `expo run:ios`
// incremental (sem prebuild) deixa o app-side STALE → split-brain de ABI → Live Activity SOME em
// runtime (compila sem erro). Ao mexer nesses arquivos: clean prebuild (`rm -rf ios`) antes de buildar.

const { withXcodeProject, withDangerousMod } = require('@expo/config-plugins')
const fs = require('fs')
const path = require('path')

const SUBDIR = 'DoseActivityRN' // distinto do target widget "DoseActivity"

const APP_SOURCES = [
  { from: 'ios-native/DoseActivityBridge.swift', name: 'DoseActivityBridge.swift' },
  { from: 'ios-native/DoseActivityBridge.m', name: 'DoseActivityBridge.m' },
  // Struct compartilhada — fonte única no target do widget, copiada também p/ o app.
  { from: 'targets/dose-activity/DoseActivityAttributes.swift', name: 'DoseActivityAttributes.swift' },
  // App Intents (Registrar/Adiar/Abrir) — dupla membership OBRIGATÓRIA: LiveActivityIntent roda no
  // PROCESSO DO APP (doc Apple), então o tipo precisa existir no binário do app, não só no widget.
  // Sem isto o toque no botão da ilha/lock NÃO faz nada (app nem abre) — o sistema não acha o intent
  // p/ executar in-process. O widget (synchronized folder) usa sua própria cópia p/ montar o payload.
  { from: 'targets/dose-activity/DoseActivityIntents.swift', name: 'DoseActivityIntents.swift' },
]

function withCopySources(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot
      const destDir = path.join(cfg.modRequest.platformProjectRoot, SUBDIR) // ios/DoseActivityRN
      fs.mkdirSync(destDir, { recursive: true })
      for (const src of APP_SOURCES) {
        fs.copyFileSync(path.join(projectRoot, src.from), path.join(destDir, src.name))
      }
      return cfg
    },
  ])
}

function withAddToTarget(config) {
  return withXcodeProject(config, (cfg) => {
    const project = cfg.modResults
    const target = project.getFirstTarget().uuid
    const mainGroup = project.getFirstProject().firstProject.mainGroup // grupo da raiz (ios/), sem path
    for (const src of APP_SOURCES) {
      const rel = `${SUBDIR}/${src.name}` // relativo à raiz do projeto; sem grupo-com-path (evita doubling)
      const already = (project.pbxSourcesBuildPhaseObj(target)?.files || []).some((f) =>
        (f.comment || '').includes(src.name)
      )
      if (already) continue
      project.addSourceFile(rel, { target }, mainGroup)
    }
    return cfg
  })
}

module.exports = function withDoseActivityBridge(config) {
  config = withCopySources(config)
  config = withAddToTarget(config)
  return config
}
