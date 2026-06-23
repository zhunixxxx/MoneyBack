import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { EditableField } from '../components/EditableField';
import { FilePreviewModal } from '../components/FilePreviewModal';
import type { DiningInvoice, DiningInvoiceStatus } from '../types';
import { DINING_INVOICE_STATUS_LABELS } from '../types';

function formatAmount(amount: number): string {
  return amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const STATUS_OPTIONS: { value: DiningInvoiceStatus; label: string }[] = [
  { value: 'available', label: DINING_INVOICE_STATUS_LABELS.available },
  { value: 'used', label: DINING_INVOICE_STATUS_LABELS.used },
];

export function DiningInvoicesPage() {
  const [invoices, setInvoices] = useState<DiningInvoice[]>([]);
  const [filter, setFilter] = useState<'all' | 'available' | 'used'>('available');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [previewInvoice, setPreviewInvoice] = useState<DiningInvoice | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.getDiningInvoices();
      setInvoices(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredInvoices =
    filter === 'all' ? invoices : invoices.filter((inv) => inv.status === filter);

  const updateInvoice = async (
    id: string,
    data: {
      invoiceDate?: string | null;
      extractedAmount?: number | null;
      status?: DiningInvoiceStatus;
    }
  ) => {
    const updated = await api.updateDiningInvoice(id, data);
    setInvoices((prev) => prev.map((inv) => (inv.id === id ? updated : inv)));
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(fileList)) {
        await api.uploadDiningInvoice(file);
      }
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除这张发票？')) return;
    setDeletingId(id);
    try {
      await api.deleteDiningInvoice(id);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败');
    } finally {
      setDeletingId(null);
    }
  };

  const handleOpenFolder = async () => {
    try {
      await api.openDiningInvoiceFolder();
    } catch {
      alert('无法打开文件夹');
    }
  };

  const availableCount = invoices.filter((inv) => inv.status === 'available').length;
  const availableTotal = invoices
    .filter((inv) => inv.status === 'available' && inv.extractedAmount != null)
    .reduce((sum, inv) => sum + (inv.extractedAmount ?? 0), 0);

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-stone-900">发票库</h2>
          <p className="mt-1 text-sm text-stone-500">
            收集平时就餐开具的电子发票，报销时按金额自动匹配导入
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenFolder}
          className="rounded-lg border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
        >
          打开发票文件夹
        </button>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-stone-200 bg-white p-5">
          <p className="text-sm text-stone-500">可用发票</p>
          <p className="mt-1 text-2xl font-semibold text-stone-900">{availableCount} 张</p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-5">
          <p className="text-sm text-stone-500">可用金额合计</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-700">
            ¥{formatAmount(availableTotal)}
          </p>
        </div>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`mb-6 flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed bg-white p-6 transition-colors ${
          dragging
            ? 'border-emerald-400 bg-emerald-50'
            : 'border-stone-200 hover:border-stone-300'
        } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
        onClick={() => {
          const input = document.createElement('input');
          input.type = 'file';
          input.multiple = true;
          input.accept = '.pdf,.png,.jpg,.jpeg,.webp';
          input.onchange = () => handleFiles(input.files);
          input.click();
        }}
      >
        <svg className="mb-2 h-8 w-8 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <p className="text-sm text-stone-600">
          {uploading ? '正在上传并 OCR 识别…' : '拖拽餐饮发票到此处，或点击选择文件'}
        </p>
        <p className="mt-1 text-xs text-stone-400">支持 PDF、PNG/JPG 等图片，图片将 OCR 识别开票日期与金额</p>
      </div>

      <div className="mb-4 flex gap-2">
        {(['available', 'used', 'all'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === key
                ? 'bg-stone-900 text-white'
                : 'bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50'
            }`}
          >
            {key === 'available' ? '可用' : key === 'used' ? '已使用' : '全部'}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-stone-500">加载中…</p>
      ) : filteredInvoices.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-200 bg-white py-12 text-center">
          <p className="text-stone-500">暂无发票，上传后会自动识别开票日期和金额并存入仓库</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="w-full min-w-[720px] table-fixed text-sm">
            <colgroup>
              <col className="w-[28%]" />
              <col className="w-[12%]" />
              <col className="w-[12%]" />
              <col className="w-[10%]" />
              <col className="w-[20%]" />
              <col className="w-[8%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
                <th className="px-4 py-3 font-medium">文件名</th>
                <th className="px-4 py-3 font-medium">开票日期</th>
                <th className="px-4 py-3 font-medium">识别金额</th>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium">入库时间</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredInvoices.map((inv) => (
                <tr key={inv.id} className="group hover:bg-stone-50">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setPreviewInvoice(inv)}
                      className="block w-full truncate text-left text-stone-700 hover:text-emerald-700 hover:underline"
                      title={inv.originalName}
                    >
                      {inv.originalName}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <EditableField
                      value={inv.invoiceDate ?? ''}
                      inputType="date"
                      title={inv.dateExtractNote}
                      display={
                        inv.invoiceDate ? (
                          <span className="text-stone-700">{inv.invoiceDate}</span>
                        ) : (
                          <span className="text-stone-400">—</span>
                        )
                      }
                      onSave={async (val) => {
                        await updateInvoice(inv.id, { invoiceDate: val || null });
                      }}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <EditableField
                      value={inv.extractedAmount != null ? String(inv.extractedAmount) : ''}
                      inputType="number"
                      placeholder="输入金额"
                      title={inv.amountExtractNote}
                      display={
                        inv.extractedAmount != null ? (
                          <span className="font-medium text-emerald-700">
                            ¥{formatAmount(inv.extractedAmount)}
                          </span>
                        ) : (
                          <span className="text-stone-400">—</span>
                        )
                      }
                      onSave={async (val) => {
                        const amount = val.trim() ? parseFloat(val) : null;
                        if (amount != null && (Number.isNaN(amount) || amount <= 0)) {
                          throw new Error('请填写有效的金额');
                        }
                        await updateInvoice(inv.id, { extractedAmount: amount });
                      }}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <EditableField
                      value={inv.status}
                      inputType="select"
                      options={STATUS_OPTIONS}
                      display={
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                            inv.status === 'available'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-stone-100 text-stone-500'
                          }`}
                        >
                          {DINING_INVOICE_STATUS_LABELS[inv.status]}
                        </span>
                      }
                      onSave={async (val) => {
                        await updateInvoice(inv.id, {
                          status: val as DiningInvoiceStatus,
                        });
                      }}
                    />
                  </td>
                  <td className="truncate px-4 py-3 text-stone-500">
                    {new Date(inv.createdAt).toLocaleString('zh-CN')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {inv.status === 'available' && (
                      <button
                        type="button"
                        onClick={() => handleDelete(inv.id)}
                        disabled={deletingId === inv.id}
                        className="text-red-600 opacity-0 transition-opacity hover:underline group-hover:opacity-100 disabled:opacity-50"
                      >
                        {deletingId === inv.id ? '删除中…' : '删除'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {previewInvoice && (
        <FilePreviewModal
          open
          title={previewInvoice.originalName}
          url={api.getDiningInvoiceViewUrl(previewInvoice.id)}
          onClose={() => setPreviewInvoice(null)}
        />
      )}
    </div>
  );
}
