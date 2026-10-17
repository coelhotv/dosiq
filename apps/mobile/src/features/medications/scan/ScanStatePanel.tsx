// Estados do scanner fora da leitura (spec 066 D1 · artboards `f1-perm` e `x-*` · DESIGN_DECISOES §4/§5).
//
// Dois formatos, como no mock hi-fi (C-D1-1, smoke iOS 2026-10-17):
//   · tela cheia (antes do visor): pré-permissão, negada, bloqueada, offline, versão — ícone em círculo,
//     título grande alinhado à esquerda e ações fixas no rodapé;
//   · sheet sobre o visor: ilegível, não encontrado, falha do índice.
// Todo estado diz o motivo (Constitution IX) e tem saída para o cadastro digitado (INV-3).
// Componentes puros: a tela decide o estado e passa as ações.

import { View, Text, Pressable, StyleSheet } from 'react-native'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 (ver TreatmentsScreen.tsx)
import * as LucideIcons from 'lucide-react-native'
import PrimaryButton from '@shared/components/ui/PrimaryButton'
import { colors, spacing, borderRadius, shadows } from '@shared/styles/tokens'

const { Camera, Lock, Check, Info, Settings, Download, TriangleAlert, Package, SquarePen, X } = LucideIcons as any

export type FullScreenState = 'pre_permission' | 'denied' | 'blocked' | 'offline' | 'version'
export type VisorSheetState = 'illegible' | 'not_found' | 'index_failed'

interface FullCopy {
  title: string
  body?: string
  icon: any
  /** Ação do estado (pedir de novo, Ajustes, tentar de novo, loja). */
  action: string
  actionIcon?: any
}

// Copy verbatim do §4 do design; botões como nos artboards `x-*`.
const FULL_COPY: Record<Exclude<FullScreenState, 'pre_permission'>, FullCopy> = {
  denied: {
    icon: Camera,
    title: 'Sem acesso à câmera',
    body: 'Tudo bem: dá para cadastrar digitando. Se mudar de ideia, toque em "Pedir acesso de novo".',
    action: 'Pedir acesso de novo',
  },
  blocked: {
    icon: Lock,
    title: 'A câmera está bloqueada para o Dosiq',
    body: 'Para ler o código, libere nos Ajustes do celular: Apps › Dosiq › Permissões › Câmera.',
    action: 'Abrir Ajustes do celular',
    actionIcon: Settings,
  },
  offline: {
    icon: Download,
    title: 'Sem internet para preparar a leitura',
    body:
      'Na primeira vez o Dosiq baixa a lista de caixas (menos de 1 MB). Depois funciona sem internet. Conecte-se e tente de novo.',
    action: 'Tentar de novo',
  },
  version: {
    icon: Download,
    title: 'Atualize o app para usar a leitura',
    body: 'A lista de caixas mudou e esta versão do Dosiq não sabe lê-la. O cadastro digitando funciona normalmente.',
    action: 'Abrir a loja',
  },
}

/** "Digitar manualmente" com ícone de lápis (ManualLink do mock). `dark` = sobre o visor. */
export function ManualLink({ onPress, dark = false, label = 'Digitar manualmente' }) {
  const color = dark ? colors.text.inverse : colors.primary[700]
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={label} style={styles.manual}>
      <SquarePen size={18} color={color} strokeWidth={2} />
      <Text style={[styles.manualText, { color }, !dark && styles.underline]}>{label}</Text>
    </Pressable>
  )
}

function NeutralButton({ label, onPress, icon: Icon = null }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.neutral, pressed && styles.neutralPressed]}
    >
      {Icon ? <Icon size={18} color={colors.text.primary} /> : null}
      <Text style={styles.neutralText}>{label}</Text>
    </Pressable>
  )
}

function Bullet({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <View style={styles.bullet}>
      <View style={styles.bulletIcon}>
        <Icon size={18} color={colors.text.secondary} strokeWidth={2.2} />
      </View>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  )
}

interface FullStateScreenProps {
  screen: FullScreenState
  onAction: () => void
  onManual: () => void
  onClose: () => void
}

