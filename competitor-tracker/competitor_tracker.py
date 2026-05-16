import anthropic
import requests
from datetime import datetime
import json
import time
from pathlib import Path
from bs4 import BeautifulSoup
import schedule
from dotenv import load_dotenv
import os

# Load .env file
load_dotenv()

# Configuration
COMPETITORS = [
    {"name": "Marstek", "url": "https://marstek.nl"},
    {"name": "Thuisbatterij.io", "url": "https://thuisbatterij.io"},
    {"name": "Thuisaccu", "url": "https://thuisaccu.nl"},
    {"name": "Baccu", "url": "https://baccu.nl"},
    {"name": "UW Solar Installatie Shop", "url": "https://uwsolarinstallatieshop.nl"},
    {"name": "Nkon", "url": "https://nkon.nl"},
    {"name": "Thuisslimladen", "url": "https://thuisslimladen.nl"},
    {"name": "Batterijenhuis", "url": "https://batterijenhuis.nl"},
    {"name": "Jackery", "url": "https://nl.jackery.com"},
    {"name": "Off Grid Power Station", "url": "https://offgridpowerstation.nl"},
    {"name": "Off Grid Supply", "url": "https://offgridsupply.nl"},
    {"name": "Indevolt", "url": "https://nl.indevolt.com"},
    {"name": "Anker Solix", "url": "https://ankersolix.com"},
    {"name": "Thuisbatterij Nederland", "url": "https://thuisbatterijnederland.nl"},
    {"name": "Zendure", "url": "https://zendure.nl"},
    {"name": "123accu", "url": "https://123accu.nl"},
    {"name": "AEG Thuisbatterij", "url": "https://aegthuisbatterij.nl"},
    {"name": "Ecoflow", "url": "https://ecoflow.nl"},
    {"name": "Ecoflow NL", "url": "https://nl.ecoflow.com"},
    {"name": "Stralend Groen", "url": "https://stralendgroen.nl"},
    {"name": "Solar Power Supply", "url": "https://solarpowersupply.nl"},
    {"name": "Zinvolt", "url": "https://zinvolt.com"},
    {"name": "Zonneplan", "url": "https://zonneplan.nl"},
    {"name": "Homewizard", "url": "https://homewizard.com"},
    {"name": "Solago", "url": "https://solago.nl"},
    {"name": "Stekker Batterij", "url": "https://stekker-batterij.nl"},
]

OWN_STORES = [
    {"name": "Thuisbatterij.nl", "url": "https://thuisbatterij.nl"},
    {"name": "Recharged.nl", "url": "https://recharged.nl"},
]

DATA_DIR = Path("data")
DATA_DIR.mkdir(exist_ok=True)

# Ensure API key is loaded
api_key = os.getenv("ANTHROPIC_API_KEY")
if not api_key:
    raise ValueError("ANTHROPIC_API_KEY not found in .env file")

client = anthropic.Anthropic(api_key=api_key)


def scrape_website(url: str) -> list[dict]:
    """Scrape basic product info from a website"""
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1"
        }
        response = requests.get(url, headers=headers, timeout=10, allow_redirects=True)
        response.raise_for_status()

        soup = BeautifulSoup(response.content, "html.parser")

        # Extract text content for Claude analysis
        text = soup.get_text(separator=" ", strip=True)[:2000]

        return [{"text": text, "url": url}]
    except Exception as e:
        print(f"❌ Error scraping {url}: {str(e)}")
        return []


