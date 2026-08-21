#!/usr/bin/env python3
"""
Deep Scraping Pipeline for Google Play Store Brazil (gl=br, hl=pt)
Extracts:
1. Search Intelligence (Keywords, Rankings, Suggestions)
2. Competitor Deep Metadata (Rankings, Downloads, Ratings, Pricing, Descriptions)
3. User Reviews Mining (1★ to 5★ Brazilian reviews)
"""

import json
import os
import sys
import time
import urllib.parse
import urllib.request
import requests
from google_play_scraper import app, reviews, search, Sort

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
os.makedirs(DATA_DIR, exist_ok=True)

# Comprehensive keyword clusters
KEYWORDS_MASS = [
    "lembrete de remedios",
    "alarme de remedio",
    "controle de medicamentos",
    "hora do remedio",
    "caixa de remedios",
    "lembrete de comprimidos",
    "despertador de remedio",
    "organizador de medicamentos",
    "tomar remedio",
    "remedio na hora",
    "pill reminder"
]

KEYWORDS_SUS_PUBLIC = [
    "farmacia popular",
    "remedio sus",
    "remedio posto de saude",
    "receita medica",
    "meu sus digital",
    "remedios gratuitos",
    "controle de receita",
    "posto de saude",
    "sus remedio gratis",
    "validade receita medica"
]

KEYWORDS_CHRONIC_GLP1 = [
    "diabetes",
    "controle de insulina",
    "glicemia e remedios",
    "semaglutida",
    "ozempic",
    "pressao alta remedio",
    "anticoncepcional lembrete",
    "saude da mulher remedio",
    "colesterol remedio",
    "remedio continuo"
]

ALL_KEYWORDS = KEYWORDS_MASS + KEYWORDS_SUS_PUBLIC + KEYWORDS_CHRONIC_GLP1

SUGGEST_SEEDS = [
    "lembrete de ",
    "lembrete de re",
    "alarme de ",
    "alarme de re",
    "controle de ",
    "controle de med",
    "hora do ",
    "hora do re",
    "caixa de ",
    "caixa de re",
    "farmacia ",
    "farmacia pop",
    "remedio ",
    "remedio s",
    "receita ",
    "receita med",
    "meu sus",
    "diabete",
    "insuli",
    "semaglu",
    "ozemp",
    "pressao al",
    "anticoncep"
]

def fetch_suggestions(query, client="firefox"):
    """Fetch autocomplete suggestions for query in pt-BR, gl=BR."""
    try:
        url = "https://suggestqueries.google.com/complete/search"
        params = {
            "client": client,
            "q": query,
            "hl": "pt-BR",
            "gl": "BR"
        }
        res = requests.get(url, params=params, timeout=10)
        if res.status_code == 200:
            data = res.json()
            if isinstance(data, list) and len(data) > 1:
                return data[1]
    except Exception as e:
        print(f"Error fetching suggestions for '{query}': {e}")
    return []

