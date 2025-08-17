// next.config.js
const repo = process.env.GITHUB_REPOSITORY
  ? process.env.GITHUB_REPOSITORY.split('/')[1]
  : ''; // <user>/<repo> → repo 抜き出し
const isPages = process.env.GITHUB_ACTIONS === 'true';
const basePath = isPages ? `/${repo}` : '';

const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  // GitHub Pages 配信に合わせて SW のスコープを合わせる
  scope: `${basePath}/`,
});

const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  basePath,                // ★ 重要
  assetPrefix: basePath,   // ★ 重要（/_next/* などの参照先を補正）
  trailingSlash: true,
  images: { unoptimized: true },
};

module.exports = withPWA(nextConfig);