/** Tela cheia antes do visor (artboards `f1-perm`, `x-neg`, `x-blk`, `x-off`, `x-ver`). */
export function FullStateScreen({ screen, onAction, onManual, onClose }: FullStateScreenProps) {
  const isPermission = screen === 'pre_permission'
  const copy = isPermission ? null : FULL_COPY[screen]
  const Icon = copy ? copy.icon : Camera
  return (
    <View style={styles.full}>
      <View style={styles.fullHeader}>
        <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Fechar">
          <X size={24} color={colors.text.primary} />
        </Pressable>
      </View>
      <View style={styles.fullBody}>
        <View style={[styles.heroIcon, !isPermission && styles.heroIconMuted]}>
          <Icon size={30} color={isPermission ? colors.primary[700] : colors.text.secondary} strokeWidth={2} />
        </View>
        <Text style={styles.heroTitle} accessibilityRole="header">
          {isPermission ? 'A câmera lê o código de barras da caixa' : copy?.title}
        </Text>
        {isPermission ? (
          <View style={styles.bullets}>
            <Bullet icon={Lock} text="A imagem não é salva nem enviada. Só os números do código são usados." />
            <Bullet icon={Check} text="Nada é salvo sem você conferir antes." />
            <Bullet icon={Info} text="Prefere digitar? O cadastro manual continua aqui embaixo." />
          </View>
        ) : (
          <Text style={styles.heroBody}>{copy?.body}</Text>
        )}
      </View>
      <View style={styles.footer}>
        {isPermission ? (
          <>
            <PrimaryButton label="Permitir câmera" onPress={onAction} style={styles.block} />
            <ManualLink onPress={onManual} />
          </>
        ) : (
          <>
            <PrimaryButton label="Cadastrar digitando" onPress={onManual} style={styles.block} />
            <NeutralButton label={copy?.action} onPress={onAction} icon={copy?.actionIcon} />
          </>
        )}
      </View>
    </View>
  )
}

interface VisorSheetProps {
  screen: VisorSheetState
  onRetry: () => void
  onManual: () => void
}

/** Sheet sobre o visor (artboards `x-ill`, `x-nf`, `x-idx`). */
export function VisorSheet({ screen, onRetry, onManual }: VisorSheetProps) {
  if (screen === 'not_found') {
    return (
      <View style={styles.sheet}>
        <View style={styles.sheetIcon}>
          <Package size={26} color={colors.text.secondary} />
        </View>
        <Text style={styles.sheetTitle} accessibilityRole="header">
          Esta caixa não está na lista
        </Text>
        <Text style={styles.sheetBody}>
          Acontece com remédio manipulado, hospitalar, importado ou amostra grátis. Dá para cadastrar digitando — leva um
          minuto.
        </Text>
        <PrimaryButton label="Cadastrar digitando" onPress={onManual} style={styles.block} />
        <NeutralButton label="Ler outra caixa" onPress={onRetry} />
      </View>
    )
  }
  const illegible = screen === 'illegible'
  const Icon = illegible ? TriangleAlert : Download
  return (
    <View style={styles.sheet}>
      <View style={styles.sheetIcon}>
        <Icon size={26} color={colors.text.secondary} />
      </View>
      <Text style={styles.sheetTitle} accessibilityRole="header">
        {illegible ? 'Não deu para ler o código' : 'Não deu para preparar a leitura'}
      </Text>
      <Text style={styles.sheetBody}>
        {illegible
          ? 'Luz fraca ou caixa amassada atrapalham. Tente com a lanterna, ou cadastre digitando.'
          : 'A lista de caixas não terminou de baixar. Confira a internet e tente de novo — ou siga digitando.'}
      </Text>
      <PrimaryButton label="Tentar de novo" onPress={onRetry} style={styles.block} />
      <ManualLink onPress={onManual} />
    </View>
  )
}

const styles = StyleSheet.create({
  block: {
    alignSelf: 'stretch',
  },
  full: {
    flex: 1,
    backgroundColor: colors.bg.screen,
  },
  fullHeader: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  fullBody: {
    flex: 1,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    gap: spacing[4],
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIconMuted: {
    backgroundColor: colors.neutral[100],
  },
  heroTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    color: colors.text.primary,
  },
  heroBody: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.text.secondary,
  },
  bullets: {
    gap: spacing[4],
  },
  bullet: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  bulletIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.border.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulletText: {
    flex: 1,
    paddingTop: 6,
    fontSize: 16,
    lineHeight: 23,
    color: colors.text.primary,
  },
  footer: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    paddingBottom: spacing[4],
    gap: spacing[2],
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  manual: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
  },
  manualText: {
    fontSize: 15,
    fontWeight: '700',
  },
  underline: {
    textDecorationLine: 'underline',
  },
  neutral: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border.light,
    backgroundColor: colors.bg.card,
  },
  neutralPressed: {
    backgroundColor: colors.neutral[100],
  },
  neutralText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    paddingBottom: spacing[6],
    gap: spacing[3],
    ...shadows.md,
  },
  sheetIcon: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    color: colors.text.primary,
  },
  sheetBody: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.text.secondary,
  },
})
