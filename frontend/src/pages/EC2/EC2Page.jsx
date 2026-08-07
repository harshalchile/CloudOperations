import React, { useState, useEffect } from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ConfirmationModal } from '../../components/ui/ConfirmationModal';
import { EC2LaunchWizard } from '../../components/ec2/EC2LaunchWizard';
import { EC2ConnectModal } from '../../components/ec2/EC2ConnectModal';
import { SSHTerminalModal } from '../../components/ec2/SSHTerminalModal';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../services/api';
import { Server, Play, Square, RefreshCw, Trash2, Plus, Search, Loader2, AlertTriangle, Terminal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const EC2Page = () => {
  const { user, awsAccount } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Controls State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Wizard & Modal State
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [confirmTerminate, setConfirmTerminate] = useState({ isOpen: false, targetInstance: null });
  
  // Windows RDP Connect Modal State
  const [connectInstance, setConnectInstance] = useState(null);

  // In-Browser Live SSH Terminal Modal State
  const [terminalInstance, setTerminalInstance] = useState(null);

  const fetchInstances = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setErrorMsg('');

    try {
      const res = await api.get('/ec2');
      if (res.data && res.data.instances) {
        setInstances(res.data.instances);
        if (isManualRefresh) showToast('EC2 instance list refreshed.');
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to fetch EC2 instances.';
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
  }, []);

  const handleAction = async (actionType, instanceId) => {
    try {
      showToast(`Initiating ${actionType} for ${instanceId}...`);
      const res = await api.post(`/ec2/${actionType}`, { instance_id: instanceId });
      showToast(res.data?.message || `${actionType.toUpperCase()} request sent.`);
      await fetchInstances(true);
    } catch (err) {
      const msg = err.response?.data?.error || `Failed to ${actionType} instance.`;
      showToast(msg, 'error');
    }
  };

  const handleLaunchServer = async (payload) => {
    setIsLaunching(true);
    try {
      const res = await api.post('/ec2/create', payload);
      showToast(res.data?.message || 'Server launched successfully!');
      setIsWizardOpen(false);
      await fetchInstances(true);
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to launch server.';
      showToast(msg, 'error');
    } finally {
      setIsLaunching(false);
    }
  };

  const handleConfirmTerminate = async () => {
    if (!confirmTerminate.targetInstance) return;
    await handleAction('terminate', confirmTerminate.targetInstance.instance_id);
    setConfirmTerminate({ isOpen: false, targetInstance: null });
  };

  const handleConnectClick = (inst) => {
    if (inst.status.toLowerCase() !== 'running') {
      showToast(`Server "${inst.name}" is in '${inst.status}' state. Start the instance first to connect.`, 'warning');
      return;
    }
    setConnectInstance(inst);
  };

  // Filtered List
  const filteredInstances = instances.filter((inst) => {
    const matchesSearch =
      inst.name.toLowerCase().includes(search.toLowerCase()) ||
      inst.instance_id.toLowerCase().includes(search.toLowerCase()) ||
      inst.public_ip.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === 'ALL'
        ? true
        : inst.status.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="font-mono-tabular space-y-6">
      <PageHeader
        title="EC2 Virtual Servers"
        description="Manage AWS EC2 instances using your saved AWS credentials."
        arn={awsAccount ? `arn:aws:ec2:${awsAccount.region}:${awsAccount.account_id}:instance/*` : 'arn:aws:ec2:us-east-1:unconnected'}
        onRefresh={() => fetchInstances(true)}
        isRefreshing={refreshing}
        actions={
          <button
            onClick={() => setIsWizardOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Launch New Server</span>
          </button>
        }
      />

      {/* No AWS Connected Warning */}
      {(!awsAccount || !awsAccount.account_id) && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300 text-xs flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>No AWS Account connected yet. Connect your AWS credentials to view and launch EC2 instances.</span>
          </div>
          <button
            onClick={() => navigate('/aws/connect')}
            className="px-3 py-1.5 bg-amber-600 text-white rounded font-semibold shrink-0"
          >
            Connect AWS
          </button>
        </div>
      )}

      {/* Main Table Container */}
      <div className="bg-[#111827] border border-slate-800 rounded-lg shadow-sm overflow-hidden font-mono-tabular">
        {/* Top Controls: Search, Filters, Refresh */}
        <div className="p-3 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-72">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search server name, ID, or IP..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-md text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-900 border border-slate-800 text-slate-300 px-3 py-1.5 rounded-md text-xs focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="RUNNING">Running Only</option>
              <option value="STOPPED">Stopped Only</option>
            </select>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Showing {filteredInstances.length} servers</span>
            <button
              onClick={() => fetchInstances(true)}
              className="p-1.5 bg-slate-900 border border-slate-800 rounded hover:bg-slate-800 text-slate-300"
              title="Refresh instances"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-400' : ''}`} />
            </button>
          </div>
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
                  <th className="p-3">Server Name</th>
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
                {filteredInstances.map((inst) => (
                  <tr key={inst.instance_id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3">
                      <div className="flex flex-col">
                        <span className="font-bold text-white text-xs">{inst.name}</span>
                        <span className="text-[10px] text-slate-500">{inst.instance_id}</span>
                      </div>
                    </td>

                    <td className="p-3 text-slate-300">{inst.os}</td>

                    <td className="p-3">
                      <span className="px-2 py-0.5 bg-slate-800 text-slate-300 border border-slate-700/60 rounded text-[11px]">
                        {inst.instance_type}
                      </span>
                    </td>

                    <td className="p-3">
                      <StatusBadge status={inst.status} />
                    </td>

                    <td className="p-3 text-slate-300 font-semibold">{inst.public_ip}</td>
                    <td className="p-3 text-slate-400">{inst.region}</td>
                    <td className="p-3 text-slate-400">{inst.launch_time}</td>

                    {/* Actions Column */}
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Connect Button */}
                        <button
                          onClick={() => handleConnectClick(inst)}
                          className="px-2 py-1 bg-blue-600/20 text-blue-300 border border-blue-500/30 hover:bg-blue-600/30 rounded text-[11px] font-semibold flex items-center gap-1"
                          title="Connect to Live Terminal"
                        >
                          <Terminal className="w-3 h-3 text-blue-400" /> Connect
                        </button>

                        {inst.status.toLowerCase() === 'stopped' && (
                          <button
                            onClick={() => handleAction('start', inst.instance_id)}
                            className="px-2 py-1 bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30 rounded text-[11px] font-semibold flex items-center gap-1"
                            title="Start Server"
                          >
                            <Play className="w-3 h-3" /> Start
                          </button>
                        )}

                        {inst.status.toLowerCase() === 'running' && (
                          <>
                            <button
                              onClick={() => handleAction('stop', inst.instance_id)}
                              className="px-2 py-1 bg-amber-600/20 text-amber-300 border border-amber-500/30 hover:bg-amber-600/30 rounded text-[11px] font-semibold flex items-center gap-1"
                              title="Stop Server"
                            >
                              <Square className="w-3 h-3" /> Stop
                            </button>

                            <button
                              onClick={() => handleAction('reboot', inst.instance_id)}
                              className="px-2 py-1 bg-blue-600/20 text-blue-300 border border-blue-500/30 hover:bg-blue-600/30 rounded text-[11px] font-semibold flex items-center gap-1"
                              title="Reboot Server"
                            >
                              <RefreshCw className="w-3 h-3" /> Reboot
                            </button>
                          </>
                        )}

                        <button
                          onClick={() => setConfirmTerminate({ isOpen: true, targetInstance: inst })}
                          className="px-2 py-1 bg-rose-600/20 text-rose-300 border border-rose-500/30 hover:bg-rose-600/30 rounded text-[11px] font-semibold flex items-center gap-1"
                          title="Terminate Server"
                        >
                          <Trash2 className="w-3 h-3" /> Terminate
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* EC2 Connect Modal (Linux EIC, SSH & Windows RDP) */}
      <EC2ConnectModal
        isOpen={Boolean(connectInstance)}
        onClose={() => setConnectInstance(null)}
        instance={connectInstance}
        onOpenTerminal={(inst) => setTerminalInstance(inst)}
      />

      {/* In-Browser Live SSH Terminal Modal */}
      <SSHTerminalModal
        isOpen={Boolean(terminalInstance)}
        onClose={() => setTerminalInstance(null)}
        instance={terminalInstance}
      />

      {/* Confirmation Modal for Terminate */}
      <ConfirmationModal
        isOpen={confirmTerminate.isOpen}
        onClose={() => setConfirmTerminate({ isOpen: false, targetInstance: null })}
        onConfirm={handleConfirmTerminate}
        title="Confirm Server Termination"
        description="Terminating this EC2 instance will shut down the server and permanently delete associated EBS root volumes."
        resourceName={confirmTerminate.targetInstance?.name || confirmTerminate.targetInstance?.instance_id}
        confirmButtonText="Terminate Server"
        variant="danger"
      />

      {/* Step-by-Step Launch Wizard */}
      <EC2LaunchWizard
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onLaunch={handleLaunchServer}
        isSubmitting={isLaunching}
      />
    </div>
  );
};
