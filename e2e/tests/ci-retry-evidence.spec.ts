import { expect, test } from '@playwright/test';

const evidenceMode = process.env.CI_RETRY_EVIDENCE_MODE;

test('temporary CI retry evidence fixture', async ({}, testInfo) => {
  test.skip(
    evidenceMode !== 'recovered' && evidenceMode !== 'failed',
    'The temporary evidence fixture is enabled only by the evidence branch workflow.',
  );

  if (evidenceMode === 'recovered') {
    expect(testInfo.retry, 'The recovered fixture must fail only on its first attempt.').toBe(1);
    return;
  }

  expect(false, 'The exhausted-retry fixture must fail on every attempt.').toBe(true);
});
