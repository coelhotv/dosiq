#!/usr/bin/env python3
"""
Deep Data Mining & Review Analysis for Android Play Store Brazil.
Dataset: playstore_reviews_raw.json (1,892 reviews) and playstore_competitors_raw.json.
"""

import json
import os
import re
from collections import defaultdict, Counter

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
REVIEWS_PATH = os.path.join(DATA_DIR, "playstore_reviews_raw.json")
COMPETITORS_PATH = os.path.join(DATA_DIR, "playstore_competitors_raw.json")

def load_data():
    with open(REVIEWS_PATH, "r", encoding="utf-8") as f:
        reviews_data = json.load(f)
    with open(COMPETITORS_PATH, "r", encoding="utf-8") as f:
        competitors_data = json.load(f)
    return reviews_data, competitors_data

def analyze():
    reviews_data, competitors_data = load_data()
    
    # Flatten reviews from reviews_by_app
    all_reviews = []
    app_meta = {}
    
    if "reviews_by_app" in reviews_data:
        for app_id, app_obj in reviews_data["reviews_by_app"].items():
            app_title = app_obj.get("title", app_id)
            app_meta[app_id] = {
                "title": app_title,
                "count": app_obj.get("count", 0)
            }
            for r in app_obj.get("reviews", []):
                r_copy = dict(r)
                r_copy["app_id"] = app_id
                r_copy["app_title"] = app_title
                all_reviews.append(r_copy)

    print(f"Total reviews loaded: {len(all_reviews)}")

    # Competitor mapping from competitors_raw
    comp_dict = competitors_data.get("competitors", {})

    # 1. Distribution by App and Star Rating
    app_star_dist = defaultdict(lambda: Counter())
    star_dist = Counter()
    app_names = {}

    for r in all_reviews:
        app_id = r.get("app_id", "unknown")
        app_name = r.get("app_title", comp_dict.get(app_id, {}).get("title", app_id))
        app_names[app_id] = app_name
        score = r.get("score", 0)
        star_dist[score] += 1
        app_star_dist[app_id][score] += 1

    print("\n=======================================================")
    print(" 1. STAR DISTRIBUTION ACROSS ALL REVIEWS (1,892)")
    print("=======================================================")
    total_rev = len(all_reviews)
    for s in sorted(star_dist.keys()):
        pct = (star_dist[s] / total_rev) * 100
        print(f"{s}★: {star_dist[s]:4d} reviews ({pct:6.2f}%)")

    # Positive vs Neutral vs Negative
    neg_count = star_dist[1] + star_dist[2]
    neu_count = star_dist[3]
    pos_count = star_dist[4] + star_dist[5]
    print(f"\nSentiment Sentiment Breakdown:")
    print(f"  - Negativo (1★ e 2★): {neg_count:4d} ({neg_count/total_rev*100:6.2f}%)")
    print(f"  - Neutro   (3★)     : {neu_count:4d} ({neu_count/total_rev*100:6.2f}%)")
    print(f"  - Positivo (4★ e 5★): {pos_count:4d} ({pos_count/total_rev*100:6.2f}%)")

    print("\n=======================================================")
    print(" 2. REVIEWS BREAKDOWN BY APP")
    print("=======================================================")
    print(f"{'App Title':<35} | {'App ID':<35} | {'Total':<5} | {'Avg★':<5} | {'1★':<4} {'2★':<4} {'3★':<4} {'4★':<4} {'5★':<4}")
    print("-" * 110)
    for app_id, s_counter in sorted(app_star_dist.items(), key=lambda x: sum(x[1].values()), reverse=True):
        total_app_rev = sum(s_counter.values())
        app_name = app_names.get(app_id, app_id)[:34]
        avg_score = sum(k * v for k, v in s_counter.items()) / total_app_rev if total_app_rev > 0 else 0
        print(f"{app_name:<35} | {app_id:<35} | {total_app_rev:<5} | {avg_score:.2f} | {s_counter[1]:<4} {s_counter[2]:<4} {s_counter[3]:<4} {s_counter[4]:<4} {s_counter[5]:<4}")

    # 3. Pain Points Classification Regex / Keywords
    pain_patterns = {
        "oem_background_alarms": {
            "title": "1. OEM Background Process, Bateria & Falhas de Alarme / Não Toca",
            "regex": re.compile(r"(n[aã]o toca|n[aã]o despert|n[aã]o avisa|n[aã]o funcion|silencio|atrasad|parou de tocar|segundo plano|bateria|xiaomi|samsung|motorola|redmi|poco|miui|hyperos|fechado|bloquead|hiberna|tela apagad|notifica[çc][aã]o sumiu|falha ao alertar|toca quando quer|n[aã]o emite som|sem som|mudo|perdi a hora|esque[çc]o|falha)", re.I)
        },
        "ad_fatigue_monetization": {
            "title": "2. Fadiga de Anúncios, Vídeos Invasivos & Paywalls Abusivos",
            "regex": re.compile(r"(propaganda|an[uú]ncio|comercial|v[ií]deo|pagar|pago|plano|assinatura|mensalidade|anuidade|caro|cobran[çc]a|premium|vers[aã]o pro|gr[aá]tis|roubo|mercen[aá]rio|dinheiro|propaganda chata|tela cheia|anuncio alto|polui[çc][aã]o|bloqueia|comprar|r\$)", re.I)
        },
        "usability_accessibility_elderly": {
            "title": "3. Usabilidade, Acessibilidade, Complexidade, Idosos & Cuidadores",
            "regex": re.compile(r"(idos|velh|m[aã]e|pai|av[oó]|complicad|dif[ií]cil|confus|letr|tamanho|fonte|enxergar|bot[aã]o|interface|cuidador|fam[ií]lia|compartilh|ajud|simples|polu[ií]d|hor[aá]rios variados|intervalo|de 8 em 8|de 6 em 6|cadastro|intuitiv)", re.I)
        },
        "offline_data_failure": {
            "title": "4. Falhas de Conexão, Dependência de Internet & Falha Offline",
            "regex": re.compile(r"(offline|sem internet|sem rede|wifi|wi-fi|dados m[oó]veis|conex[aã]o|4g|5g|fora do ar|carregando|n[aã]o abre sem internet|travou offline|login|servidor|fora de linha|sincroniza|nuvem|perdi os dados|sumiu tudo|apagou)", re.I)
        },
        "sus_prescription_gaps": {
            "title": "5. Lacunas de SUS, Farmácia Popular, Receitas Médicas & Posto de Saúde",
            "regex": re.compile(r"(sus|posto|ubs|unidade b[aá]sica|farm[aá]cia popular|receita|prescri[çc][aã]o|m[eé]dico|gratuito|rem[eé]dio de gra[çc]a|validade da receita|controle especial|retirada|pegar no posto|rem[eé]dio do governo|estoque|reabastecimento|posto de sa[uú]de|farmacia do posto)", re.I)
        }
    }

    pain_stats = {k: {"count": 0, "stars": Counter(), "reviews": [], "apps": Counter()} for k in pain_patterns}
    
    for r in all_reviews:
        text = (r.get("content", "") or "")
        score = r.get("score", 0)
        app_id = r.get("app_id", "unknown")
        app_name = app_names.get(app_id, app_id)
        
        for k, v in pain_patterns.items():
            if v["regex"].search(text):
                pain_stats[k]["count"] += 1
                pain_stats[k]["stars"][score] += 1
                pain_stats[k]["apps"][app_name] += 1
                pain_stats[k]["reviews"].append({
                    "app_id": app_id,
                    "app_name": app_name,
                    "userName": r.get("userName", "Anônimo"),
                    "score": score,
                    "date": r.get("at", ""),
                    "content": text.strip(),
                    "thumbsUp": r.get("thumbsUpCount", 0),
                    "version": r.get("reviewCreatedVersion", "N/A")
                })

    print("\n=======================================================")
    print(" 3. PAIN POINT CLUSTERS QUANTITATIVE BREAKDOWN")
    print("=======================================================")
    for k, v in pain_stats.items():
        total_p = v["count"]
        pct = (total_p / total_rev) * 100
        neg_p = v["stars"][1] + v["stars"][2]
        neg_pct = (neg_p / total_p * 100) if total_p > 0 else 0
        print(f"\n>>> {pain_patterns[k]['title']}")
        print(f"    Total Menções: {total_p} ({pct:.2f}% de todas as 1.892 reviews)")
        print(f"    Distribuição por Estrelas: 1★:{v['stars'][1]:3d} | 2★:{v['stars'][2]:3d} | 3★:{v['stars'][3]:3d} | 4★:{v['stars'][4]:3d} | 5★:{v['stars'][5]:3d}")
        print(f"    Índice de Insatisfação Crítica (1-2★): {neg_p} ({neg_pct:.1f}%)")
        print("    Top 5 Apps mais impactados:")
        for app, count in v["apps"].most_common(5):
            print(f"      • {app}: {count} menções")

    # 4. Detailed OEM Mentions
    oem_keywords = {
        "Xiaomi / Redmi / POCO (MIUI / HyperOS)": re.compile(r"(xiaomi|redmi|poco|miui|hyperos)", re.I),
        "Samsung (One UI / Galaxy)": re.compile(r"(samsung|galaxy|one\s*ui)", re.I),
        "Motorola (Moto G / Edge)": re.compile(r"(motorola|moto\s*g|moto\s*e|moto\s*edge)", re.I),
        "Realme": re.compile(r"(realme)", re.I),
        "Otimização de Bateria / Segundo Plano": re.compile(r"(bateria|segundo plano|segundo-plano|hiberna|otimiza[çc][aã]o|fechado|bloquead|economia de energia|dormindo)", re.I)
    }
    
    print("\n=======================================================")
    print(" 4. OEM & HARDWARE MENTIONS")
    print("=======================================================")
    oem_counts = Counter()
    for r in all_reviews:
        text = r.get("content", "") or ""
        for oem, rgx in oem_keywords.items():
            if rgx.search(text):
                oem_counts[oem] += 1
    for oem, count in oem_counts.items():
        print(f"  • {oem}: {count} menções explícitas")

    # 5. Export summary JSON
    results_summary = {
        "metadata": {
            "total_reviews": total_rev,
            "negative_reviews": neg_count,
            "neutral_reviews": neu_count,
            "positive_reviews": pos_count,
        },
        "star_distribution": dict(star_dist),
        "app_names": app_names,
        "app_star_distribution": {k: dict(v) for k, v in app_star_dist.items()},
        "pain_points": {
            k: {
                "title": pain_patterns[k]["title"],
                "count": v["count"],
                "percentage": round((v["count"] / total_rev) * 100, 2),
                "stars": dict(v["stars"]),
                "top_apps": dict(v["apps"].most_common(10)),
                "sample_quotes": sorted(v["reviews"], key=lambda x: (x["thumbsUp"], len(x["content"])), reverse=True)[:25]
            } for k, v in pain_stats.items()
        },
        "oem_mentions": dict(oem_counts)
    }

    with open(os.path.join(DATA_DIR, "review_mining_summary.json"), "w", encoding="utf-8") as f:
        json.dump(results_summary, f, ensure_ascii=False, indent=2)
    print("\nSaved rich summary to review_mining_summary.json successfully.")

if __name__ == "__main__":
    analyze()
