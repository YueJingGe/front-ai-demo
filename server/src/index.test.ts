import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from './index.js';

describe('GET /api/health', () => {
  it('returns 200 with OK', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.text).toBe('OK');
  });
});
