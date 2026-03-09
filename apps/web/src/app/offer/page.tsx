import type { Metadata } from "next";
import { getServerApiBaseUrl, withApiBase } from "@/lib/api-base-url";
import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";

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
  const contentValue = (key: string, fallback: string): string => {
    const value = contentMap[key];
    return value && value.trim() ? value : fallback;
  };

  const brandName = contentValue("site_brand_name", "Все запчасти");
  const navParts = contentValue("site_nav_parts_label", "Запчасти");
  const navService = contentValue("site_nav_service_label", "Автосервис");
  const navContacts = contentValue("site_nav_contacts_label", "Контакты");
  const navAbout = contentValue("site_nav_about_label", "О компании");
  const navFavorites = contentValue("site_nav_favorites_label", "Избранное");
  const navCart = contentValue("site_nav_cart_label", "Корзина");
  const navOrders = contentValue("site_nav_orders_label", "Мои заказы");
  const navDealer = contentValue("site_nav_dealer_label", "Для дилеров");
  const navCallback = contentValue("site_nav_callback_label", "Заказать звонок");
  const footerText = contentValue("site_footer_text", "Все запчасти · Красноярск · NO CDN");
  const lastUpdated = contentMap.offer_last_updated?.trim() || "5 марта 2026 г.";
  const contentHtml = contentMap.offer_content_html?.trim() || "";

  return (
    <main className="min-h-dvh bg-[#F3F5F8] text-neutral-900">
      <PublicHeader
        brandName={brandName}
        labels={{
          parts: navParts,
          service: navService,
          contacts: navContacts,
          about: navAbout,
          favorites: navFavorites,
          cart: navCart,
          orders: navOrders,
          dealer: navDealer,
          callback: navCallback,
        }}
      />

      <section className="border-b border-neutral-200 bg-[linear-gradient(180deg,#f8fafc_0%,#eef3fb_100%)]">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.95fr)] lg:py-14">
          <div className="rounded-[2rem] bg-[linear-gradient(135deg,#1F3B73_0%,#17315E_65%,#10264B_100%)] p-8 text-white shadow-[0_30px_80px_rgba(31,59,115,0.18)]">
            <div className="inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
              legal · offer · commerce
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">Публичная оферта</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/78 sm:text-lg">
              Правила оформления заявок, согласования заказа, оплаты, доставки, возврата и взаимодействия с продавцом.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <div className="rounded-2xl border border-white/10 bg-white/8 px-5 py-3 text-sm font-medium text-white/80">
                Последнее обновление: {lastUpdated}
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/8 px-5 py-3 text-sm font-medium text-white/80">
                Действует для каталога товаров и услуг сервиса
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF7A00]">что регулирует документ</div>
            <div className="mt-4 space-y-3">
              {[
                "Порядок оформления заявки на товар или услугу.",
                "Момент акцепта и подтверждение заказа менеджером.",
                "Оплата, доставка, возврат и гарантийные условия.",
                "Ответственность сторон и реквизиты продавца.",
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm leading-6 text-neutral-600">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-[0_18px_44px_rgba(15,23,42,0.05)] lg:p-8">
          {contentHtml ? (
            <div
              className="prose prose-neutral max-w-none text-neutral-700 prose-headings:font-bold prose-headings:text-[#10264B] prose-h2:text-2xl prose-p:leading-7 prose-li:leading-7"
              dangerouslySetInnerHTML={{ __html: contentHtml }}
            />
          ) : (
            <div className="space-y-8 text-neutral-700">
              <section>
                <h2 className="text-2xl font-bold text-[#10264B]">1. Термины и определения</h2>
                <p className="mt-3 leading-7">
                  1.1. Продавец — ИП Иванов Иван Иванович, осуществляющий продажу товаров и услуг через сайт vsezapchasti.ru.
                  <br />1.2. Покупатель — физическое или юридическое лицо, оформившее заявку на Сайте.
                  <br />1.3. Товар — автозапчасти, представленные в каталоге Сайта.
                  <br />1.4. Услуга — сервисное обслуживание автомобилей.
                  <br />1.5. Настоящий документ является публичной офертой в смысле ст. 435 и п. 2 ст. 437 ГК РФ.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-[#10264B]">2. Предмет договора</h2>
                <p className="mt-3 leading-7">
                  2.1. Продавец обязуется передать в собственность Покупателя Товар и/или оказать Услуги,
                  а Покупатель обязуется принять и оплатить Товар/Услуги на условиях настоящей Оферты.
                  <br />2.2. Информация на сайте носит справочный характер и не является безусловной гарантией наличия Товара до подтверждения менеджером.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-[#10264B]">3. Порядок оформления заявки</h2>
                <p className="mt-3 leading-7">
                  3.1. Заявка на Товар/Услугу оформляется Покупателем через формы на Сайте.
                  <br />3.2. После получения заявки менеджер Продавца связывается с Покупателем для уточнения деталей.
                  <br />3.3. Акцептом оферты считается подтверждение заказа Покупателем после согласования условий с менеджером Продавца.
                  <br />3.4. Договор считается заключенным с момента подтверждения заявки менеджером Продавца.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-[#10264B]">4. Цена и порядок оплаты</h2>
                <p className="mt-3 leading-7">
                  4.1. Цена Товара/Услуги указывается в каталоге или согласовывается с менеджером.
                  <br />4.2. Оплата производится наличными или безналичным переводом после подтверждения заказа.
                  <br />4.3. Продавец вправе изменять цены до момента подтверждения заказа.
                  <br />4.4. Стоимость доставки и дополнительных услуг согласовывается отдельно.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-[#10264B]">5. Доставка</h2>
                <p className="mt-3 leading-7">
                  5.1. Доставка Товара осуществляется самовывозом или транспортными компаниями.
                  <br />5.2. Стоимость и сроки доставки согласовываются с менеджером индивидуально.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-[#10264B]">6. Возврат товара</h2>
                <p className="mt-3 leading-7">
                  6.1. Покупатель вправе отказаться от Товара до момента его передачи.
                  <br />6.2. При дистанционном способе продажи возврат Товара надлежащего качества возможен в сроки, установленные ст. 26.1 Закона РФ «О защите прав потребителей», при сохранении товарного вида и потребительских свойств.
                  <br />6.3. Возврат Товара ненадлежащего качества осуществляется в соответствии с Законом РФ «О защите прав потребителей».
                  <br />6.4. Для возврата необходим документ, подтверждающий покупку, и заявление в свободной форме.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-[#10264B]">7. Гарантии</h2>
                <p className="mt-3 leading-7">
                  7.1. На Товары предоставляется гарантия производителя либо Продавца в зависимости от типа Товара.
                  <br />7.2. Гарантийный срок и условия гарантии указываются в товарных документах и/или заказ-наряде.
                  <br />7.3. На выполненные работы по ремонту предоставляется гарантия 30 дней, если иной срок не указан в заказ-наряде.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-[#10264B]">8. Ответственность сторон</h2>
                <p className="mt-3 leading-7">
                  8.1. За неисполнение или ненадлежащее исполнение обязательств стороны несут ответственность в соответствии с законодательством РФ.
                  <br />8.2. Продавец не несет ответственности за убытки, возникшие вследствие неправильного использования Товара.
                  <br />8.3. Споры разрешаются в претензионном порядке; срок ответа на претензию — до 10 рабочих дней.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-[#10264B]">9. Реквизиты продавца</h2>
                <div className="mt-4 rounded-[1.5rem] border border-neutral-200 bg-neutral-50 p-5 text-sm leading-7 text-neutral-700">
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
              </section>
            </div>
          )}
        </div>
      </section>

      <PublicFooter brandName={brandName} footerText={footerText} contactsLabel={navContacts} />
    </main>
  );
}
