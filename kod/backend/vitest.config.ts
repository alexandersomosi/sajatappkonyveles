// Tests run against PGlite (Postgres in WebAssembly, in-process). Each test file builds its own
// database and app instance (test/helpers.ts). Keys below are throwaway test values.
import { defineConfig } from 'vitest/config';

const k = (b: number) => Buffer.alloc(32, b).toString('base64');

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    testTimeout: 60_000,
    hookTimeout: 120_000,
    pool: 'forks',
    env: {
      NODE_ENV: 'test',
      APP_ENV: 'demo',
      // Most suites log staff in without 2FA; auth.test.ts covers the required (default) mode.
      STAFF_TOTP_REQUIRED: 'false',
      LOG_LEVEL: 'silent',
      JWT_SECRET: k(1),
      CODE_HMAC_SECRET: k(2),
      FILE_LINK_SECRET: k(3),
      AUDIT_IP_SALT: k(4),
      FILE_ENC_KEY: k(5),
      FILE_ENC_KEY_ID: '1',
      APP_DATA_KEY: k(6),
      NAV_CRED_KEY: k(7),
      SIMPLEPAY_DEMO_SECRET: 'test-demo-secret-0123456789abcdef',
      SMTP_HOST: '',
      GOOGLE_CLIENT_IDS: '',
      APPLE_BUNDLE_ID: '',
      LEGAL_DIR: '../jogi',
      FONT_DIR: './fonts',
    },
  },
});
