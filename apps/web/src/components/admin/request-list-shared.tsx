import type { FormEvent, ReactNode } from "react";
import { AdminFeedback } from "@/components/admin/feedback-shared";
import { AdminHasNextFooter } from "@/components/admin/table-pagination-shared";

type StatusOption = {
  value: string;
  label: string;
};

type PresetOption = {
  id: string;
  name: string;
};

type RequestListHeaderProps = {
  title: string;
  lastUpdated: string;
  isRefreshing: boolean;
  onRefresh: () => void;
};

type RequestListFeedbackProps = {
  error: string;
  success: string;
};

type RequestListFiltersProps = {
  status: string;
  search: string;
  statusOptions: StatusOption[];
  searchPlaceholder: string;
  isRefreshing: boolean;
  onStatusChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onApplyFilters: (event: FormEvent<HTMLFormElement>) => void;
  onResetFilters: () => void;
};

type RequestListPresetsProps = {
  presetName: string;
  selectedPresetId: string;
  presets: PresetOption[];
  onPresetNameChange: (value: string) => void;
  onSelectedPresetIdChange: (value: string) => void;
  onSavePreset: () => void;
  onApplyPreset: () => void;
  onDeletePreset: () => void;
};

type RequestListToolbarProps = {
  requestsCount: number;
  page: number;
  selectedCount: number;
  bulkStatus: string;
  bulkStatusOptions: StatusOption[];
  bulkUpdating: boolean;
  pageSize: number;
  onBulkStatusChange: (value: string) => void;
  onBulkApply: () => void;
  onExportCsv: () => void;
  onPageSizeChange: (value: string) => void;
};

type RequestListEmptyStateProps = {
  hasFilters: boolean;
  filteredTitle: string;
  filteredSubtitle: string;
  emptyTitle: string;
  emptySubtitle: string;
};

type RequestListPaginationProps = {
  page: number;
  hasNextPage: boolean;
  isRefreshing: boolean;
  pageInput: string;
  jumpInputId: string;
  onPageInputChange: (value: string) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onJumpToPage: (event: FormEvent<HTMLFormElement>) => void;
};

type RequestListDataLayoutProps = RequestListToolbarProps &
  RequestListPaginationProps & {
    mobileContent: ReactNode;
    desktopContent: ReactNode;
  };

export function RequestListHeader({
  title,
  lastUpdated,
  isRefreshing,
  onRefresh,
}: RequestListHeaderProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold text-[#1F3B73]">{title}</h1>
      <div className="flex items-center gap-3">
        {lastUpdated ? (
          <div className="text-xs text-neutral-500">Обновлено: {lastUpdated}</div>
        ) : null}
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
        >
          {isRefreshing ? "Обновление..." : "Обновить"}
        </button>
      </div>
    </div>
  );
}

export function RequestListFeedback({ error, success }: RequestListFeedbackProps) {
  return <AdminFeedback error={error} success={success} />;
}

export function RequestListFilters({
  status,
  search,
  statusOptions,
  searchPlaceholder,
  isRefreshing,
  onStatusChange,
  onSearchChange,
  onApplyFilters,
  onResetFilters,
}: RequestListFiltersProps) {
  return (
    <form
      onSubmit={onApplyFilters}
      className="mb-6 grid gap-3 rounded-2xl border border-neutral-200 bg-white p-4 md:grid-cols-3"
    >
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">
          Статус
        </label>
        <select
          value={status}
          onChange={(event) => onStatusChange(event.target.value)}
          className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
        >
          <option value="">Все</option>
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="md:col-span-2">
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">
          Поиск
        </label>
        <input
          type="text"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
        />
      </div>
      <div className="md:col-span-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={onResetFilters}
          className="rounded-xl border border-neutral-300 bg-white px-5 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
        >
          Сбросить
        </button>
        <button
          type="submit"
          disabled={isRefreshing}
          className="rounded-xl bg-[#1F3B73] px-5 py-2 text-sm font-medium text-white hover:bg-[#14294F] disabled:opacity-50"
        >
          {isRefreshing ? "Загрузка..." : "Применить"}
        </button>
      </div>
    </form>
  );
}

export function RequestListPresets({
  presetName,
  selectedPresetId,
  presets,
  onPresetNameChange,
  onSelectedPresetIdChange,
  onSavePreset,
  onApplyPreset,
  onDeletePreset,
}: RequestListPresetsProps) {
  return (
    <div className="mb-6 rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_200px_auto_auto]">
        <input
          type="text"
          value={presetName}
          onChange={(event) => onPresetNameChange(event.target.value)}
          placeholder="Имя пресета фильтров"
          className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
        />
        <select
          value={selectedPresetId}
          onChange={(event) => onSelectedPresetIdChange(event.target.value)}
          className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
        >
          <option value="">Выберите пресет</option>
          {presets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onSavePreset}
          className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
        >
          Сохранить пресет
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onApplyPreset}
            className="rounded-xl bg-[#1F3B73] px-4 py-2 text-sm font-medium text-white hover:bg-[#14294F]"
          >
            Применить
          </button>
          <button
            type="button"
            onClick={onDeletePreset}
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
          >
            Удалить
          </button>
        </div>
      </div>
    </div>
  );
}

