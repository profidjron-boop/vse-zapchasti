export default function PartsLoading() {
  return (
    <main className="min-h-dvh bg-[#F5F7FA] px-6 py-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 h-8 w-64 animate-pulse rounded bg-neutral-200" />
        <div className="mb-8 h-28 animate-pulse rounded-3xl bg-white" />
        <div className="space-y-3 rounded-3xl bg-white p-6">
          <div className="h-5 w-40 animate-pulse rounded bg-neutral-200" />
          <div className="h-5 w-full animate-pulse rounded bg-neutral-200" />
          <div className="h-5 w-5/6 animate-pulse rounded bg-neutral-200" />
        </div>
      </div>
    </main>
  );
}
