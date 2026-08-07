import React, { useState, useEffect } from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { StatsCards } from '../../components/cards/StatsCards';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import {
  CheckCircle2,
  AlertTriangle,
  Key,
  User,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
  Globe,
  Building2,
  Server,
  HardDrive,
  FileText,
  Bell,
  Layers,
  Plus,
  Loader2
} from 'lucide-react';

export const DashboardPage = () => {
  const { user, awsAccounts, selectedAccountId, setSelectedAccountId } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    total_ec2: 0,
    running_ec2: 0,
    stopped_ec2: 0,
    total_buckets: 0,
    total_objects: 0,
    total_alarms: 0,
    accounts_count: 0,
    accounts_breakdown: []
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardStats = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await api.get('/aws/dashboard');
      if (res.data) {
        setStats(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard stats:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardStats();

    const handleAccountChange = () => fetchDashboardStats(true);
    window.addEventListener('aws-account-changed', handleAccountChange);
    return () => window.removeEventListener('aws-account-changed', handleAccountChange);
  }, [selectedAccountId]);

  const activeAccountName = selectedAccountId === 'all'
    ? 'All Connected Accounts'
    : awsAccounts.find((a) => String(a.id) === String(selectedAccountId))?.account_name || 'Personal Account';

  const statsItems = [
    { title: 'Total EC2 Servers', value: `${stats.total_ec2} Instances`, change: `${stats.running_ec2} Running`, changeType: 'increase', icon: Server, subtitle: `${stats.stopped_ec2} Stopped instances` },
    { title: 'Total S3 Buckets', value: `${stats.total_buckets} Buckets`, change: 'Live AWS', changeType: 'increase', icon: HardDrive, subtitle: `${stats.total_objects} Stored Objects` },
    { title: 'Total Stored Objects', value: `${stats.total_objects} Objects`, change: 'Synced', changeType: 'increase', icon: FileText, subtitle: 'S3 Standard & Glacier Tiers' },
    { title: 'CloudWatch Alarms', value: `${stats.total_alarms} Triggers`, change: 'Active', changeType: 'increase', icon: Bell, subtitle: 'Evaluated across telemetry' },
  ];

  return (
    <div className="font-mono-tabular space-y-6 pb-24">
      <PageHeader
        title={`Welcome back, ${user?.name || 'User'}!`}
        description={`Multi-AWS Operations Center — Current Scope: ${activeAccountName}`}
        arn={`arn:aws:iam::multitenant:${selectedAccountId}`}
        onRefresh={() => fetchDashboardStats(true)}
        isRefreshing={refreshing}
        actions={
          <button
            onClick={() => navigate('/aws/accounts')}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow transition-colors"
          >
            <Building2 className="w-4 h-4" />
            <span>Manage AWS Accounts ({awsAccounts.length})</span>
          </button>
        }
      />

      <StatsCards items={statsItems} />

      {/* Aggregate Multi-Account Overview Grid */}
      <div className="bg-[#111827] border border-slate-800 rounded-lg p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              {selectedAccountId === 'all' ? 'Aggregated AWS Accounts Breakdown' : `Account Details: ${activeAccountName}`}
            </h3>
          </div>

          <button
            onClick={() => fetchDashboardStats(true)}
            className="p-1.5 bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 rounded text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-400' : ''}`} />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
            <span>Aggregating multi-account AWS metrics via Boto3...</span>
          </div>
        ) : stats.accounts_breakdown.length === 0 ? (
          <div className="p-8 text-center space-y-3 text-xs text-slate-400">
            <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
            <p className="font-semibold text-slate-200">No AWS Accounts Connected</p>
            <p>Connect your IAM credentials in the AWS Account Manager to view aggregated telemetry.</p>
            <button
              onClick={() => navigate('/aws/accounts')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-semibold inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Connect AWS Account</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {stats.accounts_breakdown.map((acc) => (
              <div
                key={acc.id}
                onClick={() => {
                  setSelectedAccountId(acc.id);
                  navigate('/dashboard');
                }}
                className="p-4 bg-slate-900/80 border border-slate-800 hover:border-blue-500/50 rounded-lg space-y-3 cursor-pointer transition-all group"
              >
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
                    <span className="font-bold text-white text-xs group-hover:text-blue-400">{acc.account_name}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono px-1.5 py-0.5 bg-slate-950 border border-slate-800 rounded">
                    {acc.region}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-500 block">EC2 Instances</span>
                    <span className="font-bold text-white">{acc.ec2_count}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">S3 Storage</span>
                    <span className="font-bold text-blue-400">{acc.buckets_count} Buckets</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Total Objects</span>
                    <span className="font-bold text-emerald-400">{acc.objects_count}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">CloudWatch Alarms</span>
                    <span className="font-bold text-amber-400">{acc.alarms_count}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400 group-hover:text-blue-300">
                  <span>Account ID: {acc.account_id}</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
