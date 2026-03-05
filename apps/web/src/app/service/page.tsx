'use client';

import Link from "next/link";
import { useState } from "react";
import { getClientApiBaseUrl, withApiBase } from "@/lib/api-base-url";

export default function ServicePage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const data = {
      vehicle_type: formData.get("vehicle_type") === "truck" ? "truck" : "passenger",
      service_type: formData.get("service_type"),
      name: formData.get("name"),
      phone: formData.get("phone"),
      email: formData.get("email") || undefined,
      vehicle_make: formData.get("vehicle_make") || undefined,
      vehicle_model: formData.get("vehicle_model") || undefined,
      vehicle_year: formData.get("vehicle_year") ? parseInt(formData.get("vehicle_year") as string) : undefined,
      vin: formData.get("vin") || undefined,
      mileage: formData.get("mileage") ? parseInt(formData.get("mileage") as string) : undefined,
      description: formData.get("description") || undefined,
      preferred_date: formData.get("preferred_date") || undefined,
      consent_given: formData.get("consent") === "on",
      consent_version: "v1.0",
      consent_text: "Согласие на обработку персональных данных в соответствии с политикой конфиденциальности",
    };

    try {
      const apiBaseUrl = getClientApiBaseUrl();
      const response = await fetch(withApiBase(apiBaseUrl, "/api/public/service-requests"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Ошибка при отправке заявки");
      }

      setIsSuccess(true);
      event.currentTarget.reset();
    } catch (err) {
      setError("Не удалось отправить заявку. Попробуйте позже.");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isSuccess) {
    return (
      <main className="min-h-dvh bg-[#F5F7FA] text-neutral-900">
        <header className="border-b border-white/20 bg-white/80 backdrop-blur-md">
          <div className="mx-auto max-w-6xl px-6 py-4">
            <div className="flex items-center justify-between">
              <Link href="/" className="text-2xl font-bold text-[#1F3B73]">Все запчасти</Link>
              <nav className="hidden items-center gap-8 md:flex">
                <Link href="/parts" className="text-sm font-medium text-neutral-700 hover:text-[#1F3B73]">Запчасти</Link>
                <Link href="/service" className="text-sm font-medium text-[#1F3B73] border-b-2 border-[#1F3B73] pb-1">Автосервис</Link>
                <Link href="/contacts" className="text-sm font-medium text-neutral-700 hover:text-[#1F3B73]">Контакты</Link>
              </nav>
            </div>
          </div>
        </header>

        <section className="mx-auto max-w-3xl px-6 py-16">
          <div className="rounded-3xl bg-white p-8 text-center shadow-xl">
            <div className="text-6xl mb-4">✅</div>
            <h1 className="text-2xl font-bold text-[#1F3B73]">Заявка отправлена!</h1>
            <p className="mt-2 text-neutral-600">
              Менеджер свяжется с вами в рабочее время для подтверждения записи.
            </p>
            <Link
              href="/"
              className="mt-6 inline-block rounded-2xl bg-[#FF7A00] px-8 py-3 font-medium text-white hover:bg-[#e66e00]"
            >
              Вернуться на главную
            </Link>
          </div>
        </section>

        <footer className="border-t border-neutral-200 bg-neutral-50 py-8">
          <div className="mx-auto max-w-6xl px-6 text-center text-sm text-neutral-600">
            © {new Date().getFullYear()} Все запчасти · Красноярск · NO CDN
          </div>
        </footer>
      </main>
    );
  }

  const services = {
    passenger: [
      { title: "Диагностика и ТО", desc: "Полная диагностика, плановое ТО, замена жидкостей", icon: "🔧" },
      { title: "Ремонт двигателя", desc: "Капитальный ремонт, замена ГРМ, диагностика", icon: "⚙️" },
      { title: "Ремонт КПП", desc: "Автомат, механика, вариатор — любой сложности", icon: "🔄" },
      { title: "Ходовая часть", desc: "Замена амортизаторов, рычагов, сайлентблоков", icon: "🛞" },
      { title: "Автоэлектрика", desc: "Диагностика электрики, ремонт генератора, стартера", icon: "⚡" },
      { title: "Шиномонтаж", desc: "Сезонная замена, балансировка, ремонт проколов", icon: "🔩" }
    ],
    truck: [
      { title: "Диагностика грузовых", desc: "Компьютерная диагностика, проверка систем", icon: "🔧" },
      { title: "Ремонт ДВС", desc: "Капитальный ремонт двигателей грузовиков", icon: "⚙️" },
      { title: "Ремонт КПП", desc: "Ремонт коробок передач ZF, Eaton и др.", icon: "🔄" },
      { title: "Ходовая часть", desc: "Замена рессор, сайлентблоков, амортизаторов", icon: "🛞" },
      { title: "Электрика", desc: "Ремонт электропроводки, диагностика CAN-шин", icon: "⚡" },
      { title: "ТО грузовиков", desc: "Плановое ТО, замена масел и фильтров", icon: "🔩" }
    ]
  };

  return (
    <main className="min-h-dvh bg-[#F5F7FA] text-neutral-900">
      <header className="border-b border-white/20 bg-white/80 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold text-[#1F3B73]">Все запчасти</Link>
            <nav className="hidden items-center gap-8 md:flex">
              <Link href="/parts" className="text-sm font-medium text-neutral-700 hover:text-[#1F3B73]">Запчасти</Link>
              <Link href="/service" className="text-sm font-medium text-[#1F3B73] border-b-2 border-[#1F3B73] pb-1">Автосервис</Link>
              <Link href="/contacts" className="text-sm font-medium text-neutral-700 hover:text-[#1F3B73]">Контакты</Link>
            </nav>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden bg-gradient-to-br from-[#1F3B73] to-[#14294F] py-16">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-white blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-6xl px-6">
          <h1 className="text-4xl font-bold text-white">Автосервис в Красноярске</h1>
          <p className="mt-4 max-w-2xl text-lg text-white/80">
            Профессиональный ремонт и обслуживание автомобилей
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex gap-4 rounded-2xl bg-white p-2 shadow-sm">
          <Link 
            href="/service?type=passenger" 
            className="flex-1 rounded-xl bg-[#1F3B73] py-3 text-center font-medium text-white"
          >
            Легковые
          </Link>
          <Link 
            href="/service?type=truck" 
            className="flex-1 rounded-xl py-3 text-center font-medium text-neutral-600 hover:bg-neutral-100"
          >
            Грузовые
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-8">
        <h2 className="text-2xl font-bold text-[#1F3B73]">
          Легковые автомобили
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.passenger.map((work) => (
            <div key={work.title} className="rounded-2xl border border-neutral-200 bg-white p-6 transition hover:shadow-lg">
              <div className="text-4xl">{work.icon}</div>
              <h3 className="mt-4 text-lg font-semibold text-[#1F3B73]">{work.title}</h3>
              <p className="mt-2 text-sm text-neutral-600">{work.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="form" className="bg-white py-16 scroll-mt-20">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="text-center text-2xl font-bold text-[#1F3B73]">Заявка на обслуживание</h2>
          <p className="mt-2 text-center text-neutral-600">
            Заполните форму — менеджер свяжется с вами для подтверждения
          </p>
          
          {error && (
            <div className="mb-6 rounded-2xl bg-red-50 p-4 text-sm text-red-600 border border-red-200">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-neutral-700">Вид работ *</label>
                <select name="service_type" required className="mt-1 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-[#1F3B73] focus:outline-none">
                  <option value="">Выберите направление</option>
                  {services.passenger.map(s => (
                    <option key={s.title} value={s.title}>{s.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-700">Тип авто *</label>
                <select name="vehicle_type" required className="mt-1 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-[#1F3B73] focus:outline-none">
                  <option value="passenger">Легковой</option>
                  <option value="truck">Грузовой</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700">Ваше имя *</label>
              <input type="text" name="name" required className="mt-1 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-[#1F3B73] focus:outline-none" />
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700">Телефон *</label>
              <input type="tel" name="phone" required className="mt-1 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-[#1F3B73] focus:outline-none" />
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700">Марка и модель авто</label>
              <input type="text" name="vehicle_make" placeholder="Например: Toyota Camry" className="mt-1 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-[#1F3B73] focus:outline-none" />
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700">VIN (если есть)</label>
              <input type="text" name="vin" className="mt-1 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-[#1F3B73] focus:outline-none" />
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700">Желаемая дата</label>
              <input type="date" name="preferred_date" className="mt-1 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-[#1F3B73] focus:outline-none" />
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700">Причина обращения</label>
              <textarea name="description" rows={3} className="mt-1 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-[#1F3B73] focus:outline-none" />
            </div>

            <div className="flex items-start gap-2">
              <input type="checkbox" name="consent" id="consent" className="mt-1" required />
              <label htmlFor="consent" className="text-xs text-neutral-600">
                Согласен на обработку персональных данных в соответствии с политикой конфиденциальности
              </label>
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full rounded-2xl bg-[#FF7A00] py-4 font-medium text-white shadow-lg shadow-[#FF7A00]/20 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#e66e00] transition"
            >
              {isSubmitting ? "Отправка..." : "Отправить заявку"}
            </button>
          </form>
        </div>
      </section>

      <footer className="border-t border-neutral-200 bg-neutral-50 py-8">
        <div className="mx-auto max-w-6xl px-6 text-center text-sm text-neutral-600">
          © {new Date().getFullYear()} Все запчасти · Красноярск · NO CDN
        </div>
      </footer>
    </main>
  );
}
