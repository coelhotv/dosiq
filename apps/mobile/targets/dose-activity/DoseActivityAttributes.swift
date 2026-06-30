// DoseActivityAttributes.swift — Spec 039 / F3 (iOS Live Activity)
//
// Contrato de dados da Live Activity. COMPARTILHADO entre o target do APP (Activity.request/.update/
// .end via DoseActivityBridge) e o target do WIDGET (render). É o ÚNICO arquivo que precisa de
// dupla membership — ActivityKit casa por TIPO, então as duas builds têm de compilar a MESMA struct.
// Injetado no app por withDoseActivityBridge.js (este vive no target do widget via expo-target).
//
// Server-free: o tempo restante é renderizado por Text(timerInterval:) (conta sozinho, sem push).
// Espelha DOSE_ACTIVITY_STATES do core (CON-029): later|upcoming|now|late|done|missed.

import ActivityKit
import Foundation

struct DoseActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var state: String        // later|upcoming|now|late|done (missed → JS encerra, não renderiza)
        var scheduledAt: Date    // instante-alvo da dose (timer vivo conta relativo a ele)
        var doneAtLabel: String  // "19:02" — só no `done` (card de confirmação); "" caso contrário
    }

    var medicineName: String     // SÓ o nome (ex.: "Lantus") — mock separa nome do subtítulo de dose
    var doseLabel: String        // dose formatada (ex.: "10 UI (≈ 0,1 ml)") — formatDoseItem / R-272
    var scheduledTime: String    // HH:mm agendado (subtítulo "dose · HH:mm")
    var discreet: Bool           // lock screen oculta o nome (PO-SEC-1/LGPD; true p/ crítica). DI = nome cheio
    var instanceId: String       // doseInstanceId — chave do App Intent (Registrar/Adiar/Abrir)
    var treatmentId: String      // p/ deeplink bulk-plan (sítio do injetável só na modal)
    var groupSize: Int           // CON-029: doses agrupadas por treatment_plan (>1 → "e mais N")
}

// Chaves do App Group compartilhadas app↔widget (App Intent escreve, RN lê).
enum DoseActivityAppGroup {
    static let suite = "group.com.coelhotv.dosiq"
    static let pendingActionKey = "doseActivity.pendingAction" // JSON: {instanceId, action, treatmentId, ts}
}
