import { useEffect, useRef, useState } from 'react';

interface EditableFieldProps {
  value: string;
  display: React.ReactNode;
  inputType?: 'text' | 'date' | 'number' | 'select';
  options?: { value: string; label: string }[];
  placeholder?: string;
  onSave: (value: string) => Promise<void>;
  className?: string;
  title?: string;
}

export function EditableField({
  value,
  display,
  inputType = 'text',
  options,
  placeholder,
  onSave,
  className = '',
  title,
}: EditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  if (editing) {
    if (inputType === 'select' && options) {
      return (
        <select
          ref={inputRef as React.RefObject<HTMLSelectElement>}
          value={draft}
          disabled={saving}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') cancel();
          }}
          className="w-full rounded border border-stone-300 px-2 py-1 text-sm focus:border-stone-500 focus:outline-none"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    }

    return (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type={inputType}
        value={draft}
        disabled={saving}
        placeholder={placeholder}
        step={inputType === 'number' ? '0.01' : undefined}
        min={inputType === 'number' ? '0' : undefined}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') cancel();
        }}
        className="w-full rounded border border-stone-300 px-2 py-1 text-sm focus:border-stone-500 focus:outline-none"
      />
    );
  }

  return (
    <button
      type="button"
      title={title ?? '点击编辑'}
      onClick={() => setEditing(true)}
      className={`block w-full truncate text-left hover:bg-stone-100 rounded px-1 -mx-1 py-0.5 transition-colors ${className}`}
    >
      {display}
    </button>
  );
}
