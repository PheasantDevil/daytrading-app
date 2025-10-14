/** @type {import('next').NextConfig} */
const nextConfig = {
  // appDir is now stable in Next.js 13+, no need for experimental flag
  typescript: {
    // 本番ビルド時にTypeScriptエラーを無視
    ignoreBuildErrors: true,
  },
  eslint: {
    // 本番ビルド時にESLintエラーを無視
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
