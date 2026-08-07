import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { useToast } from '../../context/ToastContext';
import api from '../../services/api';
import {
  ShieldCheck,
  ShieldAlert,
  Server,
  Database,
  Activity,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Key,
  Globe,
  User,
  Info,
  Terminal
} from 'lucide-react';

export const DiagnosticsPage = () => {
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [lastAuditTime, setLastAuditTime] = useState('Never');

  const fetchDiagnostics = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get('/aws/diagnostics');
      if (res.data) {
        setData(res.data);
        setLastAuditTime(new Date().toLocaleTimeString());
        if (!silent) showToast('AWS Diagnostics & IAM Audit completed.', 'success');
      }
    } catch (err) {
      console.error('Diagnostics fetch failed:', err);
      const msg = err.response?.data?.error || 'Failed to execute AWS API diagnostics.';
      showToast(msg, 'error');
    } fontFinally: {
      if (!silent) setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchDiagnostics();

    const handleAccountChange = () => fetchDiagnostics(true);
    window.addEventListener('aws-account-changed', handleAccountChange);
    return () => window.removeEventListener('aws-account-changed', handleAccountChange);
  }, [fetchDiagnostics]);

  const stsStatus = data?.sts;
  const isStsValid = stsStatus?.status === 'GREEN';

  return (
    <div className="space-y-6 font-mono-tabular">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <PageHeader
          title="AWS System Diagnostics & IAM Audit"
          description="Live AWS STS caller identity verification, IAM policy permission checks, and EC2/S3/CloudWatch API status."
          arn={data?.arn || 'arn:aws:sts:*:*:caller-identity'}
        />

        <button
          onClick={() => fetchDiagnostics(false)}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-lg font-bold shadow-md shadow-blue-500/20 transition-all disabled:opacity-50 cursor-pointer self-start md:self-auto text-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Run Audit Now</span>
        </button>
      </div>

      {loading ? (
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-12 text-center text-slate-400 font-mono-tabular space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
          <p className="font-bold text-white text-sm">Executing Live AWS API Diagnostics & STS Verification...</p>
          <p className="text-xs text-slate-500">Querying AWS STS caller identity, EC2 RunInstances dry-runs, and S3 list permissions.</p>
        </div>
      ) : !data ? (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-6 text-rose-300 text-xs flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
          <span>Unable to perform AWS API audit. Please check your connected AWS account credentials.</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* STS Identity Card */}
          <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                {isStsValid ? (
                  <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
                ) : (
                  <ShieldAlert className="w-6 h-6 text-rose-400 shrink-0" />
                )}
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>AWS STS Caller Identity</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isStsValid ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}`}>
                      {isStsValid ? 'CREDENTIALS VALID' : 'CREDENTIALS INVALID'}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Verified via sts.get_caller_identity() at {lastAuditTime}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-lg space-y-1">
                <span className="text-slate-500 text-[10px] uppercase font-bold flex items-center gap-1">
                  <User className="w-3 h-3 text-blue-400" /> Account Name
                </span>
                <p className="text-white font-bold truncate">{data.account_name || 'Personal Account'}</p>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-lg space-y-1">
                <span className="text-slate-500 text-[10px] uppercase font-bold flex items-center gap-1">
                  <Key className="w-3 h-3 text-amber-400" /> Account ID
                </span>
                <p className="text-emerald-400 font-mono font-bold">{data.account_id}</p>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-lg space-y-1">
                <span className="text-slate-500 text-[10px] uppercase font-bold flex items-center gap-1">
                  <Globe className="w-3 h-3 text-purple-400" /> Target Region
                </span>
                <p className="text-white font-mono font-bold">{data.region}</p>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-lg space-y-1">
                <span className="text-slate-500 text-[10px] uppercase font-bold flex items-center gap-1">
                  <Terminal className="w-3 h-3 text-emerald-400" /> Principal ARN
                </span>
                <p className="text-slate-300 font-mono text-[11px] truncate" title={data.arn}>{data.arn}</p>
              </div>
            </div>
          </div>

          {/* API Health Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* EC2 API Status */}
            <div className={`bg-[#111827] border rounded-xl p-4 shadow-xl space-y-2 ${data.ec2_status?.status === 'GREEN' ? 'border-slate-800' : 'border-rose-500/40 bg-rose-500/5'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-blue-400" />
                  <h4 className="text-xs font-bold text-white">EC2 API Status</h4>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${data.ec2_status?.status === 'GREEN' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}`}>
                  {data.ec2_status?.status === 'GREEN' ? 'OPERATIONAL' : 'API ERROR'}
                </span>
              </div>
              <p className="text-xs text-slate-300 font-mono">{data.ec2_status?.message}</p>
            </div>

            {/* S3 API Status */}
            <div className={`bg-[#111827] border rounded-xl p-4 shadow-xl space-y-2 ${data.s3_status?.status === 'GREEN' ? 'border-slate-800' : 'border-rose-500/40 bg-rose-500/5'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-purple-400" />
                  <h4 className="text-xs font-bold text-white">S3 API Status</h4>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${data.s3_status?.status === 'GREEN' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}`}>
                  {data.s3_status?.status === 'GREEN' ? 'OPERATIONAL' : 'API ERROR'}
                </span>
              </div>
              <p className="text-xs text-slate-300 font-mono">{data.s3_status?.message}</p>
            </div>

            {/* CloudWatch API Status */}
            <div className={`bg-[#111827] border rounded-xl p-4 shadow-xl space-y-2 ${data.cloudwatch_status?.status === 'GREEN' ? 'border-slate-800' : 'border-rose-500/40 bg-rose-500/5'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-xs font-bold text-white">CloudWatch API Status</h4>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${data.cloudwatch_status?.status === 'GREEN' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}`}>
                  {data.cloudwatch_status?.status === 'GREEN' ? 'OPERATIONAL' : 'API ERROR'}
                </span>
              </div>
              <p className="text-xs text-slate-300 font-mono">{data.cloudwatch_status?.message}</p>
            </div>
          </div>

          {/* IAM Permissions Table */}
          <div className="bg-[#111827] border border-slate-800 rounded-xl overflow-hidden shadow-xl space-y-2">
            <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">IAM Policy Permissions Audit</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Simulated & dry-run policy evaluation for EC2, S3, and CloudWatch actions</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse font-mono-tabular">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold tracking-wider border-b border-slate-800 select-none">
                    <th className="py-3 px-4">Service</th>
                    <th className="py-3 px-4">IAM Action</th>
                    <th className="py-3 px-4">Permission State</th>
                    <th className="py-3 px-4">AWS API Response Details / Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {data.permissions && data.permissions.length > 0 ? (
                    data.permissions.map((p, idx) => {
                      const isAllowed = p.status.includes('ALLOWED');
                      return (
                        <tr key={idx} className="hover:bg-slate-900/80 transition-colors">
                          <td className="py-3 px-4 font-bold text-white">{p.service}</td>
                          <td className="py-3 px-4 text-blue-400 font-mono font-bold">{p.action}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1 border ${isAllowed ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border-rose-500/30'}`}>
                              {isAllowed ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <XCircle className="w-3 h-3 text-rose-400" />}
                              <span>{p.status}</span>
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-300 font-mono text-[11px]">
                            {p.error ? (
                              <span className="text-rose-400 font-semibold">{p.error}</span>
                            ) : (
                              <span className="text-slate-500">Action evaluated & permitted by IAM policy.</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-500">No IAM permission audit results available.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DiagnosticsPage;
