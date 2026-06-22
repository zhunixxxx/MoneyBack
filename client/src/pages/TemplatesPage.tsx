import { useEffect, useState } from 'react';
import { api } from '../api';
import { TemplateFormModal } from '../components/TemplateFormModal';
import type { ReimbursementTemplate } from '../types';
import { formatAccommodationPreview, formatDiningPreview } from '../types';

export function TemplatesPage() {
  const [templates, setTemplates] = useState<ReimbursementTemplate[]>([]);
  const [editing, setEditing] = useState<ReimbursementTemplate | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = () => {
    api.getTemplates().then(setTemplates).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (t: ReimbursementTemplate) => {
    setEditing(t);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
  };

  const handleSave = async (payload: Parameters<typeof api.createTemplate>[0]) => {
    if (editing) {
      await api.updateTemplate(editing.id, payload);
    } else {
      await api.createTemplate(payload);
    }
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除此模板？')) return;
    await api.deleteTemplate(id);
    load();
  };

  if (loading) return <p className="text-stone-500">加载中…</p>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-stone-900">报销模板</h2>
          <p className="mt-1 text-sm text-stone-500">配置住宿和餐饮报销标准</p>
        </div>
        <button
          onClick={openCreate}
          className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
        >
          新建模板
        </button>
      </div>

      <TemplateFormModal
        open={modalOpen}
        editing={editing}
        onClose={closeModal}
        onSave={handleSave}
      />

      <div className="space-y-3">
        {templates.map((t) => (
          <div key={t.id} className="rounded-xl border border-stone-200 bg-white p-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-medium text-stone-900">{t.name}</h3>
                <div className="mt-2 space-y-1 text-sm text-stone-600">
                  <p>{formatAccommodationPreview(t.accommodation)}</p>
                  <p>{formatDiningPreview(t.dining)}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => openEdit(t)}
                  className="rounded-lg bg-stone-100 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-200"
                >
                  编辑
                </button>
                <button
                  onClick={() => handleDelete(t.id)}
                  className="rounded-lg px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
