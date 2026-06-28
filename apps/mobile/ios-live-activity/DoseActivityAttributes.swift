// DoseActivityAttributes.swift — Spec 039 / F0 spike iOS
//
// Contrato de dados da Live Activity. DEVE ser compartilhado entre o target do APP
// (que chama Activity.request/.end) e o target do WIDGET (que renderiza). Adicione
// este arquivo a AMBOS os targets no Xcode (Target Membership).
//
// Server-free: o estado dinâmico carrega só o necessário; o tempo restante é
// renderizado via Text(timerInterval:) (conta sozinho, sem update remoto).

import ActivityKit
import Foundation

struct DoseActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        // Estado da máquina (espelha DoseActivityState do core): "upcoming"|"now"|"late"|"done"|"missed"
        var state: String
        // Instante-alvo da dose (timer vivo conta relativo a ele).
        var scheduledAt: Date
        // Rótulo curto do estado (PT) — ex.: "Próxima dose", "Hora da dose", "Atrasada".
        var stateLabel: String
    }

    // Estático durante a vida da Activity.
    var medicineLabel: String
    var instanceId: String
}
