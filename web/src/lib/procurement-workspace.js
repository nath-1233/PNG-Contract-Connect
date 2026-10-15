import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';

const DATA_DIR = path.join(process.cwd(), 'src', 'data');
const WORKSPACES_FILE = path.join(DATA_DIR, 'procurement-workspaces.json');
const MAX_UPDATE_ATTEMPTS = 5;
let schemaReady;

function emptyWorkspace(tenderId) {
  return {
    tenderId,
    milestones: [],
    invoices: [],
    declarations: [],
    evaluations: [],
    auditEntries: [],
  };
}

export class ProcurementWorkspaceStorageError extends Error {
  constructor(message = 'Procurement workspace storage is not configured or is temporarily unavailable.') {
    super(message);
    this.name = 'ProcurementWorkspaceStorageError';
    this.status = 503;
  }
}

function getDatabase() {
  if (!process.env.DATABASE_URL) {
    if (process.env.NODE_ENV === 'production') {
      throw new ProcurementWorkspaceStorageError(
        'Procurement workspace database is not configured. Ask the site administrator to connect Neon Postgres.',
      );
    }
    return null;
  }

  try {
    return neon(process.env.DATABASE_URL);
  } catch (error) {
    console.error(
      'Unable to configure procurement workspace database:',
      error instanceof Error ? error.name : 'UnknownError',
    );
    throw new ProcurementWorkspaceStorageError();
  }
}

async function ensureDatabaseSchema(sql) {
  if (!schemaReady) {
    schemaReady = sql`
      CREATE TABLE IF NOT EXISTS procurement_workspaces (
        tender_id TEXT PRIMARY KEY,
        workspace_data JSONB NOT NULL,
        version BIGINT NOT NULL DEFAULT 1,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `.then(() => undefined).catch((error) => {
      schemaReady = undefined;
      console.error(
        'Unable to initialize procurement workspace database:',
        error instanceof Error ? error.name : 'UnknownError',
      );
      throw new ProcurementWorkspaceStorageError();
    });
  }
  await schemaReady;
}

async function getDatabaseWorkspace(sql, tenderId) {
  await ensureDatabaseSchema(sql);
  try {
    const rows = await sql`
      SELECT workspace_data
      FROM procurement_workspaces
      WHERE tender_id = ${tenderId}
    `;
    return rows[0]?.workspace_data || emptyWorkspace(tenderId);
  } catch (error) {
    console.error(
      'Unable to read procurement workspace:',
      error instanceof Error ? error.name : 'UnknownError',
    );
    throw new ProcurementWorkspaceStorageError();
  }
}

async function readWorkspaces() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const contents = await fs.readFile(WORKSPACES_FILE, 'utf8');
    const parsed = JSON.parse(contents);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Procurement workspace data must be an object.');
    }
    return parsed;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return {};
    }
    throw error;
  }
}

export async function getProcurementWorkspace(tenderId) {
  const sql = getDatabase();
  if (sql) return getDatabaseWorkspace(sql, tenderId);

  const workspaces = await readWorkspaces();
  return workspaces[tenderId] || emptyWorkspace(tenderId);
}

export async function updateProcurementWorkspace(tenderId, update) {
  const sql = getDatabase();
  if (sql) {
    await ensureDatabaseSchema(sql);

    try {
      await sql`
        INSERT INTO procurement_workspaces (tender_id, workspace_data)
        VALUES (${tenderId}, ${JSON.stringify(emptyWorkspace(tenderId))}::jsonb)
        ON CONFLICT (tender_id) DO NOTHING
      `;

      for (let attempt = 0; attempt < MAX_UPDATE_ATTEMPTS; attempt += 1) {
        const rows = await sql`
          SELECT workspace_data, version
          FROM procurement_workspaces
          WHERE tender_id = ${tenderId}
        `;
        const current = rows[0];
        if (!current) throw new ProcurementWorkspaceStorageError();

        const workspace = current.workspace_data;
        const result = await update(workspace);
        const saved = await sql`
          UPDATE procurement_workspaces
          SET workspace_data = ${JSON.stringify(workspace)}::jsonb,
              version = version + 1,
              updated_at = CURRENT_TIMESTAMP
          WHERE tender_id = ${tenderId} AND version = ${current.version}
          RETURNING version
        `;
        if (saved.length) return result;
      }

      throw new ProcurementWorkspaceStorageError(
        'This workspace is receiving concurrent updates. Please retry your change.',
      );
    } catch (error) {
      if (error instanceof ProcurementWorkspaceStorageError) throw error;
      console.error(
        'Unable to update procurement workspace:',
        error instanceof Error ? error.name : 'UnknownError',
      );
      throw new ProcurementWorkspaceStorageError();
    }
  }

  const workspaces = await readWorkspaces();
  const workspace = workspaces[tenderId] || emptyWorkspace(tenderId);
  const result = await update(workspace);
  workspaces[tenderId] = workspace;
  await fs.writeFile(WORKSPACES_FILE, JSON.stringify(workspaces, null, 2), 'utf8');
  return result;
}

export function appendAuditEntry(workspace, { actorId, actorName, event, details = {} }) {
  const previousHash = workspace.auditEntries.at(-1)?.hash || 'GENESIS';
  const entry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    actorId,
    actorName,
    event,
    details,
    previousHash,
  };
  entry.hash = crypto.createHash('sha256').update(JSON.stringify(entry)).digest('hex');
  workspace.auditEntries.push(entry);
  return entry;
}

export function verifyAuditChain(entries) {
  let previousHash = 'GENESIS';
  for (const entry of entries) {
    if (entry.previousHash !== previousHash) return false;
    const { hash, ...unsignedEntry } = entry;
    const expectedHash = crypto.createHash('sha256').update(JSON.stringify(unsignedEntry)).digest('hex');
    if (hash !== expectedHash) return false;
    previousHash = hash;
  }
  return true;
}
