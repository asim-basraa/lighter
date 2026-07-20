/** @type {import('next').NextConfig} */
const nextConfig = {
  // The design system + json-render packages are consumed as TypeScript source from the monorepo, so
  // Next must transpile them (and keep a single React binding through the server bundle).
  transpilePackages: [
    '@lighter/design-system',
    '@lighter/spec',
    '@lighter/preview',
    '@json-render/core',
    '@json-render/react',
  ],
  webpack: (config) => {
    // Internal imports use `.js` specifiers that resolve to `.ts`/`.tsx` source; teach webpack to
    // follow them the way the TS "bundler" resolver does. Real `.js` is tried first.
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      '.js': ['.js', '.ts', '.tsx'],
    };
    return config;
  },
};

export default nextConfig;
