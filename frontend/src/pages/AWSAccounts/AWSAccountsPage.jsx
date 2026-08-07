import React, { useState, useEffect } from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { StatsCards } from '../../components/cards/StatsCards';
import { ConfirmationModal } from '../../components/ui/ConfirmationModal';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import {
  Building2,
  Plus,
  Key,
  Globe,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Edit2,
  Trash2,
  ShieldCheck,
  Check,
  X,
  Loader2,
  ExternalLink,
  Shield,
  Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const AWSAccountsPage = () => {
  const { awsAccounts, fetchAwsAccounts, selectedAccountId, setSelectedAccountId } = useAuth();
  const { showToast } = useToast();

  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    account_name: '',
    access_key: '',
    secret_key: '',
    region: 'us-east-1'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testingId, setTestingId] = useState(null);

  // Confirm Delete
  const [confirmConfig, setConfirmConfig] = useState({
    isOpen: false,
    targetAccount: null
  });

  const loadAccounts = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await api.get('/aws/accounts');
      if (res.data && res.data.accounts) {
        setAccounts(res.data.accounts);
        fetchAwsAccounts(); // Sync auth context
        if (isManual) showToast('AWS accounts list updated.');
      }
    } catch (err) {
      showToast('Failed to load AWS accounts.', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const handleOpenAddModal = () => {
    setFormData({
      account_name: '',
      access_key: '',
      secret_key: '',
      region: 'us-east-1'
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (acc) => {
    setEditingAccount(acc);
    setFormData({
      account_name: acc.account_name,
      access_key: '',
      secret_key: '',
      region: acc.region
    });
    setIsEditModalOpen(true);
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!formData.access_key || !formData.secret_key) {
      showToast('Access Key and Secret Key are required.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.post('/aws/accounts', formData);
      showToast(res.data?.message || 'AWS Account connected successfully!');
      setIsAddModalOpen(false);
      await loadAccounts(true);
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to add AWS Account.';
      showToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingAccount) return;

    setIsSubmitting(true);
    try {
      const payload = {
        account_name: formData.account_name,
        region: formData.region
      };
      if (formData.access_key && formData.secret_key) {
        payload.access_key = formData.access_key;
        payload.secret_key = formData.secret_key;
      }

      const res = await api.put(`/aws/accounts/${editingAccount.id}`, payload);
      showToast(res.data?.message || 'AWS Account updated.');
      setIsEditModalOpen(false);
      setEditingAccount(null);
      await loadAccounts(true);
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to update AWS Account.';
      showToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTestConnection = async (accId) => {
    setTestingId(accId);
    try {
      const res = await api.post(`/aws/accounts/${accId}/test`);
      if (res.data && res.data.success) {
        showToast(`STS Verification Passed for Account ID: ${res.data.account_id}`);
      } else {
        showToast(res.data?.error || 'Verification failed.', 'error');
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'Connection test failed.';
      showToast(msg, 'error');
    } finally {
      setTestingId(null);
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!confirmConfig.targetAccount) return;
    const acc = confirmConfig.targetAccount;
    setConfirmConfig({ isOpen: false, targetAccount: null });

    try {
      const res = await api.delete(`/aws/accounts/${acc.id}`);
      showToast(res.data?.message || `AWS Account "${acc.account_name}" removed.`);
      if (String(selectedAccountId) === String(acc.id)) {
        setSelectedAccountId('all');
      }
      await loadAccounts(true);
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to remove AWS Account.';
      showToast(msg, 'error');
    }
  };

  const stats = [
    { title: 'Connected AWS Accounts', value: `${accounts.length} Active`, change: 'Encrypted', changeType: 'increase', icon: Building2, subtitle: 'AES-256 Fernet Key Vault' },
    { title: 'Active Account Scope', value: selectedAccountId === 'all' ? 'All Accounts' : accounts.find((a) => String(a.id) === String(selectedAccountId))?.account_name || 'Single Account', change: 'Multi-Tenant', changeType: 'increase', icon: Layers, subtitle: 'Header X-AWS-Account-ID' },
    { title: 'Security Enforcement', value: 'STS Verified', change: 'Enforced', changeType: 'increase', icon: ShieldCheck, subtitle: 'GetCallerIdentity Validation' },
  ];

  return (
    <div className="font-mono-tabular space-y-6 pb-24">
      <PageHeader
        title="AWS Account Manager"
        description="Multi-AWS account credentials vault, multi-tenant isolation, and STS session management."
        arn="arn:aws:iam::*:user/managed-accounts"
        onRefresh={() => loadAccounts(true)}
        isRefreshing={refreshing}
        actions={
          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Connect AWS Account</span>
          </button>
        }
      />

      <StatsCards items={stats} />

      {/* Main Accounts Inventory */}
      <div className="bg-[#111827] border border-slate-800 rounded-lg shadow-sm overflow-hidden font-mono-tabular">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between gap-3 bg-slate-900/60">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Managed AWS Account Credentials</h3>
          </div>

          <button
            onClick={() => loadAccounts(true)}
            className="p-1.5 bg-slate-900 border border-slate-800 rounded hover:bg-slate-800 text-slate-300 text-xs flex items-center gap-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-400' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 bg-slate-900/70 border border-slate-800/60 rounded-md animate-pulse flex items-center px-4 justify-between">
                <div className="w-48 h-4 bg-slate-800 rounded" />
                <div className="w-32 h-4 bg-slate-800 rounded" />
                <div className="w-24 h-4 bg-slate-800 rounded" />
              </div>
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Building2 className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-sm font-semibold text-slate-200">No AWS Accounts Connected</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Add your AWS IAM Access Key ID and Secret Access Key to connect your AWS environment.
            </p>
            <button
              onClick={handleOpenAddModal}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold shadow inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Connect AWS Account</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {accounts.map((acc) => {
              const isSelected = String(selectedAccountId) === String(acc.id);

              return (
                <div
                  key={acc.id}
                  className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
                    isSelected ? 'bg-blue-600/5 border-l-4 border-l-blue-500' : 'hover:bg-slate-900/40'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-blue-400 shrink-0">
                      <Building2 className="w-5 h-5" />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-xs">{acc.account_name}</span>
                        {isSelected && (
                          <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded text-[10px] font-bold uppercase">
                            Active Scope
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
                        <span>Account ID: <strong className="text-slate-200">{acc.account_id || 'N/A'}</strong></span>
                        <span>Region: <strong className="text-slate-200">{acc.region}</strong></span>
                        <span>Access Key: <strong className="text-slate-300 font-mono">{acc.masked_access_key}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
                    <button
                      onClick={() => setSelectedAccountId(acc.id)}
                      className={`px-3 py-1.5 rounded text-xs font-semibold border transition-colors ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-500'
                          : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      {isSelected ? 'Active Scope' : 'Select Account'}
                    </button>

                    <button
                      onClick={() => handleTestConnection(acc.id)}
                      disabled={testingId === acc.id}
                      className="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded text-xs font-semibold flex items-center gap-1.5"
                    >
                      {testingId === acc.id ? <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" /> : <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />}
                      <span>Test STS</span>
                    </button>

                    <button
                      onClick={() => handleOpenEditModal(acc)}
                      className="p-2 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded transition-colors"
                      title="Edit Credentials"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => setConfirmConfig({ isOpen: true, targetAccount: acc })}
                      className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                      title="Delete Account"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ADD ACCOUNT MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 font-mono-tabular">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-md bg-[#0d121f] border border-slate-800 rounded-xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-400" />
                Connect New AWS Account
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Account Label Name</label>
                <input
                  type="text"
                  required
                  value={formData.account_name}
                  onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                  placeholder="e.g. Personal, Client A, Production"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">AWS Region</label>
                <select
                  value={formData.region}
                  onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-slate-100 focus:outline-none"
                >
                  <option value="us-east-1">us-east-1 (N. Virginia)</option>
                  <option value="us-west-2">us-west-2 (Oregon)</option>
                  <option value="ap-south-1">ap-south-1 (Mumbai)</option>
                  <option value="ap-southeast-1">ap-southeast-1 (Singapore)</option>
                  <option value="eu-central-1">eu-central-1 (Frankfurt)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">AWS Access Key ID</label>
                <input
                  type="text"
                  required
                  value={formData.access_key}
                  onChange={(e) => setFormData({ ...formData, access_key: e.target.value })}
                  placeholder="AKIAIOSFODNN7EXAMPLE"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">AWS Secret Access Key (Encrypted AES-256)</label>
                <input
                  type="password"
                  required
                  value={formData.secret_key}
                  onChange={(e) => setFormData({ ...formData, secret_key: e.target.value })}
                  placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-900 border border-slate-800 text-slate-300 rounded hover:bg-slate-800 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-semibold shadow flex items-center gap-1.5"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Test & Save Account</span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* EDIT ACCOUNT MODAL */}
      {isEditModalOpen && editingAccount && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 font-mono-tabular">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-md bg-[#0d121f] border border-slate-800 rounded-xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-amber-400" />
                Update {editingAccount.account_name}
              </h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Account Label Name</label>
                <input
                  type="text"
                  required
                  value={formData.account_name}
                  onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">AWS Region</label>
                <select
                  value={formData.region}
                  onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-slate-100 focus:outline-none"
                >
                  <option value="us-east-1">us-east-1 (N. Virginia)</option>
                  <option value="us-west-2">us-west-2 (Oregon)</option>
                  <option value="ap-south-1">ap-south-1 (Mumbai)</option>
                  <option value="ap-southeast-1">ap-southeast-1 (Singapore)</option>
                  <option value="eu-central-1">eu-central-1 (Frankfurt)</option>
                </select>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded space-y-3">
                <p className="text-[11px] text-slate-400">Leave key fields blank if you do not wish to change existing encrypted credentials.</p>
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">New AWS Access Key ID (Optional)</label>
                  <input
                    type="text"
                    value={formData.access_key}
                    onChange={(e) => setFormData({ ...formData, access_key: e.target.value })}
                    placeholder="Leave blank to keep existing"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-slate-100 placeholder-slate-500 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">New AWS Secret Access Key (Optional)</label>
                  <input
                    type="password"
                    value={formData.secret_key}
                    onChange={(e) => setFormData({ ...formData, secret_key: e.target.value })}
                    placeholder="Leave blank to keep existing"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-slate-100 placeholder-slate-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 bg-slate-900 border border-slate-800 text-slate-300 rounded hover:bg-slate-800 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-semibold shadow flex items-center gap-1.5"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Update Account</span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      <ConfirmationModal
        isOpen={confirmConfig.isOpen}
        onClose={() => setConfirmConfig({ isOpen: false, targetAccount: null })}
        onConfirm={handleDeleteConfirmed}
        title="Remove AWS Account Credentials"
        description="Removing this account will un-link its encrypted access keys from your CloudOps profile."
        resourceName={confirmConfig.targetAccount?.account_name || ''}
        confirmButtonText="Remove Account"
        variant="danger"
      />
    </div>
  );
};
