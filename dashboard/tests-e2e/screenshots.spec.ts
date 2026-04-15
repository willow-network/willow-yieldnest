import { test, Route } from '@playwright/test';

/**
 * Capture screenshots of every panel in both themes. Not an assertion test —
 * just generates visual artifacts for review.
 */

const FIXTURE_PROOF =
  '00' +
  '3004046170707300080201046461746100860e886db2e4ef92d63a5494c29b478cdaff66222a877aba85e11140b2e8eb18' +
  '0104617070733004046461746100080201046b657932006e847de7825ca924a961b423f377ce6482d155ff8e7b3792f9358e2d2e7eb5d6' +
  '0104646174615d01b9ad411f68f74372787f067986d0fe3d85b416cd6e8e3fd0b0aea14501b2cbbe03046b6579320011000e76616c75652d666f722d6b657932001001' +
  '2dddaa863ff4e92d8e017a1e8ad419eafd02d4f2fb82faa786b285bda093052411' +
  '0001';

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function setupMocks(page: import('@playwright/test').Page) {
  await page.route('**/state/root-hash', (r) =>
    json(r, { data: { root_hash: '0x' + 'aa'.repeat(32) } }),
  );
  await page.route('**/state/root-hash/verified', (r) =>
    json(r, { data: { root_hash: '0x' + 'aa'.repeat(32) } }),
  );
  await page.route('**/status', (r) => r.fulfill({ status: 503, body: '' }));
  await page.route('**/subgroves', (r) =>
    json(r, {
      data: [
        { subgrove_id: 'token-balances', name: 'Token balances', owner_did: 'did:willow:devnet-test' },
        { subgrove_id: 'user-profiles', name: 'User profiles', owner_did: 'did:willow:devnet-test' },
        { subgrove_id: 'uniswap-pairs', name: 'Uniswap V2 pairs', owner_did: 'did:willow:devnet-test' },
      ],
    }),
  );
  await page.route('**/data/token-balances/alice', (r) =>
    json(r, {
      success: true,
      data: { address: '0xabcd...ef01', balance: '1250000000000000000', token: 'USDC' },
    }),
  );
  await page.route('**/proof/token-balances/alice', (r) =>
    json(r, { success: true, data: { proof: FIXTURE_PROOF } }),
  );
  await page.route('**/query/user-profiles*', (r) =>
    json(r, {
      success: true,
      data: {
        documents: [
          { id: 'alice', name: 'Alice', joined: 1712000000 },
          { id: 'bob', name: 'Bob', joined: 1712100000 },
        ],
      },
    }),
  );
}

const THEMES = ['dark', 'light'] as const;

for (const theme of THEMES) {
  test.describe(`screenshots — ${theme} mode`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((t) => {
        window.localStorage.setItem('willow-explorer-theme', t);
      }, theme);
      await setupMocks(page);
    });

    test('app-home', async ({ page }) => {
      await page.goto('/');
      await page.screenshot({ path: `screenshots/${theme}/01-home.png`, fullPage: true });
    });

    test('data-panel-verified', async ({ page }) => {
      await page.goto('/');
      await page.getByTestId('tab-data').click();
      await page.getByTestId('data-subgrove').fill('token-balances');
      await page.getByTestId('data-key').fill('alice');
      await page.getByTestId('data-fetch').click();
      await page.getByTestId('data-result').waitFor();
      await page.screenshot({
        path: `screenshots/${theme}/02-data-verified.png`,
        fullPage: true,
      });
    });

    test('query-panel', async ({ page }) => {
      await page.goto('/');
      await page.getByTestId('tab-query').click();
      await page.getByTestId('query-subgrove').fill('user-profiles');
      await page.getByTestId('query-verify-toggle').uncheck();
      await page.getByTestId('query-run').click();
      await page.getByTestId('query-result').waitFor();
      await page.screenshot({ path: `screenshots/${theme}/03-query.png`, fullPage: true });
    });

    test('subgroves-panel', async ({ page }) => {
      await page.goto('/');
      await page.getByTestId('tab-subgroves').click();
      await page.waitForTimeout(200);
      await page.screenshot({ path: `screenshots/${theme}/04-subgroves.png`, fullPage: true });
    });

    test('state-panel', async ({ page }) => {
      await page.goto('/');
      await page.getByTestId('tab-state').click();
      await page.getByTestId('state-result').waitFor();
      await page.screenshot({ path: `screenshots/${theme}/05-state.png`, fullPage: true });
    });

    test('inspector-panel', async ({ page }) => {
      await page.goto('/');
      await page.getByTestId('tab-inspector').click();
      await page.getByTestId('inspector-sample').click();
      await page.getByTestId('inspector-decode').click();
      await page.getByTestId('inspector-result').waitFor();
      await page.screenshot({
        path: `screenshots/${theme}/06-inspector.png`,
        fullPage: true,
      });
    });
  });
}
