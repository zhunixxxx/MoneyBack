import { useEffect, useState } from 'react';
import { api } from '../api';

export function SettingsPage() {
  const [baseDirectory, setBaseDirectory] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getSettings().then((s) => {
      setBaseDirectory(s.baseDirectory);
      setLoading(false);
    });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await api.updateSettings({ baseDirectory });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-stone-500">加载中…</p>;

  return (
    <div>
      <h2 className="text-2xl font-semibold text-stone-900">设置</h2>
      <p className="mt-1 text-sm text-stone-500">配置报销文件的默认存储目录</p>

      <form onSubmit={handleSave} className="mt-6 max-w-xl rounded-xl border border-stone-200 bg-white p-6">
        <label className="block">
          <span className="mb-1 block text-sm text-stone-600">报销根目录</span>
          <input
            value={baseDirectory}
            onChange={(e) => setBaseDirectory(e.target.value)}
            placeholder="/home/user/MoneyBack报销"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
          />
          <p className="mt-2 text-xs text-stone-400">
            创建新报销时，会在此目录下自动生成以「报销名称_日期」命名的子文件夹
          </p>
        </label>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
          >
            {saving ? '保存中…' : '保存设置'}
          </button>
          {saved && <span className="text-sm text-emerald-600">已保存</span>}
        </div>
      </form>

      <div className="mt-8 rounded-xl border border-stone-200 bg-white p-6">
        <h3 className="font-medium text-stone-900">文件夹结构</h3>
        <p className="mt-2 text-sm text-stone-500">点击「导出报销单」后，会在报销根目录生成如下结构的文件夹：</p>
        <pre className="mt-3 rounded-lg bg-stone-50 p-4 text-sm text-stone-700">
{`20250622-北京+上海-参加学术会议/
├── 20250617-交通-高铁-电子发票.pdf
├── 20250617-交通-打车-电子发票.pdf
├── 20250617-交通-打车-行程单.pdf
├── 20250617-住宿-电子发票.pdf
├── 20250617-住宿-水单.pdf
└── 餐饮-60.85元.pdf`}
        </pre>
      </div>
    </div>
  );
}
