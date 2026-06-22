import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { LocationTags } from './LocationTags';
import type { Reimbursement, ReimbursementTemplate, ReimbursementStatus } from '../types';
import { formatReimbursementFolderPreview, getReimbursementStatus, REIMBURSEMENT_STATUSES, REIMBURSEMENT_STATUS_LABELS } from '../types';

export interface ReimbursementFormData {
  purpose: string;
  locations: string[];
  startDate: string;
  endDate: string;
  templateId: string;
  status: ReimbursementStatus;
}

const EMPTY_FORM: ReimbursementFormData = {
  purpose: '',
  locations: [],
  startDate: '',
  endDate: '',
  templateId: '',
  status: 'pending',
};

function toFormData(reimbursement: Reimbursement | null, templates: ReimbursementTemplate[]): ReimbursementFormData {
  if (!reimbursement) {
    const today = new Date().toISOString().slice(0, 10);
    return {
      purpose: '',
      locations: [],
      startDate: today,
      endDate: today,
      templateId: templates[0]?.id ?? '',
      status: 'pending',
    };
  }
  return {
    purpose: reimbursement.purpose ?? '',
    locations: reimbursement.locations ? [...reimbursement.locations] : [],
    startDate: reimbursement.startDate ?? new Date().toISOString().slice(0, 10),
    endDate: reimbursement.endDate ?? new Date().toISOString().slice(0, 10),
    templateId: reimbursement.templateId,
    status: getReimbursementStatus(reimbursement),
  };
}

interface ReimbursementFormModalProps {
  open: boolean;
  editing: Reimbursement | null;
  templates: ReimbursementTemplate[];
  onClose: () => void;
  onSave: (data: ReimbursementFormData) => Promise<void>;
  onDelete?: () => Promise<void>;
}

export function ReimbursementFormModal({
  open,
  editing,
  templates,
  onClose,
  onSave,
  onDelete,
}: ReimbursementFormModalProps) {
  const [form, setForm] = useState<ReimbursementFormData>(EMPTY_FORM);
  const [locationInput, setLocationInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm(toFormData(editing, templates));
      setLocationInput('');
      setError('');
    }
  }, [open, editing, templates]);

  const addLocation = () => {
    const loc = locationInput.trim();
    if (!loc) return;
    if (form.locations.includes(loc)) {
      setLocationInput('');
      return;
    }
    setForm({ ...form, locations: [...form.locations, loc] });
    setLocationInput('');
  };

  const removeLocation = (loc: string) => {
    setForm({ ...form, locations: form.locations.filter((l) => l !== loc) });
  };

  const validate = (): boolean => {
    if (!form.purpose.trim()) {
      setError('请填写事由');
      return false;
    }
    if (form.locations.length === 0) {
      setError('请至少添加一个地点');
      return false;
    }
    if (!form.startDate || !form.endDate) {
      setError('请填写出差时间');
      return false;
    }
    if (form.startDate > form.endDate) {
      setError('结束日期不能早于开始日期');
      return false;
    }
    if (!form.templateId) {
      setError('请选择报销模板');
      return false;
    }
    return true;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!validate()) return;

    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    if (!confirm('确定删除此报销记录？（本地文件夹不会被删除）')) return;

    setDeleting(true);
    try {
      await onDelete();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    } finally {
      setDeleting(false);
    }
  };

  const folderPreview = formatReimbursementFolderPreview(
    form.startDate,
    form.locations,
    form.purpose
  );

  const originalFolderPreview = editing
    ? formatReimbursementFolderPreview(
        editing.startDate ?? '',
        editing.locations ?? [],
        editing.purpose ?? ''
      )
    : '';

  const showFolderPreview =
    folderPreview && (!editing || folderPreview !== originalFolderPreview);

  return (
    <Modal open={open} title={editing ? '编辑出差报销' : '新建出差报销'} onClose={onClose}>
      <form onSubmit={handleSave}>
        <label className="mb-4 block">
          <span className="mb-1 block text-sm text-stone-600">事由</span>
          <input
            value={form.purpose}
            onChange={(e) => setForm({ ...form, purpose: e.target.value })}
            placeholder="例如：参加学术会议"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
            autoFocus
          />
        </label>

        <div className="mb-4">
          <span className="mb-1 block text-sm text-stone-600">地点</span>
          <input
            value={locationInput}
            onChange={(e) => setLocationInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addLocation();
              }
            }}
            placeholder="输入地点后按回车添加"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
          />
          {form.locations.length > 0 && (
            <div className="mt-2">
              <LocationTags
                locations={form.locations}
                readonly={false}
                onRemove={removeLocation}
              />
            </div>
          )}
        </div>

        <div className="mb-4 grid grid-cols-2 gap-4">
          <label className="block">
            <span className="mb-1 block text-sm text-stone-600">开始日期</span>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-stone-600">结束日期</span>
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
            />
          </label>
        </div>

        <label className="mb-4 block">
          <span className="mb-1 block text-sm text-stone-600">报销模板</span>
          <select
            value={form.templateId}
            onChange={(e) => setForm({ ...form, templateId: e.target.value })}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        {editing && (
          <label className="mb-4 block">
            <span className="mb-1 block text-sm text-stone-600">报销状态</span>
            <select
              value={form.status}
              onChange={(e) =>
                setForm({ ...form, status: e.target.value as ReimbursementStatus })
              }
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
            >
              {REIMBURSEMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {REIMBURSEMENT_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
        )}

        {showFolderPreview && (
          <div className="mb-4 rounded-lg bg-stone-50 px-4 py-3 text-sm text-stone-600">
            <span className="text-stone-500">
              {editing ? '导出文件夹名称将变更为：' : '导出文件夹名称：'}
            </span>
            {folderPreview}
          </div>
        )}

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        <div className="flex items-center justify-between">
          <div>
            {editing && onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting || saving}
                className="rounded-lg px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                {deleting ? '删除中…' : '删除'}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-stone-600 hover:bg-stone-100"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving || deleting || templates.length === 0}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? '保存中…' : editing ? '保存' : '创建'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
