import type { Page } from '@playwright/test';
import { test, expect } from './testSetup';
import { Role } from '../src/service/pizzaService';
import type { User } from '../src/service/pizzaService';

async function basicInit(page: Page) {
  let loggedInUser: User | undefined;

  const users: Record<string, User> = {
    'd@jwt.com': {
      id: '3',
      name: 'Kai Chen',
      email: 'd@jwt.com',
      password: 'a',
      roles: [{ role: Role.Diner }],
    },
    'franchise@jwt.com': {
      id: '5',
      name: 'Franchise Owner',
      email: 'franchise@jwt.com',
      password: 'a',
      roles: [{ role: Role.Franchisee }],
    },
    'admin@jwt.com': {
      id: '1',
      name: 'Admin User',
      email: 'admin@jwt.com',
      password: 'a',
      roles: [{ role: Role.Admin }],
    },
  };

  await page.route('*/**/api/auth', async (route) => {
    const method = route.request().method();

    if (method === 'DELETE') {
      await route.fulfill({ json: {} });
      return;
    }

    const request = route.request().postDataJSON();

    expect(['PUT', 'POST']).toContain(method);

    if (method === 'POST') {
      loggedInUser = {
        id: '4',
        name: request.name,
        email: request.email,
        roles: [{ role: Role.Diner }],
      };
    } else {
      loggedInUser = users[request.email];

      expect(loggedInUser).toBeDefined();
      expect(request.password).toBe(loggedInUser?.password);
    }

    await route.fulfill({
      json: {
        user: loggedInUser,
        token: 'abcdef',
      },
    });
  });

  await page.route('*/**/api/user/me', async (route) => {
    await route.fulfill({ json: loggedInUser });
  });

  await page.route('*/**/api/order/menu', async (route) => {
    await route.fulfill({
      json: [
        {
          id: '1',
          title: 'Veggie',
          image: 'pizza1.png',
          price: 0.0038,
          description: 'A garden of delight',
        },
        {
          id: '2',
          title: 'Pepperoni',
          image: 'pizza2.png',
          price: 0.0042,
          description: 'Spicy treat',
        },
      ],
    });
  });

  await page.route(/\/api\/franchise\?.*$/, async (route) => {
    await route.fulfill({
      json: {
        franchises: [
          {
            id: '2',
            name: 'LotaPizza',
            admins: [
              {
                email: 'franchise@jwt.com',
                name: 'Franchise Owner',
              },
            ],
            stores: [
              {
                id: '4',
                name: 'Lehi',
                totalRevenue: 10,
              },
              {
                id: '5',
                name: 'Springville',
                totalRevenue: 20,
              },
            ],
          },
        ],
        more: false,
      },
    });
  });

  await page.route('*/**/api/franchise/5', async (route) => {
    await route.fulfill({
      json: [
        {
          id: '2',
          name: 'LotaPizza',
          stores: [
            {
              id: '4',
              name: 'Lehi',
              totalRevenue: 10,
            },
          ],
        },
      ],
    });
  });

  await page.route('*/**/api/order', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        json: {
          orders: [
            {
              id: '23',
              date: '2026-01-01',
              items: [
                {
                  description: 'Veggie',
                  price: 0.0038,
                },
              ],
            },
          ],
        },
      });
      return;
    }

    const order = route.request().postDataJSON();

    await route.fulfill({
      json: {
        order: {
          ...order,
          id: '23',
        },
        jwt: 'eyJpYXQ',
      },
    });
  });

  await page.route(/\/api\/order\/verify(?:\?.*)?$/, async (route) => {
  expect(route.request().method()).toBe('POST');

  await route.fulfill({
    json: {
      message: 'valid',
      payload: 'This pizza is authentic.',
    },
  });
});

  await page.route('*/**/api/docs', async (route) => {
    await route.fulfill({
      json: {
        endpoints: [
          {
            requiresAuth: false,
            method: 'GET',
            path: '/api/order/menu',
            description: 'Get the pizza menu',
            example: '{}',
            response: [],
          },
        ],
      },
    });
  });

  await page.goto('/');
}

test('home page', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('JWT Pizza');
});

