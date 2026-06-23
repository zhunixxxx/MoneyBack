import { extractTextFromImage, isImageExtension } from './imageOcr.js';

export interface CheckInDateResult {
  checkInDate: string | null;
  note?: string;
}

export interface ReceiptAmountResult {
  amount: number | null;
  note?: string;
}

export interface ReceiptInfoResult {
  checkInDate: string | null;
  amount: number | null;
  checkInDateNote?: string;
  amountNote?: string;
}

function parseReceiptAmount(raw: string): number | null {
  const cleaned = raw.replace(/,/g, '').trim();
  const value = parseFloat(cleaned);
  if (Number.isNaN(value) || value <= 0 || value > 1_000_000) return null;
  return Math.round(value * 100) / 100;
}

function normalizeCheckInDate(raw: string): string | null {
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const cn = raw.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);
  if (cn) {
    const month = cn[2].padStart(2, '0');
    const day = cn[3].padStart(2, '0');
    return `${cn[1]}-${month}-${day}`;
  }

  const slash = raw.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (slash) {
    const month = slash[2].padStart(2, '0');
    const day = slash[3].padStart(2, '0');
    return `${slash[1]}-${month}-${day}`;
  }

  return null;
}

export function extractCheckInDateFromText(text: string): CheckInDateResult {
  const normalized = text.replace(/\s+/g, ' ');

  const patterns = [
    /入住日期\s*[：:]\s*(\d{4}-\d{2}-\d{2})/,
    /入住日期\s*[：:]\s*(\d{4}年\d{1,2}月\d{1,2}日)/,
    /入住日期\s*[：:]\s*(\d{4}\/\d{1,2}\/\d{1,2})/,
    /Check[\s-]?in\s*[：:]\s*(\d{4}-\d{2}-\d{2})/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) {
      const checkInDate = normalizeCheckInDate(match[1]);
      if (checkInDate) return { checkInDate };
    }
  }

  return { checkInDate: null, note: '未能从水单中识别入住日期' };
}

export function extractReceiptAmountFromText(text: string): ReceiptAmountResult {
  const normalized = text.replace(/\s+/g, ' ');

  const patterns = [
    /付款合计\s*[：:]?\s*([\d,]+(?:\.\d{1,2})?)/,
    /消费合计\s*[：:]?\s*([\d,]+(?:\.\d{1,2})?)/,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) {
      const amount = parseReceiptAmount(match[1]);
      if (amount !== null) return { amount };
    }
  }

  return { amount: null, note: '未能从水单中识别付款合计金额' };
}

export function extractReceiptInfoFromText(text: string): ReceiptInfoResult {
  const checkIn = extractCheckInDateFromText(text);
  const amount = extractReceiptAmountFromText(text);
  return {
    checkInDate: checkIn.checkInDate,
    amount: amount.amount,
    ...(checkIn.note ? { checkInDateNote: checkIn.note } : {}),
    ...(amount.note ? { amountNote: amount.note } : {}),
  };
}

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text || '';
  } finally {
    await parser.destroy();
  }
}

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.slice(dot + 1).toLowerCase() : '';
}

async function extractReceiptInfoFromBuffer(
  buffer: Buffer,
  filename: string
): Promise<ReceiptInfoResult> {
  const ext = getExtension(filename);

  try {
    if (ext === 'pdf') {
      const text = await extractTextFromPdf(buffer);
      if (text.trim()) {
        return extractReceiptInfoFromText(text);
      }
      return {
        checkInDate: null,
        amount: null,
        checkInDateNote: 'PDF 中未找到可识别文本',
        amountNote: 'PDF 中未找到可识别文本',
      };
    }

    if (isImageExtension(ext)) {
      const text = await extractTextFromImage(buffer);
      if (text.trim()) {
        return extractReceiptInfoFromText(text);
      }
      return {
        checkInDate: null,
        amount: null,
        checkInDateNote: '图片 OCR 未识别到文字',
        amountNote: '图片 OCR 未识别到文字',
      };
    }

    return {
      checkInDate: null,
      amount: null,
      checkInDateNote: '暂不支持该文件格式',
      amountNote: '暂不支持该文件格式',
    };
  } catch {
    return {
      checkInDate: null,
      amount: null,
      checkInDateNote: '识别水单信息出错',
      amountNote: '识别水单信息出错',
    };
  }
}

export async function extractReceiptInfoFromReceipt(
  buffer: Buffer,
  filename: string
): Promise<ReceiptInfoResult> {
  return extractReceiptInfoFromBuffer(buffer, filename);
}

export async function extractCheckInDateFromReceipt(
  buffer: Buffer,
  filename: string
): Promise<CheckInDateResult> {
  const info = await extractReceiptInfoFromReceipt(buffer, filename);
  return {
    checkInDate: info.checkInDate,
    ...(info.checkInDateNote ? { note: info.checkInDateNote } : {}),
  };
}

export async function extractReceiptAmountFromReceipt(
  buffer: Buffer,
  filename: string
): Promise<ReceiptAmountResult> {
  const info = await extractReceiptInfoFromReceipt(buffer, filename);
  return {
    amount: info.amount,
    ...(info.amountNote ? { note: info.amountNote } : {}),
  };
}
