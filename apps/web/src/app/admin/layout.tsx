'use client';

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import { getClientApiBaseUrl, withApiBase } from "@/lib/api-base-url";
import { ApiRequestError, fetchJsonWithTimeout } from "@/lib/fetch-json";

type UserRole = "admin" | "manager" | "service_manager";

type NavItem = {
  href: string;
  label: string;
  roles: UserRole[];
};

function roleLabel(role: UserRole): string {
  if (role === "admin") return "Admin";
  if (role === "manager") return "Manager (parts)";
  return "Service Manager";
}

const navItems: NavItem[] = [
  { href: "/admin", label: "Дашборд", roles: ["admin"] },
  { href: "/admin/content", label: "Редактор сайта", roles: ["admin"] },
  { href: "/admin/imports", label: "Импорты", roles: ["admin"] },
  { href: "/admin/users", label: "Пользователи", roles: ["admin"] },
  { href: "/admin/leads", label: "Заявки (запчасти)", roles: ["admin", "manager"] },
  { href: "/admin/vin-requests", label: "VIN-заявки", roles: ["admin", "manager"] },
  { href: "/admin/products", label: "Товары", roles: ["admin", "manager"] },
  { href: "/admin/categories", label: "Категории", roles: ["admin", "manager"] },
  { href: "/admin/orders", label: "Заказы", roles: ["admin"] },
  { href: "/admin/service-catalog", label: "Справочник услуг", roles: ["admin"] },
  { href: "/admin/service-requests", label: "Заявки (сервис)", roles: ["admin", "service_manager"] },
  { href: "/admin/reports", label: "Отчёты", roles: ["admin"] },
];

const navOrder: Record<string, number> = {
  "/admin": 1,
  "/admin/content": 2,
  "/admin/imports": 3,
  "/admin/users": 4,
  "/admin/leads": 5,
  "/admin/vin-requests": 6,
  "/admin/products": 7,
  "/admin/categories": 8,
  "/admin/service-requests": 9,
  "/admin/orders": 10,
  "/admin/service-catalog": 11,
  "/admin/reports": 12,
};

function canAccessPath(pathname: string, role: UserRole): boolean {
  if (role === "admin") {
    return true;
  }

  if (role === "manager") {
    return (
      pathname === "/admin/leads" ||
      pathname.startsWith("/admin/leads/") ||
      pathname === "/admin/vin-requests" ||
      pathname.startsWith("/admin/vin-requests/") ||
      pathname === "/admin/products" ||
      pathname.startsWith("/admin/products/") ||
      pathname === "/admin/categories" ||
      pathname.startsWith("/admin/categories/")
    );
  }

  if (role === "service_manager") {
    return (
      pathname === "/admin/service-requests" ||
      pathname.startsWith("/admin/service-requests/")
    );
  }

  return false;
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [menuSearch, setMenuSearch] = useState("");

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('admin_token');

      if (!token) {
        setIsAuthenticated(false);
        setUserRole(null);
        if (pathname !== '/admin/login') {
          router.push('/admin/login');
        }
        setIsLoading(false);
        return;
      }

      try {
        const apiBaseUrl = getClientApiBaseUrl();
        const profile = await fetchJsonWithTimeout<{ role?: string }>(
          withApiBase(apiBaseUrl, "/api/admin/auth/me"),
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
          7000
        );

        const role = profile.role;
        if (role !== "admin" && role !== "manager" && role !== "service_manager") {
          localStorage.removeItem("admin_token");
          Cookies.remove("admin_token", { path: "/" });
          setIsAuthenticated(false);
          setUserRole(null);
          router.push("/admin/login");
          setIsLoading(false);
          return;
        }

        setIsAuthenticated(true);
        setUserRole(role);

        if (pathname !== "/admin/login" && !canAccessPath(pathname, role)) {
          const fallback = navItems.find((item) => item.roles.includes(role));
          router.push(fallback?.href || "/admin/login");
          setIsLoading(false);
          return;
        }
      } catch (authError) {
        if (authError instanceof ApiRequestError && authError.status !== 401 && authError.status !== 403) {
          console.error(authError);
        }
        localStorage.removeItem("admin_token");
        Cookies.remove("admin_token", { path: "/" });
        setIsAuthenticated(false);
        setUserRole(null);
        router.push("/admin/login");
        setIsLoading(false);
        return;
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

  const visibleNavItems = userRole
    ? navItems
        .filter((item) => item.roles.includes(userRole))
        .sort((a, b) => (navOrder[a.href] ?? 999) - (navOrder[b.href] ?? 999))
    : [];
  const filteredNavItems = visibleNavItems.filter((item) =>
    item.label.toLowerCase().includes(menuSearch.trim().toLowerCase())
  );

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    Cookies.remove("admin_token", { path: "/" });
    router.push('/admin/login');
    router.refresh();
  };

  return (
    <div className="min-h-dvh bg-[#F5F7FA]">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/admin" className="text-xl font-bold text-[#1F3B73]">
              Админ-панель
            </Link>
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              {userRole ? (
                <span className="rounded-full bg-[#1F3B73]/10 px-3 py-1 text-xs font-medium text-[#1F3B73]">
                  {roleLabel(userRole)}
                </span>
              ) : null}
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

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-col gap-4 xl:flex-row xl:gap-8">
          {/* Sidebar */}
          <nav className="w-full shrink-0 xl:w-64">
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="mb-3">
                <input
                  type="text"
                  value={menuSearch}
                  onChange={(event) => setMenuSearch(event.target.value)}
                  placeholder="Поиск раздела..."
                  className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                {filteredNavItems.map((item) => (
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
              {filteredNavItems.length === 0 ? (
                <div className="rounded-xl border border-dashed border-neutral-200 px-3 py-4 text-center text-xs text-neutral-500">
                  Ничего не найдено
                </div>
              ) : null}
            </div>
          </nav>

          {/* Main content */}
          <main className="flex-1">
            <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
