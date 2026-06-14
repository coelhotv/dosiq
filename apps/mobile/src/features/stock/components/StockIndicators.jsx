// StockIndicators.jsx — KPI grid 2×2 do detalhe de estoque (S2.1 Fase 3)
// R-010: sem hooks complexos (componente de apresentação puro)
// ADR-028: StyleSheet canônico · ADR-023: fontWeight >= 400
//
// Layout: 2 colunas (flexWrap), cada card flexBasis ~48%.
//   [ Saldo          | Consumo / dia ]
//   [ Dias restantes | Custo médio   ]

import { View, Text, StyleSheet } from 'react-native'
import { Package, TrendingDown, Clock, Tag } from 'lucide-react-native'
import { formatBRL, formatActiveIngredientShort, isLiquidMedicine, formatNumberPtBR } from '@dosiq/core'
import { colors, spacing, borderRadius, shadows } from '@shared/styles/tokens'

/**
 * Grid de indicadores (KPIs) do estoque de um medicamento.
 *
 * 012 B4 (ADR-067) — modelo dose-primário p/ tratamento ≠ diário:
 *  - "Consumo / dia" mostra o consumo do DIA-DOSE (dia agendado), não corrido
 *    (Mounjaro 1×/sem = 0,5 ml; 2× no dia = 1 ml). Diário fica igual.
 *  - "Dias restantes" vira "Doses restantes" (N doses); cor SEMPRE por runway.
 *
 * @param {{
 *   saldo: number,
 *   dailyConsumption: number,        // consumo do dia-dose (já sem frequencyDailyFactor)
 *   daysRemaining: number|null,      // runway em dias corridos (cor + label diário)
 *   dosesRemaining: number|null,     // doses físicas restantes (label ≠ diário)
 *   isDailyStock: boolean,           // true = diário ("N dias"); false = "N doses"
 *   avgUnitPrice: number,
 *   costPerDose: number|null,
 *   medicine: object|null,
 * }} props
 */
export default function StockIndicators({
  saldo = 0,
  dailyConsumption = 0,
  daysRemaining = null,
  dosesRemaining = null,
  isDailyStock = true,
  avgUnitPrice = 0,
  costPerDose = null,
  medicine = null,
}) {
  // Cor de alerta SEMPRE por runway (dias corridos): <7 vermelho · <14 amarelo.
  // Vale para diário e ≠ diário — o rótulo muda (doses), a cor mede recompra.
  const daysColor =
    daysRemaining == null
      ? colors.text.primary
      : daysRemaining < 7
        ? colors.status.error
        : daysRemaining < 14
          ? colors.status.warning
          : colors.text.primary

  // Líquidos (022): saldo/consumo em ml (sem hint de princípio ativo, custo /ml).
  const isLiquid = isLiquidMedicine(medicine)
  const countSuffix = isLiquid ? 'ml' : 'un.'
  const fmtCount = (n) => (isLiquid ? formatNumberPtBR(n) : String(n))

  return (
    <View style={styles.grid}>
      <Kpi
        icon={<Package size={18} color={colors.primary[700]} />}
        label="Saldo"
        value={fmtCount(saldo)}
        suffix={countSuffix}
        hint={isLiquid ? null : formatActiveIngredientShort(saldo, medicine?.dosage_per_pill, medicine?.dosage_unit)}
      />
      <Kpi
        icon={<TrendingDown size={18} color={colors.primary[700]} />}
        label="Consumo / dia"
        value={fmtCount(dailyConsumption)}
        suffix={countSuffix}
        hint={isLiquid ? null : formatActiveIngredientShort(dailyConsumption, medicine?.dosage_per_pill, medicine?.dosage_unit)}
      />
      {isDailyStock ? (
        <Kpi
          icon={<Clock size={18} color={colors.primary[700]} />}
          label="Dias restantes"
          value={daysRemaining == null ? '—' : String(daysRemaining)}
          suffix={daysRemaining == null ? null : 'dias'}
          valueColor={daysColor}
        />
      ) : (
        <Kpi
          icon={<Clock size={18} color={colors.primary[700]} />}
          label="Doses restantes"
          value={dosesRemaining == null ? '—' : String(dosesRemaining)}
          suffix={dosesRemaining == null ? null : dosesRemaining === 1 ? 'dose' : 'doses'}
          valueColor={daysColor}
        />
      )}
      {costPerDose != null ? (
        <Kpi
          icon={<Tag size={18} color={colors.primary[700]} />}
          label="Custo por dose"
          value={formatBRL(costPerDose)}
        />
      ) : (
        <Kpi
          icon={<Tag size={18} color={colors.primary[700]} />}
          label="Custo médio"
          value={formatBRL(avgUnitPrice)}
          suffix={`/ ${countSuffix}`}
        />
      )}
    </View>
  )
}

function Kpi({ icon, label, value, suffix, valueColor, hint }) {
  return (
    <View style={styles.card}>
      <View style={styles.iconWrap}>{icon}</View>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueRow}>
        <Text style={[styles.value, valueColor && { color: valueColor }]}>
          {value}
        </Text>
        {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  card: {
    flexGrow: 1,
    flexBasis: '47%',
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    gap: spacing[2],
    ...shadows.sm,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text.secondary,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing[1],
    flexWrap: 'wrap',
  },
  value: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text.primary,
    letterSpacing: -0.3,
  },
  suffix: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text.muted,
  },
  hint: {
    fontSize: 11,
    color: colors.text.muted,
    marginTop: 2,
    fontWeight: '500',
  },
})
