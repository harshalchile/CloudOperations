import React, { useState, useEffect } from 'react';
import { X, Server, Check, ArrowRight, ArrowLeft, Loader2, Cpu, HardDrive, Globe, Layers, Key, Plus, AlertTriangle, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';

export const EC2LaunchWizard = ({ isOpen, onClose, onLaunch, isSubmitting, selectedAccountId, awsAccounts }) => {
  const [currentStep, setCurrentStep] = useState(1);

  // Form State
  const [serverName, setServerName] = useState('web-app-server-01');
  const [osType, setOsType] = useState('Ubuntu');
  const [serverSize, setServerSize] = useState('Small (Free Tier)');
  const [storageGb, setStorageGb] = useState(20);
  const [region, setRegion] = useState('ap-south-1');
  const [targetAccountId, setTargetAccountId] = useState('');

  // Key Pairs State
  const [keyPairs, setKeyPairs] = useState([]);
  const [selectedKeyName, setSelectedKeyName] = useState('');
  const [loadingKeyPairs, setLoadingKeyPairs] = useState(false);

  // Create Key Pair Modal
  const [isCreateKeyOpen, setIsCreateKeyOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [isCreatingKey, setIsCreatingKey] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      setServerName('web-app-server-01');
      setOsType('Ubuntu');
      setServerSize('Small (Free Tier)');
      setStorageGb(20);
      setRegion('ap-south-1');
      setSelectedKeyName('');
      setIsCreateKeyOpen(false);
      setNewKeyName('');

      if (selectedAccountId && selectedAccountId !== 'all') {
        setTargetAccountId(String(selectedAccountId));
      } else if (awsAccounts && awsAccounts.length > 0) {
        setTargetAccountId(String(awsAccounts[0].id));
      }
    }
  }, [isOpen, selectedAccountId, awsAccounts]);

  const fetchKeyPairs = async () => {
    if (!isOpen) return;
    setLoadingKeyPairs(true);
    try {
      const headers = {};
      const accId = selectedAccountId === 'all' ? targetAccountId : (targetAccountId || selectedAccountId);
      if (accId) {
        headers['X-AWS-Account-ID'] = accId;
      }
      const res = await api.get(`/ec2/key-pairs?region=${region}`, { headers });
      if (res.data && res.data.key_pairs) {
        setKeyPairs(res.data.key_pairs);
        if (res.data.key_pairs.length > 0 && !selectedKeyName) {
          setSelectedKeyName(res.data.key_pairs[0].key_name);
        }
      }
    } catch (err) {
      console.error('Failed to fetch key pairs:', err);
    } finally {
      setLoadingKeyPairs(false);
    }
  };

  useEffect(() => {
    fetchKeyPairs();
  }, [isOpen, region, targetAccountId]);

  if (!isOpen) return null;

  const steps = [
    { id: 1, title: 'Server Name' },
    { id: 2, title: 'Operating System' },
    { id: 3, title: 'Server Size & Key Pair' },
    { id: 4, title: 'Storage (GB)' },
    { id: 5, title: 'Region & Account' },
    { id: 6, title: 'Review & Launch' },
  ];

  const handleCreateKeyPairSubmit = async (e) => {
    e.preventDefault();
    if (!newKeyName.trim() || isCreatingKey) return;

    setIsCreatingKey(true);
    try {
      const headers = {};
      const accId = selectedAccountId === 'all' ? targetAccountId : (targetAccountId || selectedAccountId);
      if (accId) {
        headers['X-AWS-Account-ID'] = accId;
      }
      const res = await api.post('/ec2/key-pairs', { key_name: newKeyName.trim(), region: 'ap-south-1' }, { headers });
      if (res.status === 201 && res.data && res.data.key_material) {
        // Automatically download private key .pem file
        const blob = new Blob([res.data.key_material], { type: 'application/x-pem-file' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${res.data.key_name}.pem`;
        a.click();
        URL.revokeObjectURL(url);

        setSelectedKeyName(res.data.key_name);
        setIsCreateKeyOpen(false);
        setNewKeyName('');
        await fetchKeyPairs();
      }
    } catch (err) {
      console.error('Create key pair failed:', err);
    } finally {
      setIsCreatingKey(false);
    }
  };

  const handleNext = () => {
    if (currentStep < 6) setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    console.log("[EC2 LAUNCH] Launch button clicked");
    onLaunch({
      name: serverName.trim(),
      server_name: serverName.trim(),
      os_type: osType,
      operating_system: osType,
      instance_size: serverSize,
      instance_type: serverSize,
      storage_gb: storageGb,
      storage_size: storageGb,
      region: 'ap-south-1',
      key_name: selectedKeyName || null,
      key_pair: selectedKeyName || null,
      account_id: selectedAccountId === 'all' ? targetAccountId : (targetAccountId || selectedAccountId)
    });
  };

  const selectedAccObj = awsAccounts?.find(a => String(a.id) === String(targetAccountId)) || awsAccounts?.[0];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-none font-mono-tabular">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.15 }}
          className="w-full max-w-xl bg-[#0d121f] border border-slate-800 rounded-xl p-6 shadow-2xl space-y-5 relative"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <Server className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Launch New EC2 Server</h3>
                <span className="text-[10px] text-slate-400">
                  Step {currentStep} of 6: {steps[currentStep - 1].title}
                </span>
              </div>
            </div>
            <button onClick={onClose} disabled={isSubmitting} className="p-1 text-slate-500 hover:text-slate-200 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Stepper Progress Bar */}
          <div className="grid grid-cols-6 gap-1.5">
            {steps.map((step) => (
              <div
                key={step.id}
                className={`h-1.5 rounded-full transition-colors ${
                  step.id <= currentStep ? 'bg-blue-500' : 'bg-slate-800'
                }`}
              />
            ))}
          </div>

          {/* Step Contents */}
          <form onSubmit={handleSubmit} className="space-y-4 py-2 min-h-[250px] flex flex-col justify-between">
            {/* STEP 1: Server Name */}
            {currentStep === 1 && (
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-200">
                  Give your server a friendly name tag:
                </label>
                <input
                  type="text"
                  required
                  value={serverName}
                  onChange={(e) => setServerName(e.target.value)}
                  placeholder="e.g. web-app-server-01"
                  autoFocus
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 text-xs font-mono-tabular select-text"
                />
                <p className="text-[11px] text-slate-500">
                  This name will be saved as the AWS EC2 <code className="text-blue-400">Name</code> tag.
                </p>
              </div>
            )}

            {/* STEP 2: Operating System (Linux Only) */}
            {currentStep === 2 && (
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-200">
                  Select an Operating System (AMI in ap-south-1):
                </label>

                <div className="grid grid-cols-1 gap-2 text-xs">
                  {[
                    { name: 'Ubuntu', badge: 'Default / Recommended', desc: 'Ubuntu 22.04 LTS Server (Official Canonical Owner 099720109477)' },
                    { name: 'Amazon Linux', badge: 'Amazon OS', desc: 'Amazon Linux 2023 AMI (x86_64)' },
                  ].map((os) => (
                    <button
                      key={os.name}
                      type="button"
                      onClick={() => setOsType(os.name)}
                      className={`p-3 rounded-lg border text-left flex items-center justify-between transition-colors cursor-pointer ${
                        osType === os.name
                          ? 'bg-blue-600/15 border-blue-500 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{os.name}</span>
                          <span className="px-1.5 py-0.5 text-[9px] bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded font-medium">
                            {os.badge}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 block mt-0.5">{os.desc}</span>
                      </div>
                      {osType === os.name && <Check className="w-4 h-4 text-blue-400 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 3: Server Size & Key Pair */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-200">
                    Select Server Size (Instance Type):
                  </label>
                  <div className="grid grid-cols-1 gap-2 text-xs">
                    {[
                      { name: 'Small (Free Tier)', vcpu: '1 vCPU', ram: '1 GiB RAM', instance: 't2.micro', free: true },
                      { name: 'Medium', vcpu: '2 vCPUs', ram: '4 GiB RAM', instance: 't3.medium', free: false },
                      { name: 'Large', vcpu: '4 vCPUs', ram: '8 GiB RAM', instance: 'c5.xlarge', free: false },
                    ].map((sz) => (
                      <button
                        key={sz.name}
                        type="button"
                        onClick={() => setServerSize(sz.name)}
                        className={`p-2.5 rounded-lg border text-left flex items-center justify-between transition-colors cursor-pointer ${
                          serverSize === sz.name
                            ? 'bg-blue-600/15 border-blue-500 text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{sz.name}</span>
                            {sz.free && (
                              <span className="px-1.5 py-0.5 text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded font-medium">
                                Free Tier
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400 block mt-0.5">
                            {sz.vcpu} • {sz.ram} ({sz.instance})
                          </span>
                        </div>
                        {serverSize === sz.name && <Check className="w-4 h-4 text-blue-400 shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Key Pair Section */}
                <div className="pt-3 border-t border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-amber-400" />
                      <span>AWS Key Pair (Optional for SSH Access):</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => setIsCreateKeyOpen(true)}
                      className="text-[11px] text-blue-400 hover:underline flex items-center gap-1 font-bold cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> Create New Key Pair
                    </button>
                  </div>

                  {loadingKeyPairs ? (
                    <div className="p-2.5 bg-slate-900 border border-slate-800 rounded text-slate-400 text-xs flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" /> Loading Key Pairs from AWS...
                    </div>
                  ) : keyPairs.length > 0 ? (
                    <select
                      value={selectedKeyName}
                      onChange={(e) => setSelectedKeyName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-slate-100 text-xs focus:outline-none focus:border-blue-500 font-mono cursor-pointer"
                    >
                      <option value="">-- Proceed Without Key Pair --</option>
                      {keyPairs.map((kp) => (
                        <option key={kp.key_name} value={kp.key_name}>
                          {kp.key_name} ({kp.key_type.toUpperCase()})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-2.5 bg-slate-900 border border-slate-800 rounded text-slate-400 text-[11px] flex items-center justify-between">
                      <span>No Key Pairs found in ap-south-1.</span>
                      <button
                        type="button"
                        onClick={() => setIsCreateKeyOpen(true)}
                        className="px-2 py-1 bg-blue-600 text-white rounded text-[10px] font-bold cursor-pointer"
                      >
                        Create Key Pair Now
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STEP 4: Storage */}
            {currentStep === 4 && (
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-200">
                  Root EBS Volume Storage Size (GB):
                </label>

                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="8"
                    max="100"
                    value={storageGb}
                    onChange={(e) => setStorageGb(parseInt(e.target.value) || 8)}
                    className="w-32 px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500 text-xs font-mono-tabular select-text"
                  />
                  <span className="text-xs text-slate-400">GB (gp3 General Purpose SSD)</span>
                </div>

                <div className="p-3 bg-slate-900/60 border border-slate-800 rounded text-[11px] text-slate-400 space-y-1">
                  <p>• Default Linux root volume size is 8 GB - 20 GB.</p>
                  <p>• High-performance gp3 SSD volume attached with DeleteOnTermination.</p>
                </div>
              </div>
            )}

            {/* STEP 5: Region & Target Account */}
            {currentStep === 5 && (
              <div className="space-y-4">
                {selectedAccountId === 'all' && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg space-y-1.5">
                    <label className="block text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5" /> Destination AWS Account Required:
                    </label>
                    <p className="text-[11px] text-amber-200/80">
                      You currently have "All Accounts" selected scope. Please select which AWS account should host this new EC2 instance:
                    </p>
                    <select
                      value={targetAccountId}
                      onChange={(e) => setTargetAccountId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-amber-500/40 rounded text-slate-100 text-xs focus:outline-none focus:border-amber-400 font-bold cursor-pointer"
                    >
                      {awsAccounts && awsAccounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.account_name} ({acc.account_id || 'N/A'}) - {acc.region}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-200">
                    Deployment Region (Enforced):
                  </label>

                  <div className="p-3 rounded-lg border border-blue-500 bg-blue-600/15 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-blue-400" />
                      <span className="font-bold">Mumbai (ap-south-1)</span>
                    </div>
                    <Check className="w-4 h-4 text-blue-400 shrink-0" />
                  </div>
                  <p className="text-[11px] text-slate-500">
                    All virtual servers are launched directly in the primary Mumbai region.
                  </p>
                </div>
              </div>
            )}

            {/* STEP 6: Review & Launch */}
            {currentStep === 6 && (
              <div className="space-y-3">
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg text-xs space-y-2.5">
                  <h4 className="font-bold text-white uppercase text-[10px] tracking-wider border-b border-slate-800 pb-1.5">
                    Server Launch Summary
                  </h4>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Server Name:</span>
                    <strong className="text-white font-mono">{serverName}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Operating System:</span>
                    <strong className="text-white">{osType} (ap-south-1)</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Server Size:</span>
                    <strong className="text-white">{serverSize}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Key Pair:</span>
                    <strong className={selectedKeyName ? "text-emerald-400 font-mono" : "text-amber-400"}>
                      {selectedKeyName || 'None (Proceeding without Key Pair)'}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Storage Volume:</span>
                    <strong className="text-white">{storageGb} GB gp3 SSD</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Deployment Region:</span>
                    <strong className="text-blue-400">ap-south-1 (Mumbai)</strong>
                  </div>
                  {selectedAccObj && (
                    <div className="flex justify-between border-t border-slate-800 pt-2 text-amber-300 font-bold">
                      <span>Target Account:</span>
                      <span>{selectedAccObj.account_name} ({selectedAccObj.account_id || selectedAccObj.region || 'ap-south-1'})</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Navigation Footer Controls */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={handleBack}
                disabled={currentStep === 1 || isSubmitting}
                className="px-3.5 py-2 bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 rounded-lg font-semibold flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>

              {currentStep < 6 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold shadow flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <span>Next Step</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold shadow flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Launching...</span>
                    </>
                  ) : (
                    <>
                      <Server className="w-4 h-4" />
                      <span>Launch Server</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </form>

          {/* CREATE KEY PAIR INNER MODAL */}
          {isCreateKeyOpen && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="w-full max-w-md bg-[#0d121f] border border-slate-800 rounded-xl p-5 shadow-2xl space-y-4 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <h4 className="font-bold text-white flex items-center gap-2">
                    <Key className="w-4 h-4 text-amber-400" />
                    Create New RSA Key Pair
                  </h4>
                  <button onClick={() => setIsCreateKeyOpen(false)} className="text-slate-400 hover:text-slate-200 cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleCreateKeyPairSubmit} className="space-y-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Key Pair Name:</label>
                    <input
                      type="text"
                      required
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder="e.g. devops-key-pair"
                      autoFocus
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-slate-100 focus:outline-none focus:border-blue-500 font-mono select-text"
                    />
                  </div>

                  <p className="text-[11px] text-slate-400">
                    Creating a key pair generates a 2048-bit RSA private key in ap-south-1. The private key <code className="text-amber-400">.pem</code> file will download to your machine automatically.
                  </p>

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsCreateKeyOpen(false)}
                      className="px-3.5 py-1.5 bg-slate-900 border border-slate-800 text-slate-300 rounded font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isCreatingKey}
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {isCreatingKey && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Create & Download Key</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
