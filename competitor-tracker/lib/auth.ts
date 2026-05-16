export function validateApiKey(key: string | undefined): boolean {
  if (!key) return false
  return key === process.env.API_KEY
}

export function extractApiKey(headers: HeadersInit): string | undefined {
  const authHeader = headers instanceof Headers
    ? headers.get('authorization')
    : headers['authorization']

  if (!authHeader) return undefined

  const parts = authHeader.split(' ')
  if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
    return parts[1]
  }

  return authHeader
}
