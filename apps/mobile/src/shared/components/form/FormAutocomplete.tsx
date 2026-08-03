import { useEffect, useRef, useState, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
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

function AutocompleteItem({
  item,
  idx,
  getItemLabel,
  getItemSubtitle,
  getItemValue,
  onSelect,
}) {
  const label = getItemLabel(item)
  const subtitle = getItemSubtitle?.(item)
  return (
    <Pressable
      key={`${getItemValue(item)}-${idx}`}
      style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
      onPress={() => onSelect(item)}
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

function AutocompleteOverlay({
  show,
  searching,
  results,
  maxResults,
  getItemLabel,
  getItemSubtitle,
  getItemValue,
  onSelect,
}) {
  if (!show) return null
  return (
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
        <ScrollView
          style={styles.list}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          showsVerticalScrollIndicator
        >
          {results.slice(0, maxResults).map((item, idx) => (
            <AutocompleteItem
              key={`${getItemValue(item)}-${idx}`}
              item={item}
              idx={idx}
              getItemLabel={getItemLabel}
              getItemSubtitle={getItemSubtitle}
              getItemValue={getItemValue}
              onSelect={onSelect}
            />
          ))}
        </ScrollView>
      )}
    </View>
  )
}

function useAutocompleteSearch({
  value,
  focused,
  minChars,
  maxResults,
  debounceMs,
  search,
}: {
  value: string
  focused: boolean
  minChars: number
  maxResults: number
  debounceMs: number
  search?: (q: string, max: number) => any[]
}) {
  const [results, setResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<any>(null)

  useEffect(() => {
    if (!focused) return undefined
    const trimmed = value?.trim() ?? ''
    if (trimmed.length < minChars) {
      const t = setTimeout(() => {
        setResults([])
        setSearching(false)
      }, 0)
      return () => clearTimeout(t)
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
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

  return { results, setResults, searching }
}

function useAutocompleteHandlers({
  name,
  onChange,
  onSelect,
  onBlur,
  getItemValue,
  setResults,
  setFocused,
  inputRef,
}: any) {
  const handleChangeText = useCallback((text: string) => {
    onChange?.(name, text)
  }, [name, onChange])

  const handleClear = useCallback(() => {
    onChange?.(name, '')
    setResults([])
  }, [name, onChange, setResults])

  const handleFocus = useCallback(() => {
    setFocused(true)
  }, [setFocused])

  const handleBlur = useCallback(() => {
    setTimeout(() => {
      setFocused(false)
      onBlur?.(name)
    }, 150)
  }, [name, onBlur, setFocused])

  const handleSelect = useCallback((item: any) => {
    const v = getItemValue(item)
    onChange?.(name, v)
    onSelect?.(item)
    setResults([])
    setFocused(false)
    inputRef.current?.blur()
  }, [name, getItemValue, onChange, onSelect, setResults, setFocused, inputRef])

  return { handleChangeText, handleClear, handleFocus, handleBlur, handleSelect }
}

function _renderLabelRow(label?: string, required?: boolean) {
  if (!label) return null
  return (
    <View style={styles.labelRow}>
      <Text style={styles.label}>{label}</Text>
      {required && <Text style={styles.asterisk}> *</Text>}
    </View>
  )
}

function _getBorderColor(error: any, focused: boolean) {
  if (error) return colors.status.error
  if (focused) return colors.primary[700]
  return colors.border.default
}

function _renderFooterText(error?: string, helperText?: string) {
  if (error) return <Text style={styles.errorText}>{error}</Text>
  if (helperText) return <Text style={styles.helperText}>{helperText}</Text>
  return null
}

export default function FormAutocomplete({
  name,
  label,
  value,
  error = undefined,
  placeholder = undefined,
  helperText = undefined,
  required = undefined,
  disabled = undefined,
  search,
  getItemLabel = defaultGetLabel,
  getItemSubtitle = undefined,
  getItemValue = defaultGetValue,
  onChange,
  onSelect = undefined,
  onBlur = undefined,
  minChars = DEFAULT_MIN_CHARS,
  maxResults = DEFAULT_MAX_RESULTS,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: any) {
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<any>(null)

  const { results, setResults, searching } = useAutocompleteSearch({
    value,
    focused,
    minChars,
    maxResults,
    debounceMs,
    search,
  })

  const { handleChangeText, handleClear, handleFocus, handleBlur, handleSelect } = useAutocompleteHandlers({
    name,
    onChange,
    onSelect,
    onBlur,
    getItemValue,
    setResults,
    setFocused,
    inputRef,
  })

  const showOverlay = Boolean(focused && value && value.trim().length >= minChars)
  const borderColor = _getBorderColor(error, focused)

  return (
    <View style={[styles.wrapper, disabled && styles.wrapperDisabled]}>
      {_renderLabelRow(label, required)}

      <View style={styles.inputBlock}>
        <View style={[styles.inputContainer, { borderColor }]}>
          <Search size={18} color={colors.text.muted} strokeWidth={2} />
          <TextInput
            ref={inputRef}
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
            returnKeyType="done"
            blurOnSubmit={false}
            accessibilityLabel={label}
            accessibilityHint={helperText || placeholder}
            aria-invalid={!!error}
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

        <AutocompleteOverlay
          show={showOverlay}
          searching={searching}
          results={results}
          maxResults={maxResults}
          getItemLabel={getItemLabel}
          getItemSubtitle={getItemSubtitle}
          getItemValue={getItemValue}
          onSelect={handleSelect}
        />
      </View>

      {_renderFooterText(error, helperText)}
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
    letterSpacing: 0,
    textAlign: 'left',
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
    overflow: 'hidden',
    zIndex: 10,
    elevation: 8,
    shadowColor: colors.neutral[900],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  list: {
    flexGrow: 0,
    // Viewport do dropdown: rola por dentro (a borda do overlay envolve isto).
    maxHeight: 264,
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
