import React from 'react';
import {
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  HelpCircle,
  Info,
  XCircle,
  RefreshCw,
  X,
} from 'lucide-react';
import type {
  EvidenceClassification,
  ScanStatus,
  SeverityLevel,
} from '../../types/memscope';

export function MemScopeLogo({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect
        x="2"
        y="2"
        width="28"
        height="28"
        rx="6"
        className="fill-[#111827] stroke-[#06B6D4]"
        strokeWidth="2"
      />
      {/* Memory grid blocks */}
      <rect x="7" y="7" width="7" height="7" rx="1.5" className="fill-[#06B6D4]" />
      <rect x="18" y="7" width="7" height="7" rx="1.5" className="fill-[#1E293B] stroke-[#475569]" strokeWidth="1.2" />
      <rect x="7" y="18" width="7" height="7" rx="1.5" className="fill-[#1E293B] stroke-[#475569]" strokeWidth="1.2" />
      {/* Highlighted leaked block with diagnostic reticle */}
      <rect x="18" y="18" width="7" height="7" rx="1.5" className="fill-[#EF4444]/25 stroke-[#EF4444]" strokeWidth="1.6" />
      <path d="M14 10.5H18M10.5 14V18M21.5 14V18" stroke="#06B6D4" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const abs = Math.abs(bytes);
  if (abs < 1024) return `${bytes.toLocaleString()} B`;
  if (abs < 1024 * 1024) {
    const kb = bytes / 1024;
    return `${kb % 1 === 0 ? kb.toFixed(0) : kb.toFixed(1)} KB (${bytes.toLocaleString()} B)`;
  }
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
}

export function formatCompactBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const abs = Math.abs(bytes);
  if (abs < 1024) return `${bytes} B`;
  if (abs < 1024 * 1024) {
    const kb = bytes / 1024;
    return `${kb % 1 === 0 ? kb.toFixed(0) : kb.toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatTimestamp(iso: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return iso;
  }
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString([], { month: 'short', day: '2-digit' })} ${d.toLocaleTimeString(
      [],
      { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }
    )}`;
  } catch {
    return iso;
  }
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'tertiary' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  disabled,
  children,
  ...rest
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 font-medium rounded-md transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0F17] whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

  const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
    primary: 'bg-cyan-500 text-slate-950 hover:bg-cyan-400 font-semibold',
    secondary:
      'bg-[#161F30] text-slate-100 border border-[#334155] hover:bg-[#1E293B] hover:border-slate-500',
    tertiary: 'bg-transparent text-slate-300 hover:text-white hover:bg-[#161F30]',
    destructive:
      'bg-red-500/15 text-red-300 border border-red-500/40 hover:bg-red-500/25 hover:text-red-200',
  };

  const sizes: Record<NonNullable<ButtonProps['size']>, string> = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-9 px-4 text-xs',
    lg: 'h-10 px-5 text-sm',
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
}

export function SeverityIndicator({ severity }: { severity: SeverityLevel }) {
  const config: Record<
    SeverityLevel,
    { label: string; colorClass: string; Icon: React.ComponentType<{ className?: string }> }
  > = {
    CRITICAL: {
      label: 'Critical',
      colorClass: 'text-red-400',
      Icon: AlertOctagon,
    },
    HIGH: {
      label: 'High',
      colorClass: 'text-amber-400',
      Icon: AlertTriangle,
    },
    MEDIUM: {
      label: 'Medium',
      colorClass: 'text-yellow-300',
      Icon: AlertTriangle,
    },
    LOW: {
      label: 'Low',
      colorClass: 'text-cyan-400',
      Icon: Info,
    },
    INFO: {
      label: 'Nominal',
      colorClass: 'text-emerald-400',
      Icon: CheckCircle2,
    },
  };

  const { label, colorClass, Icon } = config[severity] ?? config.INFO;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${colorClass}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

export function ClassificationIndicator({
  classification,
}: {
  classification: EvidenceClassification;
}) {
  const map: Record<
    EvidenceClassification,
    { label: string; colorClass: string; Icon: React.ComponentType<{ className?: string }> }
  > = {
    CONFIRMED_LEAK: {
      label: 'Confirmed Leak',
      colorClass: 'text-red-400',
      Icon: AlertOctagon,
    },
    POSSIBLE_LEAK: {
      label: 'Possible Leak',
      colorClass: 'text-amber-400',
      Icon: AlertTriangle,
    },
    RUNTIME_ERROR: {
      label: 'Runtime Hazard',
      colorClass: 'text-red-400',
      Icon: XCircle,
    },
    EVIDENCE_UNAVAILABLE: {
      label: 'Evidence Unavailable',
      colorClass: 'text-slate-400',
      Icon: HelpCircle,
    },
    CLEAN: {
      label: 'Zero Leaks Verified',
      colorClass: 'text-emerald-400',
      Icon: CheckCircle2,
    },
  };

  const item = map[classification] ?? map.CLEAN;
  const Icon = item.Icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${item.colorClass}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{item.label}</span>
    </span>
  );
}

