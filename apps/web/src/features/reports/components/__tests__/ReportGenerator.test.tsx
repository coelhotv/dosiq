// Tela do relatório na web (spec 097 A2, D-A2-2 — períodos fixos, sem link, estados, baixar/compartilhar).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  fetchClinicalReport: vi.fn(),
  warmReportEndpoint: vi.fn(),
  downloadReportFile: vi.fn(),
  shareReportFile: vi.fn(),
  canShareReportFile: vi.fn(),
}))

vi.mock('@/features/reports/services/reportDownloadFlow', () => mocks)

import ReportGenerator from '../ReportGenerator'

const FILE = { file: new File(['%PDF'], 'dosiq-relatorio-30d-2026-10-03.pdf'), filename: 'dosiq-relatorio-30d-2026-10-03.pdf' }

describe('ReportGenerator', () => {
  beforeEach(() => {
    mocks.canShareReportFile.mockReturnValue(true)
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('pré-aquece o servidor ao abrir', async () => {
    render(<ReportGenerator />)
    await waitFor(() => expect(mocks.warmReportEndpoint).toHaveBeenCalledTimes(1))
  })

  it('oferece só 7/30/90/180 dias, padrão 30, sem "Todo o período" nem link', () => {
    render(<ReportGenerator />)
    const select = screen.getByLabelText('Período') as HTMLSelectElement
    expect([...select.options].map((o) => o.value)).toEqual(['7', '30', '90', '180'])
    expect(select.value).toBe('30')
    expect(screen.queryByText('Todo o período')).toBeNull()
    expect(screen.queryByText(/72 horas|Copiar/)).toBeNull()
  })

  it('gera com o período escolhido; pronto oferece Baixar e Compartilhar', async () => {
    mocks.fetchClinicalReport.mockResolvedValue(FILE)
    render(<ReportGenerator />)
    fireEvent.change(screen.getByLabelText('Período'), { target: { value: '90' } })
    fireEvent.click(screen.getByText('Gerar PDF Clínico'))
    await waitFor(() => expect(mocks.fetchClinicalReport).toHaveBeenCalledWith(90))
    fireEvent.click(await screen.findByText('Baixar PDF'))
    await waitFor(() => expect(mocks.downloadReportFile).toHaveBeenCalledWith(FILE))
    fireEvent.click(screen.getByText('Compartilhar'))
    await waitFor(() => expect(mocks.shareReportFile).toHaveBeenCalledWith(FILE))
  })

  it('sem compartilhamento de arquivo no navegador, só Baixar', async () => {
    mocks.canShareReportFile.mockReturnValue(false)
    mocks.fetchClinicalReport.mockResolvedValue(FILE)
    render(<ReportGenerator />)
    fireEvent.click(screen.getByText('Gerar PDF Clínico'))
    expect(await screen.findByText('Baixar PDF')).toBeInTheDocument()
    expect(screen.queryByText('Compartilhar')).toBeNull()
  })

  it('carregando bloqueia o segundo toque', async () => {
    let release: (v: typeof FILE) => void = () => {}
    mocks.fetchClinicalReport.mockImplementation(() => new Promise((r) => (release = r)))
    render(<ReportGenerator />)
    fireEvent.click(screen.getByText('Gerar PDF Clínico'))
    await waitFor(() => expect(screen.getByText('Gerando...')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Gerando...'))
    expect(mocks.fetchClinicalReport).toHaveBeenCalledTimes(1)
    release(FILE)
    expect(await screen.findByText('Baixar PDF')).toBeInTheDocument()
  })

  it('erro mostra mensagem simples, mantém o período e permite tentar de novo', async () => {
    mocks.fetchClinicalReport.mockRejectedValueOnce(Object.assign(new Error('Glifage: falha'), { code: 'collect' }))
    render(<ReportGenerator />)
    fireEvent.change(screen.getByLabelText('Período'), { target: { value: '7' } })
    fireEvent.click(screen.getByText('Gerar PDF Clínico'))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Não foi possível gerar o relatório')
    expect(alert).not.toHaveTextContent('Glifage')
    expect((screen.getByLabelText('Período') as HTMLSelectElement).value).toBe('7')
    mocks.fetchClinicalReport.mockResolvedValueOnce(FILE)
    fireEvent.click(screen.getByText('Tentar de novo'))
    await waitFor(() => expect(mocks.fetchClinicalReport).toHaveBeenLastCalledWith(7))
  })

  it('limite de pedidos tem mensagem própria', async () => {
    mocks.fetchClinicalReport.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'rate_limited' }))
    render(<ReportGenerator />)
    fireEvent.click(screen.getByText('Gerar PDF Clínico'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Aguarde um minuto')
  })
})
