import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cloud, ArrowRight, ShieldCheck, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export const RegisterPage = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      showToast('Passwords do not match.', 'warning');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      showToast('Password must be at least 6 characters.', 'warning');
      return;
    }

    setIsSubmitting(true);
    const res = await register(name, email, password, confirmPassword);
    setIsSubmitting(false);

    if (res.success) {
      showToast(`Account created! Welcome, ${res.user.name}.`);
      navigate('/dashboard');
    } else {
      setErrorMsg(res.error);
      showToast(res.error, 'error');
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center p-4 font-mono-tabular select-none">
      <div className="w-full max-w-md bg-[#111827] border border-slate-800 rounded-xl p-8 shadow-2xl space-y-6">
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-3">
            <Cloud className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">CloudOps Registration</h1>
          <p className="text-xs text-slate-400 mt-1">Multi-User Cloud Management Platform (Phase 1)</p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded text-xs">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 mb-1 font-semibold">Full Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Harsh Ops"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-md text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono-tabular"
            />
          </div>

          <div>
            <label className="block text-slate-300 mb-1 font-semibold">Work Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@company.com"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-md text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono-tabular"
            />
          </div>

          <div>
            <label className="block text-slate-300 mb-1 font-semibold">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-md text-slate-100 focus:outline-none focus:border-blue-500 font-mono-tabular"
            />
          </div>

          <div>
            <label className="block text-slate-300 mb-1 font-semibold">Confirm Password</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-md text-slate-100 focus:outline-none focus:border-blue-500 font-mono-tabular"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 shadow-lg transition-colors disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            <span>Register Account</span>
          </button>
        </form>

        <div className="text-center pt-2 border-t border-slate-800/80 text-[11px] text-slate-500">
          Already registered?{' '}
          <button onClick={() => navigate('/login')} className="text-blue-400 hover:underline">
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
};
