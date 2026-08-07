import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { StatsCards } from '../../components/cards/StatsCards';
import { useToast } from '../../context/ToastContext';
import api from '../../services/api';
import {
  Activity,
  ShieldAlert,
  Terminal,
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
  ArrowLeft,
  Server,
  Database,
  HardDrive,
  Cpu,
  BarChart3,
  Maximize2
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Brush
} from 'recharts';

export const CloudWatchPage = () => {
  const { showToast } = useToast();

  // Tab State: 'dashboard' | 'metrics' | 'log-groups' | 'log-events' | 'alarms'
  const [activeTab, setActiveTab] = useState('dashboard');

  // Summary Dashboard State
  const [dashStats, setDashStats] = useState({
    total_alarms: 0,
    alarms_in_alarm: 0,
    alarms_in_ok: 0,
    alarms_insufficient_data: 0,
    total_log_groups: 0,
    total_metrics: 0,
    last_sync_time: 'Never'
  });
  const [loadingStats, setLoadingStats] = useState(true);

  // Auto Refresh State (30 seconds)
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [secondsRemaining, setSecondsRemaining] = useState(30);

  // Alarms State
  const [alarms, setAlarms] = useState([]);
  const [loadingAlarms, setLoadingAlarms] = useState(false);
  const [alarmFilter, setAlarmFilter] = useState('ALL'); // ALL, ALARM, OK, INSUFFICIENT_DATA
  const [alarmSearch, setAlarmSearch] = useState('');
  const [selectedAlarm, setSelectedAlarm] = useState(null);
  const [alarmHistory, setAlarmHistory] = useState([]);
  const [loadingAlarmDetails, setLoadingAlarmDetails] = useState(false);

  // Metrics State
  const [selectedService, setSelectedService] = useState('EC2'); // EC2, S3, EBS, Lambda
  const [selectedMetric, setSelectedMetric] = useState('CPUUtilization');
  const [timeRange, setTimeRange] = useState('1h'); // 1h, 6h, 24h, 7d
  const [ec2Instances, setEc2Instances] = useState([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState('');
  const [metricData, setMetricData] = useState([]);
  const [metricMeta, setMetricMeta] = useState({ unit: '', stat: 'Average' });
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  // Log Groups & Log Streams & Log Events State
  const [logGroups, setLogGroups] = useState([]);
  const [loadingLogGroups, setLoadingLogGroups] = useState(false);
  const [logGroupSearch, setLogGroupSearch] = useState('');
  const [logGroupPage, setLogGroupPage] = useState(1);
  const logGroupsPerPage = 8;

  const [selectedLogGroup, setSelectedLogGroup] = useState(null);
  const [logStreams, setLogStreams] = useState([]);
  const [loadingLogStreams, setLoadingLogStreams] = useState(false);
  const [logStreamSearch, setLogStreamSearch] = useState('');

  const [selectedLogStream, setSelectedLogStream] = useState(null);
  const [logEvents, setLogEvents] = useState([]);
  const [loadingLogEvents, setLoadingLogEvents] = useState(false);
  const [eventSearch, setEventSearch] = useState('');
  const [isLogStreaming, setIsLogStreaming] = useState(true);

  // Fetch Dashboard Stats
  const fetchDashboardStats = useCallback(async (silent = false) => {
    if (!silent) setLoadingStats(true);
    try {
      const res = await api.get('/cloudwatch/dashboard');
      if (res.data) {
        setDashStats(res.data);
      }
    } catch (err) {
      console.error('Error fetching CloudWatch stats:', err);
      if (!silent) showToast('Failed to sync CloudWatch dashboard metrics', 'error');
    } finally {
      if (!silent) setLoadingStats(false);
    }
  }, [showToast]);

  // Fetch Alarms
  const fetchAlarms = useCallback(async (silent = false) => {
    if (!silent) setLoadingAlarms(true);
    try {
      const params = alarmFilter !== 'ALL' ? { state: alarmFilter } : {};
      const res = await api.get('/cloudwatch/alarms', { params });
      if (res.data && res.data.alarms) {
        setAlarms(res.data.alarms);
      }
    } catch (err) {
      console.error('Error fetching CloudWatch alarms:', err);
      if (!silent) showToast('Failed to fetch CloudWatch alarms', 'error');
    } finally {
      if (!silent) setLoadingAlarms(false);
    }
  }, [alarmFilter, showToast]);

  // Fetch Alarm Details & History
  const fetchAlarmDetails = async (alarmName) => {
    setSelectedAlarm(null);
    setAlarmHistory([]);
    setLoadingAlarmDetails(true);
    try {
      const res = await api.get(`/cloudwatch/alarms/${encodeURIComponent(alarmName)}`);
      if (res.data && res.data.alarm) {
        setSelectedAlarm(res.data.alarm);
        setAlarmHistory(res.data.history || []);
      }
    } catch (err) {
      showToast('Failed to fetch alarm details', 'error');
    } finally {
      setLoadingAlarmDetails(false);
    }
  };

  // Fetch EC2 Instances list for dimension selector
  const fetchEc2Instances = useCallback(async () => {
    try {
      const res = await api.get('/cloudwatch/ec2-instances');
      if (res.data && res.data.instances) {
        setEc2Instances(res.data.instances);
      }
    } catch (err) {
      console.error('Failed to fetch EC2 instances for metrics', err);
    }
  }, []);

  // Fetch Metric Statistics
  const fetchMetricStats = useCallback(async (silent = false) => {
    if (!silent) setLoadingMetrics(true);
    try {
      let namespace = 'AWS/EC2';
      let dimensionName = null;
      let dimensionValue = null;

      if (selectedService === 'EC2') {
        namespace = 'AWS/EC2';
        if (selectedInstanceId) {
          dimensionName = 'InstanceId';
          dimensionValue = selectedInstanceId;
        }
      } else if (selectedService === 'S3') {
        namespace = 'AWS/S3';
      } else if (selectedService === 'EBS') {
        namespace = 'AWS/EBS';
      } else if (selectedService === 'Lambda') {
        namespace = 'AWS/Lambda';
      }

      const params = {
        namespace,
        metric_name: selectedMetric,
        time_range: timeRange,
        stat: selectedMetric === 'StatusCheckFailed' ? 'Maximum' : 'Average'
      };

      if (dimensionName && dimensionValue) {
        params.dimension_name = dimensionName;
        params.dimension_value = dimensionValue;
      }

      const res = await api.get('/cloudwatch/metrics/stats', { params });
      if (res.data) {
        setMetricData(res.data.datapoints || []);
        setMetricMeta({
          unit: res.data.unit || '',
          stat: res.data.stat || 'Average'
        });
      }
    } catch (err) {
      console.error('Error fetching CloudWatch metric stats:', err);
      if (!silent) showToast('Failed to fetch metric statistics', 'error');
    } finally {
      if (!silent) setLoadingMetrics(false);
    }
  }, [selectedService, selectedMetric, timeRange, selectedInstanceId, showToast]);

  // Fetch Log Groups
  const fetchLogGroups = useCallback(async (silent = false) => {
    if (!silent) setLoadingLogGroups(true);
    try {
      const res = await api.get('/cloudwatch/log-groups');
      if (res.data && res.data.log_groups) {
        setLogGroups(res.data.log_groups);
      }
    } catch (err) {
      console.error('Error fetching log groups:', err);
      if (!silent) showToast('Failed to fetch CloudWatch log groups', 'error');
    } finally {
      if (!silent) setLoadingLogGroups(false);
    }
  }, [showToast]);

  // Fetch Log Streams for a group
  const fetchLogStreams = useCallback(async (groupName, silent = false) => {
    if (!silent) setLoadingLogStreams(true);
    try {
      const res = await api.get('/cloudwatch/log-streams', {
        params: { log_group_name: groupName }
      });
      if (res.data && res.data.log_streams) {
        setLogStreams(res.data.log_streams);
      }
    } catch (err) {
      console.error('Error fetching log streams:', err);
      if (!silent) showToast('Failed to fetch log streams', 'error');
    } finally {
      if (!silent) setLoadingLogStreams(false);
    }
  }, [showToast]);

  // Fetch Log Events for a stream
  const fetchLogEvents = useCallback(async (groupName, streamName, silent = false) => {
    if (!silent) setLoadingLogEvents(true);
    try {
      const res = await api.get('/cloudwatch/log-events', {
        params: {
          log_group_name: groupName,
          log_stream_name: streamName,
          limit: 150
        }
      });
      if (res.data && res.data.events) {
        setLogEvents(res.data.events);
      }
    } catch (err) {
      console.error('Error fetching log events:', err);
      if (!silent) showToast('Failed to fetch log events', 'error');
    } finally {
      if (!silent) setLoadingLogEvents(false);
    }
  }, [showToast]);

  // Master refresh function
  const refreshAllData = useCallback(async (silent = false) => {
    setSecondsRemaining(30);
    await fetchDashboardStats(silent);
    if (activeTab === 'dashboard' || activeTab === 'alarms') {
      await fetchAlarms(silent);
    }
    if (activeTab === 'metrics') {
      await fetchMetricStats(silent);
    }
    if (activeTab === 'log-groups') {
      await fetchLogGroups(silent);
    }
    if (selectedLogGroup && selectedLogStream) {
      await fetchLogEvents(selectedLogGroup.log_group_name, selectedLogStream.log_stream_name, silent);
    } else if (selectedLogGroup) {
      await fetchLogStreams(selectedLogGroup.log_group_name, silent);
    }
    if (!silent) showToast('CloudWatch data refreshed from AWS', 'success');
  }, [fetchDashboardStats, activeTab, fetchAlarms, fetchMetricStats, fetchLogGroups, selectedLogGroup, selectedLogStream, fetchLogEvents, fetchLogStreams, showToast]);

  // Handle AWS Account Switch event from window
  useEffect(() => {
    const handleAccountChange = () => {
      showToast('AWS Account switched. Syncing CloudWatch data...', 'info');
      refreshAllData(false);
    };

    window.addEventListener('aws-account-changed', handleAccountChange);
    return () => {
      window.removeEventListener('aws-account-changed', handleAccountChange);
    };
  }, [refreshAllData, showToast]);

  // Initial load
  useEffect(() => {
    fetchDashboardStats();
    fetchAlarms();
    fetchEc2Instances();
  }, [fetchDashboardStats, fetchAlarms, fetchEc2Instances]);

  // Tab change handlers
  useEffect(() => {
    if (activeTab === 'alarms' || activeTab === 'dashboard') {
      fetchAlarms();
    } else if (activeTab === 'metrics') {
      fetchMetricStats();
    } else if (activeTab === 'log-groups') {
      fetchLogGroups();
    }
  }, [activeTab, fetchAlarms, fetchMetricStats, fetchLogGroups]);

  // Refetch metrics on selector change
  useEffect(() => {
    if (activeTab === 'metrics') {
      fetchMetricStats();
    }
  }, [selectedService, selectedMetric, timeRange, selectedInstanceId, activeTab, fetchMetricStats]);

  // 30-Second Auto Refresh Timer
  useEffect(() => {
    if (!autoRefresh) return;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          refreshAllData(true);
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [autoRefresh, refreshAllData]);

  // Service metric mappings for EC2, S3, EBS, Lambda
  const serviceMetrics = {
    EC2: [
      { id: 'CPUUtilization', label: 'CPU Utilization (%)', stat: 'Average' },
      { id: 'NetworkIn', label: 'Network In (Bytes)', stat: 'Sum' },
      { id: 'NetworkOut', label: 'Network Out (Bytes)', stat: 'Sum' },
      { id: 'DiskReadBytes', label: 'Disk Read Bytes', stat: 'Sum' },
      { id: 'DiskWriteBytes', label: 'Disk Write Bytes', stat: 'Sum' },
      { id: 'StatusCheckFailed', label: 'Status Check Failed (Count)', stat: 'Maximum' }
    ],
    S3: [
      { id: 'BucketSizeBytes', label: 'Bucket Size (Bytes)', stat: 'Average' },
      { id: 'NumberOfObjects', label: 'Number Of Objects', stat: 'Average' }
    ],
    EBS: [
      { id: 'VolumeReadBytes', label: 'Volume Read Bytes', stat: 'Sum' },
      { id: 'VolumeWriteBytes', label: 'Volume Write Bytes', stat: 'Sum' },
      { id: 'VolumeQueueLength', label: 'Volume Queue Length', stat: 'Average' }
    ],
    Lambda: [
      { id: 'Invocations', label: 'Invocations', stat: 'Sum' },
      { id: 'Errors', label: 'Errors', stat: 'Sum' },
      { id: 'Duration', label: 'Duration (ms)', stat: 'Average' }
    ]
  };

  // Stats Card Items
  const stats = [
    {
      title: 'Total Alarms',
      value: String(dashStats.total_alarms),
      change: `${dashStats.alarms_in_alarm} ALARM / ${dashStats.alarms_in_ok} OK`,
      changeType: dashStats.alarms_in_alarm > 0 ? 'decrease' : 'increase',
      icon: ShieldAlert,
      subtitle: `AWS Account Synced: ${dashStats.last_sync_time}`
    },
    {
      title: 'Alarms in ALARM',
      value: String(dashStats.alarms_in_alarm),
      change: dashStats.alarms_in_alarm > 0 ? 'Action Needed' : 'All Clear',
      changeType: dashStats.alarms_in_alarm > 0 ? 'decrease' : 'increase',
      icon: AlertTriangle,
      subtitle: `${dashStats.alarms_insufficient_data} Insufficient Data`
    },
    {
      title: 'Log Groups',
      value: String(dashStats.total_log_groups),
      change: 'CloudWatch Logs',
      changeType: 'increase',
      icon: Terminal,
      subtitle: 'Active Log Ingestion'
    },
    {
      title: 'Total Metrics',
      value: String(dashStats.total_metrics),
      change: 'Telemetry Active',
      changeType: 'increase',
      icon: Activity,
      subtitle: 'EC2, S3, EBS & Lambda'
    }
  ];

  // Filter Alarms by search & dropdown
  const filteredAlarms = alarms.filter((a) => {
    const matchesSearch =
      a.alarm_name.toLowerCase().includes(alarmSearch.toLowerCase()) ||
      a.namespace.toLowerCase().includes(alarmSearch.toLowerCase()) ||
      a.metric_name.toLowerCase().includes(alarmSearch.toLowerCase()) ||
      (a.description && a.description.toLowerCase().includes(alarmSearch.toLowerCase()));
    
    if (alarmFilter === 'ALL') return matchesSearch;
    return matchesSearch && a.state_value === alarmFilter;
  });

  // Filter Log Groups
  const filteredLogGroups = logGroups.filter((g) =>
    g.log_group_name.toLowerCase().includes(logGroupSearch.toLowerCase())
  );
  const totalLogGroupPages = Math.ceil(filteredLogGroups.length / logGroupsPerPage) || 1;
  const paginatedLogGroups = filteredLogGroups.slice(
    (logGroupPage - 1) * logGroupsPerPage,
    logGroupPage * logGroupsPerPage
  );

  // Filter Log Streams
  const filteredLogStreams = logStreams.filter((s) =>
    s.log_stream_name.toLowerCase().includes(logStreamSearch.toLowerCase())
  );

  // Filter Log Events
  const filteredLogEvents = logEvents.filter((e) =>
    e.message.toLowerCase().includes(eventSearch.toLowerCase()) ||
    e.level.toLowerCase().includes(eventSearch.toLowerCase())
  );

  // Helper formatting for bytes
  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Top Header with Sync Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <PageHeader
          title="CloudWatch Observability"
          description="Real-time log tailing, EC2/S3/EBS metrics telemetry, CloudWatch alarm triggers, and multi-account state tracking."
          arn="arn:aws:cloudwatch:*:*:*"
        />

        {/* Sync Controls */}
        <div className="flex items-center gap-3 self-start md:self-auto font-mono-tabular text-xs">
          <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-300">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${autoRefresh ? 'bg-emerald-400' : 'bg-amber-400'} opacity-75`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${autoRefresh ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
            </span>
            <span className="text-[11px] text-slate-400">
              {autoRefresh ? `Auto Sync (${secondsRemaining}s)` : 'Auto Sync Paused'}
            </span>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className="p-1 hover:text-white text-slate-400 transition-colors"
              title={autoRefresh ? 'Pause Auto Refresh' : 'Resume Auto Refresh'}
            >
              {autoRefresh ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 text-emerald-400" />}
            </button>
          </div>

          <button
            onClick={() => refreshAllData(false)}
            disabled={loadingStats || loadingAlarms || loadingMetrics}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-lg font-bold shadow-md shadow-blue-500/20 transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${(loadingStats || loadingAlarms || loadingMetrics) ? 'animate-spin' : ''}`} />
            <span>Manual Refresh</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <StatsCards items={stats} />

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 font-mono-tabular overflow-x-auto">
        <button
          onClick={() => {
            setActiveTab('dashboard');
            setSelectedLogGroup(null);
            setSelectedLogStream(null);
          }}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'dashboard'
              ? 'border-blue-500 text-blue-400 bg-blue-500/10'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>Alarms & Status ({dashStats.total_alarms})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('metrics');
            setSelectedLogGroup(null);
            setSelectedLogStream(null);
          }}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'metrics'
              ? 'border-blue-500 text-blue-400 bg-blue-500/10'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Metrics Telemetry</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('log-groups');
          }}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'log-groups' || selectedLogGroup
              ? 'border-blue-500 text-blue-400 bg-blue-500/10'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
          }`}
        >
          <Terminal className="w-4 h-4" />
          <span>Log Groups & Events ({dashStats.total_log_groups})</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: ALARMS & DASHBOARD STATUS */}
      {/* ========================================================================= */}
      {activeTab === 'dashboard' && (
        <div className="space-y-4 font-mono-tabular">
          {/* Filter Bar */}
          <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto flex-1">
              <Search className="w-4 h-4 text-slate-500 shrink-0" />
              <input
                type="text"
                placeholder="Search alarms by name, metric, or description..."
                value={alarmSearch}
                onChange={(e) => setAlarmSearch(e.target.value)}
                className="w-full max-w-md px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-md text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-xs text-slate-400">State:</span>
              <div className="flex items-center bg-slate-900 border border-slate-800 rounded-md p-0.5 text-xs text-slate-300">
                {['ALL', 'ALARM', 'OK', 'INSUFFICIENT_DATA'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setAlarmFilter(st)}
                    className={`px-2.5 py-1 rounded transition-colors text-[11px] font-bold cursor-pointer ${
                      alarmFilter === st
                        ? 'bg-blue-600 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {st === 'INSUFFICIENT_DATA' ? 'INSUFFICIENT' : st}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Alarms Table */}
          <div className="bg-[#111827] border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900/90 text-slate-400 uppercase text-[10px] font-bold tracking-wider border-b border-slate-800 select-none">
                    <th className="py-3 px-4">Alarm Name</th>
                    <th className="py-3 px-4">Namespace</th>
                    <th className="py-3 px-4">Metric</th>
                    <th className="py-3 px-4">Threshold</th>
                    <th className="py-3 px-4">Current State</th>
                    <th className="py-3 px-4">Last Updated</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {loadingAlarms ? (
                    Array.from({ length: 4 }).map((_, idx) => (
                      <tr key={idx} className="animate-pulse">
                        <td className="py-4 px-4"><div className="h-3 bg-slate-800 rounded w-36"></div></td>
                        <td className="py-4 px-4"><div className="h-3 bg-slate-800 rounded w-24"></div></td>
                        <td className="py-4 px-4"><div className="h-3 bg-slate-800 rounded w-28"></div></td>
                        <td className="py-4 px-4"><div className="h-3 bg-slate-800 rounded w-20"></div></td>
                        <td className="py-4 px-4"><div className="h-3 bg-slate-800 rounded w-16"></div></td>
                        <td className="py-4 px-4"><div className="h-3 bg-slate-800 rounded w-32"></div></td>
                        <td className="py-4 px-4 text-right"><div className="h-3 bg-slate-800 rounded w-12 ml-auto"></div></td>
                      </tr>
                    ))
                  ) : filteredAlarms.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center gap-2">
                          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                          <p className="font-bold text-slate-300 text-sm">No CloudWatch Alarms Found</p>
                          <p className="text-xs text-slate-500">
                            {alarmSearch || alarmFilter !== 'ALL'
                              ? 'No alarms match your search/filter criteria.'
                              : 'No CloudWatch Metric Alarms are currently configured in this AWS account.'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredAlarms.map((a) => (
                      <tr
                        key={a.alarm_name}
                        onClick={() => fetchAlarmDetails(a.alarm_name)}
                        className="hover:bg-slate-900/80 transition-colors cursor-pointer group"
                      >
                        <td className="py-3 px-4 font-bold text-white group-hover:text-blue-400 transition-colors">
                          <div className="flex items-center gap-2">
                            {a.state_value === 'ALARM' ? (
                              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                            ) : a.state_value === 'OK' ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            ) : (
                              <Info className="w-4 h-4 text-amber-400 shrink-0" />
                            )}
                            <span className="truncate max-w-[220px]">{a.alarm_name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">{a.namespace}</td>
                        <td className="py-3 px-4 text-slate-300 font-semibold">{a.metric_name}</td>
                        <td className="py-3 px-4 text-slate-400">
                          {a.comparison_operator?.replace('GreaterThanOrEqualToThreshold', '>= ')
                            .replace('GreaterThanThreshold', '> ')
                            .replace('LessThanOrEqualToThreshold', '<= ')
                            .replace('LessThanThreshold', '< ')}
                          {a.threshold} {a.unit !== 'N/A' ? a.unit : ''}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border inline-flex items-center gap-1 ${
                              a.state_value === 'ALARM'
                                ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                                : a.state_value === 'OK'
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                            }`}
                          >
                            {a.state_value}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-[11px] font-mono">{a.last_updated}</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              fetchAlarmDetails(a.alarm_name);
                            }}
                            className="px-2.5 py-1 bg-slate-900 border border-slate-800 hover:border-blue-500/50 hover:bg-blue-600/10 text-blue-400 rounded text-[11px] font-bold transition-all"
                          >
                            Details
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
      {/* TAB 2: METRICS TELEMETRY WITH RECHARTS (EC2, S3, EBS, LAMBDA) */}
      {/* ========================================================================= */}
      {activeTab === 'metrics' && (
        <div className="space-y-4 font-mono-tabular">
          {/* Controls Bar */}
          <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Service & Metric Picker */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Service Buttons */}
              <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1 text-xs">
                {[
                  { id: 'EC2', label: 'EC2', icon: Server },
                  { id: 'S3', label: 'S3', icon: Database },
                  { id: 'EBS', label: 'EBS', icon: HardDrive },
                  { id: 'Lambda', label: 'Lambda', icon: Cpu }
                ].map((s) => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSelectedService(s.id);
                        setSelectedMetric(serviceMetrics[s.id][0].id);
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-bold transition-colors cursor-pointer ${
                        selectedService === s.id
                          ? 'bg-blue-600 text-white shadow'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{s.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Metric Dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-semibold">Metric:</span>
                <select
                  value={selectedMetric}
                  onChange={(e) => setSelectedMetric(e.target.value)}
                  className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white font-bold focus:outline-none focus:border-blue-500"
                >
                  {serviceMetrics[selectedService]?.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* EC2 Instance Selector (if EC2) */}
              {selectedService === 'EC2' && ec2Instances.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-semibold">Instance:</span>
                  <select
                    value={selectedInstanceId}
                    onChange={(e) => setSelectedInstanceId(e.target.value)}
                    className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-blue-400 font-bold focus:outline-none focus:border-blue-500 max-w-[200px] truncate"
                  >
                    <option value="">All EC2 Instances</option>
                    {ec2Instances.map((inst) => (
                      <option key={inst.instance_id} value={inst.instance_id}>
                        {inst.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Time Range Selector */}
            <div className="flex items-center gap-1.5 self-start md:self-auto">
              <span className="text-xs text-slate-400 font-semibold mr-1">Time Range:</span>
              <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs text-slate-300">
                {[
                  { id: '1h', label: '1 Hour' },
                  { id: '6h', label: '6 Hours' },
                  { id: '24h', label: '24 Hours' },
                  { id: '7d', label: '7 Days' }
                ].map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setTimeRange(r.id)}
                    className={`px-3 py-1 rounded transition-colors font-bold text-xs cursor-pointer ${
                      timeRange === r.id
                        ? 'bg-blue-600 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Metric Telemetry Chart Panel */}
          <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-400" />
                  <span>
                    AWS/{selectedService} - {selectedMetric} ({timeRange.toUpperCase()})
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Live CloudWatch Telemetry Data • Stat: {metricMeta.stat} • Unit: {metricMeta.unit || 'Count'}
                </p>
              </div>

              {loadingMetrics && (
                <div className="flex items-center gap-2 text-xs text-blue-400">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Fetching AWS Telemetry...</span>
                </div>
              )}
            </div>

            {/* Recharts Area Chart with Zoom Brush */}
            <div className="h-80 w-full pt-2">
              {loadingMetrics ? (
                <div className="h-full w-full flex items-center justify-center bg-slate-900/40 rounded-lg border border-slate-800/80">
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
                    <span className="text-xs">Querying AWS CloudWatch API...</span>
                  </div>
                </div>
              ) : metricData.length === 0 ? (
                <div className="h-full w-full flex flex-col items-center justify-center bg-slate-900/40 rounded-lg border border-slate-800/80 p-6 text-center">
                  <BarChart3 className="w-10 h-10 text-slate-600 mb-2" />
                  <p className="text-sm font-bold text-slate-300">No Datapoints Returned from CloudWatch</p>
                  <p className="text-xs text-slate-500 max-w-md mt-1">
                    AWS CloudWatch has not collected datapoints for {selectedMetric} in the last {timeRange} window. Try expanding the time range to 24h or 7d.
                  </p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={metricData} margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
                    <defs>
                      <linearGradient id="cloudWatchGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis
                      dataKey="label"
                      stroke="#64748b"
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="#64748b"
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      tickLine={false}
                      axisLine={false}
                      unit={` ${metricMeta.unit === 'Percent' ? '%' : ''}`}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const val = payload[0].value;
                          return (
                            <div className="bg-slate-900 border border-slate-700/80 p-3 rounded-lg shadow-2xl text-xs font-mono-tabular">
                              <p className="text-slate-400 font-semibold mb-1 border-b border-slate-800 pb-1">{label}</p>
                              <div className="flex items-center justify-between gap-4 py-0.5">
                                <span className="text-blue-400 font-medium">{selectedMetric}:</span>
                                <span className="text-white font-bold">
                                  {val} {metricMeta.unit}
                                </span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#3b82f6"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#cloudWatchGrad)"
                    />
                    {/* Interactive Zoom Brush Slider */}
                    <Brush
                      dataKey="label"
                      height={24}
                      stroke="#3b82f6"
                      fill="#0f172a"
                      tickFormatter={() => ''}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: LOG GROUPS, LOG STREAMS & LOG EVENTS VIEWER */}
      {/* ========================================================================= */}
      {(activeTab === 'log-groups' || selectedLogGroup) && (
        <div className="space-y-4 font-mono-tabular">
          {/* Breadcrumb Navigation when drilled into stream/group */}
          {selectedLogGroup && (
            <div className="flex items-center gap-2 bg-[#111827] border border-slate-800 rounded-lg px-4 py-2 text-xs">
              <button
                onClick={() => {
                  setSelectedLogGroup(null);
                  setSelectedLogStream(null);
                  fetchLogGroups();
                }}
                className="text-blue-400 hover:underline flex items-center gap-1 font-bold"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Log Groups</span>
              </button>
              <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
              <span className="text-slate-200 font-bold">{selectedLogGroup.log_group_name}</span>
              {selectedLogStream && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                  <span className="text-blue-400 font-bold">{selectedLogStream.log_stream_name}</span>
                </>
              )}
            </div>
          )}

          {/* VIEW 1: LOG GROUPS TABLE */}
          {!selectedLogGroup && (
            <div className="space-y-4">
              <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2 w-full sm:w-auto flex-1">
                  <Search className="w-4 h-4 text-slate-500 shrink-0" />
                  <input
                    type="text"
                    placeholder="Search CloudWatch log groups..."
                    value={logGroupSearch}
                    onChange={(e) => {
                      setLogGroupSearch(e.target.value);
                      setLogGroupPage(1);
                    }}
                    className="w-full max-w-md px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-md text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>Total Log Groups: {logGroups.length}</span>
                </div>
              </div>

              <div className="bg-[#111827] border border-slate-800 rounded-xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-900/90 text-slate-400 uppercase text-[10px] font-bold tracking-wider border-b border-slate-800 select-none">
                        <th className="py-3 px-4">Log Group Name</th>
                        <th className="py-3 px-4">Stored Size</th>
                        <th className="py-3 px-4">Retention</th>
                        <th className="py-3 px-4">Creation Time</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-200">
                      {loadingLogGroups ? (
                        Array.from({ length: 4 }).map((_, idx) => (
                          <tr key={idx} className="animate-pulse">
                            <td className="py-4 px-4"><div className="h-3 bg-slate-800 rounded w-48"></div></td>
                            <td className="py-4 px-4"><div className="h-3 bg-slate-800 rounded w-16"></div></td>
                            <td className="py-4 px-4"><div className="h-3 bg-slate-800 rounded w-20"></div></td>
                            <td className="py-4 px-4"><div className="h-3 bg-slate-800 rounded w-32"></div></td>
                            <td className="py-4 px-4 text-right"><div className="h-3 bg-slate-800 rounded w-16 ml-auto"></div></td>
                          </tr>
                        ))
                      ) : paginatedLogGroups.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-slate-400">
                            <div className="flex flex-col items-center gap-2">
                              <Terminal className="w-8 h-8 text-slate-600" />
                              <p className="font-bold text-slate-300 text-sm">No Log Groups Found</p>
                              <p className="text-xs text-slate-500">
                                {logGroupSearch ? 'No log groups match your search.' : 'No CloudWatch Log Groups available in this AWS account.'}
                              </p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        paginatedLogGroups.map((g) => (
                          <tr
                            key={g.log_group_name}
                            onClick={() => {
                              setSelectedLogGroup(g);
                              fetchLogStreams(g.log_group_name);
                            }}
                            className="hover:bg-slate-900/80 transition-colors cursor-pointer group"
                          >
                            <td className="py-3 px-4 font-bold text-white group-hover:text-blue-400 transition-colors">
                              <div className="flex items-center gap-2">
                                <Terminal className="w-4 h-4 text-blue-400 shrink-0" />
                                <span className="truncate max-w-[280px]">{g.log_group_name}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-300">{formatBytes(g.stored_bytes)}</td>
                            <td className="py-3 px-4 text-slate-400">
                              {g.retention_in_days === 'Never Expire' ? 'Never expire' : `${g.retention_in_days} days`}
                            </td>
                            <td className="py-3 px-4 text-slate-400 text-[11px] font-mono">{g.creation_time}</td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedLogGroup(g);
                                  fetchLogStreams(g.log_group_name);
                                }}
                                className="px-3 py-1 bg-blue-600/20 hover:bg-blue-600 border border-blue-500/30 text-blue-400 hover:text-white rounded text-[11px] font-bold transition-all"
                              >
                                View Streams
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Footer */}
                {totalLogGroupPages > 1 && (
                  <div className="p-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                    <span>Page {logGroupPage} of {totalLogGroupPages}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setLogGroupPage((p) => Math.max(1, p - 1))}
                        disabled={logGroupPage === 1}
                        className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded disabled:opacity-50 hover:bg-slate-800 text-slate-200 cursor-pointer"
                      >
                        Prev
                      </button>
                      <button
                        onClick={() => setLogGroupPage((p) => Math.min(totalLogGroupPages, p + 1))}
                        disabled={logGroupPage === totalLogGroupPages}
                        className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded disabled:opacity-50 hover:bg-slate-800 text-slate-200 cursor-pointer"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIEW 2: LOG STREAMS TABLE */}
          {selectedLogGroup && !selectedLogStream && (
            <div className="space-y-4">
              <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2 w-full sm:w-auto flex-1">
                  <Search className="w-4 h-4 text-slate-500 shrink-0" />
                  <input
                    type="text"
                    placeholder="Search log streams in this group..."
                    value={logStreamSearch}
                    onChange={(e) => setLogStreamSearch(e.target.value)}
                    className="w-full max-w-md px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-md text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>Log Streams ({filteredLogStreams.length})</span>
                </div>
              </div>

              <div className="bg-[#111827] border border-slate-800 rounded-xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-900/90 text-slate-400 uppercase text-[10px] font-bold tracking-wider border-b border-slate-800 select-none">
                        <th className="py-3 px-4">Log Stream Name</th>
                        <th className="py-3 px-4">Last Event Time</th>
                        <th className="py-3 px-4">Stored Bytes</th>
                        <th className="py-3 px-4">Creation Time</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-200">
                      {loadingLogStreams ? (
                        Array.from({ length: 4 }).map((_, idx) => (
                          <tr key={idx} className="animate-pulse">
                            <td className="py-4 px-4"><div className="h-3 bg-slate-800 rounded w-48"></div></td>
                            <td className="py-4 px-4"><div className="h-3 bg-slate-800 rounded w-32"></div></td>
                            <td className="py-4 px-4"><div className="h-3 bg-slate-800 rounded w-16"></div></td>
                            <td className="py-4 px-4"><div className="h-3 bg-slate-800 rounded w-32"></div></td>
                            <td className="py-4 px-4 text-right"><div className="h-3 bg-slate-800 rounded w-16 ml-auto"></div></td>
                          </tr>
                        ))
                      ) : filteredLogStreams.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-slate-400">
                            <div className="flex flex-col items-center gap-2">
                              <Terminal className="w-8 h-8 text-slate-600" />
                              <p className="font-bold text-slate-300 text-sm">No Log Streams Found</p>
                              <p className="text-xs text-slate-500">
                                No active streams in log group "{selectedLogGroup.log_group_name}".
                              </p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredLogStreams.map((s) => (
                          <tr
                            key={s.log_stream_name}
                            onClick={() => {
                              setSelectedLogStream(s);
                              fetchLogEvents(selectedLogGroup.log_group_name, s.log_stream_name);
                            }}
                            className="hover:bg-slate-900/80 transition-colors cursor-pointer group"
                          >
                            <td className="py-3 px-4 font-bold text-white group-hover:text-blue-400 transition-colors">
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                                <span className="truncate max-w-[280px]">{s.log_stream_name}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-slate-300 font-mono text-[11px]">{s.last_event_timestamp}</td>
                            <td className="py-3 px-4 font-mono text-slate-400">{formatBytes(s.stored_bytes)}</td>
                            <td className="py-3 px-4 text-slate-400 text-[11px] font-mono">{s.creation_time}</td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedLogStream(s);
                                  fetchLogEvents(selectedLogGroup.log_group_name, s.log_stream_name);
                                }}
                                className="px-3 py-1 bg-blue-600/20 hover:bg-blue-600 border border-blue-500/30 text-blue-400 hover:text-white rounded text-[11px] font-bold transition-all"
                              >
                                View Events
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

          {/* VIEW 3: LOG EVENTS TAILING VIEWER (NEWEST FIRST) */}
          {selectedLogGroup && selectedLogStream && (
            <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 space-y-3 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2 flex-1">
                  <Search className="w-4 h-4 text-slate-500 shrink-0" />
                  <input
                    type="text"
                    placeholder="Search events by message or level (ERROR, WARN, INFO)..."
                    value={eventSearch}
                    onChange={(e) => setEventSearch(e.target.value)}
                    className="w-full max-w-md px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-md text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <button
                    onClick={() => setIsLogStreaming(!isLogStreaming)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-300 hover:bg-slate-800 cursor-pointer font-bold"
                  >
                    {isLogStreaming ? <Pause className="w-3.5 h-3.5 text-emerald-400" /> : <Play className="w-3.5 h-3.5 text-slate-400" />}
                    <span>{isLogStreaming ? 'Auto Stream (Live)' : 'Stream Paused'}</span>
                  </button>

                  <button
                    onClick={() => fetchLogEvents(selectedLogGroup.log_group_name, selectedLogStream.log_stream_name)}
                    className="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-lg text-slate-300 font-bold cursor-pointer"
                  >
                    Refresh Events
                  </button>
                </div>
              </div>

              {/* Terminal Logs Container */}
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 h-[450px] overflow-y-auto space-y-1.5 text-xs font-mono selection:bg-blue-500/30">
                {loadingLogEvents ? (
                  <div className="h-full flex items-center justify-center text-slate-500 gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
                    <span>Fetching log events from AWS CloudWatch...</span>
                  </div>
                ) : filteredLogEvents.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2">
                    <Terminal className="w-8 h-8 text-slate-700" />
                    <span>No log events found for stream "{selectedLogStream.log_stream_name}"</span>
                  </div>
                ) : (
                  filteredLogEvents.map((ev, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 hover:bg-slate-900/90 p-1.5 rounded transition-colors font-mono border-b border-slate-900/50"
                    >
                      <span className="text-slate-500 shrink-0 font-bold">{ev.timestamp}</span>
                      <span
                        className={`px-1.5 py-0.2 text-[10px] font-bold rounded shrink-0 ${
                          ev.level === 'ERROR'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : ev.level === 'WARN'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        }`}
                      >
                        {ev.level}
                      </span>
                      <span className="text-slate-200 break-all select-text">{ev.message}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* ALARM DETAILS MODAL */}
      {/* ========================================================================= */}
      {(selectedAlarm || loadingAlarmDetails) && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-slate-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl font-mono-tabular space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-bold text-white">
                  {loadingAlarmDetails ? 'Loading Alarm Spec...' : selectedAlarm?.alarm_name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedAlarm(null)}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingAlarmDetails ? (
              <div className="py-12 text-center text-slate-400 flex flex-col items-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
                <span>Reading alarm specification from AWS...</span>
              </div>
            ) : selectedAlarm ? (
              <div className="space-y-6 text-xs">
                {/* Status Header */}
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <span className="text-slate-400 text-[11px] block uppercase font-bold">State Value</span>
                    <span
                      className={`text-sm font-bold mt-1 inline-flex items-center gap-1.5 ${
                        selectedAlarm.state_value === 'ALARM'
                          ? 'text-rose-400'
                          : selectedAlarm.state_value === 'OK'
                          ? 'text-emerald-400'
                          : 'text-amber-400'
                      }`}
                    >
                      {selectedAlarm.state_value}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-slate-400 text-[11px] block uppercase font-bold">Last Updated</span>
                    <span className="text-slate-200 font-bold mt-1 block">{selectedAlarm.last_updated}</span>
                  </div>
                </div>

                {/* Alarm Reason */}
                {selectedAlarm.state_reason && (
                  <div className="bg-slate-900/60 border border-slate-800/80 rounded-lg p-3 text-slate-300">
                    <span className="text-slate-400 font-bold block mb-1">Reason for State Change:</span>
                    <p className="text-slate-200">{selectedAlarm.state_reason}</p>
                  </div>
                )}

                {/* Alarm Grid Spec */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-slate-900/50 border border-slate-800 p-3 rounded-lg space-y-1">
                    <span className="text-slate-400 text-[11px] uppercase font-bold">Metric Name</span>
                    <p className="text-white font-bold">{selectedAlarm.metric_name}</p>
                  </div>

                  <div className="bg-slate-900/50 border border-slate-800 p-3 rounded-lg space-y-1">
                    <span className="text-slate-400 text-[11px] uppercase font-bold">Namespace</span>
                    <p className="text-white font-bold">{selectedAlarm.namespace}</p>
                  </div>

                  <div className="bg-slate-900/50 border border-slate-800 p-3 rounded-lg space-y-1">
                    <span className="text-slate-400 text-[11px] uppercase font-bold">Threshold & Operator</span>
                    <p className="text-white font-bold">
                      {selectedAlarm.comparison_operator} {selectedAlarm.threshold}
                    </p>
                  </div>

                  <div className="bg-slate-900/50 border border-slate-800 p-3 rounded-lg space-y-1">
                    <span className="text-slate-400 text-[11px] uppercase font-bold">Evaluation Periods</span>
                    <p className="text-white font-bold">
                      {selectedAlarm.evaluation_periods} period(s) of {selectedAlarm.period}s
                    </p>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <span className="text-slate-400 font-bold block mb-1">Description</span>
                  <p className="bg-slate-900 p-3 rounded border border-slate-800 text-slate-300">
                    {selectedAlarm.description || 'No description provided.'}
                  </p>
                </div>

                {/* State History Timeline */}
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2">State Change History</h4>
                  <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                    {alarmHistory.length === 0 ? (
                      <p className="text-slate-500 text-center py-4">No state update history records found.</p>
                    ) : (
                      alarmHistory.map((h, idx) => (
                        <div key={idx} className="text-[11px] border-b border-slate-900 pb-2">
                          <span className="text-slate-500 font-bold block">{h.timestamp}</span>
                          <span className="text-slate-200">{h.history_summary}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="pt-2 border-t border-slate-800 text-right">
              <button
                onClick={() => setSelectedAlarm(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CloudWatchPage;
