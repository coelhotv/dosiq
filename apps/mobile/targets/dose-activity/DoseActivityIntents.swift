// DoseActivityIntents.swift — Spec 039 / F3 (App Intents da Live Activity, iOS 17+)
//
// Botões "Registrar" e "Adiar" na ilha/lock screen. LiveActivityIntent roda no processo do APP
// quando ele está vivo; senão num contexto de extensão. Em NENHUM caso confiamos em sessão aqui:
// o intent só ENFILEIRA o pedido no App Group (PO-SEC-2) — quem registra de fato é o RN, que
// revalida a sessão VIVA antes de chamar CON-026. "Registrar" NÃO grava silencioso: abre a modal
// bulk (sítio do injetável só é selecionável lá), igual ao Android (CON-030 / handleAlarmAction).
//
// Darwin notification ("com.coelhotv.dosiq.doseActivityAction") acorda o RN se estiver em foreground;
// se morto, o RN drena a fila do App Group no próximo cold start/foreground.

import AppIntents
import Foundation

#if canImport(ActivityKit)
import ActivityKit
#endif

@available(iOS 17.0, *)
struct DoseRegisterIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Registrar dose"
    static var description = IntentDescription("Abre o app para registrar a dose.")
    // Traz o app ao foreground: o registro real (com escolha de sítio do injetável) é na modal.
    static var openAppWhenRun: Bool = true

    @Parameter(title: "instanceId") var instanceId: String
    @Parameter(title: "treatmentId") var treatmentId: String

    init() {}
    init(instanceId: String, treatmentId: String) {
        self.instanceId = instanceId
        self.treatmentId = treatmentId
    }

    func perform() async throws -> some IntentResult {
        DoseActivityActionQueue.enqueue(action: "register", instanceId: instanceId, treatmentId: treatmentId)
        return .result()
    }
}

@available(iOS 17.0, *)
struct DoseSnoozeIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Adiar dose"
    static var description = IntentDescription("Adia o lembrete da dose por alguns minutos.")
    // openAppWhenRun=true (smoke F3): diferente do Android (notifee reagenda nativo em background),
    // o iOS NÃO roda JS em background e não temos observer Darwin → com false o RN só drenava o
    // snooze no próximo foreground (soneca não acontecia). Trazer o app à frente é o único caminho
    // server-free p/ o `scheduleSnooze` (JS) rodar. Limitação aceita do MVP (ver CON-030).
    static var openAppWhenRun: Bool = true

    @Parameter(title: "instanceId") var instanceId: String

    init() {}
    init(instanceId: String) { self.instanceId = instanceId }

    func perform() async throws -> some IntentResult {
        DoseActivityActionQueue.enqueue(action: "snooze", instanceId: instanceId, treatmentId: "")
        return .result()
    }
}

// "Abrir" — só em `later` (dose fora da janela ±2h, sem ação de registro ainda). Abre o app; o RN
// drena a fila e navega p/ Hoje. NÃO registra nada.
@available(iOS 17.0, *)
struct DoseOpenIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Abrir"
    static var description = IntentDescription("Abre o app na tela de hoje.")
    static var openAppWhenRun: Bool = true

    @Parameter(title: "instanceId") var instanceId: String

    init() {}
    init(instanceId: String) { self.instanceId = instanceId }

    func perform() async throws -> some IntentResult {
        DoseActivityActionQueue.enqueue(action: "open", instanceId: instanceId, treatmentId: "")
        return .result()
    }
}

// Fila persistida no App Group (drenada pelo RN). Append-only p/ não perder ações concorrentes.
enum DoseActivityActionQueue {
    static func enqueue(action: String, instanceId: String, treatmentId: String) {
        guard let defaults = UserDefaults(suiteName: DoseActivityAppGroup.suite) else { return }
        var queue = defaults.array(forKey: DoseActivityAppGroup.pendingActionKey) as? [[String: Any]] ?? []
        queue.append([
            "action": action,
            "instanceId": instanceId,
            "treatmentId": treatmentId,
            "ts": Date().timeIntervalSince1970 * 1000,
        ])
        defaults.set(queue, forKey: DoseActivityAppGroup.pendingActionKey)
        // Acorda o RN se vivo (CFNotificationCenter Darwin — cross-process).
        let name = "com.coelhotv.dosiq.doseActivityAction" as CFString
        CFNotificationCenterPostNotification(
            CFNotificationCenterGetDarwinNotifyCenter(),
            CFNotificationName(name), nil, nil, true
        )
    }
}
