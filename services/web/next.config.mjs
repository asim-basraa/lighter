/** @type {import('next').NextConfig} */
const nextConfig = {
  // lighter-example is consumed as TypeScript source (a sibling repo), so Next must transpile it.
  transpilePackages: ['lighter-example'],
  webpack: (config) => {
    // Its internal imports use `.js` specifiers that resolve to `.ts`/`.tsx` source; teach webpack
    // to follow them the way the TS "bundler" resolver and vitest already do.
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      '.js': ['.ts', '.tsx', '.js'],
    };
    return config;
  },
};

export default nextConfig;
