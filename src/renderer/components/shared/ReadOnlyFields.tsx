function formatLabel(key: string): string {
  return key.replace(/_/g, ' ');
}

function renderValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number' || typeof value === 'string') return String(value);
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).map(([k, v]) => `${formatLabel(k)}: ${v}`).join('\n');
  }
  return '';
}

export function ReadOnlyFields({ entries }: { entries: [string, unknown][] }) {
  return (
    <>
      {entries.map(([key, value]) => (
        <div key={key} className="flex flex-col gap-1">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">{formatLabel(key)}</span>
          <span className="text-xs text-gray-300 whitespace-pre-wrap">{renderValue(value)}</span>
        </div>
      ))}
    </>
  );
}
