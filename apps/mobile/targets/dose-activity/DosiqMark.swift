// DosiqMark.swift — Spec 039 / F3
//
// Marca oficial dosiq (arco "q" + check + dot) como SwiftUI Shape. MESMO path do SVG da
// web/mobile (apps/mobile/src/shared/components/branding/DosiqLogo.jsx, viewBox 130 103 600 600).
// O widget não pode importar react-native-svg → o path é portado aqui e parseado em runtime.
// Usa só comandos absolutos M/L/C/Z (como o SVG fonte). NÃO usar SF Symbol "drop.fill": o mock
// (Spec_039 design canvas) é explícito — a marca da ilha/lock screen é o logo dosiq, não a gota.

import SwiftUI

struct DosiqMark: Shape {
    // viewBox do SVG fonte: origem (130,103), 600×600.
    private static let vbX: CGFloat = 130
    private static let vbY: CGFloat = 103
    private static let vbSize: CGFloat = 600

    private static let pathData = "M 409.50 685.89 C341.64,680.78 278.18,651.19 228.51,601.48 C193.15,566.10 165.80,518.08 154.04,470.74 C140.68,416.93 142.51,363.23 159.42,312.50 C173.56,270.09 195.20,234.37 225.88,202.77 C259.06,168.61 296.30,144.70 339.92,129.56 C372.77,118.16 413.95,112.57 447.55,114.94 C483.81,117.51 516.25,125.52 547.67,139.67 C562.47,146.34 567.62,150.54 571.44,159.05 C573.83,164.37 574.15,166.20 573.81,172.36 C573.33,181.06 571.15,185.90 564.89,192.19 C561.38,195.72 558.77,197.30 554.43,198.56 C545.84,201.06 539.99,200.08 526.77,193.94 C505.05,183.84 482.80,177.36 459.80,174.44 C440.16,171.94 408.30,172.82 390.00,176.36 C352.42,183.65 319.18,199.01 289.00,223.02 C277.84,231.90 257.20,253.19 248.77,264.50 C196.89,334.17 188.74,425.62 227.52,503.00 C236.84,521.62 253.63,544.53 270.00,561.01 C305.09,596.33 348.29,618.23 398.50,626.16 C414.02,628.61 442.13,629.07 457.50,627.12 C499.84,621.75 539.38,605.21 572.50,579.00 C582.12,571.39 601.41,552.18 609.17,542.50 C634.01,511.48 650.09,475.13 656.65,435.18 C658.64,423.06 659.11,391.50 657.62,369.38 C656.75,356.58 656.79,356.13 659.24,350.80 C664.38,339.56 673.47,333.61 685.50,333.62 C693.58,333.62 699.07,335.90 705.33,341.86 C712.30,348.47 714.24,354.47 715.96,374.67 C720.48,427.64 711.18,478.38 688.51,524.50 C636.16,630.99 526.08,694.67 409.50,685.89 ZM 390.32 520.62 C388.03,519.87 384.65,518.32 382.82,517.18 C381.00,516.05 358.75,494.28 333.38,468.81 C290.21,425.47 287.12,422.13 285.13,416.71 C281.98,408.15 282.27,400.78 286.06,393.20 C289.30,386.70 292.70,383.27 299.38,379.72 C305.38,376.53 317.72,376.61 324.00,379.87 C326.94,381.40 340.64,394.31 363.51,417.10 L 398.52 451.98 L 479.51 370.89 C544.34,305.98 561.50,289.32 565.50,287.41 C572.46,284.09 582.51,284.08 589.50,287.39 C604.04,294.28 610.26,311.01 603.66,325.44 C601.37,330.43 589.88,342.30 508.28,424.03 C431.03,501.40 414.68,517.31 410.61,519.09 C404.49,521.75 395.80,522.41 390.32,520.62 ZM 631.49 275.26 C617.13,270.13 608.12,260.58 604.36,246.50 C598.28,223.75 613.00,200.80 636.83,195.87 C662.96,190.48 688.36,215.39 684.05,242.18 C681.89,255.59 672.42,268.15 660.25,273.76 C652.64,277.26 639.08,277.97 631.49,275.26 Z"

    func path(in rect: CGRect) -> Path {
        // Encaixa o viewBox quadrado no rect mantendo proporção, centralizado.
        let scale = min(rect.width, rect.height) / Self.vbSize
        let offsetX = rect.minX + (rect.width - Self.vbSize * scale) / 2 - Self.vbX * scale
        let offsetY = rect.minY + (rect.height - Self.vbSize * scale) / 2 - Self.vbY * scale
        func map(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
            CGPoint(x: x * scale + offsetX, y: y * scale + offsetY)
        }

        var path = Path()
        let tokens = Self.tokenize(Self.pathData)
        var i = 0
        func nextNum() -> CGFloat { defer { i += 1 }; return CGFloat(Double(tokens[i]) ?? 0) }
        while i < tokens.count {
            let cmd = tokens[i]; i += 1
            switch cmd {
            case "M": path.move(to: map(nextNum(), nextNum()))
            case "L": path.addLine(to: map(nextNum(), nextNum()))
            case "C":
                let c1 = map(nextNum(), nextNum())
                let c2 = map(nextNum(), nextNum())
                let end = map(nextNum(), nextNum())
                path.addCurve(to: end, control1: c1, control2: c2)
            case "Z", "z": path.closeSubpath()
            default: break // ignora tokens inesperados
            }
        }
        return path
    }

    // Separa o path em tokens: letras de comando viram tokens próprios; números separados por
    // vírgula/espaço. (O SVG fonte só usa M/L/C/Z absolutos com separadores simples.)
    private static func tokenize(_ d: String) -> [String] {
        var out: [String] = []
        var num = ""
        for ch in d {
            if ch.isLetter {
                if !num.isEmpty { out.append(num); num = "" }
                out.append(String(ch))
            } else if ch == " " || ch == "," {
                if !num.isEmpty { out.append(num); num = "" }
            } else {
                num.append(ch)
            }
        }
        if !num.isEmpty { out.append(num) }
        return out
    }
}

// View de conveniência: marca preenchida + leve contorno (espelha stroke-width:18 do SVG fonte,
// que engrossa a marca p/ legibilidade em tamanhos pequenos — ilha minimal/compact).
struct DosiqMarkView: View {
    var color: Color
    var body: some View {
        DosiqMark()
            .fill(color)
            .overlay(DosiqMark().stroke(color, lineWidth: 1.2))
    }
}

