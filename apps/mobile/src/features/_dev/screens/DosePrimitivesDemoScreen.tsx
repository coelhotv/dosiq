// DosePrimitivesDemoScreen — playground primitivos/telas Doses (FAB / Bulk Dose).
// DEV-only. Valida BulkDoseRegisterModal nos modos Simple e Complex sem dependência de dados reais.

import { useState, useEffect } from 'react'
import { ScrollView, View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 sob nodenext
import * as LucideIcons from 'lucide-react-native'
const { ChevronLeft, Clock } = LucideIcons as any
import { lightTap } from '@shared/utils/haptics'
import { colors, spacing, typography } from '@shared/styles/tokens'
import { getNow } from '@dosiq/core'
import { supabase } from '../../../platform/supabase/nativeSupabaseClient'
import BulkDoseRegisterModal from '../../dose/components/BulkDoseRegisterModal'

// Dados mockados enriquecidos para exercitar desmembramento cronológico e planos
const FAKE_TREATMENTS = [
  {
    id: 'p1',
    name: 'Aspirina',
    dosage_per_intake: 1,
    time_schedule: ['08:00', '20:00'], // Múltiplos horários -> desmembrado cronologicamente
    treatment_plan: { id: 'plan-cardio', name: 'Plano Cardio', emoji: '❤️', color: colors.status.error },
    medicine_id: 'med-1',
    medicine: { id: 'med-1', name: 'Aspirina', dosage_per_pill: 100, dosage_unit: 'mg' },
  },
  {
    id: 'p2',
    name: 'Omeprazol',
    dosage_per_intake: 1,
    time_schedule: ['07:30'],
    treatment_plan: { id: 'plan-gastro', name: 'Plano Estômago', emoji: '🍏', color: colors.primary[500] },
    medicine_id: 'med-2',
    medicine: { id: 'med-2', name: 'Omeprazol', dosage_per_pill: 20, dosage_unit: 'mg' },
  },
  {
    id: 'p3',
    name: 'Atorvastatina',
    dosage_per_intake: 2,
    time_schedule: ['22:00'],
    treatment_plan: { id: 'plan-cardio', name: 'Plano Cardio', emoji: '❤️', color: colors.status.error },
    medicine_id: 'med-3',
    medicine: { id: 'med-3', name: 'Atorvastatina', dosage_per_pill: 20, dosage_unit: 'mg' },
  },
  {
    id: 'p4',
    name: 'Vitamina C',
    dosage_per_intake: 1,
    time_schedule: ['08:00', '13:00'], // Desmembrado em Geral/Avulsos
    treatment_plan: null, // Órfão de plano
    medicine_id: 'med-4',
    medicine: { id: 'med-4', name: 'Vitamina C', dosage_per_pill: 1, dosage_unit: 'g' },
  },
]

export default function DosePrimitivesDemoScreen({ navigation }) {
  const [modalVisible, setModalVisible] = useState(false)
  const [isComplexMode, setIsComplexMode] = useState(false)
  const [useMockData, setUseMockData] = useState(true)
  const [userId, setUserId] = useState(null)
  const [modalLogs, setModalLogs] = useState([])

  useEffect(() => {
    supabase.auth.getUser()
      .then(({ data: { user } }) => {
        if (user) setUserId(user.id)
      })
      .catch(err => console.error('[DoseDemo] erro auth:', err))
  }, [])

  function openDemo(isComplex, isMock) {
    lightTap()
    setIsComplexMode(isComplex)
    setUseMockData(isMock)
    setModalVisible(true)
  }

  function handleSuccess({ successCount }) {
    lightTap()
    setModalVisible(false)
    setModalLogs(prev => [
      ...prev,
      {
        id: String(Date.now()),
        time: `${String(getNow().getHours()).padStart(2, '0')}:${String(getNow().getMinutes()).padStart(2, '0')}`,
        message: `Registradas ${successCount} doses com sucesso!`,
      },
    ])
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Cabeçalho */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation?.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ChevronLeft size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Validação Doses (FAB)</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gatilhos de Validação (BulkDoseRegisterModal)</Text>
          <Text style={styles.caption}>
            Escolha uma das opções de homologação para abrir o modal de registro em lote:
          </Text>

          <View style={styles.groupHeaderRow}>
            <Text style={styles.groupHeader}>🧪 MOCK (Paciente Crônico Simulado)</Text>
          </View>

          <TouchableOpacity
            style={styles.buttonCard}
            onPress={() => openDemo(false, true)}
          >
            <Text style={styles.buttonText}>Abrir em Modo Simples (Mock)</Text>
            <Text style={styles.subCaption}>Sem agrupadores de plano. Lista plana ordenada por horário cronológico.</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.buttonCard}
            onPress={() => openDemo(true, true)}
          >
            <Text style={styles.buttonText}>Abrir em Modo Complexo (Mock)</Text>
            <Text style={styles.subCaption}>Agrupado sob cabeçalhos dos Planos de Tratamento. Horários cronológicos internos.</Text>
          </TouchableOpacity>

          <View style={[styles.groupHeaderRow, { marginTop: spacing[3] }]}>
            <Text style={styles.groupHeader}>🔌 REAL (Dados de Integração do Seu Perfil)</Text>
          </View>

          <TouchableOpacity
            style={[styles.buttonCard, !userId && styles.btnDisabled]}
            onPress={() => userId && openDemo(false, false)}
            disabled={!userId}
          >
            <Text style={[styles.buttonText, { color: colors.brand.primary }]}>
              {userId ? 'Abrir em Modo Simples (Dados Reais)' : 'Carregando usuário logado...'}
            </Text>
            <Text style={styles.subCaption}>Lista seus tratamentos reais do Supabase em formato plano.</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.buttonCard, !userId && styles.btnDisabled]}
            onPress={() => userId && openDemo(true, false)}
            disabled={!userId}
          >
            <Text style={[styles.buttonText, { color: colors.brand.primary }]}>
              {userId ? 'Abrir em Modo Complexo (Dados Reais)' : 'Carregando usuário logado...'}
            </Text>
            <Text style={styles.subCaption}>Lista seus tratamentos reais do Supabase agrupados pelos seus planos reais.</Text>
          </TouchableOpacity>
        </View>

        {/* Histórico Local de Registro DEV */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Histórico de Ações da Sessão</Text>
          {modalLogs.length === 0 ? (
            <Text style={styles.emptyText}>Nenhuma dose registrada nesta sessão de testes.</Text>
          ) : (
            modalLogs.map(log => (
              <View key={log.id} style={styles.logCard}>
                <View style={styles.logTimeRow}>
                  <Clock size={12} color={colors.text.secondary} strokeWidth={2.5} />
                  <Text style={styles.logTime}>{log.time}</Text>
                </View>
                <Text style={styles.logMsg}>{log.message}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Modal Reutilizável de Testes */}
      <BulkDoseRegisterModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSuccess={handleSuccess}
        mode="active"
        userId={useMockData ? 'demo-user' : userId}
        isComplex={isComplexMode}
        initialProtocols={useMockData ? FAKE_TREATMENTS : null}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg.screen,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    gap: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    backgroundColor: colors.bg.card,
  },
  backBtn: {
    padding: spacing[1],
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    fontFamily: typography.fontFamily.bold,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 32,
  },
  scroll: {
    padding: spacing[4],
    gap: spacing[6],
  },
  section: {
    gap: spacing[3],
    padding: spacing[4],
    backgroundColor: colors.bg.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text.primary,
    fontFamily: typography.fontFamily.bold,
  },
  caption: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
    marginBottom: spacing[2],
  },
  subCaption: {
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 4,
  },
  buttonCard: {
    backgroundColor: colors.bg.screen,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary[700],
  },
  emptyText: {
    fontSize: 13,
    color: colors.text.muted,
    fontStyle: 'italic',
    paddingVertical: spacing[2],
  },
  logCard: {
    backgroundColor: colors.bg.screen,
    padding: spacing[3],
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.brand.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logTime: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  logTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  logMsg: {
    fontSize: 13,
    color: colors.text.primary,
    fontWeight: '500',
  },
  btnDisabled: {
    opacity: 0.55,
  },
  groupHeaderRow: {
    paddingVertical: spacing[1],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    marginBottom: spacing[1],
  },
  groupHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text.muted,
  },
})
