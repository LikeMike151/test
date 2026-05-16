import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      competitors: {
        Row: {
          id: string
          name: string
          url: string
          category: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['competitors']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['competitors']['Insert']>
      }
      products: {
        Row: {
          id: string
          competitor_id: string
          name: string
          price: number
          kwh: number | null
          sku: string | null
          url: string | null
          last_updated: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['products']['Row'], 'id' | 'created_at' | 'last_updated'>
        Update: Partial<Database['public']['Tables']['products']['Insert']>
      }
      reviews: {
        Row: {
          id: string
          competitor_id: string
          source: 'trustpilot' | 'google' | 'own_site'
          rating: number
          text: string | null
          reviewer_name: string | null
          sentiment: 'positive' | 'negative' | 'neutral' | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['reviews']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['reviews']['Insert']>
      }
      daily_summary: {
        Row: {
          id: string
          date: string
          changes: Record<string, any>
          summary: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['daily_summary']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['daily_summary']['Insert']>
      }
    }
  }
}