def main():
    print("==========================================================")
    print("STARTING GOOGLE PLAY STORE BRAZIL DATA MINING (gl=BR, hl=pt)")
    print("==========================================================")
    
    # 1. Search Intelligence & Keyword Rankings
    print("\n[STEP 1/3] Collecting Autocomplete Suggestions & Search Rankings...")
    search_intel = {
        "metadata": {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "country": "BR",
            "language": "pt-BR",
            "total_keywords_analyzed": len(ALL_KEYWORDS),
            "clusters": {
                "mass_terms": KEYWORDS_MASS,
                "sus_public_health_terms": KEYWORDS_SUS_PUBLIC,
                "chronic_glp1_terms": KEYWORDS_CHRONIC_GLP1
            }
        },
        "autocomplete_suggestions": {},
        "keyword_rankings": {}
    }
    
    for seed in SUGGEST_SEEDS:
        suggs = fetch_suggestions(seed)
        search_intel["autocomplete_suggestions"][seed] = suggs
        print(f"  Suggestion [{seed}] -> {len(suggs)} suggestions found")
        time.sleep(0.3)
        
    all_discovered_app_ids = set()
    
    for kw in ALL_KEYWORDS:
        print(f"  Querying Play Store for keyword: '{kw}'...")
        try:
            results = search(kw, lang="pt", country="br", n_hits=20)
            formatted_results = []
            for idx, r in enumerate(results):
                app_id = r.get("appId")
                if app_id:
                    all_discovered_app_ids.add(app_id)
                formatted_results.append({
                    "position": idx + 1,
                    "appId": app_id,
                    "title": r.get("title"),
                    "developer": r.get("developer"),
                    "score": r.get("score"),
                    "free": r.get("free"),
                    "price": r.get("price"),
                    "currency": r.get("currency"),
                    "icon": r.get("icon"),
                    "genre": r.get("genre")
                })
            search_intel["keyword_rankings"][kw] = formatted_results
            print(f"    -> Found {len(formatted_results)} ranked apps")
        except Exception as e:
            print(f"    -> Error searching '{kw}': {e}")
            search_intel["keyword_rankings"][kw] = []
        time.sleep(0.5)
        
    intel_path = os.path.join(DATA_DIR, "playstore_search_intelligence.json")
    with open(intel_path, "w", encoding="utf-8") as f:
        json.dump(search_intel, f, indent=2, ensure_ascii=False)
    print(f"\n[OK] Search Intelligence saved to {intel_path}")

    # 2. Competitor App Details Deep Scrape
    print("\n[STEP 2/3] Extracting Deep Competitor Metadata...")
    
    # Well-known competitor list to ensure they are captured even if not in top 20 of one query
    seed_competitors = [
        "eu.smartpatient.mytherapy",                 # MyTherapy Lembrete de Medicamentos
        "com.medisafe.android.client",              # Medisafe Lembrete de Remédios
        "com.alfa.horadoremedio",                    # Hora do Remédio
        "br.com.caixaderemedios",                    # Caixa de Remédios
        "com.app.lembrete_medicamentos",             # Lembrete de Medicamentos
        "com.pillreminder.app",                      # Lembrete de Remédios
        "xyz.rtrvr.pillo",                           # Pillo
        "app.phamcham.mewdicate",                    # Mewdicate
        "com.medcontrol",                            # MedControl
        "com.drg.receita",                           # Receita Médica
        "br.gov.datasus.cns",                        # Meu SUS Digital
        "com.waterdrops.pillreminder",               # Lembrete de Medicamentos Waterdrop
        "com.kreativedev.pillreminder",              # Pill Reminder
        "com.voice_alarm.medicine_reminder",         # Alarme Falante Remédio
        "com.tamada.pillreminder",                   # Alarme de Medicamentos
        "com.cullytechnologies.medicationreminder",  # CareZone / Medication Reminder
        "com.curofy.curofy",                         # Health apps
        "com.dosiq",                                 # Dosiq if present
    ]
    
    for c in seed_competitors:
        all_discovered_app_ids.add(c)
        
    print(f"Total unique app candidates to scrape: {len(all_discovered_app_ids)}")
    
    competitors_dataset = {
        "metadata": {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "country": "BR",
            "language": "pt-BR",
            "total_apps": 0
        },
        "competitors": {}
    }
    
    for app_id in sorted(list(all_discovered_app_ids)):
        print(f"  Scraping app details: {app_id}...")
        try:
            details = app(app_id, lang="pt", country="br")
            competitors_dataset["competitors"][app_id] = {
                "appId": details.get("appId"),
                "title": details.get("title"),
                "summary": details.get("summary"),
                "description": details.get("description"),
                "descriptionHTML": details.get("descriptionHTML"),
                "developer": details.get("developer"),
                "developerId": details.get("developerId"),
                "developerEmail": details.get("developerEmail"),
                "developerWebsite": details.get("developerWebsite"),
                "developerAddress": details.get("developerAddress"),
                "privacyPolicy": details.get("privacyPolicy"),
                "genre": details.get("genre"),
                "genreId": details.get("genreId"),
                "icon": details.get("icon"),
                "headerImage": details.get("headerImage"),
                "screenshots": details.get("screenshots"),
                "video": details.get("video"),
                "videoImage": details.get("videoImage"),
                "score": details.get("score"),
                "ratings": details.get("ratings"),
                "reviews": details.get("reviews"),
                "histogram": details.get("histogram"),
                "installs": details.get("installs"),
                "minInstalls": details.get("minInstalls"),
                "realInstalls": details.get("realInstalls"),
                "price": details.get("price"),
                "free": details.get("free"),
                "currency": details.get("currency"),
                "offersIAP": details.get("offersIAP"),
                "inAppProductPrice": details.get("inAppProductPrice"),
                "androidVersion": details.get("androidVersion"),
                "androidVersionText": details.get("androidVersionText"),
                "contentRating": details.get("contentRating"),
                "adSupported": details.get("adSupported"),
                "containsAds": details.get("containsAds"),
                "released": details.get("released"),
                "updated": details.get("updated"),
                "version": details.get("version"),
                "recentChanges": details.get("recentChanges"),
                "url": details.get("url")
            }
            print(f"    -> OK: {details.get('title')} | Score: {details.get('score')} | Installs: {details.get('installs')}")
        except Exception as e:
            print(f"    -> Warning: Could not scrape {app_id}: {e}")
        time.sleep(0.6)
        
    competitors_dataset["metadata"]["total_apps"] = len(competitors_dataset["competitors"])
    comp_path = os.path.join(DATA_DIR, "playstore_competitors_raw.json")
    with open(comp_path, "w", encoding="utf-8") as f:
        json.dump(competitors_dataset, f, indent=2, ensure_ascii=False)
    print(f"\n[OK] Competitors metadata saved to {comp_path} (Total apps: {len(competitors_dataset['competitors'])})")

    # 3. User Reviews Deep Mining
    print("\n[STEP 3/3] Mining Real Brazilian User Reviews (1★ to 5★)...")
    
    # Priority apps to extract detailed reviews
    priority_apps = [
        "eu.smartpatient.mytherapy",
        "com.medisafe.android.client",
        "com.alfa.horadoremedio",
        "br.com.caixaderemedios",
        "com.pillreminder.app",
        "xyz.rtrvr.pillo",
        "app.phamcham.mewdicate",
        "com.waterdrops.pillreminder",
        "com.voice_alarm.medicine_reminder",
        "br.gov.datasus.cns"
    ]
    
    reviews_dataset = {
        "metadata": {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "country": "BR",
            "language": "pt",
            "total_reviews": 0,
            "apps_analyzed": len(priority_apps)
        },
        "reviews_by_app": {},
        "review_summary_by_sentiment": {
            "1_star": 0,
            "2_star": 0,
            "3_star": 0,
            "4_star": 0,
            "5_star": 0
        }
    }
    
    total_rev_count = 0
    
    for app_id in priority_apps:
        if app_id not in competitors_dataset["competitors"]:
            print(f"  Skipping {app_id} (metadata not found)")
            continue
            
        app_title = competitors_dataset["competitors"][app_id]["title"]
        print(f"  Mining reviews for: {app_title} ({app_id})...")
        
        app_reviews_list = []
        seen_rids = set()
        
        # Scrape Newest reviews
        try:
            rev_new, _ = reviews(
                app_id,
                lang="pt",
                country="br",
                sort=Sort.NEWEST,
                count=100
            )
            for r in rev_new:
                rid = r.get("reviewId")
                if rid and rid not in seen_rids:
                    seen_rids.add(rid)
                    app_reviews_list.append(r)
        except Exception as e:
            print(f"    -> Error fetching newest reviews for {app_id}: {e}")
            
        time.sleep(0.5)
        
        # Scrape Most Relevant / Critical reviews
        try:
            rev_rel, _ = reviews(
                app_id,
                lang="pt",
                country="br",
                sort=Sort.MOST_RELEVANT,
                count=100
            )
            for r in rev_rel:
                rid = r.get("reviewId")
                if rid and rid not in seen_rids:
                    seen_rids.add(rid)
                    app_reviews_list.append(r)
        except Exception as e:
            print(f"    -> Error fetching relevant reviews for {app_id}: {e}")
            
        # Clean reviews for JSON serialization
        cleaned_revs = []
        for r in app_reviews_list:
            score = r.get("score", 0)
            if 1 <= score <= 5:
                reviews_dataset["review_summary_by_sentiment"][f"{score}_star"] += 1
                
            at_val = r.get("at")
            if at_val and hasattr(at_val, "isoformat"):
                at_str = at_val.isoformat()
            else:
                at_str = str(at_val)
                
            reply_at_val = r.get("repliedAt")
            if reply_at_val and hasattr(reply_at_val, "isoformat"):
                reply_at_str = reply_at_val.isoformat()
            else:
                reply_at_str = str(reply_at_val) if reply_at_val else None
                
            cleaned_revs.append({
                "reviewId": r.get("reviewId"),
                "userName": r.get("userName"),
                "userImage": r.get("userImage"),
                "content": r.get("content"),
                "score": score,
                "thumbsUpCount": r.get("thumbsUpCount"),
                "reviewCreatedVersion": r.get("reviewCreatedVersion"),
                "at": at_str,
                "replyContent": r.get("replyContent"),
                "repliedAt": reply_at_str
            })
            
        reviews_dataset["reviews_by_app"][app_id] = {
            "appId": app_id,
            "title": app_title,
            "count": len(cleaned_revs),
            "reviews": cleaned_revs
        }
        total_rev_count += len(cleaned_revs)
        print(f"    -> Extracted {len(cleaned_revs)} Brazilian reviews")
        time.sleep(0.8)
        
    reviews_dataset["metadata"]["total_reviews"] = total_rev_count
    rev_path = os.path.join(DATA_DIR, "playstore_reviews_raw.json")
    with open(rev_path, "w", encoding="utf-8") as f:
        json.dump(reviews_dataset, f, indent=2, ensure_ascii=False)
    print(f"\n[OK] Brazilian Reviews dataset saved to {rev_path} (Total reviews: {total_rev_count})")
    
    print("\n==========================================================")
    print("DATA SCRAPING COMPLETED SUCCESSFULLY!")
    print(f"Total Apps Extracted: {len(competitors_dataset['competitors'])}")
    print(f"Total Reviews Mined: {total_rev_count}")
    print("==========================================================")

if __name__ == "__main__":
    main()
