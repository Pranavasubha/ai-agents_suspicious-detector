import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { AccountStatus } from '../types/simulation';

interface StatusBadgeProps {
  status: AccountStatus;
  showSubLabel?: boolean;
}

export function StatusIndicator({ status, showSubLabel = false }: StatusBadgeProps) {
  if (status === 'Normal') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
        <span>Normal</span>
      </span>
    );
  }

  if (status === 'Watch') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 whitespace-nowrap">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" aria-hidden="true" />
        <span>{showSubLabel ? 'Watch (Suspicious)' : 'Watch'}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 whitespace-nowrap">
      <ShieldAlert className="w-3.5 h-3.5 text-red-600 shrink-0" aria-hidden="true" />
      <span>{showSubLabel ? 'Flagged (Possible Compromise)' : 'Flagged'}</span>
    </span>
  );
}

export function getScoreColorClasses(score: number, watchThreshold = 35, flagThreshold = 65) {
  if (score >= flagThreshold) {
    return {
      text: 'text-red-700',
      bar: 'bg-red-600',
      surface: 'bg-red-50',
      border: 'border-red-200',
    };
  }
  if (score >= watchThreshold) {
    return {
      text: 'text-amber-700',
      bar: 'bg-amber-500',
      surface: 'bg-amber-50',
      border: 'border-amber-200',
    };
  }
  return {
    text: 'text-emerald-700',
    bar: 'bg-emerald-600',
    surface: 'bg-emerald-50',
    border: 'border-emerald-200',
  };
}
