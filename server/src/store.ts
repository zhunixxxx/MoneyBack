import { randomUUID } from 'node:crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import type { AppData, AppSettings, DiningInvoice, Reimbursement, ReimbursementTemplate } from './types.js';
import { createDefaultTemplate } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'app.json');

const DEFAULT_SETTINGS: AppSettings = {
  baseDirectory: path.join(process.env.HOME || process.cwd(), 'MoneyBack报销'),
};

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function loadData(): Promise<AppData> {
  await ensureDataDir();
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf-8');
    const data = JSON.parse(raw) as AppData;
    if (!data.diningInvoices) {
      data.diningInvoices = [];
      await saveData(data);
    }
    return data;
  } catch {
    const now = new Date().toISOString();
    const defaultTemplate: ReimbursementTemplate = {
      ...createDefaultTemplate(),
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    const data: AppData = {
      settings: DEFAULT_SETTINGS,
      templates: [defaultTemplate],
      reimbursements: [],
      diningInvoices: [],
    };
    await saveData(data);
    return data;
  }
}

async function saveData(data: AppData) {
  await ensureDataDir();
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

export async function getSettings(): Promise<AppSettings> {
  const data = await loadData();
  return data.settings;
}

export async function updateSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
  const data = await loadData();
  data.settings = { ...data.settings, ...settings };
  await saveData(data);
  return data.settings;
}

export async function getTemplates(): Promise<ReimbursementTemplate[]> {
  const data = await loadData();
  return data.templates;
}

export async function getTemplate(id: string): Promise<ReimbursementTemplate | undefined> {
  const data = await loadData();
  return data.templates.find((t) => t.id === id);
}

export async function createTemplate(
  input: Omit<ReimbursementTemplate, 'id' | 'createdAt' | 'updatedAt'>
): Promise<ReimbursementTemplate> {
  const data = await loadData();
  const now = new Date().toISOString();
  const template: ReimbursementTemplate = {
    ...input,
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  data.templates.push(template);
  await saveData(data);
  return template;
}

export async function updateTemplate(
  id: string,
  input: Partial<Omit<ReimbursementTemplate, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<ReimbursementTemplate | null> {
  const data = await loadData();
  const index = data.templates.findIndex((t) => t.id === id);
  if (index === -1) return null;
  data.templates[index] = {
    ...data.templates[index],
    ...input,
    updatedAt: new Date().toISOString(),
  };
  await saveData(data);
  return data.templates[index];
}

export async function deleteTemplate(id: string): Promise<boolean> {
  const data = await loadData();
  const index = data.templates.findIndex((t) => t.id === id);
  if (index === -1) return false;
  data.templates.splice(index, 1);
  await saveData(data);
  return true;
}

export async function getReimbursements(): Promise<Reimbursement[]> {
  const data = await loadData();
  return data.reimbursements.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function getReimbursement(id: string): Promise<Reimbursement | undefined> {
  const data = await loadData();
  return data.reimbursements.find((r) => r.id === id);
}

export async function addReimbursement(reimbursement: Reimbursement): Promise<Reimbursement> {
  const data = await loadData();
  data.reimbursements.push(reimbursement);
  await saveData(data);
  return reimbursement;
}

export async function updateReimbursement(reimbursement: Reimbursement): Promise<Reimbursement> {
  const data = await loadData();
  const index = data.reimbursements.findIndex((r) => r.id === reimbursement.id);
  if (index === -1) throw new Error('报销记录不存在');
  data.reimbursements[index] = reimbursement;
  await saveData(data);
  return reimbursement;
}

export async function deleteReimbursement(id: string): Promise<boolean> {
  const data = await loadData();
  const index = data.reimbursements.findIndex((r) => r.id === id);
  if (index === -1) return false;
  data.reimbursements.splice(index, 1);
  await saveData(data);
  return true;
}

export async function getDiningInvoices(): Promise<DiningInvoice[]> {
  const data = await loadData();
  return data.diningInvoices.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function getDiningInvoice(id: string): Promise<DiningInvoice | undefined> {
  const data = await loadData();
  return data.diningInvoices.find((inv) => inv.id === id);
}

export async function addDiningInvoice(invoice: DiningInvoice): Promise<DiningInvoice> {
  const data = await loadData();
  data.diningInvoices.push(invoice);
  await saveData(data);
  return invoice;
}

export async function updateDiningInvoice(invoice: DiningInvoice): Promise<DiningInvoice> {
  const data = await loadData();
  const index = data.diningInvoices.findIndex((inv) => inv.id === invoice.id);
  if (index === -1) throw new Error('餐饮发票不存在');
  data.diningInvoices[index] = invoice;
  await saveData(data);
  return invoice;
}

export async function deleteDiningInvoice(id: string): Promise<boolean> {
  const data = await loadData();
  const index = data.diningInvoices.findIndex((inv) => inv.id === id);
  if (index === -1) return false;
  data.diningInvoices.splice(index, 1);
  await saveData(data);
  return true;
}
