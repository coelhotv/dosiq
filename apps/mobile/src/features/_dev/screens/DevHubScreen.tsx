// DevHubScreen — hub das ferramentas de desenvolvimento. Ligado por `DEV_TOOLS_ENABLED`
// (debug ou build interno `device`); nunca no build da loja (ver `../devTools.ts`).
//
// Só COMPÕE: cada seção é um domínio em `../sections/` (convenção em DevSection.tsx).

import { ScrollView, View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 sob nodenext
import * as LucideIcons from 'lucide-react-native'
import { colors, spacing } from '@shared/styles/tokens'
import { AlarmSection } from '@features/_dev/sections/AlarmSection'
import { NotificationPermissionsSection } from '@features/_dev/sections/NotificationPermissionsSection'
import { TreatmentSection } from '@features/_dev/sections/TreatmentSection'
import { SessionSection } from '@features/_dev/sections/SessionSection'
import { LayoutSection } from '@features/_dev/sections/LayoutSection'

const { ChevronLeft } = LucideIcons as any

export default function DevHubScreen() {
  const navigation = useNavigation()

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <ChevronLeft size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Dev</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.legend}>🔴 = grava em dados reais da conta logada</Text>
        <AlarmSection />
        <NotificationPermissionsSection />
        <TreatmentSection />
        <SessionSection />
        <LayoutSection />
      </ScrollView>
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
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    backgroundColor: colors.bg.card,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  scroll: {
    padding: spacing[5],
    paddingBottom: spacing[12],
  },
  legend: {
    fontSize: 12,
    color: colors.text.muted,
    marginBottom: spacing[4],
  },
})
