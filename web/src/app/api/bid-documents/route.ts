import { createPresignedPost } from '@aws-sdk/s3-presigned-post';

import { getCurrentUser } from '@/lib/auth';
import { getTenderById } from '@/lib/data-store';
import {
  BidDocumentError,
  BID_DOCUMENT_REGION,
  createBidDocumentClient,
  createBidDocumentKey,
  getBidDocumentConfig,
  MAX_BID_DOCUMENT_BYTES,
  validateBidDocument,
} from '@/lib/bid-document-storage';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Authentication required.' }, { status: 401 });
  if (user.role !== 'contractor') {
    return Response.json({ error: 'Only contractors can upload bid documents.' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.tenderId !== 'string' || !body.tenderId.trim()) {
    return Response.json({ error: 'Select a valid contract before uploading documents.' }, { status: 400 });
  }

  try {
    const file = validateBidDocument(body.name, body.contentType, body.size);
    const tender = await getTenderById(body.tenderId);
    if (!tender) return Response.json({ error: 'This contract is no longer available.' }, { status: 404 });
    if (!['Open', 'Closing Soon'].includes(tender.status)) {
      return Response.json({ error: 'Applications for this contract are closed.' }, { status: 409 });
    }

    const { bucket, kmsKeyId } = getBidDocumentConfig();
    const key = createBidDocumentKey(tender.id, user.id);
    const fields = {
      'Content-Type': file.contentType,
      'x-amz-meta-ownerid': user.id,
      'x-amz-meta-tenderid': tender.id,
      'x-amz-server-side-encryption': 'aws:kms',
      'x-amz-server-side-encryption-aws-kms-key-id': kmsKeyId,
      'x-amz-tagging': 'upload-source=portal',
    };
    const post = await createPresignedPost(createBidDocumentClient(), {
      Bucket: bucket,
      Key: key,
      Expires: 300,
      Fields: fields,
      Conditions: [
        ['content-length-range', 1, MAX_BID_DOCUMENT_BYTES],
        ['eq', '$Content-Type', file.contentType],
        ['eq', '$x-amz-meta-ownerid', user.id],
        ['eq', '$x-amz-meta-tenderid', tender.id],
        ['eq', '$x-amz-server-side-encryption', 'aws:kms'],
        ['eq', '$x-amz-server-side-encryption-aws-kms-key-id', kmsKeyId],
        ['eq', '$x-amz-tagging', 'upload-source=portal'],
      ],
    });

    return Response.json({
      uploadUrl: post.url,
      fields: post.fields,
      key,
      name: file.name,
      contentType: file.contentType,
      region: BID_DOCUMENT_REGION,
    });
  } catch (error) {
    if (error instanceof BidDocumentError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error('Unable to create a secure bid document upload request:', error instanceof Error ? error.name : 'UnknownError');
    return Response.json({ error: 'Secure bid document storage is temporarily unavailable.' }, { status: 503 });
  }
}
