const nextConfig = {
  reactStrictMode: true,

  webpack: (config) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };
    return config;
  },

  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://jaxx-wallet.online/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
