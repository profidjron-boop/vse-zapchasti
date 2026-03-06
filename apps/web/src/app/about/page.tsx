import Link from "next/link";
import { getServerApiBaseUrl, withApiBase } from "@/lib/api-base-url";
import type { Metadata } from "next";

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

  const heroTitle = contentMap.about_hero_title?.trim() || "О компании «Все запчасти»";
  const heroSubtitle =
    contentMap.about_hero_subtitle?.trim() ||
    "Поставляем запчасти и обслуживаем коммерческий транспорт в Красноярске";

  const storyTitle = contentMap.about_story_title?.trim() || "Наша история";
  const storyHtml =
    contentMap.about_story_text?.trim() ||
    "<p>«Все запчасти» — команда, которая объединяет поставку автозапчастей и сервис в одном контуре. Мы работаем с коммерческим транспортом, помогаем подобрать детали по артикулу, OEM и VIN, и сопровождаем клиента до закрытия заявки.</p>";

  const valuesTitle = contentMap.about_values_title?.trim() || "Наши принципы";
  const valuesHtml =
    contentMap.about_values_text?.trim() ||
    "<ul><li>Прозрачная коммуникация и понятные статусы заявок.</li><li>Приоритет безопасности и соответствия 152-ФЗ.</li><li>Self-hosted архитектура без внешних runtime CDN.</li><li>Операционная дисциплина: проверяемость, логирование, воспроизводимость.</li></ul>";

  return (
    <main className="min-h-dvh bg-[#F5F7FA] text-neutral-900">
      <header className="border-b border-white/20 bg-white/80 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/" className="text-2xl font-bold text-[#1F3B73]">Все запчасти</Link>
            <nav className="hidden items-center gap-8 md:flex">
              <Link href="/parts" className="text-sm font-medium text-neutral-700 hover:text-[#1F3B73]">Запчасти</Link>
              <Link href="/service" className="text-sm font-medium text-neutral-700 hover:text-[#1F3B73]">Автосервис</Link>
              <Link href="/contacts" className="text-sm font-medium text-neutral-700 hover:text-[#1F3B73]">Контакты</Link>
              <Link href="/about" className="text-sm font-medium text-[#1F3B73] border-b-2 border-[#1F3B73] pb-1">О компании</Link>
            </nav>
          </div>
          <nav className="mt-3 flex items-center gap-4 overflow-x-auto pb-1 text-sm md:hidden">
            <Link href="/parts" className="shrink-0 font-medium text-neutral-700 hover:text-[#1F3B73]">Запчасти</Link>
            <Link href="/service" className="shrink-0 font-medium text-neutral-700 hover:text-[#1F3B73]">Автосервис</Link>
            <Link href="/contacts" className="shrink-0 font-medium text-neutral-700 hover:text-[#1F3B73]">Контакты</Link>
            <Link href="/about" className="shrink-0 font-medium text-[#1F3B73]">О компании</Link>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden bg-gradient-to-br from-[#1F3B73] to-[#14294F] py-16">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-white blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <h1 className="text-3xl font-bold text-white sm:text-4xl">{heroTitle}</h1>
          <p className="mt-4 max-w-3xl text-base text-white/80 sm:text-lg">{heroSubtitle}</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-2">
          <article className="rounded-3xl border border-neutral-200 bg-white p-8 shadow-xl">
            <h2 className="text-2xl font-bold text-[#1F3B73]">{storyTitle}</h2>
            <div className="prose prose-neutral mt-4 max-w-none text-neutral-700" dangerouslySetInnerHTML={{ __html: storyHtml }} />
          </article>

          <article className="rounded-3xl border border-neutral-200 bg-white p-8 shadow-xl">
            <h2 className="text-2xl font-bold text-[#1F3B73]">{valuesTitle}</h2>
            <div className="prose prose-neutral mt-4 max-w-none text-neutral-700" dangerouslySetInnerHTML={{ __html: valuesHtml }} />
          </article>
        </div>

        <div className="mt-8 rounded-3xl border border-neutral-200 bg-white p-8 shadow-xl">
          <h3 className="text-xl font-semibold text-[#1F3B73]">Работаем для бизнеса и частных клиентов</h3>
          <p className="mt-3 max-w-3xl text-neutral-600">
            Каталог строится вокруг реальных задач: быстро найти, проверить совместимость, оформить запрос и получить
            понятный ответ менеджера. Для сервиса запись ведётся через заявку с подтверждением.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/parts"
              className="rounded-2xl bg-[#FF7A00] px-5 py-3 text-sm font-medium text-white shadow-lg shadow-[#FF7A00]/20"
            >
              Перейти в каталог
            </Link>
            <Link
              href="/contacts"
              className="rounded-2xl border border-[#1F3B73]/20 bg-white px-5 py-3 text-sm font-medium text-[#1F3B73]"
            >
              Связаться с нами
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-neutral-200 bg-neutral-50 py-8">
        <div className="mx-auto max-w-6xl px-4 text-center text-sm text-neutral-600 sm:px-6">
          © {new Date().getFullYear()} Все запчасти · Красноярск · NO CDN
        </div>
      </footer>
    </main>
  );
}
