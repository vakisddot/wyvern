export function InlineConfirm({ message, onConfirm, onCancel }: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-amber-400">{message}</span>
      <button className="text-red-400 hover:text-red-300 transition-colors" onClick={onConfirm}>[Confirm]</button>
      <button className="text-gray-500 hover:text-gray-300 transition-colors" onClick={onCancel}>[Cancel]</button>
    </div>
  );
}
