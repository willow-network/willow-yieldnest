import { test, expect, Route } from '@playwright/test';

/**
 * Data panel tests. These use page.route() to mock the Willow API so we can
 * test the happy path, the "verification off" path, and the error path
 * without a running node.
 *
 * Each test constructs a stable fixture that the SDK can verify against.
 * The fixture proof is the same single_key_apps_data_key2 fixture shipped
 * with the SDK's jest round-trip tests — we know it decodes to the root
 * hash aa068d6ce4... byte-for-byte, and we know key "key2" at path
 * ["apps","data"] appears in the proven results.
 *
 * Since the app's data/index.ts verifies using path ["subgroves", datasetId,
 * "data"] and key provided, we can't use the fixture directly for the
 * positive-verify path (the paths don't match). So we test:
 *   - Unverified flow: mock /data/:sub/:key, show returned JSON, no proof
 *   - Error flow: mock /data/:sub/:key returning 404
 *   - Verified flow happy path uses a test-only mode where we turn off
 *     verification because we don't have a fixture at the right path yet
 */

const FIXTURE_PROOF_HEX =
  '00' +
  '3004046170707300080201046461746100860e886db2e4ef92d63a5494c29b478cdaff66222a877aba85e11140b2e8eb18' +
  '0104617070733004046461746100080201046b657932006e847de7825ca924a961b423f377ce6482d155ff8e7b3792f9358e2d2e7eb5d6' +
  '0104646174615d01b9ad411f68f74372787f067986d0fe3d85b416cd6e8e3fd0b0aea14501b2cbbe03046b6579320011000e76616c75652d666f722d6b657932001001' +
  '2dddaa863ff4e92d8e017a1e8ad419eafd02d4f2fb82faa786b285bda093052411' +
  '0001';

async function jsonRoute(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

test.describe('Data panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('tab-data').click();
  });

  test('unverified fetch renders the data payload', async ({ page }) => {
    await page.route('**/data/my-subgrove/alice', (route) =>
      jsonRoute(route, {
        success: true,
        data: { name: 'Alice', balance: 1000 },
      }),
    );

    await page.getByTestId('data-subgrove').fill('my-subgrove');
    await page.getByTestId('data-key').fill('alice');
    // Turn off verification to simplify this test
    await page.getByTestId('data-verify-toggle').uncheck();
    await page.getByTestId('data-fetch').click();

    const result = page.getByTestId('data-result');
    await expect(result).toBeVisible();
    await expect(result.getByText('⚠ unverified')).toBeVisible();
    await expect(result.getByText(/"name":\s*"Alice"/)).toBeVisible();
    await expect(result.getByText(/"balance":\s*1000/)).toBeVisible();
  });

  test('verified fetch shows proof size, computed root, and timing breakdown', async ({
    page,
  }) => {
    // Mock both endpoints the SDK hits
    await page.route('**/data/my-subgrove/key2', (route) =>
      jsonRoute(route, {
        success: true,
        data: { any: 'payload' },
      }),
    );
    await page.route('**/proof/my-subgrove/key2', (route) =>
      jsonRoute(route, {
        success: true,
        data: { proof: FIXTURE_PROOF_HEX },
      }),
    );

    await page.getByTestId('data-subgrove').fill('my-subgrove');
    await page.getByTestId('data-key').fill('key2');
    await page.getByTestId('data-verify-toggle').check();
    await page.getByTestId('data-fetch').click();

    const result = page.getByTestId('data-result');
    await expect(result).toBeVisible();
    // The fixture proof decodes cleanly, so the verified badge should show
    // with the real computed root hash — regardless of whether the high-level
    // key-in-path check would pass (we're calling verifyGroveDBProof directly
    // in the Data panel after a manual fetch, which doesn't enforce that).
    await expect(result.getByText('✓ proof verified')).toBeVisible();

    const computedRoot = await page.getByTestId('data-computed-root').textContent();
    expect(computedRoot?.trim()).toBe(
      'aa068d6ce417b8f333ae37d5b2a15d76758db1e55e91c28d9a0be5bd495e36c4',
    );

    // Proof size should be shown (matches both the summary and the dd)
    await expect(result.getByText(/\d+ bytes/).first()).toBeVisible();
    // Timing labels
    await expect(result.getByText(/fetch data/)).toBeVisible();
    await expect(result.getByText(/fetch proof/)).toBeVisible();
    await expect(result.getByText(/verify/).first()).toBeVisible();
  });

  test('404 on /data surfaces an error badge', async ({ page }) => {
    await page.route('**/data/my-subgrove/missing', (route) =>
      jsonRoute(
        route,
        { success: false, error: 'Data not found' },
        404,
      ),
    );

    await page.getByTestId('data-subgrove').fill('my-subgrove');
    await page.getByTestId('data-key').fill('missing');
    await page.getByTestId('data-verify-toggle').uncheck();
    await page.getByTestId('data-fetch').click();

    const err = page.getByTestId('data-error');
    await expect(err).toBeVisible();
    await expect(err.getByText(/error/i)).toBeVisible();
  });

  test('open-in-inspector chain-through passes proof hex to Inspector panel', async ({
    page,
  }) => {
    await page.route('**/data/my-subgrove/key2', (route) =>
      jsonRoute(route, { success: true, data: { any: 'payload' } }),
    );
    await page.route('**/proof/my-subgrove/key2', (route) =>
      jsonRoute(route, { success: true, data: { proof: FIXTURE_PROOF_HEX } }),
    );

    await page.getByTestId('data-subgrove').fill('my-subgrove');
    await page.getByTestId('data-key').fill('key2');
    await page.getByTestId('data-verify-toggle').check();
    await page.getByTestId('data-fetch').click();
    await page.getByTestId('data-result').waitFor();

    await page.getByTestId('data-open-in-inspector').click();

    // Now on the Inspector tab, with the proof pre-filled and decoded ready.
    await expect(page.getByTestId('tab-inspector')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    const prefilled = await page.getByTestId('inspector-input').inputValue();
    expect(prefilled).toBe(FIXTURE_PROOF_HEX);

    // Click Decode & verify to run it through the pure-TS verifier
    await page.getByTestId('inspector-decode').click();
    const rootHash = await page.getByTestId('inspector-root').textContent();
    expect(rootHash?.trim()).toBe(
      'aa068d6ce417b8f333ae37d5b2a15d76758db1e55e91c28d9a0be5bd495e36c4',
    );
  });

  test('empty subgrove or key shows validation error without fetching', async ({
    page,
  }) => {
    // Intercept any fetch — test fails if we hit the network
    let hit = false;
    await page.route('**/data/**', async (route) => {
      hit = true;
      await route.abort();
    });

    await page.getByTestId('data-fetch').click();
    const err = page.getByTestId('data-error');
    await expect(err).toBeVisible();
    await expect(err.getByText(/required/)).toBeVisible();
    expect(hit).toBe(false);
  });
});
