import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  ExternalLink,
  Download,
  AlertTriangle,
  Terminal,
  Monitor,
  Key,
  Shield,
  Eye,
  EyeOff,
  Upload,
  Lock,
  Unlock,
  RefreshCw,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../../context/ToastContext';
import api from '../../services/api';

export const EC2ConnectModal = ({ isOpen, onClose, instance, onOpenTerminal }) => {
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState('eic'); // 'eic' | 'ssh' | 'rdp'
  const [username, setUsername] = useState('ec2-user');
  const [copiedField, setCopiedField] = useState(null);

  // Windows Password Decryption State
  const [pemKey, setPemKey] = useState('');
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [windowsPassword, setWindowsPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [hasPasswordData, setHasPasswordData] = useState(true);

  if (!isOpen || !instance) return null;

  const isWindows = instance.os && instance.os.toLowerCase().includes('windows');
  const hasPublicIp = instance.public_ip && instance.public_ip !== 'N/A';
  const defaultUsername = isWindows
    ? 'Administrator'
    : instance.os && instance.os.toLowerCase().includes('ubuntu')
    ? 'ubuntu'
    : 'ec2-user';

  const keyPairName = instance.key_name && instance.key_name !== 'N/A' ? `${instance.key_name}.pem` : 'key.pem';
  const sshCommand = `ssh -i "${keyPairName}" ${username || defaultUsername}@${instance.public_ip}`;

  const handleCopy = (text, fieldName) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    showToast(`Copied ${fieldName} to clipboard`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setPemKey(event.target.result);
      showToast(`Loaded key file "${file.name}"`);
    };
    reader.readAsText(file);
  };

  const handleDecryptPassword = async () => {
    setLoadingPassword(true);
    setPasswordError('');
    setWindowsPassword('');

    try {
      const res = await api.post('/ec2/windows-password', {
        instance_id: instance.instance_id,
        pem_key: pemKey
      });

      if (res.data) {
        if (!res.data.has_password) {
          setHasPasswordData(false);
          setPasswordError(res.data.message || 'Password is not available for this Windows instance.');
        } else if (res.data.decryption_error) {
          setPasswordError(res.data.decryption_error);
        } else if (res.data.decrypted_password) {
          setWindowsPassword(res.data.decrypted_password);
          showToast('Windows Administrator password decrypted successfully!', 'success');
        } else {
          setPasswordError('Password data is encrypted. Please paste or upload your private RSA key (.pem) to decrypt.');
        }
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to fetch password from AWS EC2.';
      setPasswordError(msg);
      showToast(msg, 'error');
    } finally {
      setLoadingPassword(false);
    }
  };

  const handleDownloadRdp = async () => {
    try {
      const res = await api.post('/ec2/download-rdp', { instance_id: instance.instance_id });
      if (res.data && res.data.content) {
        const blob = new Blob([res.data.content], { type: 'application/x-rdp' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = res.data.filename || `ec2-${instance.instance_id}.rdp`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showToast(`Downloaded RDP file for ${instance.name}`);
      } else {
        // Fallback client side generator
        const fallbackRdp = `full address:s:${instance.public_ip}:3389\nusername:s:Administrator\nprompt for credentials:i:1\nadministrative session:i:1\n`;
        const blob = new Blob([fallbackRdp], { type: 'application/x-rdp' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${instance.name || instance.instance_id}.rdp`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showToast(`Downloaded RDP file for ${instance.name}`);
      }
    } catch (err) {
      showToast('Failed to generate RDP file', 'error');
    }
  };

  const handleOpenAwsConsole = () => {
    const consoleUrl = `https://${instance.region || 'us-east-1'}.console.aws.amazon.com/ec2/v2/home?region=${instance.region || 'us-east-1'}#InstanceDetails:instanceId=${instance.instance_id}`;
    window.open(consoleUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 select-none font-mono-tabular">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.15 }}
          className="w-full max-w-2xl bg-[#0d121f] border border-slate-800 rounded-xl p-6 shadow-2xl space-y-5"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                {isWindows ? <Monitor className="w-5 h-5" /> : <Terminal className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Connect to Instance</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-blue-400 font-mono">
                    {instance.instance_id}
                  </span>
                </h3>
                <span className="text-xs text-slate-400">
                  {instance.name} ({instance.os}) • Public IP: {instance.public_ip}
                </span>
              </div>
            </div>
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Warning Banner if No Public IP */}
          {!hasPublicIp && (
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300 text-xs space-y-1">
              <div className="flex items-center gap-2 font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Instance Cannot Be Reached Over the Internet</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed pl-6">
                This server does not have a public IPv4 address assigned. Assign an Elastic IP or attach a Public Subnet IGW to connect remotely.
              </p>
            </div>
          )}

          {/* Connection Type Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-800">
            {!isWindows ? (
              <>
                <button
                  onClick={() => setActiveTab('eic')}
                  className={`px-4 py-2 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
                    activeTab === 'eic' ? 'border-blue-500 text-blue-400 bg-blue-500/10' : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Terminal className="w-4 h-4" />
                  <span>EC2 Instance Connect (Browser SSH)</span>
                </button>

                <button
                  onClick={() => setActiveTab('ssh')}
                  className={`px-4 py-2 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
                    activeTab === 'ssh' ? 'border-blue-500 text-blue-400 bg-blue-500/10' : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Key className="w-4 h-4" />
                  <span>SSH Client Command</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => setActiveTab('rdp')}
                className="px-4 py-2 text-xs font-bold border-b-2 border-blue-500 text-blue-400 bg-blue-500/10 flex items-center gap-2"
              >
                <Monitor className="w-4 h-4" />
                <span>RDP Connection & Password</span>
              </button>
            )}
          </div>

          {/* TAB 1: EC2 INSTANCE CONNECT (LINUX BROWSER SSH) */}
          {!isWindows && activeTab === 'eic' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg space-y-3">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold text-white">AWS EC2 Instance Connect</p>
                    <p className="text-slate-400 leading-relaxed">
                      Connect to your instance using an in-browser interactive terminal. AWS EC2 Instance Connect pushes an ephemeral 2048-bit SSH key to the instance metadata service using the boto3 API.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 text-[11px] border-t border-slate-800">
                  <div>
                    <span className="text-slate-500 block font-bold">USER NAME</span>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="mt-1 px-2.5 py-1 bg-slate-950 border border-slate-800 rounded text-slate-200 font-bold focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <span className="text-slate-500 block font-bold">PUBLIC IP</span>
                    <span className="mt-1 block text-emerald-400 font-bold">{instance.public_ip}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => {
                    onClose();
                    if (onOpenTerminal) onOpenTerminal(instance);
                  }}
                  disabled={!hasPublicIp}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold shadow-lg shadow-blue-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Terminal className="w-4 h-4" />
                  <span>Launch In-Browser SSH Terminal</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: SSH CLIENT COMMAND (LINUX) */}
          {!isWindows && activeTab === 'ssh' && (
            <div className="space-y-4 text-xs">
              <div className="space-y-2">
                <label className="block font-bold text-slate-200">1. Open an SSH Client / Terminal</label>
                <label className="block font-bold text-slate-200">2. Locate your private key file ({keyPairName})</label>
                <label className="block font-bold text-slate-200">3. Set key permissions (Linux/macOS):</label>
                <div className="p-2.5 bg-slate-950 border border-slate-800 rounded text-blue-300 font-mono">
                  chmod 400 {keyPairName}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block font-bold text-slate-200">4. Run the SSH Command:</label>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between gap-2 overflow-x-auto">
                  <code className="text-xs text-emerald-400 font-mono font-bold whitespace-nowrap">
                    {sshCommand}
                  </code>
                  <button
                    onClick={() => handleCopy(sshCommand, 'SSH Command')}
                    className="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-200 rounded shrink-0 flex items-center gap-1.5 font-bold cursor-pointer"
                  >
                    {copiedField === 'SSH Command' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedField === 'SSH Command' ? 'Copied' : 'Copy Command'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: WINDOWS RDP & PASSWORD DECRYPTION */}
          {isWindows && (
            <div className="space-y-4 text-xs">
              {/* Credentials Info Grid */}
              <div className="grid grid-cols-2 gap-3 bg-slate-900/60 p-3.5 rounded-lg border border-slate-800">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Public IP</span>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-emerald-400 font-bold">{instance.public_ip}</span>
                    <button
                      onClick={() => handleCopy(instance.public_ip, 'Public IP')}
                      className="p-1 text-slate-400 hover:text-white"
                      title="Copy IP"
                    >
                      {copiedField === 'Public IP' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">User Name</span>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-blue-400 font-bold">Administrator</span>
                    <button
                      onClick={() => handleCopy('Administrator', 'Username')}
                      className="p-1 text-slate-400 hover:text-white"
                      title="Copy Username"
                    >
                      {copiedField === 'Username' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Password Decryption Section */}
              <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-white flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-amber-400" />
                    <span>Get Windows Administrator Password</span>
                  </label>
                  <label className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-semibold cursor-pointer flex items-center gap-1">
                    <Upload className="w-3 h-3 text-blue-400" />
                    <span>Upload PEM File</span>
                    <input type="file" accept=".pem,.txt" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>

                <textarea
                  rows={3}
                  value={pemKey}
                  onChange={(e) => setPemKey(e.target.value)}
                  placeholder="Paste contents of your private key file (.pem)..."
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono text-[11px] focus:outline-none focus:border-blue-500"
                />

                <button
                  onClick={handleDecryptPassword}
                  disabled={loadingPassword}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-lg shadow flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <Key className={`w-4 h-4 ${loadingPassword ? 'animate-spin' : ''}`} />
                  <span>{loadingPassword ? 'Decrypting via AWS EC2 API...' : 'Decrypt Windows Password'}</span>
                </button>

                {/* Password Result or Error */}
                {windowsPassword && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <Unlock className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div className="flex flex-col">
                        <span className="text-[10px] text-emerald-300 uppercase font-bold">Decrypted Password</span>
                        <code className="text-xs font-bold text-white tracking-widest font-mono">
                          {showPassword ? windowsPassword : '••••••••••••••••'}
                        </code>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => setShowPassword(!showPassword)}
                        className="p-1.5 text-slate-400 hover:text-white bg-slate-900 rounded border border-slate-800"
                        title={showPassword ? 'Hide Password' : 'Show Password'}
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => handleCopy(windowsPassword, 'Password')}
                        className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-[11px] flex items-center gap-1"
                      >
                        {copiedField === 'Password' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedField === 'Password' ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {passwordError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-xs flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{passwordError}</span>
                  </div>
                )}
              </div>

              {/* RDP File Download Button */}
              <div className="pt-2">
                <button
                  onClick={handleDownloadRdp}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Download RDP Connection File</span>
                </button>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
            <button
              onClick={handleOpenAwsConsole}
              className="text-slate-400 hover:text-white flex items-center gap-1.5 font-bold cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
              <span>Open AWS EC2 Console</span>
            </button>

            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 rounded-lg font-bold cursor-pointer"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default EC2ConnectModal;
