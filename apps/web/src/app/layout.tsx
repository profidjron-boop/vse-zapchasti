import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Все запчасти | Автозапчасти и автосервис в Красноярске",
  description: "Оригинальные запчасти и профессиональный ремонт легковых и грузовых автомобилей в Красноярске. Подбор по VIN, запись на сервис.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
