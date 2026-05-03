/**
 * @fileoverview Componente de QR Code para o Cartão de Emergência.
 * Gera um QR code com dados médicos críticos codificados em base64.
 * Permite download da imagem para uso como tela de bloqueio.
 *
 * @module features/emergency/components/EmergencyQRCode
 * @version 1.0.0
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import QRCode from 'qrcode'
import { getServerTimestamp, parseISO } from '@utils/dateUtils'
import './EmergencyQRCode.css'

/**
 * Props para o componente EmergencyQRCode
 * @typedef {Object} EmergencyQRCodeProps
 * @property {Object} cardData - Dados do cartão de emergência
 * @property {string} cardData.name - Nome do paciente
 * @property {string} [cardData.blood_type] - Tipo sanguíneo
 * @property {string[]} [cardData.allergies] - Lista de alergias
 * @property {Array<{name: string, dosage: string, unit: string}>} medications - Medicamentos ativos
 * @property {string} [lastUpdated] - Data da última atualização
 */

/**
 * Componente que gera e exibe um QR code com dados médicos de emergência.
 *
 * O QR code contém informações essenciais em formato JSON compacto e codificado
 * em base64, permitindo que profissionais de saúde acessem rapidamente os dados
 * em situações de emergência, mesmo sem internet.
 *
 * @param {EmergencyQRCodeProps} props - Propriedades do componente
 * @returns {JSX.Element} Componente de QR code com controles de download
 */
export default function EmergencyQRCode({ cardData, medications, lastUpdated }) {
  // ===== STATES (R-010: Hook Order) =====
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [error, setError] = useState(null)
  const [isGenerating, setIsGenerating] = useState(true)

  // ===== MEMOS (R-010: Hook Order) =====

  /**
   * Formata os dados do cartão para o formato do QR code.
   * Estrutura compacta para economizar espaço no QR.
   *
   * Formato:
   * {
   *   v: "1",           // Versão do formato
   *   n: "Nome",        // Nome do paciente
   *   m: [...],         // Medicamentos (n: nome, d: dose, f: frequência)
   *   a: [...],         // Alergias
   *   bt: "A+",         // Tipo sanguíneo (opcional)
   *   dt: "2026-03-05"  // Data de atualização
   * }
   */
  const qrPayload = useMemo(() => {
    if (!cardData) return null

    const payload = {
      v: '1',
      n: cardData.name || 'Paciente',
      m:
        medications?.map((med) => ({
          n: med.name,
          d: med.dosage ? `${med.dosage}${med.unit ? ` ${med.unit}` : ''}` : '',
          f: med.frequency || '',
        })) || [],
      a: cardData.allergies || [],
      dt: lastUpdated
        ? parseISO(lastUpdated).toISOString().split('T')[0]
        : getServerTimestamp().split('T')[0],
    }

    // Adiciona tipo sanguíneo apenas se não for desconhecido
    if (cardData.blood_type && cardData.blood_type !== 'desconhecido') {
      payload.bt = cardData.blood_type
    }

    return payload
  }, [cardData, medications, lastUpdated])

  /**
   * Gera a string de dados para o QR code.
   * Usa JSON.stringify + base64 para compactação.
   */
  const qrDataString = useMemo(() => {
    if (!qrPayload) return ''

    try {
      const jsonString = JSON.stringify(qrPayload)
      // Usa btoa para base64 (browser API)
      return btoa(unescape(encodeURIComponent(jsonString)))
    } catch (err) {
      console.error('[EmergencyQRCode] Erro ao codificar dados:', err)
      return ''
    }
  }, [qrPayload])

  // ===== EFFECTS (R-010: Hook Order) =====

  /**
   * Gera o QR code quando os dados mudam.
   */
  useEffect(() => {
    if (!qrDataString) {
      // Use timeout para evitar setState síncrono no effect
      const timeoutId = setTimeout(() => setIsGenerating(false), 0)
      return () => clearTimeout(timeoutId)
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsGenerating(true)

    setError(null)

    /**
     * Gera o QR code usando a biblioteca qrcode.
     * Configuração otimizada para legibilidade e tamanho.
     */
    const generateQR = async () => {
      try {
        const dataUrl = await QRCode.toDataURL(qrDataString, {
          width: 256,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
          errorCorrectionLevel: 'M', // Medium - bom equilíbrio entre capacidade e tamanho
          type: 'image/png',
        })

        setQrDataUrl(dataUrl)
        setIsGenerating(false)
      } catch (err) {
        console.error('[EmergencyQRCode] Erro ao gerar QR:', err)
        setError('Não foi possível gerar o QR code. Tente novamente.')
        setIsGenerating(false)
      }
    }

    generateQR()
  }, [qrDataString])

  // ===== HANDLERS (R-010: Hook Order) =====

  /**
   * Faz o download da imagem do QR code.
   * Salva como PNG com nome descritivo.
   */
  const handleDownload = useCallback(() => {
    if (!qrDataUrl) return

    try {
      const link = document.createElement('a')
      link.href = qrDataUrl
      link.download = `cartao-emergencia-${qrPayload?.n?.replace(/\s+/g, '-').toLowerCase() || 'dosiq'}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      console.error('[EmergencyQRCode] Erro ao baixar:', err)
      setError('Não foi possível baixar a imagem. Tente novamente.')
    }
  }, [qrDataUrl, qrPayload])

  /**
   * Compartilha a imagem usando a Web Share API (mobile).
   * Fallback para download em desktops.
   */
  const handleShare = useCallback(async () => {
    if (!qrDataUrl) return

    try {
      // Converte data URL para Blob
      const response = await fetch(qrDataUrl)
      const blob = await response.blob()
      const file = new File([blob], 'cartao-emergencia.png', { type: 'image/png' })

      // Tenta usar Web Share API
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'Cartão de Emergência',
          text: 'Meu cartão de emergência médica',
          files: [file],
        })
      } else {
        // Fallback para download
        handleDownload()
      }
    } catch (err) {
      // Ignora erro de cancelamento pelo usuário
      if (err.name !== 'AbortError') {
        console.error('[EmergencyQRCode] Erro ao compartilhar:', err)
        handleDownload()
      }
    }
  }, [qrDataUrl, handleDownload])

  // ===== RENDER =====

  if (isGenerating) {
    return (
      <div className="emergency-qr-code loading">
        <div className="qr-loading-spinner"></div>
        <p>Gerando QR code...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="emergency-qr-code error">
        <div className="qr-error-icon">⚠️</div>
        <p>{error}</p>
        <button className="btn btn-secondary btn-sm" onClick={() => setError(null)}>
          Tentar Novamente
        </button>
      </div>
    )
  }

  if (!qrDataUrl) {
    return (
      <div className="emergency-qr-code empty">
        <p>Dados insuficientes para gerar QR code.</p>
      </div>
    )
  }

  return (
    <div className="emergency-qr-code">
      <div className="qr-code-container">
        <img
          src={qrDataUrl}
          alt="QR Code do Cartão de Emergência"
          className="qr-code-image"
          width={256}
          height={256}
        />
        <p className="qr-hint">📱 Escaneie para ver informações médicas em emergências</p>
      </div>

      <div className="qr-actions">
        <button className="btn btn-primary" onClick={handleDownload}>
          💾 Salvar Imagem
        </button>
        <button className="btn btn-secondary" onClick={handleShare}>
          📤 Compartilhar
        </button>
      </div>

      <div className="qr-info">
        <p className="qr-info-text">
          <strong>Dica:</strong> Salve esta imagem como tela de bloqueio do seu celular para acesso
          rápido em emergências.
        </p>
      </div>
    </div>
  )
}
