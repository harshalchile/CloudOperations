import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cloud, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Hero3DPreview } from './Hero3DPreview';

export const LandingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const token = localStorage.getItem('authToken');

  useEffect(() => {
    if (user && token) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, token, navigate]);

  const handleLaunchClick = () => {
    if (user && token) {
      navigate('/dashboard');
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 font-mono-tabular selection:bg-blue-500/30 selection:text-blue-200 select-none">
      {/* Header */}
      <header className="h-16 px-6 border-b border-slate-800/80 max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Cloud className="w-4 h-4" />
          </div>
          <span className="font-bold text-sm tracking-wide text-white">CloudOps Platform</span>
        </div>

        <div className="flex items-center gap-4 text-xs font-semibold">
          <button onClick={() => navigate('/login')} className="text-slate-300 hover:text-white transition-colors cursor-pointer">
            Sign In
          </button>
          <button
            onClick={handleLaunchClick}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md shadow transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span>Launch Platform</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-6 max-w-5xl mx-auto text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-xs text-blue-400 font-medium">
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
          Next-Gen Cloud Management Platform v3.4 Active
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight leading-tight">
          Unified Telemetry & Compute Control for Modern Cloud Fleet
        </h1>

        <p className="text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
          High-performance enterprise observability, EC2 compute management, S3 object storage security, and automated CloudWatch metrics monitoring.
        </p>

        <div className="flex items-center justify-center gap-4 pt-4">
          <button
            onClick={handleLaunchClick}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold text-xs shadow-xl flex items-center gap-2 transition-all transform hover:scale-105 cursor-pointer"
          >
            <span>{user && token ? 'Open Dashboard' : 'Sign In to Launch Platform'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* 3D Hero Preview Window */}
      <Hero3DPreview />

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8 px-6 text-center text-xs text-slate-500">
        © 2026 CloudOps Systems Inc. Commercial Enterprise Platform.
      </footer>
    </div>
  );
};

export default LandingPage;
