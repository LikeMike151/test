# Competitor Tracker

A lean, easy-to-use competitor and review tracking dashboard for monitoring 25+ home battery and solar competitors daily.

**Features:**
- 📊 Track prices, reviews, and product changes across competitors
- 🔍 Monitor your own stores (Thuisbatterij.nl, Recharged.nl)
- 💡 AI-powered analysis of market shifts
- 📈 Daily automated checks at 11 PM
- 🔐 Simple API key authentication
- 📱 Clean, non-technical dashboard

## Quick Start

### 1. Setup Supabase Database

1. Create a free account at [supabase.com](https://supabase.com)
2. Create a new project
3. Run the migration SQL:

```sql
-- Competitors table
CREATE TABLE competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  url TEXT NOT NULL,
  category TEXT DEFAULT 'competitor',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Products table
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id UUID REFERENCES competitors(id),
  name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  kwh DECIMAL(5,2),
  sku TEXT,
  url TEXT,
  last_updated TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Reviews table
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id UUID REFERENCES competitors(id),
  source TEXT CHECK (source IN ('trustpilot', 'google', 'own_site')),
  rating DECIMAL(3,1),
  text TEXT,
  reviewer_name TEXT,
  sentiment TEXT CHECK (sentiment IN ('positive', 'negative', 'neutral')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Daily summary table
CREATE TABLE daily_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  changes JSONB,
  summary TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_products_competitor ON products(competitor_id);
CREATE INDEX idx_reviews_competitor ON reviews(competitor_id);
CREATE INDEX idx_daily_date ON daily_summary(date);
```

### 2. Setup Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```bash
# Supabase (from your project settings)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Claude API (get from console.anthropic.com)
ANTHROPIC_API_KEY=sk-ant-...

# Create a secure API key for dashboard access
API_KEY=your-secure-random-key-here

# Your app URL (for GitHub Actions)
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

### 3. Install & Run Locally

```bash
npm install
npm run dev
```

Dashboard: http://localhost:3000
- Enter your API_KEY to access the dashboard

### 4. Initialize Database

```bash
curl -X POST http://localhost:3000/api/init \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## Deployment

### Deploy to Vercel

```bash
vercel deploy
```

Add environment variables in Vercel dashboard (Project Settings → Environment Variables).

### Setup Scheduled Scraping

**Option 1: GitHub Actions (Recommended)**

1. Go to your GitHub repo settings
2. Add these secrets:
   - `API_KEY`: Your API key
   - `APP_URL`: Your deployed app URL (e.g., https://yourapp.vercel.app)

The `.github/workflows/daily-scrape.yml` will run daily at 11 PM UTC.

**Option 2: Local Cron**

```bash
# Install dependencies
npm install

# Start the cron job
npm run scrape
```

## Usage

### Accessing the Dashboard

1. Visit your deployed app
2. Enter your API_KEY
3. View competitor data, price changes, and market insights

### API Endpoints

All endpoints require `Authorization: Bearer YOUR_API_KEY` header.

#### Initialize Database
```
POST /api/init
```
Loads all competitors and your stores into the database.

#### Run Daily Scrape
```
POST /api/scrape
```
Scrapes all competitors and generates daily summary.

#### Get Dashboard Data
```
GET /api/dashboard?days=7
```
Returns competitor stats, price comparisons, and recent changes.

## Competitors Tracked

The tracker monitors these competitors by default:

- Marstek, Thuisbatterij.io, Thuisaccu, Baccu, UW Solar Installatie Shop
- Nkon, Thuisslimladen, Batterijenhuis, Jackery, Off Grid Power Station
- Off Grid Supply, Indevolt, Anker Solix, Thuisbatterij Nederland, Zendure
- 123accu, AEG Thuisbatterij, Ecoflow, Stralend Groen, Solar Power Supply
- Zinvolt, Zonneplan, Homewizard, Solago, Stekker Batterij

Plus your own stores:
- Thuisbatterij.nl
- Recharged.nl

## How It Works

1. **Daily Check (11 PM):** Automated scraper visits all competitor sites
2. **Data Extraction:** Captures product prices, names, and specifications
3. **AI Analysis:** Claude analyzes changes and generates insights
4. **Dashboard:** Non-technical team members see top 10 changes and competitor stats
5. **Alerts:** Significant price or review changes are flagged

## Lean Design

- ✅ Single-page React dashboard
- ✅ Minimal CSS with Tailwind
- ✅ No complex state management
- ✅ Simple API key auth
- ✅ Serverless API routes
- ✅ PostgreSQL for data

## Tech Stack

- **Frontend:** Next.js 16, React 19, Tailwind CSS
- **Backend:** Next.js API Routes, Node.js
- **Database:** Supabase (PostgreSQL)
- **AI:** Anthropic Claude (Haiku + Sonnet)
- **Scraping:** Cheerio, Axios
- **Scheduling:** node-cron, GitHub Actions
- **Deployment:** Vercel

## Support

- API Key: Check `.env.local` for your API_KEY
- Errors: Check browser console and Vercel logs
- Database: Use Supabase dashboard to inspect data
- Scheduling: Check GitHub Actions tab for scrape logs
