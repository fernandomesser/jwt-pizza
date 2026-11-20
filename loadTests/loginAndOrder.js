import { sleep, group, check, fail } from 'k6';
import http from 'k6/http';
import secrets from 'k6/secrets';

const baseUrl = 'https://pizza-service.fernandomesser.click';
const websiteUrl = 'https://pizza.fernandomesser.click';
const factoryUrl = 'https://pizza-factory.cs329.click';

export const options = {
  cloud: {
    distribution: {
      'amazon:us:ashburn': {
        loadZone: 'amazon:us:ashburn',
        percent: 100,
      },
    },
    apm: [],
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<2000'],
  },
  scenarios: {
    Scenario_1: {
      executor: 'ramping-vus',
      gracefulStop: '30s',
      stages: [
        { target: 10, duration: '1m' },
        { target: 10, duration: '3m30s' },
        { target: 0, duration: '1m' },
      ],
      gracefulRampDown: '30s',
      exec: 'scenario_1',
    },
  },
};

export async function scenario_1() {
  const email = await secrets.get('diner-email');
  const password = await secrets.get('diner-password');
  const factoryApiKey = await secrets.get('factory-api-key');

  if (!email || !password || !factoryApiKey) {
    fail('Could not read one or more required Grafana secrets.');
  }

  group('Open pizza website', function () {
    http.get(websiteUrl);
    sleep(2);
  });

  let response = http.put(
    `${baseUrl}/api/auth`,
    JSON.stringify({ email, password }),
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!check(response, {
    'login returns HTTP 200': (r) => r.status === 200,
  })) {
    fail(`Login failed with HTTP ${response.status}`);
  }

  const authToken = response.json().token;

  if (!authToken) {
    fail('Login response did not contain a token.');
  }

  const authParams = {
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
  };

  group('Browse menu and franchise', function () {
    response = http.get(`${baseUrl}/api/order/menu`, authParams);
    check(response, {
      'menu request returns HTTP 200': (r) => r.status === 200,
    });

    response = http.get(
      `${baseUrl}/api/franchise?page=0&limit=20&name=*`,
      authParams
    );
    check(response, {
      'franchise request returns HTTP 200': (r) => r.status === 200,
    });

    response = http.get(`${baseUrl}/api/user/me`, authParams);
    check(response, {
      'user request returns HTTP 200': (r) => r.status === 200,
    });
  });

  sleep(2);

  let orderResponse;

  group('Buy pizza', function () {
    orderResponse = http.post(
      `${baseUrl}/api/order`,
      JSON.stringify({
        items: [
          {
            menuId: 1,
            description: 'Veggie',
            price: 0.0038,
          },
        ],
        storeId: '1',
        franchiseId: 1,
      }),
      authParams
    );
  });

  if (!check(orderResponse, {
    'purchase returns HTTP 200': (r) => r.status === 200,
  })) {
    fail(`Purchase failed with HTTP ${orderResponse.status}`);
  }

  const pizzaJwt = orderResponse.json().jwt;

  if (!pizzaJwt) {
    fail('Purchase response did not contain the pizza JWT.');
  }

  sleep(2);

  group('Verify pizza JWT', function () {
    const verificationResponse = http.post(
      `${factoryUrl}/api/order/verify`,
      JSON.stringify({ jwt: pizzaJwt }),
      {
        headers: {
          Authorization: `Bearer ${factoryApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    check(verificationResponse, {
      'pizza JWT verification returns HTTP 200 and valid': (r) =>
        r.status === 200 && r.json().message === 'valid',
    });
  });
}