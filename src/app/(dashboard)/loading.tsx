export default function Loading() {
  return <div className="mx-auto max-w-[1400px] space-y-6" role="status" aria-label="Loading page">
    <p className="text-sm text-slate-500">Loading page…</p>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-hidden="true">
      {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-28 animate-pulse rounded-2xl bg-slate-200/60 motion-reduce:animate-none" />)}
    </div>
    <div className="h-80 animate-pulse rounded-2xl bg-slate-200/60 motion-reduce:animate-none" aria-hidden="true" />
  </div>;
}
