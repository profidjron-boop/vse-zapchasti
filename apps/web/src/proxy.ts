import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  // Transitional auth guard: prefer new HttpOnly session cookie, keep legacy fallback.
  const authHeader = request.headers.get('authorization');
  const token =
    request.cookies.get('admin_session')?.value ||
    request.cookies.get('admin_token')?.value ||
    authHeader?.replace('Bearer ', '');
  
  const isAdminRoute = request.nextUrl.pathname.startsWith('/admin');
  const isLoginRoute = request.nextUrl.pathname === '/admin/login';
  
  if (isLoginRoute) {
    return NextResponse.next();
  }
  
  if (isAdminRoute && !token) {
    return NextResponse.redirect(new URL('/admin/login', request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: '/admin/:path*',
};
