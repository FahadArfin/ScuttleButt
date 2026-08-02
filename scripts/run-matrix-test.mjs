import { execFileSync } from 'node:child_process';

execFileSync('pnpm', ['--filter', '@scuttlebutt/matrix-client', 'test:integration'], {
  env: {
    ...process.env,
    SCUTTLEBUTT_RUN_MATRIX_INTEGRATION: '1',
  },
  shell: process.platform === 'win32',
  stdio: 'inherit',
});
