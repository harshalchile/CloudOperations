import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import {
  Activity,
  ShieldAlert,
  Search,
  Pause,
  Play,
  Bell,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Clock,
  Layers,
  FileText,
  ChevronRight,
  X,
  Info,
  Filter,
  Server,
  Database,
  HardDrive,
  Cpu,
  BarChart3,
  Plus,
  Trash2,
  Eye,
  Key,
  TrendingUp,
  AlertCircle,
  Loader2
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';

export const CloudWatchPage = () => {
  const { showToast } = useToast();
  const { awsAccounts, selectedAccountId } = useAuth();

  // Scope Tab: 'ec2' | 's3'
  const [activeScope, setActiveScope] = useState('ec2');

  // Auto Refresh State (60 seconds)
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [secondsRemaining, setSecondsRemaining] = useState(60);

  // Stats Dashboard
  const [stats, setStats] = useState({
    total_alarms: 0,
    alarms_in_alarm: 0,
    alarms_in_ok: 0,
    alarms_insufficient_data: 0,
    total_s3_watches: 0,
    s3_watches_exceeded: 0,
    last_sync_time: 'Never'
  });
  const [loadingStats, setLoadingStats] = useState(false);

  // --- EC2 Scope State ---
  const [instances, setInstances] = useState([]);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [instanceError, setInstanceError] = useState('');
  const [selectedInstanceId, setSelectedInstanceId] = useState('');
  const [timeRange, setTimeRange] = useState('1h'); // 5m, 15m, 1h, 3h, 6h, 24h, 7d
  const [ec2Metrics, setEc2Metrics] = useState(null);
  const [loadingEc2Metrics, setLoadingEc2Metrics] = useState(false);

  // EC2 Alarms
  const [alarms, setAlarms] = useState([]);
  const [loadingAlarms, setLoadingAlarms] = useState(false);
  const [isAlarmModalOpen, setIsAlarmModalOpen] = useState(false);
  const [alarmForm, setAlarmForm] = useState({
    alarm_name: '',
    account_id: '',
    instance_id: '',
    threshold: 80,
    period: 300,
    comparison_operator: 'GreaterThanThreshold'
  });
  const [modalInstances, setModalInstances] = useState([]);
  const [loadingModalInstances, setLoadingModalInstances] = useState(false);
  const [submittingAlarm, setSubmittingAlarm] = useState(false);
  const [alarmToDelete, setAlarmToDelete] = useState(null);

  // EC2 Health Watch
  const [healthInstances, setHealthInstances] = useState([]);
  const [loadingHealth, setLoadingHealth] = useState(false);

  // --- S3 Scope State ---
  const [s3Buckets, setS3Buckets] = useState([]);
  const [selectedBucket, setSelectedBucket] = useState('');
  const [s3Metrics, setS3Metrics] = useState([]);
  const [s3HasData, setS3HasData] = useState(false);
  const [loadingS3Metrics, setLoadingS3Metrics] = useState(false);

  // S3 Storage Watch
  const [s3Watches, setS3Watches] = useState([]);
  const [loadingS3Watches, setLoadingS3Watches] = useState(false);
  const [isS3WatchModalOpen, setIsS3WatchModalOpen] = useState(false);
  const [s3WatchForm, setS3WatchForm] = useState({
    bucket_name: '',
    threshold_gb: 10,
    account_id: ''
  });
  const [submittingS3Watch, setSubmittingS3Watch] = useState(false);
  const [watchToDelete, setWatchToDelete] = useState(null);

  const getErrorMessage = (err, fallback = 'Operation failed.') => {
    if (!err) return fallback;
    const data = err.response?.data;
    if (data?.error?.message) return data.error.message;
    if (data?.aws_error_message) return data.aws_error_message;
    if (typeof data?.error === 'string') return data.error;
    if (data?.message) return data.message;
    return err.message || fallback;
  };

  // Fetch Summary Stats
  const fetchStats = useCallback(async () => {
    try {
      const params = {};
      if (selectedAccountId && selectedAccountId !== 'all') {
        params.account_id = selectedAccountId;
      }
      const res = await api.get('/cloudwatch/stats', { params });
      if (res.data) setStats(res.data);
    } catch (err) {
      console.error('Error fetching CloudWatch stats:', err);
    }
  }, [selectedAccountId]);

  // Fetch EC2 Instances list for the selected account(s)
  const fetchEc2Instances = useCallback(async () => {
    setLoadingInstances(true);
    setInstanceError('');
    try {
      const params = {};
      if (selectedAccountId && selectedAccountId !== 'all') {
        params.account_id = selectedAccountId;
      }
      const res = await api.get('/ec2', { params });
      if (res.data && res.data.instances) {
        const instList = res.data.instances;
        setInstances(instList);
        // Auto-select first instance if none or if current selection is invalid
        if (instList.length > 0) {
          const currentExists = instList.some((i) => (i.id || i.instance_id) === selectedInstanceId);
          if (!selectedInstanceId || !currentExists) {
            setSelectedInstanceId(instList[0].id || instList[0].instance_id);
          }
        } else {
          setSelectedInstanceId('');
        }
      } else {
        setInstances([]);
        setSelectedInstanceId('');
      }
    } catch (err) {
      console.error('Failed to fetch EC2 instances:', err);
      const errMsg = getErrorMessage(err, 'Unable to load EC2 instances');
      setInstanceError(errMsg);
      setInstances([]);
    } finally {
      setLoadingInstances(false);
    }
  }, [selectedAccountId, selectedInstanceId]);

  // Fetch Instances for Create Alarm Modal when an account is selected
  const fetchModalInstances = useCallback(async (accId) => {
    setLoadingModalInstances(true);
    try {
      const params = {};
      if (accId && accId !== 'all') {
        params.account_id = accId;
      }
      const res = await api.get('/ec2', { params });
      if (res.data && res.data.instances) {
        setModalInstances(res.data.instances);
        if (res.data.instances.length > 0) {
          setAlarmForm((prev) => ({
            ...prev,
            instance_id: res.data.instances[0].id || res.data.instances[0].instance_id
          }));
        } else {
          setAlarmForm((prev) => ({ ...prev, instance_id: '' }));
        }
      } else {
        setModalInstances([]);
      }
    } catch (err) {
      console.error('Failed to fetch modal EC2 instances:', err);
      setModalInstances([]);
    } finally {
      setLoadingModalInstances(false);
    }
  }, []);

  // Fetch EC2 Metrics for Selected Instance
  const fetchEc2Metrics = useCallback(async () => {
    if (!selectedInstanceId) {
      setEc2Metrics(null);
      return;
    }
    setLoadingEc2Metrics(true);
    try {
      const params = { time_range: timeRange };
      if (selectedAccountId && selectedAccountId !== 'all') {
        params.account_id = selectedAccountId;
      }
      const res = await api.get(`/cloudwatch/ec2/${selectedInstanceId}/metrics`, { params });
      if (res.data) setEc2Metrics(res.data);
    } catch (err) {
      console.error('Failed to fetch EC2 metrics:', err);
    } finally {
      setLoadingEc2Metrics(false);
    }
  }, [selectedInstanceId, timeRange, selectedAccountId]);

  // Fetch EC2 Alarms
  const fetchEc2Alarms = useCallback(async () => {
    setLoadingAlarms(true);
    try {
      const params = {};
      if (selectedAccountId && selectedAccountId !== 'all') {
        params.account_id = selectedAccountId;
      }
      const res = await api.get('/cloudwatch/ec2/alarms', { params });
      if (res.data && res.data.alarms) {
        setAlarms(res.data.alarms);
      }
    } catch (err) {
      console.error('Failed to fetch EC2 alarms:', err);
    } finally {
      setLoadingAlarms(false);
    }
  }, [selectedAccountId]);

  // Fetch EC2 Health Watch
  const fetchEc2Health = useCallback(async () => {
    setLoadingHealth(true);
    try {
      const params = {};
      if (selectedAccountId && selectedAccountId !== 'all') {
        params.account_id = selectedAccountId;
      }
      const res = await api.get('/cloudwatch/ec2/health', { params });
      if (res.data && res.data.health_instances) {
        setHealthInstances(res.data.health_instances);
      }
    } catch (err) {
      console.error('Failed to fetch EC2 health watch:', err);
    } finally {
      setLoadingHealth(false);
    }
  }, [selectedAccountId]);

  // Fetch S3 Buckets List
  const fetchS3Buckets = useCallback(async () => {
    try {
      const params = {};
      if (selectedAccountId && selectedAccountId !== 'all') {
        params.account_id = selectedAccountId;
      }
      const res = await api.get('/cloudwatch/s3/buckets', { params });
      if (res.data && res.data.buckets) {
        setS3Buckets(res.data.buckets);
        if (res.data.buckets.length > 0 && !selectedBucket) {
          setSelectedBucket(res.data.buckets[0].name);
        }
      }
    } catch (err) {
      console.error('Failed to fetch S3 buckets:', err);
    }
  }, [selectedAccountId, selectedBucket]);

  // Fetch S3 Metrics
  const fetchS3Metrics = useCallback(async () => {
    setLoadingS3Metrics(true);
    try {
      const params = {};
      if (selectedBucket) params.bucket_name = selectedBucket;
      if (selectedAccountId && selectedAccountId !== 'all') {
        params.account_id = selectedAccountId;
      }
      const res = await api.get('/cloudwatch/s3/metrics', { params });
      if (res.data) {
        setS3Metrics(res.data.metrics || []);
        setS3HasData(res.data.has_data || false);
      }
    } catch (err) {
      console.error('Failed to fetch S3 CloudWatch metrics:', err);
    } finally {
      setLoadingS3Metrics(false);
    }
  }, [selectedBucket, selectedAccountId]);

  // Fetch S3 Storage Watches
  const fetchS3Watches = useCallback(async () => {
    setLoadingS3Watches(true);
    try {
      const params = {};
      if (selectedAccountId && selectedAccountId !== 'all') {
        params.account_id = selectedAccountId;
      }
      const res = await api.get('/cloudwatch/s3/watch', { params });
      if (res.data && res.data.watches) {
        setS3Watches(res.data.watches);
      }
    } catch (err) {
      console.error('Failed to fetch S3 storage watches:', err);
    } finally {
      setLoadingS3Watches(false);
    }
  }, [selectedAccountId]);

  // Refresh All Data based on Active Scope
  const refreshAll = useCallback(async () => {
    fetchStats();
    if (activeScope === 'ec2') {
      fetchEc2Instances();
      fetchEc2Alarms();
      fetchEc2Health();
    } else {
      fetchS3Buckets();
      fetchS3Metrics();
      fetchS3Watches();
    }
  }, [activeScope, fetchStats, fetchEc2Instances, fetchEc2Alarms, fetchEc2Health, fetchS3Buckets, fetchS3Metrics, fetchS3Watches]);

  useEffect(() => {
    refreshAll();
  }, [activeScope, selectedAccountId, refreshAll]);

  // When selectedInstanceId changes, fetch its telemetry
  useEffect(() => {
    if (activeScope === 'ec2' && selectedInstanceId) {
      fetchEc2Metrics();
    }
  }, [activeScope, selectedInstanceId, timeRange, fetchEc2Metrics]);

  // Auto Refresh Timer (60 Seconds)
  useEffect(() => {
    let interval = null;
    if (autoRefresh) {
      interval = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            refreshAll();
            return 60;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setSecondsRemaining(60);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, refreshAll]);

  // Open Create Alarm Modal & Prepare Account Context
  const handleOpenAlarmModal = () => {
    const defaultAccId = (selectedAccountId && selectedAccountId !== 'all')
      ? selectedAccountId
      : (awsAccounts.length > 0 ? String(awsAccounts[0].id) : '');

    setAlarmForm({
      alarm_name: '',
      account_id: defaultAccId,
      instance_id: selectedInstanceId || '',
      threshold: 80,
      period: 300,
      comparison_operator: 'GreaterThanThreshold'
    });

    if (defaultAccId) {
      fetchModalInstances(defaultAccId);
    } else {
      setModalInstances(instances);
    }

    setIsAlarmModalOpen(true);
  };

  // Create EC2 CPU Alarm Handler
  const handleCreateAlarmSubmit = async (e) => {
    e.preventDefault();
    if (!alarmForm.alarm_name.trim()) {
      showToast('Alarm Name is required.', 'error');
      return;
    }
    if (!alarmForm.instance_id) {
      showToast('Please select an EC2 instance.', 'error');
      return;
    }

    setSubmittingAlarm(true);
    try {
      const payload = {
        alarm_name: alarmForm.alarm_name.trim(),
        instance_id: alarmForm.instance_id,
        threshold: Number(alarmForm.threshold),
        period: Number(alarmForm.period) || 300,
        comparison_operator: alarmForm.comparison_operator || 'GreaterThanThreshold',
        account_id: alarmForm.account_id || selectedAccountId
      };

      const res = await api.post('/cloudwatch/ec2/alarms', payload);
      if (res.data) {
        showToast(res.data.message || 'EC2 CPU alarm created successfully.', 'success');
        setIsAlarmModalOpen(false);
        fetchEc2Alarms();
        fetchStats();
      }
    } catch (err) {
      const errMsg = getErrorMessage(err, 'Failed to create CPU alarm in AWS');
      showToast(errMsg, 'error');
    } finally {
      setSubmittingAlarm(false);
    }
  };

  // Delete EC2 Alarm Handler
  const handleDeleteAlarm = async () => {
    if (!alarmToDelete) return;
    try {
      const params = {};
      if (alarmToDelete.aws_account_id) {
        params.account_id = alarmToDelete.aws_account_id;
      }
      const res = await api.delete(`/cloudwatch/ec2/alarms/${encodeURIComponent(alarmToDelete.alarm_name)}`, { params });
      if (res.data) {
        showToast(res.data.message || 'Alarm deleted successfully.', 'success');
        setAlarmToDelete(null);
        fetchEc2Alarms();
        fetchStats();
      }
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to delete alarm'), 'error');
    }
  };

  // Create S3 Storage Watch Handler
  const handleCreateS3WatchSubmit = async (e) => {
    e.preventDefault();
    if (!s3WatchForm.bucket_name || !s3WatchForm.threshold_gb) {
      showToast('Bucket Name and Threshold are required.', 'error');
      return;
    }

    setSubmittingS3Watch(true);
    try {
      const payload = { ...s3WatchForm };
      if (selectedAccountId && selectedAccountId !== 'all') {
        payload.account_id = selectedAccountId;
      }

      const res = await api.post('/cloudwatch/s3/watch', payload);
      if (res.data) {
        showToast(res.data.message || 'Storage watch created successfully.', 'success');
        setIsS3WatchModalOpen(false);
        setS3WatchForm({
          bucket_name: selectedBucket || '',
          threshold_gb: 10,
          account_id: ''
        });
        fetchS3Watches();
        fetchStats();
      }
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to create S3 storage watch'), 'error');
    } finally {
      setSubmittingS3Watch(false);
    }
  };

  // Delete S3 Storage Watch Handler
  const handleDeleteS3Watch = async () => {
    if (!watchToDelete) return;
    try {
      const res = await api.delete(`/cloudwatch/s3/watch/${watchToDelete.id}`);
      if (res.data) {
        showToast(res.data.message || 'Storage watch removed.', 'success');
        setWatchToDelete(null);
        fetchS3Watches();
        fetchStats();
      }
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to remove storage watch'), 'error');
    }
  };

  const renderMetricChartCard = (title, key, color, unitSuffix = '') => {
    const dataObj = ec2Metrics?.metrics?.[key] || {};
    const datapoints = dataObj.datapoints || [];
    const current = dataObj.current_value;
    const avg = dataObj.average_value;
    const min = dataObj.minimum_value;
    const max = dataObj.maximum_value;
    const unit = dataObj.unit || unitSuffix;

    return (
      <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-4 font-mono-tabular flex flex-col justify-between space-y-3 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className={`w-4 h-4 text-${color}-400`} />
            <h3 className="text-xs font-bold text-slate-100">{title}</h3>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            {timeRange.toUpperCase()}
          </span>
        </div>

        {/* Datapoint Summary Stats */}
        {dataObj.has_data ? (
          <div className="grid grid-cols-4 gap-2 bg-slate-950/60 p-2 rounded border border-slate-800/60 text-[11px]">
            <div>
              <span className="text-slate-400 block text-[9px]">CURRENT</span>
              <span className="font-bold text-white">{current ?? '--'} {unit}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[9px]">AVG</span>
              <span className="font-medium text-slate-300">{avg ?? '--'} {unit}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[9px]">MIN</span>
              <span className="font-medium text-slate-300">{min ?? '--'} {unit}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[9px]">MAX</span>
              <span className="font-medium text-slate-300">{max ?? '--'} {unit}</span>
            </div>
          </div>
        ) : (
          <div className="p-3 text-center text-xs text-slate-400 bg-slate-950/40 rounded border border-slate-800/40 font-mono">
            No CloudWatch data available for this period.
          </div>
        )}

        {/* Recharts Area Chart */}
        {datapoints.length > 0 && (
          <div className="h-36 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={datapoints} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color === 'emerald' ? '#10b981' : color === 'rose' ? '#f43f5e' : '#3b82f6'} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={color === 'emerald' ? '#10b981' : color === 'rose' ? '#f43f5e' : '#3b82f6'} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="label" stroke="#64748b" tick={{ fontSize: 9 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 9 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '6px', fontSize: '11px' }}
                />
                <Area type="monotone" dataKey="value" stroke={color === 'emerald' ? '#10b981' : color === 'rose' ? '#f43f5e' : '#3b82f6'} fillOpacity={1} fill={`url(#grad-${key})`} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 font-mono-tabular pb-12">
      {/* Top Header & Scope Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <PageHeader
            title="CloudWatch Monitoring"
            description="Real-time multi-account EC2 telemetry, CloudWatch CPU alarms, health watch, and S3 storage metrics."
          />
        </div>

        {/* Controls Bar: Scope Selector & Auto Refresh */}
        <div className="flex flex-wrap items-center gap-3">
          {/* EC2 vs S3 Top Scope Selector */}
          <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-lg">
            <button
              onClick={() => setActiveScope('ec2')}
              className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeScope === 'ec2'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>EC2 Monitoring</span>
            </button>
            <button
              onClick={() => setActiveScope('s3')}
              className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeScope === 's3'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>S3 Monitoring</span>
            </button>
          </div>

          {/* Auto Refresh Switch */}
          <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-lg text-xs">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className="flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors"
            >
              {autoRefresh ? (
                <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
              ) : (
                <Pause className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              )}
              <span className="font-semibold">{autoRefresh ? 'Auto Refresh ON' : 'Paused'}</span>
            </button>
            {autoRefresh && (
              <span className="text-[10px] text-slate-500 font-mono border-l border-slate-800 pl-2">
                {secondsRemaining}s
              </span>
            )}
          </div>

          {/* Manual Refresh */}
          <button
            onClick={refreshAll}
            className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="Refresh CloudWatch Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Overview Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 block font-semibold uppercase">Total CPU Alarms</span>
            <span className="text-xl font-bold text-white">{stats.total_alarms}</span>
          </div>
          <ShieldAlert className="w-5 h-5 text-blue-400 opacity-80" />
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 block font-semibold uppercase">Alarms In Alarm</span>
            <span className="text-xl font-bold text-rose-400">{stats.alarms_in_alarm}</span>
          </div>
          <AlertTriangle className="w-5 h-5 text-rose-400 opacity-80" />
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 block font-semibold uppercase">Alarms OK</span>
            <span className="text-xl font-bold text-emerald-400">{stats.alarms_in_ok}</span>
          </div>
          <CheckCircle2 className="w-5 h-5 text-emerald-400 opacity-80" />
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 block font-semibold uppercase">S3 Storage Watches</span>
            <span className="text-xl font-bold text-white">{stats.total_s3_watches}</span>
          </div>
          <Database className="w-5 h-5 text-blue-400 opacity-80" />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. EC2 MONITORING SECTION */}
      {/* ========================================================================= */}
      {activeScope === 'ec2' && (
        <div className="space-y-6">
          {/* EC2 Controls Bar with Instance Selector */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="text-xs font-bold text-slate-200">EC2 Instance:</span>
              </div>

              {loadingInstances ? (
                <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-950 border border-slate-800 rounded px-3 py-1.5 font-mono">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                  <span>Loading EC2 instances...</span>
                </div>
              ) : instances.length === 0 ? (
                <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-3 py-1.5 font-mono">
                  {instanceError ? `Unable to load EC2 instances: ${instanceError}` : 'No EC2 instances found in this AWS account.'}
                </div>
              ) : (
                <select
                  value={selectedInstanceId}
                  onChange={(e) => setSelectedInstanceId(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-white focus:ring-2 focus:ring-blue-500 focus:outline-none min-w-[240px] max-w-[380px] font-mono"
                >
                  {instances.map((i) => {
                    const instId = i.id || i.instance_id;
                    const instName = i.name || i.instance_name || 'Unnamed Instance';
                    const instState = (i.state || i.status || 'UNKNOWN').toUpperCase();
                    const accName = i.aws_account_name || i.account_name || '';
                    return (
                      <option key={instId} value={instId}>
                        {instName} ({instId}) - {instState} {accName ? `[${accName}]` : ''}
                      </option>
                    );
                  })}
                </select>
              )}

              <div className="flex items-center gap-2 ml-0 sm:ml-4">
                <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-xs font-bold text-slate-200">Period:</span>
              </div>
              <div className="flex bg-slate-950 border border-slate-800 rounded p-0.5 text-xs">
                {['5m', '15m', '1h', '3h', '6h', '24h', '7d'].map((r) => (
                  <button
                    key={r}
                    onClick={() => setTimeRange(r)}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                      timeRange === r ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleOpenAlarmModal}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-blue-500/20 transition-all cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create CPU Alarm</span>
            </button>
          </div>

          {/* EC2 Recharts Telemetry Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {renderMetricChartCard('CPU Utilization', 'CPUUtilization', 'blue', '%')}
            {renderMetricChartCard('Network In', 'NetworkIn', 'emerald', 'B')}
            {renderMetricChartCard('Network Out', 'NetworkOut', 'emerald', 'B')}
            {renderMetricChartCard('Disk Read', 'DiskReadBytes', 'blue', 'B')}
            {renderMetricChartCard('Disk Write', 'DiskWriteBytes', 'blue', 'B')}
            {renderMetricChartCard('Status Check Failed', 'StatusCheckFailed', 'rose', '')}
          </div>

          {/* EC2 Alarms Table */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-blue-400" />
                <h2 className="text-sm font-bold text-slate-100">EC2 CloudWatch Alarms</h2>
              </div>
              <span className="text-xs text-slate-400 font-mono">{alarms.length} Alarms Configured</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px]">
                    <th className="py-2.5 px-3">Alarm Name</th>
                    <th className="py-2.5 px-3">AWS Account</th>
                    <th className="py-2.5 px-3">Instance</th>
                    <th className="py-2.5 px-3">Metric</th>
                    <th className="py-2.5 px-3">Threshold</th>
                    <th className="py-2.5 px-3">State</th>
                    <th className="py-2.5 px-3">Last Updated</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loadingAlarms ? (
                    <tr>
                      <td colSpan="8" className="py-8 text-center text-slate-500">
                        Loading CloudWatch Alarms...
                      </td>
                    </tr>
                  ) : alarms.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="py-8 text-center text-slate-500">
                        No CloudWatch EC2 alarms found.
                      </td>
                    </tr>
                  ) : (
                    alarms.map((a) => (
                      <tr key={a.alarm_name} className="hover:bg-slate-800/50 transition-colors">
                        <td className="py-3 px-3 font-bold text-white">{a.alarm_name}</td>
                        <td className="py-3 px-3">
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-200">{a.aws_account_name}</span>
                            <span className="text-[10px] text-slate-400">{a.aws_account_number}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-300">
                          {a.instance_name ? `${a.instance_name} (${a.instance_id})` : a.instance_id}
                        </td>
                        <td className="py-3 px-3 font-semibold text-blue-400">{a.metric_name}</td>
                        <td className="py-3 px-3 font-semibold text-slate-200">&gt; {a.threshold}%</td>
                        <td className="py-3 px-3">
                          <StatusBadge status={a.state_value} />
                        </td>
                        <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">{a.last_updated}</td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => setAlarmToDelete(a)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                            title="Delete Alarm"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* EC2 Instance Health Watch Section */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-bold text-slate-100">EC2 Instance Health Watch</h2>
              </div>
              <span className="text-xs text-slate-400 font-mono">{healthInstances.length} Instances Monitored</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {loadingHealth ? (
                <div className="col-span-full py-6 text-center text-xs text-slate-500">
                  Checking EC2 instance health telemetry...
                </div>
              ) : healthInstances.length === 0 ? (
                <div className="col-span-full py-6 text-center text-xs text-slate-500">
                  No EC2 instances available for health monitoring.
                </div>
              ) : (
                healthInstances.map((h) => (
                  <div key={h.instance_id} className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-xs text-white block">{h.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{h.instance_id}</span>
                      </div>
                      <StatusBadge status={h.health_state} />
                    </div>

                    <div className="grid grid-cols-3 gap-1 pt-2 border-t border-slate-800 text-[10px]">
                      <div>
                        <span className="text-slate-400 block">Status Check</span>
                        <span className={h.status_check_failed > 0 ? 'text-rose-400 font-bold' : 'text-emerald-400 font-semibold'}>
                          {h.status_check_failed > 0 ? 'FAILED' : 'PASSED'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">System</span>
                        <span className={h.status_check_system > 0 ? 'text-rose-400 font-bold' : 'text-emerald-400 font-semibold'}>
                          {h.status_check_system > 0 ? 'FAILED' : 'PASSED'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Instance</span>
                        <span className={h.status_check_instance > 0 ? 'text-rose-400 font-bold' : 'text-emerald-400 font-semibold'}>
                          {h.status_check_instance > 0 ? 'FAILED' : 'PASSED'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. S3 MONITORING SECTION */}
      {/* ========================================================================= */}
      {activeScope === 's3' && (
        <div className="space-y-6">
          {/* S3 Controls Bar */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <Database className="w-4 h-4 text-blue-400 shrink-0" />
              <span className="text-xs font-bold text-slate-200">Select Bucket:</span>
              <select
                value={selectedBucket}
                onChange={(e) => setSelectedBucket(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-white focus:ring-2 focus:ring-blue-500 focus:outline-none min-w-[220px]"
              >
                <option value="">All Buckets Summary</option>
                {s3Buckets.map((b) => (
                  <option key={b.name} value={b.name}>
                    {b.name} ({b.aws_account_name})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => {
                setS3WatchForm((prev) => ({ ...prev, bucket_name: selectedBucket || '' }));
                setIsS3WatchModalOpen(true);
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Storage Watch</span>
            </button>
          </div>

          {/* S3 Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {s3Metrics.map((m) => (
              <div key={m.bucket_name} className="bg-slate-900/90 border border-slate-800 rounded-lg p-4 space-y-3 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div>
                    <h3 className="text-xs font-bold text-white">{m.bucket_name}</h3>
                    <span className="text-[10px] text-slate-400 font-mono">{m.aws_account_name} ({m.aws_account_number})</span>
                  </div>
                  <Database className="w-4 h-4 text-blue-400" />
                </div>

                {m.has_data ? (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="bg-slate-950 p-3 rounded border border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-semibold">STORAGE SIZE</span>
                      <span className="text-lg font-bold text-white">{m.size_gb ?? '--'} GB</span>
                    </div>
                    <div className="bg-slate-950 p-3 rounded border border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-semibold">TOTAL OBJECTS</span>
                      <span className="text-lg font-bold text-blue-400">{m.object_count ?? '--'}</span>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 text-center text-xs text-slate-400 bg-slate-950/40 rounded border border-slate-800/40 font-mono">
                    No CloudWatch S3 metrics available for today.
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* S3 Storage Watches Table */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-blue-400" />
                <h2 className="text-sm font-bold text-slate-100">S3 Storage Watches</h2>
              </div>
              <span className="text-xs text-slate-400 font-mono">{s3Watches.length} Watches Active</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px]">
                    <th className="py-2.5 px-3">Bucket Name</th>
                    <th className="py-2.5 px-3">AWS Account</th>
                    <th className="py-2.5 px-3">Threshold (GB)</th>
                    <th className="py-2.5 px-3">Current State</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loadingS3Watches ? (
                    <tr>
                      <td colSpan="5" className="py-8 text-center text-slate-500">
                        Loading S3 Storage Watches...
                      </td>
                    </tr>
                  ) : s3Watches.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="py-8 text-center text-slate-500">
                        No S3 storage watches configured.
                      </td>
                    </tr>
                  ) : (
                    s3Watches.map((w) => (
                      <tr key={w.id} className="hover:bg-slate-800/50 transition-colors">
                        <td className="py-3 px-3 font-bold text-white">{w.bucket_name}</td>
                        <td className="py-3 px-3 text-slate-300">{w.aws_account_name}</td>
                        <td className="py-3 px-3 font-bold text-blue-400">{w.threshold_gb} GB</td>
                        <td className="py-3 px-3">
                          <StatusBadge status={w.last_state} />
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => setWatchToDelete(w)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                            title="Remove Storage Watch"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}

      {/* Create CPU Alarm Modal with Multi-Account Support */}
      {isAlarmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-400" />
                <span>Create EC2 CPU Alarm</span>
              </h3>
              <button onClick={() => setIsAlarmModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAlarmSubmit} className="space-y-4 text-xs">
              {/* Account Selector (Required when All Accounts is selected) */}
              {(selectedAccountId === 'all' || !selectedAccountId || awsAccounts.length > 1) && (
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Target AWS Account</label>
                  <select
                    required
                    value={alarmForm.account_id}
                    onChange={(e) => {
                      const newAccId = e.target.value;
                      setAlarmForm((prev) => ({ ...prev, account_id: newAccId, instance_id: '' }));
                      fetchModalInstances(newAccId);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  >
                    <option value="">Select Target AWS Account</option>
                    {awsAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.account_name} ({acc.account_id || acc.region || 'ap-south-1'})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Alarm Name</label>
                <input
                  type="text"
                  required
                  placeholder="High-CPU-Alert"
                  value={alarmForm.alarm_name}
                  onChange={(e) => setAlarmForm({ ...alarmForm, alarm_name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">EC2 Instance</label>
                {loadingModalInstances ? (
                  <div className="flex items-center gap-2 p-2 bg-slate-950 border border-slate-800 rounded text-slate-400 font-mono">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                    <span>Loading instances...</span>
                  </div>
                ) : (
                  <select
                    required
                    value={alarmForm.instance_id}
                    onChange={(e) => setAlarmForm({ ...alarmForm, instance_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  >
                    <option value="">Select EC2 Instance</option>
                    {(modalInstances.length > 0 ? modalInstances : instances).map((i) => {
                      const iId = i.id || i.instance_id;
                      const iName = i.name || i.instance_name || 'Unnamed Instance';
                      const iState = (i.state || i.status || 'RUNNING').toUpperCase();
                      return (
                        <option key={iId} value={iId}>
                          {iName} ({iId}) - {iState}
                        </option>
                      );
                    })}
                  </select>
                )}
                {modalInstances.length === 0 && !loadingModalInstances && (
                  <p className="text-[10px] text-amber-400 mt-1">
                    No EC2 instances found in this AWS account.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Condition</label>
                  <select
                    value={alarmForm.comparison_operator}
                    onChange={(e) => setAlarmForm({ ...alarmForm, comparison_operator: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  >
                    <option value="GreaterThanThreshold">CPU Utilization &gt;</option>
                    <option value="GreaterThanOrEqualToThreshold">CPU Utilization &ge;</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Threshold (%)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="100"
                    value={alarmForm.threshold}
                    onChange={(e) => setAlarmForm({ ...alarmForm, threshold: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Evaluation Period</label>
                <div className="p-2 bg-slate-950 border border-slate-800 rounded text-slate-300 font-mono flex items-center justify-between">
                  <span>5 minutes (300 seconds)</span>
                  <span className="text-[10px] text-slate-500">1 Period</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAlarmModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAlarm || !alarmForm.instance_id}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {submittingAlarm && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{submittingAlarm ? 'Creating...' : 'Create Alarm'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Alarm Confirmation Modal */}
      {alarmToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>Confirm Alarm Deletion</span>
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to delete CloudWatch alarm <strong className="text-white">{alarmToDelete.alarm_name}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setAlarmToDelete(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAlarm}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-bold cursor-pointer"
              >
                Delete Alarm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create S3 Storage Watch Modal */}
      {isS3WatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-400" />
                <span>Create S3 Storage Watch</span>
              </h3>
              <button onClick={() => setIsS3WatchModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateS3WatchSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Bucket Name</label>
                <select
                  required
                  value={s3WatchForm.bucket_name}
                  onChange={(e) => setS3WatchForm({ ...s3WatchForm, bucket_name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">Select Bucket</option>
                  {s3Buckets.map((b) => (
                    <option key={b.name} value={b.name}>
                      {b.name} ({b.aws_account_name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Threshold (GB)</label>
                <input
                  type="number"
                  required
                  min="0.1"
                  step="0.1"
                  value={s3WatchForm.threshold_gb}
                  onChange={(e) => setS3WatchForm({ ...s3WatchForm, threshold_gb: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsS3WatchModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingS3Watch}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold disabled:opacity-50 cursor-pointer"
                >
                  {submittingS3Watch ? 'Creating...' : 'Create Watch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete S3 Watch Confirmation Modal */}
      {watchToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>Confirm Storage Watch Removal</span>
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Remove storage watch for bucket <strong className="text-white">{watchToDelete.bucket_name}</strong>?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setWatchToDelete(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteS3Watch}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-bold cursor-pointer"
              >
                Remove Watch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CloudWatchPage;
