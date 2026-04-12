import { test, expect } from '@playwright/test';

/**
 * Proof Inspector tests. These are the most important tests in the suite:
 * they drive real Chromium through the pure-TypeScript GroveDB verifier,
 * against a real Rust-generated fixture proof, and assert the computed
 * root hash byte-for-byte. If these pass, the whole verification pipeline
 * works end-to-end in a real browser environment.
 */

const FIXTURE_ROOT_HASH =
  'aa068d6ce417b8f333ae37d5b2a15d76758db1e55e91c28d9a0be5bd495e36c4';

test.describe('Proof Inspector', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('tab-inspector').click();
    await expect(page.getByRole('heading', { name: 'Proof Inspector' })).toBeVisible();
  });

  test('loading the sample proof populates the textarea', async ({ page }) => {
    await page.getByTestId('inspector-sample').click();
    const value = await page.getByTestId('inspector-input').inputValue();
    expect(value.length).toBeGreaterThan(100);
    expect(value.startsWith('00')).toBe(true);
  });

  test('decoding the sample proof computes the expected Rust root hash', async ({
    page,
  }) => {
    await page.getByTestId('inspector-sample').click();
    await page.getByTestId('inspector-decode').click();

    // Result panel should appear with the ok badge
    const result = page.getByTestId('inspector-result');
    await expect(result).toBeVisible();
    await expect(result.getByText('✓ decoded & verified')).toBeVisible();

    // The root hash element should contain the known-good fixture root hash
    // produced by the Rust prover. Byte-for-byte match = the whole
    // bincode 2 + merk + hash pipeline is correct in the browser.
    const rootHash = await page.getByTestId('inspector-root').textContent();
    expect(rootHash?.trim()).toBe(FIXTURE_ROOT_HASH);

    // Should show at least one proven entry
    const countText = await page.getByTestId('inspector-count').textContent();
    const count = Number(countText);
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('decoding the sample proof shows the layer tree', async ({ page }) => {
    await page.getByTestId('inspector-sample').click();
    await page.getByTestId('inspector-decode').click();
    await expect(page.getByTestId('inspector-result')).toBeVisible();

    // Expect 3 layers: (root) → apps → data
    const tree = page.locator('.layer-tree');
    await expect(tree).toBeVisible();
    await expect(tree.getByText('(root)')).toBeVisible();
    await expect(tree.getByText('apps', { exact: true })).toBeVisible();
    await expect(tree.getByText('data', { exact: true })).toBeVisible();
  });

  test('pasting garbage hex surfaces a decode error', async ({ page }) => {
    const garbage = 'ff'.repeat(80);
    await page.getByTestId('inspector-input').fill(garbage);
    await page.getByTestId('inspector-decode').click();

    const err = page.getByTestId('inspector-error');
    await expect(err).toBeVisible();
    await expect(err.getByText(/decode failed/)).toBeVisible();
  });

  test('pasting malformed hex surfaces a parse error', async ({ page }) => {
    await page.getByTestId('inspector-input').fill('not-hex-at-all');
    await page.getByTestId('inspector-decode').click();

    const err = page.getByTestId('inspector-error');
    await expect(err).toBeVisible();
    await expect(err.getByText(/Invalid hex/)).toBeVisible();
  });

  test('empty input is rejected before decode', async ({ page }) => {
    await page.getByTestId('inspector-clear').click();
    await page.getByTestId('inspector-decode').click();

    const err = page.getByTestId('inspector-error');
    await expect(err).toBeVisible();
    await expect(err.getByText(/required/i)).toBeVisible();
  });

  test('clear button wipes the textarea and resets state', async ({ page }) => {
    await page.getByTestId('inspector-sample').click();
    await page.getByTestId('inspector-decode').click();
    await expect(page.getByTestId('inspector-result')).toBeVisible();

    await page.getByTestId('inspector-clear').click();
    const value = await page.getByTestId('inspector-input').inputValue();
    expect(value).toBe('');
    await expect(page.getByTestId('inspector-result')).not.toBeVisible();
  });
});
