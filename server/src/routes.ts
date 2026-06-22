import { Router } from 'express';
import multer from 'multer';
import {
  addReimbursement,
  createTemplate,
  deleteReimbursement,
  deleteTemplate,
  getReimbursement,
  getReimbursements,
  getSettings,
  getTemplate,
  getTemplates,
  updateReimbursement,
  updateSettings,
  updateTemplate,
} from './store.js';
import {
  buildExportPreview,
  buildReimbursementDisplayName,
  createWorkFolder,
  deleteFileFromReimbursement,
  exportReimbursement,
  getDisplayFolderPath,
  getReimbursementFilePath,
  openFolder,
  resolveUploadOriginalName,
  saveFileToReimbursement,
} from './files.js';
import { extractInvoiceAmount } from './invoiceExtract.js';
import { extractReceiptInfoFromReceipt } from './receiptExtract.js';
import type { FileCategory, FileSubType, Reimbursement, ReimbursementStatus } from './types.js';
import { REIMBURSEMENT_STATUSES, TIER1_CITIES } from './types.js';

const upload = multer({ storage: multer.memoryStorage() });
export const router = Router();

function paramId(params: Record<string, string | string[] | undefined>): string {
  const id = params.id;
  if (!id) return '';
  return Array.isArray(id) ? id[0] : id;
}

router.get('/settings', async (_req, res) => {
  const settings = await getSettings();
  res.json(settings);
});

router.put('/settings', async (req, res) => {
  const settings = await updateSettings(req.body);
  res.json(settings);
});

router.get('/templates', async (_req, res) => {
  const templates = await getTemplates();
  res.json(templates);
});

router.get('/templates/:id', async (req, res) => {
  const template = await getTemplate(paramId(req.params));
  if (!template) return res.status(404).json({ error: '模板不存在' });
  res.json(template);
});

router.post('/templates', async (req, res) => {
  const body = req.body;
  if (body.accommodation) {
    body.accommodation.tier1Cities = TIER1_CITIES;
  }
  const template = await createTemplate(body);
  res.status(201).json(template);
});

router.put('/templates/:id', async (req, res) => {
  const body = req.body;
  if (body.accommodation) {
    body.accommodation.tier1Cities = TIER1_CITIES;
  }
  const template = await updateTemplate(paramId(req.params), body);
  if (!template) return res.status(404).json({ error: '模板不存在' });
  res.json(template);
});

router.delete('/templates/:id', async (req, res) => {
  const ok = await deleteTemplate(paramId(req.params));
  if (!ok) return res.status(404).json({ error: '模板不存在' });
  res.status(204).send();
});

router.get('/reimbursements', async (_req, res) => {
  const list = await getReimbursements();
  res.json(list);
});

router.get('/reimbursements/:id', async (req, res) => {
  const item = await getReimbursement(paramId(req.params));
  if (!item) return res.status(404).json({ error: '报销记录不存在' });
  res.json(item);
});

function parseReimbursementStatus(value: unknown): ReimbursementStatus {
  if (typeof value === 'string' && REIMBURSEMENT_STATUSES.includes(value as ReimbursementStatus)) {
    return value as ReimbursementStatus;
  }
  return 'pending';
}

