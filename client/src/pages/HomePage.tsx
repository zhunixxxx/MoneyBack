import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { LocationTags } from '../components/LocationTags';
import { ReimbursementFormModal, type ReimbursementFormData } from '../components/ReimbursementFormModal';
import type { Reimbursement, ReimbursementTemplate } from '../types';
import { formatReimbursementDateRange, getReimbursementStatus, REIMBURSEMENT_STATUS_LABELS, REIMBURSEMENT_STATUS_STYLES } from '../types';

export function HomePage() {
  const [reimbursements, setReimbursements] = useState<Reimbursement[]>([]);
  const [templates, setTemplates] = useState<ReimbursementTemplate[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Reimbursement | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getReimbursements(), api.getTemplates()])
      .then(([r, t]) => {
        setReimbursements(r);
        setTemplates(t);
      })
      .finally(() => setLoading(false));
  }, []);

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (r: Reimbursement) => {
    setEditing(r);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
  };

  const handleSave = async (data: ReimbursementFormData) => {
    if (editing) {
      const updated = await api.updateReimbursement(editing.id, data);
      setReimbursements((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } else {
      const created = await api.createReimbursement(data);
      setReimbursements((prev) => [created, ...prev]);
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    await api.deleteReimbursement(editing.id);
    setReimbursements((prev) => prev.filter((r) => r.id !== editing.id));
  };

  if (loading) {
    return <p className="text-stone-500">加载中…</p>;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-stone-900">出差报销</h2>
          <p className="mt-1 text-sm text-stone-500">
            根据模板创建报销，拖拽文件自动整理到本地文件夹
          </p>
        </div>
        <button
          onClick={openCreate}
          disabled={templates.length === 0}
          className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
        >
          新建报销
        </button>
      </div>

      <ReimbursementFormModal
        open={modalOpen}
        editing={editing}
        templates={templates}
        onClose={closeModal}
        onSave={handleSave}
        onDelete={editing ? handleDelete : undefined}
      />

      {reimbursements.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-white p-12 text-center">
          <p className="text-stone-500">还没有报销记录</p>
          <p className="mt-1 text-sm text-stone-400">点击「新建报销」开始整理你的出差报销文件</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reimbursements.map((r) => {
            const status = getReimbursementStatus(r);
            return (
            <div
              key={r.id}
              className="flex items-stretch justify-between rounded-xl border border-stone-200 bg-white"
            >
              <Link
                to={`/reimbursements/${r.id}`}
                className="min-w-0 flex-1 px-5 py-4 transition-colors hover:bg-stone-50"
              >
                <div className="flex items-center gap-2">
                  <p className="font-medium text-stone-900">{r.purpose ?? r.name}</p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${REIMBURSEMENT_STATUS_STYLES[status]}`}
                  >
                    {REIMBURSEMENT_STATUS_LABELS[status]}
                  </span>
                </div>
                {r.locations && r.locations.length > 0 && (
                  <div className="mt-1.5">
                    <LocationTags locations={r.locations} />
                  </div>
                )}
                <p className="mt-1.5 text-sm text-stone-500">
                  {formatReimbursementDateRange(r)} · {r.files.length} 个文件
                </p>
                <p className="mt-0.5 truncate text-xs text-stone-400">
                  {r.exportFolderPath ?? '尚未导出'}
                </p>
              </Link>
              <div className="flex shrink-0 items-center px-5 py-4">
                <button
                  type="button"
                  onClick={() => openEdit(r)}
                  className="rounded-lg bg-stone-100 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-200"
                >
                  编辑
                </button>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
