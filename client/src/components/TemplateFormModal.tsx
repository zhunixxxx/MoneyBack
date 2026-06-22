import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import type { ReimbursementTemplate } from '../types';
import {
  formatAccommodationPreview,
  formatDiningPreview,
  getDailyDiningTotal,
  TIER1_CITIES,
} from '../types';

export const EMPTY_TEMPLATE_FORM = {
  name: '',
  accommodation: {
    tier1Rate: 400,
    defaultRate: 300,
  },
  dining: {
    breakfast: { amount: 20, beforeHour: 9 },
    lunch: { amount: 50 },
    dinner: { amount: 50, afterHour: 18 },
  },
};

export type TemplateFormData = typeof EMPTY_TEMPLATE_FORM;

interface TemplateFormModalProps {
  open: boolean;
  editing: ReimbursementTemplate | null;
  onClose: () => void;
  onSave: (payload: {
    name: string;
    accommodation: { tier1Cities: string[]; tier1Rate: number; defaultRate: number };
    dining: TemplateFormData['dining'];
  }) => Promise<void>;
}

function toFormData(template: ReimbursementTemplate | null): TemplateFormData {
  if (!template) return EMPTY_TEMPLATE_FORM;
  return {
    name: template.name,
    accommodation: {
      tier1Rate: template.accommodation.tier1Rate,
      defaultRate: template.accommodation.defaultRate,
    },
    dining: {
      breakfast: { ...template.dining.breakfast },
      lunch: { ...template.dining.lunch },
      dinner: { ...template.dining.dinner },
    },
  };
}

export function TemplateFormModal({ open, editing, onClose, onSave }: TemplateFormModalProps) {
  const [form, setForm] = useState<TemplateFormData>(EMPTY_TEMPLATE_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(toFormData(editing));
    }
  }, [open, editing]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        name: form.name,
        accommodation: {
          tier1Cities: TIER1_CITIES,
          tier1Rate: form.accommodation.tier1Rate,
          defaultRate: form.accommodation.defaultRate,
        },
        dining: form.dining,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const previewAccommodation = formatAccommodationPreview({
    tier1Cities: TIER1_CITIES,
    ...form.accommodation,
  });
  const previewDining = formatDiningPreview(form.dining);

  return (
    <Modal open={open} title={editing ? '编辑模板' : '新建模板'} onClose={onClose}>
      <form onSubmit={handleSave}>
        <label className="mb-4 block">
          <span className="mb-1 block text-sm text-stone-600">模板名称</span>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
            required
            autoFocus
          />
        </label>

        <fieldset className="mb-4 rounded-lg border border-stone-200 p-4">
          <legend className="px-2 text-sm font-medium text-stone-700">住宿标准</legend>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="mb-1 block text-sm text-stone-600">一线城市（元/夜间）</span>
              <input
                type="number"
                value={form.accommodation.tier1Rate}
                onChange={(e) =>
                  setForm({
                    ...form,
                    accommodation: { ...form.accommodation, tier1Rate: Number(e.target.value) },
                  })
                }
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-stone-600">其他城市（元/夜间）</span>
              <input
                type="number"
                value={form.accommodation.defaultRate}
                onChange={(e) =>
                  setForm({
                    ...form,
                    accommodation: { ...form.accommodation, defaultRate: Number(e.target.value) },
                  })
                }
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="mb-4 rounded-lg border border-stone-200 p-4">
          <legend className="px-2 text-sm font-medium text-stone-700">
            餐饮标准（{getDailyDiningTotal(form.dining)} 元/天）
          </legend>
          <div className="grid grid-cols-3 gap-4">
            <label className="block">
              <span className="mb-1 block text-sm text-stone-600">早餐（元）</span>
              <input
                type="number"
                value={form.dining.breakfast.amount}
                onChange={(e) =>
                  setForm({
                    ...form,
                    dining: {
                      ...form.dining,
                      breakfast: { ...form.dining.breakfast, amount: Number(e.target.value) },
                    },
                  })
                }
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
              />
              <span className="mb-1 mt-2 block text-sm text-stone-600">早餐截止时间</span>
              <input
                type="number"
                min={0}
                max={23}
                value={form.dining.breakfast.beforeHour}
                onChange={(e) =>
                  setForm({
                    ...form,
                    dining: {
                      ...form.dining,
                      breakfast: { ...form.dining.breakfast, beforeHour: Number(e.target.value) },
                    },
                  })
                }
                className="w-full rounded-lg border border-stone-300 px-3 py-1 text-sm focus:border-stone-500 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-stone-600">午餐（元）</span>
              <input
                type="number"
                value={form.dining.lunch.amount}
                onChange={(e) =>
                  setForm({
                    ...form,
                    dining: {
                      ...form.dining,
                      lunch: { amount: Number(e.target.value) },
                    },
                  })
                }
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-stone-600">晚餐（元）</span>
              <input
                type="number"
                value={form.dining.dinner.amount}
                onChange={(e) =>
                  setForm({
                    ...form,
                    dining: {
                      ...form.dining,
                      dinner: { ...form.dining.dinner, amount: Number(e.target.value) },
                    },
                  })
                }
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
              />
              <span className="mb-1 mt-2 block text-sm text-stone-600">晚餐开始时间</span>
              <input
                type="number"
                min={0}
                max={23}
                value={form.dining.dinner.afterHour}
                onChange={(e) =>
                  setForm({
                    ...form,
                    dining: {
                      ...form.dining,
                      dinner: { ...form.dining.dinner, afterHour: Number(e.target.value) },
                    },
                  })
                }
                className="w-full rounded-lg border border-stone-300 px-3 py-1 text-sm focus:border-stone-500 focus:outline-none"
              />
            </label>
          </div>
        </fieldset>

        <div className="mb-4 rounded-lg bg-stone-50 px-4 py-3 text-sm text-stone-600">
          <p>{previewAccommodation}</p>
          <p className="mt-1">{previewDining}</p>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-stone-600 hover:bg-stone-100"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
