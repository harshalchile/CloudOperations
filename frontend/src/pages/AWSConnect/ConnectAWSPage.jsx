import React, { useState, useEffect } from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../services/api';
import { ShieldCheck, Globe, Key, Lock, CheckCircle2, AlertTriangle, Loader2, Save, Trash2, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const ConnectAWSPage = () => {
  const { awsAccount, fetchAwsStatus } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [accessKey, setAccessKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [region, setRegion] = useState('ap-south-1');

  const [testResult, setTestResult] = useState(null); // { success, account_id, arn, region } | { error }
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (awsAccount) {
      setRegion(awsAccount.region || 'ap-south-1');
    }
  }, [awsAccount]);

  const handleTestConnection = async (e) => {
    e.preventDefault();
    if (!accessKey.trim() || !secretKey.trim()) {
      showToast('Please enter both AWS Access Key and Secret Key.', 'warning');
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await api.post('/aws/test', {
        accessKey: accessKey.trim(),
        secretKey: secretKey.trim(),
        region,
      });

      if (res.data && res.data.success) {
        setTestResult(res.data);
        showToast('Connected Successfully via AWS STS GetCallerIdentity');
      } else {
        setTestResult({ error: res.data.error || 'Connection failed.' });
        showToast(res.data.error || 'AWS Connection Failed', 'error');
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to connect to AWS STS service.';
      setTestResult({ error: errorMsg });
      showToast(errorMsg, 'error');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveCredentials = async () => {
    if (!testResult || !testResult.success) {
      showToast('Please run "Test Connection" successfully before saving credentials.', 'warning');
      return;
    }

    setIsSaving(true);
    try {
      const res = await api.post('/aws/connect', {
        accessKey: accessKey.trim(),
        secretKey: secretKey.trim(),
        region,
      });

      showToast('Encrypted AWS credentials saved successfully!');
      await fetchAwsStatus();
      navigate('/dashboard');
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to save AWS credentials.';
      showToast(errorMsg, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveAccount = async () => {
    try {
      await api.delete('/aws/remove');
      showToast('AWS Account disconnected.');
      await fetchAwsStatus();
      setTestResult(null);
      setAccessKey('');
      setSecretKey('');
    } catch (err) {
      showToast('Failed to disconnect AWS account.', 'error');
    }
  };

  return (
    <div>
      <PageHeader
        title="Connect AWS Account"
        description="Authenticate your AWS IAM user credentials via STS GetCallerIdentity and store AES-256 encrypted keys."
        arn="arn:aws:iam::99201482019:role/CloudOpsConnectRole"
      />

      {/* Connected Account Banner if exists */}
      {awsAccount && awsAccount.account_id && (
        <div className="mb-6 bg-slate-900 border border-emerald-500/30 rounded-lg p-4 font-mono-tabular flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-md text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-white uppercase tracking-wider block">
                AWS Account Connected
              </span>
              <p className="text-xs text-slate-300 mt-0.5">
                Account ID: <strong className="text-white">{awsAccount.account_id}</strong> • Region:{' '}
                <strong className="text-white">{awsAccount.region}</strong>
              </p>
              <p className="text-[11px] text-slate-500 font-mono-tabular">ARN: {awsAccount.arn}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/dashboard')}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold shadow flex items-center gap-1"
            >
              <span>Go to Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleRemoveAccount}
              className="px-3 py-1.5 bg-rose-600/20 text-rose-300 border border-rose-500/30 hover:bg-rose-600/30 rounded text-xs font-semibold flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" /> Remove
            </button>
          </div>
        </div>
      )}

      {/* Form Container */}
      <div className="max-w-3xl bg-[#111827] border border-slate-800 rounded-lg p-6 font-mono-tabular space-y-6">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
          <Key className="w-4 h-4 text-blue-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">AWS IAM Access Credentials</h3>
        </div>

        <form onSubmit={handleTestConnection} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 mb-1 font-semibold">AWS Access Key ID</label>
            <input
              type="text"
              required
              value={accessKey}
              onChange={(e) => {
                setAccessKey(e.target.value);
                setTestResult(null);
              }}
              placeholder="e.g. AKIAIOSFODNN7EXAMPLE"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 mb-1 font-semibold">AWS Secret Access Key</label>
            <input
              type="password"
              required
              value={secretKey}
              onChange={(e) => {
                setSecretKey(e.target.value);
                setTestResult(null);
              }}
              placeholder="e.g. wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 mb-1 font-semibold">AWS Default Region</label>
            <select
              value={region}
              onChange={(e) => {
                setRegion(e.target.value);
                setTestResult(null);
              }}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-slate-100 focus:outline-none focus:border-blue-500"
            >
              <option value="ap-south-1">Mumbai (ap-south-1)</option>
              <option value="ap-southeast-1">Singapore (ap-southeast-1)</option>
              <option value="us-east-1">Virginia (us-east-1)</option>
            </select>
          </div>

          {/* Test Result Indicator */}
          {testResult && (
            <div
              className={`p-4 rounded-md border text-xs space-y-1 ${
                testResult.success
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-sm">
                {testResult.success ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Connected Successfully</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <span>Connection Failed</span>
                  </>
                )}
              </div>

              {testResult.success ? (
                <div className="pt-2 border-t border-emerald-500/20 text-xs space-y-1">
                  <p>Account ID: <strong className="text-white">{testResult.account_id}</strong></p>
                  <p>User ARN: <strong className="text-white">{testResult.arn}</strong></p>
                  <p>Verified Region: <strong className="text-white">{testResult.region}</strong></p>
                </div>
              ) : (
                <p className="text-xs pt-1 text-rose-200">{testResult.error}</p>
              )}
            </div>
          )}

          {/* Buttons: Test Connection & Save Credentials */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="submit"
              disabled={isTesting}
              className="px-4 py-2 bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 rounded font-semibold transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {isTesting ? <Loader2 className="w-4 h-4 animate-spin text-blue-400" /> : <Globe className="w-4 h-4 text-blue-400" />}
              <span>Test Connection</span>
            </button>

            <button
              type="button"
              onClick={handleSaveCredentials}
              disabled={!testResult || !testResult.success || isSaving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-semibold shadow transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Save Credentials</span>
            </button>
          </div>
        </form>

        <div className="p-3 bg-slate-900 border border-slate-800 rounded text-[11px] text-slate-400 flex items-center gap-2">
          <Lock className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            Credentials are encrypted symmetrically with <strong>Fernet AES-256</strong> before DB insertion.
          </span>
        </div>
      </div>
    </div>
  );
};
