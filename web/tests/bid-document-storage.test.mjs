import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';

import {
  BID_DOCUMENT_REGION,
  BidDocumentError,
  createBidDocumentKey,
  getBidDocumentConfig,
  getBidDocumentScanStatus,
  isBidDocumentStorageConfigured,
  MAX_BID_DOCUMENT_BYTES,
  validateBidDocument,
} from '../src/lib/bid-document-storage.ts';

const originalEnvironment = {
  bucket: process.env.BID_DOCUMENTS_BUCKET,
  kmsKey: process.env.BID_DOCUMENTS_KMS_KEY_ID,
  region: process.env.BID_DOCUMENTS_REGION,
};

after(() => {
  if (originalEnvironment.bucket === undefined) delete process.env.BID_DOCUMENTS_BUCKET;
  else process.env.BID_DOCUMENTS_BUCKET = originalEnvironment.bucket;
  if (originalEnvironment.kmsKey === undefined) delete process.env.BID_DOCUMENTS_KMS_KEY_ID;
  else process.env.BID_DOCUMENTS_KMS_KEY_ID = originalEnvironment.kmsKey;
  if (originalEnvironment.region === undefined) delete process.env.BID_DOCUMENTS_REGION;
  else process.env.BID_DOCUMENTS_REGION = originalEnvironment.region;
});

describe('bid document storage', () => {
  it('accepts supported documents with matching types and bounded sizes', () => {
    assert.deepEqual(
      validateBidDocument('proposal.pdf', 'application/pdf', 1024),
      { name: 'proposal.pdf', contentType: 'application/pdf', size: 1024 },
    );
    assert.throws(
      () => validateBidDocument('proposal.pdf', 'text/plain', 1024),
      BidDocumentError,
    );
    assert.throws(
      () => validateBidDocument('proposal.pdf', 'application/pdf', MAX_BID_DOCUMENT_BYTES + 1),
      BidDocumentError,
    );
    assert.throws(
      () => validateBidDocument('../proposal.pdf', 'application/pdf', 1024),
      BidDocumentError,
    );
  });

  it('requires the configured private bucket and KMS key in the selected region', () => {
    delete process.env.BID_DOCUMENTS_BUCKET;
    delete process.env.BID_DOCUMENTS_KMS_KEY_ID;
    process.env.BID_DOCUMENTS_REGION = BID_DOCUMENT_REGION;
    assert.equal(isBidDocumentStorageConfigured(), false);
    assert.throws(() => getBidDocumentConfig(), BidDocumentError);

    process.env.BID_DOCUMENTS_BUCKET = 'private-bids';
    process.env.BID_DOCUMENTS_KMS_KEY_ID = 'kms-key-arn';
    assert.equal(getBidDocumentConfig().region, BID_DOCUMENT_REGION);
    assert.equal(isBidDocumentStorageConfigured(), true);
    process.env.BID_DOCUMENTS_REGION = 'us-east-1';
    assert.throws(() => getBidDocumentConfig(), BidDocumentError);
  });

  it('scopes generated S3 keys by tender and contractor', () => {
    const key = createBidDocumentKey('tender-1', 'contractor-1');
    assert.match(key, /^bids\/tender-1\/contractor-1\/[0-9a-f-]{36}$/);
  });

  it('recognizes only the GuardDuty clean-scan status as safe', async () => {
    const clean = await getBidDocumentScanStatus({
      send: async () => ({ TagSet: [{ Key: 'GuardDutyMalwareScanStatus', Value: 'NO_THREATS_FOUND' }] }),
    }, 'private-bids', 'bids/tender/contractor/object');
    const unscanned = await getBidDocumentScanStatus({
      send: async () => ({ TagSet: [] }),
    }, 'private-bids', 'bids/tender/contractor/object');
    assert.equal(clean, 'NO_THREATS_FOUND');
    assert.equal(unscanned, null);
  });
});
