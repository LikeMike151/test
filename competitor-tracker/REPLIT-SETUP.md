# 🚀 Competitor Tracker - Replit Cloud Setup

Dit is je complete guide om het script **altijd draaiend** in Replit Cloud te hebben.

## 📋 Stap 1: Upload naar Replit

### Optie A: Direct Upload (Makkelijks)
1. Ga naar [replit.com](https://replit.com)
2. Klik **"Create Repl"**
3. Kies **"Import from File"**
4. Upload **`competitor-tracker.zip`**
5. Replit unpakt automatisch alles

### Optie B: Via GitHub (Beter)
1. Push de branch naar GitHub
2. Ga naar [replit.com](https://replit.com)
3. Klik **"Create Repl"** → **"Import from GitHub"**
4. Paste: `https://github.com/LikeMike151/test.git`
5. Selecteer branch: `claude/competitor-review-tracker-b68Wo`

---

## 🔑 Stap 2: Environment Variables (BELANGRIJK!)

In Replit moeten je secrets/API keys veilig staan:

1. Klik het **"Secrets"** oogje icon (linkerkant)
2. Voeg toe:
   ```
   ANTHROPIC_API_KEY = sk-ant-YOUR_KEY_HERE
   ```
3. Druk **Enter** → saved!

**NIET in `.env` file zetten!** Replit injecteert het automatisch.

---

## ⚙️ Stap 3: Dependencies Installeren

1. Open **Terminal** in Replit
2. Type:
   ```bash
   pip install -r requirements.txt
   ```
3. Wacht tot alles installed

---

## 🎯 Stap 4: Test Run

1. Klik **"Run"** knop (of Ctrl+Enter)
2. Je ziet:
   ```
   ✅ Scheduler gestart - dagelijks check om 23:00
   🚀 Eerste check wordt nu uitgevoerd...
   ```
3. Wacht 2-3 minuten tot compleet
4. Je ziet: `✅ Check voltooid!`

---

## 📊 Stap 5: Dashboard Bekijken

Na het eerste run, je hebt nu:
- ✅ `data/dashboard.html`
- ✅ `data/competitors_latest.json`

### HTML Dashboard in Browser:
1. In Replit → **Files** (linkerkant)
2. Ga naar `data/dashboard.html`
3. Right-click → **"Open in new tab"**
4. Voilà! 📊 Je dashboard!

---

## 🔄 Stap 6: Automatische Dagelijkse Checks (24/7)

### Optie A: Replit Always On (Betaald)
Het script draait nu maar **stopt als je het sluit**. Voor 24/7 werking:

1. **Replit Boosts/Pro** (betaald feature)
   - Kost $10/maand
   - Repl draait altijd
   - Script runt dagelijks om 23:00

2. Klik het ⭐ icoon bovenaan → **"Always On"**

### Optie B: Gratis - Manual Trigger (Aanbevolen)
Je runt het script 1x per dag handmatig:

1. Ga naar je Repl
2. Klik **"Run"** elke ochtend
3. Script doet dagelijkse check
4. Check results in `data/dashboard.html`

### Optie C: GitHub Actions (Gratis & Automatisch)
Laat GitHub het voor je doen:

1. **Push je code naar GitHub**
2. GitHub Actions runt automatisch dagelijks om 23:00
3. Resultaten gaan naar Replit

Zie `.github/workflows/daily-scrape.yml` voor details.

---

## 📱 Team Access - Dashboard Delen

### Maak het Openbaar:
1. Klik **"Share"** (rechtsboven in Replit)
2. Klik **"Invite"** → toggle **"Public"**
3. Iedereen kan nu zien: `https://replit.com/@YourName/competitor-tracker`

### Dashboard Link Delen:
Na je eerste run, deel je team de **`data/dashboard.html` URL**:

```
https://replit.com/@YourName/competitor-tracker/webview/data/dashboard.html
```

---

## 🛠️ Troubleshooting

### "ANTHROPIC_API_KEY not found"
- Check je Secrets zijn correct ingesteld
- Herstart de Repl (Stop → Run)

### "ModuleNotFoundError"
```bash
# In Terminal:
pip install -r requirements.txt
```

### "403 Forbidden" Errors
- Dit is normaal - sommige sites blocken bots
- Script gaat door met volgende

### Dashboard niet zichtbaar
1. Checken dat script compleet is (zie terminal)
2. Kijk in **Files** → `data/dashboard.html`
3. Right-click → Open in new tab

---

## 📝 Daily Workflow

**Je team doet:**
1. Opent: `https://replit.com/@YourName/competitor-tracker`
2. Ziet automatische updates
3. Bekijkt dashboard in browser
4. Ziet live data van alle 26 concurrenten

**Geen setup nodig na eerste keer!** ✨

---

## 🔐 Security Notes

- **API Key:** Never push naar GitHub! Altijd in Replit Secrets
- **Data:** Automatisch opgeslagen in Replit files
- **Backups:** GitHub serves als version control

---

## 📞 Commands Reference

```bash
# Test run
python competitor_tracker.py

# Check dependencies
pip list

# View logs
cat run.log
```

---

## 🎯 Volgende Stappen

1. ✅ Upload naar Replit
2. ✅ Zet API key in Secrets
3. ✅ Klik Run
4. ✅ Open dashboard in browser
5. ✅ Share met team

**Je bent klaar!** 🎉

Vragen? Zeg het! 👍
