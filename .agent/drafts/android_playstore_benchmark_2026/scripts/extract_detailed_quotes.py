#!/usr/bin/env python3
"""
Extract categorized verbatim Brazilian reviews with deep metadata for PLAYSTORE_FASE_3 report.
"""

import json
import os
import re

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
REVIEWS_PATH = os.path.join(DATA_DIR, "playstore_reviews_raw.json")

def main():
    with open(REVIEWS_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    reviews_by_app = data.get("reviews_by_app", {})
    all_reviews = []
    for app_id, app_data in reviews_by_app.items():
        title = app_data.get("title", app_id)
        for r in app_data.get("reviews", []):
            r["app_id"] = app_id
            r["app_title"] = title
            all_reviews.append(r)

    print(f"Total reviews: {len(all_reviews)}")

    # Specific topical searches
    categories = {
        "alarm_silenced_oem": {
            "title": "Alarmes Silenciados, Bloqueio de Segundo Plano e Bateria (OEMs)",
            "rgx": re.compile(r"(n[aã]o toca|n[aã]o desperta|n[aã]o avisa|segundo plano|bateria|silencioso|sem som|mudo|atrasad|parou de tocar|tela apagad|bloqueio|notifica[çc][aã]o|alarme)", re.I),
            "min_score": 1, "max_score": 3
        },
        "ad_fatigue_paywall": {
            "title": "Anúncios Invasivos, Comerciais em Vídeo e Paywalls Abusivos",
            "rgx": re.compile(r"(an[uú]ncio|propaganda|comercial|v[ií]deo|pagar|pago|assinatura|plano|caro|cobran[çc]a|premium|vers[aã]o pro|comprar|r\$|mercen[aá]rio)", re.I),
            "min_score": 1, "max_score": 3
        },
        "usability_elderly_caregiver": {
            "title": "Usabilidade, Acessibilidade para Idosos e Cuidadores Familiares",
            "rgx": re.compile(r"(idos|m[aã]e|pai|av[oó]|complicad|dif[ií]cil|confus|letr|fonte|enxergar|bot[aã]o|cuidador|fam[ií]lia|compartilh|ajud|simples|hor[aá]rio|intervalo)", re.I),
            "min_score": 1, "max_score": 5
        },
        "offline_data_loss": {
            "title": "Falha Offline, Perda de Dados e Dependência de Internet",
            "rgx": re.compile(r"(offline|sem internet|sem rede|wifi|wi-fi|dados m[oó]veis|conex[aã]o|servidor|fora do ar|perdi|sumiu|apagou|login)", re.I),
            "min_score": 1, "max_score": 3
        },
        "sus_posto_receita": {
            "title": "SUS, Posto de Saúde, Validade de Receita e Farmácia Popular",
            "rgx": re.compile(r"(sus|posto|ubs|unidade b[aá]sica|farm[aá]cia popular|receita|prescri[çc][aã]o|gratuito|rem[eé]dio de gra[çc]a|validade|retirada|pegar no posto|falta de rem[eé]dio)", re.I),
            "min_score": 1, "max_score": 5
        }
    }

    categorized = {}
    for cat_key, cat_info in categories.items():
        matched = []
        for r in all_reviews:
            score = r.get("score", 0)
            text = (r.get("content") or "").strip()
            if cat_info["min_score"] <= score <= cat_info["max_score"] and cat_info["rgx"].search(text) and len(text) > 30:
                matched.append({
                    "userName": r.get("userName", "Usuário Google Play"),
                    "app_title": r.get("app_title"),
                    "app_id": r.get("app_id"),
                    "score": score,
                    "date": r.get("at", "")[:10],
                    "content": text,
                    "thumbsUp": r.get("thumbsUpCount", 0)
                })
        
        # Sort by thumbsUp and text length
        matched.sort(key=lambda x: (x["thumbsUp"], len(x["content"])), reverse=True)
        categorized[cat_key] = matched
        print(f"Category '{cat_info['title']}': found {len(matched)} rich reviews.")

    # Save to json
    with open(os.path.join(DATA_DIR, "categorized_rich_quotes.json"), "w", encoding="utf-8") as f:
        json.dump(categorized, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    main()