test('login', async ({ page }) => {
  await basicInit(page);

  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByPlaceholder('Email address').fill('d@jwt.com');
  await page.getByPlaceholder('Password').fill('a');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page.getByRole('link', { name: 'KC' })).toBeVisible();
});

test('purchase with login', async ({ page }) => {
  await basicInit(page);

  await page.getByRole('button', { name: 'Order now' }).click();
  await expect(page.locator('h2')).toContainText('Awesome is a click away');

  await page.getByRole('combobox').selectOption('4');
  await page.getByRole('link', { name: /Veggie/ }).click();
  await page.getByRole('link', { name: /Pepperoni/ }).click();

  await expect(page.locator('form')).toContainText('Selected pizzas: 2');

  await page.getByRole('button', { name: 'Checkout' }).click();

  await page.getByPlaceholder('Email address').fill('d@jwt.com');
  await page.getByPlaceholder('Password').fill('a');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page.getByRole('main')).toContainText('Send me those 2 pizzas right now!');
  await expect(page.locator('tbody')).toContainText('Veggie');
  await expect(page.locator('tbody')).toContainText('Pepperoni');

  await page.getByRole('button', { name: 'Pay now' }).click();

  await expect(page).toHaveURL(/delivery/);

  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(page.locator('#hs-jwt-modal h3 span')).toHaveText('valid');
});

test('register', async ({ page }) => {
  await basicInit(page);

  await page.getByRole('link', { name: 'Register' }).click();
  await page.getByPlaceholder('Full name').fill('New Diner');
  await page.getByPlaceholder('Email address').fill('new@jwt.com');
  await page.getByPlaceholder('Password').fill('password');
  await page.getByRole('button', { name: 'Register' }).click();

  await expect(page.getByRole('link', { name: 'ND' })).toBeVisible();
});

test('logout', async ({ page }) => {
  await basicInit(page);

  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByPlaceholder('Email address').fill('d@jwt.com');
  await page.getByPlaceholder('Password').fill('a');
  await page.getByRole('button', { name: 'Login' }).click();

  await page.getByRole('link', { name: 'Logout' }).click();

  await expect(page.getByRole('link', { name: 'Login' })).toBeVisible();
});

test('service documentation', async ({ page }) => {
  await basicInit(page);

  await page.goto('/docs/service');

  await expect(page.getByRole('heading', { name: 'JWT Pizza API' })).toBeVisible();
  await expect(page.getByText('/api/order/menu')).toBeVisible();
});

test('history page', async ({ page }) => {
  await page.goto('/history');

  await expect(page.getByRole('heading', { name: /Mama Rucci/ })).toBeVisible();
});

test('unknown page', async ({ page }) => {
  await page.goto('/does-not-exist');

  await expect(page.getByRole('heading', { name: 'Oops' })).toBeVisible();
});

test('diner dashboard', async ({ page }) => {
  await basicInit(page);

  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByPlaceholder('Email address').fill('d@jwt.com');
  await page.getByPlaceholder('Password').fill('a');
  await page.getByRole('button', { name: 'Login' }).click();

  await page.getByRole('link', { name: 'KC' }).click();

  await expect(page.getByRole('heading', { name: 'Your pizza kitchen' })).toBeVisible();
  await expect(page.locator('tbody')).toContainText('23');
});

test('franchise dashboard', async ({ page }) => {
  await basicInit(page);

  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByPlaceholder('Email address').fill('franchise@jwt.com');
  await page.getByPlaceholder('Password').fill('a');
  await page.getByRole('button', { name: 'Login' }).click();

await page
  .getByRole('navigation', { name: 'Global' })
  .getByRole('link', { name: 'Franchise' })
  .click();

  await expect(page.getByRole('heading', { name: 'LotaPizza' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Lehi' })).toBeVisible();
});

test('admin dashboard', async ({ page }) => {
  await basicInit(page);

  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByPlaceholder('Email address').fill('admin@jwt.com');
  await page.getByPlaceholder('Password').fill('a');
  await page.getByRole('button', { name: 'Login' }).click();

  await page.getByRole('link', { name: 'Admin' }).click();

  await expect(page.getByRole('heading', { name: "Mama Ricci's kitchen" })).toBeVisible();
  await expect(page.getByText('LotaPizza')).toBeVisible();
});