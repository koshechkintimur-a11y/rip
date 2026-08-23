/** @type {import('next').NextConfig} */
const nextConfig = {
  // PGlite должен грузиться через node require, иначе webpack ломает его WASM-пути
  serverExternalPackages: ['@electric-sql/pglite'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
};

export default nextConfig;