def analyze_competitor_with_claude(competitor: dict, content: list[dict]) -> dict:
    """Use Claude to analyze competitor website content"""
    try:
        if not content:
            return {
                "name": competitor["name"],
                "url": competitor["url"],
                "products": [],
                "avg_price": 0,
                "summary": "Kon website niet scrapen",
            }

        prompt = f"""Analyze this website content from competitor "{competitor['name']}" and extract:
1. Any product names and prices you can find
2. Estimate average price range
3. What types of batteries/products they sell
4. Key insights about their business

Website text: {content[0]['text']}

Return as JSON with keys: products (list of {{name, price}}), avg_price (number), summary (string)"""

        message = client.messages.create(
            model="claude-opus-4-1-20250805",
            max_tokens=500,
            messages=[{"role": "user", "content": prompt}],
        )

        response_text = message.content[0].text

        # Try to parse JSON from response
        try:
            start = response_text.find("{")
            end = response_text.rfind("}") + 1
            if start >= 0 and end > start:
                data = json.loads(response_text[start:end])
            else:
                data = {}
        except json.JSONDecodeError:
            data = {}

        return {
            "name": competitor["name"],
            "url": competitor["url"],
            "products": data.get("products", []),
            "avg_price": data.get("avg_price", 0),
            "summary": data.get("summary", response_text[:200]),
        }

    except Exception as e:
        print(f"❌ Error analyzing {competitor['name']}: {str(e)}")
        return {
            "name": competitor["name"],
            "url": competitor["url"],
            "products": [],
            "avg_price": 0,
            "summary": f"Analyse mislukt: {str(e)}",
        }


def detect_changes(current_data: list[dict], previous_data: list[dict] = None) -> dict:
    """Detect changes from previous scan"""
    if not previous_data:
        return {"changes": [], "new_competitors": len(current_data)}

    changes = []

    for curr in current_data:
        prev = next((p for p in previous_data if p["name"] == curr["name"]), None)
        if not prev:
            continue

        if curr.get("avg_price", 0) != prev.get("avg_price", 0):
            change = {
                "competitor": curr["name"],
                "type": "price_change",
                "old_price": prev.get("avg_price", 0),
                "new_price": curr.get("avg_price", 0),
                "change_percent": (
                    (
                        (
                            curr.get("avg_price", 0)
                            - prev.get("avg_price", 0)
                        )
                        / (prev.get("avg_price", 1) or 1)
                    )
                    * 100
                ),
            }
            if abs(change["change_percent"]) > 2:
                changes.append(change)

    return {"changes": changes, "total_competitors": len(current_data)}


def generate_summary_with_claude(data: list[dict], changes: dict) -> str:
    """Generate a summary of the day's competitive landscape"""
    try:
        top_competitors = sorted(
            data, key=lambda x: x.get("avg_price", 0), reverse=True
        )[:5]

        prompt = f"""Summarize the competitive landscape for home batteries based on this data:

Top competitors by price:
{json.dumps(top_competitors, indent=2, ensure_ascii=False)}

Recent changes: {changes.get('changes', [])}

Write a 2-3 sentence business summary focusing on:
- Price trends
- Market positioning
- Key competitive threats"""

        message = client.messages.create(
            model="claude-opus-4-1-20250805",
            max_tokens=300,
            messages=[{"role": "user", "content": prompt}],
        )

        return message.content[0].text

    except Exception as e:
        return f"Samenvatting kon niet gegenereerd worden: {str(e)}"


def run_daily_check():
    """Run the daily competitor check"""
    print("\n" + "=" * 60)
    print(f"🔄 Dagelijkse concurrentcheck gestart: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    # Load previous data
    data_file = DATA_DIR / "competitors_latest.json"
    previous_data = None
    if data_file.exists():
        try:
            with open(data_file, "r", encoding="utf-8") as f:
                previous_data = json.load(f).get("competitors", [])
        except:
            pass

    current_data = []

    # Scrape all competitors
    all_competitors = COMPETITORS + OWN_STORES
    print(f"\n📊 Scraping {len(all_competitors)} competitors...")

    for i, competitor in enumerate(all_competitors, 1):
        print(f"  [{i}/{len(all_competitors)}] {competitor['name']}...", end="", flush=True)

        # Scrape
        content = scrape_website(competitor["url"])
        time.sleep(0.5)  # Be nice to servers

        # Analyze with Claude
        analysis = analyze_competitor_with_claude(competitor, content)
        current_data.append(analysis)
        print(f" ✓ (€{analysis.get('avg_price', 0):.0f})")

    # Detect changes
    changes = detect_changes(current_data, previous_data)

    # Generate summary
    print("\n🤖 Generating AI summary...", end="", flush=True)
    summary = generate_summary_with_claude(current_data, changes)
    print(" ✓")

    # Save data
    output_data = {
        "date": datetime.now().isoformat(),
        "competitors": current_data,
        "changes": changes,
        "summary": summary,
    }

    with open(data_file, "w", encoding="utf-8") as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)

    # Save to history
    history_file = DATA_DIR / f"history_{datetime.now().strftime('%Y%m%d')}.json"
    with open(history_file, "w", encoding="utf-8") as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)

    # Generate dashboard
    generate_dashboard(output_data)

    # Print summary
    print("\n" + "=" * 60)
    print("📋 SAMENVATTING:")
    print("=" * 60)
    print(summary)
    print("\n✅ Check voltooid!")
    print(f"📊 Dashboard: data/dashboard.html")
    print(f"📁 Data opgeslagen: {data_file}")
    print("=" * 60 + "\n")

    return output_data


