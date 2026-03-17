"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { getClientApiBaseUrl, withApiBase } from "@/lib/api-base-url";
import { ApiRequestError, fetchJsonWithTimeout } from "@/lib/fetch-json";

type UserRole = "admin" | "manager" | "service_manager";

type NavItem = {
  href: string;
  label: string;
  section: string;
  roles: UserRole[];
};

type NavAlerts = {
  leads: number;
  vinRequests: number;
  orders: number;
  serviceRequests: number;
};

const NAV_ALERTS_INITIAL: NavAlerts = {
  leads: 0,
  vinRequests: 0,
  orders: 0,
  serviceRequests: 0,
};

const ADMIN_NAV_SOUND_KEY = "admin_nav_sound_enabled_v1";
const ADMIN_ACCESS_TOKEN_KEY = "admin_access_token";
const ADMIN_ALERTS_POLL_MS = 20_000;

function roleLabel(role: UserRole): string {
  if (role === "admin") return "Администратор";
  if (role === "manager") return "Менеджер запчастей";
  return "Менеджер сервиса";
}

const navItems: NavItem[] = [
  { href: "/admin", label: "Дашборд", section: "Управление", roles: ["admin"] },
  {
    href: "/admin/content",
    label: "Редактор сайта",
    section: "Управление",
    roles: ["admin"],
  },
  {
    href: "/admin/reports",
    label: "Отчёты",
    section: "Управление",
    roles: ["admin"],
  },
  {
    href: "/admin/products",
    label: "Товары",
    section: "Каталог",
    roles: ["admin", "manager"],
  },
  {
    href: "/admin/categories",
    label: "Категории",
    section: "Каталог",
    roles: ["admin", "manager"],
  },
  {
    href: "/admin/imports",
    label: "Импорты",
    section: "Каталог",
    roles: ["admin"],
  },
  {
    href: "/admin/integrations",
    label: "Интеграции",
    section: "Система",
    roles: ["admin"],
  },
  {
    href: "/admin/leads",
    label: "Заявки (запчасти)",
    section: "Продажи",
    roles: ["admin", "manager"],
  },
  {
    href: "/admin/vin-requests",
    label: "VIN-заявки",
    section: "Продажи",
    roles: ["admin", "manager"],
  },
  {
    href: "/admin/orders",
    label: "Заказы",
    section: "Продажи",
    roles: ["admin"],
  },
  {
    href: "/admin/service-catalog",
    label: "Справочник услуг",
    section: "Сервис",
    roles: ["admin"],
  },
  {
    href: "/admin/service-requests",
    label: "Заявки (сервис)",
    section: "Сервис",
    roles: ["admin", "service_manager"],
  },
  {
    href: "/admin/users",
    label: "Пользователи",
    section: "Система",
    roles: ["admin"],
  },
];

