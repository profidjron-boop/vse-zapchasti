import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="min-h-dvh bg-[#F5F7FA] px-6 py-16 text-neutral-900">
      <section className="mx-auto max-w-3xl rounded-3xl border border-neutral-200 bg-white p-8 text-center">
        <h1 className="text-xl font-semibold text-[#1F3B73]">
          Страница не найдена
        </h1>
        <p className="mt-2 text-sm text-neutral-600">
          Возможно, ссылка устарела или страница была перемещена.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="rounded-2xl bg-[#1F3B73] px-4 py-2 text-sm font-medium text-white hover:bg-[#14294F]"
          >
            Главная
          </Link>
          <Link
            href="/parts"
            className="rounded-2xl border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Каталог
          </Link>
          <Link
            href="/contacts"
            className="rounded-2xl border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Контакты
          </Link>
        </div>
      </section>
    </main>
  );
}
