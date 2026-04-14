type LoadingSpinnerProps = {
  message: string;
};

export function LoadingSpinner({ message }: LoadingSpinnerProps) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-4 rounded-xl border border-navy-700/80 bg-navy-900/40 py-16 shadow-card"
      role="status"
      aria-live="polite"
    >
      <div className="h-12 w-12 animate-spin rounded-full border-2 border-slate-600 border-t-accent" />
      <p className="text-center text-sm font-medium text-slate-200">{message}</p>
    </div>
  );
}
