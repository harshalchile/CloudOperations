import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home, Copy, Check } from 'lucide-react';
import { useState } from 'react';

export const Breadcrumb = ({ arn, extraContext }) => {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);
  const [copied, setCopied] = useState(false);

  const handleCopyArn = () => {
    if (!arn) return;
    navigator.clipboard.writeText(arn);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <nav className="flex items-center gap-2 text-xs text-slate-400 py-1 font-mono-tabular">
      <Link
        to="/dashboard"
        className="flex items-center gap-1 hover:text-slate-200 transition-colors"
      >
        <Home className="w-3.5 h-3.5" />
        <span>Root</span>
      </Link>

      {pathnames.map((value, index) => {
        const to = `/${pathnames.slice(0, index + 1).join('/')}`;
        const isLast = index === pathnames.length - 1;
        const formattedName = value.replace(/-/g, ' ').toUpperCase();

        return (
          <React.Fragment key={to}>
            <ChevronRight className="w-3 h-3 text-slate-600" />
            {isLast ? (
              <span className="text-slate-200 font-semibold uppercase tracking-wider">{formattedName}</span>
            ) : (
              <Link to={to} className="hover:text-slate-200 transition-colors uppercase">
                {formattedName}
              </Link>
            )}
          </React.Fragment>
        );
      })}

      {extraContext && (
        <>
          <ChevronRight className="w-3 h-3 text-slate-600" />
          <span className="text-blue-400 font-medium">{extraContext}</span>
        </>
      )}

      {arn && (
        <div className="ml-auto flex items-center gap-1.5 px-2 py-0.5 bg-slate-900 border border-slate-800 rounded text-[11px] text-slate-400">
          <span className="truncate max-w-[200px] text-slate-300">ARN: {arn}</span>
          <button
            onClick={handleCopyArn}
            className="hover:text-blue-400 text-slate-500 transition-colors"
            title="Copy Resource ARN"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      )}
    </nav>
  );
};
