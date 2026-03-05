import Link from "next/link";

type ContentMap = Record<string, string>;

function getApiBaseUrl(): string {
  // Server-side env (preferred). In dev, fallback to localhost API.
  const base = process.env.API_BASE_URL?.trim();
  return base && base.length > 0 ? base : "http://localhost:8000";
}

async function getContent(): Promise<ContentMap> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/public/content`, { cache: "no-store" });
    if (!res.ok) return {};
    const data: Array<{ key: string; value: string | null }> = await res.json();

    const content: ContentMap = {};
    for (const item of data) {
      content[item.key] = item.value ?? "";
    }
    return content;
  } catch {
    return {};
  }
}

export default async function Page() {
  const content = await getContent();

  return (
    <main className="min-h-dvh bg-[#F5F7FA] text-neutral-900">
      {/* Header */}
      <header className="border-b border-white/20 bg-white/80 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold text-[#1F3B73]">
              {content.site_logo || "Все запчасти"}
            </div>
            <nav className="hidden items-center gap-8 md:flex">
              <Link
                href="/parts"
                className="text-sm font-medium text-neutral-700 hover:text-[#1F3B73]"
              >
                Запчасти
              </Link>
              <Link
                href="/service"
                className="text-sm font-medium text-neutral-700 hover:text-[#1F3B73]"
              >
                Автосервис
              </Link>
              <Link
                href="/contacts"
                className="text-sm font-medium text-neutral-700 hover:text-[#1F3B73]"
              >
                Контакты
              </Link>
            </nav>
            <Link
              href="/admin/login"
              className="rounded-full bg-[#1F3B73] px-4 py-2 text-sm font-medium text-white hover:bg-[#16305D]"
            >
              Админка
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#1F3B73] to-[#0F1F3A] py-16">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.1),transparent_60%)]" />
        <div className="relative mx-auto max-w-6xl px-6">
          <div className="max-w-2xl">
            <h1 className="text-4xl font-bold text-white sm:text-5xl">
              {content.hero_title || "Все запчасти и автосервис"}
              <br />
              {content.hero_title_2 || "в одном месте"}
            </h1>
            <p className="mt-4 text-lg text-white/80">
              {content.hero_subtitle ||
                "Оригинальные запчасти и профессиональный ремонт легковых и грузовых автомобилей в Красноярске"}
            </p>
            <div className="mt-8 flex gap-4">
              <Link
                href="/parts"
                className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#1F3B73] shadow-lg hover:bg-white/90"
              >
                Найти запчасти
              </Link>
              <Link
                href="/service"
                className="rounded-full border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white hover:bg-white/15"
              >
                Записаться в сервис
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Main content */}
      <section className="-mt-10 pb-16">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 md:grid-cols-2">
          {/* Левая карточка - Запчасти */}
          <div className="rounded-3xl bg-white p-8 shadow-xl">
            <div className="flex items-start justify-between">
              <h2 className="text-2xl font-bold text-[#1F3B73]">
                {content.parts_title || "Подбор запчастей"}
              </h2>
              <span className="rounded-full bg-[#1F3B73]/10 px-3 py-1 text-xs font-medium text-[#1F3B73]">
                Артикул / OEM
              </span>
            </div>
            <p className="mt-3 text-sm text-neutral-600">
              Поиск по артикулу, OEM или названию. Подбор по VIN — заявка менеджеру.
            </p>
            <div className="mt-6 flex gap-3">
              <Link
                href="/parts"
                className="rounded-full bg-[#1F3B73] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#16305D]"
              >
                Открыть каталог
              </Link>
              <Link
                href="/parts/vin"
                className="rounded-full border border-[#1F3B73]/20 bg-white px-5 py-2.5 text-sm font-semibold text-[#1F3B73] hover:bg-[#1F3B73]/5"
              >
                Подбор по VIN
              </Link>
            </div>
          </div>

          {/* Правая карточка - Сервис */}
          <div className="rounded-3xl bg-white p-8 shadow-xl">
            <div className="flex items-start justify-between">
              <h2 className="text-2xl font-bold text-[#1F3B73]">
                {content.service_title || "Автосервис"}
              </h2>
              <div className="flex gap-2">
                <span className="rounded-full bg-[#1F3B73]/10 px-3 py-1 text-xs font-medium text-[#1F3B73]">
                  Легковые
                </span>
                <span className="rounded-full bg-[#1F3B73]/10 px-3 py-1 text-xs font-medium text-[#1F3B73]">
                  Грузовые
                </span>
              </div>
            </div>
            <p className="mt-3 text-sm text-neutral-600">
              Диагностика, ТО, ходовая, электрика и другие виды работ. Заявка на запись — менеджер подтверждает.
            </p>
            <div className="mt-6 flex gap-3">
              <Link
                href="/service"
                className="rounded-full bg-[#1F3B73] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#16305D]"
              >
                Выбрать услуги
              </Link>
              <Link
                href="/contacts"
                className="rounded-full border border-[#1F3B73]/20 bg-white px-5 py-2.5 text-sm font-semibold text-[#1F3B73] hover:bg-[#1F3B73]/5"
              >
                Контакты
              </Link>
            </div>
          </div>
        </div>

        {/* Contacts footer (static for now) */}
        <div className="mx-auto mt-10 max-w-6xl px-6">
          <div className="rounded-3xl bg-white p-8 shadow-sm">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div>
                <div className="text-sm font-semibold text-neutral-900">Адрес</div>
                <div className="mt-2 text-neutral-600">
                  Красноярск, ул. … (уточним)
                </div>
              </div>
              <div>
                <div className="text-sm font-semibold text-neutral-900">Телефон</div>
                <div className="mt-2 text-neutral-600">+7 (391) 219‒01‒03</div>
              </div>
              <div>
                <div className="text-sm font-semibold text-neutral-900">Email</div>
                <div className="mt-2 text-neutral-600">info@avm-24.ru</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
