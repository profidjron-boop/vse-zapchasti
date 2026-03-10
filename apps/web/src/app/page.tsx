import Image from "next/image";
import Link from "next/link";
import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";
import { getServerApiBaseUrl, withApiBase } from "@/lib/api-base-url";
import {
  fetchPublicContentMapServer,
  getPublicContentValue,
  getPublicSiteContent,
} from "@/lib/public-site-content";

type Category = {
  id: number;
  name: string;
  parent_id: number | null;
};

async function getPublicCategories(): Promise<Category[]> {
  try {
    const apiBaseUrl = getServerApiBaseUrl();
    const response = await fetch(
      withApiBase(apiBaseUrl, "/api/public/categories"),
      { cache: "no-store" },
    );
    if (!response.ok) return [];
    const payload = (await response.json()) as Category[];
    return Array.isArray(payload) ? payload : [];
  } catch {
    return [];
  }
}

function shouldShowHomeCategory(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return false;
  if (normalized.startsWith("бренд:")) return false;
  if (normalized.startsWith("импорт ")) return false;
  return true;
}

function categoryMonogram(name: string): string {
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return "VP";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function categoryTone(index: number): string {
  const tones = [
    "from-[#1F3B73] to-[#365CAD]",
    "from-[#244A8D] to-[#5A7EC6]",
    "from-[#17315E] to-[#365CAD]",
    "from-[#2A4578] to-[#4E73B8]",
  ];
  return tones[index % tones.length] ?? tones[0];
}

export default async function Page() {
  const contentMap = await fetchPublicContentMapServer();
  const siteContent = getPublicSiteContent(contentMap);
  const categories = await getPublicCategories();
  const contentValue = (key: string, fallback: string): string => {
    return getPublicContentValue(contentMap, key, fallback);
  };

  const heroTitle = contentValue(
    "home_hero_title",
    "Готовое решение для каталога и сервиса",
  );
  const heroSubtitle = contentValue(
    "home_hero_subtitle",
    "Каталог запчастей, подбор по артикулу или VIN и запись на сервис без лишних шагов.",
  );
  const heroCtaParts = contentValue(
    "home_hero_cta_parts_label",
    "Подобрать запчасти",
  );
  const heroCtaService = contentValue(
    "home_hero_cta_service_label",
    "Записаться на сервис",
  );
  const orderPartsTitle = contentValue(
    "home_order_parts_title",
    "Не нашли нужную запчасть?",
  );
  const orderPartsSubtitle = contentValue(
    "home_order_parts_subtitle",
    "Отправьте заявку, и менеджер подберёт позицию по VIN, OEM или описанию.",
  );
  const orderPartsCta = contentValue(
    "home_order_parts_cta_label",
    "Оставить заявку",
  );
  const homeContactsAddress = contentValue(
    "home_contacts_address",
    "г. Ваш город, ул. Примерная, 1",
  );
  const homeContactsSchedule = contentValue(
    "home_contacts_schedule",
    "Пн–Пт 9:00–19:00, Сб 10:00–17:00, Вс выходной",
  );
  const homeContactsPhone = contentValue(
    "home_contacts_phone",
    "+7 (900) 000-00-00",
  );
  const footerText = contentValue(
    "site_footer_text",
    siteContent.footerText,
  );
  const legalPrivacyLabel = contentValue(
    "site_legal_privacy_label",
    "Политика конфиденциальности",
  );
  const legalOfferLabel = contentValue(
    "site_legal_offer_label",
    "Публичная оферта",
  );
  const homeCategoryFallback = [
    "Подвеска и рулевое",
    "Тормозная система",
    "Двигатель и зажигание",
    "Фильтры",
    "Масла и жидкости",
    "Электрика",
    "Охлаждение",
    "Сцепление и КПП",
  ];
  const categoryIconMap: Record<string, string> = {
    "Подвеска и рулевое": "/assets/category-icons/suspension.svg",
    "Тормозная система": "/assets/category-icons/brakes.svg",
    "Двигатель и зажигание": "/assets/category-icons/engine.svg",
    "Масла и жидкости": "/assets/category-icons/to.svg",
    Электрика: "/assets/category-icons/electrics.svg",
    "Сцепление и КПП": "/assets/category-icons/gearbox.svg",
  };
  const homeCategories = categories
    .filter((category) => shouldShowHomeCategory(category.name))
    .slice(0, 8);

  const categoryCards =
    homeCategories.length > 0
      ? homeCategories.map((category) => ({
          id: String(category.id),
          name: category.name,
          href: `/parts?category=${category.id}`,
        }))
      : homeCategoryFallback.map((name) => ({
          id: name,
          name,
          href: `/parts?q=${encodeURIComponent(name)}`,
        }));

  const valueCards = [
    {
      title: "Поиск по SKU / OEM",
      text: "Быстрый вход в каталог и поиск по артикулу без регистрации.",
    },
    {
      title: "VIN-заявка менеджеру",
      text: "Если нет точного номера, оставьте VIN и получите подбор вручную.",
    },
    {
      title: "Сервисная запись",
      text: "Легковые и коммерческий транспорт, запись как заявка с подтверждением.",
    },
  ];

  const processSteps = [
    "Находите товар по артикулу, OEM или категории.",
    "Если нужно, оставляете VIN-заявку или запрос на подбор.",
    "Получаете подтверждение, заказ или запись на сервис от менеджера.",
  ];

  return (
    <main className="min-h-dvh bg-[#F3F5F8] text-neutral-900">
      <PublicHeader
        brandName={siteContent.brandName}
        labels={siteContent.labels}
      />

      <section className="border-b border-neutral-200 bg-[linear-gradient(180deg,#f8fafc_0%,#eef3fb_100%)]">
        <div className="mx-auto grid max-w-[92rem] gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)] lg:items-start lg:py-16">
          <div className="rounded-[2rem] bg-[linear-gradient(135deg,#1F3B73_0%,#17315E_65%,#10264B_100%)] p-8 text-white shadow-[0_32px_80px_rgba(31,59,115,0.18)] lg:p-10">
            <div className="inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
              Parts · Service · Template
            </div>
            <h1 className="mt-6 max-w-2xl text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
              {heroTitle}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/78 sm:text-lg">
              {heroSubtitle}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/parts"
                className="inline-flex items-center justify-center rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-[#1F3B73] transition-colors hover:bg-[#EEF3FF]"
              >
                {heroCtaParts}
              </Link>
              <Link
                href="/service#form"
                className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/16"
              >
                {heroCtaService}
              </Link>
            </div>
            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {valueCards.map((card) => (
                <div
                  key={card.title}
                  className="rounded-2xl border border-white/10 bg-white/8 p-4"
                >
                  <div className="text-sm font-semibold text-white">
                    {card.title}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-white/72">
                    {card.text}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4 lg:relative lg:z-10">
            <form
              action="/parts"
              method="get"
              className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)]"
            >
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF7A00]">
                быстрый поиск
              </div>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-[#1F3B73]">
                Найти запчасть по артикулу
              </h2>
              <p className="mt-2 text-sm leading-6 text-neutral-600">
                Введите SKU, OEM или часть названия, чтобы сразу перейти в
                каталог.
              </p>
              <div className="mt-5 space-y-3">
                <label htmlFor="hero-parts-search" className="sr-only">
                  Поиск по каталогу
                </label>
                <input
                  id="hero-parts-search"
                  type="search"
                  name="q"
                  placeholder="Например: 06A905161B"
                  className="h-12 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#1F3B73]/30 focus:bg-white focus:outline-none"
                />
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-[#FF7A00] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#E86F00]"
                >
                  Найти в каталоге
                </button>
              </div>
            </form>

            <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
              <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1F3B73]">
                  VIN-подбор
                </div>
                <h3 className="mt-3 text-xl font-bold text-neutral-900">
                  Подбор без точного номера
                </h3>
                <p className="mt-2 text-sm leading-6 text-neutral-600">
                  Отправьте VIN, контакты и комментарий. Менеджер подберёт
                  совместимость вручную.
                </p>
                <Link
                  href="/parts/vin"
                  className="mt-5 inline-flex items-center justify-center rounded-2xl border border-[#1F3B73]/15 bg-[#EEF3FF] px-4 py-2.5 text-sm font-semibold text-[#1F3B73] transition-colors hover:bg-[#E1EAFB]"
                >
                  Оставить VIN
                </Link>
              </div>

              <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1F3B73]">
                  сервисный центр
                </div>
                <h3 className="mt-3 text-xl font-bold text-neutral-900">
                  Запись на сервис
                </h3>
                <p className="mt-2 text-sm leading-6 text-neutral-600">
                  ТО, диагностика, ремонт и обслуживание. Запись оформляется
                  заявкой с подтверждением.
                </p>
                <Link
                  href="/service#form"
                  className="mt-5 inline-flex items-center justify-center rounded-2xl border border-[#1F3B73]/15 bg-[#EEF3FF] px-4 py-2.5 text-sm font-semibold text-[#1F3B73] transition-colors hover:bg-[#E1EAFB]"
                >
                  Открыть сервис
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[92rem] px-4 py-14 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF7A00]">
              каталог
            </div>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-[#10264B]">
              Категории запчастей
            </h2>
          </div>
          <Link
            href="/parts"
            className="inline-flex items-center text-sm font-semibold text-[#1F3B73] transition-colors hover:text-[#14294F]"
          >
            Открыть весь каталог
          </Link>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4 xl:grid-cols-4">
          {categoryCards.map((category, index) => (
            <Link
              key={category.id}
              href={category.href}
              className="group rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-[0_18px_44px_rgba(15,23,42,0.05)] transition-shadow duration-200 hover:shadow-[0_22px_54px_rgba(15,23,42,0.10)]"
            >
              <div
                className={`inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-[#1F3B73]/10 ${
                  categoryIconMap[category.name]
                    ? "bg-[#EEF3FF]"
                    : `bg-gradient-to-br ${categoryTone(index)}`
                }`}
              >
                {categoryIconMap[category.name] ? (
                  <Image
                    src={categoryIconMap[category.name]}
                    alt=""
                    width={44}
                    height={44}
                    className="h-11 w-11"
                    aria-hidden="true"
                  />
                ) : (
                  <span className="text-lg font-black tracking-wide text-white">
                    {categoryMonogram(category.name)}
                  </span>
                )}
              </div>
              <h3 className="mt-5 text-lg font-bold leading-6 text-neutral-900">
                {category.name}
              </h3>
              <p className="mt-3 text-sm leading-6 text-neutral-600">
                Перейти в подбор и список доступных товаров по категории.
              </p>
              <div className="mt-5 inline-flex items-center text-sm font-semibold text-[#1F3B73] transition-colors group-hover:text-[#14294F]">
                Смотреть товары
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-white py-14">
        <div className="mx-auto grid max-w-[92rem] gap-8 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,26rem)]">
          <div className="rounded-[2rem] border border-neutral-200 bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_100%)] p-6 shadow-[0_20px_55px_rgba(15,23,42,0.06)] lg:p-8">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF7A00]">
              как мы работаем
            </div>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-[#10264B]">
              Магазин запчастей и автосервис в одном контуре
            </h2>
            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              {processSteps.map((step, index) => (
                <div
                  key={step}
                  className="rounded-2xl border border-neutral-200 bg-white p-5"
                >
                  <div className="text-2xl font-black text-[#1F3B73]">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-neutral-600">
                    {step}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-8 grid gap-4 lg:grid-cols-2">
              <div className="overflow-hidden rounded-[1.75rem] border border-neutral-200">
                <Image
                  src="/images/neutral-catalog.svg"
                  alt="Нейтральная иллюстрация каталога"
                  width={1200}
                  height={900}
                  className="h-64 w-full object-cover"
                />
              </div>
              <div className="rounded-[1.75rem] bg-[#10264B] p-6 text-white">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FFB166]">
                  коммерческий транспорт
                </div>
                <h3 className="mt-3 text-2xl font-bold">{orderPartsTitle}</h3>
                <p className="mt-3 text-sm leading-6 text-white/78">
                  {orderPartsSubtitle}
                </p>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Link
                    href="/contacts#callback-form"
                    className="inline-flex items-center justify-center rounded-2xl bg-[#FF7A00] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#E86F00]"
                  >
                    {orderPartsCta}
                  </Link>
                  <Link
                    href="/parts?direction=oils"
                    className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/16"
                  >
                    Масла и расходники
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="overflow-hidden rounded-[2rem] border border-neutral-200 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
              <Image
                src="/images/neutral-service.svg"
                alt="Нейтральная иллюстрация сервиса"
                width={1400}
                height={1000}
                className="h-56 w-full object-cover"
              />
              <div className="p-6">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF7A00]">
                  автосервис
                </div>
                <h3 className="mt-3 text-2xl font-bold text-[#10264B]">
                  ТО, диагностика и ремонт
                </h3>
                <ul className="mt-4 space-y-3 text-sm text-neutral-600">
                  <li>Диагностика и техническое обслуживание.</li>
                  <li>Ремонт двигателя, ходовой части и автоэлектрики.</li>
                  <li>Запись для легковых и коммерческих автомобилей.</li>
                </ul>
                <Link
                  href="/service#form"
                  className="mt-6 inline-flex items-center justify-center rounded-2xl bg-[#1F3B73] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#14294F]"
                >
                  Записаться на сервис
                </Link>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <Link
                href="/parts?direction=parts"
                className="rounded-[1.75rem] border border-neutral-200 bg-white p-5 shadow-[0_18px_44px_rgba(15,23,42,0.05)] transition-colors hover:border-[#1F3B73]/15 hover:bg-[#F8FBFF]"
              >
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1F3B73]">
                  каталог
                </div>
                <div className="mt-3 text-lg font-bold text-neutral-900">
                  Запчасти для ремонта
                </div>
                <p className="mt-2 text-sm leading-6 text-neutral-600">
                  Быстрый вход в основные категории и подбор по артикулу или
                  OEM.
                </p>
              </Link>
              <Link
                href="/parts/vin"
                className="rounded-[1.75rem] border border-neutral-200 bg-white p-5 shadow-[0_18px_44px_rgba(15,23,42,0.05)] transition-colors hover:border-[#1F3B73]/15 hover:bg-[#F8FBFF]"
              >
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1F3B73]">
                  подбор
                </div>
                <div className="mt-3 text-lg font-bold text-neutral-900">
                  VIN-заявка менеджеру
                </div>
                <p className="mt-2 text-sm leading-6 text-neutral-600">
                  Подходит для сложных случаев, когда нужна ручная проверка
                  совместимости.
                </p>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[92rem] px-4 py-14 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(20rem,0.85fr)]">
          <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-[0_18px_44px_rgba(15,23,42,0.05)] lg:p-8">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF7A00]">
              контакты
            </div>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-[#10264B]">
              Приезжайте, звоните или оставляйте заявку
            </h2>
            <div className="mt-8 grid gap-5 sm:grid-cols-3">
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="text-sm font-semibold text-neutral-900">
                  Адрес
                </div>
                <p className="mt-2 text-sm leading-6 text-neutral-600">
                  {homeContactsAddress}
                </p>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="text-sm font-semibold text-neutral-900">
                  Режим работы
                </div>
                <p className="mt-2 text-sm leading-6 text-neutral-600">
                  {homeContactsSchedule}
                </p>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="text-sm font-semibold text-neutral-900">
                  Телефон
                </div>
                <p className="mt-2 text-sm leading-6 text-neutral-600">
                  {homeContactsPhone}
                </p>
              </div>
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/contacts"
                className="inline-flex items-center justify-center rounded-2xl bg-[#1F3B73] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#14294F]"
              >
                Открыть страницу контактов
              </Link>
              <Link
                href="/contacts#callback-form"
                className="inline-flex items-center justify-center rounded-2xl border border-[#1F3B73]/15 bg-[#EEF3FF] px-6 py-3 text-sm font-semibold text-[#1F3B73] transition-colors hover:bg-[#E1EAFB]"
              >
                Заказать звонок
              </Link>
            </div>
          </div>

          <div className="rounded-[2rem] border border-neutral-200 bg-[linear-gradient(135deg,#10264B_0%,#1F3B73_100%)] p-6 text-white shadow-[0_24px_70px_rgba(16,38,75,0.18)] lg:p-8">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FFB166]">
              маршруты входа
            </div>
            <div className="mt-4 space-y-4">
              <Link
                href="/parts?direction=parts"
                className="block rounded-2xl border border-white/10 bg-white/8 p-4 transition-colors hover:bg-white/12"
              >
                <div className="text-sm font-semibold text-white">
                  Каталог запчастей
                </div>
                <p className="mt-2 text-sm leading-6 text-white/74">
                  Основной поток для поиска товаров, карточек и оформления
                  заказа.
                </p>
              </Link>
              <Link
                href="/service"
                className="block rounded-2xl border border-white/10 bg-white/8 p-4 transition-colors hover:bg-white/12"
              >
                <div className="text-sm font-semibold text-white">
                  Автосервис
                </div>
                <p className="mt-2 text-sm leading-6 text-white/74">
                  Запись на диагностику, ТО и ремонт через удобную форму заявки.
                </p>
              </Link>
              <Link
                href="/account/orders"
                className="block rounded-2xl border border-white/10 bg-white/8 p-4 transition-colors hover:bg-white/12"
              >
                <div className="text-sm font-semibold text-white">
                  Проверка заказов
                </div>
                <p className="mt-2 text-sm leading-6 text-white/74">
                  История и статус заказов по номеру телефона, который был
                  указан при оформлении.
                </p>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <PublicFooter
        brandName={siteContent.brandName}
        footerText={footerText}
        contactsLabel={siteContent.labels.contacts}
        privacyLabel={legalPrivacyLabel}
        offerLabel={legalOfferLabel}
      />
    </main>
  );
}