def generate_changes_html(changes: list) -> str:
    """Generate HTML for price changes"""
    if not changes:
        return ""

    change_items = []
    for c in changes:
        direction = 'change-up' if c['change_percent'] > 0 else 'change-down'
        sign = '+' if c['change_percent'] > 0 else ''
        item = f"""<div class="change-item">
                <strong>{c['competitor']}</strong>: €{c['old_price']:.0f} → €{c['new_price']:.0f}
                <span class="{direction}">
                    {sign}{c['change_percent']:.1f}%
                </span>
            </div>"""
        change_items.append(item)

    return f"""<div class="section">
            <h2>⚠️ Prijsveranderingen ({len(changes)})</h2>
            {''.join(change_items)}
        </div>"""


def generate_own_stores_rows(own_stores: list) -> str:
    """Generate HTML table rows for own stores"""
    rows = []
    for c in own_stores:
        row = f"""<tr>
                        <td><strong>{c['name']}</strong></td>
                        <td class="price">€{c.get('avg_price', 0):.2f}</td>
                        <td>{len(c.get('products', []))}</td>
                        <td><span class="badge badge-own">Eigen</span></td>
                    </tr>"""
        rows.append(row)
    return ''.join(rows)


def generate_competitors_rows(competitors_only: list) -> str:
    """Generate HTML table rows for competitors"""
    rows = []
    for c in competitors_only:
        row = f"""<tr>
                        <td><strong>{c['name']}</strong></td>
                        <td class="price">€{c.get('avg_price', 0):.2f}</td>
                        <td>{len(c.get('products', []))}</td>
                        <td><a href="{c['url']}" target="_blank">Bezoeken →</a></td>
                    </tr>"""
        rows.append(row)
    return ''.join(rows)


