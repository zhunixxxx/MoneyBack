import { Modal } from './Modal';
import type { ExportPreview } from '../types';
import { DROP_ZONES } from '../types';

interface ExportPreviewModalProps {
  open: boolean;
  preview: ExportPreview | null;
  exporting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ExportPreviewModal({
  open,
  preview,
  exporting,
  onClose,
  onConfirm,
}: ExportPreviewModalProps) {
  const groups = DROP_ZONES.map((zone) => ({
    label: zone.label,
    files: (preview?.items ?? []).filter(
      (f) => f.category === zone.category && f.subType === zone.subType
    ),
  })).filter((g) => g.files.length > 0);

  return (
    <Modal open={open} title="导出预览" onClose={exporting ? () => { } : onClose}>
      {preview && (
        <div className="space-y-5">
          <div className="rounded-lg bg-stone-50 px-4 py-3">
            <p className="text-xs text-stone-500">目标文件夹</p>
            <p className="mt-1 font-mono text-sm text-stone-900">{preview.folderName}</p>
          </div>

          <div className="space-y-4">
            {groups.map((group) => (
              <section key={group.label}>
                <h4 className="mb-2 text-sm font-medium text-stone-700">{group.label}</h4>
                <ul className="space-y-2">
                  {group.files.map((file) => (
                    <li
                      key={file.fileId}
                      className="rounded-lg border border-stone-200 px-3 py-2.5 text-sm"
                    >
                      <p className="truncate font-medium text-stone-900" title={file.exportFileName}>
                        {file.exportFileName}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-stone-400" title={file.originalName}>
                        原文件：{file.originalName}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <div className="flex justify-end gap-3 border-t border-stone-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={exporting}
              className="rounded-lg border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={exporting}
              className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
            >
              {exporting ? '导出中…' : '确认导出'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
