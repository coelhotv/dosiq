import React, { useState, useCallback } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Svg, Circle, Defs, G, Line, Path, Pattern, Rect, Text as SvgText } from 'react-native-svg'
import * as LucideIcons from 'lucide-react-native'
import {
  BODY_MAP_FACES,
  BODY_MAP_SIDE_LETTERS,
  BODY_MAP_SILHOUETTE,
  INJECTION_BODY_MAP_VIEWBOX,
  INJECTION_SITES,
  getBodyMapRegionsByFace,
  getInjectionSiteAbsorption,
  getInjectionSiteLabel,
  type BodyMapFace,
} from '@dosiq/core'
import { colors, spacing, borderRadius } from '@shared/styles/tokens'

// d.ts local do lucide é parcial (ver src/types/lucide-react-native.d.ts) — mesmo padrão dos hosts
const { AlertTriangle, Check, ChevronDown, ChevronUp } = LucideIcons as any

const FACE_LABELS = { frente: 'Frente', costas: 'Costas' }
const DEFAULT_FACE_WIDTH = 120

/**
 * Nome falado de uma região: label PT do core + estado ("Coxa (esquerda), selecionado").
 * O `react-native-svg` só aceita `accessible`/`accessibilityLabel` (sem role/state), então o
 * estado vai no nome; a lista textual carrega `radio` + `accessibilityState` (PO-4).
 */
function regionName(value: string, isSelected: boolean, isLast: boolean): string {
  const parts = [getInjectionSiteLabel(value)]
  if (isSelected) parts.push('selecionado')
  if (isLast) parts.push('última aplicação')
  return parts.join(', ')
}

/** Uma vista (frente ou costas): silhueta + regiões da face. */
function BodyMapFaceView({
  face,
  width,
  value,
  lastUsedSite,
  disabled,
  onToggle,
}: {
  face: BodyMapFace
  width: number
  value: string | null
  lastUsedSite: string | null
  disabled: boolean
  onToggle: (site: string) => void
}) {
  const { width: vw, height: vh } = INJECTION_BODY_MAP_VIEWBOX
  const hatchId = `bm-hatch-${face}`
  const S = BODY_MAP_SILHOUETTE

  return (
    <View style={styles.face}>
      <Svg width={width} height={(width * vh) / vw} viewBox={`0 0 ${vw} ${vh}`}>
        <Defs>
          <Pattern id={hatchId} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <Rect width="5" height="5" fill={colors.primary[50]} />
            <Line x1="0" y1="0" x2="0" y2="5" stroke={colors.brand.primary} strokeWidth="1.2" />
          </Pattern>
        </Defs>
        <SvgText x="10" y="13" fontSize="10" fontWeight="700" fill={colors.text.secondary} textAnchor="middle">
          {BODY_MAP_SIDE_LETTERS.left}
        </SvgText>
        <SvgText x={vw - 10} y="13" fontSize="10" fontWeight="700" fill={colors.text.secondary} textAnchor="middle">
          {BODY_MAP_SIDE_LETTERS.right}
        </SvgText>
        <G fill={colors.neutral[100]} stroke={colors.neutral[300]} strokeWidth="1">
          <Circle cx={S.head.cx} cy={S.head.cy} r={S.head.r} />
          <Rect x={S.neck.x} y={S.neck.y} width={S.neck.width} height={S.neck.height} rx={S.neck.rx} />
          {S.limbs.map((limb) => (
            <Path
              key={limb.d}
              d={limb.d}
              fill="none"
              stroke={colors.neutral[100]}
              strokeWidth={limb.strokeWidth}
              strokeLinecap="round"
            />
          ))}
          <Path d={S.torso} />
          {face === 'costas' &&
            S.backDetails.map((d) => <Path key={d} d={d} fill="none" stroke={colors.neutral[300]} />)}
        </G>
        {getBodyMapRegionsByFace(face).map((region) => {
          const isSelected = region.value === value
          const isLast = region.value === lastUsedSite
          const { x, y } = region.centroid
          return (
            <G
              key={region.value}
              testID={`bodymap-region-${region.value}`}
              accessible
              accessibilityLabel={regionName(region.value, isSelected, isLast)}
              onPress={disabled ? undefined : () => onToggle(region.value)}
            >
              <Path
                d={region.path}
                fill={isSelected ? colors.brand.primary : isLast ? `url(#${hatchId})` : colors.bg.card}
                stroke={isSelected || isLast ? colors.brand.primary : colors.neutral[400]}
                strokeWidth={isLast && !isSelected ? 1.4 : 1}
                strokeDasharray={isLast && !isSelected ? '3,2' : undefined}
              />
              {isSelected && (
                <G>
                  <Circle cx={x} cy={y} r="7" fill={colors.brand.primary} stroke={colors.text.inverse} strokeWidth="1.2" />
                  <Path
                    d={`M${x - 3.2},${y + 0.2} L${x - 0.8},${y + 2.6} L${x + 3.4},${y - 2.6}`}
                    fill="none"
                    stroke={colors.text.inverse}
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </G>
              )}
              {isLast && !isSelected && (
                <G>
                  <Circle cx={x} cy={y} r="6.5" fill={colors.bg.card} stroke={colors.brand.primary} strokeWidth="1.4" />
                  <Circle cx={x} cy={y} r="2" fill={colors.brand.primary} />
                </G>
              )}
              {/* Alvo de toque ampliado (hitPath do core) — transparente */}
              <Path d={region.hitPath} fill="transparent" />
            </G>
          )
        })}
      </Svg>
      <Text style={styles.faceLabel}>
        {FACE_LABELS[face]}
        {face === 'costas' ? <Text style={styles.faceNote}> · espelho</Text> : null}
      </Text>
    </View>
  )
}

