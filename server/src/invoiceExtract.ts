import zlib from 'zlib';
import { extractTextFromImage, isImageExtension } from './imageOcr.js';

export interface InvoiceAmountResult {
  amount: number | null;
  invoiceDate?: string | null;
  note?: string;
  dateNote?: string;
}

export type InvoiceExtractCategory =
  | 'transport_rail'
  | 'transport_taxi'
  | 'accommodation'
  | 'dining';

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/,/g, '').trim();
  const value = parseFloat(cleaned);
  if (Number.isNaN(value) || value <= 0 || value > 1_000_000) return null;
  return Math.round(value * 100) / 100;
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').replace(/[（]/g, '(').replace(/[）]/g, ')');
}

function normalizeInvoiceDate(raw: string): string | null {
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const cn = raw.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日?$/);
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

  const compact = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) {
    return `${compact[1]}-${compact[2]}-${compact[3]}`;
  }

  return null;
}

function isPlausibleInvoiceDate(date: string): boolean {
  const [y, m, d] = date.split('-').map(Number);
  if (y < 2010 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const parsed = new Date(`${date}T00:00:00`);
  return (
    parsed.getFullYear() === y &&
    parsed.getMonth() + 1 === m &&
    parsed.getDate() === d
  );
}

const INVOICE_DATE_PATTERNS: RegExp[] = [
  /开\s*票\s*日\s*期\s*[：:]\s*(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日?/,
  /开\s*票\s*日\s*期\s*[：:]\s*(\d{4})-(\d{2})-(\d{2})/,
  /开\s*票\s*日\s*期\s*[：:]\s*(\d{4})\/(\d{1,2})\/(\d{1,2})/,
  /开\s*票\s*日\s*期\s*[：:]\s*(\d{4})(\d{2})(\d{2})/,
  /发票日期\s*[：:]\s*(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日?/,
  /发票日期\s*[：:]\s*(\d{4})-(\d{2})-(\d{2})/,
];

function parseDateMatch(match: RegExpMatchArray): string | null {
  if (match.length === 2) {
    return normalizeInvoiceDate(match[1]);
  }
  if (match.length >= 4) {
    const month = match[2].padStart(2, '0');
    const day = match[3].padStart(2, '0');
    return normalizeInvoiceDate(`${match[1]}-${month}-${day}`);
  }
  return null;
}

export function extractInvoiceDateFromText(text: string): Pick<InvoiceAmountResult, 'invoiceDate' | 'dateNote'> {
  const normalized = normalizeText(text);

  for (const pattern of INVOICE_DATE_PATTERNS) {
    const match = normalized.match(pattern);
    if (match) {
      const invoiceDate = parseDateMatch(match);
      if (invoiceDate && isPlausibleInvoiceDate(invoiceDate)) {
        return { invoiceDate };
      }
    }
  }

  return { invoiceDate: null, dateNote: '未能从发票中识别开票日期' };
}

function yyMmDdToIso(yymmdd: string): string | null {
  if (!/^\d{6}$/.test(yymmdd)) return null;
  const year = 2000 + parseInt(yymmdd.slice(0, 2), 10);
  const month = yymmdd.slice(2, 4);
  const day = yymmdd.slice(4, 6);
  const date = normalizeInvoiceDate(`${year}-${month}-${day}`);
  return date && isPlausibleInvoiceDate(date) ? date : null;
}

export function extractInvoiceDateFromFilename(filename: string): Pick<InvoiceAmountResult, 'invoiceDate' | 'dateNote'> {
  const base = stripExtension(filename.split(/[/\\]/).pop() ?? filename);

  const dateAmountMatch = base.match(/^(\d{6})_\d+(?:\.\d{1,2})?_/);
  if (dateAmountMatch) {
    const invoiceDate = yyMmDdToIso(dateAmountMatch[1]);
    if (invoiceDate) return { invoiceDate, dateNote: '根据文件名识别开票日期' };
  }

  const leadingDate = base.match(/^(\d{8})[_-]/);
  if (leadingDate) {
    const invoiceDate = normalizeInvoiceDate(leadingDate[1]);
    if (invoiceDate && isPlausibleInvoiceDate(invoiceDate)) {
      return { invoiceDate, dateNote: '根据文件名识别开票日期' };
    }
  }

  const embeddedDate = base.match(/(?:^|[-_])(\d{8})(?:\d{6})?(?:\.|$|[-_])/);
  if (embeddedDate) {
    const invoiceDate = normalizeInvoiceDate(embeddedDate[1]);
    if (invoiceDate && isPlausibleInvoiceDate(invoiceDate)) {
      return { invoiceDate, dateNote: '根据文件名识别开票日期' };
    }
  }

  return { invoiceDate: null, dateNote: '未能从文件名识别开票日期' };
}

function mergeDateResult(
  result: InvoiceAmountResult,
  filename: string
): InvoiceAmountResult {
  if (result.invoiceDate) return result;

  const fromFilename = extractInvoiceDateFromFilename(filename);
  if (fromFilename.invoiceDate) {
    return { ...result, invoiceDate: fromFilename.invoiceDate, dateNote: fromFilename.dateNote };
  }

  return { ...result, invoiceDate: result.invoiceDate ?? null, dateNote: fromFilename.dateNote };
}

function withExtractedDate(text: string, result: InvoiceAmountResult): InvoiceAmountResult {
  const fromText = extractInvoiceDateFromText(text);
  if (fromText.invoiceDate) {
    return { ...result, invoiceDate: fromText.invoiceDate };
  }
  return { ...result, invoiceDate: null, dateNote: fromText.dateNote };
}

const RAIL_AMOUNT_PATTERNS: RegExp[] = [
  /票价\s*[：:]?\s*[¥￥]?\s*([\d,]+(?:\.\d{1,2})?)/,
  /[¥￥]\s*([\d,]+(?:\.\d{1,2})?)\s*(?:元)?\s*票价/,
];

function matchPatterns(normalized: string, patterns: RegExp[]): number | null {
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) {
      const amount = parseAmount(match[1]);
      if (amount !== null) return amount;
    }
  }
  return null;
}

/** 查找「（小写）」后的阿拉伯数字金额 */
function extractLowercaseLabelAmount(normalized: string): number | null {
  const patterns: RegExp[] = [
    /[(（]\s*小\s*写\s*[)）]\s*[：:]?\s*[¥￥]?\s*([\d,]+(?:\.\d{1,2})?)/g,
    /(?<![价税合])小\s*写\s*[：:]\s*[¥￥]?\s*([\d,]+(?:\.\d{1,2})?)/g,
  ];

  for (const pattern of patterns) {
    const matches = [...normalized.matchAll(pattern)];
    if (matches.length === 0) continue;

    const amount = parseAmount(matches[matches.length - 1][1]);
    if (amount !== null) return amount;
  }

  return null;
}

/** 部分 PDF 文本顺序错乱：小写金额紧邻大写汉字，如「136.60 ¥ 壹佰叁拾陆圆陆角整」 */
function extractAmountBeforeUppercaseChinese(normalized: string): number | null {
  const pattern =
    /([\d,]+(?:\.\d{1,2})?)\s*[¥￥]?\s*[壹贰叁肆伍陆柒捌玖拾佰仟万亿元角分整]{4,}/g;
  const matches = [...normalized.matchAll(pattern)];
  if (matches.length === 0) return null;

  const amount = parseAmount(matches[matches.length - 1][1]);
  return amount;
}

/** 从合计行的「金额 + 税额 = 价税合计」推断小写金额 */
function inferTotalFromSubtotalAndTax(normalized: string): number | null {
  const idx = normalized.search(/合\s*计|价\s*税\s*合\s*计/);
  if (idx < 0) return null;

  const region = normalized.slice(idx, idx + 500);
  const amounts = [...region.matchAll(/([\d,]+(?:\.\d{1,2})?)/g)]
    .map((m) => parseAmount(m[1]))
    .filter((a): a is number => a !== null);
  const unique = [...new Set(amounts)].sort((a, b) => b - a);

  for (const total of unique) {
    for (let i = 0; i < unique.length; i++) {
      for (let j = i + 1; j < unique.length; j++) {
        const a = unique[i];
        const b = unique[j];
        if (total > a && total > b && Math.abs(a + b - total) < 0.02) {
          return total;
        }
      }
    }
  }

  return null;
}

/** 价税合计行中「（小写）」后的阿拉伯数字金额 */
function extractTotalTaxLowercaseAmount(normalized: string): number | null {
  const fromLabel = extractLowercaseLabelAmount(normalized);
  if (fromLabel !== null) return fromLabel;

  const hasTaxTotalContext = /价\s*税\s*合\s*计|[(（]\s*小\s*写\s*[)）]/.test(normalized);

  if (hasTaxTotalContext) {
    const fromUppercasePair = extractAmountBeforeUppercaseChinese(normalized);
    if (fromUppercasePair !== null) return fromUppercasePair;

    const inferred = inferTotalFromSubtotalAndTax(normalized);
    if (inferred !== null) return inferred;
  }

  const taxTotalIdx = normalized.search(/价\s*税\s*合\s*计/);
  if (taxTotalIdx < 0) return null;

  const aroundTaxTotal = normalized.slice(Math.max(0, taxTotalIdx - 300), taxTotalIdx + 500);

  const lowerInContext = extractLowercaseLabelAmount(aroundTaxTotal);
  if (lowerInContext !== null) return lowerInContext;

  // 「（小写）」与金额分行时，大写汉字金额后通常紧跟 ¥ 小写金额
  const upperThenAmount = aroundTaxTotal.match(
    /[壹贰叁肆伍陆柒捌玖拾佰仟万亿元角分整]+\s*[¥￥]\s*([\d,]+(?:\.\d{1,2})?)/
  );
  if (upperThenAmount) {
    const amount = parseAmount(upperThenAmount[1]);
    if (amount !== null) return amount;
  }

  // 紧凑排版：价税合计（小写）¥123.45
  const inlinePatterns: RegExp[] = [
    /价\s*税\s*合\s*计[^0-9]{0,120}[(（]?\s*小\s*写\s*[)）]?\s*[：:]?\s*[¥￥]?\s*([\d,]+(?:\.\d{1,2})?)/,
    /[(（]\s*小\s*写\s*[)）]\s*[：:]?\s*[¥￥]?\s*([\d,]+(?:\.\d{1,2})?)/,
  ];
  const inline = matchPatterns(aroundTaxTotal, inlinePatterns);
  if (inline !== null) return inline;

  return null;
}

function extractRailAmountFromText(text: string): InvoiceAmountResult {
  const normalized = normalizeText(text);
  const amount = matchPatterns(normalized, RAIL_AMOUNT_PATTERNS);
  if (amount !== null) {
    return { amount };
  }
  return { amount: null, note: '未能从高铁发票中识别票价' };
}

export function extractAmountFromText(
  text: string,
  category?: InvoiceExtractCategory
): InvoiceAmountResult {
  if (category === 'transport_rail') {
    return extractRailAmountFromText(text);
  }

  const normalized = normalizeText(text);
  const amount = extractTotalTaxLowercaseAmount(normalized);
  if (amount !== null) {
    return { amount };
  }

  return { amount: null, note: '未能从发票中识别价税合计（小写）金额' };
}

function stripNullBytes(value: string): string {
  return value.replace(/\0/g, '');
}

function extractTjStringsFromPdfBuffer(buffer: Buffer): string[] {
  const results: string[] = [];
  const content = buffer.toString('latin1');
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;

  for (const match of content.matchAll(streamRegex)) {
    try {
      const decoded = zlib.inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1');
      for (const tj of decoded.matchAll(/\(([^)]*)\)Tj/g)) {
        results.push(stripNullBytes(tj[1]));
      }
    } catch {
      // 跳过非 zlib 流
    }
  }

  return results;
}

