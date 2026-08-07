import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 border border-slate-700/80 p-2.5 rounded shadow-xl text-xs font-mono-tabular">
        <p className="text-slate-400 font-semibold mb-1 border-b border-slate-800 pb-1">{label}</p>
        {payload.map((item, index) => (
          <div key={index} className="flex items-center justify-between gap-4 py-0.5">
            <span style={{ color: item.color }} className="font-medium">{item.name}:</span>
            <span className="text-white font-bold">{item.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export const EnterpriseAreaChart = ({ data, xKey, dataKeys = [], height = 240 }) => {
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];

  return (
    <div style={{ width: '100%', height: height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            {dataKeys.map((key, idx) => {
              const color = colors[idx % colors.length];
              return (
                <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              );
            })}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f293d" vertical={false} />
          <XAxis dataKey={xKey} stroke="#64748b" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis stroke="#64748b" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip content={<CustomTooltip />} />
          {dataKeys.map((key, idx) => {
            const color = colors[idx % colors.length];
            return (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stroke={color}
                strokeWidth={2}
                fillOpacity={1}
                fill={`url(#grad-${key})`}
              />
            );
          })}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export const EnterpriseBarChart = ({ data, xKey, dataKeys = [], height = 240 }) => {
  const colors = ['#3b82f6', '#8b5cf6', '#10b981'];

  return (
    <div style={{ width: '100%', height: height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f293d" vertical={false} />
          <XAxis dataKey={xKey} stroke="#64748b" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis stroke="#64748b" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip content={<CustomTooltip />} />
          {dataKeys.map((key, idx) => (
            <Bar key={key} dataKey={key} fill={colors[idx % colors.length]} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
