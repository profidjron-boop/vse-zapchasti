import Link from "next/link";

export default function Page() {
  return (
    <main className="min-h-dvh bg-[#F5F7FA] text-neutral-900">
      {/* Header */}
      <header className="border-b border-white/20 bg-white/80 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold text-[#1F3B73]">Все запчасти</div>
            <nav className="hidden items-center gap-8 md:flex">
              <Link href="/parts" className="text-sm font-medium text-neutral-700 hover:text-[#1F3B73]">Запчасти</Link>
              <Link href="/service" className="text-sm font-medium text-neutral-700 hover:text-[#1F3B73]">Автосервис</Link>
              <Link href="/contacts" className="text-sm font-medium text-neutral-700 hover:text-[#1F3B73]">Контакты</Link>
            </nav>
            <div className="flex items-center gap-3">
              <button className="rounded-2xl border border-[#1F3B73]/20 bg-white px-4 py-2 text-sm font-medium text-[#1F3B73]">
                Для дилеров
              </button>
              <button className="rounded-2xl bg-[#FF7A00] px-4 py-2 text-sm font-medium text-white shadow-lg shadow-[#FF7A00]/20">
                Заказать звонок
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#1F3B73] to-[#14294F] py-20">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-white blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-6xl px-6">
          <div className="max-w-2xl">
            <h1 className="text-4xl font-bold text-white sm:text-5xl">
              Все запчасти и автосервис<br />в одном месте
            </h1>
            <p className="mt-4 text-lg text-white/80">
              Оригинальные запчасти и профессиональный ремонт легковых и грузовых автомобилей в Красноярске
            </p>
            <div className="mt-8 flex gap-4">
              <Link
                href="/parts"
                className="rounded-2xl bg-white px-6 py-3 font-medium text-[#1F3B73] shadow-lg transition hover:bg-white/90"
              >
                Подобрать запчасти
              </Link>
              <Link
                href="/service"
                className="rounded-2xl border border-white/30 bg-white/10 px-6 py-3 font-medium text-white backdrop-blur-sm transition hover:bg-white/20"
              >
                Записаться на сервис
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Две дороги - ключевой блок */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Левая карточка - Запчасти */}
          <div className="rounded-3xl bg-white p-8 shadow-xl">
            <div className="flex items-start justify-between">
              <h2 className="text-2xl font-bold text-[#1F3B73]">Подбор запчастей</h2>
              <span className="rounded-full bg-[#1F3B73]/10 px-3 py-1 text-xs font-medium text-[#1F3B73]">
                Артикул / OEM
              </span>
            </div>
            <div className="mt-6 h-40 rounded-2xl bg-gradient-to-br from-[#1F3B73]/5 to-[#FF7A00]/5" />
            <div className="mt-6">
              <label className="text-sm font-medium text-neutral-700">Поиск по артикулу или OEM</label>
              <div className="mt-2 flex gap-3">
                <input
                  type="text"
                  placeholder="Например: 06A905161B"
                  className="flex-1 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm focus:border-[#1F3B73] focus:outline-none"
                />
                <button className="rounded-2xl bg-[#1F3B73] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#14294F]">
                  Найти
                </button>
              </div>
              <Link href="/parts/vin" className="mt-4 inline-block text-sm font-medium text-[#FF7A00] hover:underline">
                Оставить VIN-заявку →
              </Link>
            </div>
          </div>

          {/* Правая карточка - Сервис */}
          <div className="rounded-3xl bg-white p-8 shadow-xl">
            <div className="flex items-start justify-between">
              <h2 className="text-2xl font-bold text-[#1F3B73]">Автосервис</h2>
              <div className="flex gap-2">
                <span className="rounded-full bg-[#1F3B73]/10 px-3 py-1 text-xs font-medium text-[#1F3B73]">
                  Легковые
                </span>
                <span className="rounded-full bg-[#FF7A00]/10 px-3 py-1 text-xs font-medium text-[#FF7A00]">
                  Грузовые
                </span>
              </div>
            </div>
            <div className="mt-6 space-y-4">
              {[
                "Диагностика и ТО",
                "Ремонт и обслуживание",
                "Шиномонтаж и автоэлектрика",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-[#FF7A00]" />
                  <span className="text-neutral-700">{item}</span>
                </div>
              ))}
            </div>
            <div className="mt-8">
              <button className="rounded-2xl border-2 border-[#FF7A00] px-6 py-3 font-medium text-[#FF7A00] transition hover:bg-[#FF7A00] hover:text-white">
                Записаться
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Категории запчастей */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-2xl font-bold text-[#1F3B73]">Категории запчастей</h2>
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {[
            "Диагностика",
            "ТО",
            "Ремонт двигателя",
            "Ремонт КПП",
            "Ходовая часть",
            "Автоэлектрика",
          ].map((cat) => (
            <div key={cat} className="rounded-2xl border border-neutral-200 bg-white p-4 text-center transition hover:shadow-md">
              <div className="mx-auto h-12 w-12 rounded-xl bg-[#1F3B73]/10" />
              <div className="mt-3 text-sm font-medium text-neutral-700">{cat}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Виды работ */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="h-80 rounded-3xl bg-gradient-to-br from-[#1F3B73]/10 to-[#FF7A00]/10" />
            <div>
              <h2 className="text-2xl font-bold text-[#1F3B73]">Виды работ</h2>
              <div className="mt-6 space-y-4">
                {[
                  "Диагностика и ТО",
                  "Ремонт и обслуживание",
                  "Шиномонтаж и автоэлектрика",
                ].map((work) => (
                  <div key={work} className="flex items-center justify-between rounded-2xl border border-neutral-200 p-4">
                    <span className="font-medium text-neutral-700">{work}</span>
                    <span className="text-[#FF7A00]">→</span>
                  </div>
                ))}
              </div>
              <button className="mt-8 rounded-2xl bg-[#FF7A00] px-8 py-3 font-medium text-white shadow-lg shadow-[#FF7A00]/20">
                Оставить заявку
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Запчасти под заказ */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="rounded-3xl bg-gradient-to-r from-[#1F3B73] to-[#14294F] p-8 text-white lg:p-12">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="text-2xl font-bold">Не нашли нужную запчасть?</h2>
              <p className="mt-2 text-white/80">
                Закажите обратный звонок — мы подберём и привезём
              </p>
              <button className="mt-6 rounded-2xl bg-[#FF7A00] px-8 py-3 font-medium text-white shadow-lg shadow-black/20">
                Оставьте заявку
              </button>
            </div>
            <div className="h-48 rounded-2xl bg-white/10" />
          </div>
        </div>
      </section>

      {/* Контакты */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <h2 className="text-2xl font-bold text-[#1F3B73]">Контакты</h2>
              <div className="mt-6 space-y-4">
                <div className="flex items-start gap-3">
                  <span className="text-[#FF7A00]">📍</span>
                  <div>
                    <div className="font-medium">Адрес</div>
                    <div className="text-neutral-600">г. Красноярск, пр. Металлургов, 2В</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-[#FF7A00]">🕒</span>
                  <div>
                    <div className="font-medium">Время работы</div>
                    <div className="text-neutral-600">Пн–Пт 9:00–19:00, Сб 10:00–17:00, Вс выходной</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-[#FF7A00]">📞</span>
                  <div>
                    <div className="font-medium">Телефон</div>
                    <div className="text-neutral-600">+7 (391) 258-95-00</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="h-64 rounded-3xl bg-neutral-200" />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-200 bg-neutral-50 py-8">
        <div className="mx-auto max-w-6xl px-6 text-center text-sm text-neutral-600">
          © {new Date().getFullYear()} Все запчасти · Красноярск · NO CDN (self-hosted assets)
        </div>
      </footer>
    </main>
  );
}