function parseCurrencyAmountsFromTjStrings(strings: string[]): number[] {
  const amounts: number[] = [];
  const currencyPattern = /[¥￥\u00a5]\s*([\d,]+\.\d{2})\b/g;

  for (const s of strings) {
    for (const m of s.matchAll(currencyPattern)) {
      const amount = parseAmount(m[1]);
      if (amount !== null) amounts.push(amount);
    }
  }

  return amounts;
}

/** 从价税合计 = 金额 + 税额的关系推断合计；否则取最大 ¥ 金额 */
function pickInvoiceTotalFromCurrencyAmounts(amounts: number[]): number | null {
  if (amounts.length === 0) return null;

  const unique = [...new Set(amounts)].sort((a, b) => b - a);

  for (const total of unique) {
    for (let i = 0; i < unique.length; i++) {
      for (let j = i + 1; j < unique.length; j++) {
        if (Math.abs(unique[i] + unique[j] - total) < 0.02) {
          return total;
        }
      }
    }
  }

  return unique[0] ?? null;
}

/** 部分电子发票用自定义字体编码，文本层读不到金额，需解析 PDF 内容流 */
export function extractAmountFromPdfStreams(buffer: Buffer): InvoiceAmountResult {
  const tjStrings = extractTjStringsFromPdfBuffer(buffer);
  const joined = tjStrings.join(' ');
  const normalized = normalizeText(joined);

  const fromLowercase = extractLowercaseLabelAmount(normalized);
  if (fromLowercase !== null) {
    return { amount: fromLowercase, note: '从 PDF 内容流识别价税合计（小写）' };
  }

  const fromUppercasePair = extractAmountBeforeUppercaseChinese(normalized);
  if (fromUppercasePair !== null) {
    return { amount: fromUppercasePair, note: '从 PDF 内容流识别价税合计（小写）' };
  }

  const inferred = inferTotalFromSubtotalAndTax(normalized);
  if (inferred !== null) {
    return { amount: inferred, note: '从 PDF 内容流推断价税合计' };
  }

  const currencyAmounts = parseCurrencyAmountsFromTjStrings(tjStrings);
  const total = pickInvoiceTotalFromCurrencyAmounts(currencyAmounts);

  if (total !== null) {
    return { amount: total, note: '从 PDF 内容流识别价税合计' };
  }

  return { amount: null, note: '未能从 PDF 内容流识别金额' };
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

function stripExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.slice(0, dot) : filename;
}

