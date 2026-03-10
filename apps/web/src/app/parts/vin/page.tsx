"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getClientApiBaseUrl, withApiBase } from "@/lib/api-base-url";
import { ApiRequestError, fetchJsonWithTimeout } from "@/lib/fetch-json";
import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";

function normalizePhone(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  let normalized = digits;

  if (normalized.length === 11 && normalized.startsWith("8"))
    normalized = `7${normalized.slice(1)}`;
  if (normalized.length === 10) normalized = `7${normalized}`;

  if (normalized.length !== 11 || !normalized.startsWith("7")) return null;
  return `+${normalized}`;
}

function normalizeVin(value: string): string | null {
  const normalized = value.trim().toUpperCase();
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(normalized) ? normalized : null;
}

export default function VinRequestPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");
  const [contentMap, setContentMap] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    async function loadContent() {
      try {
        const apiBaseUrl = getClientApiBaseUrl();
        const response = await fetch(
          withApiBase(apiBaseUrl, "/api/public/content"),
          { cache: "no-store" },
        );
        if (!response.ok) return;

        const payload = (await response.json()) as Array<{
          key?: string;
          value?: string | null;
        }>;
        if (!Array.isArray(payload) || cancelled) return;

        const map: Record<string, string> = {};
        for (const item of payload) {
          if (item?.key && typeof item.value === "string") {
            map[item.key] = item.value;
          }
        }
        setContentMap(map);
      } catch {
        // keep defaults
      }
    }

    void loadContent();
    return () => {
      cancelled = true;
    };
  }, []);

  const contentValue = (key: string, fallback: string): string => {
    const value = contentMap[key];
    return value && value.trim() ? value : fallback;
  };

  const brandName = contentValue("site_brand_name", "АвтоПлатформа");
  const navParts = contentValue("site_nav_parts_label", "Запчасти");
  const navService = contentValue("site_nav_service_label", "Автосервис");
  const navContacts = contentValue("site_nav_contacts_label", "Контакты");
  const navAbout = contentValue("site_nav_about_label", "О компании");
  const navFavorites = contentValue("site_nav_favorites_label", "Избранное");
  const navCart = contentValue("site_nav_cart_label", "Корзина");
  const navOrders = contentValue("site_nav_orders_label", "Мои заказы");
  const navDealer = contentValue("site_nav_dealer_label", "Для дилеров");
  const navCallback = contentValue(
    "site_nav_callback_label",
    "Заказать звонок",
  );
  const footerText = contentValue(
    "site_footer_text",
    "АвтоПлатформа · Ваш город · NO CDN",
  );
  const heroTitle = contentValue("vin_hero_title", "VIN-заявка");
  const heroSubtitle = contentValue(
    "vin_hero_subtitle",
    "Не знаете точный артикул? Оставьте VIN — мы подберём запчасти по вашему автомобилю",
  );
  const vinFieldTitle = contentValue("vin_form_title", "VIN-номер *");
  const submitLabel = contentValue("vin_form_submit_label", "Отправить заявку");
  const successTitle = contentValue("vin_success_title", "Заявка отправлена!");
  const successText = contentValue(
    "vin_success_text",
    "Менеджер свяжется с вами в рабочее время для уточнения деталей.",
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const vin = normalizeVin(formData.get("vin")?.toString() || "");
    const phone = normalizePhone(formData.get("phone")?.toString() || "");

    if (!vin) {
      setError("Проверьте VIN. Нужны 17 символов без I, O, Q.");
      setIsSubmitting(false);
      return;
    }

    if (!phone) {
      setError("Проверьте телефон. Нужен формат РФ: +7XXXXXXXXXX.");
      setIsSubmitting(false);
      return;
    }

    const data = {
      vin,
      name: formData.get("name")?.toString().trim() || undefined,
      phone,
      email: formData.get("email")?.toString().trim() || undefined,
      message: formData.get("message")?.toString().trim() || undefined,
      consent_given: formData.get("consent") === "on",
      consent_version: "v1.0",
    };

    try {
      const apiBaseUrl = getClientApiBaseUrl();
      await fetchJsonWithTimeout(
        withApiBase(apiBaseUrl, "/api/public/vin-requests"),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        },
        12000,
      );

      setIsSuccess(true);
      event.currentTarget.reset();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(
          err.traceId ? `${err.message}. Код: ${err.traceId}` : err.message,
        );
      } else {
        setError("Не удалось отправить заявку. Попробуйте позже.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const vinHeader = (
    <PublicHeader
      brandName={brandName}
      activeKey="parts"
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
  );

  if (isSuccess) {
    return (
      <main className="min-h-dvh bg-[#F3F5F8] text-neutral-900">
        {vinHeader}

        <section className="border-b border-neutral-200 bg-[linear-gradient(180deg,#f8fafc_0%,#eef3fb_100%)]">
          <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:py-16">
            <div className="rounded-[2.25rem] bg-[linear-gradient(135deg,#1F3B73_0%,#17315E_65%,#10264B_100%)] p-8 text-white shadow-[0_30px_80px_rgba(31,59,115,0.18)] sm:p-10">
              <div className="inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
                vin request · submitted
              </div>
              <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">
                {successTitle}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-white/78 sm:text-lg">
                {successText}
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/parts"
                  className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-[#10264B] transition hover:bg-white/90"
                >
                  Вернуться в каталог
                </Link>
                <Link
                  href="/service"
                  className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
                >
                  Посмотреть сервис
                </Link>
              </div>
            </div>
          </div>
        </section>

        <PublicFooter
          brandName={brandName}
          footerText={footerText}
          contactsLabel={navContacts}
        />
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-[#F3F5F8] text-neutral-900">
      {vinHeader}

      <section className="border-b border-neutral-200 bg-[linear-gradient(180deg,#f8fafc_0%,#eef3fb_100%)]">
        <div className="mx-auto grid max-w-[92rem] gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.95fr)] lg:py-14">
          <div className="rounded-[2rem] bg-[linear-gradient(135deg,#1F3B73_0%,#17315E_65%,#10264B_100%)] p-8 text-white shadow-[0_30px_80px_rgba(31,59,115,0.18)]">
            <div className="inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
              vin · compatibility · manager request
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">
              {heroTitle}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/78 sm:text-lg">
              {heroSubtitle}
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/8 px-5 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-white/60">
                  шаг 1
                </div>
                <div className="mt-2 text-base font-semibold">
                  Оставляете VIN и контакт
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/8 px-5 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-white/60">
                  шаг 2
                </div>
                <div className="mt-2 text-base font-semibold">
                  Менеджер проверяет совместимость
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/8 px-5 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-white/60">
                  шаг 3
                </div>
                <div className="mt-2 text-base font-semibold">
                  Получаете подбор и сроки поставки
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF7A00]">
              что полезно указать
            </div>
            <div className="mt-4 space-y-3">
              {[
                "VIN в точном виде без пробелов и лишних символов.",
                "Какую деталь ищете: фильтр, тормоза, подвеска, электрика и т.д.",
                "Что важно: оригинал, аналог, срочная поставка, бюджетный вариант.",
                "При необходимости менеджер уточнит марку, модель, год и двигатель.",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm leading-6 text-neutral-600"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[92rem] px-4 py-12 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-[0_18px_44px_rgba(15,23,42,0.05)] sm:p-8">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF7A00]">
              форма VIN-заявки
            </div>
            <h2 className="mt-2 text-3xl font-bold text-[#10264B]">
              Отправить запрос на подбор
            </h2>

            <div className="mt-5 min-h-[4.25rem]">
              {error ? (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  {error}
                </div>
              ) : null}
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                  {vinFieldTitle}
                </label>
                <input
                  type="text"
                  name="vin"
                  required
                  placeholder="Например: XTA210930Y1234567"
                  className="h-12 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 font-mono text-sm focus:border-[#1F3B73] focus:outline-none"
                />
                <p className="mt-2 text-xs text-neutral-500">
                  VIN обычно состоит из 17 символов. Буквы I, O и Q не
                  используются.
                </p>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                    Ваше имя
                  </label>
                  <input
                    type="text"
                    name="name"
                    autoComplete="name"
                    className="h-12 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-sm focus:border-[#1F3B73] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                    Телефон *
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    required
                    autoComplete="tel"
                    inputMode="tel"
                    placeholder="+7 (___) ___-__-__"
                    className="h-12 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-sm focus:border-[#1F3B73] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  className="h-12 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-sm focus:border-[#1F3B73] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                  Что нужно найти
                </label>
                <textarea
                  name="message"
                  rows={5}
                  placeholder="Опишите деталь, которую ищете, или дополнительные пожелания по подбору"
                  className="w-full rounded-[1.5rem] border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm focus:border-[#1F3B73] focus:outline-none"
                />
              </div>

              <label className="flex items-start gap-3 rounded-[1.5rem] border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm leading-6 text-neutral-600">
                <input
                  type="checkbox"
                  name="consent"
                  className="mt-1 size-4"
                  required
                />
                <span>
                  Согласен на обработку персональных данных в соответствии с
                  политикой конфиденциальности.
                </span>
              </label>

              <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex flex-1 items-center justify-center rounded-2xl bg-[#FF7A00] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#e66e00] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "Отправка..." : submitLabel}
                </button>
                <Link
                  href="/parts"
                  className="inline-flex flex-1 items-center justify-center rounded-2xl border border-neutral-200 px-5 py-3.5 text-sm font-semibold text-neutral-700 transition hover:border-[#1F3B73] hover:text-[#1F3B73]"
                >
                  Вернуться к поиску
                </Link>
              </div>
            </form>
          </section>

          <aside className="space-y-6">
            <section className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-[0_18px_44px_rgba(15,23,42,0.05)]">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF7A00]">
                как обрабатываем заявки
              </div>
              <div className="mt-4 space-y-3 text-sm leading-6 text-neutral-600">
                <p className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                  Менеджер получает заявку в рабочее время и проверяет
                  совместимость в каталогах.
                </p>
                <p className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                  После проверки связываемся с вами для уточнения наличия,
                  бренда и сроков поставки.
                </p>
                <p className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                  Если нужны варианты, предложим оригинал и доступные аналоги.
                </p>
              </div>
            </section>

            <section className="rounded-[2rem] border border-neutral-200 bg-[linear-gradient(135deg,#10264B_0%,#17315E_100%)] p-6 text-white shadow-[0_18px_44px_rgba(15,23,42,0.10)]">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/65">
                быстрый путь
              </div>
              <h3 className="mt-2 text-xl font-bold">
                Нужна консультация менеджера?
              </h3>
              <p className="mt-3 text-sm leading-6 text-white/78">
                Если VIN под рукой нет, можно перейти в каталог или оставить
                обычную заявку на подбор по детали.
              </p>
              <div className="mt-5 flex flex-col gap-3">
                <Link
                  href="/parts"
                  className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[#10264B] transition hover:bg-white/90"
                >
                  Открыть каталог
                </Link>
                <Link
                  href="/contacts#callback-form"
                  className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
                >
                  Заказать звонок
                </Link>
              </div>
            </section>
          </aside>
        </div>
      </section>

      <PublicFooter
        brandName={brandName}
        footerText={footerText}
        contactsLabel={navContacts}
      />
    </main>
  );
}
