import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { getServerApiBaseUrl, withApiBase } from "@/lib/api-base-url";
import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";

export const metadata: Metadata = {
  title: "О компании | Все запчасти",
  description: "О компании «Все запчасти»: поставка запчастей и сервис коммерческого транспорта в Красноярске.",
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

export default async function AboutPage() {
  const contentMap = await getPublicContentMap();
  const contentValue = (key: string, fallback: string): string => {
    const value = contentMap[key];
    return value && value.trim() ? value : fallback;
  };

  const heroTitle = contentMap.about_hero_title?.trim() || "О компании «Все запчасти»";
  const heroSubtitle =
    contentMap.about_hero_subtitle?.trim()
    || "Поставляем запчасти и обслуживаем коммерческий транспорт в Красноярске";

  const storyTitle = contentMap.about_story_title?.trim() || "Наша история";
  const storyHtml =
    contentMap.about_story_text?.trim()
    || "<p>«Все запчасти» — команда, которая объединяет поставку автозапчастей и сервис в одном контуре. Мы работаем с коммерческим транспортом, помогаем подобрать детали по артикулу, OEM и VIN, и сопровождаем клиента до закрытия заявки.</p>";

  const valuesTitle = contentMap.about_values_title?.trim() || "Наши принципы";
  const valuesHtml =
    contentMap.about_values_text?.trim()
    || "<ul><li>Прозрачная коммуникация и понятные статусы заявок.</li><li>Приоритет безопасности и соответствия 152-ФЗ.</li><li>Self-hosted архитектура без внешних runtime CDN.</li><li>Операционная дисциплина: проверяемость, логирование, воспроизводимость.</li></ul>";

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

  const companyFacts = [
    "Каталог запчастей и сервисная запись работают в одном контуре.",
    "Подбор ведётся по SKU, OEM и VIN-заявке менеджеру.",
    "Все публичные ассеты self-hosted, без внешних runtime CDN.",
  ];

  return (
    <main className="min-h-dvh bg-[#F3F5F8] text-neutral-900">
      <PublicHeader
        brandName={brandName}
        activeKey="about"
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
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)] lg:py-14">
          <div className="rounded-[2rem] bg-[linear-gradient(135deg,#1F3B73_0%,#17315E_65%,#10264B_100%)] p-8 text-white shadow-[0_30px_80px_rgba(31,59,115,0.18)]">
            <div className="inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
              about · company · operations
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">{heroTitle}</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/78 sm:text-lg">
              {heroSubtitle}
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {companyFacts.map((fact) => (
                <div key={fact} className="rounded-2xl border border-white/10 bg-white/8 p-4 text-sm leading-6 text-white/76">
                  {fact}
                </div>
              ))}
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/parts"
                className="inline-flex items-center justify-center rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-[#1F3B73] transition-colors hover:bg-[#EEF3FF]"
              >
                Перейти в каталог
              </Link>
              <Link
                href="/contacts"
                className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/16"
              >
                Связаться с нами
              </Link>
            </div>
          </div>

          <div className="overflow-hidden rounded-[2rem] border border-neutral-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
            <div className="relative h-full min-h-[22rem]">
              <Image
                src="/images/service-workshop.jpg"
                alt="Рабочая зона компании Все запчасти"
                fill
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <article className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-[0_18px_44px_rgba(15,23,42,0.05)] lg:p-8">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF7A00]">история</div>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-[#10264B]">{storyTitle}</h2>
            <div
              className="prose prose-neutral mt-5 max-w-none text-neutral-700 prose-p:leading-7 prose-li:leading-7"
              dangerouslySetInnerHTML={{ __html: storyHtml }}
            />
          </article>

          <article className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-[0_18px_44px_rgba(15,23,42,0.05)] lg:p-8">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF7A00]">подход</div>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-[#10264B]">{valuesTitle}</h2>
            <div
              className="prose prose-neutral mt-5 max-w-none text-neutral-700 prose-p:leading-7 prose-li:leading-7"
              dangerouslySetInnerHTML={{ __html: valuesHtml }}
            />
          </article>
        </div>
      </section>

      <section className="bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="rounded-[2rem] border border-neutral-200 bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_100%)] p-6 shadow-[0_18px_44px_rgba(15,23,42,0.05)] lg:p-8">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.8fr)]">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF7A00]">кому подходим</div>
                <h3 className="mt-3 text-3xl font-black tracking-tight text-[#10264B]">
                  Работаем для бизнеса и частных клиентов
                </h3>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-neutral-600 sm:text-base">
                  Каталог строится вокруг реальных сценариев: быстро найти, проверить совместимость, оформить запрос и получить понятный ответ менеджера.
                  Для сервиса запись ведётся через заявку с подтверждением, без пустых и неработающих элементов.
                </p>
              </div>
              <div className="space-y-4">
                {[
                  "Каталог и сервис не разорваны на разные продукты.",
                  "Контуры заказа, VIN и сервиса остаются связанными.",
                  "Публичные страницы остаются удобными и на desktop, и на mobile.",
                ].map((item) => (
                  <div key={item} className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm leading-6 text-neutral-600">
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/parts"
                className="inline-flex items-center justify-center rounded-2xl bg-[#1F3B73] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#14294F]"
              >
                Открыть каталог
              </Link>
              <Link
                href="/service"
                className="inline-flex items-center justify-center rounded-2xl border border-[#1F3B73]/15 bg-[#EEF3FF] px-6 py-3 text-sm font-semibold text-[#1F3B73] transition-colors hover:bg-[#E1EAFB]"
              >
                Перейти в сервис
              </Link>
            </div>
          </div>
        </div>
      </section>

      <PublicFooter brandName={brandName} footerText={footerText} contactsLabel={navContacts} />
    </main>
  );
}
