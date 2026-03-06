import type { Metadata } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://127.0.0.1:3000";

export const metadata: Metadata = {
  title: "Все запчасти | Автозапчасти и автосервис в Красноярске",
  description: "Оригинальные запчасти и профессиональный ремонт легковых и грузовых автомобилей в Красноярске. Подбор по VIN, запись на сервис.",
  metadataBase: new URL(siteUrl),
  openGraph: {
    title: "Все запчасти",
    description: "Автозапчасти и автосервис в Красноярске",
    type: "website",
    locale: "ru_RU",
    siteName: "Все запчасти",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[#1F3B73] focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
        >
          Перейти к основному содержимому
        </a>
        <div id="main-content">
          {children}
        </div>
      </body>
    </html>
  );
}
