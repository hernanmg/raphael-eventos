import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from './index';

describe('GET /health', () => {
  it('responde ok sin depender de que la base local esté levantada', async () => {
    const app = createApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
