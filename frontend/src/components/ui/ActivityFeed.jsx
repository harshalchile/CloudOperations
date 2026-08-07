import React, { useState } from 'react';
import { Pause, Play, Filter, RefreshCw } from 'lucide-react';
import { StatusBadge } from './StatusBadge';

export const ActivityFeed = ({ initialActivities = [] }) => {
  const [isPaused, setIsPaused] = useState(false);
  const [filterService, setFilterService] = useState('ALL');

  const activities = initialActivities;

  const filtered = activities.filter((act) =>
    filterService === 'ALL' ? true : act.service === filterService
  );

  return (
    <div className="bg-[#111827] border border-slate-800 rounded-lg p-4 font-mono-tabular">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">Live Audit Stream</h3>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <select
            value={filterService}
            onChange={(e) => setFilterService(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-slate-300 px-2 py-1 rounded text-xs focus:outline-none"
          >
            <option value="ALL">All Services</option>
            <option value="EC2">EC2</option>
            <option value="S3">S3</option>
            <option value="IAM">IAM</option>
            <option value="CloudWatch">CloudWatch</option>
          </select>

          <button
            onClick={() => setIsPaused(!isPaused)}
            className="p-1.5 bg-slate-900 border border-slate-800 rounded text-slate-400 hover:text-slate-200 transition-colors"
            title={isPaused ? 'Resume Stream' : 'Pause Stream'}
          >
            {isPaused ? <Play className="w-3.5 h-3.5 text-emerald-400" /> : <Pause className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {filtered.map((act, i) => (
          <div
            key={i}
            className="p-2.5 bg-slate-900/60 border border-slate-800/60 rounded flex items-center justify-between text-xs hover:border-slate-700 transition-colors"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="px-1.5 py-0.5 text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded font-semibold shrink-0">
                {act.service}
              </span>
              <span className="text-slate-300 truncate">{act.action}</span>
            </div>

            <div className="flex items-center gap-3 shrink-0 text-[11px] text-slate-400">
              <span className="text-slate-400">{act.user}</span>
              <span>{act.time}</span>
              <StatusBadge status={act.status} className="py-0 px-1 text-[10px]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