router.post('/reimbursements', async (req, res) => {
  const { purpose, locations, startDate, endDate, templateId, baseDirectory, status } = req.body as {
    purpose: string;
    locations: string[];
    startDate: string;
    endDate: string;
    templateId: string;
    baseDirectory?: string;
    status?: ReimbursementStatus;
  };

  if (!purpose?.trim()) {
    return res.status(400).json({ error: '请填写事由' });
  }
  if (!Array.isArray(locations) || locations.length === 0) {
    return res.status(400).json({ error: '请至少添加一个地点' });
  }
  if (!startDate || !endDate) {
    return res.status(400).json({ error: '请填写出差时间' });
  }
  if (startDate > endDate) {
    return res.status(400).json({ error: '结束日期不能早于开始日期' });
  }

  const template = await getTemplate(templateId);
  if (!template) {
    return res.status(400).json({ error: '模板不存在' });
  }

  const trimmedPurpose = purpose.trim();
  const trimmedLocations = locations.map((l) => l.trim()).filter(Boolean);
  if (trimmedLocations.length === 0) {
    return res.status(400).json({ error: '请至少添加一个地点' });
  }

  const settings = await getSettings();
  const dir = baseDirectory || settings.baseDirectory;
  const id = crypto.randomUUID();
  const folderPath = await createWorkFolder(dir, id);

  const reimbursement: Reimbursement = {
    id,
    name: buildReimbursementDisplayName(trimmedLocations, trimmedPurpose, startDate, endDate),
    type: 'business_trip',
    templateId,
    folderPath,
    purpose: trimmedPurpose,
    locations: trimmedLocations,
    startDate,
    endDate,
    status: parseReimbursementStatus(status),
    createdAt: new Date().toISOString(),
    files: [],
  };

  const created = await addReimbursement(reimbursement);
  res.status(201).json(created);
});

router.delete('/reimbursements/:id', async (req, res) => {
  const ok = await deleteReimbursement(paramId(req.params));
  if (!ok) return res.status(404).json({ error: '报销记录不存在' });
  res.status(204).send();
});

router.put('/reimbursements/:id', async (req, res) => {
  const id = paramId(req.params);
  const existing = await getReimbursement(id);
  if (!existing) {
    return res.status(404).json({ error: '报销记录不存在' });
  }

  const { purpose, locations, startDate, endDate, templateId, status } = req.body as {
    purpose: string;
    locations: string[];
    startDate: string;
    endDate: string;
    templateId: string;
    status?: ReimbursementStatus;
  };

  if (!purpose?.trim()) {
    return res.status(400).json({ error: '请填写事由' });
  }
  if (!Array.isArray(locations) || locations.length === 0) {
    return res.status(400).json({ error: '请至少添加一个地点' });
  }
  if (!startDate || !endDate) {
    return res.status(400).json({ error: '请填写出差时间' });
  }
  if (startDate > endDate) {
    return res.status(400).json({ error: '结束日期不能早于开始日期' });
  }

  const template = await getTemplate(templateId);
  if (!template) {
    return res.status(400).json({ error: '模板不存在' });
  }

  const trimmedPurpose = purpose.trim();
  const trimmedLocations = locations.map((l) => l.trim()).filter(Boolean);
  if (trimmedLocations.length === 0) {
    return res.status(400).json({ error: '请至少添加一个地点' });
  }

  const updated: Reimbursement = {
    ...existing,
    name: buildReimbursementDisplayName(trimmedLocations, trimmedPurpose, startDate, endDate),
    templateId,
    purpose: trimmedPurpose,
    locations: trimmedLocations,
    startDate,
    endDate,
    status: parseReimbursementStatus(status ?? existing.status),
  };

  const result = await updateReimbursement(updated);
  res.json(result);
});

