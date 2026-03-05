import type { NextConfig } from 'next';

function normalizeOrigin(value?: string): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function buildCsp(): string {
  const apiOrigin =
    normalizeOrigin(process.env.NEXT_PUBLIC_API_BASE_URL) ??
    normalizeOrigin(process.env.API_BASE_URL);
  const isProd = process.env.NODE_ENV === 'production';

  const connectSrc = ["'self'"];
  if (apiOrigin) connectSrc.push(apiOrigin);
  if (!isProd) connectSrc.push('ws:', 'wss:');

  const scriptSrc = ["'self'", "'unsafe-inline'"];
  if (!isProd) scriptSrc.push("'unsafe-eval'");

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${connectSrc.join(' ')}`,
    `script-src ${scriptSrc.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
  ];

  if (isProd) directives.push('upgrade-insecure-requests');

  return directives.join('; ');
}

const nextConfig: NextConfig = {
  allowedDevOrigins: ['localhost', '127.0.0.1', '.local-origin.dev'],
  async headers() {
    const headers = [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
      },
      { key: 'Content-Security-Policy', value: buildCsp() },
    ];

    if (process.env.NODE_ENV === 'production') {
      headers.unshift({
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubDomains',
      });
    }

    return [
      {
        source: '/:path*',
        headers,
      },
    ];
  },
};

export default nextConfig;
