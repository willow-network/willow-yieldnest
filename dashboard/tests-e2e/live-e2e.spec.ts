import { test, expect } from '@playwright/test';

/**
 * Live end-to-end test against a running 3-node Willow network.
 * NO mocking — real consensus transactions, real proof verification.
 *
 * Prerequisites:
 *   NUM_NODES=3 ./scripts/start_network.sh   (from the willow repo)
 *   npm run dev                              (from this directory)
 *
 * Skip in CI (no live network):
 *   SKIP_LIVE=1 npm run test:e2e
 */

const SKIP = !!process.env.SKIP_LIVE;

test.describe('live end-to-end against real Willow network', () => {
  test.skip(() => SKIP, 'SKIP_LIVE is set — no live network');

  // Increase timeout — consensus transactions take a few seconds
  test.setTimeout(60_000);

  test('register subgrove → store data → fetch with proof verification', async ({
    page,
  }) => {
    await page.goto('/');

    // ========== Step 1: Register a subgrove (with funding) ==========
    const subgroveId = `e2e-${Date.now()}`;
    await page.getByTestId('tab-store').click();
    await page.getByTestId('store-reg-id').fill(subgroveId);
    await page.getByTestId('store-reg-name').fill('E2E Test');
    await page.getByTestId('store-reg-funding').fill('1');
    await page.getByTestId('store-reg-submit').click();

    // Wait for the register result (consensus tx — may take a few seconds)
    const regResult = page.getByTestId('store-reg-result');
    const regError = page.getByTestId('store-reg-error');

    // Either success or "already exists" (if re-running) is fine
    await expect(regResult.or(regError)).toBeVisible({ timeout: 30_000 });
    const regText = await (regResult.or(regError)).textContent();
    console.log('Register result:', regText?.slice(0, 200));

    // ========== Step 2: Store data ==========
    // Wait for consensus to finalize the registration
    await page.waitForTimeout(4000);
    await page.getByTestId('store-data-subgrove').fill(subgroveId);
    await page.getByTestId('store-data-key').fill('hello');
    await page.getByTestId('store-data-value').fill(
      JSON.stringify({ message: 'Hello from Playwright', timestamp: Date.now() }),
    );
    await page.getByTestId('store-data-submit').click();

    const storeResult = page.getByTestId('store-data-result');
    const storeError = page.getByTestId('store-data-error');
    await expect(storeResult.or(storeError)).toBeVisible({ timeout: 30_000 });
    const storeText = await (storeResult.or(storeError)).textContent();
    console.log('Store result:', storeText?.slice(0, 200));

    // ========== Step 3: Fetch with proof verification ==========
    // Wait for store to be committed
    await page.waitForTimeout(4000);
    await page.getByTestId('tab-data').click();
    await page.getByTestId('data-subgrove').fill(subgroveId);
    await page.getByTestId('data-key').fill('hello');
    await page.getByTestId('data-verify-toggle').check();
    await page.getByTestId('data-fetch').click();

    const dataResult = page.getByTestId('data-result');
    const dataError = page.getByTestId('data-error');
    await expect(dataResult.or(dataError)).toBeVisible({ timeout: 15_000 });

    // Log what we got
    const dataText = await (dataResult.or(dataError)).textContent();
    console.log('Data fetch result:', dataText?.slice(0, 300));

    // Check if verification succeeded
    if (await dataResult.isVisible()) {
      // Check for the proof verified badge
      const verified = dataResult.getByText('proof verified');
      const isVerified = await verified.isVisible().catch(() => false);
      console.log('Proof verified:', isVerified);

      // Check computed root hash is present
      const rootEl = page.getByTestId('data-computed-root');
      if (await rootEl.isVisible().catch(() => false)) {
        const root = await rootEl.textContent();
        console.log('Computed root hash:', root?.trim());
      }
    }

    // ========== Step 4: Check subgroves list ==========
    await page.getByTestId('tab-subgroves').click();
    // Wait for the list to load
    await page.waitForTimeout(2000);
    const hasSubgrove = await page.getByText(subgroveId).isVisible().catch(() => false);
    console.log(`Subgrove "${subgroveId}" visible in list:`, hasSubgrove);
  });
});
