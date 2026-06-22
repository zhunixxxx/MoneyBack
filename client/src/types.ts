export interface DiningRule {
  breakfast: { amount: number; beforeHour: number };
  lunch: { amount: number };
  dinner: { amount: number; afterHour: number };
}

export interface AccommodationRule {
  tier1Cities: string[];
  tier1Rate: number;
  defaultRate: number;
}

export const TIER1_CITIES = ['北京', '上海', '广州', '深圳'];

export interface ReimbursementTemplate {
  id: string;
  name: string;
  accommodation: AccommodationRule;
  dining: DiningRule;
  createdAt: string;
  updatedAt: string;
}

export type ReimbursementType = 'business_trip';

export type ReimbursementStatus = 'pending' | 'reimbursed' | 'paid';

export const REIMBURSEMENT_STATUS_LABELS: Record<ReimbursementStatus, string> = {
  pending: '未报销',
  reimbursed: '已报销',
  paid: '已放款',
};

export const REIMBURSEMENT_STATUSES: ReimbursementStatus[] = ['pending', 'reimbursed', 'paid'];

export type FileCategory =
  | 'transport_rail'
  | 'transport_taxi'
  | 'accommodation'
  | 'dining';

export type FileSubType = 'invoice' | 'itinerary' | 'receipt';

export interface ReimbursementFile {
  id: string;
  category: FileCategory;
  subType: FileSubType;
  originalName: string;
  savedName: string;
  relativePath: string;
  uploadedAt: string;
  extractedAmount?: number | null;
  amountExtractNote?: string;
  extractedCheckInDate?: string | null;
  exportedName?: string;
}

export interface Reimbursement {
  id: string;
  name: string;
  type: ReimbursementType;
  templateId: string;
  folderPath: string;
  exportFolderPath?: string;
  exportedAt?: string;
  purpose?: string;
  locations?: string[];
  startDate?: string;
  endDate?: string;
  status?: ReimbursementStatus;
  createdAt: string;
  files: ReimbursementFile[];
}

export function getReimbursementStatus(r: Reimbursement): ReimbursementStatus {
  return r.status ?? 'pending';
}

export const REIMBURSEMENT_STATUS_STYLES: Record<ReimbursementStatus, string> = {
  pending: 'bg-stone-100 text-stone-600',
  reimbursed: 'bg-emerald-50 text-emerald-700',
  paid: 'bg-blue-50 text-blue-700',
};

export function getDisplayFolderPath(r: Reimbursement): string {
  return r.exportFolderPath ?? r.folderPath;
}

export function formatReimbursementFolderPreview(
  startDate: string,
  locations: string[],
  purpose: string
): string {
  if (!startDate || locations.length === 0 || !purpose.trim()) return '';
  const datePart = startDate.replace(/-/g, '');
  const locationPart = locations.join('+');
  return `${datePart}-${locationPart}-${purpose.trim()}`;
}

export function formatReimbursementDateRange(r: Reimbursement): string {
  if (r.startDate && r.endDate) {
    return r.startDate === r.endDate ? r.startDate : `${r.startDate} ~ ${r.endDate}`;
  }
  return new Date(r.createdAt).toLocaleDateString('zh-CN');
}

export interface AppSettings {
  baseDirectory: string;
}

export const CATEGORY_LABELS: Record<FileCategory, string> = {
  transport_rail: '高铁',
  transport_taxi: '打车',
  accommodation: '住宿',
  dining: '餐饮',
};

export const SUBTYPE_LABELS: Record<FileSubType, string> = {
  invoice: '发票',
  itinerary: '行程单',
  receipt: '水单',
};

export function getDailyDiningTotal(dining: DiningRule): number {
  return dining.breakfast.amount + dining.lunch.amount + dining.dinner.amount;
}

export function formatAccommodationPreview(acc: AccommodationRule): string {
  return `住宿：${acc.tier1Rate}元/夜间（一线城市），${acc.defaultRate}元/夜间（其他城市）`;
}

export function formatDiningPreview(dining: DiningRule): string {
  const total = getDailyDiningTotal(dining);
  return `餐饮：${total}元/天（早餐${dining.breakfast.amount}元、午餐${dining.lunch.amount}元、晚餐${dining.dinner.amount}元）`;
}

export interface DropZoneConfig {
  category: FileCategory;
  subType: FileSubType;
  label: string;
  hint: string;
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

export const DROP_ZONES: DropZoneConfig[] = [
  {
    category: 'transport_rail',
    subType: 'invoice',
    label: '高铁 · 发票',
    hint: '',
  },
  {
    category: 'transport_taxi',
    subType: 'invoice',
    label: '打车 · 发票',
    hint: '',
  },
  {
    category: 'transport_taxi',
    subType: 'itinerary',
    label: '打车 · 行程单',
    hint: '',
  },
  {
    category: 'accommodation',
    subType: 'invoice',
    label: '住宿 · 发票',
    hint: '',
  },
  {
    category: 'accommodation',
    subType: 'receipt',
    label: '住宿 · 水单',
    hint: '',
  },
  {
    category: 'dining',
    subType: 'invoice',
    label: '餐饮 · 发票',
    hint: '',
  },
];
