import http from 'k6/http';
import { check, group, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp up a 50 usuarios
    { duration: '5m', target: 50 },   // Mantener 50 usuarios
    { duration: '2m', target: 100 },  // Ramp up a 100 usuarios
    { duration: '5m', target: 100 },  // Mantener 100 usuarios
    { duration: '2m', target: 0 },    // Ramp down a 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.1'],
  },
};

const BASE_URL = 'http://localhost:3001/api';
let token = '';

export function setup() {
  const payload = JSON.stringify({
    email: 'admin@hotel.com',
    password: 'password123',
  });

  const res = http.post(`${BASE_URL}/auth/login`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  if (res.status === 200) {
    token = JSON.parse(res.body).accessToken;
  }

  return { token };
}

export default function (data) {
  const authToken = data.token;
  const params = {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
  };

  group('Stays API', () => {
    const staysRes = http.get(`${BASE_URL}/stays`, params);
    check(staysRes, {
      'GET /stays status 200': (r) => r.status === 200,
      'GET /stays response time < 500ms': (r) => r.timings.duration < 500,
    });
    sleep(1);
  });

  group('Vouchers API', () => {
    const vouchersRes = http.get(`${BASE_URL}/vouchers`, params);
    check(vouchersRes, {
      'GET /vouchers status 200': (r) => r.status === 200,
      'GET /vouchers response time < 500ms': (r) => r.timings.duration < 500,
    });
    sleep(1);
  });

  group('Orders API', () => {
    const ordersRes = http.get(`${BASE_URL}/orders`, params);
    check(ordersRes, {
      'GET /orders status 200': (r) => r.status === 200,
      'GET /orders response time < 500ms': (r) => r.timings.duration < 500,
    });
    sleep(1);
  });

  group('Reports API', () => {
    const reportsRes = http.get(`${BASE_URL}/reports/dashboard/H001`, params);
    check(reportsRes, {
      'GET /reports/dashboard status 200': (r) => r.status === 200,
      'GET /reports/dashboard response time < 1000ms': (r) => r.timings.duration < 1000,
    });
    sleep(1);
  });
}
