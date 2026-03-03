import { useState } from 'react';

export function YamlEditor({ content, saving, error, onSave, onCancel }: {
  content: string;
  saving: boolean;
  error: string | null;
  onSave: (content: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(content);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <textarea
        className="flex-1 bg-gray-950 border border-gray-700 text-xs text-gray-300 p-2 resize-none focus:outline-none focus:border-gray-500 font-mono"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        spellCheck={false}
      />
      {error && (
        <p className="text-xs text-red-400 px-1 py-1 break-words">{error}</p>
      )}
      <div className="flex gap-3 pt-2">
        <button
          className="text-xs text-gray-300 hover:text-white transition-colors disabled:text-gray-600"
          onClick={() => onSave(value)}
          disabled={saving}
        >{saving ? '[Saving...]' : '[Save]'}</button>
        <button
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          onClick={onCancel}
          disabled={saving}
        >[Cancel]</button>
      </div>
    </div>
  );
}
