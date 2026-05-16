import axios from 'axios'
import * as cheerio from 'cheerio'

export interface ScrapedProduct {
  name: string
  price: number
  sku?: string
  url?: string
  kwh?: number
}

export interface ScrapedReview {
  source: 'trustpilot' | 'google' | 'own_site'
  rating: number
  text?: string
  reviewer_name?: string
  date?: string
}

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
}

export async function scrapeCompetitorSite(url: string): Promise<ScrapedProduct[]> {
  try {
    const { data } = await axios.get(url, { headers, timeout: 10000 })
    const $ = cheerio.load(data)

    const products: ScrapedProduct[] = []

    // Generic product selectors - adjust based on site structure
    $('[data-product]').each((_, el) => {
      const name = $(el).attr('data-name') || $(el).find('.product-name').text()
      const priceStr = $(el).attr('data-price') || $(el).find('.price').text()
      const price = parseFloat(priceStr?.replace(/[^\d.,]/g, '').replace(',', '.'))

      if (name && !isNaN(price)) {
        products.push({ name, price })
      }
    })

    return products
  } catch (error) {
    console.error(`Failed to scrape ${url}:`, error)
    return []
  }
}

export async function scrapeTrustpilot(companyName: string): Promise<ScrapedReview[]> {
  try {
    const searchUrl = `https://www.trustpilot.com/search?query=${encodeURIComponent(companyName)}`
    const { data } = await axios.get(searchUrl, { headers, timeout: 10000 })
    const $ = cheerio.load(data)

    const reviews: ScrapedReview[] = []

    // Trustpilot structure - note: this is a simplified selector
    $('[data-review]').slice(0, 5).each((_, el) => {
      const rating = $(el).find('[data-rating]').attr('data-rating')
      const text = $(el).find('.review-content').text()
      const reviewer = $(el).find('.reviewer-name').text()

      if (rating) {
        reviews.push({
          source: 'trustpilot',
          rating: parseInt(rating),
          text: text || undefined,
          reviewer_name: reviewer || undefined,
        })
      }
    })

    return reviews
  } catch (error) {
    console.error(`Failed to scrape Trustpilot for ${companyName}:`, error)
    return []
  }
}

export async function scrapeGoogleReviews(businessName: string, location?: string): Promise<ScrapedReview[]> {
  // Note: Google Reviews typically requires browser automation (Playwright/Puppeteer)
  // This is a placeholder - in production, use Playwright for JS-heavy sites
  try {
    const searchQuery = location
      ? `${businessName} ${location} reviews`
      : `${businessName} reviews`

    console.log(`Would scrape Google for: ${searchQuery}`)
    return []
  } catch (error) {
    console.error(`Failed to scrape Google Reviews:`, error)
    return []
  }
}

export async function scrapeWebsite(url: string): Promise<ScrapedProduct[]> {
  try {
    const { data } = await axios.get(url, { headers, timeout: 10000 })
    const $ = cheerio.load(data)
    const products: ScrapedProduct[] = []

    // Try common product container patterns
    const selectors = [
      '.product',
      '[data-product]',
      '.product-item',
      '.battery-product',
      '.item',
    ]

    for (const selector of selectors) {
      $(selector).each((_, el) => {
        const $el = $(el)
        const name = $el.find('.name, .title, h2, h3').text().trim()
        const priceText = $el.find('.price, [data-price]').text()
        const price = parseFloat(priceText?.replace(/[^\d.,]/g, '').replace(',', '.'))

        if (name && !isNaN(price) && price > 0) {
          const existing = products.find(p => p.name.toLowerCase() === name.toLowerCase())
          if (!existing) {
            products.push({
              name,
              price,
              url: url,
            })
          }
        }
      })

      if (products.length > 0) break
    }

    return products
  } catch (error) {
    console.error(`Failed to scrape ${url}:`, error)
    return []
  }
}
