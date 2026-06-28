// DoseLiveActivityWidget.swift — Spec 039 / F0 spike iOS
//
// UI da Live Activity: Lock Screen + Dynamic Island (minimal/compact/expanded).
// Adicione ESTE arquivo SÓ ao target do WIDGET. SPIKE display-only: prova que o
// timer vivo corre na ilha e na lock screen sem servidor (PO-0.1). Botões
// interativos (App Intents, iOS 17+) ficam pro MVP (039c).
//
// Tokens hardcoded no spike (teal #0f766e, amber #d97706) — no MVP virão de @design-tokens.

import ActivityKit
import SwiftUI
import WidgetKit

@available(iOS 16.2, *)
struct DoseLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: DoseActivityAttributes.self) { context in
            // ── Lock Screen / banner ──────────────────────────────
            LockScreenView(context: context)
                .padding(16)
                .activityBackgroundTint(Color.black.opacity(0.55))
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                // ── Expanded ──────────────────────────────────────
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: "drop.fill")
                        .foregroundColor(stateColor(context.state.state))
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(timerInterval: timerRange(context.state.scheduledAt, context.state.state),
                         countsDown: countsDown(context.state.state))
                        .monospacedDigit()
                        .multilineTextAlignment(.trailing)
                        .frame(maxWidth: 64)
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(context.attributes.medicineLabel)
                        .font(.headline)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text(context.state.stateLabel)
                        .font(.caption)
                        .foregroundColor(stateColor(context.state.state))
                }
            } compactLeading: {
                Image(systemName: "drop.fill")
                    .foregroundColor(stateColor(context.state.state))
            } compactTrailing: {
                Text(timerInterval: timerRange(context.state.scheduledAt, context.state.state),
                     countsDown: countsDown(context.state.state))
                    .monospacedDigit()
                    .frame(maxWidth: 44)
            } minimal: {
                Image(systemName: "drop.fill")
                    .foregroundColor(stateColor(context.state.state))
            }
        }
    }
}

@available(iOS 16.2, *)
private struct LockScreenView: View {
    let context: ActivityViewContext<DoseActivityAttributes>
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "drop.fill")
                .foregroundColor(stateColor(context.state.state))
                .font(.title2)
            VStack(alignment: .leading, spacing: 2) {
                Text(context.state.stateLabel)
                    .font(.caption)
                    .foregroundColor(.secondary)
                Text(context.attributes.medicineLabel)
                    .font(.headline)
                    .foregroundColor(.white)
            }
            Spacer()
            Text(timerInterval: timerRange(context.state.scheduledAt, context.state.state),
                 countsDown: countsDown(context.state.state))
                .font(.title2)
                .monospacedDigit()
                .foregroundColor(.white)
        }
    }
}

// Faixa do timer. Regressivo (upcoming/now): agora → horário da dose (conta até o alvo).
// Progressivo (late): horário da dose → agora+buffer (conta o atraso desde o alvo).
private func timerRange(_ scheduledAt: Date, _ state: String) -> ClosedRange<Date> {
    let now = Date()
    if countsDown(state) {
        let upper = max(scheduledAt, now.addingTimeInterval(1)) // garante lower <= upper
        return now...upper
    } else {
        let lower = min(scheduledAt, now)
        return lower...now.addingTimeInterval(3600) // upper só precisa ser >= now
    }
}

// upcoming/now contam regressivo; late conta progressivo.
private func countsDown(_ state: String) -> Bool {
    return state == "upcoming" || state == "now"
}

private func stateColor(_ state: String) -> Color {
    switch state {
    case "now": return Color(red: 0.06, green: 0.46, blue: 0.43) // teal #0f766e
    case "late": return Color(red: 0.85, green: 0.47, blue: 0.02) // amber #d97706
    case "missed": return Color(red: 0.94, green: 0.27, blue: 0.27) // danger #ef4444
    case "done": return Color(red: 0.08, green: 0.50, blue: 0.24) // success #15803d
    default: return .secondary
    }
}
