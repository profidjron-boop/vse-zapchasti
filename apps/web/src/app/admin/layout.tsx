'use client';

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('admin_token');
      
      if (!token && pathname !== '/admin/login') {
        router.push('/admin/login');
        setIsAuthenticated(false);
      } else {
        setIsAuthenticated(true);
      }
      setIsLoading(false);
    };
    
    checkAuth();
  }, [pathname, router]);

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-[#F5F7FA] flex items-center justify-center">
        <div className="text-[#1F3B73]">Загрузка...</div>
      </div>
    );
  }

  if (!isAuthenticated && pathname !== '/admin/login') {
    return null;
  }

  if (pathname === '/admin/login') {
    return children;
  }

  const navItems = [
    { href: "/admin/content", label: "Редактор сайта" },
    { href: "/admin", label: "Дашборд" },
    { href: "/admin/vin-requests", label: "VIN-заявки" },
    { href: "/admin/leads", label: "Заявки (запчасти)" },
    { href: "/admin/service-requests", label: "Заявки (сервис)" },
    { href: "/admin/products", label: "Товары" },
    { href: "/admin/categories", label: "Категории" },
  ];

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    router.push('/admin/login');
    router.refresh();
  };

  return (
    <div className="min-h-dvh bg-[#F5F7FA]">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/admin" className="text-xl font-bold text-[#1F3B73]">
              Админ-панель
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/" className="text-sm text-neutral-600 hover:text-[#1F3B73]">
                ← На сайт
              </Link>
              <button
                onClick={handleLogout}
                className="text-sm text-red-600 hover:text-red-700"
              >
                Выйти
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex gap-8">
          {/* Sidebar */}
          <nav className="w-64 shrink-0">
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-xl px-4 py-3 text-sm font-medium transition ${
                    pathname === item.href
                      ? "bg-[#1F3B73] text-white"
                      : "text-neutral-600 hover:bg-neutral-100"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>

          {/* Main content */}
          <main className="flex-1">
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
