interface LocationTagsProps {
  locations: string[];
  readonly?: boolean;
  onRemove?: (location: string) => void;
}

export function LocationTags({ locations, readonly = true, onRemove }: LocationTagsProps) {
  if (locations.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {locations.map((loc) => (
        <span
          key={loc}
          className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-3 py-1 text-sm text-stone-700"
        >
          {loc}
          {!readonly && onRemove && (
            <button
              type="button"
              onClick={() => onRemove(loc)}
              className="text-stone-400 hover:text-stone-600"
              aria-label={`移除 ${loc}`}
            >
              ×
            </button>
          )}
        </span>
      ))}
    </div>
  );
}
