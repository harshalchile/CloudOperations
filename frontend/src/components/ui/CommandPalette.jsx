import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Server, HardDrive, Activity, DollarSign, Settings, User, ShieldAlert, X, Terminal, ArrowRight } from 'lucide-react';

export const CommandPalette = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          // Open handled by parent or state
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const commands = [
    { id: 'dash', title: 'Go to Overview Dashboard', category: 'Navigation', icon: Activity, path: '/dashboard' },
    { id: 'ec2', title: 'Go to EC2 Compute Fleet', category: 'Navigation', icon: Server, path: '/ec2' },
    { id: 's3', title: 'Go to S3 Storage Buckets', category: 'Navigation', icon: HardDrive, path: '/s3' },
    { id: 'cloudwatch', title: 'Go to CloudWatch Telemetry', category: 'Navigation', icon: ShieldAlert, path: '/cloudwatch' },
    { id: 'reports', title: 'Go to FinOps & Cost Reports', category: 'Navigation', icon: DollarSign, path: '/reports' },
    { id: 'profile', title: 'Go to Team & IAM Access', category: 'Navigation', icon: User, path: '/profile' },
    { id: 'settings', title: 'Go to Cloud Integrations & Settings', category: 'Navigation', icon: Settings, path: '/settings' },
    
    // Quick Actions
    { id: 'act-launch', title: 'Quick Launch EC2 i-04a91b2c', category: 'Instance Actions', icon: Terminal, action: () => navigate('/ec2?action=launch') },
    { id: 'act-bucket', title: 'Create S3 Storage Bucket', category: 'Storage Actions', icon: HardDrive, action: () => navigate('/s3?action=create') },
    { id: 'act-logs', title: 'Stream CloudWatch Logs', category: 'Observability', icon: Activity, action: () => navigate('/cloudwatch?tab=logs') },
  ];

  const filteredCommands = commands.filter((cmd) =>
    cmd.title.toLowerCase().includes(query.toLowerCase()) ||
    cmd.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (cmd) => {
    onClose();
    if (cmd.path) {
      navigate(cmd.path);
    } else if (cmd.action) {
      cmd.action();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center pt-20 px-4">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Input Bar */}
        <div className="flex items-center px-4 py-3 border-b border-slate-800 gap-3">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Type a command or search resources... (ESC to close)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
            autoFocus
          />
          <button onClick={onClose} className="p-1 text-slate-500 hover:text-slate-300">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Command List */}
        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-slate-800/40">
          {filteredCommands.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500">
              No matching resources or commands found.
            </div>
          ) : (
            filteredCommands.map((cmd) => {
              const Icon = cmd.icon;
              return (
                <button
                  key={cmd.id}
                  onClick={() => handleSelect(cmd)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-md hover:bg-slate-800/80 text-left group transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 text-blue-400 group-hover:text-blue-300" />
                    <div>
                      <div className="text-xs font-medium text-slate-200 group-hover:text-white">
                        {cmd.title}
                      </div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider font-mono-tabular">
                        {cmd.category}
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-300 transition-transform group-hover:translate-x-0.5" />
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-300">↑↓</span>
            <span>Navigate</span>
            <span className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-300">↵</span>
            <span>Select</span>
          </div>
          <span>CloudOps Enterprise CLI</span>
        </div>
      </div>
    </div>
  );
};
