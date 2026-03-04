import Link from "next/link";

export default function ServicePage() {
  return (
    <main className="min-h-dvh bg-[#F5F7FA] text-neutral-900">
      {/* Header (такой же как на главной) */}
      <header className="border-b border-white/20 bg-white/80 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold text-[#1F3B73]">Все запчасти</Link>
            <nav className="hidden items-center gap-8 md:flex">
              <Link href="/parts" className="text-sm font-medium text-neutral-700 hover:text-[#1F3B73]">Запчасти</Link>
              <Link href="/service" className="text-sm font-medium text-[#1F3B73] border-b-2 border-[#1F3B73] pb-1">Автосервис</Link>
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
          <h1 className="text-4xl font-bold text-white">Автосервис в Красноярске</h1>
          <p className="mt-4 max-w-2xl text-lg text-white/80">
            Профессиональный ремонт и обслуживание легковых и грузовых автомобилей
          </p>
        </div>
      </section>

      {/* Переключатель легковые/грузовые */}
      <section className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex gap-4 rounded-2xl bg-white p-2 shadow-sm">
          <button className="flex-1 rounded-xl bg-[#1F3B73] py-3 font-medium text-white">
            Легковые
          </button>
          <button className="flex-1 rounded-xl py-3 font-medium text-neutral-600 hover:bg-neutral-100">
            Грузовые
          </button>
        </div>
      </section>

      {/* Виды работ */}
      <section className="mx-auto max-w-6xl px-6 py-8">
        <h2 className="text-2xl font-bold text-[#1F3B73]">Направления работ</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: "Диагностика и ТО",
              desc: "Полная диагностика, плановое ТО, замена жидкостей",
              icon: "🔧"
            },
            {
              title: "Ремонт двигателя",
              desc: "Капитальный ремонт, замена ГРМ, диагностика",
              icon: "⚙️"
            },
            {
              title: "Ремонт КПП",
              desc: "Автомат, механика, вариатор — любой сложности",
              icon: "🔄"
            },
            {
              title: "Ходовая часть",
              desc: "Замена амортизаторов, рычагов, сайлентблоков",
              icon: "🛞"
            },
            {
              title: "Автоэлектрика",
              desc: "Диагностика электрики, ремонт генератора, стартера",
              icon: "⚡"
            },
            {
              title: "Шиномонтаж",
              desc: "Сезонная замена, балансировка, ремонт проколов",
              icon: "🔩"
            }
          ].map((work) => (
            <div key={work.title} className="rounded-2xl border border-neutral-200 bg-white p-6 transition hover:shadow-lg">
              <div className="text-4xl">{work.icon}</div>
              <h3 className="mt-4 text-lg font-semibold text-[#1F3B73]">{work.title}</h3>
              <p className="mt-2 text-sm text-neutral-600">{work.desc}</p>
              <button className="mt-4 text-sm font-medium text-[#FF7A00] hover:underline">
                Подробнее →
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Форма заявки */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="text-center text-2xl font-bold text-[#1F3B73]">Заявка на обслуживание</h2>
          <p className="mt-2 text-center text-neutral-600">
            Заполните форму — менеджер свяжется с вами для подтверждения
          </p>
          
          <form className="mt-8 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-neutral-700">Вид работ *</label>
                <select className="mt-1 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                  <option>Выберите направление</option>
                  <option>Диагностика и ТО</option>
                  <option>Ремонт двигателя</option>
                  <option>Ремонт КПП</option>
                  <option>Ходовая часть</option>
                  <option>Автоэлектрика</option>
                  <option>Шиномонтаж</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-700">Тип авто *</label>
                <select className="mt-1 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                  <option>Легковой</option>
                  <option>Грузовой</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700">Ваше имя *</label>
              <input type="text" className="mt-1 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3" />
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700">Телефон *</label>
              <input type="tel" className="mt-1 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3" />
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700">Марка и модель авто</label>
              <input type="text" placeholder="Например: Volvo FH" className="mt-1 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3" />
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700">VIN (если есть)</label>
              <input type="text" className="mt-1 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3" />
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700">Желаемая дата</label>
              <input type="date" className="mt-1 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3" />
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700">Причина обращения</label>
              <textarea rows={3} className="mt-1 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3" />
            </div>

            <div className="flex items-start gap-2">
              <input type="checkbox" id="consent" className="mt-1" />
              <label htmlFor="consent" className="text-xs text-neutral-600">
                Согласен на обработку персональных данных в соответствии с политикой конфиденциальности
              </label>
            </div>

            <button type="submit" className="w-full rounded-2xl bg-[#FF7A00] py-4 font-medium text-white shadow-lg shadow-[#FF7A00]/20">
              Отправить заявку
            </button>
          </form>
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
