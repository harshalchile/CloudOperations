import React from 'react';
import { ShieldAlert, Info, AlertTriangle, CheckCircle2, Terminal } from 'lucide-react';
import { cn } from '../../utils/cn';

export const Timeline = ({ events = [] }) => {
  return (
    <div className="space-y-4 relative before:absolute before:inset-0 before:left-3 before:w-0.5 before:bg-slate-800 font-mono-tabular">
      {events.map((evt, idx) => {
        const severityMap = {
          critical: { icon: ShieldAlert, color: 'text-rose-400 bg-rose-500/10 border-rose-500/30' },
          warning: { icon: AlertTriangle, color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
          info: { icon: Info, color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
          success: { icon: CheckCircle2, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
        };

        const currentSev = severityMap[evt.severity || 'info'];
        const Icon = currentSev.icon;

        return (
          <div key={idx} className="relative pl-8 flex flex-col gap-1 group">
            {/* Timeline Dot */}
            <div
              className={cn(
                'absolute left-0 top-0.5 w-6 h-6 rounded-full border flex items-center justify-center bg-slate-900',
                currentSev.color
              )}
            >
              <Icon className="w-3 h-3" />
            </div>

            {/* Content */}
            <div className="bg-[#111827] border border-slate-800/80 rounded-md p-3 group-hover:border-slate-700 transition-colors">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-200">{evt.title}</span>
                <span className="text-[10px] text-slate-500">{evt.timestamp}</span>
              </div>

              {evt.description && (
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">{evt.description}</p>
              )}

              {evt.trace && (
                <div className="mt-2 p-2 bg-slate-950 rounded border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2 overflow-x-auto">
                  <Terminal className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                  <code>{evt.trace}</code>
                </div>
              )}

              {evt.actor && (
                <div className="mt-2 text-[10px] text-slate-500 flex items-center gap-2">
                  <span>Actor: <strong className="text-slate-300">{evt.actor}</strong></span>
                  <span>•</span>
                  <span>Resource: <strong className="text-slate-300">{evt.resource}</strong></span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
