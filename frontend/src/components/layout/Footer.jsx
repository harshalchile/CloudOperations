import React from 'react';
import { ShieldCheck, Cpu, GitBranch, ExternalLink } from 'lucide-react';

export const Footer = () => {
  return (
    <footer className="h-10 px-4 border-t border-slate-800/80 bg-[#0d121f]/60 text-[11px] text-slate-400 flex items-center justify-between font-mono-tabular select-none">
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5 text-slate-300">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>CloudOps Engine v3.4</span>
        </span>
        <span className="hidden sm:inline-block text-slate-600">|</span>
        <span className="hidden sm:flex items-center gap-1 text-slate-400">
          <GitBranch className="w-3 h-3 text-slate-500" />
          <span>main (a9f1b0c)</span>
        </span>
      </div>

      <div className="flex items-center gap-4">
        <a
          href="https://aws.amazon.com/status"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-blue-400 transition-colors flex items-center gap-1"
        >
          <span>AWS Health Dashboard</span>
          <ExternalLink className="w-3 h-3 text-slate-500" />
        </a>
        <span className="text-slate-600">|</span>
        <span className="text-slate-400">Latency: 14ms</span>
      </div>
    </footer>
  );
};
