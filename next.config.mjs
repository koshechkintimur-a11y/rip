/** @type {import('next').NextConfig} */
const nextConfig = {
  // Прод: golubot.ru/rip/ (см. BASE_PATH в .env VPS). Локально — пусто (корень).
  basePath: process.env.BASE_PATH || '',
  // PGlite должен грузиться через node require, иначе webpack ломает его WASM-пути
  serverExternalPackages: ['@electric-sql/pglite'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  // отключаем dev-индикатор NEXT (кнопка N) — не нужен пользователям
  devIndicators: false,
};

export default nextConfig;
