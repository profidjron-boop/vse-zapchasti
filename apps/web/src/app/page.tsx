import Link from "next/link";
import { getServerApiBaseUrl, withApiBase } from "@/lib/api-base-url";

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

export default async function Page() {
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
  const heroTitle = contentValue("home_hero_title", "Все запчасти и автосервис в одном месте");
  const heroSubtitle = contentValue(
    "home_hero_subtitle",
    "Оригинальные запчасти и профессиональный ремонт легковых и грузовых автомобилей в Красноярске"
  );
  const heroCtaParts = contentValue("home_hero_cta_parts_label", "Подобрать запчасти");
  const heroCtaService = contentValue("home_hero_cta_service_label", "Записаться на сервис");
  const orderPartsTitle = contentValue("home_order_parts_title", "Не нашли нужную запчасть?");
  const orderPartsSubtitle = contentValue("home_order_parts_subtitle", "Закажите обратный звонок — мы подберём и привезём");
  const orderPartsCta = contentValue("home_order_parts_cta_label", "Оставьте заявку");
  const homeContactsAddress = contentValue("home_contacts_address", "г. Красноярск, пр. Металлургов, 2В");
  const homeContactsSchedule = contentValue("home_contacts_schedule", "Пн–Пт 9:00–19:00, Сб 10:00–17:00, Вс выходной");
  const homeContactsPhone = contentValue("home_contacts_phone", "+7 (391) 258-95-00");
  const footerText = contentValue("site_footer_text", "Все запчасти · Красноярск · NO CDN (self-hosted assets)");
  const legalPrivacyLabel = contentValue("site_legal_privacy_label", "Политика конфиденциальности");
  const legalOfferLabel = contentValue("site_legal_offer_label", "Публичная оферта");

  return (
    <main className="min-h-dvh bg-[#F5F7FA] text-neutral-900">
      {/* Header */}
      <header className="border-b border-white/20 bg-white/80 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-2xl font-bold text-[#1F3B73]">{brandName}</div>
            <nav className="hidden items-center gap-8 md:flex">
              <Link href="/parts" className="text-sm font-medium text-neutral-700 hover:text-[#1F3B73]">{navParts}</Link>
              <Link href="/service" className="text-sm font-medium text-neutral-700 hover:text-[#1F3B73]">{navService}</Link>
              <Link href="/contacts" className="text-sm font-medium text-neutral-700 hover:text-[#1F3B73]">{navContacts}</Link>
              <Link href="/about" className="text-sm font-medium text-neutral-700 hover:text-[#1F3B73]">{navAbout}</Link>
              <Link href="/favorites" className="text-sm font-medium text-neutral-700 hover:text-[#1F3B73]">{navFavorites}</Link>
              <Link href="/cart" className="text-sm font-medium text-neutral-700 hover:text-[#1F3B73]">{navCart}</Link>
              <Link href="/account/orders" className="text-sm font-medium text-neutral-700 hover:text-[#1F3B73]">{navOrders}</Link>
            </nav>
            <div className="flex items-center gap-3">
              <Link
                href="/contacts"
                className="hidden rounded-2xl border border-[#1F3B73]/20 bg-white px-4 py-2 text-sm font-medium text-[#1F3B73] sm:inline-block"
              >
                Для дилеров
              </Link>
              <Link
                href="/contacts#callback-form"
                className="rounded-2xl bg-[#FF7A00] px-3 py-2 text-xs font-medium text-white shadow-lg shadow-[#FF7A00]/20 sm:px-4 sm:text-sm"
              >
                Заказать звонок
              </Link>
            </div>
          </div>
          <nav className="mt-3 flex items-center gap-4 overflow-x-auto pb-1 text-sm md:hidden">
            <Link href="/parts" className="shrink-0 font-medium text-neutral-700 hover:text-[#1F3B73]">{navParts}</Link>
            <Link href="/service" className="shrink-0 font-medium text-neutral-700 hover:text-[#1F3B73]">{navService}</Link>
            <Link href="/contacts" className="shrink-0 font-medium text-neutral-700 hover:text-[#1F3B73]">{navContacts}</Link>
            <Link href="/about" className="shrink-0 font-medium text-neutral-700 hover:text-[#1F3B73]">{navAbout}</Link>
            <Link href="/favorites" className="shrink-0 font-medium text-neutral-700 hover:text-[#1F3B73]">{navFavorites}</Link>
            <Link href="/cart" className="shrink-0 font-medium text-neutral-700 hover:text-[#1F3B73]">{navCart}</Link>
            <Link href="/account/orders" className="shrink-0 font-medium text-neutral-700 hover:text-[#1F3B73]">{navOrders}</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#1F3B73] to-[#14294F] py-20">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-white blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-bold text-white sm:text-5xl">
              {heroTitle}
            </h1>
            <p className="mt-4 text-base text-white/80 sm:text-lg">
              {heroSubtitle}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
              <Link
                href="/parts"
                className="rounded-2xl bg-white px-6 py-3 text-center font-medium text-[#1F3B73] shadow-lg transition hover:bg-white/90"
              >
                {heroCtaParts}
              </Link>
              <Link
                href="/service"
                className="rounded-2xl border border-white/30 bg-white/10 px-6 py-3 text-center font-medium text-white backdrop-blur-sm transition hover:bg-white/20"
              >
                {heroCtaService}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Две дороги - ключевой блок */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
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
              <form action="/parts" method="get" className="mt-2 flex flex-col gap-3 sm:flex-row">
                <input
                  type="text"
                  name="q"
                  placeholder="Например: 06A905161B"
                  className="flex-1 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm focus:border-[#1F3B73] focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-2xl bg-[#1F3B73] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#14294F]"
                >
                  Найти
                </button>
              </form>
              <Link href="/parts/vin" className="mt-4 inline-block text-sm font-medium text-[#FF7A00] hover:underline">
                Оставить VIN-заявку →
              </Link>
            </div>
          </div>

          {/* Правая карточка - Сервис */}
          <div className="rounded-3xl bg-white p-8 shadow-xl">
            <div className="flex flex-wrap items-start justify-between gap-2">
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
              <Link
                href="/service#form"
                className="inline-block rounded-2xl border-2 border-[#FF7A00] px-6 py-3 font-medium text-[#FF7A00] transition hover:bg-[#FF7A00] hover:text-white"
              >
                Записаться
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Категории запчастей */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
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
              <Link
                href="/service#form"
                className="mt-8 inline-block rounded-2xl bg-[#FF7A00] px-8 py-3 font-medium text-white shadow-lg shadow-[#FF7A00]/20"
              >
                Оставить заявку
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Запчасти под заказ */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="rounded-3xl bg-gradient-to-r from-[#1F3B73] to-[#14294F] p-8 text-white lg:p-12">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="text-2xl font-bold">{orderPartsTitle}</h2>
              <p className="mt-2 text-white/80">
                {orderPartsSubtitle}
              </p>
              <Link
                href="/contacts#callback-form"
                className="mt-6 inline-block rounded-2xl bg-[#FF7A00] px-8 py-3 font-medium text-white shadow-lg shadow-black/20"
              >
                {orderPartsCta}
              </Link>
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
                    <div className="text-neutral-600">{homeContactsAddress}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-[#FF7A00]">🕒</span>
                  <div>
                    <div className="font-medium">Время работы</div>
                    <div className="text-neutral-600">{homeContactsSchedule}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-[#FF7A00]">📞</span>
                  <div>
                    <div className="font-medium">Телефон</div>
                    <div className="text-neutral-600">{homeContactsPhone}</div>
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
        <div className="mx-auto max-w-6xl px-4 text-center text-sm text-neutral-600 sm:px-6">
          © {new Date().getFullYear()} {footerText}
        </div>
      </footer>
      {/* Legal links */}
      <div className="mx-auto max-w-6xl px-4 pb-10 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-neutral-600">
          <Link href="/privacy" className="hover:text-[#1F3B73]">
            {legalPrivacyLabel}
          </Link>
          <Link href="/offer" className="hover:text-[#1F3B73]">
            {legalOfferLabel}
          </Link>
        </div>
      </div>

    </main>
  );
}