router.post(
  '/reimbursements/:id/files',
  upload.single('file'),
  async (req, res) => {
    const reimbursement = await getReimbursement(paramId(req.params));
    if (!reimbursement) {
      return res.status(404).json({ error: '报销记录不存在' });
    }

    if (!req.file) {
      return res.status(400).json({ error: '未收到文件' });
    }

    const category = req.body.category as FileCategory;
    const subType = req.body.subType as FileSubType;

    const validCategories: FileCategory[] = [
      'transport_rail',
      'transport_taxi',
      'accommodation',
      'dining',
    ];
    const validSubTypes: FileSubType[] = ['invoice', 'itinerary', 'receipt'];

    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: '无效的文件分类' });
    }
    if (!validSubTypes.includes(subType)) {
      return res.status(400).json({ error: '无效的文件类型' });
    }

    const originalName = resolveUploadOriginalName(
      req.file.originalname,
      req.body.originalFilename
    );

    let invoiceExtract: { amount: number | null; note?: string } | undefined;
    if (subType === 'invoice') {
      invoiceExtract = await extractInvoiceAmount(
        req.file.buffer,
        originalName,
        category
      );
    }

    let receiptExtract: { checkInDate: string | null; amount: number | null } | undefined;
    if (category === 'accommodation' && subType === 'receipt') {
      const info = await extractReceiptInfoFromReceipt(req.file.buffer, originalName);
      receiptExtract = { checkInDate: info.checkInDate, amount: info.amount };
    }

    const saveOptions =
      invoiceExtract !== undefined || receiptExtract !== undefined
        ? {
          ...(invoiceExtract !== undefined
            ? {
              extractedAmount: invoiceExtract.amount,
              amountExtractNote: invoiceExtract.note,
            }
            : {}),
          ...(receiptExtract !== undefined
            ? {
              extractedCheckInDate: receiptExtract.checkInDate,
              ...(receiptExtract.amount != null
                ? { extractedAmount: receiptExtract.amount }
                : {}),
            }
            : {}),
        }
        : undefined;

    const fileRecord = await saveFileToReimbursement(
      reimbursement,
      category,
      subType,
      originalName,
      req.file.buffer,
      saveOptions
    );

    reimbursement.files.push(fileRecord);
    await updateReimbursement(reimbursement);

    res.status(201).json(fileRecord);
  }
);

router.get('/reimbursements/:id/files/:fileId', async (req, res) => {
  const reimbursement = await getReimbursement(paramId(req.params));
  if (!reimbursement) {
    return res.status(404).json({ error: '报销记录不存在' });
  }

  const fileId = paramId({ id: req.params.fileId });
  const file = reimbursement.files.find((f) => f.id === fileId);
  if (!file) {
    return res.status(404).json({ error: '文件不存在' });
  }

  try {
    const fullPath = getReimbursementFilePath(reimbursement, file);
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.originalName)}`);
    res.sendFile(fullPath, (err) => {
      if (err && !res.headersSent) {
        res.status(404).json({ error: '文件不存在' });
      }
    });
  } catch {
    res.status(400).json({ error: '无效的文件路径' });
  }
});

router.delete('/reimbursements/:id/files/:fileId', async (req, res) => {
  const reimbursement = await getReimbursement(paramId(req.params));
  if (!reimbursement) {
    return res.status(404).json({ error: '报销记录不存在' });
  }

  const fileId = paramId({ id: req.params.fileId });
  const index = reimbursement.files.findIndex((f) => f.id === fileId);
  if (index === -1) {
    return res.status(404).json({ error: '文件不存在' });
  }

  try {
    await deleteFileFromReimbursement(reimbursement, fileId);
    reimbursement.files.splice(index, 1);
    await updateReimbursement(reimbursement);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: '删除文件失败', detail: String(err) });
  }
});

router.get('/reimbursements/:id/export/preview', async (req, res) => {
  const reimbursement = await getReimbursement(paramId(req.params));
  if (!reimbursement) {
    return res.status(404).json({ error: '报销记录不存在' });
  }

  try {
    const preview = await buildExportPreview(reimbursement);
    res.json(preview);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : '无法生成导出预览' });
  }
});

router.post('/reimbursements/:id/export', async (req, res) => {
  const reimbursement = await getReimbursement(paramId(req.params));
  if (!reimbursement) {
    return res.status(404).json({ error: '报销记录不存在' });
  }

  const settings = await getSettings();
  try {
    const exported = await exportReimbursement(reimbursement, settings.baseDirectory);
    await updateReimbursement(exported);
    res.json(exported);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : '导出失败' });
  }
});

router.post('/reimbursements/:id/open-folder', async (req, res) => {
  const reimbursement = await getReimbursement(paramId(req.params));
  if (!reimbursement) {
    return res.status(404).json({ error: '报销记录不存在' });
  }
  try {
    await openFolder(getDisplayFolderPath(reimbursement));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: '无法打开文件夹', detail: String(err) });
  }
});
