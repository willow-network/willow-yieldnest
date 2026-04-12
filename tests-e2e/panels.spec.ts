import { test, expect, Route } from '@playwright/test';

async function jsonRoute(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

/**
 * Subgroves, State, Query, ConnectionBar panels — tested with mocked APIs.
 */

test.describe('Subgroves panel', () => {
  test('renders a populated list', async ({ page }) => {
    await page.route('**/subgroves', (route) =>
      jsonRoute(route, {
        data: [
          { subgrove_id: 'alpha', name: 'Alpha', owner_did: 'did:willow:test:1' },
          { subgrove_id: 'bravo', name: 'Bravo', owner_did: 'did:willow:test:2' },
        ],
      }),
    );
    await page.goto('/');
    await page.getByTestId('tab-subgroves').click();

    await expect(page.getByText('2 subgroves')).toBeVisible();
    await expect(page.getByRole('cell', { name: 'alpha', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Alpha', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'bravo', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Bravo', exact: true })).toBeVisible();
  });

  test('renders an empty list when the node has no subgroves', async ({ page }) => {
    await page.route('**/subgroves', (route) =>
      jsonRoute(route, { data: [] }),
    );
    await page.goto('/');
    await page.getByTestId('tab-subgroves').click();

    await expect(page.getByText('No subgroves registered on this node yet.')).toBeVisible();
  });

  test('surfaces network error', async ({ page }) => {
    await page.route('**/subgroves', (route) =>
      route.fulfill({ status: 500, body: 'boom' }),
    );
    await page.goto('/');
    await page.getByTestId('tab-subgroves').click();

    await expect(page.getByText(/HTTP 500/)).toBeVisible();
  });

  test('clicking a row jumps to Data panel with subgrove pre-filled', async ({ page }) => {
    await page.route('**/subgroves', (route) =>
      jsonRoute(route, {
        data: [
          { subgrove_id: 'token-balances', name: 'Token balances', owner_did: 'did:willow:test:1' },
        ],
      }),
    );
    await page.goto('/');
    await page.getByTestId('tab-subgroves').click();
    await page.getByTestId('subgrove-row-token-balances').click();

    // Data tab should now be active
    await expect(page.getByTestId('tab-data')).toHaveAttribute('aria-selected', 'true');
    // And the subgrove input should be pre-filled
    await expect(page.getByTestId('data-subgrove')).toHaveValue('token-balances');
  });
});

test.describe('State panel', () => {
  test('shows connected badge when verified root is available', async ({ page }) => {
    const hash = '0x' + 'ab'.repeat(32);
    await page.route('**/state/root-hash/verified', (route) =>
      jsonRoute(route, { data: { root_hash: hash } }),
    );
    await page.route('**/validators', (route) =>
      jsonRoute(route, { data: [] }),
    );
    await page.route('**/status', (route) =>
      route.fulfill({ status: 503, body: '' }),
    );

    await page.goto('/');
    await page.getByTestId('tab-state').click();

    const result = page.getByTestId('state-result');
    await expect(result).toBeVisible();
    await expect(result.getByText('✓ connected')).toBeVisible();
    const verified = await page.getByTestId('state-root-verified').textContent();
    expect(verified?.trim()).toBe(hash);
  });

  test('surfaces error when verified root endpoint fails', async ({ page }) => {
    await page.route('**/state/root-hash/verified', (route) =>
      route.fulfill({ status: 500, body: 'boom' }),
    );
    await page.route('**/validators', (route) =>
      jsonRoute(route, { data: [] }),
    );
    await page.route('**/status', (route) =>
      route.fulfill({ status: 503, body: '' }),
    );

    await page.goto('/');
    await page.getByTestId('tab-state').click();

    await expect(page.getByTestId('state-error')).toBeVisible();
  });
});

test.describe('Query panel', () => {
  test('unverified query renders documents', async ({ page }) => {
    await page.route('**/query/my-subgrove*', (route) =>
      jsonRoute(route, {
        success: true,
        data: {
          documents: [
            { id: '1', name: 'row one' },
            { id: '2', name: 'row two' },
          ],
        },
      }),
    );

    await page.goto('/');
    await page.getByTestId('tab-query').click();
    await page.getByTestId('query-subgrove').fill('my-subgrove');
    await page.getByTestId('query-verify-toggle').uncheck();
    await page.getByTestId('query-run').click();

    const result = page.getByTestId('query-result');
    await expect(result).toBeVisible();
    await expect(result.getByText('2 documents')).toBeVisible();
    await expect(result.getByText(/row one/)).toBeVisible();
    await expect(result.getByText(/row two/)).toBeVisible();
  });

  test('invalid filter JSON is rejected before sending', async ({ page }) => {
    let hit = false;
    await page.route('**/query/**', async (route) => {
      hit = true;
      await route.abort();
    });

    await page.goto('/');
    await page.getByTestId('tab-query').click();
    await page.getByTestId('query-subgrove').fill('my-subgrove');
    await page.getByTestId('query-filters').fill('{not valid json');
    await page.getByTestId('query-run').click();

    await expect(page.getByTestId('query-error')).toBeVisible();
    await expect(page.getByText(/invalid JSON/)).toBeVisible();
    expect(hit).toBe(false);
  });
});

test.describe('Connection bar', () => {
  test('health check succeeds when /state/root-hash returns 200', async ({ page }) => {
    await page.route('**/state/root-hash', (route) =>
      jsonRoute(route, { data: { root_hash: '0x' + 'cd'.repeat(32) } }),
    );

    await page.goto('/');
    await page.getByRole('button', { name: /check/i }).click();
    await expect(page.getByText(/● online/)).toBeVisible();
  });

  test('health check fails when /state/root-hash errors', async ({ page }) => {
    await page.route('**/state/root-hash', (route) =>
      route.fulfill({ status: 500, body: 'boom' }),
    );

    await page.goto('/');
    await page.getByRole('button', { name: /check/i }).click();
    await expect(page.getByText(/● offline/)).toBeVisible();
  });
});
