'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'

interface CompetitorStat {
  name: string
  category: string
  productCount: number
  reviewCount: number
  avgPrice: number
  avgRating: number
}

interface DailyChange {
  type: string
  competitor: string
  product?: string
  impact: string
  description: string
}

interface DashboardData {
  lastUpdate: string
  summary: string
  topChanges: DailyChange[]
  competitors: CompetitorStat[]
  priceComparison: Record<string, any[]>
  stats: {
    totalCompetitors: number
    totalProducts: number
  }
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [showApiInput, setShowApiInput] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)

  const fetchDashboard = async (key: string) => {
    try {
      setLoading(true)
      const response = await fetch('/api/dashboard', {
        headers: {
          'Authorization': `Bearer ${key}`,
        },
      })

      if (response.status === 401) {
        setError('Invalid API key')
        setAuthenticated(false)
        return
      }

      if (!response.ok) {
        throw new Error('Failed to fetch dashboard')
      }

      const dashboardData = await response.json()
      setData(dashboardData)
      setError(null)
      setAuthenticated(true)
      setShowApiInput(false)
      localStorage.setItem('tracker_api_key', key)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setAuthenticated(false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const savedKey = localStorage.getItem('tracker_api_key')
    if (savedKey) {
      setApiKey(savedKey)
      fetchDashboard(savedKey)
      setShowApiInput(false)
    } else {
      setLoading(false)
    }
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (apiKey.trim()) {
      fetchDashboard(apiKey)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('tracker_api_key')
    setApiKey('')
    setShowApiInput(true)
    setAuthenticated(false)
    setData(null)
  }

  if (!authenticated && showApiInput) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Competitor Tracker</h2>
          <p className="text-gray-600 mb-6">Enter your API key to access the dashboard</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                API Key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter API key"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            {error && <div className="text-red-600 text-sm">{error}</div>}
            <button
              type="submit"
              disabled={loading}
              className="w-full btn btn-primary disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Access Dashboard'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="container max-w-7xl mx-auto">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="container max-w-7xl mx-auto py-12">
        <div className="text-center">
          <p className="text-gray-600 mb-4">No data available</p>
          <button onClick={handleLogout} className="btn btn-secondary">
            Re-enter API Key
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="container max-w-7xl mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          {data.lastUpdate && (
            <p className="text-gray-600 text-sm mt-2">
              Last update: {format(new Date(data.lastUpdate), 'PPP p')}
            </p>
          )}
        </div>
        <button onClick={handleLogout} className="btn btn-secondary">
          Logout
        </button>
      </div>

      {/* Summary Card */}
      {data.summary && (
        <div className="card bg-gradient-to-r from-blue-50 to-indigo-50 mb-8 border-l-4 border-blue-500">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Daily Summary</h2>
          <p className="text-gray-700">{data.summary}</p>
          <p className="text-gray-600 text-sm mt-3">
            Changes detected: <span className="font-semibold">{data.topChanges.length}</span>
          </p>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card">
          <p className="text-gray-600 text-sm font-medium mb-1">Total Competitors</p>
          <p className="text-4xl font-bold text-blue-600">{data.stats.totalCompetitors}</p>
        </div>
        <div className="card">
          <p className="text-gray-600 text-sm font-medium mb-1">Products Tracked</p>
          <p className="text-4xl font-bold text-green-600">{data.stats.totalProducts}</p>
        </div>
        <div className="card">
          <p className="text-gray-600 text-sm font-medium mb-1">Recent Changes</p>
          <p className="text-4xl font-bold text-orange-600">{data.topChanges.length}</p>
        </div>
      </div>

      {/* Top Changes */}
      {data.topChanges.length > 0 && (
        <div className="card mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top 10 Changes</h2>
          <div className="space-y-3">
            {data.topChanges.map((change, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg border-l-4 ${
                  change.impact === 'high'
                    ? 'bg-red-50 border-red-500'
                    : change.impact === 'medium'
                    ? 'bg-yellow-50 border-yellow-500'
                    : 'bg-blue-50 border-blue-500'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{change.description}</p>
                    <p className="text-xs text-gray-600 mt-1">Type: {change.type}</p>
                  </div>
                  <span
                    className={`badge ${
                      change.impact === 'high'
                        ? 'badge-danger'
                        : change.impact === 'medium'
                        ? 'badge-warning'
                        : 'badge-info'
                    }`}
                  >
                    {change.impact}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Competitors Table */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Competitor Overview</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Competitor</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Type</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Products</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Reviews</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Avg Price</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Avg Rating</th>
              </tr>
            </thead>
            <tbody>
              {data.competitors.map((comp, idx) => (
                <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{comp.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    <span
                      className={`badge ${
                        comp.category === 'own_store'
                          ? 'badge-success'
                          : 'badge-info'
                      }`}
                    >
                      {comp.category === 'own_store' ? 'Own' : 'Competitor'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-center text-gray-700">{comp.productCount}</td>
                  <td className="px-4 py-3 text-sm text-center text-gray-700">{comp.reviewCount}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900 font-medium">
                    €{comp.avgPrice.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    {comp.avgRating > 0 ? (
                      <span className="font-medium text-yellow-600">⭐ {comp.avgRating.toFixed(1)}</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
