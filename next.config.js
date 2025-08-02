/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  basePath: process.env.NODE_ENV === 'production' ? '/web-tuner-metronome' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '/web-tuner-metronome/' : '',
}

module.exports = nextConfig