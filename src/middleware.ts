import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isLoginPage = pathname === '/login';
  const isApiRoute = pathname.startsWith('/api');
  const isDashboard = pathname.startsWith('/dashboard');
  const isMerchant = pathname.startsWith('/merchant');

  // Allow API routes through
  if (isApiRoute) return supabaseResponse;

  // Not logged in → go to login
  if (!user && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Logged in → route based on role
  if (user) {
    const role = user.app_metadata?.role || 'merchant';

    // On login page → redirect to correct dashboard
    if (isLoginPage) {
      const dest = role === 'admin' ? '/dashboard/merchants' : '/merchant';
      return NextResponse.redirect(new URL(dest, request.url));
    }

    // Root path → redirect to correct dashboard
    if (pathname === '/') {
      const dest = role === 'admin' ? '/dashboard/merchants' : '/merchant';
      return NextResponse.redirect(new URL(dest, request.url));
    }

    // Admin trying to access merchant routes → redirect
    if (role === 'admin' && isMerchant) {
      return NextResponse.redirect(new URL('/dashboard/merchants', request.url));
    }

    // Merchant trying to access admin routes → redirect
    if (role === 'merchant' && isDashboard) {
      return NextResponse.redirect(new URL('/merchant', request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
