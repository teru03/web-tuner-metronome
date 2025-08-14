// next.config.js（できるだけ単純に）
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  // GitHub Pages では SW を無効化したいなら true にするなど
  disable: process.env.GITHUB_ACTIONS === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
};

// ここで分岐しない（configure-pages が読みやすい形に）
module.exports = withPWA(nextConfig);
