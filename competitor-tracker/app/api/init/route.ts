import { supabaseAdmin } from '@/lib/db'
import { validateApiKey, extractApiKey } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

const COMPETITORS = [
  { name: 'Marstek', url: 'https://marstek.nl' },
  { name: 'Thuisbatterij.io', url: 'https://thuisbatterij.io' },
  { name: 'Thuisaccu', url: 'https://thuisaccu.nl' },
  { name: 'Baccu', url: 'https://baccu.nl' },
  { name: 'UW Solar Installatie Shop', url: 'https://uwsolarinstallatieshop.nl' },
  { name: 'Nkon', url: 'https://nkon.nl' },
  { name: 'Thuisslimladen', url: 'https://thuisslimladen.nl' },
  { name: 'Batterijenhuis', url: 'https://batterijenhuis.nl' },
  { name: 'Jackery', url: 'https://nl.jackery.com' },
  { name: 'Off Grid Power Station', url: 'https://offgridpowerstation.nl' },
  { name: 'Off Grid Supply', url: 'https://offgridsupply.nl' },
  { name: 'Indevolt', url: 'https://nl.indevolt.com' },
  { name: 'Anker Solix', url: 'https://ankersolix.com' },
  { name: 'Thuisbatterij Nederland', url: 'https://thuisbatterijnederland.nl' },
  { name: 'Zendure', url: 'https://zendure.nl' },
  { name: '123accu', url: 'https://123accu.nl' },
  { name: 'AEG Thuisbatterij', url: 'https://aegthuisbatterij.nl' },
  { name: 'Ecoflow', url: 'https://ecoflow.nl' },
  { name: 'Ecoflow NL', url: 'https://nl.ecoflow.com' },
  { name: 'Stralend Groen', url: 'https://stralendgroen.nl' },
  { name: 'Solar Power Supply', url: 'https://solarpowersupply.nl' },
  { name: 'Zinvolt', url: 'https://zinvolt.com' },
  { name: 'Zonneplan', url: 'https://zonneplan.nl' },
  { name: 'Homewizard', url: 'https://homewizard.com' },
  { name: 'Solago', url: 'https://solago.nl' },
  { name: 'Stekker Batterij', url: 'https://stekker-batterij.nl' },
]

const OWN_STORES = [
  { name: 'Thuisbatterij.nl', url: 'https://thuisbatterij.nl' },
  { name: 'Recharged.nl', url: 'https://recharged.nl' },
]

export async function POST(request: NextRequest) {
  const apiKey = extractApiKey(request.headers)
  if (!validateApiKey(apiKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Initialize competitors
    for (const competitor of COMPETITORS) {
      const { error } = await supabaseAdmin
        .from('competitors')
        .upsert(
          {
            name: competitor.name,
            url: competitor.url,
            category: 'competitor',
          },
          { onConflict: 'name' }
        )
      if (error) console.error('Error upserting competitor:', error)
    }

    // Initialize own stores
    for (const store of OWN_STORES) {
      const { error } = await supabaseAdmin
        .from('competitors')
        .upsert(
          {
            name: store.name,
            url: store.url,
            category: 'own_store',
          },
          { onConflict: 'name' }
        )
      if (error) console.error('Error upserting own store:', error)
    }

    return NextResponse.json({
      success: true,
      message: 'Database initialized',
      competitors: COMPETITORS.length,
      ownStores: OWN_STORES.length,
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
