'use client';

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getClientApiBaseUrl, withApiBase } from "@/lib/api-base-url";

type UserRole = "admin" | "manager" | "service_manager";

type NavItem = {
  href: string;
  label: string;
  roles: UserRole[];
};

const navItems: NavItem[] = [
  { href: "/admin", label: "Дашборд", roles: ["admin"] },
  { href: "/admin/content", label: "Редактор сайта", roles: ["admin"] },
  { href: "/admin/leads", label: "Заявки (запчасти)", roles: ["admin", "manager"] },
  { href: "/admin/vin-requests", label: "VIN-заявки", roles: ["admin", "manager"] },
  { href: "/admin/products", label: "Товары", roles: ["admin", "manager"] },
  { href: "/admin/categories", label: "Категории", roles: ["admin", "manager"] },
  { href: "/admin/service-requests", label: "Заявки (сервис)", roles: ["admin", "service_manager"] },
];

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
    return pathname === "/admin/service-requests" || pathname.startsWith("/admin/service-requests/");
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

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('admin_token');
      
      if (!token && pathname !== '/admin/login') {
        router.push('/admin/login');
        setIsAuthenticated(false);
        setUserRole(null);
      } else {
        try {
          const apiBaseUrl = getClientApiBaseUrl();
          const response = await fetch(withApiBase(apiBaseUrl, "/api/admin/auth/me"), {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (!response.ok) {
            localStorage.removeItem("admin_token");
            setIsAuthenticated(false);
            setUserRole(null);
            router.push("/admin/login");
            return;
          }

          const profile = (await response.json()) as { role?: string };
          const role = profile.role;
          if (role !== "admin" && role !== "manager" && role !== "service_manager") {
            localStorage.removeItem("admin_token");
            setIsAuthenticated(false);
            setUserRole(null);
            router.push("/admin/login");
            return;
          }

          setIsAuthenticated(true);
          setUserRole(role);

          if (pathname !== "/admin/login" && !canAccessPath(pathname, role)) {
            const fallback = navItems.find((item) => item.roles.includes(role));
            router.push(fallback?.href || "/admin/login");
            return;
          }
        } catch {
          localStorage.removeItem("admin_token");
          setIsAuthenticated(false);
          setUserRole(null);
          router.push("/admin/login");
          return;
        }
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

  const visibleNavItems = userRole ? navItems.filter((item) => item.roles.includes(userRole)) : [];

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
              {visibleNavItems.map((item) => (
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
