"""
Google Play Store Brazil (gl=BR, hl=pt) Data Scraping & Intelligence Extraction Script
Extracts:
1. Play Store Search Autocomplete & Keyword Intelligence
2. Search Rankings & App Metadata for Top Competitors in Brazil
3. Real Brazilian User Reviews (1-5 stars) across Competitors
"""

import json
import os
import sys
import time
import urllib.parse
import urllib.request
import re

try:
    from google_play_scraper import app, reviews, search, Sort
except ImportError:
    # If not installed, we can install via pip or use direct endpoints
    pass

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
os.makedirs(DATA_DIR, exist_ok=True)

# List of keywords to analyze for search intelligence
KEYWORDS = [
    # Mass terms
    "lembrete de remedios",
    "alarme de remedio",
    "controle de medicamentos",
    "hora do remedio",
    "caixa de remedios",
    "lembrete de comprimidos",
    "despertador de remedio",
    "organizador de medicamentos",
    "pill reminder",
    
    # SUS & Public Health & Prescription terms
    "farmacia popular",
    "remedio sus",
    "remedio posto de saude",
    "receita medica",
    "meu sus digital",
    "remedios gratuitos",
    "controle de receita",
    
    # Chronic conditions & GLP-1 & Diabetes terms
    "diabetes",
    "controle de insulina",
    "glicemia e remedios",
    "semaglutida",
    "ozempic",
    "pressao alta remedio",
    "anticoncepcional lembrete",
    "saude da mulher remedio"
]

# Autocomplete seed queries
SEED_PREFIXES = [
    "lembrete de re",
    "alarme de re",
    "controle de med",
    "hora do re",
    "farmacia pop",
    "remedio s",
    "receita med",
    "diabete",
    "insuli",
    "semaglu",
    "ozemp",
    "anticoncep"
]

def fetch_playstore_autocomplete(query):
    """Fetches autocomplete suggestions from Google Play Store suggest endpoint for gl=BR, hl=pt."""
    try:
        url = f"https://market.android.com/suggest/SuggRequest?json=1&c=3&hl=pt-BR&gl=BR&query={urllib.parse.quote(query)}"
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36"
            }
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            # Format usually: [{"s": "suggestion"}, ...]
            suggestions = [item.get("s") for item in data if isinstance(item, dict) and "s" in item]
            return suggestions
    except Exception as e:
        print(f"Error fetching autocomplete for {query}: {e}")
        return []

