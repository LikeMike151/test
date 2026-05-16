# Competitor Tracker - Quick Start

Super simpel! Geen Vercel, geen database, geen gedoe. Gewoon Python + Claude API.

## ⚡ 3 Minuten Setup

### 1. Dependencies installeren
```bash
cd competitor-tracker
pip install -r requirements.txt
```

### 2. API Key configureren
```bash
# Maak een .env bestand aan
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env
```

Haal je API key van [console.anthropic.com](https://console.anthropic.com)

### 3. START!
```bash
python competitor_tracker.py
```

Dat's het! 🎉

## Wat gebeurt er

✅ **Direct start:** Scraper runt METEEN voor test
✅ **Scrapet 26+ competitors** - Extract prijzen en info
✅ **Claude analyseert** alles met AI
✅ **Genereert HTML dashboard** - Open `data/dashboard.html` in browser
✅ **Slaat data op** in `data/` folder als JSON
✅ **Plant dagelijkse check** om 23:00

## De Output

Nadat het runt zie je:
- `data/dashboard.html` - Mooi dashboard met alle info
- `data/competitors_latest.json` - Huidige data
- `data/history_YYYYMMDD.json` - Historische data per dag

## Dashboard openen

```bash
# Mac/Linux
open data/dashboard.html

# Windows
start data/dashboard.html
```

Of gewoon in je browser naar: `file:///path/to/data/dashboard.html`

## Logs volgen

Je ziet real-time logs van wat het script doet:
- Welke competitors worden gescraped
- Hoeveel prijzen gevonden
- AI summary genereert
- Wanneer de volgende check is

## Problemen?

**"ANTHROPIC_API_KEY error"**
- Check je `.env` file
- Zorg dat je API key start met `sk-ant-`

**"Connection timeout"**
- Sommige sites blocken scrapers
- Script gaat verder met volgende

**"ModuleNotFoundError"**
- Voer uit: `pip install -r requirements.txt`

## Bestanden

```
competitor-tracker/
├── competitor_tracker.py    ← Het script
├── requirements.txt         ← Dependencies
├── .env                     ← Je API key (je maakt dit aan)
└── data/                    ← Output
    ├── dashboard.html       ← Dashboard (open in browser!)
    ├── competitors_latest.json
    └── history_*.json
```

## Afsluiten

Druk `Ctrl+C` om het script te stoppen.

---

## Hoe het werkt

1. **Script start** → Direct test scrape van alles
2. **Scraped websites** → Haalt inhoud op via BeautifulSoup
3. **Claude analyseert** → LLM extraheert prijzen & samenvatting
4. **Detecteert changes** → Vergelijkt met vorige data
5. **Maakt dashboard** → Mooi HTML bestand
6. **Plant volgende check** → Automatisch om 23:00 dagelijks

Herhaal elke dag om 23:00 automatisch! ✨

Veel succes! 🚀