export function extractAmountFromFilename(filename: string): InvoiceAmountResult {
  const base = stripExtension(filename.split(/[/\\]/).pop() ?? filename);

  const dateAmountMatch = base.match(/^\d{6}_(\d+(?:\.\d{1,2})?)_/);
  if (dateAmountMatch) {
    const amount = parseAmount(dateAmountMatch[1]);
    if (amount !== null) {
      return { amount, note: '根据文件名识别' };
    }
  }

  const segmentMatch = base.match(/_(\d+\.\d{1,2})_/);
  if (segmentMatch) {
    const amount = parseAmount(segmentMatch[1]);
    if (amount !== null) {
      return { amount, note: '根据文件名识别' };
    }
  }

  const diningMatch = base.match(/餐饮-(\d+(?:\.\d{1,2})?)元/);
  if (diningMatch) {
    const amount = parseAmount(diningMatch[1]);
    if (amount !== null) {
      return { amount, note: '根据文件名识别' };
    }
  }

  const labeledAmountMatch = base.match(/发票金额(\d+(?:\.\d{1,2})?)元/);
  if (labeledAmountMatch) {
    const amount = parseAmount(labeledAmountMatch[1]);
    if (amount !== null) {
      return { amount, note: '根据文件名识别' };
    }
  }

  return { amount: null, note: '未能从文件名识别金额' };
}

