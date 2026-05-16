import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db'
import { validateApiKey, extractApiKey } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const apiKey = extractApiKey(request.headers)
  if (!validateApiKey(apiKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const days = request.nextUrl.searchParams.get('days') || '7'
    const daysNum = parseInt(days)

    const dateFrom = new Date()
    dateFrom.setDate(dateFrom.getDate() - daysNum)
    const dateFromStr = dateFrom.toISOString().split('T')[0]

    // Get latest daily summary
    const { data: latestSummary } = await supabaseAdmin
      .from('daily_summary')
      .select('*')
      .order('date', { ascending: false })
      .limit(1)

    // Get competitors with product counts
    const { data: competitors } = await supabaseAdmin
      .from('competitors')
      .select('id, name, category')

    let competitorStats = []
    for (const competitor of competitors || []) {
      const { data: products } = await supabaseAdmin
        .from('products')
        .select('price')
        .eq('competitor_id', competitor.id)

      const { data: reviews } = await supabaseAdmin
        .from('reviews')
        .select('rating')
        .eq('competitor_id', competitor.id)

      const avgPrice = products?.length
        ? products.reduce((sum, p) => sum + p.price, 0) / products.length
        : 0

      const avgRating = reviews?.length
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 0

      competitorStats.push({
        name: competitor.name,
        category: competitor.category,
        productCount: products?.length || 0,
        reviewCount: reviews?.length || 0,
        avgPrice: avgPrice ? parseFloat(avgPrice.toFixed(2)) : 0,
        avgRating: avgRating ? parseFloat(avgRating.toFixed(1)) : 0,
      })
    }

    // Get price comparison for top products
    const { data: topProducts } = await supabaseAdmin
      .from('products')
      .select('name, price, competitor_id, competitors(name)')
      .order('price', { ascending: false })
      .limit(20)

    // Group by product name
    const priceComparison: Record<string, any[]> = {}
    for (const product of topProducts || []) {
      if (!priceComparison[product.name]) {
        priceComparison[product.name] = []
      }
      priceComparison[product.name].push({
        competitor: (product.competitors as any)?.name || 'Unknown',
        price: product.price,
      })
    }

    return NextResponse.json({
      lastUpdate: latestSummary?.[0]?.date,
      summary: latestSummary?.[0]?.summary,
      topChanges: latestSummary?.[0]?.changes?.slice(0, 10) || [],
      competitors: competitorStats.sort((a, b) => b.productCount - a.productCount),
      priceComparison,
      stats: {
        totalCompetitors: competitors?.length || 0,
        totalProducts: topProducts?.length || 0,
      },
    })
  } catch (error) {
    console.error('Dashboard error:', error)
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    )
  }
}
