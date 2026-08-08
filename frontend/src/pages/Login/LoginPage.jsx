import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Cloud, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export const LoginPage = () => {
  const navigate = useNavigate();
  const { user, login } = useAuth();
  const { showToast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('access_token') || localStorage.getItem('authToken');
    if (user && token) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);

    const res = await login(email, password);
    setIsSubmitting(false);

    if (res.success) {
      showToast('Login Successful', 'success');
      showToast(`Welcome back, ${res.user.name}!`, 'info');
      navigate('/dashboard');
    } else {
      setErrorMsg(res.error);
      showToast(res.error || 'Invalid email or password.', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center p-4 font-mono-tabular select-none">
      <div className="w-full max-w-md bg-[#111827] border border-slate-800 rounded-xl p-8 shadow-2xl space-y-6">
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-3">
            <Cloud className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">CloudOps Enterprise</h1>
          <p className="text-xs text-slate-400 mt-1">Multi-User Cloud Operations Management</p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 mb-1 font-semibold">Work Email Address</label>
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
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-300 font-semibold">Password</label>
              <Link to="/reset-password" className="text-[11px] text-blue-400 hover:underline">
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-md text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono-tabular select-text"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 shadow-lg transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            <span>Authenticate to Dashboard</span>
          </button>
        </form>

        <div className="text-center pt-2 border-t border-slate-800/80 text-[11px] text-slate-500">
          Need an account?{' '}
          <Link to="/register" className="text-blue-400 hover:underline">
            Register Here
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
