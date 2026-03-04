export default function Page() {
  return (
    <main className="min-h-dvh bg-neutral-950 text-neutral-50">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-10 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
              Красноярск · Запчасти · Сервис
            </div>

            <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl">
              Все запчасти и запись на ремонт — в одном месте
            </h1>

            <p className="mt-4 text-base leading-relaxed text-white/70 sm:text-lg">
              Подбор по артикулу/OEM и заявка по VIN. Ремонт легковой и грузовой
              техники — оставьте заявку, менеджер подтвердит детали и время.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="/parts"
                className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-white/40"
              >
                Подобрать запчасть
              </a>

              <a
                href="/service"
                className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/30"
              >
                Записаться на ремонт
              </a>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-sm font-semibold">Запчасти под заказ</div>
                <div className="mt-1 text-sm text-white/60">
                  Быстрый запрос — менеджер перезвонит.
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-sm font-semibold">Легковые и грузовые</div>
                <div className="mt-1 text-sm text-white/60">
                  Подбор и сервис под оба направления.
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-sm font-semibold">Без лишнего</div>
                <div className="mt-1 text-sm text-white/60">
                  Коротко, понятно, с нормальными статусами.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 text-xs text-white/40">
          NO CDN · Все ассеты будут self-hosted.
        </div>
      </div>
    </main>
  );
}
