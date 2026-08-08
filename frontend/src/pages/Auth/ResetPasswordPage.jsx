import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Cloud, Key, ArrowRight, ShieldCheck, Loader2, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const { resetPassword } = useAuth();
  const { showToast } = useToast();

  const [email, setEmail] = useState('');
  const [masterKey, setMasterKey] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      showToast('Passwords do not match.', 'warning');
      return;
    }

    if (newPassword.length < 6) {
      setErrorMsg('New password must be at least 6 characters long.');
      showToast('New password must be at least 6 characters.', 'warning');
      return;
    }

    setIsSubmitting(true);
    const res = await resetPassword(email, masterKey, newPassword, confirmPassword);
    setIsSubmitting(false);

    if (res.success) {
      showToast('Password Updated Successfully', 'success');
      showToast(res.message || 'Please sign in with your new password.', 'info');
      navigate('/login');
    } else {
      setErrorMsg(res.error);
      showToast(res.error, 'error');
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center p-4 font-mono-tabular select-none">
      <div className="w-full max-w-md bg-[#111827] border border-slate-800 rounded-xl p-8 shadow-2xl space-y-6">
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-xl bg-amber-600/20 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3">
            <Key className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Reset Account Password</h1>
          <p className="text-xs text-slate-400 mt-1">Enter your registered email and Master Reset Key</p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 mb-1 font-semibold">Registered Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-md text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono-tabular select-text"
            />
          </div>

          <div>
            <label className="block text-slate-300 mb-1 font-semibold flex items-center justify-between">
              <span>Master Reset Key</span>
              <span className="text-[10px] text-amber-400 font-mono">Demo Mode Required</span>
            </label>
            <input
              type="password"
              required
              value={masterKey}
              onChange={(e) => setMasterKey(e.target.value)}
              placeholder="Enter Master Reset Key"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-md text-slate-100 focus:outline-none focus:border-amber-500 font-mono-tabular select-text"
            />
          </div>

          <div>
            <label className="block text-slate-300 mb-1 font-semibold">New Password</label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-md text-slate-100 focus:outline-none focus:border-blue-500 font-mono-tabular select-text"
            />
          </div>

          <div>
            <label className="block text-slate-300 mb-1 font-semibold">Confirm New Password</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-md text-slate-100 focus:outline-none focus:border-blue-500 font-mono-tabular select-text"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 shadow-lg transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            <span>Reset Password & Update DB</span>
          </button>
        </form>

        <div className="text-center pt-2 border-t border-slate-800/80 text-[11px] text-slate-500">
          <Link to="/login" className="text-blue-400 hover:underline inline-flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" /> Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
