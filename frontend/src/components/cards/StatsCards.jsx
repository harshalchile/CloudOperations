import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { cn } from '../../utils/cn';

export const StatsCards = ({ items = [] }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {items.map((stat, idx) => {
        const Icon = stat.icon;
        const isPositive = stat.changeType === 'increase';
        const isNegative = stat.changeType === 'decrease';

        return (
          <div
            key={idx}
            className="p-4 bg-[#111827] border border-slate-800/90 rounded-lg shadow-sm hover:border-slate-700/80 transition-colors flex flex-col justify-between"
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-medium text-slate-400 tracking-wide truncate">
                {stat.title}
              </span>
              {Icon && (
                <div className="p-1.5 bg-slate-800/80 text-blue-400 rounded-md shrink-0">
                  <Icon className="w-3.5 h-3.5" />
                </div>
              )}
            </div>

            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xl font-bold tracking-tight text-white font-mono-tabular">
                {stat.value}
              </span>

              {stat.change && (
                <div
                  className={cn(
                    'flex items-center gap-0.5 text-xs font-semibold font-mono-tabular px-1.5 py-0.5 rounded border',
                    isPositive
                      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                      : isNegative
                      ? 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                      : 'text-slate-400 bg-slate-800 border-slate-700'
                  )}
                >
                  {isPositive && <ArrowUpRight className="w-3 h-3" />}
                  {isNegative && <ArrowDownRight className="w-3 h-3" />}
                  {!isPositive && !isNegative && <Minus className="w-3 h-3" />}
                  <span>{stat.change}</span>
                </div>
              )}
            </div>

            {stat.subtitle && (
              <p className="text-[11px] text-slate-400 mt-2 border-t border-slate-800/60 pt-2 font-mono-tabular">
                {stat.subtitle}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
};
