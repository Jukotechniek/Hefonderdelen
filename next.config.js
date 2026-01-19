/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // Disable static optimization for API routes
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
    // Allow cross-origin requests from local network in development
    allowedDevOrigins: ['192.168.68.118', 'localhost'],
  },
  // Allow cross-origin requests in development
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },
}

module.exports = nextConfig
