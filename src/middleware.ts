// NOTE: Next.js 16 deprecates the `middleware` file convention in favour of
// `proxy`, but `proxy` is Node.js-only. This project deploys to Cloudflare
// Workers (edge runtime) via @opennextjs/cloudflare, so we intentionally keep
// the deprecated `middleware` convention — it still works and is the only
// edge-compatible option until Next.js ships edge support for `proxy`.
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest): Promise<NextResponse> {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Write to the request so downstream server code sees the updated cookies.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          // Recreate the response so it carries the mutated request cookies.
          supabaseResponse = NextResponse.next({
            request,
          })
          // Write to the response so the browser receives the updated cookies.
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Use getUser() — validates with the Supabase auth server, not just the
  // cookie cache. Required for safe server-side authorization decisions.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  const isPublicPath =
    pathname === '/' ||
    pathname === '/sign-in' ||
    pathname.startsWith('/auth/')

  if (!user && !isPublicPath) {
    const signInUrl = request.nextUrl.clone()
    signInUrl.pathname = '/sign-in'
    const redirectResponse = NextResponse.redirect(signInUrl)
    // Carry over any session cookies @supabase/ssr refreshed during getUser()
    // so a mid-request token refresh isn't lost on the redirect.
    supabaseResponse.cookies.getAll().forEach((cookie) =>
      redirectResponse.cookies.set(cookie.name, cookie.value)
    )
    return redirectResponse
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     *   - _next/static (static files)
     *   - _next/image  (image optimisation)
     *   - favicon.ico
     *   - Common static extensions
     */
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|ico|woff|woff2|ttf|otf)$).*)',
  ],
}
