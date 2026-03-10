import type { Metadata } from "next";
import "./globals.css";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://127.0.0.1:3000";

export const metadata: Metadata = {
  title: "АвтоПлатформа | Готовый сайт запчастей и сервиса",
  description:
    "Готовое решение для каталога автозапчастей, заявок и сервисной записи. Нейтральный шаблон под бренд заказчика.",
  metadataBase: new URL(siteUrl),
  openGraph: {
    title: "АвтоПлатформа",
    description: "Готовое решение каталога запчастей и сервиса",
    type: "website",
    locale: "ru_RU",
    siteName: "АвтоПлатформа",
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
        <div id="main-content">{children}</div>
      </body>
    </html>
  );
}
