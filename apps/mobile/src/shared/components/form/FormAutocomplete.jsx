import { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { Search, X } from 'lucide-react-native'
import { colors, spacing, borderRadius } from '@shared/styles/tokens'

// Componente de busca com sugestões em overlay (estilo autocomplete).
// Pensado para a busca ANVISA: usuário digita, hook search() retorna lista,
// tap em sugestão dispara onChange(name, value) e onSelect(item) para auto-fill.
//
// Props:
//   name        chave do campo
//   label       label visual
//   value       string controlado
//   error       mensagem de erro
//   placeholder
//   helperText
//   required
//   disabled
//   search      (query, limit) => Array<item>
//   getItemLabel(item)  string visível na lista (default: item.name)
//   getItemSubtitle(item) opcional, segunda linha
//   getItemValue(item)  default: item.name (passado para onChange)
//   onChange    (name, value) => void
//   onSelect    (item) => void  (callback completo p/ auto-fill via setValues)
//   onBlur      (name) => void
//   minChars    default 3
//   maxResults  default 8
//   debounceMs  default 200

const DEFAULT_DEBOUNCE_MS = 200
const DEFAULT_MIN_CHARS = 3
const DEFAULT_MAX_RESULTS = 8

function defaultGetLabel(item) {
  return item?.name ?? ''
}

function defaultGetValue(item) {
  return item?.name ?? ''
}

export default function FormAutocomplete({
  name,
  label,
  value,
  error,
  placeholder,
  helperText,
  required,
  disabled,
  search,
  getItemLabel = defaultGetLabel,
  getItemSubtitle,
  getItemValue = defaultGetValue,
  onChange,
  onSelect,
  onBlur,
  minChars = DEFAULT_MIN_CHARS,
  maxResults = DEFAULT_MAX_RESULTS,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}) {
  const [focused, setFocused] = useState(false)
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef(null)

  // Roda busca debounced quando value muda + foco está no campo
  useEffect(() => {
    if (!focused) return undefined
    const trimmed = value?.trim() ?? ''
    if (trimmed.length < minChars) {
      // Limpa via timeout (evita setState síncrono no effect)
      const t = setTimeout(() => {
        setResults([])
        setSearching(false)
      }, 0)
      return () => clearTimeout(t)
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    // Marca "buscando" no próximo tick + roda busca após debounce
    const startTimer = setTimeout(() => setSearching(true), 0)
    debounceRef.current = setTimeout(() => {
      try {
        const out = search?.(value, maxResults) ?? []
        setResults(Array.isArray(out) ? out : [])
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, debounceMs)

    return () => {
      clearTimeout(startTimer)
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [value, focused, minChars, maxResults, debounceMs, search])

  const showOverlay = focused && value && value.trim().length >= minChars

  const borderColor = error
    ? colors.status.error
    : focused
    ? colors.primary[700]
    : colors.border.default

  function handleChangeText(text) {
    onChange?.(name, text)
  }

  function handleClear() {
    onChange?.(name, '')
    setResults([])
  }

  function handleFocus() {
    setFocused(true)
  }

  function handleBlur() {
    // Delay para permitir tap na sugestão antes de fechar overlay
    setTimeout(() => {
      setFocused(false)
      onBlur?.(name)
    }, 150)
  }

  function handleSelect(item) {
    const v = getItemValue(item)
    onChange?.(name, v)
    onSelect?.(item)
    setResults([])
    setFocused(false)
  }

  function renderItem({ item }) {
    const label = getItemLabel(item)
    const subtitle = getItemSubtitle?.(item)
    return (
      <Pressable
        style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
        onPress={() => handleSelect(item)}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Text style={styles.itemTitle} numberOfLines={1}>
          {label}
        </Text>
        {subtitle ? (
          <Text style={styles.itemSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </Pressable>
    )
  }

  return (
    <View style={[styles.wrapper, disabled && styles.wrapperDisabled]}>
      {label ? (
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}</Text>
          {required && <Text style={styles.asterisk}> *</Text>}
        </View>
      ) : null}

      {/* Wrapper relativo isolando input+overlay — overlay ancora via
          top: '100%' do inputContainer, independente da altura do label. */}
      <View style={styles.inputBlock}>
        <View style={[styles.inputContainer, { borderColor }]}>
          <Search size={18} color={colors.text.muted} strokeWidth={2} />
          <TextInput
            style={styles.input}
            value={value}
            placeholder={placeholder}
            placeholderTextColor={colors.text.muted}
            editable={!disabled}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onChangeText={handleChangeText}
            autoCorrect={false}
            autoCapitalize="words"
            accessibilityLabel={label}
            accessibilityHint={helperText || placeholder}
            accessibilityState={error ? { invalid: true } : undefined}
          />
          {value ? (
            <Pressable
              onPress={handleClear}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Limpar"
            >
              <X size={18} color={colors.text.muted} strokeWidth={2} />
            </Pressable>
          ) : null}
        </View>

        {showOverlay && (
        <View style={styles.overlay}>
          {searching ? (
            <View style={styles.statusRow}>
              <ActivityIndicator color={colors.primary[700]} />
              <Text style={styles.statusText}>Buscando…</Text>
            </View>
          ) : results.length === 0 ? (
            <View style={styles.statusRow}>
              <Text style={styles.statusText}>Nenhum resultado</Text>
            </View>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(item, idx) => `${getItemValue(item)}-${idx}`}
              renderItem={renderItem}
              keyboardShouldPersistTaps="handled"
              style={styles.list}
            />
          )}
        </View>
        )}
      </View>

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    opacity: 1,
    position: 'relative',
  },
  wrapperDisabled: {
    opacity: 0.6,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text.secondary,
  },
  asterisk: {
    fontSize: 13,
    color: colors.status.error,
  },
  inputBlock: {
    // Wrapper relativo para ancorar o overlay (top: '100%' do input)
    position: 'relative',
  },
  inputContainer: {
    height: 50,
    backgroundColor: colors.bg.card,
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.text.primary,
    padding: 0,
  },
  errorText: {
    fontSize: 12,
    color: colors.status.error,
    marginTop: 6,
  },
  helperText: {
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 6,
  },
  overlay: {
    // Ancorado ao bottom do inputContainer via wrapper relativo inputBlock,
    // imune a alterações na altura do label (sem magic number).
    position: 'absolute',
    top: '100%',
    marginTop: 4,
    left: 0,
    right: 0,
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.md,
    maxHeight: 280,
    zIndex: 10,
    elevation: 8,
    shadowColor: colors.neutral[900],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  list: {
    flexGrow: 0,
  },
  item: {
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  itemPressed: {
    backgroundColor: colors.primary[50],
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text.primary,
  },
  itemSubtitle: {
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
  },
  statusText: {
    fontSize: 13,
    color: colors.text.muted,
  },
})
