// DoseActivityWidget.swift — Spec 039 / F3 (Live Activity UI: Lock Screen + Dynamic Island)
//
// Renderiza a máquina de estados do core (CON-029) fiel aos mocks do designer (A3 expanded + A4 lock).
// Server-free: timer vivo via Text(timerInterval:). Estado discreto recalculado de scheduledAt+now
// (displayState) → re-render por `staleDate` cobre now→late em background sem push (FR-009).
//
// Layout (mock): header [marca/STATE LABEL | timer] · nome 22/19pt · subtítulo "dose · HH:mm" · ações.
// Ações por estado (ruling PO): later="Abrir"; upcoming/now/late=Registrar+Adiar; done=card 3min; missed
// não renderiza (JS encerra). Expanded = botões empilhados; lock = lado-a-lado. Lock discreet (PO-SEC-1,
// crítica) oculta o nome (genérico + horário); DI (desbloqueado) mostra nome cheio.
// Cores = tokens mobile (paridade Android F2); labels do header = mock.

import ActivityKit
import AppIntents
import SwiftUI
import WidgetKit

@available(iOS 16.2, *)
struct DoseActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: DoseActivityAttributes.self) { context in
            LockScreenCard(context: context)
                .padding(14)
                .activityBackgroundTint(Color(red: 0.07, green: 0.10, blue: 0.17).opacity(0.92))
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            let st = displayState(context.state)
            return DynamicIsland {
                // Header = marca (leading) · STATE LABEL (center, escalado) · timer (trailing).
                // O título voltou pro header (decisão PO); center é mais largo que leading e com
                // minimumScaleFactor não trunca como antes truncava no leading estreito.
                // Marca + título JUNTOS no leading: a região .center cai numa faixa ABAIXO do notch
                // (não fica na linha da marca). HStack no leading mantém título colado ao logo.
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 6) {
                        DosiqMarkView(color: stateColor(st)).frame(width: 22, height: 22)
                        Text(headerLabel(st)).font(.headline).fontWeight(.bold)
                            .foregroundColor(stateColor(st)).lineLimit(1)
                    }
                    .padding(.leading, 6)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    timerView(context.state).font(.title3).foregroundColor(.white)
                        .padding(.trailing, 6)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 8) {
                        // DI = contexto desbloqueado → nome cheio (ignora discreet).
                        nameBlock(context.attributes, discreet: false, nameFont: .title3)
                        // Side-by-side (stacked:false) tb no DI: empilhado estourava a altura do
                        // bottom region e o "Adiar" sumia clipado pelo corner inferior da ilha.
                        actionsView(context, state: st, stacked: false)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    // Padding horizontal/bottom: conteúdo encostava nas bordas e era clipado pelo
                    // rounded corner da própria ilha (marca no topo-esq, botão no rodapé).
                    .padding(.horizontal, 4)
                    .padding(.bottom, 4)
                }
            } compactLeading: {
                // Recolhido: marca + label curto de 1 palavra (frase canônica completa não cabe
                // na pílula compact — o sistema trunca). Timer fica no compactTrailing.
                HStack(spacing: 3) {
                    DosiqMarkView(color: stateColor(st)).frame(width: 18, height: 18)
                    Text(headerLabel(st)).font(.caption2).fontWeight(.semibold)
                        .foregroundColor(stateColor(st)).lineLimit(1)
                }
            } compactTrailing: {
                timerView(context.state).frame(maxWidth: 56)
            } minimal: {
                DosiqMarkView(color: stateColor(st)).frame(width: 16, height: 16)
            }
        }
    }
}

