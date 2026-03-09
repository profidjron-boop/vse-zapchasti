'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getClientApiBaseUrl, withApiBase } from "@/lib/api-base-url";
import { ApiRequestError, fetchJsonWithTimeout } from "@/lib/fetch-json";

type UserRole = "admin" | "manager" | "service_manager";

type AdminUser = {
  id: number;
  email: string;
  name: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type UserDraft = {
  name: string;
  role: UserRole;
  is_active: boolean;
  password: string;
};

const roleOptions: Array<{ value: UserRole; label: string }> = [
  { value: "admin", label: "Администратор" },
  { value: "manager", label: "Менеджер запчастей" },
  { value: "service_manager", label: "Менеджер сервиса" },
];

const PAGE_SIZE = 50;

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [drafts, setDrafts] = useState<Record<number, UserDraft>>({});
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [pageInput, setPageInput] = useState("1");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [savingUserId, setSavingUserId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [createForm, setCreateForm] = useState({
    email: "",
    name: "",
    role: "manager" as UserRole,
    is_active: true,
    password: "",
  });

  const apiBaseUrl = useMemo(() => getClientApiBaseUrl(), []);

  const loadUsers = useCallback(async () => {
    setError("");
    setSuccess("");

    setIsLoading(true);

    try {
      const query = new URLSearchParams();
      if (search.trim().length >= 2) query.set("search", search.trim());
      query.set("skip", String((page - 1) * PAGE_SIZE));
      query.set("limit", String(PAGE_SIZE + 1));
      const endpoint = query.toString() ? `/api/admin/users?${query.toString()}` : "/api/admin/users";

      const data = await fetchJsonWithTimeout<AdminUser[]>(
        withApiBase(apiBaseUrl, endpoint),
        {},
        12000
      );
      const nextPageAvailable = data.length > PAGE_SIZE;
      const pageRows = nextPageAvailable ? data.slice(0, PAGE_SIZE) : data;
      setHasNextPage(nextPageAvailable);
      setUsers(pageRows);
      setDrafts(
        pageRows.reduce<Record<number, UserDraft>>((acc, user) => {
          acc[user.id] = {
            name: user.name || "",
            role: user.role,
            is_active: user.is_active,
            password: "",
          };
          return acc;
        }, {})
      );
    } catch (loadError) {
      if (loadError instanceof ApiRequestError && (loadError.status === 401 || loadError.status === 403)) {
        router.push("/admin/login");
        return;
      }
      if (loadError instanceof ApiRequestError) {
        setError(loadError.traceId ? `${loadError.message}. Код: ${loadError.traceId}` : loadError.message);
      } else {
        setError("Ошибка загрузки пользователей.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, page, router, search]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  function handlePageJump(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = Number.parseInt(pageInput, 10);
    if (!Number.isFinite(parsed)) {
      setPageInput(String(page));
      return;
    }
    const nextPage = Math.max(1, parsed);
    setPage(nextPage);
    setPageInput(String(nextPage));
  }

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    setIsCreating(true);

    try {
      const payload = {
        email: createForm.email.trim(),
        name: createForm.name.trim() || undefined,
        role: createForm.role,
        is_active: createForm.is_active,
        password: createForm.password,
      };

      await fetchJsonWithTimeout<{ id: number }>(
        withApiBase(apiBaseUrl, "/api/admin/users"),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
        12000
      );

      setCreateForm({
        email: "",
        name: "",
        role: "manager",
        is_active: true,
        password: "",
      });
      setSuccess("Пользователь создан.");
      await loadUsers();
    } catch (createError) {
      if (createError instanceof ApiRequestError && (createError.status === 401 || createError.status === 403)) {
        router.push("/admin/login");
        return;
      }
      if (createError instanceof ApiRequestError) {
        setError(createError.traceId ? `${createError.message}. Код: ${createError.traceId}` : createError.message);
      } else {
        setError("Ошибка создания пользователя.");
      }
    } finally {
      setIsCreating(false);
    }
  }

  async function handleSaveUser(userId: number) {
    const draft = drafts[userId];
    if (!draft) return;

    setError("");
    setSuccess("");

    setSavingUserId(userId);

    try {
      const payload: {
        name: string;
        role: UserRole;
        is_active: boolean;
        password?: string;
      } = {
        name: draft.name.trim(),
        role: draft.role,
        is_active: draft.is_active,
      };
      if (draft.password.trim()) payload.password = draft.password.trim();

      await fetchJsonWithTimeout<{ id: number }>(
        withApiBase(apiBaseUrl, `/api/admin/users/${userId}`),
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
        12000
      );

      setSuccess(`Пользователь #${userId} обновлён.`);
      await loadUsers();
    } catch (updateError) {
      if (updateError instanceof ApiRequestError && (updateError.status === 401 || updateError.status === 403)) {
        router.push("/admin/login");
        return;
      }
      if (updateError instanceof ApiRequestError) {
        setError(updateError.traceId ? `${updateError.message}. Код: ${updateError.traceId}` : updateError.message);
      } else {
        setError("Ошибка обновления пользователя.");
      }
    } finally {
      setSavingUserId(null);
    }
  }

  if (isLoading) {
    return <div className="text-neutral-600">Загрузка пользователей...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#1F3B73]">Пользователи</h1>
      </div>

      {error ? (
        <div role="alert" aria-live="assertive" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}
      {success ? (
        <div role="status" aria-live="polite" className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>
      ) : null}

      <div className="rounded-2xl border border-neutral-200 p-4">
        <h2 className="text-sm font-semibold text-neutral-700">Создать пользователя</h2>
        <form onSubmit={handleCreateUser} className="mt-3 grid gap-3 md:grid-cols-2">
          <input
            type="email"
            value={createForm.email}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, email: event.target.value }))}
            placeholder="Email *"
            required
            className="rounded-xl border border-neutral-300 px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={createForm.name}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Имя"
            className="rounded-xl border border-neutral-300 px-3 py-2 text-sm"
          />
          <input
            type="password"
            value={createForm.password}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, password: event.target.value }))}
            placeholder="Пароль (мин. 8)"
            minLength={8}
            required
            className="rounded-xl border border-neutral-300 px-3 py-2 text-sm"
          />
          <select
            value={createForm.role}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, role: event.target.value as UserRole }))}
            className="rounded-xl border border-neutral-300 px-3 py-2 text-sm"
          >
            {roleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={createForm.is_active}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, is_active: event.target.checked }))}
            />
            Активен
          </label>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={isCreating}
              className="rounded-xl bg-[#1F3B73] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {isCreating ? "Создание..." : "Создать пользователя"}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-neutral-200 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Поиск по email/имени (от 2 символов)"
            className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm sm:min-w-72 sm:w-auto"
          />
          <button
            type="button"
            onClick={loadUsers}
            className="rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-700"
          >
            Обновить
          </button>
        </div>
        <div className="mt-3 text-sm text-neutral-500">
          Показано пользователей: {users.length} · Страница {page}
        </div>

        {users.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-500">Пользователи не найдены.</p>
        ) : (
          <div className="mt-4">
            <div className="divide-y divide-neutral-200 rounded-2xl border border-neutral-200 md:hidden">
              {users.map((user) => {
                const draft = drafts[user.id];
                if (!draft) return null;

                return (
                  <article key={user.id} className="space-y-3 px-3 py-4 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs text-neutral-500">ID: {user.id}</p>
                        <p className="break-all font-medium text-neutral-900">{user.email}</p>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs text-neutral-500">Имя</label>
                      <input
                        value={draft.name}
                        onChange={(event) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [user.id]: { ...prev[user.id], name: event.target.value },
                          }))
                        }
                        className="w-full rounded-lg border border-neutral-300 px-2 py-1"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs text-neutral-500">Роль</label>
                      <select
                        value={draft.role}
                        onChange={(event) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [user.id]: { ...prev[user.id], role: event.target.value as UserRole },
                          }))
                        }
                        className="w-full rounded-lg border border-neutral-300 px-2 py-1"
                      >
                        {roleOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
                      <input
                        type="checkbox"
                        checked={draft.is_active}
                        onChange={(event) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [user.id]: { ...prev[user.id], is_active: event.target.checked },
                          }))
                        }
                      />
                      <span>{draft.is_active ? "Активен" : "Неактивен"}</span>
                    </label>

                    <div>
                      <label className="mb-1 block text-xs text-neutral-500">Новый пароль</label>
                      <input
                        type="password"
                        value={draft.password}
                        onChange={(event) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [user.id]: { ...prev[user.id], password: event.target.value },
                          }))
                        }
                        placeholder="мин. 8"
                        className="w-full rounded-lg border border-neutral-300 px-2 py-1"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSaveUser(user.id)}
                      disabled={savingUserId === user.id}
                      className="rounded-lg bg-[#1F3B73] px-3 py-1 text-xs font-medium text-white disabled:opacity-60"
                    >
                      {savingUserId === user.id ? "Сохранение..." : "Сохранить"}
                    </button>
                  </article>
                );
              })}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[900px]">
              <thead className="border-b border-neutral-200 text-left text-xs uppercase text-neutral-500">
                <tr>
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Имя</th>
                  <th className="px-3 py-2">Роль</th>
                  <th className="px-3 py-2">Активен</th>
                  <th className="px-3 py-2">Новый пароль</th>
                  <th className="px-3 py-2">Действие</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const draft = drafts[user.id];
                  if (!draft) return null;

                  return (
                    <tr key={user.id} className="border-b border-neutral-100 text-sm">
                      <td className="px-3 py-2">{user.id}</td>
                      <td className="px-3 py-2">{user.email}</td>
                      <td className="px-3 py-2">
                        <input
                          value={draft.name}
                          onChange={(event) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [user.id]: { ...prev[user.id], name: event.target.value },
                            }))
                          }
                          className="w-full rounded-lg border border-neutral-300 px-2 py-1"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={draft.role}
                          onChange={(event) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [user.id]: { ...prev[user.id], role: event.target.value as UserRole },
                            }))
                          }
                          className="w-full rounded-lg border border-neutral-300 px-2 py-1"
                        >
                          {roleOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={draft.is_active}
                            onChange={(event) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [user.id]: { ...prev[user.id], is_active: event.target.checked },
                              }))
                            }
                          />
                          <span>{draft.is_active ? "Да" : "Нет"}</span>
                        </label>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="password"
                          value={draft.password}
                          onChange={(event) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [user.id]: { ...prev[user.id], password: event.target.value },
                            }))
                          }
                          placeholder="мин. 8"
                          className="w-full rounded-lg border border-neutral-300 px-2 py-1"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => handleSaveUser(user.id)}
                          disabled={savingUserId === user.id}
                          className="rounded-lg bg-[#1F3B73] px-3 py-1 text-xs font-medium text-white disabled:opacity-60"
                        >
                          {savingUserId === user.id ? "Сохранение..." : "Сохранить"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 border-t border-neutral-200 pt-4 text-sm">
              <div className="text-neutral-500">
                Поиск и пагинация работают по всей базе пользователей.
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={page <= 1}
                  className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
                >
                  Назад
                </button>
                <span className="min-w-[5rem] text-center text-neutral-600">Стр. {page}</span>
                <button
                  type="button"
                  onClick={() => setPage((prev) => prev + 1)}
                  disabled={!hasNextPage}
                  className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
                >
                  Вперёд
                </button>
                <form onSubmit={handlePageJump} className="ml-1 flex items-center gap-2">
                  <label htmlFor="users-page-jump" className="text-xs text-neutral-500">Стр.</label>
                  <input
                    id="users-page-jump"
                    type="number"
                    min={1}
                    value={pageInput}
                    onChange={(event) => setPageInput(event.target.value)}
                    className="w-20 rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-700 focus:border-[#1F3B73] focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-neutral-700 hover:bg-neutral-100"
                  >
                    Перейти
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
