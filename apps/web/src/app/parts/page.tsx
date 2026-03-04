import Link from "next/link";

export default function PartsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const qRaw = searchParams?.q;
  const q = Array.isArray(qRaw) ? qRaw[0] : qRaw;
  const query = (q ?? "").trim();

  return (
    <main className="min-h-dvh bg-neutral-950 text-neutral-50">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
            Запчасти · Поиск · Подбор
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Подбор запчастей
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/70 sm:text-base">
            Ищите по артикулу/OEM или названию. Если не уверены — оставьте VIN-заявку,
            менеджер подберёт совместимость.
          </p>
        </div>

        <form
          action="/parts"
          method="get"
          className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]"
        >
          <label className="block text-sm font-semibold text-white/90">
            Поиск по артикулу или OEM
          </label>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              name="q"
              defaultValue={query}
              placeholder="Например: 06A905161B"
              className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white placeholder:text-white/35 outline-none ring-0 focus:border-white/20 focus:bg-black/40"
            />
            <button
              type="submit"
              className="h-12 shrink-0 rounded-2xl bg-white px-5 text-sm font-semibold text-neutral-950 transition hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-white/40"
            >
              Найти
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link
              href="/parts/vin"
              className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/30"
            >
              Оставить VIN-заявку
            </Link>
            <div className="text-xs text-white/50">
              Красноярск · Ответ менеджера в рабочее время
            </div>
          </div>
        </form>

        <div className="mt-8 rounded-3xl border border-white/10 bg-black/20 p-6">
          {query === "" ? (
            <>
              <div className="text-sm font-semibold">Начните с поиска</div>
              <div className="mt-1 text-sm text-white/60">
                Введите артикул/OEM или название — покажем результаты.
              </div>
            </>
          ) : (
            <>
              <div className="text-sm font-semibold">Результаты</div>
              <div className="mt-1 text-sm text-white/60">
                По запросу <span className="text-white/80">“{query}”</span> пока нет
                данных в витрине. Оставьте VIN-заявку или запрос менеджеру.
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href="/parts/vin"
                  className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-neutral-950 transition hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-white/40"
                >
                  Оставить VIN-заявку
                </Link>
                <Link
                  href="/"
                  className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/30"
                >
                  На главную
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
