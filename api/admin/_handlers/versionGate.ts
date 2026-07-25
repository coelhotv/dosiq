// api/admin/_handlers/versionGate.ts
// Handler admin do kill switch de versão mínima (spec 051 / ADR-091 / CON-033 §4).
//
// Vive como RESOURCE do router `api/admin.ts` — sem função serverless nova (R-090, teto de 12 no
// Hobby) — e em diretório `_`-prefixado para a Vercel não tratá-lo como endpoint (R-091).
// Herda a auth de admin do router (R-042: endpoint com `service_role` nunca sem auth).
//
// 🔴 ESTA É A ÚNICA SUPERFÍCIE DE ESCRITA DO GATE. Quem chega aqui pode inutilizar a base instalada
// inteira com um typo em `min_supported_version`. Daí a cerimônia do §Guarda abaixo.
//
// SCHEMA IMPORTADO DO CORE, não copiado (RC3-2 F1). A allowlist de `store_url` é controle de
// segurança (S-8) e precisa ser a MESMA aqui e no cliente. O TODO de `_handlers/nudges.ts` que
// justificava duplicar schema ("import direto quebra em Node ESM puro") está obsoleto:
// `packages/core/package.json` expõe `./schemas` e `./utils` resolvendo para `dist/*.js` sob a
// condição `node`, e `api/chatbot.ts` já importa `@dosiq/core/utils` em produção.

import { validateVersionGateUpdate } from '@dosiq/core/schemas'
import {
  dedupeFleetInstalls,
  countAffectedInstalls,
  fleetWindowStart,
  getRawNow,
  getServerTimestamp,
} from '@dosiq/core/utils'

/** As 5 colunas que o CLIENTE pode ler. O admin lê mais — ele fala por `service_role`. */
const ADMIN_GATE_COLUMNS = 'platform, min_supported_version, is_active, message, store_url, updated_at, updated_by'

/** Erro dedicado da leitura de frota, para o handler distinguir "não medi" de "medi zero". */
class FleetReadError extends Error {}

/**
 * Conta a frota da plataforma e quantas instalações o gate BLOQUEARIA.
 *
 * União `notification_devices ∪ device_activity`, janela de 30 dias, dedupe por
 * `(user_id, platform)` — a lógica mora em `@dosiq/core/utils` e é a MESMA que
 * `scripts/fleet-versions.sh` usa (RC3-2 F3). Duas contagens divergentes significariam recusar a
 * confirmação do operador em plena emergência, ou aceitar uma confirmação sobre outro conjunto.
 *
 * 🔴 FALHA DE LEITURA LEVANTA. Não devolve 0. Nesta direção o fail-open seria permitir bloquear a
 * base sem ter medido o estrago — o oposto do que o fail-open protege no cliente (AP-303, onde não
 * saber precisa deixar o usuário passar).
 */
async function measureFleet(supabase, platform: string, minSupportedVersion: string | null | undefined) {
  const since = fleetWindowStart(getRawNow())

  // Colunas verificadas no banco em 2026-07-25 (R-295): notification_devices tem
  // (user_id, platform, app_version NULLABLE, updated_at); device_activity tem
  // (user_id, platform, app_version, last_seen_at). Os campos de tempo são DIFERENTES entre as
  // fontes de propósito — o core normaliza antes de comparar.
  const devices = await supabase
    .from('notification_devices')
    .select('user_id, platform, app_version, updated_at')
    .gte('updated_at', since)

  if (devices.error) {
    throw new FleetReadError(`notification_devices: ${devices.error.message}`)
  }

  const activity = await supabase
    .from('device_activity')
    .select('user_id, platform, app_version, last_seen_at')
    .gte('last_seen_at', since)

  if (activity.error) {
    throw new FleetReadError(`device_activity: ${activity.error.message}`)
  }

  const installs = dedupeFleetInstalls(devices.data, activity.data)

  return {
    affected: countAffectedInstalls(installs, { platform, minSupportedVersion }),
    platformTotal: installs.filter((i) => i.platform === platform).length,
    fleetTotal: installs.length,
  }
}

/**
 * GET /api/admin?resource=versionGate — estado das 2 linhas, para o painel (PR 1.5c).
 * Lê por `service_role`, então inclui `updated_by`/`updated_at`, que são revogadas para
 * anon/authenticated (S-10).
 */
