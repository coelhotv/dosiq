// DoseActivityBundle.swift — Spec 039 / F0 spike iOS (referência, NÃO é entry point)
//
// F2 (Fix 2026-06-28): o entry point @main do Widget Extension passou a ser o bundle
// gerado pelo Xcode (DoseActivityWidget/DoseActivityWidgetBundle.swift). Swift só aceita
// UM @main por módulo, então este bundle do spike F0 NÃO pode ter @main enquanto estiver
// no mesmo target — vira referência morta até a F3 (iOS Live Activity) ligar o widget real.
//
// Para reativar na F3: remover o bundle boilerplate do Xcode e marcar este como @main
// (ou consolidar DoseLiveActivityWidget no bundle do Xcode).

import SwiftUI
import WidgetKit

// @main desativado (F2) — ver cabeçalho. Colisão de @main quebrava o build do simulador iOS.
struct DoseActivityBundle: WidgetBundle {
    var body: some Widget {
        if #available(iOS 16.2, *) {
            DoseLiveActivityWidget()
        }
    }
}
