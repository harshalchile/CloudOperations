import React, { useState } from 'react';
import { X, Server, Check, ArrowRight, ArrowLeft, Loader2, Cpu, HardDrive, Globe, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const EC2LaunchWizard = ({ isOpen, onClose, onLaunch, isSubmitting }) => {
  const [currentStep, setCurrentStep] = useState(1);

  // Form State
  const [serverName, setServerName] = useState('web-app-server-01');
  const [osType, setOsType] = useState('Amazon Linux');
  const [showMoreOs, setShowMoreOs] = useState(false);
  const [serverSize, setServerSize] = useState('Small (Free Tier)');
  const [storageGb, setStorageGb] = useState(8);
  const [region, setRegion] = useState('ap-south-1');

  if (!isOpen) return null;

  const steps = [
    { id: 1, title: 'Server Name' },
    { id: 2, title: 'Operating System' },
    { id: 3, title: 'Server Size' },
    { id: 4, title: 'Storage (GB)' },
    { id: 5, title: 'Region' },
    { id: 6, title: 'Review & Launch' },
  ];

  const handleNext = () => {
    if (currentStep < 6) setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onLaunch({
      name: serverName,
      os_type: osType,
      instance_size: serverSize,
      storage_gb: storageGb,
      region,
    });
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-none font-mono-tabular">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.15 }}
          className="w-full max-w-xl bg-[#0d121f] border border-slate-800 rounded-xl p-6 shadow-2xl space-y-5"
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
            <button onClick={onClose} disabled={isSubmitting} className="p-1 text-slate-500 hover:text-slate-200">
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
          <form onSubmit={handleSubmit} className="space-y-4 py-2 min-h-[220px] flex flex-col justify-between">
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
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 text-xs font-mono-tabular"
                />
                <p className="text-[11px] text-slate-500">
                  This name will be saved as the AWS EC2 <code className="text-blue-400">Name</code> tag.
                </p>
              </div>
            )}

            {/* STEP 2: Operating System */}
            {currentStep === 2 && (
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-200">
                  Select an Operating System (AMI):
                </label>

                <div className="grid grid-cols-1 gap-2 text-xs">
                  {[
                    { name: 'Amazon Linux', badge: 'Recommended', desc: 'Amazon Linux 2023 AMI (x86_64)' },
                    { name: 'Ubuntu', badge: 'Popular', desc: 'Ubuntu 22.04 LTS Server' },
                    { name: 'Windows Server', badge: 'Enterprise', desc: 'Windows Server 2022 Base' },
                  ].map((os) => (
                    <button
                      key={os.name}
                      type="button"
                      onClick={() => setOsType(os.name)}
                      className={`p-3 rounded-lg border text-left flex items-center justify-between transition-colors ${
                        osType === os.name
                          ? 'bg-blue-600/15 border-blue-500 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{os.name}</span>
                          <span className="px-1.5 py-0.2 text-[9px] bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded font-medium">
                            {os.badge}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 block mt-0.5">{os.desc}</span>
                      </div>
                      {osType === os.name && <Check className="w-4 h-4 text-blue-400 shrink-0" />}
                    </button>
                  ))}

                  {showMoreOs && (
                    <button
                      type="button"
                      onClick={() => setOsType('Red Hat Enterprise')}
                      className={`p-3 rounded-lg border text-left flex items-center justify-between transition-colors ${
                        osType === 'Red Hat Enterprise'
                          ? 'bg-blue-600/15 border-blue-500 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div>
                        <span className="font-bold">Red Hat Enterprise</span>
                        <span className="text-[11px] text-slate-400 block mt-0.5">RHEL 9 Server</span>
                      </div>
                      {osType === 'Red Hat Enterprise' && <Check className="w-4 h-4 text-blue-400 shrink-0" />}
                    </button>
                  )}
                </div>

                {!showMoreOs && (
                  <button
                    type="button"
                    onClick={() => setShowMoreOs(true)}
                    className="text-[11px] text-blue-400 hover:underline pt-1 block"
                  >
                    + Show More Operating Systems
                  </button>
                )}
              </div>
            )}

            {/* STEP 3: Server Size */}
            {currentStep === 3 && (
              <div className="space-y-3">
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
                      className={`p-3 rounded-lg border text-left flex items-center justify-between transition-colors ${
                        serverSize === sz.name
                          ? 'bg-blue-600/15 border-blue-500 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{sz.name}</span>
                          {sz.free && (
                            <span className="px-1.5 py-0.2 text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded font-medium">
                              Free Tier Eligible
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
                    className="w-32 px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500 text-xs font-mono-tabular"
                  />
                  <span className="text-xs text-slate-400">GB (gp3 General Purpose SSD)</span>
                </div>

                <div className="p-3 bg-slate-900/60 border border-slate-800 rounded text-[11px] text-slate-400 space-y-1">
                  <p>• Default Linux root volume size is 8 GB.</p>
                  <p>• Amazon EC2 Free Tier includes 30 GB of EBS storage.</p>
                </div>
              </div>
            )}

            {/* STEP 5: Region */}
            {currentStep === 5 && (
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-200">
                  Select Deployment Region:
                </label>

                <div className="grid grid-cols-1 gap-2 text-xs">
                  {[
                    { name: 'ap-south-1', label: 'Mumbai (ap-south-1)' },
                    { name: 'ap-southeast-1', label: 'Singapore (ap-southeast-1)' },
                    { name: 'us-east-1', label: 'Virginia (us-east-1)' },
                  ].map((reg) => (
                    <button
                      key={reg.name}
                      type="button"
                      onClick={() => setRegion(reg.name)}
                      className={`p-3 rounded-lg border text-left flex items-center justify-between transition-colors ${
                        region === reg.name
                          ? 'bg-blue-600/15 border-blue-500 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-blue-400" />
                        <span className="font-bold">{reg.label}</span>
                      </div>
                      {region === reg.name && <Check className="w-4 h-4 text-blue-400 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 6: Review & Launch */}
            {currentStep === 6 && (
              <div className="space-y-3">
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg text-xs space-y-2">
                  <h4 className="font-bold text-white uppercase text-[10px] tracking-wider border-b border-slate-800 pb-1">
                    Server Launch Summary
                  </h4>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Server Name:</span>
                    <strong className="text-white">{serverName}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Operating System:</span>
                    <strong className="text-white">{osType}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Server Size:</span>
                    <strong className="text-white">{serverSize}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Storage Volume:</span>
                    <strong className="text-white">{storageGb} GB gp3 SSD</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Deployment Region:</span>
                    <strong className="text-blue-400">{region}</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Footer Controls */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={handleBack}
                disabled={currentStep === 1 || isSubmitting}
                className="px-3.5 py-2 bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 rounded-lg font-semibold flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>

              {currentStep < 6 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold shadow flex items-center gap-1"
                >
                  <span>Next Step</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold shadow flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Server className="w-4 h-4" />}
                  <span>Launch Server</span>
                </button>
              )}
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
