// next.config.js
const repo = 'web-tuner-metronome';           // ★ リポジトリ名
const isPages = process.env.GITHUB_ACTIONS === 'true';
const basePath = isPages ? `/${repo}` : '';

const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  // ★ サービスワーカーのスコープをサブパスに合わせる（未指定時は basePath）
  scope: `${basePath}/`,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  basePath,              // ★ 必須：/web-tuner-metronome
  assetPrefix: basePath, // ★ 必須：/_next/* 等の参照を補正
  trailingSlash: true,
  images: { unoptimized: true },
};

module.exports = withPWA(nextConfig);
