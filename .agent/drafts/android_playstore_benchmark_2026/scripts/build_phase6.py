# -*- coding: utf-8 -*-
"""
Gerador e Validador Estrito do Relatório Fase 6: Plano de Ação Tático de ASO e Metadados Google Play Store Brasil
Dosiq Android Benchmark (2026)
"""

import os
import re
import unicodedata

APP_TITLE_PRIMARY = "Dosiq: Lembrete de Remédios"
APP_TITLE_VAR_B = "Dosiq: Alarme de Remédio SUS"
APP_TITLE_VAR_C = "Dosiq: Controle Medicamentos"

SHORT_DESC_PRIMARY = "Alarme de remédio confiável, controle de receitas médicas e remédios do SUS."
SHORT_DESC_VAR_B = "Lembrete de remédios sem anúncios, alarme alto offline e controle de receitas."
SHORT_DESC_VAR_C = "Controle de medicamentos, remédios do SUS, Farmácia Popular e receitas médicas."

FULL_DESCRIPTION_OFFICIAL = """O Dosiq é o aplicativo definitivo de lembrete de remédios, alarme de remédio e controle de medicamentos desenvolvido sob medida para a realidade do Brasil. Se você precisa organizar seu tratamento contínuo, controlar remédios do SUS, retirar medicamentos na Farmácia Popular ou monitorar a validade da sua receita médica, o Dosiq oferece uma experiência intuitiva, segura e 100% gratuita.

POR QUE O DOSIQ É A ESCOLHA IDEAL?

1. ALARME DE REMÉDIO QUE TOCA DE VERDADE NO ANDROID
Muitos aplicativos falham no ecossistema Android devido ao encerramento agressivo de processos em segundo plano por marcas como Xiaomi, Samsung e Motorola. O Dosiq conta com um assistente inteligente de configuração anti-bloqueio que assegura que seu alarme de remédio toque com som alto e persistente no horário programado, mesmo com a tela bloqueada ou em modo silencioso. Tenha a certeza de nunca mais esquecer a hora de tomar seus medicamentos.

2. CONTROLE DE MEDICAMENTOS E ESTOQUE DOMICILIAR
Gerencie todos os seus tratamentos com um controle de medicamentos completo e sem complicações:
- Cadastro simplificado com dosagem, horários e intervalos flexíveis (diário, a cada 8 horas, dias alternados ou ciclos complexos).
- Alerta inteligente de reposição de estoque quando as caixas estiverem acabando.
- Registro completo de doses tomadas, adiadas ou esquecidas para acompanhamento médico.
- Um lembrete de remédios eficiente para tratamentos crônicos como hipertensão, diabetes e uso de insulina.

3. INTEGRAÇÃO COM SUS E FARMÁCIA POPULAR
O Dosiq é o primeiro aplicativo desenhado para apoiar a jornada de saúde pública no Brasil:
- Gestão de remédio SUS: acompanhe seus ciclos de retirada mensal na Unidade Básica de Saúde (UBS) e postos de saúde municipais.
- Farmácia Popular: saiba o dia exato em que seu próximo lote de medicamentos gratuitos está liberado para retirada na farmácia conveniada.
- Checklist de documentos obrigatórios: confira se está com documento com foto, CPF, Cartão SUS e receita médica antes de sair de casa.
- Registro de remédio em falta no posto para facilitar cobranças e protocolos na ouvidoria de saúde.

4. GESTÃO DE VALIDADE DA RECEITA MÉDICA
Evite ficar sem seu remédio de uso contínuo por esquecer de renovar a prescrição:
- Alertas antecipados de validade da receita médica (15 dias, 7 dias e 48 horas antes do vencimento) para agendar sua consulta a tempo.
- Suporte para receitas simples, receitas do programa Farmácia Popular (validade de 180 dias) e receita médica de controle especial em duas vias (validade de 30 ou 60 dias).
- Armazenamento seguro de foto da receita médica e anotações sobre o médico assistente.

5. MODO 100% OFFLINE E PRIVACIDADE TOTAL
- Funciona sem internet: todos os alarmes, cadastros e históricos funcionam localmente no seu aparelho, sem consumir sua franquia de dados móveis 4G ou 5G.
- Sem cadastro obrigatório: comece a utilizar seu lembrete de remédios imediatamente sem burocracia ou login forçado.
- Backup local protegido e exportação facilitada de dados.

6. CÍRCULO DE CUIDADO FAMILIAR E COMPARTILHAMENTO
- Exporte relatórios detalhados de adesão em formato PDF para levar às consultas médicas na UBS ou consultório particular.
- Compartilhe sua lista de remédio SUS e necessidades de compra pelo WhatsApp com familiares e cuidadores.
- Modo cuidador com suporte para acompanhar a medicação de idosos com total transparência.

PRINCIPAIS RECURSOS DO DOSIQ:
- Lembrete de remédios inteligente e personalizável.
- Alarme de remédio persistente que não falha no Android.
- Monitoramento de validade para toda receita médica.
- Controle de retirada para quem retira remédio SUS e na Farmácia Popular.
- Controle de medicamentos avançado, seguro, sem anúncios invasivos e 100% gratuito.

Baixe o Dosiq agora mesmo e transforme seu lembrete de remédios e controle de medicamentos na ferramenta mais segura para a sua saúde e da sua família!"""

