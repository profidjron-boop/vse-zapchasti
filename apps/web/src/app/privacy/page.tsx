import Link from "next/link";

export default function PrivacyPage() {
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
              <Link href="/contacts" className="text-sm font-medium text-neutral-700 hover:text-[#1F3B73]">Контакты</Link>
            </nav>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="text-3xl font-bold text-[#1F3B73]">Политика конфиденциальности</h1>
        <p className="mt-2 text-sm text-neutral-500">Последнее обновление: 4 марта 2026 г.</p>
        
        <div className="mt-8 space-y-6 text-neutral-700">
          <div>
            <h2 className="text-xl font-semibold text-[#1F3B73]">1. Общие положения</h2>
            <p className="mt-2">
              Настоящая политика обработки персональных данных составлена в соответствии с требованиями 
              Федерального закона от 27.07.2006. №152-ФЗ «О персональных данных» и определяет порядок обработки 
              персональных данных и меры по обеспечению безопасности персональных данных, предпринимаемые ИП Иванов И.И.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-[#1F3B73]">2. Какие данные мы собираем</h2>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>ФИО (при указании)</li>
              <li>Контактный телефон</li>
              <li>Адрес электронной почты</li>
              <li>VIN-номер автомобиля</li>
              <li>Данные об автомобиле (марка, модель, год)</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-[#1F3B73]">3. Цели обработки данных</h2>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>Обработка заявок на подбор запчастей</li>
              <li>Запись на сервисное обслуживание</li>
              <li>Консультирование по услугам</li>
              <li>Обратная связь по заявкам</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-[#1F3B73]">4. Правовые основания обработки</h2>
            <p className="mt-2">
              Обработка персональных данных осуществляется на основе согласия пользователя, 
              предоставляемого при заполнении форм на сайте.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-[#1F3B73]">5. Хранение данных</h2>
            <p className="mt-2">
              Все персональные данные хранятся на серверах, расположенных на территории Российской Федерации. 
              Срок хранения — до достижения целей обработки или отзыва согласия пользователем.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-[#1F3B73]">6. Передача данных третьим лицам</h2>
            <p className="mt-2">
              Передача персональных данных третьим лицам не осуществляется, за исключением случаев, 
              предусмотренных законодательством РФ.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-[#1F3B73]">7. Права пользователей</h2>
            <p className="mt-2">
              Пользователь имеет право на получение информации, касающейся обработки его персональных данных, 
              а также требовать их уточнения, блокирования или уничтожения.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-[#1F3B73]">8. Контактная информация</h2>
            <p className="mt-2">
              По всем вопросам, связанным с обработкой персональных данных, можно обращаться по адресу:
              <br />Email: privacy@vsezapchasti.ru
              <br />Тел.: +7 (391) 258-95-00
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-neutral-200 bg-neutral-50 py-8">
        <div className="mx-auto max-w-6xl px-6 text-center text-sm text-neutral-600">
          © {new Date().getFullYear()} Все запчасти · Красноярск · NO CDN
        </div>
      </footer>
    </main>
  );
}
