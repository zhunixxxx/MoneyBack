import { randomUUID } from 'node:crypto';
import fs from 'fs/promises';
import path from 'path';
import { extractReceiptInfoFromReceipt } from './receiptExtract.js';
import type { FileCategory, FileSubType, Reimbursement, ReimbursementFile } from './types.js';

const WORK_DIR = '.work';

export function sanitizeFolderName(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, '_').trim();
}

/** 优先使用前端传来的文件名，并修正 multer 对 UTF-8 文件名的常见乱码 */
export function resolveUploadOriginalName(
  multerOriginalname: string,
  formField?: string
): string {
  const fromForm = typeof formField === 'string' ? formField.trim() : '';
  if (fromForm) return fromForm;

  try {
    const decoded = Buffer.from(multerOriginalname, 'latin1').toString('utf8');
    if (decoded !== multerOriginalname && /[\u4e00-\u9fff（）]/.test(decoded)) {
      return decoded;
    }
  } catch {
    // ignore
  }
  return multerOriginalname;
}

export function formatDateYmd(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

export function buildReimbursementFolderName(
  startDate: string,
  locations: string[],
  purpose: string
): string {
  const datePart = formatDateYmd(startDate);
  const locationPart = locations.map((l) => sanitizeFolderName(l)).filter(Boolean).join('+');
  const purposePart = sanitizeFolderName(purpose);
  return `${datePart}-${locationPart}-${purposePart}`;
}

export function buildReimbursementDisplayName(
  locations: string[],
  purpose: string,
  startDate: string,
  endDate: string
): string {
  const loc = locations.join('、');
  const dateRange =
    startDate === endDate ? startDate : `${startDate} ~ ${endDate}`;
  return `${loc} · ${purpose}（${dateRange}）`;
}

export function buildWorkFolderPath(baseDirectory: string, reimbursementId: string): string {
  return path.join(baseDirectory, WORK_DIR, reimbursementId);
}

export function buildSavedFileBaseName(
  category: FileCategory,
  subType: FileSubType,
  reimbursement: Reimbursement,
  options?: { extractedAmount?: number | null; checkInDate?: string | null }
): string {
  if (category === 'dining' && subType === 'invoice') {
    if (options?.extractedAmount != null) {
      return `餐饮-${options.extractedAmount.toFixed(2)}元`;
    }
    return '餐饮-未识别金额';
  }

  const defaultDate = reimbursement.startDate ?? new Date().toISOString().slice(0, 10);
  const dateSource =
    category === 'accommodation' ? options?.checkInDate ?? defaultDate : defaultDate;
  const datePart = formatDateYmd(dateSource);

  const names: Record<string, string> = {
    'transport_rail-invoice': `${datePart}-交通-高铁-电子发票`,
    'transport_taxi-invoice': `${datePart}-交通-打车-电子发票`,
    'transport_taxi-itinerary': `${datePart}-交通-打车-行程单`,
    'accommodation-invoice': `${datePart}-住宿-电子发票`,
    'accommodation-receipt': `${datePart}-住宿-水单`,
  };

  const key = `${category}-${subType}`;
  const base = names[key];
  if (!base) throw new Error(`未知文件类型: ${category}/${subType}`);
  return base;
}

function buildOriginalSavedName(originalName: string): { baseName: string; ext: string } {
  const ext = path.extname(originalName) || '.pdf';
  const rawBase = path.basename(originalName, ext);
  const baseName = sanitizeFolderName(rawBase) || 'file';
  return { baseName, ext };
}

export async function createWorkFolder(baseDirectory: string, reimbursementId: string): Promise<string> {
  const folderPath = buildWorkFolderPath(baseDirectory, reimbursementId);
  await fs.mkdir(folderPath, { recursive: true });
  return folderPath;
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

async function resolveUniqueFolderPath(baseDirectory: string, folderName: string): Promise<string> {
  let candidate = path.join(baseDirectory, folderName);
  if (!(await pathExists(candidate))) return candidate;

  for (let i = 2; i < 100; i++) {
    candidate = path.join(baseDirectory, `${folderName}_${i}`);
    if (!(await pathExists(candidate))) return candidate;
  }

  throw new Error('无法生成唯一文件夹名称');
}

async function clearDirectory(dir: string) {
  const entries = await fs.readdir(dir);
  for (const entry of entries) {
    await fs.rm(path.join(dir, entry), { recursive: true, force: true });
  }
}

export async function saveFileToReimbursement(
  reimbursement: Reimbursement,
  category: FileCategory,
  subType: FileSubType,
  originalName: string,
  buffer: Buffer,
  options?: {
    extractedAmount?: number | null;
    amountExtractNote?: string;
    extractedCheckInDate?: string | null;
  }
): Promise<ReimbursementFile> {
  const targetDir = reimbursement.folderPath;
  await fs.mkdir(targetDir, { recursive: true });

  const { baseName, ext } = buildOriginalSavedName(originalName);
  const savedName = await resolveUniqueFileName(targetDir, baseName, ext);
  const fullPath = path.join(targetDir, savedName);

  await fs.writeFile(fullPath, buffer);

  return {
    id: randomUUID(),
    category,
    subType,
    originalName,
    savedName,
    relativePath: savedName,
    uploadedAt: new Date().toISOString(),
    ...(options?.extractedAmount !== undefined
      ? { extractedAmount: options.extractedAmount }
      : {}),
    ...(options?.amountExtractNote ? { amountExtractNote: options.amountExtractNote } : {}),
    ...(options?.extractedCheckInDate !== undefined
      ? { extractedCheckInDate: options.extractedCheckInDate }
      : {}),
  };
}

export interface ExportPreviewItem {
  fileId: string;
  category: FileCategory;
  subType: FileSubType;
  originalName: string;
  exportFileName: string;
}

export interface ExportPreview {
  folderName: string;
  items: ExportPreviewItem[];
}

function roundAmount(amount: number): number {
  return Math.round(amount * 100) / 100;
}

interface AccommodationExportContext {
  dateByAmount: Map<number, string>;
}

async function prepareAccommodationExportContext(
  reimbursement: Reimbursement
): Promise<AccommodationExportContext> {
  const dateByAmount = new Map<number, string>();

  for (const file of reimbursement.files) {
    if (file.category !== 'accommodation' || file.subType !== 'receipt') continue;

    const srcPath = path.join(reimbursement.folderPath, file.relativePath);
    let checkInDate = file.extractedCheckInDate ?? undefined;
    let amount = file.extractedAmount ?? undefined;

    const needsRead = !checkInDate || amount == null;
    if (needsRead) {
      const buffer = await fs.readFile(srcPath);
      const info = await extractReceiptInfoFromReceipt(buffer, file.originalName);
      if (!checkInDate && info.checkInDate) {
        checkInDate = info.checkInDate;
        file.extractedCheckInDate = info.checkInDate;
      }
      if (amount == null && info.amount != null) {
        amount = info.amount;
        file.extractedAmount = info.amount;
      }
    }

    if (checkInDate && amount != null) {
      dateByAmount.set(roundAmount(amount), checkInDate);
    }
  }

  return { dateByAmount };
}

function resolveAccommodationDateForFile(
  file: ReimbursementFile,
  reimbursement: Reimbursement,
  ctx: AccommodationExportContext,
  receiptCheckInDate?: string
): string {
  const defaultDate = reimbursement.startDate ?? new Date().toISOString().slice(0, 10);

  if (file.category === 'accommodation' && file.subType === 'receipt') {
    return receiptCheckInDate ?? file.extractedCheckInDate ?? defaultDate;
  }

  if (
    file.category === 'accommodation' &&
    file.subType === 'invoice' &&
    file.extractedAmount != null
  ) {
    const matched = ctx.dateByAmount.get(roundAmount(file.extractedAmount));
    if (matched) return matched;
  }

  return defaultDate;
}

function resolveUniqueNameInSet(baseName: string, ext: string, used: Set<string>): string {
  let savedName = `${baseName}${ext}`;
  if (!used.has(savedName)) {
    used.add(savedName);
    return savedName;
  }

  for (let i = 2; i < 100; i++) {
    savedName = `${baseName}_${i}${ext}`;
    if (!used.has(savedName)) {
      used.add(savedName);
      return savedName;
    }
  }

  throw new Error('无法生成唯一文件名称');
}

async function resolveExportFileName(
  reimbursement: Reimbursement,
  file: ReimbursementFile,
  usedNames: Set<string>,
  accommodationCtx: AccommodationExportContext
): Promise<{ exportFileName: string; checkInDate?: string; extractedAmount?: number }> {
  const srcPath = path.join(reimbursement.folderPath, file.relativePath);
  const ext = path.extname(file.originalName) || path.extname(file.savedName) || '.pdf';

  let receiptCheckInDate = file.extractedCheckInDate ?? undefined;
  let receiptAmount = file.extractedAmount ?? undefined;

  if (file.category === 'accommodation' && file.subType === 'receipt') {
    if (!receiptCheckInDate || receiptAmount == null) {
      const buffer = await fs.readFile(srcPath);
      const info = await extractReceiptInfoFromReceipt(buffer, file.originalName);
      if (!receiptCheckInDate && info.checkInDate) {
        receiptCheckInDate = info.checkInDate;
      }
      if (receiptAmount == null && info.amount != null) {
        receiptAmount = info.amount;
      }
    }
  }

  const checkInDate = resolveAccommodationDateForFile(
    file,
    reimbursement,
    accommodationCtx,
    receiptCheckInDate
  );

  const exportBaseName = buildSavedFileBaseName(file.category, file.subType, reimbursement, {
    extractedAmount: file.extractedAmount,
    checkInDate,
  });

  const exportFileName = resolveUniqueNameInSet(exportBaseName, ext, usedNames);
  return {
    exportFileName,
    ...(receiptCheckInDate && !file.extractedCheckInDate ? { checkInDate: receiptCheckInDate } : {}),
    ...(receiptAmount != null && file.extractedAmount == null
      ? { extractedAmount: receiptAmount }
      : {}),
  };
}

export async function buildExportPreview(reimbursement: Reimbursement): Promise<ExportPreview> {
  if (!reimbursement.startDate || !reimbursement.locations?.length || !reimbursement.purpose) {
    throw new Error('报销信息不完整，无法导出');
  }
  if (reimbursement.files.length === 0) {
    throw new Error('没有可导出的文件');
  }

  const folderName = buildReimbursementFolderName(
    reimbursement.startDate,
    reimbursement.locations,
    reimbursement.purpose
  );

  const usedNames = new Set<string>();
  const accommodationCtx = await prepareAccommodationExportContext(reimbursement);
  const items: ExportPreviewItem[] = [];

  for (const file of reimbursement.files) {
    const { exportFileName } = await resolveExportFileName(
      reimbursement,
      file,
      usedNames,
      accommodationCtx
    );
    items.push({
      fileId: file.id,
      category: file.category,
      subType: file.subType,
      originalName: file.originalName,
      exportFileName,
    });
  }

  return { folderName, items };
}

export async function exportReimbursement(
  reimbursement: Reimbursement,
  baseDirectory: string
): Promise<Reimbursement> {
  if (!reimbursement.startDate || !reimbursement.locations?.length || !reimbursement.purpose) {
    throw new Error('报销信息不完整，无法导出');
  }
  if (reimbursement.files.length === 0) {
    throw new Error('没有可导出的文件');
  }

  const folderName = buildReimbursementFolderName(
    reimbursement.startDate,
    reimbursement.locations,
    reimbursement.purpose
  );

  const expectedPath = path.join(baseDirectory, folderName);
  let exportPath = reimbursement.exportFolderPath;

  if (exportPath && path.resolve(exportPath) !== path.resolve(expectedPath)) {
    exportPath = undefined;
  }
  if (!exportPath) {
    exportPath = await resolveUniqueFolderPath(baseDirectory, folderName);
  }

  await fs.mkdir(exportPath, { recursive: true });
  await clearDirectory(exportPath);

  const usedNames = new Set<string>();
  const accommodationCtx = await prepareAccommodationExportContext(reimbursement);

  for (const file of reimbursement.files) {
    const srcPath = path.join(reimbursement.folderPath, file.relativePath);
    const { exportFileName, checkInDate, extractedAmount } = await resolveExportFileName(
      reimbursement,
      file,
      usedNames,
      accommodationCtx
    );

    if (checkInDate) {
      file.extractedCheckInDate = checkInDate;
    }
    if (extractedAmount != null) {
      file.extractedAmount = extractedAmount;
    }

    await fs.copyFile(srcPath, path.join(exportPath, exportFileName));
    file.exportedName = exportFileName;
  }

  reimbursement.exportFolderPath = exportPath;
  reimbursement.exportedAt = new Date().toISOString();
  return reimbursement;
}

export async function deleteFileFromReimbursement(
  reimbursement: Reimbursement,
  fileId: string
): Promise<ReimbursementFile> {
  const index = reimbursement.files.findIndex((f) => f.id === fileId);
  if (index === -1) throw new Error('文件不存在');

  const file = reimbursement.files[index];
  const fullPath = path.join(reimbursement.folderPath, file.relativePath);

  try {
    await fs.unlink(fullPath);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') throw err;
  }

  if (reimbursement.exportFolderPath && file.exportedName) {
    try {
      await fs.unlink(path.join(reimbursement.exportFolderPath, file.exportedName));
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') throw err;
    }
  }

  return file;
}

export function getReimbursementFilePath(
  reimbursement: Reimbursement,
  file: ReimbursementFile
): string {
  const folderPath = path.resolve(reimbursement.folderPath);
  const fullPath = path.resolve(reimbursement.folderPath, file.relativePath);
  if (!fullPath.startsWith(folderPath + path.sep) && fullPath !== folderPath) {
    throw new Error('无效的文件路径');
  }
  return fullPath;
}

export function getDisplayFolderPath(reimbursement: Reimbursement): string {
  return reimbursement.exportFolderPath ?? reimbursement.folderPath;
}

export async function openFolder(folderPath: string): Promise<void> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  const platform = process.platform;
  if (platform === 'win32') {
    await execAsync(`explorer "${folderPath}"`);
  } else if (platform === 'darwin') {
    await execAsync(`open "${folderPath}"`);
  } else {
    await execAsync(`xdg-open "${folderPath}"`);
  }
}
