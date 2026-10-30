import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './tests', testMatch: '*.spec.ts', workers: 1, use: { baseURL: 'http://127.0.0.1:5192', headless: true, trace: 'off', screenshot: 'off', video: 'off' }, webServer: { command: 'npm run dev -- --port 5192 --strictPort', url: 'http://127.0.0.1:5192', reuseExistingServer: false } });
