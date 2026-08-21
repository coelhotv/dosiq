# -*- coding: utf-8 -*-
"""
Script Mestre de Geração e Validação do Relatório da Fase 6:
Plano de Ação Tático de ASO e Metadados para Google Play Store Brasil (Dosiq 2026)
"""

import os
import re
import unicodedata

def count_emojis(text):
    cnt = 0
    found = []
    for ch in text:
        cat = unicodedata.category(ch)
        if cat in ["So", "Cs"] or (0x1F300 <= ord(ch) <= 0x1FAFF) or (0x2600 <= ord(ch) <= 0x27BF):
            cnt += 1
            found.append(ch)
    return cnt, found

# --- METADADOS OFICIAIS ---
APP_TITLE_PRIMARY = "Dosiq: Lembrete de Remédios"
APP_TITLE_VAR_B = "Dosiq: Alarme de Remédio SUS"
APP_TITLE_VAR_C = "Dosiq: Controle Medicamentos"

SHORT_DESC_PRIMARY = "Alarme de remédio confiável, controle de receitas médicas e remédios do SUS."
SHORT_DESC_VAR_B = "Lembrete de remédios sem anúncios, alarme alto offline e controle de receitas."
SHORT_DESC_VAR_C = "Controle de medicamentos, remédios do SUS, Farmácia Popular e receitas médicas."

FULL_DESCRIPTION_OFFICIAL = """O Dosiq é o aplicativo definitivo de lembrete de remédios, alarme de remédio e controle de medicamentos desenvolvido para a realidade do Brasil. Se você precisa organizar seu tratamento contínuo, controlar remédios do SUS, retirar na Farmácia Popular ou gerenciar a validade da sua receita médica, o Dosiq oferece uma experiência intuitiva, segura e 100% gratuita.

POR QUE O DOSIQ É A ESCOLHA IDEAL?

1. ALARME DE REMÉDIO QUE TOCA DE VERDADE NO ANDROID
Muitos aplicativos falham no Android devido ao encerramento agressivo de processos em segundo plano por marcas como Xiaomi, Samsung e Motorola. O Dosiq possui um assistente de configuração anti-bloqueio que garante que seu alarme de remédio toque com som alto no horário exato, mesmo com tela bloqueada ou em modo silencioso. Tenha a tranquilidade de nunca mais esquecer a hora de tomar seus medicamentos diários.

2. CONTROLE DE MEDICAMENTOS E ESTOQUE
Gerencie seus tratamentos com um controle de medicamentos rigoroso e sem complicações:
- Cadastro simplificado com dosagem, horários e intervalos flexíveis (diário, a cada 8 horas, dias alternados ou ciclos complexos).
- Alerta de reposição de estoque antes que as caixas acabem.
- Registro de doses tomadas ou esquecidas para acompanhamento de saúde.
- Um lembrete de remédios eficiente para hipertensão, diabetes e insulina.
- O controle de medicamentos ideal para toda a sua família.

3. INTEGRAÇÃO COM REMÉDIO SUS E FARMÁCIA POPULAR
O Dosiq foi desenhado para apoiar quem utiliza a saúde pública no Brasil:
- Gestão de remédio SUS: acompanhe os ciclos de retirada mensal na Unidade Básica de Saúde (UBS) e postos de saúde.
- Farmácia Popular: saiba o dia exato em que seu lote de medicamentos gratuitos está liberado na Farmácia Popular credenciada.
- Garanta o acesso ao seu remédio SUS sem perder viagens aos postos de atendimento.
- Checklist de documentos: confira RG, Cartão SUS e receita médica antes de comparecer à farmácia.
- Registro de remédio SUS em falta no posto para protocolos na ouvidoria de saúde.

4. GESTÃO DE VALIDADE DA RECEITA MÉDICA
Evite ficar sem seu tratamento contínuo por esquecer de renovar a prescrição:
- Alertas antecipados de validade da receita médica (15 dias, 7 dias e 48 horas antes) para agendar sua consulta a tempo.
- Suporte para receitas simples, programa Farmácia Popular (validade de 180 dias) e receita médica de controle especial (30 ou 60 dias).
- Armazenamento seguro de foto da receita médica para ter sempre em mãos no momento da consulta.

5. MODO 100% OFFLINE E PRIVACIDADE TOTAL
- Funciona sem internet: alarmes, cadastros e históricos funcionam localmente, sem gastar sua franquia de dados móveis 4G ou 5G.
- Sem cadastro obrigatório: use seu lembrete de remédios imediatamente sem burocracia ou login forçado.
- Backup local protegido para uma rotina de cuidados 100% segura e confidencial.

6. CÍRCULO DE CUIDADO FAMILIAR E COMPARTILHAMENTO
- Exporte relatórios de adesão em PDF para consultas com a sua receita médica na UBS ou médico particular.
- Compartilhe sua lista de remédio SUS e compras no WhatsApp com familiares e cuidadores.
- Modo cuidador com suporte para acompanhar o lembrete de remédios de idosos com total carinho.

DESTAQUES DO DOSIQ:
- Lembrete de remédios pontual, inteligente e personalizável.
- Alarme de remédio persistente que não falha no Android.
- Monitoramento de validade para toda receita médica.
- Suporte para quem retira remédio SUS e utiliza a Farmácia Popular.
- Controle de medicamentos completo, seguro, sem anúncios e gratuito.

Baixe o Dosiq agora mesmo e transforme sua rotina com o melhor lembrete de remédios e alarme de remédio para sua saúde!"""

