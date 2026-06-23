import type {
  AppSettings,
  DiningInvoice,
  DiningInvoiceMatchResult,
  DiningSuggestAmount,
  ExportPreview,
  FileCategory,
  FileSubType,
  Reimbursement,
  ReimbursementFile,
  ReimbursementStatus,
  ReimbursementTemplate,
} from './types';

const BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || '请求失败');
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  getSettings: () => request<AppSettings>('/settings'),
  updateSettings: (settings: Partial<AppSettings>) =>
    request<AppSettings>('/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    }),

  getTemplates: () => request<ReimbursementTemplate[]>('/templates'),
  getTemplate: (id: string) => request<ReimbursementTemplate>(`/templates/${id}`),
  createTemplate: (data: Omit<ReimbursementTemplate, 'id' | 'createdAt' | 'updatedAt'>) =>
    request<ReimbursementTemplate>('/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  updateTemplate: (
    id: string,
    data: Partial<Omit<ReimbursementTemplate, 'id' | 'createdAt' | 'updatedAt'>>
  ) =>
    request<ReimbursementTemplate>(`/templates/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  deleteTemplate: (id: string) =>
    request<void>(`/templates/${id}`, { method: 'DELETE' }),

  getReimbursements: () => request<Reimbursement[]>('/reimbursements'),
  getReimbursement: (id: string) => request<Reimbursement>(`/reimbursements/${id}`),
  createReimbursement: (data: {
    purpose: string;
    locations: string[];
    startDate: string;
    endDate: string;
    templateId: string;
    baseDirectory?: string;
    status?: ReimbursementStatus;
  }) =>
    request<Reimbursement>('/reimbursements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  deleteReimbursement: (id: string) =>
    request<void>(`/reimbursements/${id}`, { method: 'DELETE' }),
  updateReimbursement: (
    id: string,
    data: {
      purpose: string;
      locations: string[];
      startDate: string;
      endDate: string;
      templateId: string;
      status?: ReimbursementStatus;
    }
  ) =>
    request<Reimbursement>(`/reimbursements/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  uploadFile: (
    id: string,
    file: File,
    category: FileCategory,
    subType: FileSubType
  ): Promise<ReimbursementFile> => {
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('originalFilename', file.name);
    form.append('category', category);
    form.append('subType', subType);
    return request<ReimbursementFile>(`/reimbursements/${id}/files`, {
      method: 'POST',
      body: form,
    });
  },
  deleteFile: (reimbursementId: string, fileId: string) =>
    request<void>(`/reimbursements/${reimbursementId}/files/${fileId}`, {
      method: 'DELETE',
    }),
  getFileViewUrl: (reimbursementId: string, fileId: string) =>
    `/api/reimbursements/${reimbursementId}/files/${fileId}`,
  openFolder: (id: string) =>
    request<{ ok: boolean }>(`/reimbursements/${id}/open-folder`, { method: 'POST' }),
  exportReimbursement: (id: string) =>
    request<Reimbursement>(`/reimbursements/${id}/export`, { method: 'POST' }),
  getExportPreview: (id: string) =>
    request<ExportPreview>(`/reimbursements/${id}/export/preview`),

  getDiningInvoices: (status?: 'available' | 'used') => {
    const query = status ? `?status=${status}` : '';
    return request<DiningInvoice[]>(`/dining-invoices${query}`);
  },
  uploadDiningInvoice: (file: File): Promise<DiningInvoice> => {
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('originalFilename', file.name);
    return request<DiningInvoice>('/dining-invoices', {
      method: 'POST',
      body: form,
    });
  },
  updateDiningInvoice: (
    id: string,
    data: {
      invoiceDate?: string | null;
      extractedAmount?: number | null;
      status?: 'available' | 'used';
    }
  ) =>
    request<DiningInvoice>(`/dining-invoices/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  deleteDiningInvoice: (id: string) =>
    request<void>(`/dining-invoices/${id}`, { method: 'DELETE' }),
  getDiningInvoiceViewUrl: (id: string) => `/api/dining-invoices/${id}/file`,
  openDiningInvoiceFolder: () =>
    request<{ ok: boolean }>('/dining-invoices/open-folder', { method: 'POST' }),
  matchDiningInvoices: (reimbursementId: string, targetAmount: number) =>
    request<DiningInvoiceMatchResult>(`/reimbursements/${reimbursementId}/dining-invoices/match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetAmount }),
    }),
  suggestDiningAmount: (reimbursementId: string) =>
    request<DiningSuggestAmount>(`/reimbursements/${reimbursementId}/dining-invoices/suggest-amount`),
  attachDiningInvoices: (reimbursementId: string, invoiceIds: string[]) =>
    request<{ files: ReimbursementFile[]; reimbursement: Reimbursement }>(
      `/reimbursements/${reimbursementId}/dining-invoices/attach`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceIds }),
      }
    ),
};
