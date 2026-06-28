import { execSync } from 'child_process';

async function globalSetup() {
  console.log('\n[Global Setup] Resetting and seeding test database...');
  try {
    execSync('pnpm --filter backend db:test:prepare', { stdio: 'inherit' });
    console.log('[Global Setup] Test database prepared successfully.\n');
  } catch (error) {
    console.error('[Global Setup] Failed to prepare test database:', error);
    throw error;
  }
}

export default globalSetup;
