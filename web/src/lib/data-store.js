import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { hashPassword, verifyPassword } from './auth.js';

const DATA_DIR = path.join(process.cwd(), 'src', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const TENDERS_FILE = path.join(DATA_DIR, 'tenders.json');
const APPLICATIONS_FILE = path.join(DATA_DIR, 'applications.json');

const DEFAULT_TENDERS = [
  {
    id: 'road-maintenance-services',
    title: 'National Road Maintenance Services',
    department: 'Department of Works',
    location: 'Port Moresby, National Capital District',
    category: 'Roads and Infrastructure',
    value: 'PGK 8.4M',
    deadline: '14 Nov 2026',
    closing: '14 Nov 2026, 5:00 PM (UTC+10)',
    status: 'Open',
    summary:
      'Provision of scheduled and emergency road maintenance services across key urban and provincial routes, including asphalt repair, drainage maintenance, and traffic management support.',
    requirements: [
      'Registered construction or civil works contractor',
      'Evidence of experience in road maintenance projects of similar scale',
      'Financial capability and appropriate equipment list',
      'Ability to provide labor, traffic management, and site supervision',
    ],
    documents: [
      'Company registration and tax certificates',
      'Past performance reports',
      'Technical proposal and methodology',
      'Updated financial statements',
    ],
  },
  {
    id: 'digital-records-platform',
    title: 'Digital Records Management Platform',
    department: 'Department of Finance',
    location: 'Lae, Morobe',
    category: 'Information Technology and Software Development',
    value: 'PGK 1.9M',
    deadline: '03 Dec 2026',
    closing: '03 Dec 2026, 2:00 PM (UTC+10)',
    status: 'Open',
    summary:
      'Design, implementation, and support of a digital records management platform for departmental document control, searchability, retention, and secure access workflows.',
    requirements: [
      'ICT service provider with enterprise software deployment experience',
      'Compliance with data privacy and access control requirements',
      'Host environment support and training capability',
      'Demonstrated project delivery within government settings',
    ],
    documents: [
      'Technical proposal',
      'Implementation roadmap',
      'Past project references',
      'Security and data protection approach',
    ],
  },
  {
    id: 'rural-health-clinic-supply',
    title: 'Rural Health Clinic Supply Contract',
    department: 'Provincial Health Authority',
    location: 'Kokopo, East New Britain',
    category: 'Healthcare and Medical Supplies',
    value: 'PGK 2.7M',
    deadline: '28 Nov 2026',
    closing: '28 Nov 2026, 11:00 AM (UTC+10)',
    status: 'Closing Soon',
    summary:
      'Supply of essential medical equipment and consumables to provincial rural clinics, including installation support and maintenance scheduling.',
    requirements: [
      'Registered medical supply entity',
      'Proven track record for health sector procurement',
      'Service and maintenance plan',
      'Documentation of product quality assurance',
    ],
    documents: [
      'Product catalogue and specifications',
      'Delivery schedule',
      'Supplier quality certification',
      'Past health sector supply references',
    ],
  },
  {
    id: 'school-building-renovation',
    title: 'School Building Renovation and Maintenance',
    department: 'Department of Education',
    location: 'Mount Hagen, Western Highlands',
    category: 'Building and Construction',
    value: 'PGK 3.6M',
    deadline: '22 Nov 2026',
    closing: '22 Nov 2026, 4:30 PM (UTC+10)',
    status: 'Open',
    summary:
      'Renovation and maintenance services for selected educational facilities including classrooms, sanitation systems, and safety upgrades.',
    requirements: [
      'Construction company with civil and building maintenance experience',
      'Health and safety compliance plan',
      'Resource mobilization plan for affected school sites',
      'Project sequencing and QA methodology',
    ],
    documents: [
      'Company registration and insurance',
      'Technical method statement',
      'Project schedule',
      'Past construction references',
    ],
  },
];

const DEFAULT_USERS = [
  {
    id: 'gov_admin_1',
    fullName: 'Government Admin',
    email: 'admin@pngcontractconnect.com',
    organization: 'Department of Works',
    phone: '+675 3000 000',
    province: 'National Capital District',
    role: 'government',
    passwordHash: hashPassword('Admin@123'),
    createdAt: new Date().toISOString(),
  },
  {
    id: 'contractor_1',
    fullName: 'Tana Build PNG',
    email: 'contractor@tana.build',
    organization: 'Tana Build PNG',
    phone: '+675 7800 112',
    province: 'Morobe',
    role: 'contractor',
    passwordHash: hashPassword('Contractor@123'),
    createdAt: new Date().toISOString(),
  },
];

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  const exists = {
    users: await fs.stat(USERS_FILE).then(() => true).catch(() => false),
    tenders: await fs.stat(TENDERS_FILE).then(() => true).catch(() => false),
    applications: await fs.stat(APPLICATIONS_FILE).then(() => true).catch(() => false),
  };

  if (!exists.users) {
    await fs.writeFile(USERS_FILE, JSON.stringify(DEFAULT_USERS, null, 2), 'utf8');
  }

  if (!exists.tenders) {
    await fs.writeFile(TENDERS_FILE, JSON.stringify(DEFAULT_TENDERS, null, 2), 'utf8');
  }

  if (!exists.applications) {
    await fs.writeFile(APPLICATIONS_FILE, JSON.stringify([
      {
        id: crypto.randomUUID(),
        userId: 'contractor_1',
        tenderId: 'road-maintenance-services',
        tenderTitle: 'National Road Maintenance Services',
        status: 'In review',
        submittedAt: new Date().toISOString(),
        organization: 'Tana Build PNG',
      },
      {
        id: crypto.randomUUID(),
        userId: 'contractor_1',
        tenderId: 'digital-records-platform',
        tenderTitle: 'Digital Records Management Platform',
        status: 'Submitted',
        submittedAt: new Date(Date.now() - 86400000).toISOString(),
        organization: 'Tana Build PNG',
      },
    ], null, 2), 'utf8');
  }
}

