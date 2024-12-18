import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// In-memory store for rate limiting
const rateLimit = new Map<string, { count: number; timestamp: number }>()

// Rate limit configuration
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const MAX_REQUESTS = 10 // requests per window

export function middleware(request: NextRequest) {
  // Only apply rate limiting to API routes
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  const ip = request.ip ?? 'anonymous'
  const now = Date.now()

  // Clean up old entries
  Array.from(rateLimit.entries()).forEach(([key, value]) => {
    if (now - value.timestamp > RATE_LIMIT_WINDOW) {
      rateLimit.delete(key)
    }
  })

  // Get or create rate limit entry
  const rateLimitInfo = rateLimit.get(ip) ?? { count: 0, timestamp: now }

  // Reset count if outside window
  if (now - rateLimitInfo.timestamp > RATE_LIMIT_WINDOW) {
    rateLimitInfo.count = 0
    rateLimitInfo.timestamp = now
  }

  // Increment count
  rateLimitInfo.count++
  rateLimit.set(ip, rateLimitInfo)

  // Check if rate limit exceeded
  if (rateLimitInfo.count > MAX_REQUESTS) {
    return new NextResponse(
      JSON.stringify({
        success: false,
        message: 'Rate limit exceeded',
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later'
        }
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': MAX_REQUESTS.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': (rateLimitInfo.timestamp + RATE_LIMIT_WINDOW).toString(),
        },
      }
    )
  }

  // Add rate limit headers
  const response = NextResponse.next()
  response.headers.set('X-RateLimit-Limit', MAX_REQUESTS.toString())
  response.headers.set(
    'X-RateLimit-Remaining',
    (MAX_REQUESTS - rateLimitInfo.count).toString()
  )
  response.headers.set(
    'X-RateLimit-Reset',
    (rateLimitInfo.timestamp + RATE_LIMIT_WINDOW).toString()
  )

  return response
}

export const config = {
  matcher: '/api/:path*',
}
