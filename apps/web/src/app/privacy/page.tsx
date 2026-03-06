import Link from "next/link";
import { getServerApiBaseUrl, withApiBase } from "@/lib/api-base-url";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Политика конфиденциальности | Все запчасти",
  description: "Политика обработки персональных данных сайта «Все запчасти» (152-ФЗ).",
};

async function getPublicContentMap(): Promise<Record<string, string>> {
  try {
    const apiBaseUrl = getServerApiBaseUrl();
    const response = await fetch(withApiBase(apiBaseUrl, "/api/public/content"), { cache: "no-store" });
    if (!response.ok) return {};
    const payload = (await response.json()) as Array<{ key?: string; value?: string | null }>;
    if (!Array.isArray(payload)) return {};

    const map: Record<string, string> = {};
    for (const item of payload) {
      if (item?.key && typeof item.value === "string") {
        map[item.key] = item.value;
      }
    }
    return map;
  } catch {
    return {};
  }
}

export default async function PrivacyPage() {
  const contentMap = await getPublicContentMap();
  const lastUpdated = contentMap.privacy_last_updated?.trim() || "5 марта 2026 г.";
  const contentHtml = contentMap.privacy_content_html?.trim() || "";

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
        <p className="mt-2 text-sm text-neutral-500">Последнее обновление: {lastUpdated}</p>

        {contentHtml ? (
          <div className="mt-8 space-y-4 text-neutral-700" dangerouslySetInnerHTML={{ __html: contentHtml }} />
        ) : (
          <div className="mt-8 space-y-6 text-neutral-700">
          <div>
            <h2 className="text-xl font-semibold text-[#1F3B73]">1. Оператор персональных данных</h2>
            <p className="mt-2">
              Оператор: ИП Иванов Иван Иванович (ИНН 246500123456, ОГРНИП 321246800123456), сайт: vsezapchasti.ru.
              Политика действует в соответствии с Федеральным законом от 27.07.2006 №152-ФЗ «О персональных данных».
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-[#1F3B73]">2. Какие данные мы обрабатываем</h2>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>Контактные данные: имя, телефон, email (если указан)</li>
              <li>Данные заявки: VIN, сообщение, тип обращения, марка/модель/год, описание работ</li>
              <li>Служебные данные: IP-адрес, User-Agent, дата и время отправки формы</li>
              <li>Данные согласия: факт согласия, версия текста согласия, дата/время согласия</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-[#1F3B73]">3. Цели обработки</h2>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>Обработка заявок на подбор запчастей, VIN-подбор и обратный звонок</li>
              <li>Запись и сопровождение заявки на сервисные работы</li>
              <li>Связь с пользователем по статусу обращения</li>
              <li>Ведение журнала согласий и событий для выполнения требований 152-ФЗ</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-[#1F3B73]">4. Правовые основания обработки</h2>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>Согласие субъекта персональных данных (ч. 1 ст. 6, ст. 9 152-ФЗ)</li>
              <li>Необходимость обработки для заключения и исполнения договора по обращению пользователя (п. 5 ч. 1 ст. 6 152-ФЗ)</li>
              <li>Исполнение обязанностей оператора, установленных законодательством РФ</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-[#1F3B73]">5. Хранение и безопасность</h2>
            <p className="mt-2">
              Персональные данные хранятся в информационных системах на территории Российской Федерации.
              Срок хранения: до достижения целей обработки, но не более 36 месяцев с даты последнего обращения,
              если иной срок не предусмотрен законом или договором. По истечении срока данные удаляются или обезличиваются.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-[#1F3B73]">6. Передача третьим лицам</h2>
            <p className="mt-2">
              Передача персональных данных третьим лицам осуществляется только при наличии законных оснований:
              исполнение требований законодательства РФ, участие подрядчика в обработке по поручению оператора,
              либо по отдельному согласию пользователя.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-[#1F3B73]">7. Права субъекта персональных данных</h2>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>Получать сведения об обработке своих персональных данных</li>
              <li>Требовать уточнения, блокирования или уничтожения данных</li>
              <li>Отозвать согласие на обработку персональных данных</li>
              <li>Обжаловать действия оператора в уполномоченный орган или в суд</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-[#1F3B73]">8. Отзыв согласия и обращения</h2>
            <p className="mt-2">
              Для отзыва согласия или реализации прав субъекта направьте запрос на privacy@vsezapchasti.ru.
              В запросе укажите ФИО, контактный номер и описание требования. Срок ответа — до 30 календарных дней.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-[#1F3B73]">9. Контактная информация оператора</h2>
            <p className="mt-2">
              По вопросам обработки персональных данных:
              <br />Email: privacy@vsezapchasti.ru
              <br />Тел.: +7 (391) 258-95-00
              <br />Адрес: 660000, г. Красноярск, ул. Ленина, 1
            </p>
          </div>
        </div>
        )}
      </section>

      <footer className="border-t border-neutral-200 bg-neutral-50 py-8">
        <div className="mx-auto max-w-6xl px-6 text-center text-sm text-neutral-600">
          © {new Date().getFullYear()} Все запчасти · Красноярск · NO CDN
        </div>
      </footer>
    </main>
  );
}
