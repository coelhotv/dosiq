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
 * @param {{
 *   saldo: number,                 // saldo total em unidades
 *   dailyConsumption: number,      // consumo diário (un./dia)
 *   daysRemaining: number|null,    // dias restantes (null = sem consumo)
 *   avgUnitPrice: number,          // custo médio ponderado por unidade
 *   medicine: object|null,         // objeto completo do medicamento
 * }} props
 */
export default function StockIndicators({
  saldo = 0,
  dailyConsumption = 0,
  daysRemaining = null,
  avgUnitPrice = 0,
  costPerDose = null,
  medicine = null,
}) {
  // Cor de alerta para "Dias restantes": <7 vermelho · <14 amarelo · senão neutro.
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
      <Kpi
        icon={<Clock size={18} color={colors.primary[700]} />}
        label="Dias restantes"
        value={daysRemaining == null ? '—' : String(daysRemaining)}
        suffix={daysRemaining == null ? null : 'dias'}
        valueColor={daysColor}
      />
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
