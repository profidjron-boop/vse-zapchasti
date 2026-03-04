import Link from "next/link";

export default function VinRequestPage() {
  return (
    <main className="min-h-dvh bg-[#F5F7FA] text-neutral-900">
      {/* Header */}
      <header className="border-b border-white/20 bg-white/80 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold text-[#1F3B73]">Все запчасти</Link>
            <nav className="hidden items-center gap-8 md:flex">
              <Link href="/parts" className="text-sm font-medium text-[#1F3B73] border-b-2 border-[#1F3B73] pb-1">Запчасти</Link>
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
      <section className="relative overflow-hidden bg-gradient-to-br from-[#1F3B73] to-[#14294F] py-16">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-white blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-6xl px-6">
          <h1 className="text-4xl font-bold text-white">VIN-заявка</h1>
          <p className="mt-4 max-w-2xl text-lg text-white/80">
            Не знаете точный артикул? Оставьте VIN — мы подберём запчасти по вашему автомобилю
          </p>
        </div>
      </section>

      {/* Форма VIN-заявки */}
      <section className="mx-auto max-w-3xl px-6 py-16">
        <div className="rounded-3xl bg-white p-8 shadow-xl">
          <form className="space-y-6">
            <div>
              <label className="text-sm font-medium text-neutral-700">VIN-номер *</label>
              <input 
                type="text" 
                placeholder="Например: XTA210930Y1234567" 
                className="mt-1 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 font-mono text-sm"
              />
              <p className="mt-1 text-xs text-neutral-500">VIN обычно состоит из 17 символов</p>
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700">Ваше имя</label>
              <input type="text" className="mt-1 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3" />
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700">Телефон *</label>
              <input type="tel" placeholder="+7 (___) ___-__-__" className="mt-1 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3" />
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700">Email</label>
              <input type="email" className="mt-1 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3" />
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700">Что нужно найти?</label>
              <textarea 
                rows={4} 
                placeholder="Опишите деталь, которую ищете, или укажите дополнительные пожелания"
                className="mt-1 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3"
              />
            </div>

            <div className="flex items-start gap-2">
              <input type="checkbox" id="consent" className="mt-1" />
              <label htmlFor="consent" className="text-xs text-neutral-600">
                Согласен на обработку персональных данных в соответствии с политикой конфиденциальности
              </label>
            </div>

            <div className="flex gap-4">
              <button type="submit" className="flex-1 rounded-2xl bg-[#FF7A00] py-4 font-medium text-white shadow-lg shadow-[#FF7A00]/20">
                Отправить заявку
              </button>
              <Link 
                href="/parts" 
                className="flex-1 rounded-2xl border-2 border-neutral-200 py-4 text-center font-medium text-neutral-600 transition hover:bg-neutral-50"
              >
                Вернуться к поиску
              </Link>
            </div>
          </form>

          <div className="mt-8 rounded-2xl bg-[#1F3B73]/5 p-4">
            <h3 className="font-medium text-[#1F3B73]">Как мы обрабатываем VIN-заявки?</h3>
            <ul className="mt-2 space-y-2 text-sm text-neutral-600">
              <li>• Менеджер получает заявку в рабочее время</li>
              <li>• Проверяет совместимость по VIN в каталогах</li>
              <li>• Связывается с вами для уточнения деталей</li>
              <li>• Предлагает варианты и сроки поставки</li>
            </ul>
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
