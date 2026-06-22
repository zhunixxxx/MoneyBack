import zlib from 'zlib';

export interface InvoiceAmountResult {
  amount: number | null;
  note?: string;
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

/** 价税合计行中「（小写）」后的阿拉伯数字金额 */
function extractTotalTaxLowercaseAmount(normalized: string): number | null {
  const taxTotalIdx = normalized.search(/价\s*税\s*合\s*计/);
  if (taxTotalIdx < 0) return null;

  const afterTaxTotal = normalized.slice(taxTotalIdx);

  const lowerLabelMatch = afterTaxTotal.match(/[(（]\s*小\s*写\s*[)）]|小\s*写/);
  if (lowerLabelMatch && lowerLabelMatch.index !== undefined) {
    const afterLower = afterTaxTotal.slice(lowerLabelMatch.index + lowerLabelMatch[0].length);
    const fromLabel = extractCurrencyAmountAfter(afterLower);
    if (fromLabel !== null) return fromLabel;
  }

  // 「（小写）」与金额分行时，大写汉字金额后通常紧跟 ¥ 小写金额
  const upperThenAmount = afterTaxTotal.match(
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
  const inline = matchPatterns(afterTaxTotal.slice(0, 500), inlinePatterns);
  if (inline !== null) return inline;

  return null;
}

function extractCurrencyAmountAfter(text: string): number | null {
  const withSymbol = text.match(/[¥￥]\s*([\d,]+(?:\.\d{1,2})?)/);
  if (withSymbol) {
    const amount = parseAmount(withSymbol[1]);
    if (amount !== null) return amount;
  }

  const plain = text.match(/^\s*[：:]?\s*([\d,]+(?:\.\d{1,2})?)/);
  if (plain) {
    const amount = parseAmount(plain[1]);
    if (amount !== null) return amount;
  }

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

  const fallback = matchPatterns(normalized, [
    /(?:^|[^税])合\s*计\s*[：:]?\s*[¥￥]?\s*([\d,]+(?:\.\d{1,2})?)/,
  ]);
  if (fallback !== null) {
    return { amount: fallback, note: '未能识别价税合计小写，已使用合计行金额' };
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

let ocrWorker: Awaited<ReturnType<typeof import('tesseract.js').createWorker>> | null = null;

async function createOcrWorker() {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('chi_sim');
  return worker;
}

async function getOcrWorker() {
  if (!ocrWorker) {
    ocrWorker = await createOcrWorker();
  }
  return ocrWorker;
}

async function extractTextFromImage(buffer: Buffer): Promise<string> {
  const worker = await getOcrWorker();
  const { data } = await worker.recognize(buffer);
  return data.text || '';
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

  return { amount: null, note: '未能从文件名识别金额' };
}

function withFilenameFallback(
  result: InvoiceAmountResult,
  filename: string
): InvoiceAmountResult {
  if (result.amount !== null) return result;
  const fromFilename = extractAmountFromFilename(filename);
  if (fromFilename.amount !== null) return fromFilename;
  return result;
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

      if (result.amount === null) {
        const fromStreams = extractAmountFromPdfStreams(buffer);
        if (fromStreams.amount !== null) {
          result = fromStreams;
        }
      }

      return withFilenameFallback(result, filename);
    }

    if (['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'].includes(ext)) {
      const text = await extractTextFromImage(buffer);
      if (text.trim()) {
        return withFilenameFallback(extractAmountFromText(text, category), filename);
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
