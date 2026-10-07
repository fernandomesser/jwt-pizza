import { test as base, expect } from 'playwright-test-coverage';

const test = base.extend({
  page: async ({ page }, use) => {
    const violations: string[] = [];

    await page.route('**/*', async (route) => {
      const url = route.request().url();

      if (url.startsWith('http://localhost:3000')) {
        violations.push(`${route.request().method()} ${url}`);
        await route.abort();
      } else {
        await route.continue();
      }
    });

    await use(page);

    expect(violations, 'Unexpected backend request(s)').toEqual([]);
  },
});

export { test, expect };