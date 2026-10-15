import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getSafeInternalRedirectPath } from '../src/lib/post-login-redirect.ts';

describe('post-login redirects', () => {
  it('returns internal workspace paths with query and hash intact', () => {
    assert.equal(
      getSafeInternalRedirectPath('/procurement-workspace?tender=road#evaluation', '/government-dashboard'),
      '/procurement-workspace?tender=road#evaluation',
    );
  });

  it('falls back for missing, external, or malformed targets', () => {
    assert.equal(getSafeInternalRedirectPath(null, '/government-dashboard'), '/government-dashboard');
    assert.equal(getSafeInternalRedirectPath('https://evil.example', '/government-dashboard'), '/government-dashboard');
    assert.equal(getSafeInternalRedirectPath('//evil.example/path', '/government-dashboard'), '/government-dashboard');
    assert.equal(getSafeInternalRedirectPath('\\\\evil.example\\path', '/government-dashboard'), '/government-dashboard');
  });
});
