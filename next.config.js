// next.config.js（できるだけ単純に）
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
};

// ここで分岐しない（configure-pages が読みやすい形に）
module.exports = withPWA(nextConfig,  {reactStrictMode: true});
