import React, { useState } from 'react';
import { ShieldAlert, X, AlertTriangle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Destructive Action',
  description = 'Are you sure you want to proceed? This action cannot be undone.',
  resourceName,
  confirmButtonText = 'Confirm Delete',
  requireInputMatch = false,
  variant = 'danger', // 'danger' | 'warning'
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const isMatch = requireInputMatch ? inputValue.trim() === resourceName : true;

  const handleConfirm = async () => {
    if (!isMatch || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onConfirm();
    } finally {
      setIsSubmitting(false);
      setInputValue('');
      onClose();
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-none font-mono-tabular">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.15 }}
          className="w-full max-w-md bg-[#0d121f] border border-slate-800 rounded-lg p-6 shadow-2xl space-y-4"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-lg border ${
                  variant === 'danger'
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                }`}
              >
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">{title}</h3>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                  Irreversible Action
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1 text-slate-500 hover:text-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-3 rounded border border-slate-800 space-y-2">
            <p>{description}</p>
            {resourceName && (
              <p className="font-semibold text-white">
                Resource: <code className="text-rose-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">{resourceName}</code>
              </p>
            )}
          </div>

          {/* Required Match Input */}
          {requireInputMatch && (
            <div className="space-y-1.5 text-xs">
              <label className="block text-slate-400">
                To confirm, type <strong className="text-white">{resourceName}</strong> below:
              </label>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={resourceName}
                autoFocus
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-slate-100 placeholder-slate-600 focus:outline-none focus:border-rose-500/80 font-mono-tabular"
              />
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-2 text-xs">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 bg-slate-900 border border-slate-800 text-slate-300 rounded hover:bg-slate-800 font-semibold transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!isMatch || isSubmitting}
              className={`px-4 py-2 rounded text-white font-semibold shadow transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed ${
                variant === 'danger'
                  ? 'bg-rose-600 hover:bg-rose-500'
                  : 'bg-amber-600 hover:bg-amber-500'
              }`}
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{confirmButtonText}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
