import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { FilePreviewModal } from './FilePreviewModal';
import { Modal } from './Modal';
import type { DiningInvoice, DiningSuggestAmount } from '../types';

interface DiningInvoiceMatchModalProps {
  open: boolean;
  reimbursementId: string;
  onClose: () => void;
  onAttached: () => void;
}

function formatAmount(amount: number): string {
  return amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function DiningInvoiceMatchModal({
  open,
  reimbursementId,
  onClose,
  onAttached,
}: DiningInvoiceMatchModalProps) {
  const [targetAmount, setTargetAmount] = useState('');
  const [suggest, setSuggest] = useState<DiningSuggestAmount | null>(null);
  const [matchResult, setMatchResult] = useState<{
    total: number;
    isExact: boolean;
    invoices: DiningInvoice[];
  } | null>(null);
  const [previewInvoice, setPreviewInvoice] = useState<DiningInvoice | null>(null);
  const [loading, setLoading] = useState(false);
  const [matching, setMatching] = useState(false);
  const [attaching, setAttaching] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMatchResult(null);
    setLoading(true);
    api
      .suggestDiningAmount(reimbursementId)
      .then((data) => {
        setSuggest(data);
        if (data.suggestedAmount != null) {
          setTargetAmount(String(data.suggestedAmount));
        } else {
          setTargetAmount('');
        }
      })
      .finally(() => setLoading(false));
  }, [open, reimbursementId]);

  const handleMatch = async () => {
    const amount = parseFloat(targetAmount);
    if (!amount || amount <= 0) {
      alert('请填写有效的目标金额');
      return;
    }

    setMatching(true);
    try {
      const result = await api.matchDiningInvoices(reimbursementId, amount);
      setMatchResult({
        total: result.total,
        isExact: result.isExact,
        invoices: result.invoices,
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : '匹配失败');
    } finally {
      setMatching(false);
    }
  };

  const handleAttach = async () => {
    if (!matchResult?.invoices.length) return;
    setAttaching(true);
    try {
      await api.attachDiningInvoices(
        reimbursementId,
        matchResult.invoices.map((inv) => inv.id)
      );
      onAttached();
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : '导入失败');
    } finally {
      setAttaching(false);
    }
  };

  const handleUseSuggested = useCallback(() => {
    if (suggest?.suggestedAmount != null) {
      setTargetAmount(String(suggest.suggestedAmount));
      setMatchResult(null);
    }
  }, [suggest]);

  return (
    <>
      <Modal open={open} title="从发票库自动匹配" onClose={onClose}>
        {loading ? (
          <p className="text-stone-500">加载中…</p>
        ) : (
          <div className="space-y-5">
            {suggest && suggest.suggestedAmount != null && (
              <div className="rounded-lg bg-stone-50 px-4 py-3 text-sm text-stone-600">
                根据模板标准（{suggest.dailyTotal} 元/天 × {suggest.days} 天），
                建议餐饮金额{' '}
                <span className="font-medium text-stone-900">
                  ¥{formatAmount(suggest.suggestedAmount)}
                </span>
                <button
                  type="button"
                  onClick={handleUseSuggested}
                  className="ml-2 text-emerald-700 hover:underline"
                >
                  填入
                </button>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-stone-700">
                目标金额（元）
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={targetAmount}
                  onChange={(e) => {
                    setTargetAmount(e.target.value);
                    setMatchResult(null);
                  }}
                  placeholder="输入需要凑齐的餐饮金额"
                  className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleMatch}
                  disabled={matching}
                  className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
                >
                  {matching ? '匹配中…' : '自动匹配'}
                </button>
              </div>
            </div>

            {matchResult && (
              <div className="rounded-xl border border-stone-200">
                <div className="border-b border-stone-200 px-4 py-3">
                  {matchResult.invoices.length === 0 ? (
                    <p className="text-sm text-stone-500">没有可用的餐饮发票，请先到发票库上传</p>
                  ) : (
                    <p className="text-sm text-stone-600">
                      匹配 {matchResult.invoices.length} 张发票，合计{' '}
                      <span className="font-medium text-stone-900">
                        ¥{formatAmount(matchResult.total)}
                      </span>
                      {matchResult.isExact ? (
                        <span className="ml-2 text-emerald-700">（精确匹配）</span>
                      ) : (
                        <span className="ml-2 text-amber-700">（最接近目标金额）</span>
                      )}
                    </p>
                  )}
                </div>
                {matchResult.invoices.length > 0 && (
                  <ul className="max-h-48 divide-y divide-stone-100 overflow-y-auto">
                    {matchResult.invoices.map((inv) => (
                      <li key={inv.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                        <button
                          type="button"
                          onClick={() => setPreviewInvoice(inv)}
                          className="min-w-0 flex-1 truncate text-left text-stone-700 hover:text-emerald-700 hover:underline"
                          title={inv.originalName}
                        >
                          {inv.originalName}
                          {inv.invoiceDate && (
                            <span className="ml-2 text-xs text-stone-400">{inv.invoiceDate}</span>
                          )}
                        </button>
                        <span className="shrink-0 font-medium text-emerald-700">
                          ¥{inv.extractedAmount != null ? formatAmount(inv.extractedAmount) : '—'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleAttach}
                disabled={attaching || !matchResult?.invoices.length}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {attaching ? '导入中…' : '导入到报销单'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {previewInvoice && (
        <FilePreviewModal
          open
          title={previewInvoice.originalName}
          url={api.getDiningInvoiceViewUrl(previewInvoice.id)}
          onClose={() => setPreviewInvoice(null)}
        />
      )}
    </>
  );
}
