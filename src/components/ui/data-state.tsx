export function DataState({ loading, error, onRetry }: { loading: boolean; error: string | null; onRetry: () => void }) {
  if (error) return <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
    <span>{error}</span>
    <button onClick={onRetry} className="rounded-lg border border-red-200 bg-white px-4 py-2 font-semibold hover:bg-red-100">Retry</button>
  </div>;
  if (loading) return <p role="status" className="rounded-xl border border-slate-100 bg-white p-4 text-sm text-slate-500">Loading data…</p>;
  return null;
}
