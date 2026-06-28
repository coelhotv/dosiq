// DoseActivityBundle.swift — Spec 039 / F0 spike iOS
//
// Entry point (@main) do Widget Extension. Adicione SÓ ao target do WIDGET.
// Se o target já tiver outro @main gerado pelo template do Xcode, remova o duplicado.

import SwiftUI
import WidgetKit

@main
struct DoseActivityBundle: WidgetBundle {
    var body: some Widget {
        if #available(iOS 16.2, *) {
            DoseLiveActivityWidget()
        }
    }
}
