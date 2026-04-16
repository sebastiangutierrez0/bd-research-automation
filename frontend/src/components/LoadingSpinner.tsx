import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type LoadingSpinnerProps = {
  message: string;
};

export function LoadingSpinner({ message }: LoadingSpinnerProps) {
  return (
    <Card
      className="flex flex-col items-center justify-center gap-4 border-navy-700/80 bg-navy-900/40 py-10 shadow-card"
      role="status"
      aria-live="polite"
    >
      <div className="flex w-full max-w-md flex-col gap-3 px-6">
        <Skeleton className="h-4 w-3/4 bg-slate-600/50" />
        <Skeleton className="h-4 w-full bg-slate-600/50" />
        <Skeleton className="h-4 w-5/6 bg-slate-600/50" />
      </div>
      <p className="text-center text-sm font-medium text-slate-200">{message}</p>
    </Card>
  );
}
