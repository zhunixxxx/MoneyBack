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

export interface AppSettings {
  baseDirectory: string;
}

export interface AppData {
  settings: AppSettings;
  templates: ReimbursementTemplate[];
  reimbursements: Reimbursement[];
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

export function createDefaultTemplate(): Omit<ReimbursementTemplate, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name: '默认出差模板',
    accommodation: {
      tier1Cities: TIER1_CITIES,
      tier1Rate: 400,
      defaultRate: 300,
    },
    dining: {
      breakfast: { amount: 20, beforeHour: 9 },
      lunch: { amount: 50 },
      dinner: { amount: 50, afterHour: 18 },
    },
  };
}
