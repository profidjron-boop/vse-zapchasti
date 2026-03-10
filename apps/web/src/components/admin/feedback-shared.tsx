type AdminFeedbackProps = {
  error: string;
  success: string;
  className?: string;
};

export function AdminFeedback({
  error,
  success,
  className = "mb-6 min-h-[4.5rem]",
}: AdminFeedbackProps) {
  return (
    <div className={className}>
      {error ? (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600"
        >
          {error}
        </div>
      ) : null}
      {!error && success ? (
        <div
          role="status"
          aria-live="polite"
          className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-700"
        >
          {success}
        </div>
      ) : null}
    </div>
  );
}