/**
 * Mapa corporal de sítio de injeção (spec 071, RN). Mesma geometria da web (`@dosiq/core`,
 * ADR-096) e mesmo contrato de props. Estados: `selected` · `lastUsed` · `repeated`.
 * Desmarcar tem dois caminhos (D7): tocar a região selecionada ou "Não informar".
 * "Escolher pela lista" é a rota equivalente de leitor de tela (AC-9).
 * SaMD: descreve o fato registrado; não sugere sítio.
 */
export default function BodyMapSelector({
  value,
  onChange,
  lastUsedSite = null,
  disabled = false,
  faceWidth = DEFAULT_FACE_WIDTH,
}: {
  value: string | null
  onChange: (value: string | null) => void
  lastUsedSite?: string | null
  disabled?: boolean
  /** Largura de cada vista em px (lote usa menor). */
  faceWidth?: number
}) {
  // States
  const [listOpen, setListOpen] = useState(false)

  const repeated = !!value && value === lastUsedSite
  const absorption = getInjectionSiteAbsorption(value)

  // Handlers
  const toggle = useCallback(
    (site: string) => {
      if (disabled) return
      onChange(site === value ? null : site)
    },
    [disabled, onChange, value]
  )

  const clear = useCallback(() => {
    if (disabled) return
    onChange(null)
  }, [disabled, onChange])

  return (
    <View style={[styles.root, disabled && styles.rootDisabled]}>
      <View style={styles.top}>
        <Text style={styles.last}>
          Última aplicação: <Text style={styles.lastValue}>{getInjectionSiteLabel(lastUsedSite) || '—'}</Text>
        </Text>
        <Pressable
          style={[styles.clear, value === null && styles.clearActive]}
          onPress={clear}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityState={{ selected: value === null, disabled }}
        >
          <Text style={[styles.clearText, value === null && styles.clearTextActive]}>Não informar</Text>
        </Pressable>
      </View>

      <View style={styles.faces} accessibilityLabel="Local de aplicação no mapa do corpo">
        {BODY_MAP_FACES.map((face) => (
          <BodyMapFaceView
            key={face}
            face={face}
            width={faceWidth}
            value={value}
            lastUsedSite={lastUsedSite}
            disabled={disabled}
            onToggle={toggle}
          />
        ))}
      </View>

      <View style={styles.legend} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, styles.swatchSelected]} />
          <Text style={styles.legendText}>selecionado</Text>
        </View>
        {lastUsedSite ? (
          <View style={styles.legendItem}>
            <View style={[styles.swatch, styles.swatchLast]} />
            <Text style={styles.legendText}>última aplicação</Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.summary, value && styles.summaryFilled]}>
        <Text style={styles.summaryLabel}>{value ? getInjectionSiteLabel(value) : 'Nenhum local selecionado'}</Text>
        {absorption ? <Text style={styles.hint}>{absorption}</Text> : null}
      </View>

      {repeated && (
        <View style={styles.alert} accessibilityRole="alert">
          <AlertTriangle size={14} color={colors.status.warning} strokeWidth={2} />
          <Text style={styles.alertText}>Mesmo local da última aplicação — considere rotacionar.</Text>
        </View>
      )}

      <Pressable
        style={styles.listToggle}
        onPress={() => setListOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: listOpen }}
      >
        <Text style={styles.listToggleText}>Escolher pela lista</Text>
        {listOpen ? (
          <ChevronUp size={16} color={colors.primary[700]} strokeWidth={2} />
        ) : (
          <ChevronDown size={16} color={colors.primary[700]} strokeWidth={2} />
        )}
      </Pressable>
      {listOpen && (
        <View style={styles.list} accessibilityRole="radiogroup">
          {INJECTION_SITES.map((site) => {
            const isSel = site.value === value
            const isLast = site.value === lastUsedSite
            return (
              <Pressable
                key={site.value}
                testID={`bodymap-list-${site.value}`}
                style={[styles.listItem, isSel && styles.listItemSelected, isLast && !isSel && styles.listItemLast]}
                onPress={() => toggle(site.value)}
                disabled={disabled}
                accessibilityRole="radio"
                accessibilityLabel={regionName(site.value, false, isLast)}
                accessibilityState={{ selected: isSel, checked: isSel, disabled }}
              >
                <Text style={[styles.listItemText, isSel && styles.listItemTextSelected]}>{site.label}</Text>
                {isSel ? <Check size={15} color={colors.primary[700]} strokeWidth={2.5} /> : null}
              </Pressable>
            )
          })}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { gap: spacing[2] },
  rootDisabled: { opacity: 0.5 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] },
  last: { flex: 1, fontSize: 12, color: colors.text.secondary },
  lastValue: { fontWeight: '700', color: colors.text.primary },
  clear: {
    paddingHorizontal: spacing[3],
    paddingVertical: 6,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.bg.card,
  },
  clearActive: { borderColor: colors.brand.primary, backgroundColor: colors.primary[50] },
  clearText: { fontSize: 12, fontWeight: '600', color: colors.text.secondary },
  clearTextActive: { color: colors.primary[700] },
  faces: { flexDirection: 'row', justifyContent: 'center', gap: spacing[3] },
  face: { alignItems: 'center', gap: 2 },
  faceLabel: { fontSize: 11, fontWeight: '600', color: colors.text.secondary },
  faceNote: { fontWeight: '400', color: colors.text.muted },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: spacing[3] },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendText: { fontSize: 11, color: colors.text.secondary },
  swatch: { width: 12, height: 12, borderRadius: 3, borderWidth: 1, borderColor: colors.brand.primary },
  swatchSelected: { backgroundColor: colors.brand.primary },
  swatchLast: { backgroundColor: colors.primary[50], borderStyle: 'dashed' },
  summary: {
    gap: 2,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.md,
    backgroundColor: colors.bg.screen,
  },
  summaryFilled: { backgroundColor: colors.primary[50] },
  summaryLabel: { fontSize: 13, fontWeight: '600', color: colors.text.primary },
  hint: { fontSize: 12, color: colors.text.secondary, fontStyle: 'italic' },
  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.md,
    backgroundColor: colors.status.warningLight,
  },
  alertText: { flex: 1, fontSize: 12, color: colors.status.warning },
  listToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: spacing[1] },
  listToggleText: { fontSize: 13, fontWeight: '600', color: colors.primary[700] },
  list: { gap: spacing[1] },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.bg.card,
  },
  listItemSelected: { borderColor: colors.brand.primary, backgroundColor: colors.primary[50] },
  listItemLast: { borderStyle: 'dashed', borderColor: colors.brand.primary },
  listItemText: { fontSize: 13, color: colors.text.secondary },
  listItemTextSelected: { color: colors.primary[700], fontWeight: '600' },
})
