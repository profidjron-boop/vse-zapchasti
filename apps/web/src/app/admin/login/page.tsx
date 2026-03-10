"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getClientApiBaseUrl, withApiBase } from "@/lib/api-base-url";
import { ApiRequestError, fetchJsonWithTimeout } from "@/lib/fetch-json";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isLoading) return;
    setIsLoading(true);
    setError("");

    try {
      const formData = new URLSearchParams();
      formData.append("username", email);
      formData.append("password", password);

      const apiBaseUrl = getClientApiBaseUrl();
      await fetchJsonWithTimeout<{ access_token?: string }>(
        withApiBase(apiBaseUrl, "/api/admin/auth/token"),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: formData,
        },
        10000,
      );

      router.push("/admin");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        if (err.status === 401) {
          setError("Неверный email или пароль");
        } else {
          setError(
            err.traceId ? `${err.message}. Код: ${err.traceId}` : err.message,
          );
        }
      } else if (
        err instanceof TypeError ||
        (err instanceof Error && err.message.toLowerCase().includes("fetch"))
      ) {
        setError(
          "Не удалось подключиться к API. Проверьте, что backend запущен и API_BASE_URL настроен корректно.",
        );
      } else {
        setError(err instanceof Error ? err.message : "Ошибка входа");
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-dvh bg-[#F5F7FA] flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#1F3B73]">АвтоПлатформа</h1>
          <p className="text-neutral-600 mt-2">Вход в админ-панель</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-8">
          <div className="mb-6 min-h-[4.5rem]">
            {error ? (
              <div
                role="alert"
                aria-live="assertive"
                className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600"
              >
                {error}
              </div>
            ) : null}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
                className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-[#1F3B73] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Пароль
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-[#1F3B73] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-2xl bg-[#FF7A00] py-4 font-medium text-white shadow-lg shadow-[#FF7A00]/20 disabled:opacity-50 hover:bg-[#e66e00] transition"
            >
              {isLoading ? "Вход..." : "Войти"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