/** 邮箱导出的 YYMMDD_金额_ 文件名，金额比 PDF 内容易误识别的税额更可靠 */
export function hasTrustedFilenameAmount(filename: string): boolean {
  const base = stripExtension(filename.split(/[/\\]/).pop() ?? filename);
  return /^\d{6}_(\d+(?:\.\d{1,2})?)_/.test(base);
}

function withFilenameFallback(
  result: InvoiceAmountResult,
  filename: string
): InvoiceAmountResult {
  const fromFilename = extractAmountFromFilename(filename);

  if (hasTrustedFilenameAmount(filename) && fromFilename.amount !== null) {
    return mergeDateResult(
      { ...result, amount: fromFilename.amount, note: fromFilename.note },
      filename
    );
  }

  let merged = result;
  if (merged.amount === null && fromFilename.amount !== null) {
    merged = { ...merged, ...fromFilename };
  }
  return mergeDateResult(merged, filename);
}

export async function extractInvoiceAmount(
  buffer: Buffer,
  filename: string,
  category?: InvoiceExtractCategory
): Promise<InvoiceAmountResult> {
  const ext = getExtension(filename);

  try {
    if (ext === 'pdf') {
      const text = await extractTextFromPdf(buffer);
      let result: InvoiceAmountResult = text.trim()
        ? extractAmountFromText(text, category)
        : { amount: null, note: 'PDF 中未找到可识别文本' };

      if (text.trim()) {
        result = withExtractedDate(text, result);
      }

      if (result.amount === null) {
        const fromStreams = extractAmountFromPdfStreams(buffer);
        if (fromStreams.amount !== null) {
          result = { ...result, ...fromStreams };
        }
      }

      if (!result.invoiceDate) {
        const tjStrings = extractTjStringsFromPdfBuffer(buffer);
        if (tjStrings.length > 0) {
          result = withExtractedDate(tjStrings.join(' '), result);
        }
      }

      return withFilenameFallback(result, filename);
    }

    if (isImageExtension(ext)) {
      const text = await extractTextFromImage(buffer);
      if (text.trim()) {
        const result = withExtractedDate(
          text,
          extractAmountFromText(text, category)
        );
        return withFilenameFallback(
          { ...result, note: result.note ?? '图片 OCR 识别' },
          filename
        );
      }
      return withFilenameFallback(
        { amount: null, note: '图片 OCR 未识别到文字' },
        filename
      );
    }

    return withFilenameFallback(
      { amount: null, note: '暂不支持该文件格式，请上传 PDF 或图片' },
      filename
    );
  } catch {
    return withFilenameFallback({ amount: null, note: '识别过程出错' }, filename);
  }
}