async function readJson(filePath, fallback) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch {
    await fs.writeFile(filePath, JSON.stringify(fallback, null, 2), 'utf8');
    return fallback;
  }
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

export async function getUsers() {
  await ensureStore();
  return readJson(USERS_FILE, DEFAULT_USERS);
}

export async function getUserByEmail(email) {
  const users = await getUsers();
  const normalized = email?.toLowerCase?.() || '';

  return users.find((user) => user.email.toLowerCase() === normalized) || null;
}

export async function getUserById(id) {
  const users = await getUsers();
  return users.find((user) => user.id === id) || null;
}

export async function authenticateUser({ email, password }) {
  const user = await getUserByEmail(email);

  if (!user) {
    return null;
  }

  return verifyPassword(password, user.passwordHash) ? user : null;
}

export async function createUser(userInput) {
  const users = await getUsers();
  const normalizedEmail = userInput.email.trim().toLowerCase();

  if (users.some((user) => user.email.toLowerCase() === normalizedEmail)) {
    return null;
  }

  const newUser = {
    id: crypto.randomUUID(),
    fullName: userInput.fullName,
    email: normalizedEmail,
    organization: userInput.organization,
    phone: userInput.phone || '',
    province: userInput.province || 'Other',
    role: userInput.role || 'contractor',
    passwordHash: hashPassword(userInput.password),
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  await writeJson(USERS_FILE, users);

  return newUser;
}

export async function getTenders() {
  await ensureStore();
  return readJson(TENDERS_FILE, DEFAULT_TENDERS);
}

export async function getTenderById(id) {
  const tenders = await getTenders();
  return tenders.find((tender) => tender.id === id) || null;
}

export async function createTender(input) {
  const tenders = await getTenders();
  const baseId = String(input.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'tender';
  const newTender = {
    id: input.id || (tenders.some((tender) => tender.id === baseId) ? `${baseId}-${crypto.randomUUID()}` : baseId),
    title: input.title,
    department: input.department,
    publisherId: input.publisherId,
    publisherOrganization: input.publisherOrganization,
    location: input.location,
    category: input.category,
    value: input.value,
    deadline: input.deadline,
    closing: input.closing,
    status: input.status || 'Open',
    summary: input.summary,
    requirements: input.requirements || [],
    documents: input.documents || [],
  };

  tenders.unshift(newTender);
  await writeJson(TENDERS_FILE, tenders);

  return newTender;
}

export async function getApplications() {
  await ensureStore();
  return readJson(APPLICATIONS_FILE, []);
}

export async function getApplicationsForUser(userId) {
  const applications = await getApplications();
  return applications.filter((application) => application.userId === userId);
}

export async function addApplication({ userId, tenderId, tenderTitle, organization, proposal, documents }) {
  const applications = await getApplications();
  const newApplication = {
    id: crypto.randomUUID(),
    userId,
    tenderId,
    tenderTitle,
    organization,
    proposal,
    documents,
    status: 'Submitted',
    submittedAt: new Date().toISOString(),
  };

  applications.unshift(newApplication);
  await writeJson(APPLICATIONS_FILE, applications);

  return newApplication;
}
