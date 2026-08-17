import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Server, Cpu, HardDrive, Globe, Shield, Clock, Activity, RefreshCw,
  Info, AlertTriangle, Layers, Key, CheckCircle2, Lock
} from 'lucide-react';
import { StatusBadge } from '../ui/StatusBadge';
import api from '../../services/api';
import { getErrorMessage } from '../../utils/errorHandler';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip
} from 'recharts';

export const EC2DetailModal = ({ isOpen, onClose, instance }) => {
  const [timeRange, setTimeRange] = useState('1h');
  const [metricsData, setMetricsData] = useState(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [metricsError, setMetricsError] = useState('');

  const timeRanges = [
    { label: '5m', value: '5m' },
    { label: '15m', value: '15m' },
    { label: '1h', value: '1h' },
    { label: '3h', value: '3h' },
    { label: '6h', value: '6h' },
    { label: '12h', value: '12h' },
    { label: '24h', value: '24h' },
    { label: '7d', value: '7d' },
  ];

  const fetchInstanceMetrics = async (range = timeRange) => {
    if (!instance || !instance.instance_id) return;
    setLoadingMetrics(true);
    setMetricsError('');

    try {
      const headers = {};
      if (instance.aws_account_id) {
        headers['X-AWS-Account-ID'] = instance.aws_account_id;
      }

      const res = await api.get(`/cloudwatch/ec2/${instance.instance_id}/metrics`, {
        params: { range, metric: 'all' },
        headers
      });

      if (res.data && res.data.metrics) {
        setMetricsData(res.data.metrics);
      } else {
        setMetricsData(null);
      }
    } catch (err) {
      console.error('Failed to fetch CloudWatch metrics for instance:', err);
      const errMsg = getErrorMessage(err, 'Failed to load metrics.');
      setMetricsError(errMsg);
    } finally {
      setLoadingMetrics(false);
    }
  };

  useEffect(() => {
    if (isOpen && instance) {
      fetchInstanceMetrics(timeRange);
    }
  }, [isOpen, instance, timeRange]);

  if (!isOpen || !instance) return null;

  const instId = instance.instance_id;
  const instName = instance.name || 'Unnamed Server';

  const formatByteSize = (bytes) => {
    if (bytes === null || bytes === undefined || isNaN(bytes)) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const renderMetricCard = (title, metricKey, color = '#3b82f6', isBytes = false) => {
    const m = metricsData?.[metricKey];
    const dps = m?.datapoints || [];
    const hasData = m?.has_data && dps.length > 0;
    const latestVal = m?.latest_value;

    let displayVal = 'N/A';
    if (latestVal !== null && latestVal !== undefined) {
      displayVal = isBytes ? formatByteSize(latestVal) : `${latestVal} ${m?.unit || ''}`;
    }

    return (
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-3.5 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-300">{title}</span>
          <span className="text-xs font-bold text-white font-mono">{displayVal}</span>
        </div>

        <div className="h-28 w-full pt-1">
          {loadingMetrics ? (
            <div className="h-full flex items-center justify-center text-[10px] text-slate-500">
              Loading AWS telemetry...
            </div>
          ) : !hasData ? (
            <div className="h-full flex items-center justify-center gap-1.5 text-[11px] text-slate-500 bg-slate-950/40 rounded border border-slate-800/40 px-2 text-center">
              <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>No CloudWatch data available for this time range.</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dps} margin={{ top: 4, right: 4, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id={`grad-${metricKey}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={color} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="label" stroke="#64748b" tick={{ fontSize: 9 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 9 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '6px', fontSize: '11px' }}
                  labelStyle={{ color: '#94a3b8' }}
                />
                <Area type="monotone" dataKey="value" stroke={color} fillOpacity={1} fill={`url(#grad-${metricKey})`} strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    );
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 select-none font-mono-tabular">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.15 }}
          className="w-full max-w-4xl max-h-[90vh] bg-[#0d121f] border border-slate-800 rounded-xl p-6 shadow-2xl space-y-5 overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">{instName}</h3>
                  <StatusBadge status={instance.status || instance.state} />
                </div>
                <span className="text-xs text-slate-400 font-mono">{instId}</span>
              </div>
            </div>

            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-lg cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Instance Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800/80 text-xs">
            <div>
              <span className="text-slate-500 text-[11px] block">Operating System</span>
              <span className="text-slate-200 font-bold">{instance.os}</span>
            </div>
            <div>
              <span className="text-slate-500 text-[11px] block">Instance Type</span>
              <span className="text-blue-400 font-bold font-mono">{instance.instance_type}</span>
            </div>
            <div>
              <span className="text-slate-500 text-[11px] block">Public IP</span>
              <span className="text-emerald-400 font-bold font-mono">{instance.public_ip || 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-500 text-[11px] block">Private IP</span>
              <span className="text-slate-300 font-mono">{instance.private_ip || 'N/A'}</span>
            </div>

            <div>
              <span className="text-slate-500 text-[11px] block">AMI ID</span>
              <span className="text-slate-300 font-mono">{instance.ami_id || 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-500 text-[11px] block">Architecture</span>
              <span className="text-slate-300 font-mono">{instance.architecture || 'x86_64'}</span>
            </div>
            <div>
              <span className="text-slate-500 text-[11px] block">VPC ID</span>
              <span className="text-slate-300 font-mono">{instance.vpc_id || 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-500 text-[11px] block">Subnet ID</span>
              <span className="text-slate-300 font-mono">{instance.subnet_id || 'N/A'}</span>
            </div>

            <div>
              <span className="text-slate-500 text-[11px] block">AWS Account</span>
              <span className="text-slate-200 font-semibold">{instance.aws_account_name || instance.account_name}</span>
            </div>
            <div>
              <span className="text-slate-500 text-[11px] block">Region</span>
              <span className="text-slate-300 font-mono">{instance.region || 'ap-south-1'}</span>
            </div>
            <div>
              <span className="text-slate-500 text-[11px] block">Key Pair</span>
              <span className="text-slate-300 font-mono">{instance.key_name || 'None'}</span>
            </div>
            <div>
              <span className="text-slate-500 text-[11px] block">Launch Time</span>
              <span className="text-slate-300">{instance.launch_time || 'N/A'}</span>
            </div>
          </div>

          {/* Security Groups */}
          {instance.security_groups && instance.security_groups.length > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400 font-semibold">Security Groups:</span>
              <div className="flex flex-wrap gap-1.5">
                {instance.security_groups.map((sg) => (
                  <span key={sg.group_id} className="px-2 py-0.5 bg-slate-900 border border-slate-800 rounded text-slate-300 font-mono text-[11px]">
                    {sg.group_name} ({sg.group_id})
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* CloudWatch Telemetry Header & Range Selector */}
          <div className="pt-2 border-t border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-400" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Real AWS CloudWatch Telemetry</h4>
              </div>

              {/* Time Range Selector */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                {timeRanges.map((tr) => (
                  <button
                    key={tr.value}
                    onClick={() => setTimeRange(tr.value)}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded transition-colors cursor-pointer ${
                      timeRange === tr.value
                        ? 'bg-blue-600 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    {tr.label}
                  </button>
                ))}
              </div>
            </div>

            {metricsError && (
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded text-xs text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{metricsError}</span>
              </div>
            )}

            {/* Metrics Charts Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {renderMetricCard('CPU Utilization', 'CPUUtilization', '#3b82f6')}
              {renderMetricCard('Network In', 'NetworkIn', '#10b981', true)}
              {renderMetricCard('Network Out', 'NetworkOut', '#8b5cf6', true)}
              {renderMetricCard('Disk Read Bytes', 'DiskReadBytes', '#f59e0b', true)}
              {renderMetricCard('Disk Write Bytes', 'DiskWriteBytes', '#ec4899', true)}
              {renderMetricCard('Status Check Failed', 'StatusCheckFailed', '#ef4444')}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