export function ScanStatusIndicator({
  status,
  unfreedBytes = 0,
  runtimeErrors = 0,
}: {
  status: ScanStatus | 'NONE';
  unfreedBytes?: number;
  runtimeErrors?: number;
}) {
  if (status === 'NONE') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
        <HelpCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>No Scans Run</span>
      </span>
    );
  }
  if (status === 'TOOLCHAIN_UNAVAILABLE') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>Toolchain Unavailable</span>
      </span>
    );
  }
  if (status === 'FAILED') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-400">
        <XCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>Execution Failed</span>
      </span>
    );
  }
  if (runtimeErrors > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-400">
        <AlertOctagon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>Completed · Heap Error</span>
      </span>
    );
  }
  if (unfreedBytes > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>Completed · Leaks Found</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400">
      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>Completed · Clean</span>
    </span>
  );
}

export function MetricCard({
  label,
  value,
  subtext,
  tone = 'default',
  loading = false,
}: {
  label: string;
  value: React.ReactNode;
  subtext: string;
  tone?: 'default' | 'critical' | 'warning' | 'nominal' | 'accent';
  loading?: boolean;
}) {
  const valueTone: Record<string, string> = {
    default: 'text-slate-100',
    critical: 'text-red-400',
    warning: 'text-amber-400',
    nominal: 'text-emerald-400',
    accent: 'text-cyan-400',
  };

  return (
    <div className="bg-[#111827] border border-[#1E293B] rounded-lg p-4 flex flex-col justify-between min-h-[108px]">
      <div className="text-xs font-medium text-slate-400">{label}</div>
      {loading ? (
        <div className="my-2 h-7 w-24 bg-[#1E293B] animate-pulse rounded" />
      ) : (
        <div className={`text-2xl font-bold font-mono tabular-nums tracking-tight my-1 ${valueTone[tone]}`}>
          {value}
        </div>
      )}
      <div className="text-xs text-slate-400 truncate" title={subtext}>
        {subtext}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="bg-[#111827] border border-[#1E293B] rounded-lg p-8 text-center max-w-lg mx-auto my-4">
      <h3 className="text-sm font-semibold text-slate-200 mb-1">{title}</h3>
      <p className="text-xs text-slate-400 leading-relaxed mb-4">{description}</p>
      {actionLabel && onAction && (
        <Button variant="primary" size="md" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export function ErrorPanel({
  title = 'Diagnostic Data Load Error',
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="bg-[#111827] border border-red-500/40 rounded-lg p-4 flex items-start justify-between gap-4"
    >
      <div className="flex items-start gap-3">
        <AlertOctagon className="w-5 h-5 text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <h3 className="text-sm font-semibold text-red-300">{title}</h3>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">{message}</p>
        </div>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry</span>
        </Button>
      )}
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  destructive = true,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="bg-[#111827] border border-[#334155] rounded-lg max-w-md w-full p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h2 id="confirm-dialog-title" className="text-base font-semibold text-slate-100">
            {title}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close confirmation dialog"
            className="text-slate-400 hover:text-slate-200 p-1 rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed mb-5">{description}</p>
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" size="md" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'primary'}
            size="md"
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  detail?: string;
}

export function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const iconMap = {
          success: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />,
          warning: <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />,
          error: <AlertOctagon className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />,
          info: <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />,
        };
        return (
          <div
            key={t.id}
            className="pointer-events-auto bg-[#161F30] border border-[#334155] rounded-lg p-3.5 shadow-xl flex items-start justify-between gap-3"
          >
            <div className="flex items-start gap-2.5">
              {iconMap[t.type]}
              <div>
                <div className="text-xs font-semibold text-slate-100">{t.title}</div>
                {t.detail && <div className="text-xs text-slate-300 mt-0.5">{t.detail}</div>}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              aria-label={`Dismiss notification ${t.title}`}
              className="text-slate-400 hover:text-slate-200 p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
