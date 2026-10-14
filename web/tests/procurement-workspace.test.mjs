import test from 'node:test';
import assert from 'node:assert/strict';

import { appendAuditEntry, verifyAuditChain } from '../src/lib/procurement-workspace.js';

test('workspace audit entries form a verifiable hash chain', () => {
  const workspace = { auditEntries: [] };
  appendAuditEntry(workspace, {
    actorId: 'officer-1',
    actorName: 'Procurement Officer',
    event: 'bid-evaluated',
    details: { decision: 'Shortlisted' },
  });
  appendAuditEntry(workspace, {
    actorId: 'officer-1',
    actorName: 'Procurement Officer',
    event: 'milestone-created',
    details: { milestoneId: 'mile-1' },
  });

  assert.equal(verifyAuditChain(workspace.auditEntries), true);
});

test('workspace audit chain detects modified records', () => {
  const workspace = { auditEntries: [] };
  appendAuditEntry(workspace, {
    actorId: 'contractor-1',
    actorName: 'Contractor',
    event: 'invoice-submitted',
    details: { invoiceId: 'invoice-1' },
  });
  workspace.auditEntries[0].event = 'invoice-paid';

  assert.equal(verifyAuditChain(workspace.auditEntries), false);
});
