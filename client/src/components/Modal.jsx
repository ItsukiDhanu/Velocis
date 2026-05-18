export default function Modal({ open, title, children, onClose, actions }) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 p-6 backdrop-blur-sm">
      <div className="panel w-full max-w-lg p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-snow">{title}</h2>
          <button className="text-mist hover:text-snow" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="mt-4 space-y-4 text-sm text-mist">{children}</div>
        <div className="mt-6 flex justify-end gap-3">{actions}</div>
      </div>
    </div>
  );
}
