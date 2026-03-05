import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['localhost', '127.0.0.1', '.local-origin.dev'],
  // Другие настройки...
};

export default nextConfig;
