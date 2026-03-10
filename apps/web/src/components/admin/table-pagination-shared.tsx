import type { FormEvent, ReactNode } from "react";

type AdminPagerBaseProps = {
  summary: ReactNode;
  page: number;
  pageInput: string;
  jumpInputId: string;
  onPageInputChange: (value: string) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onJumpToPage: (event: FormEvent<HTMLFormElement>) => void;
  containerClassName?: string;
  disabled?: boolean;
};

type AdminTotalPagesFooterProps = AdminPagerBaseProps & {
  totalPages: number;
};

type AdminHasNextFooterProps = AdminPagerBaseProps & {
  hasNextPage: boolean;
};

type AdminPagerFooterProps = AdminPagerBaseProps & {
  pageLabel: ReactNode;
  nextDisabled: boolean;
  maxInput?: number;
};

function AdminPagerFooter({
  summary,
  page,
  pageInput,
  jumpInputId,
  onPageInputChange,
  onPrevPage,
  onNextPage,
  onJumpToPage,
  pageLabel,
  nextDisabled,
  maxInput,
  containerClassName = "px-4 py-3",
  disabled = false,
}: AdminPagerFooterProps) {
  return (
    <div
      className={`flex items-center justify-between gap-3 border-t border-neutral-200 text-sm ${containerClassName}`}
    >
      <div className="text-neutral-500">{summary}</div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrevPage}
          disabled={page <= 1 || disabled}
          className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
        >
          Назад
        </button>
        <span className="min-w-[7rem] text-center text-neutral-600">{pageLabel}</span>
        <button
          type="button"
          onClick={onNextPage}
          disabled={nextDisabled}
          className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
        >
          Вперёд
        </button>
        <form onSubmit={onJumpToPage} className="ml-1 flex items-center gap-2">
          <label htmlFor={jumpInputId} className="text-xs text-neutral-500">
            Стр.
          </label>
          <input
            id={jumpInputId}
            type="number"
            min={1}
            max={maxInput}
            value={pageInput}
            onChange={(event) => onPageInputChange(event.target.value)}
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
  );
}

export function AdminTotalPagesFooter({
  summary,
  page,
  totalPages,
  pageInput,
  jumpInputId,
  onPageInputChange,
  onPrevPage,
  onNextPage,
  onJumpToPage,
  containerClassName = "px-4 py-3",
  disabled = false,
}: AdminTotalPagesFooterProps) {
  return (
    <AdminPagerFooter
      summary={summary}
      page={page}
      pageInput={pageInput}
      jumpInputId={jumpInputId}
      onPageInputChange={onPageInputChange}
      onPrevPage={onPrevPage}
      onNextPage={onNextPage}
      onJumpToPage={onJumpToPage}
      pageLabel={`${page} / ${totalPages}`}
      nextDisabled={page >= totalPages || disabled}
      maxInput={totalPages}
      containerClassName={containerClassName}
      disabled={disabled}
    />
  );
}

export function AdminHasNextFooter({
  summary,
  page,
  hasNextPage,
  pageInput,
  jumpInputId,
  onPageInputChange,
  onPrevPage,
  onNextPage,
  onJumpToPage,
  containerClassName = "px-4 py-3",
  disabled = false,
}: AdminHasNextFooterProps) {
  return (
    <AdminPagerFooter
      summary={summary}
      page={page}
      pageInput={pageInput}
      jumpInputId={jumpInputId}
      onPageInputChange={onPageInputChange}
      onPrevPage={onPrevPage}
      onNextPage={onNextPage}
      onJumpToPage={onJumpToPage}
      pageLabel={`Стр. ${page}`}
      nextDisabled={!hasNextPage || disabled}
      containerClassName={containerClassName}
      disabled={disabled}
    />
  );
}