// ── Lock Screen card (mock A4) ───────────────────────────────────────────────
@available(iOS 16.2, *)
private struct LockScreenCard: View {
    let context: ActivityViewContext<DoseActivityAttributes>
    var body: some View {
        let st = displayState(context.state)
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                DosiqMarkView(color: stateColor(st)).frame(width: 20, height: 20)
                Text("dosiq").font(.headline).foregroundColor(stateColor(st))
                Spacer(minLength: 8)
                timerView(context.state).font(.headline).fontWeight(.bold).foregroundColor(.white)
            }
            Text(headerLabel(st)).font(.caption).fontWeight(.bold).foregroundColor(stateColor(st)).lineLimit(1)
            nameBlock(context.attributes, discreet: context.attributes.discreet, nameFont: .headline, state: st)
            actionsView(context, state: st, stacked: false)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// ── Bloco nome + subtítulo (ou genérico no discreet) ─────────────────────────
@available(iOS 16.2, *)
@ViewBuilder
private func nameBlock(_ a: DoseActivityAttributes, discreet: Bool, nameFont: Font,
                       state: String = "") -> some View {
    VStack(alignment: .leading, spacing: 2) {
        if discreet {
            Text(genericLabel(state)).font(nameFont).fontWeight(.bold)
                .foregroundColor(.white).lineLimit(1)
            Text(a.scheduledTime).font(.caption).foregroundColor(.white.opacity(0.45))
        } else {
            Text(a.medicineName).font(nameFont).fontWeight(.bold)
                .foregroundColor(.white).lineLimit(1).truncationMode(.tail)
            // Subtítulo = info clínica (dose + horário): tamanho/contraste maiores que caption
            // (~14pt, opacity 0.85) — define o que o paciente toma, não pode ficar apagado.
            Text(subtitle(a)).font(.system(size: 14)).foregroundColor(.white.opacity(0.85)).lineLimit(1)
        }
    }
}

// Subtítulo "dose · HH:mm" (ex.: "10 UI (≈ 0,1 ml) · 19:00").
private func subtitle(_ a: DoseActivityAttributes) -> String {
    if a.doseLabel.isEmpty { return a.scheduledTime }
    if a.scheduledTime.isEmpty { return a.doseLabel }
    return "\(a.doseLabel) · \(a.scheduledTime)"
}

// ── Ações por estado (ruling PO) ─────────────────────────────────────────────
// later → "Abrir"; upcoming/now/late → Registrar+Adiar; done → card de confirmação; missed → nada.
@available(iOS 16.2, *)
@ViewBuilder
private func actionsView(_ context: ActivityViewContext<DoseActivityAttributes>,
                         state st: String, stacked: Bool) -> some View {
    let a = context.attributes
    if st == "done" {
        doneCard(context.state.doneAtLabel, color: stateColor("done"))
    } else if #available(iOS 17.0, *) {
        if st == "later" {
            openButton(a)
        } else if st == "upcoming" || st == "now" || st == "late" {
            let buttons = AnyView(HStack(spacing: 8) { registerButton(a, color: stateColor(st)); snoozeButton(a) })
            let stackedButtons = AnyView(VStack(spacing: 8) { registerButton(a, color: stateColor(st)); snoozeButton(a) })
            if stacked { stackedButtons } else { buttons }
        }
    }
    // iOS < 17: sem botões interativos (fallback — alarme/notif cobrem a ação).
}

@available(iOS 17.0, *)
private func registerButton(_ a: DoseActivityAttributes, color: Color) -> some View {
    Button(intent: DoseRegisterIntent(instanceId: a.instanceId, treatmentId: a.treatmentId)) {
        Text("Tomar").font(.subheadline).fontWeight(.semibold).foregroundColor(.black)
            .frame(maxWidth: .infinity, minHeight: 44).background(color).cornerRadius(12)
    }.buttonStyle(.plain)
}

@available(iOS 17.0, *)
private func snoozeButton(_ a: DoseActivityAttributes) -> some View {
    Button(intent: DoseSnoozeIntent(instanceId: a.instanceId)) {
        Text("Adiar").font(.subheadline).fontWeight(.medium).foregroundColor(.white.opacity(0.8))
            .frame(maxWidth: .infinity, minHeight: 44).background(Color.white.opacity(0.13)).cornerRadius(12)
    }.buttonStyle(.plain)
}

@available(iOS 17.0, *)
private func openButton(_ a: DoseActivityAttributes) -> some View {
    Button(intent: DoseOpenIntent(instanceId: a.instanceId)) {
        Text("Abrir").font(.subheadline).fontWeight(.medium).foregroundColor(.white.opacity(0.6))
            .frame(maxWidth: .infinity, minHeight: 44).background(Color.white.opacity(0.10)).cornerRadius(12)
    }.buttonStyle(.plain)
}

// Card de confirmação `done` (mock): "✓ Tomada às HH:mm" + "Encerra em breve" (JS encerra em ~3min).
@available(iOS 16.2, *)
private func doneCard(_ doneAtLabel: String, color: Color) -> some View {
    VStack(spacing: 6) {
        HStack(spacing: 6) {
            Image(systemName: "checkmark").font(.caption).foregroundColor(color)
            Text(doneAtLabel.isEmpty ? "Tomada ✓" : "Tomada às \(doneAtLabel)")
                .font(.caption).foregroundColor(.white.opacity(0.7))
        }
        .padding(.horizontal, 16).padding(.vertical, 6)
        .background(color.opacity(0.18)).cornerRadius(20)
        Text("Encerra em breve").font(.caption2).foregroundColor(.white.opacity(0.3))
    }
    .frame(maxWidth: .infinity)
}

// ── Estado / labels / timer ──────────────────────────────────────────────────

// Estado visual derivado de scheduledAt + agora (SURFACE_WINDOWS do core: later 60..240 · upcoming
// 10..60 · now ±10 · late < -10). `done` vem do campo (registro). `missed` não chega aqui (JS encerra).
private func displayState(_ s: DoseActivityAttributes.ContentState, now: Date = Date()) -> String {
    if s.state == "done" || s.state == "missed" { return s.state }
    let d = s.scheduledAt.timeIntervalSince(now) / 60.0
    if d >= 60 { return "later" }
    if d >= 10 { return "upcoming" }
    if d >= -10 { return "now" }
    return "late"
}

