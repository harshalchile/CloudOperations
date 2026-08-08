import React, { useState, useEffect } from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ConfirmationModal } from '../../components/ui/ConfirmationModal';
import { EC2LaunchWizard } from '../../components/ec2/EC2LaunchWizard';
import { EC2ConnectModal } from '../../components/ec2/EC2ConnectModal';
import { SSHTerminalModal } from '../../components/ec2/SSHTerminalModal';
import { EC2DetailModal } from '../../components/ec2/EC2DetailModal';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../services/api';
import {
  Server,
  Play,
  Square,
  RefreshCw,
  Trash2,
  Plus,
  Search,
  Loader2,
  AlertTriangle,
  Terminal,
  User,
  Eye,
  CheckSquare,
  Square as SquareOutline
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const EC2Page = () => {
  const {
    user,
    awsAccount,
    awsAccounts,
    loadingAccounts,
    hasConnectedAccount,
    selectedAccountId,
    setSelectedAccountId
  } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Selection State
  const [selectedIds, setSelectedIds] = useState([]);

  // Controls State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Wizard & Modal State
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [confirmTerminate, setConfirmTerminate] = useState({ isOpen: false, targetInstances: [] });

  // Windows RDP Connect Modal State
  const [connectInstance, setConnectInstance] = useState(null);

  // In-Browser Live SSH Terminal Modal State
  const [terminalInstance, setTerminalInstance] = useState(null);

  // EC2 Detail Modal State (With CloudWatch Telemetry)
  const [detailInstance, setDetailInstance] = useState(null);

  const getErrorMessage = (err, fallback = 'Operation failed.') => {
    if (!err) return fallback;
    const data = err.response?.data;
    if (data?.error?.message) return data.error.message;
    if (data?.aws_error_message) return data.aws_error_message;
    if (typeof data?.error === 'string') return data.error;
    if (data?.message) return data.message;
    return err.message || fallback;
  };

  const fetchInstances = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setErrorMsg('');

    try {
      const headers = {};
      if (selectedAccountId && selectedAccountId !== 'all') {
        headers['X-AWS-Account-ID'] = selectedAccountId;
      }
      const res = await api.get('/ec2', {
        params: { account_id: selectedAccountId },
        headers
      });
      if (res.data && res.data.instances) {
        setInstances(res.data.instances);
        if (isManualRefresh) showToast('EC2 instance list refreshed from AWS.');
      }
    } catch (err) {
      const msg = getErrorMessage(err, 'Failed to fetch EC2 instances.');
      setErrorMsg(msg);
      if (isManualRefresh) showToast(msg, 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchInstances();

    const handleAccountChange = () => fetchInstances(true);
    window.addEventListener('aws-account-changed', handleAccountChange);
    return () => window.removeEventListener('aws-account-changed', handleAccountChange);
  }, [selectedAccountId]);

  // Filtered List
  const filteredInstances = instances.filter((inst) => {
    const matchesSearch =
      (inst.name && inst.name.toLowerCase().includes(search.toLowerCase())) ||
      (inst.instance_id && inst.instance_id.toLowerCase().includes(search.toLowerCase())) ||
      (inst.public_ip && inst.public_ip.toLowerCase().includes(search.toLowerCase())) ||
      (inst.aws_account_name && inst.aws_account_name.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus =
      statusFilter === 'ALL'
        ? true
        : inst.status.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  // Checkbox Selection Handlers
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(filteredInstances.map((i) => i.instance_id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (instId) => {
    if (selectedIds.includes(instId)) {
      setSelectedIds(selectedIds.filter((id) => id !== instId));
    } else {
      setSelectedIds([...selectedIds, instId]);
    }
  };

  // EC2 Server Actions (Start, Stop, Reboot, Terminate)
  const handleAction = async (actionType, targetInst) => {
    const isArray = Array.isArray(targetInst);
    const targetIds = isArray ? targetInst.map((i) => i.instance_id) : [targetInst.instance_id];
    const targetName = isArray ? `${targetIds.length} instances` : targetInst.name || targetInst.instance_id;

    try {
      showToast(`Initiating ${actionType.toUpperCase()} on ${targetName}...`, 'info');

      let endpoint = `/ec2/${actionType}`;
      let payload = {
        account_id: selectedAccountId,
        instance_ids: targetIds,
        instance_id: targetIds[0]
      };

      const res = await api.post(endpoint, payload);
      if (res.data) {
        showToast(res.data.message || `Successfully executed ${actionType} on ${targetName}.`, 'success');
        setSelectedIds([]);
        fetchInstances(true);
      }
    } catch (err) {
      showToast(getErrorMessage(err, `Failed to execute ${actionType} on ${targetName}`), 'error');
    }
  };

  const openTerminateModal = (instOrList) => {
    const list = Array.isArray(instOrList) ? instOrList : [instOrList];
    setConfirmTerminate({ isOpen: true, targetInstances: list });
  };

  const handleConfirmTerminate = async () => {
    if (confirmTerminate.targetInstances.length === 0) return;
    await handleAction('terminate', confirmTerminate.targetInstances);
    setConfirmTerminate({ isOpen: false, targetInstances: [] });
  };

  const handleConnectClick = (inst, e) => {
    if (e) e.stopPropagation();
    if (inst.status.toLowerCase() !== 'running') {
      showToast(`Server "${inst.name}" is in '${inst.status}' state. Start the instance first to connect.`, 'warning');
      return;
    }
    setConnectInstance(inst);
  };

  const handleLaunchServer = async (config) => {
    console.log("[EC2 LAUNCH] Launch button clicked", config);
    setIsLaunching(true);
    try {
      const headers = {};
      const targetAccId = config.account_id || selectedAccountId;
      if (targetAccId && targetAccId !== 'all') {
        headers['X-AWS-Account-ID'] = targetAccId;
      }

      const res = await api.post('/ec2/create', {
        ...config,
        account_id: targetAccId
      }, { headers });

      if (res.status === 201 || res.status === 200 || res.data?.success) {
        const instId = res.data?.instance_id || res.data?.instance?.instance_id || 'i-new';
        const sName = config.name || config.server_name || 'EC2 Instance';
        const accObj = awsAccounts?.find(a => String(a.id) === String(targetAccId)) || awsAccount;
        const accName = accObj?.account_name || 'AWS Account';

        showToast(
          res.data?.message || `EC2 Instance Created. Server: ${sName} | Instance ID: ${instId} | Account: ${accName} | Region: ap-south-1 | Status: Pending`,
          'success'
        );

        setIsWizardOpen(false);
        await fetchInstances(true);
      }
    } catch (err) {
      console.error("[EC2 LAUNCH ERROR]", err);
      const awsCode = err.response?.data?.aws_error_code || err.response?.data?.code || err.response?.data?.error?.code || 'LaunchError';
      const awsMsg = err.response?.data?.aws_error_message || err.response?.data?.message || err.response?.data?.error?.message || err.message || 'Failed to launch EC2 server.';
      showToast(`EC2 Launch Failed: ${awsMsg} (Code: ${awsCode})`, 'error');
    } finally {
      setIsLaunching(false);
    }
  };

  const selectedObjects = instances.filter((i) => selectedIds.includes(i.instance_id));
  const hasRunningSelected = selectedObjects.some((i) => i.status.toLowerCase() === 'running');
  const hasStoppedSelected = selectedObjects.some((i) => i.status.toLowerCase() === 'stopped');

  return (
    <div className="font-mono-tabular space-y-6 select-none">
      <PageHeader
        title="EC2 Virtual Servers"
        description="Manage AWS EC2 instances across connected AWS accounts in ap-south-1 (Mumbai)."
        arn={awsAccount ? `arn:aws:ec2:${awsAccount.region || 'ap-south-1'}:${awsAccount.account_id || 'unconnected'}:instance/*` : 'arn:aws:ec2:ap-south-1:unconnected'}
        onRefresh={() => fetchInstances(true)}
        isRefreshing={refreshing}
        actions={
          <button
            onClick={() => setIsWizardOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Launch New Server</span>
          </button>
        }
      />

      {/* Account Connection State Handling */}
      {loadingAccounts ? (
        <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg text-slate-400 text-xs flex items-center gap-2 font-mono">
          <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
          <span>Loading AWS accounts...</span>
        </div>
      ) : !hasConnectedAccount && instances.length === 0 ? (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300 text-xs flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>No AWS Account connected yet. Connect your AWS credentials to view and launch EC2 instances.</span>
          </div>
          <button
            onClick={() => navigate('/aws/connect')}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded font-semibold shrink-0 cursor-pointer transition-colors"
          >
            Connect AWS
          </button>
        </div>
      ) : !hasConnectedAccount && instances.length > 0 ? (
        (() => {
          console.log('[ACCOUNT STATE] Account API returned 0 accounts but EC2 returned real instances.');
          return null;
        })()
      ) : null}

      {/* Main Table Container */}
      <div className="bg-[#111827] border border-slate-800 rounded-lg shadow-sm overflow-hidden font-mono-tabular">
        {/* Top Controls: Search, Account Selector, Filters, Batch Action Bar */}
        <div className="p-3 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search server, ID, IP, account..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-md text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 select-text"
              />
            </div>

            {/* Account Selector */}
            {awsAccounts.length > 1 ? (
              <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-2 py-1 rounded-md text-xs">
                <User className="w-3.5 h-3.5 text-blue-400" />
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="bg-transparent text-slate-200 focus:outline-none cursor-pointer font-mono text-xs"
                >
                  <option value="all">All Accounts ({awsAccounts.length})</option>
                  {awsAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.account_name} ({acc.account_id || acc.region || 'ap-south-1'})
                    </option>
                  ))}
                </select>
              </div>
            ) : awsAccounts.length === 1 ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-md text-xs font-mono text-slate-300">
                <User className="w-3.5 h-3.5 text-blue-400" />
                <span className="font-semibold text-white">{awsAccounts[0].account_name}</span>
                <span className="text-slate-500">({awsAccounts[0].account_id || awsAccounts[0].region || 'ap-south-1'})</span>
              </div>
            ) : null}

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-900 border border-slate-800 text-slate-300 px-3 py-1.5 rounded-md text-xs focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="RUNNING">Running Only</option>
              <option value="STOPPED">Stopped Only</option>
            </select>
          </div>

          {/* Selection Action Bar */}
          {selectedIds.length > 0 ? (
            <div className="flex items-center gap-2 bg-blue-950/80 border border-blue-600/40 px-3 py-1.5 rounded-lg text-xs">
              <span className="font-bold text-blue-300 mr-1">
                {selectedIds.length} instance{selectedIds.length > 1 ? 's' : ''} selected
              </span>

              <button
                disabled={!hasStoppedSelected}
                onClick={() => handleAction('start', selectedObjects)}
                className="px-2 py-1 bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/40 disabled:opacity-40 disabled:cursor-not-allowed rounded font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Play className="w-3 h-3" /> Start
              </button>

              <button
                disabled={!hasRunningSelected}
                onClick={() => handleAction('stop', selectedObjects)}
                className="px-2 py-1 bg-amber-600/20 text-amber-300 border border-amber-500/30 hover:bg-amber-600/40 disabled:opacity-40 disabled:cursor-not-allowed rounded font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Square className="w-3 h-3" /> Stop
              </button>

              <button
                disabled={!hasRunningSelected}
                onClick={() => handleAction('reboot', selectedObjects)}
                className="px-2 py-1 bg-blue-600/20 text-blue-300 border border-blue-500/30 hover:bg-blue-600/40 disabled:opacity-40 disabled:cursor-not-allowed rounded font-semibold flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" /> Reboot
              </button>

              <button
                onClick={() => openTerminateModal(selectedObjects)}
                className="px-2 py-1 bg-rose-600/20 text-rose-300 border border-rose-500/30 hover:bg-rose-600/40 rounded font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" /> Terminate
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Showing {filteredInstances.length} servers</span>
              <button
                onClick={() => fetchInstances(true)}
                className="p-1.5 bg-slate-900 border border-slate-800 rounded hover:bg-slate-800 text-slate-300 cursor-pointer"
                title="Refresh instances"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-400' : ''}`} />
              </button>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              <span>Fetching EC2 servers from AWS Boto3...</span>
            </div>
          ) : errorMsg ? (
            <div className="p-8 text-center text-xs text-rose-300 bg-rose-500/5">
              <p className="font-semibold">{errorMsg}</p>
            </div>
          ) : filteredInstances.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-500">
              No EC2 instances found matching your search.
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900/90 text-slate-400 border-b border-slate-800 uppercase font-semibold text-[10px] tracking-wider select-none">
                  <th className="p-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={filteredInstances.length > 0 && selectedIds.length === filteredInstances.length}
                      onChange={handleSelectAll}
                      className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-0 cursor-pointer"
                    />
                  </th>
                  <th className="p-3">Server Name</th>
                  <th className="p-3">AWS Account</th>
                  <th className="p-3">Operating System</th>
                  <th className="p-3">Server Size</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Public IP</th>
                  <th className="p-3">Region</th>
                  <th className="p-3">Launch Time</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {filteredInstances.map((inst) => {
                  const isSelected = selectedIds.includes(inst.instance_id);
                  const isTerminated = inst.status.toLowerCase() === 'terminated';

                  return (
                    <tr
                      key={inst.instance_id}
                      onClick={() => setDetailInstance(inst)}
                      className={`hover:bg-slate-800/40 transition-colors cursor-pointer ${
                        isSelected ? 'bg-blue-600/10' : ''
                      }`}
                    >
                      {/* Checkbox Column */}
                      <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectOne(inst.instance_id)}
                          className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-0 cursor-pointer"
                        />
                      </td>

                      <td className="p-3">
                        <div className="flex flex-col">
                          <span className="font-bold text-white text-xs hover:text-blue-400 underline decoration-blue-500/40">
                            {inst.name || 'Unnamed Instance'}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">{inst.instance_id}</span>
                        </div>
                      </td>

                      <td className="p-3">
                        <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-300 rounded text-[11px] font-semibold flex items-center gap-1 w-fit">
                          <User className="w-3 h-3 text-blue-400" />
                          <span>{inst.aws_account_name || inst.account_name || 'primary'} ({inst.aws_account_number || inst.account_id || 'ap-south-1'})</span>
                        </span>
                      </td>

                      <td className="p-3 text-slate-300">{inst.os}</td>

                      <td className="p-3">
                        <span className="px-2 py-0.5 bg-slate-800 text-slate-300 border border-slate-700/60 rounded text-[11px] font-mono">
                          {inst.instance_type}
                        </span>
                      </td>

                      <td className="p-3">
                        <StatusBadge status={inst.status} />
                      </td>

                      <td className="p-3 text-slate-300 font-semibold font-mono">{inst.public_ip}</td>
                      <td className="p-3 text-slate-400">{inst.region || 'ap-south-1'}</td>
                      <td className="p-3 text-slate-400">{inst.launch_time}</td>

                      {/* Actions Column */}
                      <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Connect Button */}
                          <button
                            disabled={isTerminated}
                            onClick={(e) => handleConnectClick(inst, e)}
                            className="px-2 py-1 bg-blue-600/20 text-blue-300 border border-blue-500/30 hover:bg-blue-600/30 disabled:opacity-40 disabled:cursor-not-allowed rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                            title="Connect to Live Terminal"
                          >
                            <Terminal className="w-3 h-3 text-blue-400" /> Connect
                          </button>

                          {/* Start Button */}
                          <button
                            disabled={isTerminated || inst.status.toLowerCase() === 'running'}
                            onClick={() => handleAction('start', inst)}
                            className="px-2 py-1 bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30 disabled:opacity-30 disabled:cursor-not-allowed rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                            title="Start Server"
                          >
                            <Play className="w-3 h-3" /> Start
                          </button>

                          {/* Stop Button */}
                          <button
                            disabled={isTerminated || inst.status.toLowerCase() === 'stopped'}
                            onClick={() => handleAction('stop', inst)}
                            className="px-2 py-1 bg-amber-600/20 text-amber-300 border border-amber-500/30 hover:bg-amber-600/30 disabled:opacity-30 disabled:cursor-not-allowed rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                            title="Stop Server"
                          >
                            <Square className="w-3 h-3" /> Stop
                          </button>

                          {/* Reboot Button */}
                          <button
                            disabled={isTerminated || inst.status.toLowerCase() !== 'running'}
                            onClick={() => handleAction('reboot', inst)}
                            className="px-2 py-1 bg-blue-600/20 text-blue-300 border border-blue-500/30 hover:bg-blue-600/30 disabled:opacity-30 disabled:cursor-not-allowed rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                            title="Reboot Server"
                          >
                            <RefreshCw className="w-3 h-3" /> Reboot
                          </button>

                          {/* Terminate Button */}
                          <button
                            disabled={isTerminated}
                            onClick={() => openTerminateModal(inst)}
                            className="px-2 py-1 bg-rose-600/20 text-rose-300 border border-rose-500/30 hover:bg-rose-600/30 disabled:opacity-30 disabled:cursor-not-allowed rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                            title="Terminate Server"
                          >
                            <Trash2 className="w-3 h-3" /> Terminate
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* EC2 Launch Wizard Modal */}
      {isWizardOpen && (
        <EC2LaunchWizard
          isOpen={isWizardOpen}
          onClose={() => setIsWizardOpen(false)}
          onLaunch={handleLaunchServer}
          isSubmitting={isLaunching}
          selectedAccountId={selectedAccountId}
          awsAccounts={awsAccounts}
        />
      )}

      {/* Windows RDP Connect Modal */}
      {connectInstance && (
        <EC2ConnectModal
          isOpen={!!connectInstance}
          instance={connectInstance}
          onClose={() => setConnectInstance(null)}
          onOpenTerminal={(inst) => {
            setConnectInstance(null);
            setTerminalInstance(inst);
          }}
        />
      )}

      {/* Live Web-Based SSH Terminal Modal */}
      {terminalInstance && (
        <SSHTerminalModal
          isOpen={!!terminalInstance}
          instance={terminalInstance}
          onClose={() => setTerminalInstance(null)}
        />
      )}

      {/* EC2 Detail Telemetry Modal */}
      {detailInstance && (
        <EC2DetailModal
          isOpen={!!detailInstance}
          instance={detailInstance}
          onClose={() => setDetailInstance(null)}
        />
      )}

      {/* Terminate Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmTerminate.isOpen}
        title="Confirm Instance Termination"
        message={`Are you sure you want to terminate ${
          confirmTerminate.targetInstances.length === 1
            ? `instance "${confirmTerminate.targetInstances[0].name || confirmTerminate.targetInstances[0].instance_id}"`
            : `${confirmTerminate.targetInstances.length} selected instances`
        }? This will permanently delete the virtual server(s) on AWS and cannot be undone.`}
        confirmText="Yes, Terminate Instance(s)"
        cancelText="Cancel"
        isDanger={true}
        onConfirm={handleConfirmTerminate}
        onCancel={() => setConfirmTerminate({ isOpen: false, targetInstances: [] })}
      />
    </div>
  );
};

export default EC2Page;
