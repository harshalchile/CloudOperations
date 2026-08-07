import React, { useState } from 'react';
import { EnterpriseAreaChart, EnterpriseBarChart } from './Charts';
import { Maximize2, RefreshCcw, Download } from 'lucide-react';

export const MetricsPanel = ({ title, data, xKey, dataKeys, type = 'area' }) => {
  const [timeRange, setTimeRange] = useState('24h');

  const ranges = ['1h', '6h', '24h', '7d', '30d'];

  return (
    <div className="bg-[#111827] border border-slate-800 rounded-lg p-4 font-mono-tabular">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-800">
        <div>
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">{title}</h3>
          <p className="text-[11px] text-slate-400">Live Grafana / Datadog Telemetry Stream</p>
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded p-0.5 text-xs text-slate-400">
            {ranges.map((r) => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={`px-2 py-0.5 rounded transition-colors ${
                  timeRange === r
                    ? 'bg-blue-600/20 text-blue-400 font-semibold border border-blue-500/30'
                    : 'hover:text-slate-200'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <button
            className="p-1 bg-slate-900 border border-slate-800 rounded text-slate-400 hover:text-slate-200"
            title="Download CSV"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {type === 'area' ? (
        <EnterpriseAreaChart data={data} xKey={xKey} dataKeys={dataKeys} height={220} />
      ) : (
        <EnterpriseBarChart data={data} xKey={xKey} dataKeys={dataKeys} height={220} />
      )}
    </div>
  );
};
