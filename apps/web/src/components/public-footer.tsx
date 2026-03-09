import Link from "next/link";

type PublicFooterProps = {
  brandName?: string;
  footerText?: string;
  contactsLabel?: string;
  privacyLabel?: string;
  offerLabel?: string;
};

export function PublicFooter({
  brandName = "Все запчасти",
  footerText = "Все запчасти · Красноярск · NO CDN",
  contactsLabel = "Контакты",
  privacyLabel = "Политика конфиденциальности",
  offerLabel = "Публичная оферта",
}: PublicFooterProps) {
  return (
    <footer className="border-t border-neutral-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#FF7A00]">
              industrial parts
            </div>
            <div className="mt-2 text-2xl font-black tracking-tight text-[#1F3B73]">{brandName}</div>
            <p className="mt-3 max-w-md text-sm leading-6 text-neutral-600">{footerText}</p>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            <div className="space-y-3">
              <div className="text-sm font-semibold text-neutral-900">Каталог</div>
              <div className="flex flex-col gap-2 text-sm text-neutral-600">
                <Link href="/parts?direction=parts" className="transition-colors hover:text-[#1F3B73]">
                  Запчасти
                </Link>
                <Link href="/parts?direction=oils" className="transition-colors hover:text-[#1F3B73]">
                  Масла и расходники
                </Link>
                <Link href="/parts/vin" className="transition-colors hover:text-[#1F3B73]">
                  VIN-подбор
                </Link>
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-semibold text-neutral-900">Сервис</div>
              <div className="flex flex-col gap-2 text-sm text-neutral-600">
                <Link href="/service" className="transition-colors hover:text-[#1F3B73]">
                  Автосервис
                </Link>
                <Link href="/contacts#callback-form" className="transition-colors hover:text-[#1F3B73]">
                  Заказать звонок
                </Link>
                <Link href="/account/orders" className="transition-colors hover:text-[#1F3B73]">
                  Мои заказы
                </Link>
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-semibold text-neutral-900">Документы</div>
              <div className="flex flex-col gap-2 text-sm text-neutral-600">
                <Link href="/privacy" className="transition-colors hover:text-[#1F3B73]">
                  {privacyLabel}
                </Link>
                <Link href="/offer" className="transition-colors hover:text-[#1F3B73]">
                  {offerLabel}
                </Link>
                <Link href="/contacts" className="transition-colors hover:text-[#1F3B73]">
                  {contactsLabel}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