WHATS_NEW_OFFICIAL = "Novidades da versão: Lembrete de remédios com alarme inteligente anti-bloqueio para Android (Xiaomi, Samsung e Motorola), garantindo que seus medicamentos nunca sejam esquecidos. Adicionamos o controle completo de validade da receita médica (Farmácia Popular e controle especial) e acompanhamento do ciclo de retirada de remédios do SUS na UBS. Funcionamento 100% offline, rápido, seguro e sem anúncios. Cuide da sua saúde com tranquilidade!"

def count_emojis(text):
    cnt = 0
    for ch in text:
        cat = unicodedata.category(ch)
        if cat in ["So", "Cs"] or (0x1F300 <= ord(ch) <= 0x1FAFF) or (0x2600 <= ord(ch) <= 0x27BF):
            cnt += 1
    return cnt

def validate():
    print("=== METRICS ===")
    print("Title Primary Chars:", len(APP_TITLE_PRIMARY))
    print("Short Desc Chars:", len(SHORT_DESC_PRIMARY))
    print("Full Desc Chars:", len(FULL_DESCRIPTION_OFFICIAL))
    print("Full Desc Emojis:", count_emojis(FULL_DESCRIPTION_OFFICIAL))
    print("Whats New Chars:", len(WHATS_NEW_OFFICIAL))
    
    words = FULL_DESCRIPTION_OFFICIAL.split()
    total_words = len(words)
    print("Total words in full desc:", total_words)
    
    terms = [
        ("lembrete de remédios", r"lembrete[s]? de remédio[s]?", 3),
        ("alarme de remédio", r"alarme[s]? de remédio[s]?", 3),
        ("farmácia popular", r"farmácia popular", 2),
        ("receita médica", r"receita[s]? médica[s]?", 2),
        ("remédio sus", r"remédio[s]? (?:do )?sus", 2.5),
        ("controle de medicamentos", r"controle de medicamento[s]?", 3)
    ]
    for label, pattern, wlen in terms:
        matches = re.findall(pattern, FULL_DESCRIPTION_OFFICIAL, flags=re.IGNORECASE)
        cnt = len(matches)
        dens = (cnt * wlen / total_words) * 100
        freq = (cnt / total_words) * 100
        print(f"Term: {label:25} | Count: {cnt:2} | Density: {dens:.2f}% | Freq: {freq:.2f}%")

if __name__ == "__main__":
    validate()
