// DoseActivityBridge.swift — Spec 039 / F0 spike iOS
//
// Bridge RN p/ iniciar/atualizar/encerrar a Live Activity a partir do JS.
// Adicione ESTE arquivo ao target do APP (não do widget). Requer também
// DoseActivityAttributes.swift no target do APP (struct compartilhada).
//
// Server-free: Activity.request com staleDate; o timer é vivo (Text(timerInterval:)),
// não precisa de update remoto. .end() encerra (cancel-on-resolve, AP-235).

import ActivityKit
import Foundation
import React

@objc(DoseActivityBridge)
class DoseActivityBridge: NSObject {

    @objc static func requiresMainQueueSetup() -> Bool { return false }

    // Inicia (ou substitui) a Live Activity do spike.
    // params: { medicineLabel, instanceId, state, scheduledAtMs, stateLabel }
    @objc(start:resolver:rejecter:)
    func start(_ params: NSDictionary,
               resolver resolve: @escaping RCTPromiseResolveBlock,
               rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard #available(iOS 16.2, *) else {
            reject("unsupported", "Live Activities exigem iOS 16.2+", nil); return
        }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            reject("disabled", "Live Activities desabilitadas nos Ajustes", nil); return
        }
        let medicineLabel = params["medicineLabel"] as? String ?? "Dose"
        let instanceId = params["instanceId"] as? String ?? "spike"
        let state = params["state"] as? String ?? "upcoming"
        let stateLabel = params["stateLabel"] as? String ?? "Próxima dose"
        let scheduledAtMs = params["scheduledAtMs"] as? Double ?? (Date().timeIntervalSince1970 * 1000)
        let scheduledAt = Date(timeIntervalSince1970: scheduledAtMs / 1000)

        let attributes = DoseActivityAttributes(medicineLabel: medicineLabel, instanceId: instanceId)
        let contentState = DoseActivityAttributes.ContentState(
            state: state, scheduledAt: scheduledAt, stateLabel: stateLabel
        )

        // Encerra qualquer Activity anterior do spike (1 superfície ativa) e SÓ
        // ENTÃO solicita a nova — tudo dentro da mesma Task com await, p/ evitar
        // race: request concorrente com o end() poderia encerrar a recém-criada.
        Task {
            for activity in Activity<DoseActivityAttributes>.activities {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
            do {
                let content = ActivityContent(state: contentState, staleDate: scheduledAt.addingTimeInterval(3600))
                let activity = try Activity.request(attributes: attributes, content: content, pushType: nil)
                resolve(activity.id)
            } catch {
                reject("request_failed", error.localizedDescription, error)
            }
        }
    }

    // Encerra todas as Activities do spike (cancel-on-resolve).
    @objc(end:rejecter:)
    func end(_ resolve: @escaping RCTPromiseResolveBlock,
             rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard #available(iOS 16.2, *) else { resolve(nil); return }
        Task {
            for activity in Activity<DoseActivityAttributes>.activities {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
            resolve(nil)
        }
    }
}
