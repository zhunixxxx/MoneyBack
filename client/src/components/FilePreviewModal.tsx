import { useEffect } from 'react';

interface FilePreviewModalProps {
  open: boolean;
  title: string;
  url: string;
  onClose: () => void;
}

function getPreviewKind(filename: string): 'pdf' | 'image' | 'other' {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return 'pdf';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(ext)) return 'image';
  return 'other';
}

export function FilePreviewModal({ open, title, url, onClose }: FilePreviewModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const kind = getPreviewKind(title);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="file-preview-title"
        className="relative z-10 flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-stone-200 px-5 py-3">
          <h3
            id="file-preview-title"
            className="min-w-0 truncate pr-4 text-base font-medium text-stone-900"
            title={title}
          >
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
            aria-label="关闭"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 bg-stone-100">
          {kind === 'pdf' || kind === 'other' ? (
            <iframe
              src={url}
              title={title}
              className="h-full w-full border-0 bg-white"
            />
          ) : (
            <div className="flex h-full items-center justify-center overflow-auto p-4">
              <img src={url} alt={title} className="max-h-full max-w-full object-contain shadow-sm" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
