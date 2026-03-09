'use client';

import Link from "next/link";
import { useEffect, useState } from "react";
import { getClientApiBaseUrl, withApiBase } from "@/lib/api-base-url";
import { ApiRequestError, fetchJsonWithTimeout } from "@/lib/fetch-json";
import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";

type ServiceCard = {
  title: string;
  desc: string;
  icon: string;
  duration: string;
  price: string;
  prepaymentLabel?: string;
};

const fallbackServices: { passenger: ServiceCard[]; truck: ServiceCard[] } = {
  passenger: [
    { title: "Диагностика и ТО", desc: "Полная диагностика, плановое ТО, замена жидкостей", icon: "ТО", duration: "60 мин", price: "от 2 000 ₽" },
    { title: "Ремонт двигателя", desc: "Капитальный ремонт, замена ГРМ, диагностика", icon: "ДВС", duration: "180 мин", price: "от 8 000 ₽" },
    { title: "Ремонт КПП", desc: "Автомат, механика, вариатор — любой сложности", icon: "КПП", duration: "240 мин", price: "от 9 500 ₽" },
    { title: "Ходовая часть", desc: "Замена амортизаторов, рычагов, сайлентблоков", icon: "ХД", duration: "120 мин", price: "от 4 000 ₽" },
    { title: "Автоэлектрика", desc: "Диагностика электрики, ремонт генератора, стартера", icon: "ЭЛ", duration: "90 мин", price: "от 3 500 ₽" },
    { title: "Шиномонтаж", desc: "Сезонная замена, балансировка, ремонт проколов", icon: "ШМ", duration: "45 мин", price: "от 1 500 ₽" },
  ],
  truck: [
    { title: "Диагностика грузовых", desc: "Компьютерная диагностика, проверка систем", icon: "DG", duration: "90 мин", price: "от 3 000 ₽" },
    { title: "Ремонт ДВС", desc: "Капитальный ремонт двигателей грузовиков", icon: "DT", duration: "300 мин", price: "от 15 000 ₽" },
    { title: "Ремонт КПП", desc: "Ремонт коробок передач ZF, Eaton и других систем", icon: "TG", duration: "300 мин", price: "от 16 000 ₽" },
    { title: "Ходовая часть", desc: "Замена рессор, сайлентблоков и амортизаторов", icon: "HC", duration: "180 мин", price: "от 7 000 ₽" },
    { title: "Электрика", desc: "Ремонт электропроводки и диагностика CAN-шин", icon: "EL", duration: "120 мин", price: "от 5 000 ₽" },
    { title: "ТО грузовиков", desc: "Плановое ТО, замена масел и фильтров", icon: "TR", duration: "90 мин", price: "от 4 500 ₽" },
  ],
};

function normalizePhone(value: string): string {
  let digits = value.replace(/\D/g, "");

  if (digits.length === 11 && digits.startsWith("8")) {
    digits = `7${digits.slice(1)}`;
  } else if (digits.length === 10) {
    digits = `7${digits}`;
  }

  if (digits.length !== 11 || !digits.startsWith("7")) {
    throw new Error("Укажите корректный телефон РФ");
  }

  return `+${digits}`;
}

function normalizeVin(value: string): string | null {
  const normalized = value.trim().toUpperCase();
  if (!normalized) return null;
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(normalized)) {
    throw new Error("Проверьте VIN: нужны 17 символов без I, O, Q");
  }
  return normalized;
}

