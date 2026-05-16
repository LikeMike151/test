# Complete Setup Guide

This guide will walk you through setting up the Competitor Tracker from scratch.

## Prerequisites

- Node.js 18+ installed
- A GitHub account (for deployment)
- A Vercel account (for hosting - free)
- A Supabase account (for database - free tier available)
- An Anthropic API key (for Claude AI)

## Step 1: Setup Supabase Database (15 minutes)

### Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up
2. Click "New Project"
3. Choose your organization, project name, set a password
4. Select a region (pick the closest to your users)
5. Wait for the project to be created (takes ~2 minutes)

### Get Your Credentials

Once the project is created:
1. Go to Project Settings → API
2. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`

### Create Database Tables

1. In Supabase dashboard, go to SQL Editor
2. Click "New Query" and paste the entire SQL from the README.md migration section
3. Click "Run" to create all tables and indexes

✅ Your database is now ready!

## Step 2: Get API Keys (10 minutes)

### Anthropic API Key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign up or log in
3. Go to API Keys
4. Click "Create Key" and copy it
5. Save as `ANTHROPIC_API_KEY`

### Create API Key for Dashboard

Generate a secure random string:

```bash
# On Mac/Linux
openssl rand -base64 32

# Or use an online generator: https://random.org/
# Make it something like: a8B2c9D4E5f6G7h8I9j0K1l2M3n4O5p6
```

Save this as `API_KEY` - you'll use this to log into the dashboard.

## Step 3: Setup Locally (10 minutes)

### Clone and Install

```bash
cd competitor-tracker
npm install
```

### Configure Environment

```bash
# Copy the template
cp .env.example .env.local

# Edit .env.local with your values
nano .env.local  # or use your editor
```

Fill in:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ANTHROPIC_API_KEY=sk-ant-...
API_KEY=your-secure-api-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Initialize Database

```bash
npm run dev
# In another terminal:
curl -X POST http://localhost:3000/api/init \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json"
```

You should see:
```json
{
  "success": true,
  "message": "Database initialized",
  "competitors": 26,
  "ownStores": 2
}
```

### Test the Dashboard

1. Visit http://localhost:3000
2. Enter your `API_KEY`
3. You should see the dashboard with "No significant changes detected..."

✅ Great! Your local setup works!

## Step 4: Deploy to Vercel (15 minutes)

### Create Vercel Account & Deploy

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

Follow the prompts:
- Link to your GitHub account (optional, for auto-deploy)
- Use default settings
- Answer "yes" to create vercel.json

### Add Environment Variables

In Vercel dashboard (or via CLI):

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL
# Paste: https://your-project.supabase.co

vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
# Paste: your-anon-key

vercel env add SUPABASE_SERVICE_ROLE_KEY
# Paste: your-service-role-key

vercel env add ANTHROPIC_API_KEY
# Paste: sk-ant-...

vercel env add API_KEY
# Paste: your-secure-api-key

vercel env add NEXT_PUBLIC_APP_URL
# Paste: https://your-app.vercel.app
```

### Deploy Production

```bash
vercel --prod
```

Your app is now live! 🎉

**Your dashboard URL:** https://your-app.vercel.app

## Step 5: Setup Daily Scraping (5 minutes)

### Option A: GitHub Actions (Recommended)

1. Push your code to GitHub
2. Go to your repo → Settings → Secrets and variables → Actions
3. Add these secrets:
   - `API_KEY`: Your API key
   - `APP_URL`: https://your-app.vercel.app

Done! The scraper runs daily at 11 PM UTC.

### Option B: Schedule Locally

```bash
npm run scrape
```

Keep this running on a computer or server that's on 24/7.

## Verification Checklist

- [ ] Supabase project created and database tables set up
- [ ] Anthropic API key obtained and added to .env.local
- [ ] API_KEY generated for dashboard access
- [ ] Local development works (npm run dev)
- [ ] Dashboard loads at http://localhost:3000
- [ ] API initialization successful
- [ ] App deployed to Vercel
- [ ] Environment variables set in Vercel
- [ ] Daily scraping configured (GitHub Actions or local)

## Troubleshooting

### "Unauthorized" when accessing dashboard
- Check your API_KEY in .env.local matches what you're entering
- Ensure NEXT_PUBLIC_SUPABASE_URL and keys are correct

### Dashboard shows "No data available"
- Run the `/api/init` endpoint to populate competitors
- Wait a few minutes, then run `/api/scrape` manually to test

### Scraper fails to run
- Check logs: Vercel dashboard or GitHub Actions
- Verify API_KEY is set correctly
- Make sure ANTHROPIC_API_KEY is valid

### Database connection errors
- Verify Supabase is running (check dashboard)
- Check NEXT_PUBLIC_SUPABASE_URL is correct
- Ensure firewall isn't blocking Supabase

## Support

- **Local issues:** Check browser console (F12)
- **Database issues:** Use Supabase dashboard to debug
- **Deployment issues:** Check Vercel logs
- **Scheduling issues:** Check GitHub Actions tab

## Next Steps

1. Customize competitor list in `/app/api/init/route.ts`
2. Adjust scraper logic in `/lib/scraper.ts` for your sites
3. Add more review platforms in `/lib/scraper.ts`
4. Customize dashboard layout in `/app/page.tsx`

Enjoy tracking your competitors! 🚀
