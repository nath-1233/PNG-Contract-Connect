import test from 'node:test';
import assert from 'node:assert/strict';

import { createSessionToken, verifySessionToken } from '../src/lib/auth.js';

test('session token round trip works', () => {
  const payload = { id: 'u_123', email: 'ops@pnglaw.gov.pg', role: 'government' };
  const token = createSessionToken(payload);
  const decoded = verifySessionToken(token);

  assert.deepEqual(decoded, payload);
});
