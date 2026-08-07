import React, { useState, useRef, useEffect } from 'react';
import { Server, Activity, DollarSign, Lock, RefreshCw, ChevronLeft, ChevronRight, Search, Shield, Zap, Sparkles } from 'lucide-react';
import './Hero3DPreview.css';

export const Hero3DPreview = () => {
  const containerRef = useRef(null);
  const [rotate, setRotate] = useState({ x: 4, y: -6 });
  const [isHovered, setIsHovered] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // Smooth mouse parallax tilt calculation using rAF
  const handleMouseMove = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const mouseX = e.clientX - centerX;
    const mouseY = e.clientY - centerY;

    // Maximum tilt angles (degrees)
    const rotateXValue = (mouseY / (rect.height / 2)) * -10;
    const rotateYValue = (mouseX / (rect.width / 2)) * 10;

    setRotate({
      x: Math.max(-15, Math.min(15, rotateXValue)),
      y: Math.max(-15, Math.min(15, rotateYValue))
    });
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    // Smooth reset back to subtle natural angle
    setRotate({ x: 4, y: -6 });
  };

  return (
    <section 
      className="relative px-6 max-w-6xl mx-auto pb-24 perspective-1200 overflow-visible"
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Background Ambient Lights & Glowing Effects */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        {/* Dark Radial Gradients */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-blue-600/15 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 left-1/4 w-[400px] h-[300px] bg-indigo-500/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-10 right-1/4 w-[450px] h-[350px] bg-cyan-500/10 rounded-full blur-[110px]" />
        
        {/* Animated Grid Lines */}
        <div className="absolute inset-0 hero-grid-bg opacity-30 mask-gradient" />

        {/* Small 3D Floating Particles */}
        <div className="absolute top-10 left-[15%] w-2 h-2 rounded-full bg-blue-400/40 blur-[1px] animate-[float-particle_7s_infinite_linear]" />
        <div className="absolute top-1/3 right-[12%] w-3 h-3 rounded-full bg-indigo-400/30 blur-[1px] animate-[float-particle_9s_infinite_linear_2s]" />
        <div className="absolute bottom-20 left-[20%] w-2.5 h-2.5 rounded-full bg-cyan-400/40 blur-[1px] animate-[float-particle_8s_infinite_linear_4s]" />
        <div className="absolute top-1/2 right-[25%] w-1.5 h-1.5 rounded-full bg-sky-300/50 blur-[0.5px] animate-[float-particle_6s_infinite_linear_1s]" />
      </div>

      {/* 3D Wrapper */}
      <div
        ref={containerRef}
        className="w-full preserve-3d transition-transform duration-300 ease-out cursor-pointer"
        style={{
          transform: `rotateX(${rotate.x}deg) rotateY(${rotate.y}deg) ${isHovered ? 'scale3d(1.02, 1.02, 1.02)' : 'scale3d(1, 1, 1)'}`,
        }}
      >
        {/* Floating Outer Glass Container (Browser Window) */}
        <div className="relative rounded-[20px] glass-browser-window overflow-hidden preserve-3d group">
          
          {/* Animated Edge Glow */}
          <div className="absolute -inset-[1px] rounded-[20px] bg-gradient-to-r from-blue-500/20 via-indigo-500/30 to-cyan-500/20 pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity duration-500" />
          
          {/* Specular Light Reflection Sweep */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[20px]">
            <div className="w-1/2 h-full bg-gradient-to-r from-transparent via-white/5 to-transparent -skew-x-12 animate-[shimmer_8s_infinite_linear]" />
          </div>

          {/* Browser Header Bar */}
          <div 
            className="relative z-20 h-12 px-4 bg-slate-950/80 border-b border-slate-800/80 flex items-center justify-between backdrop-blur-md"
            style={{ transform: 'translateZ(25px)' }}
          >
            {/* Mac Traffic Light Buttons */}
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#ff5f56] border border-[#e0443e] inline-block shadow-sm transition-transform hover:scale-110" />
              <span className="w-3 h-3 rounded-full bg-[#ffbd2e] border border-[#dea123] inline-block shadow-sm transition-transform hover:scale-110" />
              <span className="w-3 h-3 rounded-full bg-[#27c93f] border border-[#1ab02d] inline-block shadow-sm transition-transform hover:scale-110" />
              
              <div className="hidden sm:flex items-center gap-1 ml-4 text-slate-500">
                <ChevronLeft className="w-3.5 h-3.5 hover:text-slate-300 transition-colors" />
                <ChevronRight className="w-3.5 h-3.5 hover:text-slate-300 transition-colors" />
              </div>
            </div>

            {/* URL Search Bar */}
            <div className="flex-1 max-w-md mx-4">
              <div className="h-7 px-3 bg-slate-900/90 border border-slate-800/90 rounded-md flex items-center justify-between text-[11px] text-slate-400 shadow-inner group/url hover:border-slate-700 transition-colors">
                <div className="flex items-center gap-2 truncate">
                  <Lock className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span className="font-mono text-slate-300 truncate">https://console.cloudops.internal/dashboard</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-500">
                  <RefreshCw className="w-3 h-3 hover:text-slate-300 transition-colors" />
                </div>
              </div>
            </div>

            {/* Live Indicator & Status */}
            <div className="flex items-center gap-2">
              <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-medium text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                Live Fleet 60FPS
              </span>
            </div>
          </div>

          {/* Main Dashboard Canvas Body */}
          <div className="relative p-6 sm:p-8 bg-slate-950/60 preserve-3d">
            
            {/* Top Sub-Header Strip inside 3D environment */}
            <div 
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800/60"
              style={{ transform: 'translateZ(30px)' }}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                    Cloud Operations Intelligence Center
                  </h2>
                  <p className="text-[11px] text-slate-400">Real-time AWS Telemetry & Cost Optimization</p>
                </div>
              </div>

              {/* Action Tabs */}
              <div className="flex items-center gap-1 p-1 bg-slate-900/80 border border-slate-800 rounded-lg text-xs">
                {['overview', 'telemetry', 'finops'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all ${
                      activeTab === tab 
                        ? 'bg-blue-600 text-white shadow-sm' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* 3D Floating Feature Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left preserve-3d">
              
              {/* Feature Card 1: EC2 Compute Fleet */}
              <div
                className="group/card glass-card p-5 rounded-xl preserve-3d transition-all duration-300 hover:translate-z-[80px] hover:border-blue-500/40 relative overflow-hidden"
                style={{ transform: 'translateZ(45px)' }}
              >
                {/* Background Card Ambient Glow */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover/card:bg-blue-500/25 transition-all duration-500" />
                
                <div className="flex items-center justify-between mb-3" style={{ transform: 'translateZ(15px)' }}>
                  <div className="p-2.5 bg-blue-500/15 border border-blue-500/30 rounded-lg text-blue-400 group-hover/card:scale-110 group-hover/card:bg-blue-500/25 transition-all">
                    <Server className="w-5 h-5" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] font-semibold text-blue-400 font-mono">
                    12 Active
                  </span>
                </div>

                <h3 className="font-bold text-white text-sm tracking-wide group-hover/card:text-blue-300 transition-colors" style={{ transform: 'translateZ(20px)' }}>
                  EC2 Compute Fleet
                </h3>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed" style={{ transform: 'translateZ(15px)' }}>
                  Real-time instance lifecycle control & metrics.
                </p>

                {/* Sub-visual Metric Bar */}
                <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-2" style={{ transform: 'translateZ(25px)' }}>
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>Avg CPU Load</span>
                    <span className="text-blue-400 font-semibold">28.4%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full w-[28.4%] group-hover/card:w-[35%] transition-all duration-700" />
                  </div>
                </div>
              </div>

              {/* Feature Card 2: CloudWatch Log Tail (Elevated Depth for visual dynamic) */}
              <div
                className="group/card glass-card p-5 rounded-xl preserve-3d transition-all duration-300 hover:translate-z-[100px] hover:border-emerald-500/40 relative overflow-hidden"
                style={{ transform: 'translateZ(70px)' }}
              >
                {/* Background Card Ambient Glow */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover/card:bg-emerald-500/25 transition-all duration-500" />

                <div className="flex items-center justify-between mb-3" style={{ transform: 'translateZ(15px)' }}>
                  <div className="p-2.5 bg-emerald-500/15 border border-emerald-500/30 rounded-lg text-emerald-400 group-hover/card:scale-110 group-hover/card:bg-emerald-500/25 transition-all">
                    <Activity className="w-5 h-5" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-semibold text-emerald-400 font-mono flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Sub-second
                  </span>
                </div>

                <h3 className="font-bold text-white text-sm tracking-wide group-hover/card:text-emerald-300 transition-colors" style={{ transform: 'translateZ(20px)' }}>
                  CloudWatch Log Tail
                </h3>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed" style={{ transform: 'translateZ(15px)' }}>
                  Sub-second log search with syntax filters.
                </p>

                {/* Sub-visual Mini Log Stream */}
                <div className="mt-4 pt-3 border-t border-slate-800/80 font-mono text-[10px] space-y-1 text-slate-400" style={{ transform: 'translateZ(25px)' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-400">[200 OK]</span>
                    <span className="text-slate-500">12ms</span>
                  </div>
                  <div className="truncate text-slate-400/90">GET /api/v1/telemetry</div>
                </div>
              </div>

              {/* Feature Card 3: FinOps Savings Engine */}
              <div
                className="group/card glass-card p-5 rounded-xl preserve-3d transition-all duration-300 hover:translate-z-[80px] hover:border-amber-500/40 relative overflow-hidden"
                style={{ transform: 'translateZ(35px)' }}
              >
                {/* Background Card Ambient Glow */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl group-hover/card:bg-amber-500/25 transition-all duration-500" />

                <div className="flex items-center justify-between mb-3" style={{ transform: 'translateZ(15px)' }}>
                  <div className="p-2.5 bg-amber-500/15 border border-amber-500/30 rounded-lg text-amber-400 group-hover/card:scale-110 group-hover/card:bg-amber-500/25 transition-all">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] font-semibold text-amber-400 font-mono">
                    +$1,420/mo
                  </span>
                </div>

                <h3 className="font-bold text-white text-sm tracking-wide group-hover/card:text-amber-300 transition-colors" style={{ transform: 'translateZ(20px)' }}>
                  FinOps Savings Engine
                </h3>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed" style={{ transform: 'translateZ(15px)' }}>
                  Automated unattached EBS volume detection.
                </p>

                {/* Sub-visual Optimization Meter */}
                <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-2" style={{ transform: 'translateZ(25px)' }}>
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>Unattached EBS</span>
                    <span className="text-amber-400 font-semibold">4 Volumes</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full w-[65%]" />
                  </div>
                </div>
              </div>

            </div>

            {/* Bottom Status Bar inside the 3D window */}
            <div 
              className="mt-6 pt-4 border-t border-slate-800/60 flex flex-wrap items-center justify-between text-[11px] text-slate-400 gap-3"
              style={{ transform: 'translateZ(20px)' }}
            >
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <Shield className="w-3.5 h-3.5 text-blue-400" />
                  IAM Security Hardened
                </span>
                <span className="hidden sm:inline-block text-slate-700">•</span>
                <span className="hidden sm:flex items-center gap-1.5 text-slate-300">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  Auto-healing Active
                </span>
              </div>
              <div className="font-mono text-slate-500 text-[10px]">
                Latency: <span className="text-emerald-400">0.8ms</span>
              </div>
            </div>

          </div>

        </div>
      </div>
    </section>
  );
};