export default function ServicePage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");
  const [selectedServiceType, setSelectedServiceType] = useState("");
  const [contentMap, setContentMap] = useState<Record<string, string>>({});
  const [services, setServices] = useState(fallbackServices);
  const [installPrefill, setInstallPrefill] = useState<{
    requestedProductSku: string;
    requestedProductName: string;
    requestedBundleTotal: number | null;
    installWithPartFlow: boolean;
  }>({
    requestedProductSku: "",
    requestedProductName: "",
    requestedBundleTotal: null,
    installWithPartFlow: false,
  });

  const requestedProductSku = installPrefill.requestedProductSku;
  const requestedProductName = installPrefill.requestedProductName;
  const requestedBundleTotalFromQuery = installPrefill.requestedBundleTotal;
  const hasRequestedBundleTotal = typeof requestedBundleTotalFromQuery === "number";
  const installWithPartFlow = installPrefill.installWithPartFlow;
  const installServiceType = "Установка запчасти из каталога";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sku = (params.get("product_sku") || params.get("requested_product_sku") || "").trim().toUpperCase();
    const name = (params.get("product_name") || params.get("requested_product_name") || "").trim();
    const rawBundleTotal = (params.get("bundle_total") || "").trim().replace(",", ".");
    const parsedBundleTotal = Number.parseFloat(rawBundleTotal);
    const bundleTotal = Number.isFinite(parsedBundleTotal) && parsedBundleTotal >= 0 ? parsedBundleTotal : null;
    const flow = Boolean(sku || name || params.get("install_with_part") === "1");
    setInstallPrefill({
      requestedProductSku: sku,
      requestedProductName: name,
      requestedBundleTotal: bundleTotal,
      installWithPartFlow: flow,
    });
    if (flow) {
      setSelectedServiceType(installServiceType);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadContent() {
      try {
        const apiBaseUrl = getClientApiBaseUrl();
        const response = await fetch(withApiBase(apiBaseUrl, "/api/public/content"), { cache: "no-store" });
        if (!response.ok) return;

        const payload = (await response.json()) as Array<{ key?: string; value?: string | null }>;
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

  useEffect(() => {
    let cancelled = false;

    async function loadServiceCatalog() {
      try {
        const apiBaseUrl = getClientApiBaseUrl();
        const response = await fetch(withApiBase(apiBaseUrl, "/api/public/service-catalog"), { cache: "no-store" });
        if (!response.ok) return;

        const payload = (await response.json()) as Array<{
          name?: string;
          vehicle_type?: string;
          duration_minutes?: number | null;
          price?: number | null;
          prepayment_required?: boolean;
          prepayment_amount?: number | null;
        }>;

        if (!Array.isArray(payload) || cancelled) return;

        const passenger: ServiceCard[] = [];
        const truck: ServiceCard[] = [];

        for (const item of payload) {
          if (!item?.name || typeof item.name !== "string") continue;

          const durationLabel =
            typeof item.duration_minutes === "number" && item.duration_minutes > 0
              ? `${Math.round(item.duration_minutes)} мин`
              : "по согласованию";
          const priceLabel =
            typeof item.price === "number"
              ? `от ${Math.round(item.price).toLocaleString("ru-RU")} ₽`
              : "цена по запросу";

          const title = item.name.trim();
          const iconSeed = title
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase() ?? "")
            .join("")
            .slice(0, 3);

          const card: ServiceCard = {
            title,
            desc: "Услуга сервисного центра",
            icon: iconSeed || "SV",
            duration: durationLabel,
            price: priceLabel,
            prepaymentLabel:
              item.prepayment_required && typeof item.prepayment_amount === "number" && item.prepayment_amount > 0
                ? `Предоплата ${Math.round(item.prepayment_amount).toLocaleString("ru-RU")} ₽`
                : undefined,
          };

          const vehicleType = String(item.vehicle_type || "").toLowerCase();
          if (vehicleType === "truck") {
            truck.push(card);
          } else if (vehicleType === "both") {
            passenger.push(card);
            truck.push(card);
          } else {
            passenger.push(card);
          }
        }

        if (!cancelled && (passenger.length > 0 || truck.length > 0)) {
          setServices({
            passenger: passenger.length > 0 ? passenger : fallbackServices.passenger,
            truck: truck.length > 0 ? truck : fallbackServices.truck,
          });
        }
      } catch {
        // keep fallback services
      }
    }

    void loadServiceCatalog();
    return () => {
      cancelled = true;
    };
  }, []);

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
  const heroTitle = contentValue("service_hero_title", "Автосервис в Красноярске");
  const heroSubtitle = contentValue("service_hero_subtitle", "Профессиональный ремонт и обслуживание автомобилей");
  const formTitle = contentValue("service_form_title", "Заявка на обслуживание");
  const formSubtitle = contentValue(
    "service_form_subtitle",
    "Заполните форму — менеджер свяжется с вами для подтверждения",
  );
  const successTitle = contentValue("service_success_title", "Заявка отправлена!");
  const successText = contentValue(
    "service_success_text",
    "Менеджер свяжется с вами в рабочее время для подтверждения записи.",
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError("");

    const formData = new FormData(event.currentTarget);

    try {
      const rawPhone = String(formData.get("phone") || "");
      const normalizedPhone = normalizePhone(rawPhone);
      const description = String(formData.get("description") || "").trim();
      const normalizedVin = normalizeVin(String(formData.get("vin") || ""));
      const requestedProductSkuValue = String(formData.get("requested_product_sku") || "").trim().toUpperCase();
      const requestedProductNameValue = String(formData.get("requested_product_name") || "").trim();
      const estimatedBundleTotalRaw = String(formData.get("estimated_bundle_total") || "").trim().replace(",", ".");
      let estimatedBundleTotal: number | undefined;
      if (estimatedBundleTotalRaw) {
        const parsed = Number.parseFloat(estimatedBundleTotalRaw);
        if (!Number.isFinite(parsed) || parsed < 0) {
          throw new Error("Оценка комплекта должна быть числом не меньше 0");
        }
        estimatedBundleTotal = parsed;
      }
      const includeInstallWithPart = formData.get("install_with_part") === "on";
      const effectiveRequestedProductSku = includeInstallWithPart ? requestedProductSkuValue : "";
      const effectiveRequestedProductName = includeInstallWithPart ? requestedProductNameValue : "";
      const effectiveEstimatedBundleTotal = includeInstallWithPart ? estimatedBundleTotal : undefined;
      const installWithPart = includeInstallWithPart
        && Boolean(effectiveRequestedProductSku || effectiveRequestedProductName || typeof effectiveEstimatedBundleTotal === "number");
      if (!description) {
        throw new Error("Опишите проблему или задачу для сервиса");
      }

      const data = {
        vehicle_type: formData.get("vehicle_type") === "truck" ? "truck" : "passenger",
        service_type: formData.get("service_type"),
        name: formData.get("name")?.toString().trim() || undefined,
        phone: normalizedPhone,
        email: formData.get("email") || undefined,
        vehicle_make: formData.get("vehicle_make") || undefined,
        vehicle_model: formData.get("vehicle_model") || undefined,
        vehicle_engine: formData.get("vehicle_engine")?.toString().trim() || undefined,
        vehicle_year: formData.get("vehicle_year") ? parseInt(formData.get("vehicle_year") as string, 10) : undefined,
        vin: normalizedVin || undefined,
        mileage: formData.get("mileage") ? parseInt(formData.get("mileage") as string, 10) : undefined,
        description,
        install_with_part: installWithPart,
        requested_product_sku: effectiveRequestedProductSku || undefined,
        requested_product_name: effectiveRequestedProductName || undefined,
        estimated_bundle_total: effectiveEstimatedBundleTotal,
        preferred_date: formData.get("preferred_date") || undefined,
        consent_given: formData.get("consent") === "on",
        consent_version: "v1.0",
      };

      const apiBaseUrl = getClientApiBaseUrl();
      await fetchJsonWithTimeout(
        withApiBase(apiBaseUrl, "/api/public/service-requests"),
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
        setError(err.traceId ? `${err.message}. Код: ${err.traceId}` : err.message);
      } else if (err instanceof Error && err.message) {
        setError(err.message);
      } else {
        setError("Не удалось отправить заявку. Попробуйте позже.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const serviceHeader = (
    <PublicHeader
      brandName={brandName}
      activeKey="service"
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

  const serviceBenefits = [
    "Запись оформляется заявкой, менеджер подтверждает удобное время.",
    "Работаем с легковыми и коммерческими автомобилями.",
    "Можно сразу приложить VIN, пробег и описание симптомов.",
  ];

  const processSteps = [
    "Выбираете направление работ и оставляете заявку.",
    "Менеджер уточняет детали, стоимость и время приёма.",
    "Подтверждаем запись и готовим сервис к вашему приезду.",
  ];

  const renderServiceCard = (service: ServiceCard) => (
    <article
      key={service.title}
      className="rounded-[1.75rem] border border-neutral-200 bg-white p-5 shadow-[0_18px_44px_rgba(15,23,42,0.05)] transition-transform duration-200 hover:-translate-y-1 hover:shadow-[0_24px_55px_rgba(15,23,42,0.10)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1F3B73] to-[#365CAD] text-sm font-black tracking-[0.12em] text-white">
          {service.icon}
        </div>
        <div className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-semibold text-neutral-600">
          {service.duration}
        </div>
      </div>
      <h3 className="mt-5 text-xl font-bold tracking-tight text-neutral-900">{service.title}</h3>
      <p className="mt-2 text-sm leading-6 text-neutral-600">{service.desc}</p>
      <div className="mt-5 text-2xl font-black tracking-tight text-[#1F3B73]">{service.price}</div>
      {service.prepaymentLabel ? (
        <div className="mt-2 inline-flex rounded-full bg-[#EEF3FF] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#1F3B73]">
          {service.prepaymentLabel}
        </div>
      ) : null}
    </article>
  );

  if (isSuccess) {
    return (
      <main className="min-h-dvh bg-[#F3F5F8] text-neutral-900">
        {serviceHeader}

        <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
          <div className="rounded-[2rem] border border-neutral-200 bg-white p-8 text-center shadow-[0_24px_70px_rgba(15,23,42,0.08)] lg:p-12">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#EEF3FF] text-3xl font-black text-[#1F3B73]">
              OK
            </div>
            <h1 className="mt-6 text-3xl font-black tracking-tight text-[#10264B]">{successTitle}</h1>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-neutral-600 sm:text-base">
              {successText}
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-2xl bg-[#1F3B73] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#14294F]"
              >
                Вернуться на главную
              </Link>
              <Link
                href="/parts"
                className="inline-flex items-center justify-center rounded-2xl border border-neutral-200 bg-white px-6 py-3 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
              >
                Открыть каталог
              </Link>
            </div>
          </div>
        </section>

        <PublicFooter brandName={brandName} footerText={footerText} contactsLabel={navContacts} />
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-[#F3F5F8] text-neutral-900">
      {serviceHeader}

      <section className="border-b border-neutral-200 bg-[linear-gradient(180deg,#f8fafc_0%,#eef3fb_100%)]">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)] lg:py-14">
          <div className="rounded-[2rem] bg-[linear-gradient(135deg,#1F3B73_0%,#17315E_65%,#10264B_100%)] p-8 text-white shadow-[0_30px_80px_rgba(31,59,115,0.18)]">
            <div className="inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
              service · diagnostics · maintenance
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">{heroTitle}</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/78 sm:text-lg">
              {heroSubtitle}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="#form"
                className="inline-flex items-center justify-center rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-[#1F3B73] transition-colors hover:bg-[#EEF3FF]"
              >
                Записаться на сервис
              </Link>
              <Link
                href="/parts"
                className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/16"
              >
                Перейти в каталог
              </Link>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {serviceBenefits.map((benefit) => (
                <div key={benefit} className="rounded-2xl border border-white/10 bg-white/8 p-4 text-sm leading-6 text-white/76">
                  {benefit}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF7A00]">маршрут записи</div>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-[#10264B]">Как проходит запись</h2>
              <div className="mt-5 space-y-3">
                {processSteps.map((step, index) => (
                  <div key={step} className="flex items-start gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1F3B73] text-sm font-black text-white">
                      {index + 1}
                    </div>
                    <p className="text-sm leading-6 text-neutral-600">{step}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Link
                href="#passenger-services"
                className="rounded-[1.75rem] border border-neutral-200 bg-white p-5 shadow-[0_18px_44px_rgba(15,23,42,0.05)] transition-colors hover:border-[#1F3B73]/15 hover:bg-[#F8FBFF]"
              >
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1F3B73]">легковые</div>
                <div className="mt-3 text-lg font-bold text-neutral-900">Открыть направления работ</div>
                <p className="mt-2 text-sm leading-6 text-neutral-600">
                  Диагностика, ТО, автоэлектрика, ходовая часть и другие направления.
                </p>
              </Link>
              <Link
                href="#truck-services"
                className="rounded-[1.75rem] border border-neutral-200 bg-white p-5 shadow-[0_18px_44px_rgba(15,23,42,0.05)] transition-colors hover:border-[#1F3B73]/15 hover:bg-[#F8FBFF]"
              >
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1F3B73]">грузовые</div>
                <div className="mt-3 text-lg font-bold text-neutral-900">Сервис для коммерческого транспорта</div>
                <p className="mt-2 text-sm leading-6 text-neutral-600">
                  Отдельные направления и работы для грузовых автомобилей и коммерческого парка.
                </p>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section id="passenger-services" className="mx-auto max-w-7xl scroll-mt-36 px-4 py-12 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF7A00]">легковые автомобили</div>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-[#10264B]">Направления работ</h2>
          </div>
          <Link
            href="#form"
            className="inline-flex items-center text-sm font-semibold text-[#1F3B73] transition-colors hover:text-[#14294F]"
          >
            Оставить заявку
          </Link>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {services.passenger.map(renderServiceCard)}
        </div>
      </section>

      <section id="truck-services" className="bg-white py-12 scroll-mt-36">
        <div className="mx-auto max-w-7xl scroll-mt-36 px-4 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF7A00]">коммерческий транспорт</div>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-[#10264B]">Грузовой сервис</h2>
            </div>
            <Link
              href="#form"
              className="inline-flex items-center text-sm font-semibold text-[#1F3B73] transition-colors hover:text-[#14294F]"
            >
              Оставить заявку
            </Link>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {services.truck.map(renderServiceCard)}
          </div>
        </div>
      </section>

      <section id="form" className="mx-auto max-w-7xl scroll-mt-36 px-4 py-12 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(24rem,0.85fr)]">
          <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-[0_18px_44px_rgba(15,23,42,0.05)] lg:p-8">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF7A00]">заявка на обслуживание</div>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-[#10264B]">{formTitle}</h2>
            <p className="mt-3 text-sm leading-7 text-neutral-600 sm:text-base">
              {formSubtitle}
            </p>

            {error ? (
              <div
                role="alert"
                aria-live="assertive"
                className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600"
              >
                {error}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-neutral-700">Вид работ *</label>
                  <select
                    name="service_type"
                    required
                    value={selectedServiceType}
                    onChange={(event) => setSelectedServiceType(event.target.value)}
                    className="mt-1 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-[#1F3B73]/30 focus:bg-white focus:outline-none"
                  >
                    <option value="">Выберите направление</option>
                    <option value={installServiceType}>{installServiceType}</option>
                    <optgroup label="Легковые">
                      {services.passenger.map((service) => (
                        <option key={`passenger-${service.title}`} value={service.title}>
                          {service.title} · {service.duration} · {service.price}
                          {service.prepaymentLabel ? ` · ${service.prepaymentLabel}` : ""}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Грузовые">
                      {services.truck.map((service) => (
                        <option key={`truck-${service.title}`} value={service.title}>
                          {service.title} · {service.duration} · {service.price}
                          {service.prepaymentLabel ? ` · ${service.prepaymentLabel}` : ""}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-700">Тип авто *</label>
                  <select
                    name="vehicle_type"
                    required
                    className="mt-1 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-[#1F3B73]/30 focus:bg-white focus:outline-none"
                  >
                    <option value="passenger">Легковой</option>
                    <option value="truck">Грузовой</option>
                  </select>
                </div>
              </div>

              {installWithPartFlow ? (
                <div className="rounded-2xl border border-[#1F3B73]/15 bg-[#EEF3FF] p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1F3B73]">
                    Связка: запчасть + установка
                  </div>
                  <p className="mt-2 text-sm leading-6 text-neutral-600">
                    Заявка пришла из карточки товара. Менеджер рассчитает предварительную оценку работ и запчасти.
                  </p>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium text-neutral-700">Артикул запчасти</label>
                      <input
                        type="text"
                        name="requested_product_sku"
                        readOnly
                        value={requestedProductSku}
                        className="mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-neutral-700 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-neutral-700">Название запчасти</label>
                      <input
                        type="text"
                        name="requested_product_name"
                        readOnly
                        value={requestedProductName}
                        className="mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-neutral-700 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="mt-3 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                    <div>
                      <label className="text-sm font-medium text-neutral-700">Оценка комплекта (запчасть + работы), ₽</label>
                      <input
                        type="number"
                        name="estimated_bundle_total"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        defaultValue={hasRequestedBundleTotal ? requestedBundleTotalFromQuery.toFixed(2) : ""}
                        placeholder="Опционально"
                        className="mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 focus:border-[#1F3B73]/30 focus:outline-none"
                      />
                    </div>
                    <label className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700">
                      <input type="checkbox" name="install_with_part" defaultChecked className="h-4 w-4" />
                      Включить в заявку
                    </label>
                  </div>
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-neutral-700">Имя</label>
                  <input
                    type="text"
                    name="name"
                    autoComplete="name"
                    className="mt-1 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-[#1F3B73]/30 focus:bg-white focus:outline-none"
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
                    className="mt-1 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-[#1F3B73]/30 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-neutral-700">Email</label>
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    className="mt-1 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-[#1F3B73]/30 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-700">Предпочтительная дата</label>
                  <input
                    type="date"
                    name="preferred_date"
                    className="mt-1 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-[#1F3B73]/30 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-neutral-700">Марка</label>
                  <input
                    type="text"
                    name="vehicle_make"
                    placeholder="Например: Toyota"
                    className="mt-1 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-[#1F3B73]/30 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-700">Модель</label>
                  <input
                    type="text"
                    name="vehicle_model"
                    placeholder="Например: Camry"
                    className="mt-1 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-[#1F3B73]/30 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="text-sm font-medium text-neutral-700">Год</label>
                  <input
                    type="number"
                    name="vehicle_year"
                    inputMode="numeric"
                    min="1950"
                    max="2100"
                    className="mt-1 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-[#1F3B73]/30 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-700">Двигатель</label>
                  <input
                    type="text"
                    name="vehicle_engine"
                    placeholder="Например: 2.0 TDI"
                    className="mt-1 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-[#1F3B73]/30 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-700">Пробег</label>
                  <input
                    type="number"
                    name="mileage"
                    inputMode="numeric"
                    min="0"
                    className="mt-1 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-[#1F3B73]/30 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-700">VIN</label>
                  <input
                    type="text"
                    name="vin"
                    placeholder="17 символов"
                    className="mt-1 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-[#1F3B73]/30 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-neutral-700">Причина обращения *</label>
                <textarea
                  name="description"
                  required
                  rows={4}
                  placeholder="Опишите неисправность, симптомы или задачу для сервиса"
                  className="mt-1 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-[#1F3B73]/30 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex items-start gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <input type="checkbox" name="consent" id="service-consent" className="mt-1" required />
                <label htmlFor="service-consent" className="text-xs leading-6 text-neutral-600">
                  Согласен на обработку персональных данных в соответствии с политикой конфиденциальности.
                </label>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-[#FF7A00] py-4 text-sm font-semibold text-white shadow-lg shadow-[#FF7A00]/20 transition-colors hover:bg-[#E86F00] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? "Отправка..." : "Отправить заявку"}
              </button>
            </form>
          </div>

          <aside className="space-y-4">
            <div className="rounded-[2rem] bg-[linear-gradient(135deg,#10264B_0%,#1F3B73_100%)] p-6 text-white shadow-[0_28px_70px_rgba(16,38,75,0.18)]">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FFB166]">что важно</div>
              <div className="mt-4 space-y-3">
                {[
                  "Запись подтверждается менеджером, а не формируется автоматически.",
                  "Можно сразу выбрать направление работ из каталога услуг.",
                  "Если по услуге предусмотрена предоплата, она будет указана в карточке.",
                ].map((item) => (
                  <div key={item} className="rounded-2xl border border-white/10 bg-white/8 p-4 text-sm leading-6 text-white/78">
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-[0_18px_44px_rgba(15,23,42,0.05)]">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF7A00]">быстрые переходы</div>
              <div className="mt-4 flex flex-col gap-3">
                <Link
                  href="/parts"
                  className="inline-flex items-center justify-center rounded-2xl border border-[#1F3B73]/15 bg-[#EEF3FF] px-4 py-3 text-sm font-semibold text-[#1F3B73] transition-colors hover:bg-[#E1EAFB]"
                >
                  Открыть каталог запчастей
                </Link>
                <Link
                  href="/parts/vin"
                  className="inline-flex items-center justify-center rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
                >
                  VIN-заявка
                </Link>
                <Link
                  href="/contacts"
                  className="inline-flex items-center justify-center rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
                >
                  Контакты сервиса
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <PublicFooter brandName={brandName} footerText={footerText} contactsLabel={navContacts} />
    </main>
  );
}
