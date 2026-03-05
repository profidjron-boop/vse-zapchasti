'use client';

import Link from "next/link";
import { useState } from "react";
import { getClientApiBaseUrl, withApiBase } from "@/lib/api-base-url";

export default function VinRequestPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const data = {
      vin: formData.get("vin")?.toString().trim().toUpperCase(),
      name: formData.get("name")?.toString().trim() || undefined,
      phone: formData.get("phone")?.toString().trim(),
      email: formData.get("email") || undefined,
      message: formData.get("message")?.toString().trim() || undefined,
      consent_given: formData.get("consent") === "on",
      consent_version: "v1.0",
      consent_text: "Согласие на обработку персональных данных в соответствии с политикой конфиденциальности",
    };

    try {
      const apiBaseUrl = getClientApiBaseUrl();
      const response = await fetch(withApiBase(apiBaseUrl, "/api/public/vin-requests"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(payload?.detail || "Ошибка при отправке заявки");
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
                <Link href="/parts" className="text-sm font-medium text-[#1F3B73] border-b-2 border-[#1F3B73] pb-1">Запчасти</Link>
                <Link href="/service" className="text-sm font-medium text-neutral-700 hover:text-[#1F3B73]">Автосервис</Link>
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
              Менеджер свяжется с вами в рабочее время для уточнения деталей.
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

  return (
    <main className="min-h-dvh bg-[#F5F7FA] text-neutral-900">
      <header className="border-b border-white/20 bg-white/80 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold text-[#1F3B73]">Все запчасти</Link>
            <nav className="hidden items-center gap-8 md:flex">
              <Link href="/parts" className="text-sm font-medium text-[#1F3B73] border-b-2 border-[#1F3B73] pb-1">Запчасти</Link>
              <Link href="/service" className="text-sm font-medium text-neutral-700 hover:text-[#1F3B73]">Автосервис</Link>
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
          <h1 className="text-4xl font-bold text-white">VIN-заявка</h1>
          <p className="mt-4 max-w-2xl text-lg text-white/80">
            Не знаете точный артикул? Оставьте VIN — мы подберём запчасти по вашему автомобилю
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-16">
        <div className="rounded-3xl bg-white p-8 shadow-xl">
          {error && (
            <div className="mb-6 rounded-2xl bg-red-50 p-4 text-sm text-red-600 border border-red-200">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="text-sm font-medium text-neutral-700">VIN-номер *</label>
              <input 
                type="text" 
                name="vin"
                required
                placeholder="Например: XTA210930Y1234567" 
                className="mt-1 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 font-mono text-sm focus:border-[#1F3B73] focus:outline-none"
              />
              <p className="mt-1 text-xs text-neutral-500">VIN обычно состоит из 17 символов</p>
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700">Ваше имя</label>
              <input 
                type="text" 
                name="name"
                className="mt-1 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-[#1F3B73] focus:outline-none" 
              />
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700">Телефон *</label>
              <input 
                type="tel" 
                name="phone"
                required
                placeholder="+7 (___) ___-__-__" 
                className="mt-1 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-[#1F3B73] focus:outline-none" 
              />
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700">Email</label>
              <input 
                type="email" 
                name="email"
                className="mt-1 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-[#1F3B73] focus:outline-none" 
              />
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700">Что нужно найти?</label>
              <textarea 
                name="message"
                rows={4} 
                placeholder="Опишите деталь, которую ищете, или укажите дополнительные пожелания"
                className="mt-1 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-[#1F3B73] focus:outline-none"
              />
            </div>

            <div className="flex items-start gap-2">
              <input type="checkbox" name="consent" id="consent" className="mt-1" required />
              <label htmlFor="consent" className="text-xs text-neutral-600">
                Согласен на обработку персональных данных в соответствии с политикой конфиденциальности
              </label>
            </div>

            <div className="flex gap-4">
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="flex-1 rounded-2xl bg-[#FF7A00] py-4 font-medium text-white shadow-lg shadow-[#FF7A00]/20 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#e66e00] transition"
              >
                {isSubmitting ? "Отправка..." : "Отправить заявку"}
              </button>
              <Link 
                href="/parts" 
                className="flex-1 rounded-2xl border-2 border-neutral-200 py-4 text-center font-medium text-neutral-600 transition hover:bg-neutral-50"
              >
                Вернуться к поиску
              </Link>
            </div>
          </form>

          <div className="mt-8 rounded-2xl bg-[#1F3B73]/5 p-4">
            <h3 className="font-medium text-[#1F3B73]">Как мы обрабатываем VIN-заявки?</h3>
            <ul className="mt-2 space-y-2 text-sm text-neutral-600">
              <li>• Менеджер получает заявку в рабочее время</li>
              <li>• Проверяет совместимость по VIN в каталогах</li>
              <li>• Связывается с вами для уточнения деталей</li>
              <li>• Предлагает варианты и сроки поставки</li>
            </ul>
          </div>
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