def main():
    print("=== Starting Google Play Store Brazil Scraping Pipeline ===")
    
    # 1. Search Intelligence
    print("\n--- Phase 1: Search Autocomplete & Keyword Intelligence ---")
    search_intel = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "country": "BR",
        "language": "pt-BR",
        "autocomplete_results": {},
        "keyword_search_rankings": {}
    }
    
    for seed in SEED_PREFIXES:
        suggestions = fetch_playstore_autocomplete(seed)
        print(f"Autocomplete for '{seed}': {suggestions}")
        search_intel["autocomplete_results"][seed] = suggestions
        time.sleep(0.5)
        
    # Search keywords in Play Store
    for kw in KEYWORDS:
        print(f"Searching ranking for '{kw}'...")
        try:
            results = search(kw, lang="pt", country="br", n_hits=15)
            search_intel["keyword_search_rankings"][kw] = results
            print(f"  Found {len(results)} apps for '{kw}'")
        except Exception as e:
            print(f"  Error searching '{kw}': {e}")
            search_intel["keyword_search_rankings"][kw] = []
        time.sleep(0.8)
        
    intel_file = os.path.join(DATA_DIR, "playstore_search_intelligence.json")
    with open(intel_file, "w", encoding="utf-8") as f:
        json.dump(search_intel, f, indent=2, ensure_ascii=False)
    print(f"Saved search intelligence to {intel_file}")

    # 2. Competitors Details
    print("\n--- Phase 2: Competitor Apps Deep Metadata Extraction ---")
    # Identify unique app_ids from top searches
    app_ids = set()
    for kw, results in search_intel["keyword_search_rankings"].items():
        for r in results:
            if "appId" in r:
                app_ids.add(r["appId"])
                
    # Explicit known key competitors in Brazil
    explicit_competitors = [
        "com.medisafe.android.client",              # Medisafe
        "eu.smartpatient.mytherapy",                 # MyTherapy
        "com.alfa.horadoremedio",                    # Hora do Remédio / Hora do Medicamento
        "br.com.caixaderemedios",                    # Caixa de Remédios
        "com.app.lembrete_medicamentos",             # Lembrete de Medicamentos
        "com.medcontrol",                            # MedControl
        "com.drg.receita",                           # Receita Médica / Cuidados
        "br.gov.datasus.cns",                        # Meu SUS Digital
        "br.gov.datasus.meususdigital",              # Meu SUS Digital alternative package
        "com.dosiq",                                 # Dosiq (if indexed)
        "com.pillbox.app",                           # Pillbox
        "com.voice_alarm.medicine_reminder",         # Alarme Falante Remédio
        "com.waterdrops.pillreminder",               # Pill Reminder & Medication Tracker
        "com.kreativedev.pillreminder",              # Lembrete de Pílula
    ]
    app_ids.update(explicit_competitors)
    
    competitors_data = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "country": "BR",
        "language": "pt-BR",
        "apps": {}
    }
    
    for app_id in app_ids:
        print(f"Fetching details for {app_id}...")
        try:
            app_details = app(app_id, lang="pt", country="br")
            competitors_data["apps"][app_id] = app_details
            print(f"  Successfully fetched: {app_details.get('title')} ({app_details.get('installs')}) - Rating: {app_details.get('score')}")
        except Exception as e:
            print(f"  Could not fetch {app_id}: {e}")
        time.sleep(0.8)
        
    comp_file = os.path.join(DATA_DIR, "playstore_competitors_raw.json")
    with open(comp_file, "w", encoding="utf-8") as f:
        json.dump(competitors_data, f, indent=2, ensure_ascii=False)
    print(f"Saved competitors data to {comp_file} (Total: {len(competitors_data['apps'])} apps)")

    # 3. Reviews Mining
    print("\n--- Phase 3: Brazilian User Reviews Extraction (1 to 5 Stars) ---")
    reviews_data = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "country": "BR",
        "language": "pt",
        "reviews_by_app": {}
    }
    
    # Priority apps to extract deep reviews from
    target_review_apps = [
        "com.medisafe.android.client",
        "eu.smartpatient.mytherapy",
        "com.alfa.horadoremedio",
        "br.com.caixaderemedios",
        "com.app.lembrete_medicamentos",
        "com.medcontrol",
        "com.drg.receita",
        "br.gov.datasus.cns",
        "com.waterdrops.pillreminder"
    ]
    
    total_reviews_count = 0
    for app_id in target_review_apps:
        if app_id not in competitors_data["apps"]:
            continue
        print(f"Fetching reviews for {app_id}...")
        try:
            # Fetch up to 100 reviews per app (mix of newest and most relevant)
            app_revs, _ = reviews(
                app_id,
                lang="pt",
                country="br",
                sort=Sort.NEWEST,
                count=80
            )
            app_revs_rel, _ = reviews(
                app_id,
                lang="pt",
                country="br",
                sort=Sort.MOST_RELEVANT,
                count=60
            )
            # Deduplicate reviews by reviewId
            seen_ids = set()
            combined = []
            for r in app_revs + app_revs_rel:
                rid = r.get("reviewId")
                if rid and rid not in seen_ids:
                    seen_ids.add(rid)
                    # format timestamp for json
                    if "at" in r and hasattr(r["at"], "isoformat"):
                        r["at"] = r["at"].isoformat()
                    combined.append(r)
            
            reviews_data["reviews_by_app"][app_id] = {
                "app_title": competitors_data["apps"][app_id].get("title"),
                "count": len(combined),
                "reviews": combined
            }
            total_reviews_count += len(combined)
            print(f"  Got {len(combined)} reviews for {app_id}")
        except Exception as e:
            print(f"  Error fetching reviews for {app_id}: {e}")
        time.sleep(1.0)
        
    reviews_file = os.path.join(DATA_DIR, "playstore_reviews_raw.json")
    with open(reviews_file, "w", encoding="utf-8") as f:
        json.dump(reviews_data, f, indent=2, ensure_ascii=False)
    print(f"Saved {total_reviews_count} reviews across {len(reviews_data['reviews_by_app'])} apps to {reviews_file}")
    
    print("\n=== Scraping Pipeline Completed Successfully ===")

if __name__ == "__main__":
    main()
