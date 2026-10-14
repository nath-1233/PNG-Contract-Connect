import crypto from 'node:crypto';

import {
  GetObjectTaggingCommand,
  HeadObjectCommand,
  S3Client,
  type HeadObjectCommandOutput,
} from '@aws-sdk/client-s3';

export const BID_DOCUMENT_REGION = 'ap-southeast-2';
export const MAX_BID_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const MAX_BID_DOCUMENTS = 5;

const allowedDocuments: Record<string, string> = {
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export type BidDocumentReference = {
  key: string;
  name: string;
  contentType: string;
  size: number;
};

export class BidDocumentError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function getBidDocumentConfig() {
  const region = process.env.BID_DOCUMENTS_REGION || BID_DOCUMENT_REGION;
  const bucket = process.env.BID_DOCUMENTS_BUCKET;
  const kmsKeyId = process.env.BID_DOCUMENTS_KMS_KEY_ID;

  if (region !== BID_DOCUMENT_REGION) {
    throw new BidDocumentError(`Bid document storage must use ${BID_DOCUMENT_REGION}.`, 503);
  }
  if (!bucket || !kmsKeyId) {
    throw new BidDocumentError('Secure bid document storage is not configured.', 503);
  }

  return { region, bucket, kmsKeyId };
}

export function isBidDocumentStorageConfigured() {
  return Boolean(
    process.env.BID_DOCUMENTS_BUCKET &&
    process.env.BID_DOCUMENTS_KMS_KEY_ID &&
    (!process.env.BID_DOCUMENTS_REGION || process.env.BID_DOCUMENTS_REGION === BID_DOCUMENT_REGION),
  );
}

export function createBidDocumentClient() {
  return new S3Client({ region: BID_DOCUMENT_REGION });
}

export function validateBidDocument(name: unknown, contentType: unknown, size: unknown) {
  if (
    typeof name !== 'string' ||
    !name.trim() ||
    name.length > 160 ||
    /[\\/\u0000-\u001f\u007f]/.test(name)
  ) {
    throw new BidDocumentError('Use a filename of 1 to 160 characters without path separators.');
  }

  const normalizedName = name.trim();
  const expectedType = allowedDocuments[normalizedName.slice(normalizedName.lastIndexOf('.')).toLowerCase()];
  if (!expectedType || contentType !== expectedType) {
    throw new BidDocumentError('Upload a PDF, DOCX, XLSX, JPG, JPEG, or PNG file with its matching file type.');
  }
  if (!Number.isInteger(size) || (size as number) < 1 || (size as number) > MAX_BID_DOCUMENT_BYTES) {
    throw new BidDocumentError('Each bid document must be smaller than 10 MB.');
  }

  return { name: normalizedName, contentType: expectedType, size: size as number };
}

export function createBidDocumentKey(tenderId: string, userId: string) {
  return `bids/${tenderId}/${userId}/${crypto.randomUUID()}`;
}

export async function getBidDocumentScanStatus(client: S3Client, bucket: string, key: string) {
  const result = await client.send(new GetObjectTaggingCommand({ Bucket: bucket, Key: key }));
  return result.TagSet?.find((tag) => tag.Key === 'GuardDutyMalwareScanStatus')?.Value || null;
}

export async function verifyUploadedBidDocument(
  client: S3Client,
  bucket: string,
  tenderId: string,
  userId: string,
  document: BidDocumentReference,
): Promise<HeadObjectCommandOutput> {
  if (typeof document.key !== 'string' || !document.key.startsWith(`bids/${tenderId}/${userId}/`)) {
    throw new BidDocumentError('The uploaded document does not belong to your application.', 403);
  }

  const metadata = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: document.key }));
  if (
    metadata.Metadata?.ownerid !== userId ||
    metadata.Metadata?.tenderid !== tenderId ||
    metadata.ContentType !== document.contentType ||
    metadata.ContentLength !== document.size ||
    metadata.ContentLength > MAX_BID_DOCUMENT_BYTES ||
    !allowedDocuments[document.name.slice(document.name.lastIndexOf('.')).toLowerCase()] ||
    !document.name.trim() ||
    document.name.length > 160 ||
    /[\\/\u0000-\u001f\u007f]/.test(document.name)
  ) {
    throw new BidDocumentError('The uploaded document could not be verified.', 400);
  }

  const status = await getBidDocumentScanStatus(client, bucket, document.key);
  if (status === 'THREATS_FOUND') {
    throw new BidDocumentError('A security threat was detected in an uploaded document. It was not attached to your bid; remove it and upload a clean copy.', 422);
  }
  if (status !== 'NO_THREATS_FOUND') {
    throw new BidDocumentError('Your uploaded documents are being security-scanned. Try submitting again shortly.', 409);
  }

  return metadata;
}
