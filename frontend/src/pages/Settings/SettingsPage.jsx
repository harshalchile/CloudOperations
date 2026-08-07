import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/layout/PageHeader';
import { Settings, Shield, Bell, Globe, Key, Save, Check } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export const SettingsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'all';
  const { showToast } = useToast();

  const [saved, setSaved] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    setSaved(true);
    showToast('Platform settings updated successfully');
    setTimeout(() => setSaved(false), 2000);
  };

  const showAws = activeTab === 'all' || activeTab === 'aws';
  const showSecurity = activeTab === 'all' || activeTab === 'security';
  const showWebhooks = activeTab === 'all' || activeTab === 'webhooks';

  return (
    <div>
      <PageHeader
        title="Cloud Platform Settings"
        description="Configure multi-cloud provider API keys, security options, and webhook incident integrations."
        arn="arn:aws:config:us-east-1:99201482019:settings"
      />

      {/* Tab bar */}
      <div className="flex items-center gap-2 border-b border-slate-800 mb-6 font-mono-tabular">
        <button
          onClick={() => setSearchParams({ tab: 'all' })}
          className={`px-3 py-1.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'all' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          All Settings
        </button>
        <button
          onClick={() => setSearchParams({ tab: 'aws' })}
          className={`px-3 py-1.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'aws' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          AWS Account Credentials
        </button>
        <button
          onClick={() => setSearchParams({ tab: 'security' })}
          className={`px-3 py-1.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'security' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Security & MFA
        </button>
        <button
          onClick={() => setSearchParams({ tab: 'webhooks' })}
          className={`px-3 py-1.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'webhooks' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Webhooks & Alerts
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6 max-w-4xl font-mono-tabular">
        {/* Cloud Credentials */}
        {showAws && (
          <div className="bg-[#111827] border border-slate-800 rounded-lg p-5">
            <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-800">
              <Globe className="w-4 h-4 text-blue-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">AWS / Cloud Provider Credentials</h3>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">AWS Access Key ID</label>
                <input
                  type="text"
                  defaultValue="AKIAIOSFODNN7EXAMPLE"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">AWS Secret Access Key</label>
                <input
                  type="password"
                  defaultValue="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Security & MFA Settings */}
        {showSecurity && (
          <div className="bg-[#111827] border border-slate-800 rounded-lg p-5">
            <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-800">
              <Shield className="w-4 h-4 text-blue-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Security & Enforcement Rules</h3>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-3 bg-slate-900/60 border border-slate-800 rounded">
                <div>
                  <span className="font-semibold text-white block">Enforce Multi-Factor Authentication (MFA)</span>
                  <span className="text-[11px] text-slate-400">Require TOTP or YubiKey hardware token for all IAM admins</span>
                </div>
                <input type="checkbox" defaultChecked className="w-4 h-4 text-blue-500 rounded bg-slate-800 border-slate-700" />
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-900/60 border border-slate-800 rounded">
                <div>
                  <span className="font-semibold text-white block">Session Timeout</span>
                  <span className="text-[11px] text-slate-400">Auto sign-out after 30 minutes of inactivity</span>
                </div>
                <select className="bg-slate-900 border border-slate-800 text-slate-200 px-2 py-1 rounded text-xs">
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="60">1 hour</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Webhooks & Alerts */}
        {showWebhooks && (
          <div className="bg-[#111827] border border-slate-800 rounded-lg p-5">
            <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-800">
              <Bell className="w-4 h-4 text-blue-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Webhook & Incident Integrations</h3>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Slack Alert Channel Webhook URL</label>
                <input
                  type="text"
                  defaultValue="https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">PagerDuty Integration Routing Key</label>
                <input
                  type="text"
                  defaultValue="pd_live_9981a712f00"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold shadow transition-colors"
          >
            {saved ? <Check className="w-4 h-4 text-emerald-300" /> : <Save className="w-4 h-4" />}
            <span>{saved ? 'Settings Saved' : 'Save Changes'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
