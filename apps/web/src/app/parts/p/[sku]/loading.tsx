export default function ProductPageLoading() {
  return (
    <main className="min-h-dvh bg-[#F5F7FA] px-6 py-12">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 h-5 w-40 animate-pulse rounded bg-neutral-200" />
        <div className="rounded-3xl bg-white p-6 shadow-lg">
          <div className="grid gap-6 md:grid-cols-[280px_1fr]">
            <div className="min-h-[260px] animate-pulse rounded-2xl bg-neutral-200" />
            <div className="space-y-3">
              <div className="h-7 w-3/4 animate-pulse rounded bg-neutral-200" />
              <div className="h-5 w-full animate-pulse rounded bg-neutral-200" />
              <div className="h-5 w-5/6 animate-pulse rounded bg-neutral-200" />
              <div className="h-10 w-40 animate-pulse rounded bg-neutral-200" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