def generate_dashboard(data: dict):
    """Generate an HTML dashboard"""
    competitors = sorted(
        data["competitors"], key=lambda x: x.get("avg_price", 0), reverse=True
    )

    own_stores = [c for c in competitors if c["name"] in ["Thuisbatterij.nl", "Recharged.nl"]]
    competitors_only = [c for c in competitors if c["name"] not in ["Thuisbatterij.nl", "Recharged.nl"]]

    changes = data.get("changes", {}).get("changes", [])

    html = f"""
<!DOCTYPE html>
<html lang="nl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Competitor Tracker Dashboard</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }}
        .container {{
            max-width: 1400px;
            margin: 0 auto;
        }}
        header {{
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            margin-bottom: 30px;
        }}
        h1 {{
            color: #333;
            margin-bottom: 10px;
        }}
        .meta {{
            color: #666;
            font-size: 14px;
        }}
        .summary {{
            background: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            margin-bottom: 30px;
            border-left: 4px solid #667eea;
        }}
        .summary h2 {{
            color: #333;
            margin-bottom: 15px;
            font-size: 16px;
        }}
        .summary p {{
            color: #555;
            line-height: 1.6;
        }}
        .stats {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }}
        .stat-card {{
            background: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            text-align: center;
        }}
        .stat-value {{
            font-size: 32px;
            font-weight: bold;
            color: #667eea;
            margin: 10px 0;
        }}
        .stat-label {{
            color: #666;
            font-size: 14px;
        }}
        .section {{
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            margin-bottom: 30px;
        }}
        .section h2 {{
            color: #333;
            margin-bottom: 20px;
            border-bottom: 2px solid #667eea;
            padding-bottom: 10px;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
        }}
        thead {{
            background: #f5f5f5;
        }}
        th {{
            padding: 12px;
            text-align: left;
            font-weight: 600;
            color: #333;
            border-bottom: 2px solid #ddd;
        }}
        td {{
            padding: 12px;
            border-bottom: 1px solid #eee;
        }}
        tr:hover {{
            background: #f9f9f9;
        }}
        .price {{
            font-weight: bold;
            color: #667eea;
        }}
        .change-up {{
            color: #e74c3c;
            font-weight: bold;
        }}
        .change-down {{
            color: #27ae60;
            font-weight: bold;
        }}
        .badge {{
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
        }}
        .badge-own {{
            background: #d5f4e6;
            color: #27ae60;
        }}
        .badge-competitor {{
            background: #fadbd8;
            color: #e74c3c;
        }}
        .change-item {{
            background: #f9f9f9;
            padding: 15px;
            margin-bottom: 10px;
            border-radius: 5px;
            border-left: 4px solid #f39c12;
        }}
        .change-item strong {{
            color: #333;
        }}
        footer {{
            text-align: center;
            color: white;
            margin-top: 40px;
            font-size: 12px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>🔍 Competitor Tracker</h1>
            <div class="meta">
                Laatste update: {datetime.fromisoformat(data["date"]).strftime('%d %b %Y om %H:%M')} ⚡
            </div>
        </header>

        <div class="summary">
            <h2>📊 Samenvatting</h2>
            <p>{data["summary"]}</p>
        </div>

        <div class="stats">
            <div class="stat-card">
                <div class="stat-label">Concurrenten</div>
                <div class="stat-value">{len(competitors_only)}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Eigen winkels</div>
                <div class="stat-value">{len(own_stores)}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Prijsveranderingen</div>
                <div class="stat-value">{len(changes)}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Gem. prijs</div>
                <div class="stat-value">€{sum(c.get('avg_price', 0) for c in competitors) / len(competitors):.0f}</div>
            </div>
        </div>

        {generate_changes_html(changes)}

        <div class="section">
            <h2>🏪 Eigen winkels</h2>
            <table>
                <thead>
                    <tr>
                        <th>Winkel</th>
                        <th>Gem. prijs</th>
                        <th>Producten</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    {generate_own_stores_rows(own_stores)}
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2>🎯 Concurrenten ({len(competitors_only)})</h2>
            <table>
                <thead>
                    <tr>
                        <th>Concurrent</th>
                        <th>Gem. prijs</th>
                        <th>Producten</th>
                        <th>Website</th>
                    </tr>
                </thead>
                <tbody>
                    {generate_competitors_rows(competitors_only)}
                </tbody>
            </table>
        </div>

        <footer>
            <p>Competitor Tracker • Automatisch geupdate dagelijks om 23:00</p>
        </footer>
    </div>
</body>
</html>
"""

    with open(DATA_DIR / "dashboard.html", "w", encoding="utf-8") as f:
        f.write(html)


def schedule_daily_task():
    """Schedule the daily task at 23:00"""
    schedule.every().day.at("23:00").do(run_daily_check)

    print("✅ Scheduler gestart - dagelijks check om 23:00")
    print("   Druk Ctrl+C om te stoppen\n")

    # Run once immediately for testing
    print("🚀 Eerste check wordt nu uitgevoerd...\n")
    run_daily_check()

    # Then keep running scheduled checks
    while True:
        schedule.run_pending()
        time.sleep(60)


if __name__ == "__main__":
    schedule_daily_task()
