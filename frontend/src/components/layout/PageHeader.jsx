import React from 'react';
import { Breadcrumb } from './Breadcrumb';
import { RefreshCw } from 'lucide-react';

export const PageHeader = ({
  title,
  description,
  environment = 'PRODUCTION',
  region = 'us-east-1',
  arn,
  actions,
  onRefresh,
  isRefreshing = false,
}) => {
  return (
    <div className="flex flex-col gap-3 pb-6 mb-6 border-b border-slate-800/80">
      <Breadcrumb arn={arn} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-white">{title}</h1>
            <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded">
              {environment}
            </span>
            <span className="px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase bg-slate-800 text-slate-400 border border-slate-700/60 rounded font-mono-tabular">
              {region}
            </span>
          </div>
          {description && (
            <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
              {description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-2 text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800 rounded-md hover:bg-slate-800 transition-colors disabled:opacity-50"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
            </button>
          )}
          {actions}
        </div>
      </div>
    </div>
  );
};