export async function handleGetVersionGate(req, res, supabase) {
  try {
    const { data, error } = await supabase
      .from('app_version_gate')
      .select(ADMIN_GATE_COLUMNS)
      .order('platform', { ascending: true })

    if (error) {
      console.error('[VersionGate API] List error:', error)
      return res.status(500).json({ error: 'Failed to fetch version gate' })
    }

    return res.status(200).json({ data: data || [] })
  } catch (err) {
    console.error('[VersionGate API] Unexpected error (list):', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

/**
 * PATCH /api/admin?resource=versionGate — grava a linha da plataforma.
 *
 * ══ GUARDA DE RAIO DE IMPACTO (RC-SEC-2 S-7 · ADR-091 D8) ══
 * Ativar exige `acknowledge_affected_devices` igual à contagem que o SERVIDOR faz. A recusa nomeia a
 * contagem correta, então operar por `curl` passa pela mesma cerimônia que o painel — o controle é
 * do servidor, não da tela. Controle que só existe na UI é sugestão: um `PATCH` direto pularia
 * contagem e confirmação.
 *
 * LIMIAR = ZERO: *toda* ativação exige o acknowledge. Um limiar >0 criaria uma faixa "pequena o
 * bastante para não perguntar" e, com ~25 installs, qualquer faixa cobre a base inteira.
 *
 * Exigimos o acknowledge sempre que o alvo é `is_active: true`, mesmo que a linha JÁ esteja ativa —
 * e não só na transição `false → true`. Dois motivos: (a) editar o piso de um gate já ativo muda o
 * raio de impacto tanto quanto ligá-lo; (b) decidir pela transição exigiria ler o estado antes de
 * escrever, e entre a leitura e a escrita o estado pode mudar (TOCTOU) — a versão que não lê não
 * tem a janela.
 *
 * 🔴 DESATIVAR NÃO EXIGE ACKNOWLEDGE. A assimetria é regra, não borda: destravar a base tem de ser
 * imediato e barato, inclusive por quem está com pressa e sem contagem na mão.
 */
export async function handleUpdateVersionGate(req, res, supabase, adminUserId: string) {
  try {
    const validation = validateVersionGateUpdate(req.body)

    // R-286: estreitar com `=== false`. Sob `strict: false` — o regime de `api/` — o `!` não
    // discrimina a união e o acesso a `.data` compilaria no branch errado.
    if (validation.success === false) {
      return res.status(400).json({ error: 'Invalid version gate data', details: validation.errors })
    }

    const { platform, is_active, min_supported_version, message, store_url, acknowledge_affected_devices } =
      validation.data

    if (is_active === true) {
      let fleet
      try {
        fleet = await measureFleet(supabase, platform, min_supported_version)
      } catch (err) {
        if (err instanceof FleetReadError) {
          console.error('[VersionGate API] Fleet read failed, refusing activation:', err.message)
          return res.status(503).json({
            error: 'Não foi possível medir a frota afetada. Ativação recusada até a contagem ser possível.',
          })
        }
        throw err
      }

      // `undefined` é ausência; `0` é confirmação legítima de frota afetada zero (R-104 — nunca
      // colapsar os dois com `||`).
      if (acknowledge_affected_devices === undefined) {
        return res.status(409).json({
          error: 'Ativação exige acknowledge_affected_devices com a contagem exata de instalações afetadas.',
          affected_devices: fleet.affected,
          platform_installs: fleet.platformTotal,
          fleet_installs: fleet.fleetTotal,
        })
      }

      if (acknowledge_affected_devices !== fleet.affected) {
        return res.status(409).json({
          error: 'acknowledge_affected_devices não corresponde à contagem do servidor.',
          acknowledged: acknowledge_affected_devices,
          affected_devices: fleet.affected,
          platform_installs: fleet.platformTotal,
          fleet_installs: fleet.fleetTotal,
        })
      }
    }

    // ⚠️ SEMÂNTICA DE SUBSTITUIÇÃO, não de merge: os 5 campos editáveis são escritos sempre, e o que
    // vier ausente no corpo é gravado como `null`. Deliberado — o domínio é 2 linhas fixas e um
    // formulário edit-only (PR 1.5c) manda o estado completo. Merge parcial seria pior aqui: deixaria
    // um `min_supported_version` órfão de uma ativação anterior sobrevivendo a uma desativação, e o
    // próximo `is_active: true` reaproveitaria um piso que ninguém revisou nesta rodada.
    // Quem for expor um "editar só a mensagem" precisa mandar os 5 campos, não inventar merge aqui.
    const patch = {
      is_active,
      min_supported_version: min_supported_version ?? null,
      message: message ?? null,
      store_url: store_url ?? null,
      updated_at: getServerTimestamp(),
      updated_by: adminUserId,
    }

    const { data, error } = await supabase
      .from('app_version_gate')
      .update(patch)
      .eq('platform', platform)
      .select(ADMIN_GATE_COLUMNS)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // As 2 linhas são semeadas pela migração; chegar aqui significa que alguém as removeu.
        return res.status(404).json({ error: `Linha do gate não encontrada para ${platform}` })
      }
      console.error('[VersionGate API] Update error:', error)
      return res.status(500).json({ error: 'Failed to update version gate' })
    }

    // 🔴 "0 linhas" é FALHA, não sucesso silencioso. Medido no BEGIN..ROLLBACK deste PR: sob RLS sem
    // policy de escrita, o UPDATE afeta 0 linhas e NÃO levanta erro. Sem esta checagem, a UI
    // anunciaria "kill switch ativado" sobre uma escrita que não aconteceu.
    if (!data) {
      console.error('[VersionGate API] Update afetou 0 linhas para', platform)
      return res.status(500).json({ error: 'Update did not affect any row' })
    }

    return res.status(200).json({ success: true, data })
  } catch (err) {
    console.error('[VersionGate API] Unexpected error (update):', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
