import type { NextConfig } from 'next';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Monorepo root: load `.env` from repo root (not only `apps/web/.env`). */
const monorepoRoot = path.join(__dirname, '..', '..');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  envDir: monorepoRoot,
};

export default nextConfig;
