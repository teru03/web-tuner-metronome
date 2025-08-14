const isExport = process.env.NODE_ENV === 'production' && process.env.GITHUB_ACTIONS

const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
}

if (isExport) {
  module.exports = nextConfig
} else {
  const withPWA = require('next-pwa')({
    dest: 'public',
    register: true,
    skipWaiting: true,
    disable: process.env.NODE_ENV === 'development',
  })
  module.exports = withPWA(nextConfig)
}