export function RequestListToolbar({
  requestsCount,
  page,
  selectedCount,
  bulkStatus,
  bulkStatusOptions,
  bulkUpdating,
  pageSize,
  onBulkStatusChange,
  onBulkApply,
  onExportCsv,
  onPageSizeChange,
}: RequestListToolbarProps) {
  return (
    <div className="border-b border-neutral-200 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-neutral-500">
          Показано на странице: {requestsCount} · Страница {page}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-sm text-neutral-600">Выбрано: {selectedCount}</div>
          <select
            value={bulkStatus}
            onChange={(event) => onBulkStatusChange(event.target.value)}
            className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
          >
            <option value="">Статус для выбранных</option>
            {bulkStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onBulkApply}
            disabled={bulkUpdating || selectedCount === 0 || !bulkStatus}
            className="rounded-xl bg-[#1F3B73] px-4 py-2 text-sm font-medium text-white hover:bg-[#14294F] disabled:opacity-50"
          >
            {bulkUpdating ? "Обновление..." : "Применить к выбранным"}
          </button>
          <button
            type="button"
            onClick={onExportCsv}
            className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
          >
            Экспорт CSV
          </button>
          <select
            value={String(pageSize)}
            onChange={(event) => onPageSizeChange(event.target.value)}
            className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
          >
            <option value="25">25 на странице</option>
            <option value="50">50 на странице</option>
            <option value="100">100 на странице</option>
          </select>
        </div>
      </div>
    </div>
  );
}

export function RequestListEmptyState({
  hasFilters,
  filteredTitle,
  filteredSubtitle,
  emptyTitle,
  emptySubtitle,
}: RequestListEmptyStateProps) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white py-12 text-center text-neutral-500">
      {hasFilters ? (
        <>
          <p>{filteredTitle}</p>
          <p className="mt-2 text-sm">{filteredSubtitle}</p>
        </>
      ) : (
        <>
          <p>{emptyTitle}</p>
          <p className="mt-2 text-sm">{emptySubtitle}</p>
        </>
      )}
    </div>
  );
}

export function RequestListDataLayout({
  mobileContent,
  desktopContent,
  page,
  hasNextPage,
  isRefreshing,
  pageInput,
  jumpInputId,
  onPageInputChange,
  onPrevPage,
  onNextPage,
  onJumpToPage,
  requestsCount,
  selectedCount,
  bulkStatus,
  bulkStatusOptions,
  bulkUpdating,
  pageSize,
  onBulkStatusChange,
  onBulkApply,
  onExportCsv,
  onPageSizeChange,
}: RequestListDataLayoutProps) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white">
      <RequestListToolbar
        requestsCount={requestsCount}
        page={page}
        selectedCount={selectedCount}
        bulkStatus={bulkStatus}
        bulkStatusOptions={bulkStatusOptions}
        bulkUpdating={bulkUpdating}
        pageSize={pageSize}
        onBulkStatusChange={onBulkStatusChange}
        onBulkApply={onBulkApply}
        onExportCsv={onExportCsv}
        onPageSizeChange={onPageSizeChange}
      />
      <div className="divide-y divide-neutral-200 md:hidden">{mobileContent}</div>
      <div className="hidden overflow-x-auto md:block">{desktopContent}</div>
      <RequestListPagination
        page={page}
        hasNextPage={hasNextPage}
        isRefreshing={isRefreshing}
        pageInput={pageInput}
        jumpInputId={jumpInputId}
        onPageInputChange={onPageInputChange}
        onPrevPage={onPrevPage}
        onNextPage={onNextPage}
        onJumpToPage={onJumpToPage}
      />
    </div>
  );
}

export function RequestListPagination({
  page,
  hasNextPage,
  isRefreshing,
  pageInput,
  jumpInputId,
  onPageInputChange,
  onPrevPage,
  onNextPage,
  onJumpToPage,
}: RequestListPaginationProps) {
  return (
    <AdminHasNextFooter
      summary={`Страница: ${page}`}
      page={page}
      hasNextPage={hasNextPage}
      pageInput={pageInput}
      jumpInputId={jumpInputId}
      onPageInputChange={onPageInputChange}
      onPrevPage={onPrevPage}
      onNextPage={onNextPage}
      onJumpToPage={onJumpToPage}
      disabled={isRefreshing}
      containerClassName="px-4 py-3"
    />
  );
}