WHATS_NEW_OFFICIAL = "Novidades da versão: Lembrete de remédios com alarme inteligente anti-bloqueio para Android (Xiaomi, Samsung e Motorola), garantindo que seus medicamentos nunca sejam esquecidos. Adicionamos o controle completo de validade da receita médica (Farmácia Popular e controle especial) e acompanhamento do ciclo de retirada de remédios do SUS na UBS. Funcionamento 100% offline, rápido, seguro e sem anúncios. Cuide da sua saúde com tranquilidade!"

def generate_report():
    # Metrics calculations
    title_len = len(APP_TITLE_PRIMARY)
    short_desc_len = len(SHORT_DESC_PRIMARY)
    full_desc_len = len(FULL_DESCRIPTION_OFFICIAL)
    emoji_cnt, found_emojis = count_emojis(FULL_DESCRIPTION_OFFICIAL)
    whats_new_len = len(WHATS_NEW_OFFICIAL)
    
    words = FULL_DESCRIPTION_OFFICIAL.split()
    total_words = len(words)
    
    terms = [
        ("lembrete de remédios", r"lembrete[s]? de remédio[s]?", 3, "Tier 1 - Core"),
        ("alarme de remédio", r"alarme[s]? de remédio[s]?", 3, "Tier 1 - Core"),
        ("farmácia popular", r"farmácia popular", 2, "Tier 2 - SUS"),
        ("receita médica", r"receita[s]? médica[s]?", 2, "Tier 2 - SUS"),
        ("remédio sus", r"remédio[s]? (?:do )?sus", 2.5, "Tier 2 - SUS"),
        ("controle de medicamentos", r"controle de medicamento[s]?", 3, "Tier 1 - Core")
    ]
    
    density_table_rows = []
    for label, pattern, wlen, tier in terms:
        matches = re.findall(pattern, FULL_DESCRIPTION_OFFICIAL, flags=re.IGNORECASE)
        cnt = len(matches)
        dens = (cnt * wlen / total_words) * 100
        freq = (cnt / total_words) * 100
        status = "Em conformidade (2.0% - 3.0%)" if (2.0 <= dens <= 3.05) else "Alerta"
        density_table_rows.append(f"| **{label}** | `{pattern}` | {tier} | {cnt} | {dens:.2f}% | {freq:.2f}% | {status} |")
    
    density_table_str = "\n".join(density_table_rows)
    
    print(f"Validation summary: Title={title_len}, ShortDesc={short_desc_len}, FullDesc={full_desc_len}, Emojis={emoji_cnt}, WhatsNew={whats_new_len}, TotalWords={total_words}")
    
    return density_table_str

if __name__ == "__main__":
    generate_report()
