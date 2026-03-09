'use client';

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { getClientApiBaseUrl, withApiBase } from "@/lib/api-base-url";
import { ApiRequestError, fetchJsonWithTimeout } from "@/lib/fetch-json";
import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";

function normalizePhone(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  let normalized = digits;

  if (normalized.length === 11 && normalized.startsWith("8")) normalized = `7${normalized.slice(1)}`;
  if (normalized.length === 10) normalized = `7${normalized}`;

  if (normalized.length !== 11 || !normalized.startsWith("7")) return null;
  return `+${normalized}`;
}

export default function ContactsPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [contentMap, setContentMap] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    async function fetchPublicContent() {
      try {
        const apiBaseUrl = getClientApiBaseUrl();
        const response = await fetch(withApiBase(apiBaseUrl, "/api/public/content"), { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as Array<{ key?: string; value?: string | null }>;
        if (!Array.isArray(payload)) return;

        const nextMap: Record<string, string> = {};
        for (const item of payload) {
          if (item?.key && typeof item.value === "string") {
            nextMap[item.key] = item.value;
          }
        }

        if (!cancelled) {
          setContentMap(nextMap);
        }
      } catch {
        // keep defaults
      }
    }

    void fetchPublicContent();
    return () => {
      cancelled = true;
    };
  }, []);

  const contentValue = useMemo(
    () => (key: string, fallback: string): string => {
      const value = contentMap[key];
      return value && value.trim() ? value : fallback;
    },
    [contentMap],
  );

  const toTelHref = useMemo(
    () => (displayPhone: string, fallbackHref: string): string => {
      const digits = displayPhone.replace(/\D/g, "");
      if (!digits) return fallbackHref;
      if (digits.length === 11 && digits.startsWith("8")) {
        return `tel:+7${digits.slice(1)}`;
      }
      if (digits.length === 11 && digits.startsWith("7")) {
        return `tel:+${digits}`;
      }
      return fallbackHref;
    },
    [],
  );

  const contactAddress = contentValue("contacts_address", "660000, г. Красноярск, пр. Металлургов, 2В");
  const scheduleWeekdays = contentValue("contacts_schedule_weekdays", "09:00 – 19:00");
  const scheduleSaturday = contentValue("contacts_schedule_saturday", "10:00 – 17:00");
  const scheduleSunday = contentValue("contacts_schedule_sunday", "Выходной");

  const phoneParts = contentValue("contacts_phone_parts", "+7 (391) 258-95-00");
  const phoneService = contentValue("contacts_phone_service", "+7 (391) 258-95-01");
  const phoneMain = contentValue("contacts_phone_main", "+7 (391) 258-95-00");

  const emailInfo = contentValue("contacts_email_info", "info@vsezapchasti.ru");
  const emailService = contentValue("contacts_email_service", "service@vsezapchasti.ru");
  const emailPrivacy = contentValue("contacts_email_privacy", "privacy@vsezapchasti.ru");

  const legalName = contentValue("contacts_legal_name", "ИП Иванов Иван Иванович");
  const legalInn = contentValue("contacts_inn", "246500123456");
  const legalOgrnip = contentValue("contacts_ogrnip", "321246800123456");
  const legalAddress = contentValue("contacts_legal_address", "660000, г. Красноярск, ул. Ленина, 1");
  const legalBankAccount = contentValue("contacts_bank_account", "40802810900001234567");
  const legalBankName = contentValue("contacts_bank_name", "ПАО Сбербанк г. Красноярск");
  const legalBik = contentValue("contacts_bank_bik", "040407123");

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

  const mapYandexUrl = contentValue(
    "contacts_map_yandex_url",
    "https://yandex.ru/maps/?text=%D0%9A%D1%80%D0%B0%D1%81%D0%BD%D0%BE%D1%8F%D1%80%D1%81%D0%BA%2C%20%D0%BF%D1%80.%20%D0%9C%D0%B5%D1%82%D0%B0%D0%BB%D0%BB%D1%83%D1%80%D0%B3%D0%BE%D0%B2%2C%202%D0%92",
  );
  const map2gisUrl = contentValue(
    "contacts_map_2gis_url",
    "https://2gis.ru/krasnoyarsk/search/%D0%BF%D1%80.%20%D0%9C%D0%B5%D1%82%D0%B0%D0%BB%D0%BB%D1%83%D1%80%D0%B3%D0%BE%D0%B2%202%D0%92",
  );

  async function handleCallbackSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const consentGiven = formData.get("consent") === "on";
    const rawPhone = formData.get("phone")?.toString().trim() || "";
    const phone = normalizePhone(rawPhone);

    if (!phone) {
      setError("Проверьте телефон. Нужен формат РФ: +7XXXXXXXXXX.");
      setIsSubmitting(false);
      return;
    }

    const payload = {
      type: "callback",
      name: formData.get("name")?.toString().trim() || undefined,
      phone,
      email: formData.get("email")?.toString().trim() || undefined,
      message: formData.get("message")?.toString().trim() || undefined,
      consent_given: consentGiven,
      consent_version: "v1.0",
    };

    try {
      const apiBaseUrl = getClientApiBaseUrl();
      await fetchJsonWithTimeout(
        withApiBase(apiBaseUrl, "/api/public/leads"),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
        12000,
      );

      form.reset();
      setSuccess("Заявка на обратный звонок отправлена. Менеджер свяжется с вами в рабочее время.");
    } catch (submitError) {
      if (submitError instanceof ApiRequestError) {
        setError(submitError.traceId ? `${submitError.message}. Код: ${submitError.traceId}` : submitError.message);
      } else {
        setError("Не удалось отправить заявку. Попробуйте позже.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const contactCards = [
    {
      title: "Отдел запчастей",
      value: phoneParts,
      href: toTelHref(phoneParts, "tel:+73912589500"),
      description: "Подбор, наличие, статусы и уточнение заказов.",
    },
    {
      title: "Автосервис",
      value: phoneService,
      href: toTelHref(phoneService, "tel:+73912589501"),
      description: "Запись на диагностику, ТО и ремонт.",
    },
    {
      title: "Единая линия",
      value: phoneMain,
      href: toTelHref(phoneMain, "tel:+73912589500"),
      description: "Общий номер для консультации и распределения запросов.",
    },
  ];

  return (
    <main className="min-h-dvh bg-[#F3F5F8] text-neutral-900">
      <PublicHeader
        brandName={brandName}
        activeKey="contacts"
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
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)] lg:py-14">
          <div className="rounded-[2rem] bg-[linear-gradient(135deg,#1F3B73_0%,#17315E_65%,#10264B_100%)] p-8 text-white shadow-[0_30px_80px_rgba(31,59,115,0.18)]">
            <div className="inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
              contacts · callback · route
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">Контакты и реквизиты</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/78 sm:text-lg">
              Приезжайте, звоните или отправляйте заявку онлайн. Работаем в Красноярске, принимаем обращения по каталогу и сервису.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                `Пн–Пт ${scheduleWeekdays}`,
                `Сб ${scheduleSaturday}`,
                `Вс ${scheduleSunday}`,
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-white/8 p-4 text-sm font-medium text-white/78">
                  {item}
                </div>
              ))}
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href={toTelHref(phoneMain, "tel:+73912589500")}
                className="inline-flex items-center justify-center rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-[#1F3B73] transition-colors hover:bg-[#EEF3FF]"
              >
                Позвонить сейчас
              </a>
              <Link
                href="#callback-form"
                className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/16"
              >
                Заказать звонок
              </Link>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF7A00]">как добраться</div>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-[#10264B]">Адрес и точка обслуживания</h2>
              <p className="mt-3 text-sm leading-7 text-neutral-600">
                {contactAddress}
              </p>
              <p className="mt-3 text-sm leading-7 text-neutral-600">
                Вход с торца здания, вывеска «Все запчасти». Пункт выдачи и приемка в сервис находятся по этому же адресу.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <a
                  href={mapYandexUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-2xl bg-[#1F3B73] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#14294F]"
                >
                  Открыть в Яндекс Картах
                </a>
                <a
                  href={map2gisUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-2xl border border-neutral-200 bg-white px-5 py-3 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
                >
                  Открыть в 2GIS
                </a>
              </div>
            </div>

            <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-[0_18px_44px_rgba(15,23,42,0.05)]">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF7A00]">почта</div>
              <div className="mt-4 space-y-3 text-sm">
                <a href={`mailto:${emailInfo}`} className="block rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 font-medium text-[#1F3B73] transition-colors hover:bg-white">
                  {emailInfo}
                </a>
                <a href={`mailto:${emailService}`} className="block rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 font-medium text-[#1F3B73] transition-colors hover:bg-white">
                  {emailService}
                </a>
                <a href={`mailto:${emailPrivacy}`} className="block rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 font-medium text-[#1F3B73] transition-colors hover:bg-white">
                  {emailPrivacy}
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-4 md:grid-cols-3">
          {contactCards.map((card) => (
            <a
              key={card.title}
              href={card.href}
              className="rounded-[1.75rem] border border-neutral-200 bg-white p-6 shadow-[0_18px_44px_rgba(15,23,42,0.05)] transition-transform duration-200 hover:-translate-y-1 hover:shadow-[0_24px_55px_rgba(15,23,42,0.10)]"
            >
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF7A00]">{card.title}</div>
              <div className="mt-3 text-2xl font-black tracking-tight text-[#10264B]">{card.value}</div>
              <p className="mt-3 text-sm leading-6 text-neutral-600">{card.description}</p>
            </a>
          ))}
        </div>
      </section>

      <section className="bg-white py-12">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(24rem,0.85fr)]">
          <div className="rounded-[2rem] border border-neutral-200 bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_100%)] p-6 shadow-[0_18px_44px_rgba(15,23,42,0.05)] lg:p-8">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF7A00]">обратный звонок</div>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-[#10264B]">Напишите нам</h2>
            <p className="mt-3 text-sm leading-7 text-neutral-600 sm:text-base">
              Оставьте телефон и сообщение. Менеджер свяжется с вами в рабочее время по каталогу, заказу или сервисной записи.
            </p>

            {error ? (
              <div role="alert" aria-live="assertive" className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            ) : null}
            {success ? (
              <div role="status" aria-live="polite" className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
                {success}
              </div>
            ) : null}

            <form id="callback-form" onSubmit={handleCallbackSubmit} className="mt-8 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-neutral-700">Имя</label>
                  <input
                    type="text"
                    name="name"
                    autoComplete="name"
                    placeholder="Ваше имя"
                    className="mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 focus:border-[#1F3B73]/30 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-700">Телефон *</label>
                  <input
                    type="tel"
                    name="phone"
                    required
                    autoComplete="tel"
                    inputMode="tel"
                    placeholder="+7 (___) ___-__-__"
                    className="mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 focus:border-[#1F3B73]/30 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-700">Email</label>
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="Email"
                  className="mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 focus:border-[#1F3B73]/30 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-700">Сообщение</label>
                <textarea
                  name="message"
                  rows={4}
                  placeholder="Опишите вопрос или задачу"
                  className="mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 focus:border-[#1F3B73]/30 focus:outline-none"
                />
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <input type="checkbox" name="consent" id="contact-consent" className="mt-1" required />
                <label htmlFor="contact-consent" className="text-xs leading-6 text-neutral-600">
                  Согласен на обработку персональных данных в соответствии с политикой конфиденциальности.
                </label>
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-[#FF7A00] py-4 text-sm font-semibold text-white shadow-lg shadow-[#FF7A00]/20 transition-colors hover:bg-[#E86F00] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Отправка..." : "Отправить сообщение"}
              </button>
            </form>
          </div>

          <aside className="space-y-4">
            <div className="rounded-[2rem] bg-[linear-gradient(135deg,#10264B_0%,#1F3B73_100%)] p-6 text-white shadow-[0_28px_70px_rgba(16,38,75,0.18)]">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FFB166]">режим работы</div>
              <div className="mt-4 space-y-3 text-sm leading-6 text-white/78">
                <div className="rounded-2xl border border-white/10 bg-white/8 p-4">
                  Пн–Пт: {scheduleWeekdays}
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/8 p-4">
                  Сб: {scheduleSaturday}
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/8 p-4">
                  Вс: {scheduleSunday}
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/8 p-4">
                  Онлайн-заявки принимаются круглосуточно, обработка — в рабочее время.
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-[0_18px_44px_rgba(15,23,42,0.05)]">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF7A00]">реквизиты</div>
              <div className="mt-4 space-y-2 text-sm leading-6 text-neutral-600">
                <p className="font-semibold text-neutral-900">{legalName}</p>
                <p>ИНН {legalInn}</p>
                <p>ОГРНИП {legalOgrnip}</p>
                <p>Юр. адрес: {legalAddress}</p>
                <p>Расчетный счет: {legalBankAccount}</p>
                <p>Банк: {legalBankName}</p>
                <p>БИК: {legalBik}</p>
              </div>
            </div>

            <div className="overflow-hidden rounded-[2rem] border border-neutral-200 bg-white shadow-[0_18px_44px_rgba(15,23,42,0.05)]">
              <div className="relative h-56">
                <Image
                  src="/images/parts-store.jpg"
                  alt="Точка обслуживания Все запчасти"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="p-5">
                <div className="text-sm font-semibold text-neutral-900">Точка приёма и выдачи</div>
                <p className="mt-2 text-sm leading-6 text-neutral-600">
                  По одному адресу можно забрать заказ, уточнить подбор и передать автомобиль в сервис.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <PublicFooter brandName={brandName} footerText={footerText} contactsLabel={navContacts} />
    </main>
  );
}
