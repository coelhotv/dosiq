// DoseActivityBridge.swift — Spec 039 / F3 (módulo nativo do APP p/ a Live Activity)
//
// Vive no target do APP (injetado por withDoseActivityBridge.js). Inicia/atualiza/encerra a Live
// Activity a partir do JS (liveActivityService). Server-free: Activity.request + .update com timer
// vivo (Text(timerInterval:)); .end encerra (cancel-on-resolve, AP-235 / PO-3.2). Requer a struct
// DoseActivityAttributes COMPARTILHADA (mesmo arquivo, dupla membership — ver expo-target.config.js).
//
// Também expõe drainPendingActions: drena a fila do App Group (App Intent Registrar/Adiar) p/ o RN
// processar com sessão VIVA (PO-SEC-2). O JS escuta a Darwin notification + drena no foreground.

import ActivityKit
import Foundation
import React

@objc(DoseActivityBridge)
class DoseActivityBridge: NSObject {

    @objc static func requiresMainQueueSetup() -> Bool { return false }

    override init() {
        super.init()
        // Spec 041 — inicia o observer de push-to-start o mais cedo possível (na criação da bridge),
        // não só na primeira chamada do getter. Evita corrida na 1ª inicialização: o token já está
        // sendo observado/persistido quando o JS chama getPushToStartToken (mount/foreground).
        if #available(iOS 17.2, *) {
            DoseActivityBridge.startPushToStartObserver()
        }
    }

    private func buildState(_ p: NSDictionary) -> (DoseActivityAttributes.ContentState) {
        let state = p["state"] as? String ?? "upcoming"
        let doneAtLabel = p["doneAtLabel"] as? String ?? ""
        let ms = p["scheduledAtMs"] as? Double ?? (Date().timeIntervalSince1970 * 1000)
        return DoseActivityAttributes.ContentState(
            state: state, scheduledAt: Date(timeIntervalSince1970: ms / 1000), doneAtLabel: doneAtLabel
        )
    }

    @available(iOS 16.2, *)
    private func buildAttributes(_ p: NSDictionary) -> DoseActivityAttributes {
        DoseActivityAttributes(
            medicineName: p["medicineName"] as? String ?? "Dose",
            doseLabel: p["doseLabel"] as? String ?? "",
            scheduledTime: p["scheduledTime"] as? String ?? "",
            discreet: p["discreet"] as? Bool ?? false,
            instanceId: p["instanceId"] as? String ?? "",
            treatmentId: p["treatmentId"] as? String ?? "",
            groupSize: p["groupSize"] as? Int ?? 1
        )
    }

    // `staleDate` = próximo boundary de estado (vindo do JS, doseActivityBoundaryTimes). Quando passa,
    // o sistema re-renderiza a Live Activity em background → o widget recalcula o estado (ex.: now→late)
    // SEM push (server-free). Fallback +1h se o JS não mandar (ex.: estado terminal). Multi-hop em
    // background profundo exigiria APNs — FORA do escopo server-free da 039 (FR-009), spec futura.
    @available(iOS 16.2, *)
    private func staleDate(_ p: NSDictionary, _ state: DoseActivityAttributes.ContentState) -> Date {
        if let staleMs = p["staleDateMs"] as? Double {
            return Date(timeIntervalSince1970: staleMs / 1000)
        }
        return state.scheduledAt.addingTimeInterval(3600)
    }

    // Inicia (ou substitui) a Live Activity. 1 superfície ativa por vez (paridade Android :surface).
    // params: { medicineLabel, instanceId, treatmentId, groupSize, state, scheduledAtMs, stateLabel }
    @objc(start:resolver:rejecter:)
    func start(_ params: NSDictionary,
               resolver resolve: @escaping RCTPromiseResolveBlock,
               rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard #available(iOS 16.2, *) else { reject("unsupported", "Live Activities exigem iOS 16.2+", nil); return }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            reject("disabled", "Live Activities desabilitadas nos Ajustes", nil); return
        }
        let attributes = buildAttributes(params)
        let contentState = buildState(params)
        let instanceId = params["instanceId"] as? String ?? ""
        Task {
            for activity in Activity<DoseActivityAttributes>.activities {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
            do {
                // Spec 041 fix-up: pushType .token → o SO emite um token PER-ACTIVITY em
                // `activity.pushTokenUpdates`. O backend usa esse token p/ push de update/end
                // (transição de estado + encerramento com app fechado). Sem ele a LA só teria o
                // start-only da Fase 1. iOS 17.2+ p/ o observer; <17.2 cai no start server-free (staleDate).
                let content = ActivityContent(state: contentState, staleDate: staleDate(params, contentState))
                let activity: Activity<DoseActivityAttributes>
                if #available(iOS 17.2, *) {
                    activity = try Activity.request(attributes: attributes, content: content, pushType: .token)
                    DoseActivityBridge.observeActivityPushToken(activity, instanceId: instanceId)
                } else {
                    activity = try Activity.request(attributes: attributes, content: content, pushType: nil)
                }
                resolve(activity.id)
            } catch {
                reject("request_failed", error.localizedDescription, error)
            }
        }
    }

    // Spec 041 fix-up — observa o token push PER-ACTIVITY e persiste (hex) no App Group por instanceId.
    // O RN lê via getActivityPushToken e grava em dose_instances.la_push_token (sessão viva). @private
    @available(iOS 17.2, *)
    private static func observeActivityPushToken(_ activity: Activity<DoseActivityAttributes>, instanceId: String) {
        guard !instanceId.isEmpty else { return }
        Task {
            for await tokenData in activity.pushTokenUpdates {
                let hex = tokenData.map { String(format: "%02x", $0) }.joined()
                UserDefaults(suiteName: DoseActivityAppGroup.suite)?.set(hex, forKey: "activityPushToken:\(instanceId)")
            }
        }
    }

    // Retorna o token push per-Activity persistido p/ um instanceId (ou '' se ainda não emitido).
    @objc(getActivityPushToken:resolver:rejecter:)
    func getActivityPushToken(_ instanceId: String,
                              resolver resolve: @escaping RCTPromiseResolveBlock,
                              rejecter reject: @escaping RCTPromiseRejectBlock) {
        let token = UserDefaults(suiteName: DoseActivityAppGroup.suite)?.string(forKey: "activityPushToken:\(instanceId)")
        resolve(token ?? "")
    }

    // Atualiza o estado da Activity ativa SEM recriar (transição de estado sem flicker).
    // params: { state, scheduledAtMs, doneAtLabel }
    @objc(update:resolver:rejecter:)
    func update(_ params: NSDictionary,
                resolver resolve: @escaping RCTPromiseResolveBlock,
                rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard #available(iOS 16.2, *) else { resolve(nil); return }
        let contentState = buildState(params)
        Task {
            for activity in Activity<DoseActivityAttributes>.activities {
                await activity.update(
                    ActivityContent(state: contentState, staleDate: staleDate(params, contentState))
                )
            }
            resolve(nil)
        }
    }

    // Card de confirmação `done` (mock): mostra "Tomada às HH:mm · Encerra em breve" por ~3min e
    // encerra sozinho via dismissalPolicy .after (server-free, paridade showDoseDone Android).
    // params: { state:"done", doneAtLabel, scheduledAtMs }
    @objc(done:resolver:rejecter:)
    func done(_ params: NSDictionary,
              resolver resolve: @escaping RCTPromiseResolveBlock,
              rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard #available(iOS 16.2, *) else { resolve(nil); return }
        let contentState = buildState(params)
        Task {
            for activity in Activity<DoseActivityAttributes>.activities {
                await activity.end(ActivityContent(state: contentState, staleDate: nil),
                                   dismissalPolicy: .after(Date().addingTimeInterval(180)))
            }
            resolve(nil)
        }
    }

    // Encerra todas as Activities (cancel-on-resolve / PO-3.2).
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

    // Drena a fila de ações do App Intent (App Group) e limpa. RN processa com sessão VIVA (PO-SEC-2).
    @objc(drainPendingActions:rejecter:)
    func drainPendingActions(_ resolve: @escaping RCTPromiseResolveBlock,
                             rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let defaults = UserDefaults(suiteName: DoseActivityAppGroup.suite) else { resolve([]); return }
        let queue = defaults.array(forKey: DoseActivityAppGroup.pendingActionKey) ?? []
        defaults.removeObject(forKey: DoseActivityAppGroup.pendingActionKey)
        resolve(queue)
    }

    // Spec 041 — push-to-start (ActivityKit, iOS 17.2+). O SO gera um token por-device via a
    // sequência estática `pushToStartTokenUpdates`; o backend (server/notifications/apns) o usa p/
    // iniciar a LA com o app fechado. Observer idempotente persiste o último token no App Group;
    // o getter retorna o persistido (o RN registra no backend com sessão VIVA — PO-SEC-2).
    private static let pushToStartKey = "pushToStartToken"
    private static var pushToStartObserverStarted = false

    @available(iOS 17.2, *)
    private static func startPushToStartObserver() {
        if pushToStartObserverStarted { return }
        pushToStartObserverStarted = true
        Task {
            for await tokenData in Activity<DoseActivityAttributes>.pushToStartTokenUpdates {
                let hex = tokenData.map { String(format: "%02x", $0) }.joined()
                UserDefaults(suiteName: DoseActivityAppGroup.suite)?.set(hex, forKey: pushToStartKey)
            }
        }
    }

    @objc(getPushToStartToken:rejecter:)
    func getPushToStartToken(_ resolve: @escaping RCTPromiseResolveBlock,
                             rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard #available(iOS 17.2, *) else { resolve(""); return }
        DoseActivityBridge.startPushToStartObserver()
        let token = UserDefaults(suiteName: DoseActivityAppGroup.suite)?.string(forKey: DoseActivityBridge.pushToStartKey)
        resolve(token ?? "")
    }
}
