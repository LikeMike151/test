#!/usr/bin/env node

require('dotenv').config()
const cron = require('node-cron')
const axios = require('axios')

// Run scraper at 11 PM daily (23:00)
const task = cron.schedule('0 23 * * *', async () => {
  console.log(`[${new Date().toISOString()}] Running daily competitor check...`)

  try {
    const response = await axios.post(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/scrape`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${process.env.API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    )

    console.log(`✅ Scrape completed:`)
    console.log(`   - Competitors scraped: ${response.data.scrapedCount}`)
    console.log(`   - Changes detected: ${response.data.changesFound}`)
    console.log(`   - Summary: ${response.data.summary}`)
  } catch (error) {
    console.error(`❌ Scrape failed:`, error.message)
    if (error.response?.data) {
      console.error('Response:', error.response.data)
    }
  }
})

console.log('🚀 Competitor Tracker scheduled task initialized')
console.log('   Next run: Daily at 11 PM (23:00)')

// Keep process running
if (require.main === module) {
  console.log('Press Ctrl+C to stop')
  process.on('SIGINT', () => {
    task.stop()
    console.log('Task stopped')
    process.exit(0)
  })
}

module.exports = task
