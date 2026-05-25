import { loadEnvConfig } from '@next/env';

export default async function globalSetup() {
  loadEnvConfig(process.cwd());
}
