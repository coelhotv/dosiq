# AP-N20 — useEffect de hidratação sem sincronizar todos os estados derivados

**Categoria:** react_and_ui  
**Severidade:** High  
**Status:** active  
**Detectado em:** PR #510 / Wave N2 (2026-04-28)

## Descrição

Quando uma tela carrega dados remotos via hook (`useProfile`, `useCachedQuery`) e usa um `useEffect` para hidratar estados locais, é fácil esquecer de incluir algum campo na sincronização. O resultado é que o estado local fica com o valor inicial do `useState` em vez do valor real do banco — causando um bug silencioso que só aparece no segundo render (após o dado carregar).

## Exemplo do Bug (antes)

```jsx
const [notificationMode, setNotificationMode] = useState('realtime')  // inicial ok

useEffect(() => {
  if (!settings) return
  setQuietHoursStart(settings.quiet_hours_start ?? '22:00')
  setQuietHoursEnd(settings.quiet_hours_end ?? '07:00')
  setDigestTime(settings.digest_time ?? '07:00')
  // ❌ setNotificationMode AUSENTE → sempre mostra 'realtime' na UI
}, [settings])
```

## Fix Correto

```jsx
useEffect(() => {
  if (!settings) return
  setQuietHoursStart(settings.quiet_hours_start ?? '22:00')
  setQuietHoursEnd(settings.quiet_hours_end ?? '07:00')
  setDigestTime(settings.digest_time ?? '07:00')
  setNotificationMode(settings.notification_mode)  // ✅ schema Zod garante o default
}, [settings])
```

## Corolário: Não duplicar defaults do schema Zod na UI

Se o schema Zod já garante um `.default()` para o campo, a UI não deve usar `?? 'valor'` na hidratação — isso duplica a responsabilidade e esconde parsing failures.

```js
// ✅ Schema Zod (userSettingsSchema.js):
notification_mode: z.enum(['realtime', 'digest_morning', 'silent']).default('realtime')

// ❌ UI (redundante):
setNotificationMode(settings.notification_mode ?? 'realtime')

// ✅ UI (correto — confia no schema):
setNotificationMode(settings.notification_mode)
```

## Checklist de Prevenção

Antes de abrir PR com um `useEffect` de hidratação:
- [ ] Listar todos os `useState` da tela
- [ ] Verificar que cada estado com origem remota tem um `set*()` correspondente no `useEffect`
- [ ] Verificar que não há `?? 'valor'` redundante com `.default()` do schema Zod

## Referências

- PR #510 (`fix/wave-N2/notification-persistence-bug`)
- `packages/core/src/schemas/userSettingsSchema.js`
- R-130 (validação Zod antes de operações no Supabase)
