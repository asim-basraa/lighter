/** @type {import('next').NextConfig} */
const nextConfig = {
  // lighter-example is consumed as TypeScript source (a sibling repo), so Next must transpile it.
  // Its json-render deps are ESM-only and create React context at module scope; transpiling them
  // alongside keeps a single React binding through Next's server bundle.
  transpilePackages: [
    'lighter-example',
    '@lighter/design-system',
    '@lighter/spec',
    '@lighter/preview',
    '@json-render/core',
    '@json-render/react',
  ],
  webpack: (config) => {
    // lighter-example's internal imports use `.js` specifiers that resolve to `.ts`/`.tsx` source;
    // teach webpack to follow them the way the TS "bundler" resolver and vitest already do. Real
    // `.js` MUST be tried first so React/Next's own `.js` internals still resolve — only specifiers
    // with no matching `.js` file (lighter-example's) fall through to `.ts`/`.tsx`.
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      '.js': ['.js', '.ts', '.tsx'],
    };
    return config;
  },
};

export default nextConfig;
