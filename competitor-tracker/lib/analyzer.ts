import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export async function analyzeReviewSentiment(text: string): Promise<'positive' | 'negative' | 'neutral'> {
  try {
    const message = await client.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: `Analyze the sentiment of this review and respond with only one word: positive, negative, or neutral.\n\nReview: "${text}"`,
        },
      ],
    })

    const sentiment = message.content[0].type === 'text'
      ? message.content[0].text.toLowerCase().trim()
      : 'neutral'

    if (['positive', 'negative', 'neutral'].includes(sentiment)) {
      return sentiment as 'positive' | 'negative' | 'neutral'
    }
    return 'neutral'
  } catch (error) {
    console.error('Sentiment analysis error:', error)
    return 'neutral'
  }
}

export interface DailyChange {
  type: 'price_increase' | 'price_decrease' | 'new_product' | 'review_trend' | 'rating_change'
  competitor: string
  product?: string
  oldValue?: number
  newValue?: number
  impact: 'high' | 'medium' | 'low'
  description: string
}

export async function generateDailySummary(changes: DailyChange[]): Promise<string> {
  if (changes.length === 0) {
    return 'No significant changes detected in competitor activity.'
  }

  const topChanges = changes.slice(0, 10)
  const prompt = `Summarize these competitor changes in 2-3 sentences for a business dashboard:

${topChanges.map((c, i) => `${i + 1}. ${c.description}`).join('\n')}

Be concise and focus on business impact.`

  try {
    const message = await client.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    return message.content[0].type === 'text' ? message.content[0].text : ''
  } catch (error) {
    console.error('Summary generation error:', error)
    return 'Summary generation failed.'
  }
}

export async function extractProductMetrics(text: string): Promise<{
  kwh?: number
  capacity?: string
  warranty?: string
}> {
  try {
    const message = await client.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: `Extract battery specifications from this text. Return only JSON with keys: kwh (number), capacity (string), warranty (string).

Text: "${text}"`,
        },
      ],
    })

    const text_content = message.content[0].type === 'text' ? message.content[0].text : '{}'
    try {
      return JSON.parse(text_content)
    } catch {
      return {}
    }
  } catch (error) {
    console.error('Metrics extraction error:', error)
    return {}
  }
}
