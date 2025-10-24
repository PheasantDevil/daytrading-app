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
  webpack: (config, { isServer }) => {
    // Denoの標準ライブラリを無視する設定
    config.resolve.fallback = {
      ...config.resolve.fallback,
      '@std/testing/mock': false,
      '@std/testing/bdd': false,
    };
    
    // テストファイルを無視
    config.module.rules.push({
      test: /\.test\.(js|ts|tsx)$/,
      loader: 'ignore-loader',
    });
    
    // yahoo-finance2のテストファイルを無視
    config.module.rules.push({
      test: /node_modules\/yahoo-finance2\/.*\/tests\/.*\.js$/,
      loader: 'ignore-loader',
    });

    // yahoo-finance2の特定のファイルを無視
    config.module.rules.push({
      test: /node_modules\/yahoo-finance2\/esm\/tests\/fetchCache\.js$/,
      loader: 'ignore-loader',
    });

    // 外部モジュールとして扱う
    config.externals = config.externals || [];
    if (isServer) {
      config.externals.push({
        '@std/testing/mock': 'commonjs @std/testing/mock',
        '@std/testing/bdd': 'commonjs @std/testing/bdd',
      });
    }

    return config;
  },
};

export default nextConfig;
