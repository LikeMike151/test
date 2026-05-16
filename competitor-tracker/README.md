# Competitor Tracker

Simpel Python script dat dagelijks je 25+ concurrenten monitort. Geen Vercel, geen database, geen gedoe. Gewoon Claude AI + HTML dashboard.

**Features:**
- 📊 Track 25+ competitors (Ecoflow, Jackery, Anker, Solago, etc)
- 🔍 Monitor eigen winkels (Thuisbatterij.nl, Recharged.nl)  
- 💡 Claude AI analyseert prijzen & marktveranderingen
- 📈 Automatische dagelijkse checks om 23:00
- 📊 Mooi HTML dashboard (open in browser)
- 📁 JSON data opslag (geen database nodig)
- ⚡ Direct test run beim starten

## ⚡ 3 Minuten Setup

```bash
# 1. Dependencies
pip install -r requirements.txt

# 2. API key
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env

# 3. START (runt direct + plant dagelijkse check)
python competitor_tracker.py
```

Open dan: `data/dashboard.html` in je browser! 🎉

## Hoe het werkt

1. **Direct start** - Scraper runt METEEN als test
2. **Scraped 26+ concurrenten** - Verzamelt prijzen & info
3. **Claude analyseert** - AI-powered insights
4. **Genereert dashboard** - Mooi HTML bestand
5. **Plant dagelijks check** - Automatisch om 23:00

## Output

```
data/
├── dashboard.html              ← Open in browser!
├── competitors_latest.json     ← Huidge data
└── history_YYYYMMDD.json      ← Dagelijkse archief
```

## Concurrenten Gemonitord

26 concurrenten + eigen winkels:

- Marstek, Thuisbatterij.io, Thuisaccu, Baccu, UW Solar Installatie Shop
- Nkon, Thuisslimladen, Batterijenhuis, Jackery, Off Grid Power Station
- Off Grid Supply, Indevolt, Anker Solix, Thuisbatterij Nederland, Zendure
- 123accu, AEG Thuisbatterij, Ecoflow, Stralend Groen, Solar Power Supply
- Zinvolt, Zonneplan, Homewizard, Solago, Stekker Batterij

**+ Eigen winkels:**
- Thuisbatterij.nl
- Recharged.nl

## Wat je krijgt

**Geen gedoe met:**
- ❌ Vercel deployment
- ❌ Supabase database setup
- ❌ GitHub Actions configuratie
- ❌ Environment variables jungle
- ❌ API keys management

**Gewoon:**
- ✅ Python script
- ✅ Druk op start
- ✅ Dashboard opent zich

## Dashboard Features

📊 **Real-time stats**
- Aantal concurrenten
- Prijsveranderingen
- Gemiddelde prijzen
- Eigen vs concurrenten vergelijking

📈 **Analyse**
- Claude AI summary van marktveranderingen
- Prijstrends
- Competitieve bedreigingen

📁 **Data**
- JSON opslag (makkelijk exporteren)
- Dagelijks archief
- Geen database nodig

## Tech Stack (Super Lean)

- **Language:** Python 3.8+
- **AI:** Anthropic Claude (Haiku)
- **Scraping:** BeautifulSoup + Requests
- **Scheduling:** schedule library
- **Frontend:** HTML + CSS (lokaal)
- **Storage:** JSON files

Dat's het. Klaar. Simpel. 🚀

---

**→ Zie QUICKSTART.md voor stap-voor-stap instructies**
