import Link from "next/link";

export default function ContactsPage() {
  return (
    <main className="min-h-dvh bg-[#F5F7FA] text-neutral-900">
      {/* Header */}
      <header className="border-b border-white/20 bg-white/80 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold text-[#1F3B73]">Все запчасти</Link>
            <nav className="hidden items-center gap-8 md:flex">
              <Link href="/parts" className="text-sm font-medium text-neutral-700 hover:text-[#1F3B73]">Запчасти</Link>
              <Link href="/service" className="text-sm font-medium text-neutral-700 hover:text-[#1F3B73]">Автосервис</Link>
              <Link href="/contacts" className="text-sm font-medium text-[#1F3B73] border-b-2 border-[#1F3B73] pb-1">Контакты</Link>
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
      <section className="relative overflow-hidden bg-gradient-to-br from-[#1F3B73] to-[#14294F] py-16">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-white blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-6xl px-6">
          <h1 className="text-4xl font-bold text-white">Контакты</h1>
          <p className="mt-4 max-w-2xl text-lg text-white/80">
            Приезжайте, звоните или оставляйте заявки онлайн
          </p>
        </div>
      </section>

      {/* Контакты */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-8">
            <div className="rounded-3xl bg-white p-8 shadow-xl">
              <h2 className="text-2xl font-bold text-[#1F3B73]">Как нас найти</h2>
              <div className="mt-6 space-y-6">
                <div className="flex gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FF7A00]/10 text-2xl text-[#FF7A00]">
                    📍
                  </div>
                  <div>
                    <div className="font-medium">Адрес</div>
                    <div className="mt-1 text-neutral-600">г. Красноярск, пр. Металлургов, 2В</div>
                    <div className="mt-2 text-sm text-neutral-500">
                      Вход с торца здания, вывеска &quot;Все запчасти&quot;
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FF7A00]/10 text-2xl text-[#FF7A00]">
                    🕒
                  </div>
                  <div>
                    <div className="font-medium">Режим работы</div>
                    <div className="mt-1 grid grid-cols-2 gap-2 text-neutral-600">
                      <div>Пн–Пт</div>
                      <div>9:00 – 19:00</div>
                      <div>Сб</div>
                      <div>10:00 – 17:00</div>
                      <div>Вс</div>
                      <div>Выходной</div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FF7A00]/10 text-2xl text-[#FF7A00]">
                    📞
                  </div>
                  <div>
                    <div className="font-medium">Телефоны</div>
                    <div className="mt-1 space-y-1">
                      <div>
                        <div className="text-sm text-neutral-500">Отдел запчастей</div>
                        <a href="tel:+73912589500" className="text-lg font-semibold text-[#1F3B73] hover:underline">
                          +7 (391) 258-95-00
                        </a>
                      </div>
                      <div>
                        <div className="text-sm text-neutral-500">Автосервис</div>
                        <a href="tel:+73912589501" className="text-lg font-semibold text-[#1F3B73] hover:underline">
                          +7 (391) 258-95-01
                        </a>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FF7A00]/10 text-2xl text-[#FF7A00]">
                    ✉️
                  </div>
                  <div>
                    <div className="font-medium">Email</div>
                    <a href="mailto:info@vsezapchasti.ru" className="mt-1 text-[#1F3B73] hover:underline">
                      info@vsezapchasti.ru
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl bg-white p-8 shadow-xl">
              <h2 className="text-xl font-bold text-[#1F3B73]">Реквизиты</h2>
              <div className="mt-4 space-y-2 text-sm text-neutral-600">
                <p>ИП Иванов Иван Иванович</p>
                <p>ИНН 246500123456</p>
                <p>ОГРНИП 321246800123456</p>
                <p>Юридический адрес: 660000, г. Красноярск, ул. Ленина, 1</p>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            {/* Карта (заглушка без внешних скриптов) */}
            <div className="h-96 rounded-3xl bg-gradient-to-br from-[#1F3B73]/10 to-[#FF7A00]/10 p-8 shadow-xl">
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <div className="text-6xl mb-4">🗺️</div>
                  <p className="text-neutral-600">Карта проезда</p>
                  <p className="mt-2 text-sm text-neutral-500">
                    г. Красноярск, пр. Металлургов, 2В<br />
                    (Яндекс.Карты / 2GIS — подключение только после решения по провайдеру)
                  </p>
                </div>
              </div>
            </div>

            {/* Форма обратной связи */}
            <div className="rounded-3xl bg-white p-8 shadow-xl">
              <h2 className="text-xl font-bold text-[#1F3B73]">Напишите нам</h2>
              <form className="mt-6 space-y-4">
                <div>
                  <input 
                    type="text" 
                    placeholder="Ваше имя"
                    className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3"
                  />
                </div>
                <div>
                  <input 
                    type="tel" 
                    placeholder="Телефон *"
                    className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3"
                  />
                </div>
                <div>
                  <input 
                    type="email" 
                    placeholder="Email"
                    className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3"
                  />
                </div>
                <div>
                  <textarea 
                    rows={4}
                    placeholder="Сообщение"
                    className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3"
                  />
                </div>
                <div className="flex items-start gap-2">
                  <input type="checkbox" id="consent" className="mt-1" />
                  <label htmlFor="consent" className="text-xs text-neutral-600">
                    Согласен на обработку персональных данных
                  </label>
                </div>
                <button type="submit" className="w-full rounded-2xl bg-[#FF7A00] py-4 font-medium text-white shadow-lg shadow-[#FF7A00]/20">
                  Отправить сообщение
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-200 bg-neutral-50 py-8">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-8 text-sm text-neutral-600 md:grid-cols-3">
            <div>
              <div className="font-semibold text-[#1F3B73]">Все запчасти</div>
              <p className="mt-2 text-xs">
                Оригинальные запчасти и профессиональный автосервис в Красноярске
              </p>
            </div>
            <div>
              <div className="font-semibold">Навигация</div>
              <ul className="mt-2 space-y-1 text-xs">
                <li><Link href="/" className="hover:text-[#1F3B73]">Главная</Link></li>
                <li><Link href="/parts" className="hover:text-[#1F3B73]">Запчасти</Link></li>
                <li><Link href="/service" className="hover:text-[#1F3B73]">Автосервис</Link></li>
                <li><Link href="/contacts" className="hover:text-[#1F3B73]">Контакты</Link></li>
              </ul>
            </div>
            <div>
              <div className="font-semibold">Документы</div>
              <ul className="mt-2 space-y-1 text-xs">
                <li><Link href="/privacy" className="hover:text-[#1F3B73]">Политика конфиденциальности</Link></li>
                <li><Link href="/offer" className="hover:text-[#1F3B73]">Публичная оферта</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 border-t border-neutral-200 pt-8 text-center text-xs text-neutral-500">
            © {new Date().getFullYear()} Все запчасти · Красноярск · NO CDN (self-hosted assets)
          </div>
        </div>
      </footer>
    </main>
  );
}
