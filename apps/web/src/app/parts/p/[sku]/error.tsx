'use client';

import Link from "next/link";

export default function ProductPageError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-dvh bg-[#F5F7FA] px-6 py-16 text-neutral-900">
      <section className="mx-auto max-w-3xl rounded-3xl border border-neutral-200 bg-white p-8 text-center">
        <h1 className="text-xl font-semibold text-[#1F3B73]">Ошибка загрузки товара</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Не удалось отобразить страницу. Попробуйте повторить запрос.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-2xl bg-[#1F3B73] px-4 py-2 text-sm font-medium text-white hover:bg-[#14294F]"
          >
            Повторить
          </button>
          <Link
            href="/parts"
            className="rounded-2xl border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            В каталог
          </Link>
        </div>
      </section>
    </main>
  );
}
