import Link from "next/link";
import { getServerApiBaseUrl, withApiBase } from "@/lib/api-base-url";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Публичная оферта | Все запчасти",
  description: "Публичная оферта сервиса «Все запчасти» для заказа товаров и услуг.",
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

export default async function OfferPage() {
  const contentMap = await getPublicContentMap();
  const lastUpdated = contentMap.offer_last_updated?.trim() || "5 марта 2026 г.";
  const contentHtml = contentMap.offer_content_html?.trim() || "";

  return (
    <main className="min-h-dvh bg-[#F5F7FA] text-neutral-900">
      {/* Header */}
      <header className="border-b border-white/20 bg-white/80 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/" className="text-2xl font-bold text-[#1F3B73]">Все запчасти</Link>
            <nav className="hidden items-center gap-8 md:flex">
              <Link href="/parts" className="text-sm font-medium text-neutral-700 hover:text-[#1F3B73]">Запчасти</Link>
              <Link href="/service" className="text-sm font-medium text-neutral-700 hover:text-[#1F3B73]">Автосервис</Link>
              <Link href="/contacts" className="text-sm font-medium text-neutral-700 hover:text-[#1F3B73]">Контакты</Link>
            </nav>
          </div>
          <nav className="mt-3 flex items-center gap-4 overflow-x-auto pb-1 text-sm md:hidden">
            <Link href="/parts" className="shrink-0 font-medium text-neutral-700 hover:text-[#1F3B73]">Запчасти</Link>
            <Link href="/service" className="shrink-0 font-medium text-neutral-700 hover:text-[#1F3B73]">Автосервис</Link>
            <Link href="/contacts" className="shrink-0 font-medium text-neutral-700 hover:text-[#1F3B73]">Контакты</Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <h1 className="text-2xl font-bold text-[#1F3B73] sm:text-3xl">Публичная оферта</h1>
        <p className="mt-2 text-sm text-neutral-500">Последнее обновление: {lastUpdated}</p>

        {contentHtml ? (
          <div className="mt-8 space-y-4 text-neutral-700" dangerouslySetInnerHTML={{ __html: contentHtml }} />
        ) : (
          <div className="mt-8 space-y-6 text-neutral-700">
          <div>
            <h2 className="text-xl font-semibold text-[#1F3B73]">1. Термины и определения</h2>
            <p className="mt-2">
              1.1. Продавец — ИП Иванов Иван Иванович, осуществляющий продажу товаров и услуг через сайт vsezapchasti.ru.
              <br />1.2. Покупатель — физическое или юридическое лицо, оформившее заявку на Сайте.
              <br />1.3. Товар — автозапчасти, представленные в каталоге Сайта.
              <br />1.4. Услуга — сервисное обслуживание автомобилей.
              <br />1.5. Настоящий документ является публичной офертой в смысле ст. 435 и п. 2 ст. 437 ГК РФ.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-[#1F3B73]">2. Предмет договора</h2>
            <p className="mt-2">
              2.1. Продавец обязуется передать в собственность Покупателя Товар и/или оказать Услуги, 
              а Покупатель обязуется принять и оплатить Товар/Услуги на условиях настоящей Оферты.
              <br />2.2. Информация на сайте носит справочный характер и не является безусловной гарантией наличия Товара до подтверждения менеджером.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-[#1F3B73]">3. Порядок оформления заявки</h2>
            <p className="mt-2">
              3.1. Заявка на Товар/Услугу оформляется Покупателем через формы на Сайте.
              <br />3.2. После получения заявки менеджер Продавца связывается с Покупателем для уточнения деталей.
              <br />3.3. Акцептом оферты считается подтверждение заказа Покупателем после согласования условий с менеджером Продавца.
              <br />3.4. Договор считается заключенным с момента подтверждения заявки менеджером Продавца.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-[#1F3B73]">4. Цена и порядок оплаты</h2>
            <p className="mt-2">
              4.1. Цена Товара/Услуги указывается в каталоге или согласовывается с менеджером.
              <br />4.2. Оплата производится наличными или безналичным переводом после подтверждения заказа.
              <br />4.3. Продавец вправе изменять цены до момента подтверждения заказа.
              <br />4.4. Стоимость доставки и дополнительных услуг согласовывается отдельно.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-[#1F3B73]">5. Доставка</h2>
            <p className="mt-2">
              5.1. Доставка Товара осуществляется самовывозом или транспортными компаниями.
              <br />5.2. Стоимость и сроки доставки согласовываются с менеджером индивидуально.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-[#1F3B73]">6. Возврат товара</h2>
            <p className="mt-2">
              6.1. Покупатель вправе отказаться от Товара до момента его передачи.
              <br />6.2. При дистанционном способе продажи возврат Товара надлежащего качества возможен в сроки, установленные ст. 26.1 Закона РФ «О защите прав потребителей», при сохранении товарного вида и потребительских свойств.
              <br />6.3. Возврат Товара ненадлежащего качества осуществляется в соответствии с Законом РФ «О защите прав потребителей».
              <br />6.4. Для возврата необходим документ, подтверждающий покупку, и заявление в свободной форме.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-[#1F3B73]">7. Гарантии</h2>
            <p className="mt-2">
              7.1. На Товары предоставляется гарантия производителя либо Продавца в зависимости от типа Товара.
              <br />7.2. Гарантийный срок и условия гарантии указываются в товарных документах и/или заказ-наряде.
              <br />7.3. На выполненные работы по ремонту предоставляется гарантия 30 дней, если иной срок не указан в заказ-наряде.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-[#1F3B73]">8. Ответственность сторон</h2>
            <p className="mt-2">
              8.1. За неисполнение или ненадлежащее исполнение обязательств стороны несут ответственность в соответствии с законодательством РФ.
              <br />8.2. Продавец не несет ответственности за убытки, возникшие вследствие неправильного использования Товара.
              <br />8.3. Споры разрешаются в претензионном порядке; срок ответа на претензию — до 10 рабочих дней.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-[#1F3B73]">9. Реквизиты Продавца</h2>
            <div className="mt-2 p-4 bg-neutral-50 rounded-2xl">
              <p>ИП Иванов Иван Иванович</p>
              <p>ИНН 246500123456</p>
              <p>ОГРНИП 321246800123456</p>
              <p>Расчетный счет: 40802810900001234567</p>
              <p>Банк: ПАО Сбербанк г. Красноярск</p>
              <p>БИК: 040407123</p>
              <p>Корр. счет: 30101810600000000123</p>
              <p>Email: info@vsezapchasti.ru</p>
              <p>Тел.: +7 (391) 258-95-00</p>
              <p>Адрес: 660000, г. Красноярск, ул. Ленина, 1</p>
            </div>
          </div>
        </div>
        )}
      </section>

      <footer className="border-t border-neutral-200 bg-neutral-50 py-8">
        <div className="mx-auto max-w-6xl px-4 text-center text-sm text-neutral-600 sm:px-6">
          © {new Date().getFullYear()} Все запчасти · Красноярск · NO CDN
        </div>
      </footer>
    </main>
  );
}
