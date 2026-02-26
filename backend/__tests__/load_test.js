import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
    stages: [
        { duration: '30s', target: 50 },  // Ramp up to 50 users
        { duration: '1m', target: 50 },   // Stay at 50 users
        { duration: '30s', target: 200 }, // Spike to 200 users
        { duration: '1m', target: 200 },  // Stay at 200 users
        { duration: '30s', target: 0 },   // Ramp down
    ],
    thresholds: {
        http_req_duration: ['p(95)<500'], // 95% of requests must be below 500ms
    },
};

const BASE_URL = 'http://109.199.113.45/api';

export default function () {
    // 1. Health check
    let res = http.get(`${BASE_URL}/health`);
    check(res, { 'status is 200': (r) => r.status === 200 });

    // 2. Public information
    res = http.get(`${BASE_URL}/public/plans`);
    check(res, { 'plans load success': (r) => r.status === 200 });

    sleep(1);
}
