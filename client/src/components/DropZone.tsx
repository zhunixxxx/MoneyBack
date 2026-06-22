import { useCallback, useState } from 'react';
import type { FileCategory, FileSubType, ReimbursementFile } from '../types';
import { FilePreviewModal } from './FilePreviewModal';

interface DropZoneProps {
  label: string;
  hint: string;
  category: FileCategory;
  subType: FileSubType;
  files: ReimbursementFile[];
  onUpload: (file: File, category: FileCategory, subType: FileSubType) => Promise<void>;
  onDelete?: (fileId: string) => Promise<void>;
  getFileViewUrl?: (fileId: string) => string;
  showAmount?: boolean;
  footer?: React.ReactNode;
}

function formatAmount(amount: number): string {
  return amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function DropZone({
  label,
  hint,
  category,
  subType,
  files,
  onUpload,
  onDelete,
  getFileViewUrl,
  showAmount = false,
  footer,
}: DropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<ReimbursementFile | null>(null);

  const handleFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList?.length) return;
      setUploading(true);
      try {
        for (const file of Array.from(fileList)) {
          await onUpload(file, category, subType);
        }
      } finally {
        setUploading(false);
      }
    },
    [onUpload, category, subType]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleDelete = async (fileId: string) => {
    if (!onDelete) return;
    setDeletingId(fileId);
    try {
      await onDelete(fileId);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-medium text-stone-900">{label}</h3>
        {files.length > 0 && (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
            {files.length} 个文件
          </span>
        )}
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`relative flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors ${
          dragging
            ? 'border-emerald-400 bg-emerald-50'
            : 'border-stone-200 bg-stone-50 hover:border-stone-300'
        } ${uploading ? 'opacity-60 pointer-events-none' : ''}`}
        onClick={() => {
          const input = document.createElement('input');
          input.type = 'file';
          input.multiple = true;
          input.onchange = () => handleFiles(input.files);
          input.click();
        }}
      >
        <svg className="mb-2 h-8 w-8 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <p className="text-sm text-stone-600">
          {uploading ? '正在上传并识别金额…' : '拖拽文件到此处，或点击选择'}
        </p>
        <p className="mt-1 text-xs text-stone-400">{hint}</p>
      </div>

      {files.length > 0 && (
        <ul className="mt-3 space-y-1">
          {files.map((f) => (
            <li
              key={f.id}
              className="group flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-stone-100"
            >
              <div className="min-w-0 flex-1">
                {getFileViewUrl ? (
                  <button
                    type="button"
                    onClick={() => setPreviewFile(f)}
                    className="block max-w-full truncate text-left text-stone-700 hover:text-emerald-700 hover:underline"
                    title={f.originalName}
                  >
                    {f.originalName}
                  </button>
                ) : (
                  <div className="truncate text-stone-700" title={f.originalName}>
                    {f.originalName}
                  </div>
                )}
                {showAmount && (
                  <div className="mt-0.5 text-xs">
                    {f.extractedAmount != null ? (
                      <span className="font-medium text-emerald-700">
                        识别金额：¥{formatAmount(f.extractedAmount)}
                      </span>
                    ) : (
                      <span className="text-stone-400">
                        {f.amountExtractNote || '未能识别金额'}
                      </span>
                    )}
                  </div>
                )}
              </div>
              {onDelete && (
                <button
                  type="button"
                  onClick={() => handleDelete(f.id)}
                  disabled={deletingId === f.id}
                  className="shrink-0 rounded px-2 py-1 text-xs text-red-600 opacity-0 transition-opacity hover:bg-red-50 group-hover:opacity-100 disabled:opacity-50"
                >
                  {deletingId === f.id ? '删除中…' : '删除'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {footer}

      {previewFile && getFileViewUrl && (
        <FilePreviewModal
          open
          title={previewFile.originalName}
          url={getFileViewUrl(previewFile.id)}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </div>
  );
}
