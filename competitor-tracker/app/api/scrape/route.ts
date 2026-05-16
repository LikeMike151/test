import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db'
import { validateApiKey, extractApiKey } from '@/lib/auth'
import { scrapeWebsite } from '@/lib/scraper'
import { generateDailySummary, DailyChange } from '@/lib/analyzer'

export async function POST(request: NextRequest) {
  const apiKey = extractApiKey(request.headers)
  if (!validateApiKey(apiKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get all competitors
    const { data: competitors, error: competitorsError } = await supabaseAdmin
      .from('competitors')
      .select('*')

    if (competitorsError) throw competitorsError

    const changes: DailyChange[] = []
    let scrapedCount = 0

    for (const competitor of competitors || []) {
      try {
        // Scrape products
        const products = await scrapeWebsite(competitor.url)

        for (const product of products) {
          // Get latest price for comparison
          const { data: existing } = await supabaseAdmin
            .from('products')
            .select('*')
            .eq('competitor_id', competitor.id)
            .eq('name', product.name)
            .order('created_at', { ascending: false })
            .limit(1)

          const existingProduct = existing?.[0]

          // Upsert product
          await supabaseAdmin.from('products').upsert({
            competitor_id: competitor.id,
            name: product.name,
            price: product.price,
            kwh: product.kwh,
            url: product.url,
            last_updated: new Date().toISOString(),
          })

          // Track price changes
          if (existingProduct) {
            const priceDiff = ((product.price - existingProduct.price) / existingProduct.price) * 100
            if (Math.abs(priceDiff) > 2) { // Only track >2% changes
              const change: DailyChange = {
                type: priceDiff > 0 ? 'price_increase' : 'price_decrease',
                competitor: competitor.name,
                product: product.name,
                oldValue: existingProduct.price,
                newValue: product.price,
                impact: Math.abs(priceDiff) > 10 ? 'high' : 'medium',
                description: `${competitor.name}: ${product.name} changed from €${existingProduct.price} to €${product.price} (${priceDiff > 0 ? '+' : ''}${priceDiff.toFixed(1)}%)`,
              }
              changes.push(change)
            }
          } else {
            changes.push({
              type: 'new_product',
              competitor: competitor.name,
              product: product.name,
              newValue: product.price,
              impact: 'medium',
              description: `${competitor.name}: New product listed - ${product.name} (€${product.price})`,
            })
          }
        }

        scrapedCount++
      } catch (error) {
        console.error(`Error scraping ${competitor.name}:`, error)
      }
    }

    // Generate daily summary
    const summary = await generateDailySummary(changes)

    // Save daily summary
    await supabaseAdmin.from('daily_summary').insert({
      date: new Date().toISOString().split('T')[0],
      changes: changes,
      summary: summary,
    })

    return NextResponse.json({
      success: true,
      scrapedCount,
      changesFound: changes.length,
      topChanges: changes.slice(0, 10),
      summary,
    })
  } catch (error) {
    console.error('Scrape error:', error)
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    )
  }
}
