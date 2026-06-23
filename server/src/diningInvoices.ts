import { randomUUID } from 'node:crypto';
import fs from 'fs/promises';
import path from 'path';
import type { DiningInvoice, Reimbursement, ReimbursementFile } from './types.js';
import { resolveUploadOriginalName, saveFileToReimbursement } from './files.js';

const DINING_REPO_DIR = '.dining-invoices';

export function buildDiningInvoiceRepoPath(baseDirectory: string): string {
  return path.join(baseDirectory, DINING_REPO_DIR);
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function resolveUniqueFileName(
  dir: string,
  baseName: string,
  ext: string
): Promise<string> {
  let savedName = `${baseName}${ext}`;
  if (!(await pathExists(path.join(dir, savedName)))) return savedName;

  for (let i = 2; i < 100; i++) {
    savedName = `${baseName}_${i}${ext}`;
    if (!(await pathExists(path.join(dir, savedName)))) return savedName;
  }

  throw new Error('无法生成唯一文件名称');
}

function buildDiningSavedBaseName(extractedAmount: number | null | undefined): string {
  if (extractedAmount != null) {
    return `餐饮-${extractedAmount.toFixed(2)}元`;
  }
  return '餐饮-未识别金额';
}

export async function ensureDiningInvoiceRepo(baseDirectory: string): Promise<string> {
  const repoPath = buildDiningInvoiceRepoPath(baseDirectory);
  await fs.mkdir(repoPath, { recursive: true });
  return repoPath;
}

export async function saveDiningInvoiceToRepository(
  baseDirectory: string,
  originalName: string,
  buffer: Buffer,
  options?: {
    extractedAmount?: number | null;
    amountExtractNote?: string;
    invoiceDate?: string | null;
    dateExtractNote?: string;
  }
): Promise<DiningInvoice> {
  const repoPath = await ensureDiningInvoiceRepo(baseDirectory);
  const ext = path.extname(originalName) || '.pdf';
  const baseName = buildDiningSavedBaseName(options?.extractedAmount);
  const savedName = await resolveUniqueFileName(repoPath, baseName, ext);
  const fullPath = path.join(repoPath, savedName);

  await fs.writeFile(fullPath, buffer);

  return {
    id: randomUUID(),
    originalName,
    savedName,
    relativePath: savedName,
    extractedAmount: options?.extractedAmount ?? null,
    ...(options?.amountExtractNote ? { amountExtractNote: options.amountExtractNote } : {}),
    ...(options?.invoiceDate !== undefined ? { invoiceDate: options.invoiceDate } : {}),
    ...(options?.dateExtractNote ? { dateExtractNote: options.dateExtractNote } : {}),
    status: 'available',
    createdAt: new Date().toISOString(),
  };
}

export function getDiningInvoiceFilePath(
  baseDirectory: string,
  invoice: DiningInvoice
): string {
  const repoPath = path.resolve(buildDiningInvoiceRepoPath(baseDirectory));
  const fullPath = path.resolve(repoPath, invoice.relativePath);
  if (!fullPath.startsWith(repoPath + path.sep) && fullPath !== repoPath) {
    throw new Error('无效的文件路径');
  }
  return fullPath;
}

export async function deleteDiningInvoiceFile(
  baseDirectory: string,
  invoice: DiningInvoice
): Promise<void> {
  const fullPath = getDiningInvoiceFilePath(baseDirectory, invoice);
  try {
    await fs.unlink(fullPath);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') throw err;
  }
}

export async function attachDiningInvoiceToReimbursement(
  reimbursement: Reimbursement,
  invoice: DiningInvoice,
  baseDirectory: string
): Promise<{ fileRecord: ReimbursementFile; updatedInvoice: DiningInvoice }> {
  const srcPath = getDiningInvoiceFilePath(baseDirectory, invoice);
  const buffer = await fs.readFile(srcPath);

  const fileRecord = await saveFileToReimbursement(
    reimbursement,
    'dining',
    'invoice',
    invoice.originalName,
    buffer,
    {
      extractedAmount: invoice.extractedAmount,
      amountExtractNote: invoice.amountExtractNote,
    }
  );

  const updatedInvoice: DiningInvoice = {
    ...invoice,
    status: 'used',
    assignedReimbursementId: reimbursement.id,
    assignedAt: new Date().toISOString(),
  };

  return { fileRecord, updatedInvoice };
}