const navOrder: Record<string, number> = {
  "/admin": 1,
  "/admin/content": 2,
  "/admin/imports": 3,
  "/admin/users": 4,
  "/admin/integrations": 4.5,
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
  const [navAlerts, setNavAlerts] = useState<NavAlerts>(NAV_ALERTS_INITIAL);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") {
      return true;
    }
    try {
      const stored = window.localStorage.getItem(ADMIN_NAV_SOUND_KEY);
      if (stored !== null) {
        return stored === "1";
      }
    } catch {
      // Ignore storage access errors.
    }
    return true;
  });
  const audioContextRef = useRef<AudioContext | null>(null);
  const isFirstAlertsLoadRef = useRef(true);

  const playAlertTone = useCallback(() => {
    try {
      const AudioContextCtor =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioContextCtor) {
        return;
      }
      const context = audioContextRef.current ?? new AudioContextCtor();
      audioContextRef.current = context;
      if (context.state === "suspended") {
        void context.resume();
      }

      const oscillator = context.createOscillator();
      const gainNode = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = 920;

      const now = context.currentTime;
      gainNode.gain.setValueAtTime(0.0001, now);
      gainNode.gain.exponentialRampToValueAtTime(0.15, now + 0.03);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

      oscillator.connect(gainNode);
      gainNode.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.3);
    } catch {
      // Ignore sound errors (browser policy/devices).
    }
  }, []);

  const fetchNewItemsCount = useCallback(
    async (apiBaseUrl: string, endpoint: string): Promise<number> => {
      try {
        const rows = await fetchJsonWithTimeout<unknown[]>(
          withApiBase(apiBaseUrl, endpoint),
          {},
          7000,
        );
        if (!Array.isArray(rows)) {
          return 0;
        }
        return rows.length;
      } catch (requestError) {
        if (
          requestError instanceof ApiRequestError &&
          (requestError.status === 401 || requestError.status === 403)
        ) {
          return 0;
        }
        return 0;
      }
    },
    [],
  );

  const loadNavAlerts = useCallback(async () => {
    if (!userRole || pathname === "/admin/login") {
      return;
    }
    const apiBaseUrl = getClientApiBaseUrl();

    const [leads, vinRequests, orders, serviceRequests] = await Promise.all([
      userRole === "service_manager"
        ? Promise.resolve(0)
        : fetchNewItemsCount(apiBaseUrl, "/api/admin/leads?status=new&limit=100"),
      userRole === "service_manager"
        ? Promise.resolve(0)
        : fetchNewItemsCount(
            apiBaseUrl,
            "/api/admin/vin-requests?status=new&limit=100",
          ),
      userRole === "admin"
        ? fetchNewItemsCount(apiBaseUrl, "/api/admin/orders?status=new&limit=100")
        : Promise.resolve(0),
      userRole === "manager"
        ? Promise.resolve(0)
        : fetchNewItemsCount(
            apiBaseUrl,
            "/api/admin/service-requests?status=new&limit=100",
          ),
    ]);

    setNavAlerts((previous) => {
      const next: NavAlerts = {
        leads,
        vinRequests,
        orders,
        serviceRequests,
      };

      const hasIncrease =
        next.leads > previous.leads ||
        next.vinRequests > previous.vinRequests ||
        next.orders > previous.orders ||
        next.serviceRequests > previous.serviceRequests;

      if (!isFirstAlertsLoadRef.current && soundEnabled && hasIncrease) {
        playAlertTone();
      }
      isFirstAlertsLoadRef.current = false;
      return next;
    });
  }, [fetchNewItemsCount, pathname, playAlertTone, soundEnabled, userRole]);

  useEffect(() => {
    if (!userRole || pathname === "/admin/login") {
      return;
    }
    void loadNavAlerts();
    const intervalId = window.setInterval(() => {
      void loadNavAlerts();
    }, ADMIN_ALERTS_POLL_MS);
    return () => window.clearInterval(intervalId);
  }, [loadNavAlerts, pathname, userRole]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const apiBaseUrl = getClientApiBaseUrl();
        const profile = await fetchJsonWithTimeout<{ role?: string }>(
          withApiBase(apiBaseUrl, "/api/admin/auth/me"),
          {},
          7000,
        );

        const role = profile.role;
        if (
          role !== "admin" &&
          role !== "manager" &&
          role !== "service_manager"
        ) {
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
        if (
          authError instanceof ApiRequestError &&
          authError.status !== 401 &&
          authError.status !== 403
        ) {
          console.error(authError);
        }
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

  if (!isAuthenticated && pathname !== "/admin/login") {
    return null;
  }

  if (pathname === "/admin/login") {
    return children;
  }

  const visibleNavItems = userRole
    ? navItems
        .filter((item) => item.roles.includes(userRole))
        .sort((a, b) => (navOrder[a.href] ?? 999) - (navOrder[b.href] ?? 999))
    : [];
  const filteredNavItems = visibleNavItems.filter((item) =>
    item.label.toLowerCase().includes(menuSearch.trim().toLowerCase()),
  );
  const groupedNavItems = filteredNavItems.reduce<Record<string, NavItem[]>>(
    (groups, item) => {
      const bucket = groups[item.section] ?? [];
      bucket.push(item);
      groups[item.section] = bucket;
      return groups;
    },
    {},
  );
  const navAlertsByHref: Record<string, number> = {
    "/admin/leads": navAlerts.leads,
    "/admin/vin-requests": navAlerts.vinRequests,
    "/admin/orders": navAlerts.orders,
    "/admin/service-requests": navAlerts.serviceRequests,
  };
  const totalNewAlerts =
    navAlerts.leads +
    navAlerts.vinRequests +
    navAlerts.orders +
    navAlerts.serviceRequests;
  const notificationsHref =
    userRole === "admin"
      ? "/admin#notification-center"
      : userRole === "manager"
        ? "/admin/leads?status=new"
        : "/admin/service-requests?status=new";

  const toggleSound = () => {
    setSoundEnabled((previous) => {
      const nextValue = !previous;
      try {
        window.localStorage.setItem(ADMIN_NAV_SOUND_KEY, nextValue ? "1" : "0");
      } catch {
        // Ignore storage access errors.
      }
      if (nextValue) {
        playAlertTone();
      }
      return nextValue;
    });
  };

  const handleLogout = async () => {
    const apiBaseUrl = getClientApiBaseUrl();
    try {
      await fetchJsonWithTimeout<{ ok: boolean }>(
        withApiBase(apiBaseUrl, "/api/admin/auth/logout"),
        { method: "POST" },
        7000,
      );
    } catch {
      // Best effort logout: redirect to login even if API logout failed.
    }

    try {
      window.localStorage.removeItem(ADMIN_ACCESS_TOKEN_KEY);
    } catch {
      // Ignore storage access errors.
    }

    router.push("/admin/login");
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
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  totalNewAlerts > 0
                    ? "border border-orange-300 bg-orange-50 text-orange-700"
                    : "border border-neutral-200 bg-neutral-50 text-neutral-500"
                }`}
              >
                Новые: {totalNewAlerts}
              </span>
              <Link
                href={notificationsHref}
                className="group relative inline-flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 transition hover:border-[#1F3B73]/30 hover:bg-[#1F3B73]/10 hover:text-[#1F3B73]"
                aria-label="Центр уведомлений"
                title="Центр уведомлений"
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path
                    d="M6.8 9.5a5.2 5.2 0 1 1 10.4 0v3.2l1.6 2.4H5.2l1.6-2.4V9.5Z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path d="M10.2 18a1.8 1.8 0 0 0 3.6 0" strokeLinecap="round" />
                </svg>
                {totalNewAlerts > 0 ? (
                  <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-orange-500 px-1 text-center text-[10px] font-bold leading-[18px] text-white">
                    {totalNewAlerts > 99 ? "99+" : totalNewAlerts}
                  </span>
                ) : null}
              </Link>
              <button
                type="button"
                onClick={toggleSound}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  soundEnabled
                    ? "border border-[#1F3B73]/30 bg-[#1F3B73]/10 text-[#1F3B73] hover:bg-[#1F3B73]/20"
                    : "border border-neutral-200 bg-neutral-50 text-neutral-600 hover:bg-neutral-100"
                }`}
                title="Звуковое уведомление о новых заявках/заказах"
              >
                Звук: {soundEnabled ? "Вкл" : "Выкл"}
              </button>
              <Link
                href="/"
                className="text-sm text-neutral-600 hover:text-[#1F3B73]"
              >
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
          <nav className="w-full shrink-0 xl:w-64">
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="mb-4 rounded-2xl bg-[linear-gradient(135deg,#1F3B73_0%,#17315E_100%)] px-4 py-4 text-white">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/65">
                  Панель управления
                </div>
                <div className="mt-2 text-lg font-bold">Рабочая панель</div>
                <div className="mt-1 text-sm text-white/75">
                  Навигация сгруппирована по бизнес-потокам.
                </div>
              </div>
              <div className="mb-3">
                <input
                  type="text"
                  value={menuSearch}
                  onChange={(event) => setMenuSearch(event.target.value)}
                  placeholder="Поиск раздела..."
                  className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
                />
              </div>
              <div className="space-y-4">
                {Object.entries(groupedNavItems).map(([section, items]) => (
                  <div key={section}>
                    <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
                      {section}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                      {items.map((item) => {
                        const alertCount = navAlertsByHref[item.href] ?? 0;
                        const isAlertTracked = Object.prototype.hasOwnProperty.call(
                          navAlertsByHref,
                          item.href,
                        );
                        const isActive = pathname === item.href;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={`block rounded-xl px-4 py-3 text-sm font-medium transition ${
                              isActive
                                ? "bg-[#1F3B73] text-white"
                                : "text-neutral-600 hover:bg-neutral-100"
                            }`}
                          >
                            <span className="flex items-center justify-between gap-3">
                              <span>{item.label}</span>
                              {isAlertTracked ? (
                                <span
                                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                    isActive
                                      ? alertCount > 0
                                        ? "bg-white/20 text-white"
                                        : "bg-white/10 text-white/80"
                                      : alertCount > 0
                                        ? "bg-orange-100 text-orange-700"
                                        : "bg-neutral-100 text-neutral-500"
                                  }`}
                                >
                                  {alertCount > 99 ? "99+" : alertCount}
                                </span>
                              ) : null}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              {filteredNavItems.length === 0 ? (
                <div className="rounded-xl border border-dashed border-neutral-200 px-3 py-4 text-center text-xs text-neutral-500">
                  Ничего не найдено
                </div>
              ) : null}
            </div>
          </nav>

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
