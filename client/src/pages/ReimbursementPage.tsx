import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import { DiningInvoiceMatchModal } from '../components/DiningInvoiceMatchModal';
import { DropZone } from '../components/DropZone';
import { ExportPreviewModal } from '../components/ExportPreviewModal';
import { LocationTags } from '../components/LocationTags';
import type { ExportPreview, FileCategory, FileSubType, Reimbursement, ReimbursementTemplate } from '../types';
import { DROP_ZONES, formatAccommodationPreview, formatDiningPreview, formatReimbursementDateRange, getDisplayFolderPath, getReimbursementStatus, REIMBURSEMENT_STATUS_LABELS, REIMBURSEMENT_STATUS_STYLES } from '../types';

export function ReimbursementPage() {
  const { id } = useParams<{ id: string }>();
  const [reimbursement, setReimbursement] = useState<Reimbursement | null>(null);
  const [template, setTemplate] = useState<ReimbursementTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [exportPreviewOpen, setExportPreviewOpen] = useState(false);
  const [exportPreview, setExportPreview] = useState<ExportPreview | null>(null);
  const [diningMatchOpen, setDiningMatchOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const r = await api.getReimbursement(id);
    setReimbursement(r);
    const t = await api.getTemplate(r.templateId);
    setTemplate(t);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleUpload = async (file: File, category: FileCategory, subType: FileSubType) => {
    if (!id) return;
    await api.uploadFile(id, file, category, subType);
    await load();
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!id) return;
    await api.deleteFile(id, fileId);
    await load();
  };

  const handleOpenFolder = async () => {
    if (!id) return;
    try {
      await api.openFolder(id);
    } catch {
      alert('无法打开文件夹，请手动前往：' + getDisplayFolderPath(reimbursement!));
    }
  };

  const handleExportClick = async () => {
    if (!id) return;
    setPreviewLoading(true);
    try {
      const preview = await api.getExportPreview(id);
      setExportPreview(preview);
      setExportPreviewOpen(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : '无法生成导出预览');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleConfirmExport = async () => {
    if (!id) return;
    setExporting(true);
    try {
      const exported = await api.exportReimbursement(id);
      setReimbursement(exported);
      setExportPreviewOpen(false);
      setExportPreview(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : '导出失败');
    } finally {
      setExporting(false);
    }
  };

  if (loading || !reimbursement) {
    return <p className="text-stone-500">加载中…</p>;
  }

  const status = getReimbursementStatus(reimbursement);

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-semibold text-stone-900">
                {reimbursement.purpose ?? reimbursement.name}
              </h2>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${REIMBURSEMENT_STATUS_STYLES[status]}`}
              >
                {REIMBURSEMENT_STATUS_LABELS[status]}
              </span>
            </div>
            {reimbursement.locations && reimbursement.locations.length > 0 && (
              <div className="mt-2">
                <LocationTags locations={reimbursement.locations} />
              </div>
            )}
            <p className="mt-1 text-sm text-stone-500">
              {formatReimbursementDateRange(reimbursement)}
            </p>
            <p className="mt-0.5 text-xs text-stone-400">
              {reimbursement.exportFolderPath
                ? reimbursement.exportFolderPath
                : '尚未导出 · 点击「导出报销单」生成目标文件夹'}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleOpenFolder}
              disabled={!reimbursement.exportFolderPath}
              className="rounded-lg border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 disabled:opacity-50"
            >
              打开文件夹
            </button>
            <button
              onClick={handleExportClick}
              disabled={previewLoading || exporting || reimbursement.files.length === 0}
              className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
            >
              {previewLoading ? '准备中…' : exporting ? '导出中…' : '导出报销单'}
            </button>
          </div>
        </div>
      </div>

      {template && (
        <div className="mb-6 rounded-xl border border-stone-200 bg-white p-5">
          <h3 className="mb-3 text-sm font-medium text-stone-700">报销标准 · {template.name}</h3>
          <div className="space-y-1 text-sm text-stone-600">
            <p>{formatAccommodationPreview(template.accommodation)}</p>
            <p>{formatDiningPreview(template.dining)}</p>
          </div>
        </div>
      )}

      <div className="mb-4">
        <h3 className="font-medium text-stone-900">收集报销文件</h3>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {DROP_ZONES.map((zone) => {
          const zoneFiles = reimbursement.files.filter(
            (f) => f.category === zone.category && f.subType === zone.subType
          );
          const isInvoice = zone.subType === 'invoice';
          const zoneTotal = isInvoice
            ? zoneFiles.reduce((sum, f) => sum + (f.extractedAmount ?? 0), 0)
            : 0;
          const recognizedCount = isInvoice
            ? zoneFiles.filter((f) => f.extractedAmount != null).length
            : 0;
          const isDiningInvoice = zone.category === 'dining' && zone.subType === 'invoice';

          return (
            <DropZone
              key={`${zone.category}-${zone.subType}`}
              label={zone.label}
              hint={zone.hint}
              category={zone.category}
              subType={zone.subType}
              files={zoneFiles}
              onUpload={handleUpload}
              onDelete={handleDeleteFile}
              getFileViewUrl={(fileId) => api.getFileViewUrl(id!, fileId)}
              showAmount={isInvoice || (zone.category === 'accommodation' && zone.subType === 'receipt')}
              headerExtra={
                isDiningInvoice ? (
                  <button
                    type="button"
                    onClick={() => setDiningMatchOpen(true)}
                    className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                  >
                    从发票库匹配
                  </button>
                ) : undefined
              }
              footer={
                isInvoice && zoneFiles.length > 0 ? (
                  <div className="mt-3 rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-600">
                    已识别 {recognizedCount}/{zoneFiles.length} 张，
                    合计 <span className="font-medium text-stone-900">¥{zoneTotal.toFixed(2)}</span>
                  </div>
                ) : undefined
              }
            />
          );
        })}
      </div>

      <ExportPreviewModal
        open={exportPreviewOpen}
        preview={exportPreview}
        exporting={exporting}
        onClose={() => {
          if (!exporting) {
            setExportPreviewOpen(false);
            setExportPreview(null);
          }
        }}
        onConfirm={handleConfirmExport}
      />

      {id && (
        <DiningInvoiceMatchModal
          open={diningMatchOpen}
          reimbursementId={id}
          onClose={() => setDiningMatchOpen(false)}
          onAttached={load}
        />
      )}
    </div>
  );
}
