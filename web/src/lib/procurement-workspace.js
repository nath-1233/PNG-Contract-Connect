import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.join(process.cwd(), 'src', 'data');
const WORKSPACES_FILE = path.join(DATA_DIR, 'procurement-workspaces.json');

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
  const workspaces = await readWorkspaces();
  return workspaces[tenderId] || emptyWorkspace(tenderId);
}

export async function updateProcurementWorkspace(tenderId, update) {
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
