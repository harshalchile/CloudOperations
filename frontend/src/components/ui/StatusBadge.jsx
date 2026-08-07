import React from 'react';
import { cn } from '../../utils/cn';

const statusStyles = {
  running: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 dot-emerald-400',
  healthy: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 dot-emerald-400',
  active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 dot-emerald-400',
  online: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 dot-emerald-400',
  
  warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20 dot-amber-400',
  pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20 dot-amber-400',
  degraded: 'bg-amber-500/10 text-amber-400 border-amber-500/20 dot-amber-400',
  
  stopped: 'bg-slate-500/10 text-slate-400 border-slate-500/20 dot-slate-400',
  inactive: 'bg-slate-500/10 text-slate-400 border-slate-500/20 dot-slate-400',

  critical: 'bg-rose-500/10 text-rose-400 border-rose-500/20 dot-rose-400',
  error: 'bg-rose-500/10 text-rose-400 border-rose-500/20 dot-rose-400',
  terminated: 'bg-rose-500/10 text-rose-400 border-rose-500/20 dot-rose-400',
  failed: 'bg-rose-500/10 text-rose-400 border-rose-500/20 dot-rose-400',

  info: 'bg-blue-500/10 text-blue-400 border-blue-500/20 dot-blue-400',
};

const dotColors = {
  running: 'bg-emerald-400 animate-pulse',
  healthy: 'bg-emerald-400',
  active: 'bg-emerald-400',
  online: 'bg-emerald-400',
  warning: 'bg-amber-400',
  pending: 'bg-amber-400 animate-pulse',
  degraded: 'bg-amber-400',
  stopped: 'bg-slate-400',
  inactive: 'bg-slate-400',
  critical: 'bg-rose-400 animate-ping',
  error: 'bg-rose-400',
  terminated: 'bg-rose-400',
  failed: 'bg-rose-400',
  info: 'bg-blue-400',
};

export const StatusBadge = ({ status = 'info', label, className }) => {
  const normalizedStatus = status.toLowerCase();
  const currentStyle = statusStyles[normalizedStatus] || statusStyles.info;
  const currentDot = dotColors[normalizedStatus] || dotColors.info;
  const displayText = label || status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-md border tracking-wide uppercase font-mono-tabular',
        currentStyle,
        className
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full inline-block', currentDot)} />
      {displayText}
    </span>
  );
};
