import sharp from 'sharp';
import { createWorker, PSM, type Worker } from 'tesseract.js';

let sharedWorker: Worker | null = null;

async function getWorker(): Promise<Worker> {
  if (!sharedWorker) {
    sharedWorker = await createWorker('chi_sim+eng');
  }
  return sharedWorker;
}

export async function preprocessImageForOcr(buffer: Buffer): Promise<Buffer> {
  try {
    const meta = await sharp(buffer).metadata();
    const width = meta.width ?? 0;

    let pipeline = sharp(buffer).rotate();

    if (width > 0 && width < 1800) {
      pipeline = pipeline.resize({
        width: Math.min(2400, Math.round(width * (1800 / width))),
        withoutEnlargement: false,
      });
    }

    return pipeline.grayscale().normalize().sharpen().png().toBuffer();
  } catch {
    return buffer;
  }
}

function hasInvoiceSignals(text: string): boolean {
  return /价\s*税\s*合\s*计|开\s*票\s*日\s*期|[（(]\s*小\s*写\s*[)）]|[¥￥]\s*\d/.test(text);
}

export async function extractTextFromImage(buffer: Buffer): Promise<string> {
  const preprocessed = await preprocessImageForOcr(buffer);
  const worker = await getWorker();

  const modes = [PSM.AUTO, PSM.SINGLE_BLOCK, PSM.SPARSE_TEXT];
  let bestText = '';

  for (const mode of modes) {
    await worker.setParameters({ tessedit_pageseg_mode: mode });
    const { data } = await worker.recognize(preprocessed);
    const text = data.text?.trim() ?? '';

    if (text.length > bestText.length) {
      bestText = text;
    }
    if (hasInvoiceSignals(text)) {
      return text;
    }
  }

  return bestText;
}

export function isImageExtension(ext: string): boolean {
  return ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'].includes(ext);
}
