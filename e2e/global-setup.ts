import { execSync } from 'child_process';
import { clearMailpit, startMailpit } from './fixtures/emailConfirmation.js';

async function globalSetup() {
  console.log('\n[Global Setup] Starting local Mailpit and preparing test database...');
  try {
    await startMailpit();
    execSync('pnpm --filter backend db:test:prepare', { stdio: 'inherit' });
    await clearMailpit();
    console.log('[Global Setup] Test database prepared and Mailpit cleared successfully.\n');
  } catch (error) {
    console.error('[Global Setup] Failed to prepare test database:', error);
    throw error;
  }
}

export default globalSetup;