// Label do header — CANÔNICO F2 (doseActivitySurfaceService STATE_BODY; superfície é critical-only).
// Mock divergiu; F2 vence (decisão PO). later e upcoming diferem (mock só tinha um estado precoce).
private func headerLabel(_ st: String) -> String {
    switch st {
    case "later":    return "Próxima"
    case "upcoming": return "Em breve"
    case "now":      return "Na hora"
    case "late":     return "Atrasada"
    case "done":     return "Tomada ✓"
    default:         return ""
    }
}

// Label genérico do modo discreet (lock screen, sem nome do remédio — PO-SEC-1).
private func genericLabel(_ st: String) -> String {
    switch st {
    case "later", "upcoming": return "Próxima dose"
    case "now":               return "Hora da dose"
    case "late":              return "Dose pendente"
    case "done":              return "Dose registrada"
    default:                  return "Dose"
    }
}

// CL-3: count-up só nas 1ªs ~2h de atraso; acima → rótulo de dias (semanal/GLP-1).
private let LATE_CHRONO_CAP_MINUTES: Double = 120

private func daysAgoLabel(_ scheduledAt: Date, _ now: Date) -> String {
    let cal = Calendar.current
    let days = cal.dateComponents([.day], from: cal.startOfDay(for: scheduledAt),
                                  to: cal.startOfDay(for: now)).day ?? 0
    if days <= 0 { return "atrasada" }
    return days == 1 ? "ontem" : "há \(days) dias"
}

// Timer (paridade F2): upcoming/now regressivo enquanto falta tempo, depois "agora"; late progressivo
// até o cap CL-3, acima vira rótulo de dias. later/done sem timer. accessibilityLabel p/ VoiceOver
// (Text(timerInterval:) não é lido — post-it do mock).
@available(iOS 16.2, *)
@ViewBuilder
private func timerView(_ s: DoseActivityAttributes.ContentState) -> some View {
    let st = displayState(s)
    let now = Date()
    if st == "upcoming" || st == "now" {
        if s.scheduledAt > now {
            Text(timerInterval: now...s.scheduledAt, countsDown: true)
                .monospacedDigit().lineLimit(1)
                .accessibilityLabel(timerA11y(st, s.scheduledAt, now))
        } else {
            Text("agora").lineLimit(1).accessibilityLabel("hora da dose")
        }
    } else if st == "late" {
        let elapsedMin = now.timeIntervalSince(s.scheduledAt) / 60.0
        if elapsedMin <= LATE_CHRONO_CAP_MINUTES {
            Text(timerInterval: s.scheduledAt...s.scheduledAt.addingTimeInterval(LATE_CHRONO_CAP_MINUTES * 60),
                 countsDown: false)
                .monospacedDigit().lineLimit(1)
                .accessibilityLabel(timerA11y(st, s.scheduledAt, now))
        } else {
            Text(daysAgoLabel(s.scheduledAt, now)).lineLimit(1)
                .accessibilityLabel("dose \(daysAgoLabel(s.scheduledAt, now))")
        }
    } else {
        EmptyView()
    }
}

// Rótulo VoiceOver do timer (visual não é lido): "faltam N minutos" / "N minutos atrasada".
private func timerA11y(_ st: String, _ scheduledAt: Date, _ now: Date) -> String {
    let min = Int(abs(scheduledAt.timeIntervalSince(now)) / 60.0)
    if st == "late" { return "\(min) minutos atrasada" }
    return "faltam \(min) minutos"
}

// Hex espelha tokens.js: later neutral400 #8e9199 · upcoming primary200 #99f6e4 · now primary500
// #14b8a6 · late warningBright #F59E0B (9.82:1 c/ preto; iOS LA/DI = fundo escuro) · done successDark #166534 · missed error #ba1a1a.
private func stateColor(_ state: String) -> Color {
    switch state {
    case "later":    return Color(red: 0.557, green: 0.569, blue: 0.600)
    case "upcoming": return Color(red: 0.600, green: 0.965, blue: 0.894)
    case "now":      return Color(red: 0.078, green: 0.722, blue: 0.651)
    case "late":     return Color(red: 0.961, green: 0.620, blue: 0.043) // #F59E0B warningBright — 9.82:1 c/ preto
    case "done":     return Color(red: 0.086, green: 0.396, blue: 0.204)
    case "missed":   return Color(red: 0.729, green: 0.102, blue: 0.102)
    default:         return .secondary
    }
}

@main
struct DoseActivityWidgetBundle: WidgetBundle {
    var body: some Widget {
        if #available(iOS 16.2, *) {
            DoseActivityWidget()
        }
    }
}
