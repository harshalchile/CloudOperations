import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { io } from 'socket.io-client';
import {
  X,
  Maximize2,
  Minimize2,
  RefreshCw,
  Copy,
  Clipboard,
  Trash2,
  Download,
  Terminal as TerminalIcon,
  ShieldAlert,
  Clock,
  Activity,
  Key,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';

export const SSHTerminalModal = ({ isOpen, onClose, instance }) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const terminalRef = useRef(null);
  const xtermRef = useRef(null);
  const fitAddonRef = useRef(null);
  const socketRef = useRef(null);

  // States
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [status, setStatus] = useState('connecting'); // 'connecting' | 'connected' | 'disconnected' | 'error'
  const [statusMsg, setStatusMsg] = useState('Authenticating...');
  const [errorMsg, setErrorMsg] = useState('');
  const [ping, setPing] = useState(0);
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  // Custom PEM key option
  const [showPemInput, setShowPemInput] = useState(false);
  const [pemKey, setPemKey] = useState('');
  const [username, setUsername] = useState('ec2-user');

  // Terminal Buffer Log storage
  const logBufferRef = useRef('');

  useEffect(() => {
    if (instance) {
      if (instance.os && instance.os.toLowerCase().includes('ubuntu')) {
        setUsername('ubuntu');
      } else {
        setUsername('ec2-user');
      }
    }
  }, [instance]);

  // Session Timer Loop
  useEffect(() => {
    if (!isOpen || status !== 'connected') return;
    const interval = setInterval(() => {
      setSecondsElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, status]);

  // Format Timer String 00:00:00
  const formatTimer = (totalSec) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Main Terminal & Socket Initialization
  useEffect(() => {
    if (!isOpen || !instance) return;

    setStatus('connecting');
    setStatusMsg('Authenticating...');
    setErrorMsg('');
    setSecondsElapsed(0);
    logBufferRef.current = '';

    // Initialize xterm.js instance
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'Consolas, Monaco, "Courier New", monospace',
      theme: {
        background: '#090d16',
        foreground: '#e2e8f0',
        cursor: '#3b82f6',
        selectionBackground: '#1e3a8a',
        black: '#1e293b',
        red: '#f43f5e',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#f8fafc',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    if (terminalRef.current) {
      terminalRef.current.innerHTML = '';
      term.open(terminalRef.current);
      fitAddon.fit();
    }

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Display initial connection status
    term.writeln('Authenticating...');

    // Initialize SocketIO connection
    const wsUrl = import.meta.env.VITE_WS_URL || 'http://localhost:5000';
    const token = localStorage.getItem('authToken');

    const socket = io(wsUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('start_ssh', {
        token,
        instance_id: instance.instance_id,
        username,
        pem_key: pemKey,
        cols: term.cols,
        rows: term.rows,
      });
    });

    socket.on('ssh_status', (data) => {
      setStatusMsg(data.message);
      term.writeln(data.message);
    });

    socket.on('ssh_connected', (data) => {
      setStatus('connected');
      setStatusMsg(data.message || 'Connected.');
      showToast(`SSH Session Established to ${instance.name}`);
    });

    socket.on('terminal_output', (data) => {
      term.write(data.data);
      logBufferRef.current += data.data;
    });

    socket.on('ssh_error', (data) => {
      setStatus('error');
      const err = data.error || 'Connection Failed';
      setErrorMsg(err);
      term.writeln(`\r\n\x1b[31m${err}\x1b[0m`);
    });

    // Handle real interactive keyboard input
    term.onData((data) => {
      if (socket.connected) {
        socket.emit('terminal_input', { data });
      }
    });

    // Handle Window Resize
    const handleResize = () => {
      if (fitAddonRef.current && xtermRef.current) {
        fitAddonRef.current.fit();
        if (socketRef.current && socketRef.current.connected) {
          socketRef.current.emit('terminal_resize', {
            cols: xtermRef.current.cols,
            rows: xtermRef.current.rows,
          });
        }
      }
    };

    window.addEventListener('resize', handleResize);

    // Ping Check Interval
    const pingInterval = setInterval(() => {
      if (socket.connected) {
        const start = Date.now();
        socket.emit('ping_check', { time: start });
      }
    }, 4000);

    socket.on('pong_check', (data) => {
      if (data && data.client_time) {
        setPing(Date.now() - data.client_time);
      }
    });

    // Cleanup on unmount or close
    return () => {
      window.removeEventListener('resize', handleResize);
      clearInterval(pingInterval);
      if (socket) socket.disconnect();
      if (term) term.dispose();
    };
  }, [isOpen, instance, pemKey, username]);

  if (!isOpen || !instance) return null;

  const handleReconnect = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    setStatus('connecting');
    setStatusMsg('Authenticating...');
    setErrorMsg('');
    if (xtermRef.current) {
      xtermRef.current.clear();
      xtermRef.current.writeln('Authenticating...');
    }
    const token = localStorage.getItem('authToken');
    const socket = socketRef.current;
    if (socket) {
      socket.connect();
      socket.emit('start_ssh', {
        token,
        instance_id: instance.instance_id,
        username,
        pem_key: pemKey,
        cols: xtermRef.current?.cols || 80,
        rows: xtermRef.current?.rows || 24,
      });
    }
  };

  const handleCopySelection = () => {
    const selected = xtermRef.current?.getSelection();
    if (selected) {
      navigator.clipboard.writeText(selected);
      showToast('Copied selected text to clipboard');
    } else {
      showToast('Highlight text in terminal first to copy', 'warning');
    }
  };

  const handlePasteToTerminal = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && socketRef.current) {
        socketRef.current.emit('terminal_input', { data: text });
        showToast('Pasted clipboard text to terminal');
      }
    } catch (err) {
      showToast('Clipboard access denied by browser.', 'error');
    }
  };

  const handleClearTerminal = () => {
    if (xtermRef.current) {
      xtermRef.current.clear();
      showToast('Terminal screen cleared');
    }
  };

  const handleDownloadLog = () => {
    const textContent = logBufferRef.current || 'Terminal Log Empty.';
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `terminal-log-${instance.instance_id}.log`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Downloaded log session for ${instance.name}`);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 select-none font-mono-tabular">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ duration: 0.15 }}
          className={`bg-[#090d16] border border-slate-800 rounded-xl shadow-2xl flex flex-col transition-all overflow-hidden ${
            isFullscreen ? 'w-full h-full rounded-none border-none' : 'w-full max-w-5xl h-[85vh]'
          }`}
        >
          {/* Header Bar */}
          <div className="h-13 px-4 bg-[#0d121f] border-b border-slate-800 flex items-center justify-between gap-3 text-xs shrink-0 select-none">
            {/* Left Info */}
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-7 h-7 rounded-md bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                <TerminalIcon className="w-4 h-4" />
              </div>
              <div className="flex flex-col truncate">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-white tracking-wide truncate">{instance.name}</h3>
                  <span className="text-[10px] text-slate-400 font-mono-tabular">({instance.instance_id})</span>
                </div>
                <span className="text-[10px] text-slate-400 flex items-center gap-2">
                  <span>IP: <strong className="text-emerald-400">{instance.public_ip}</strong></span>
                  <span>• Region: <strong className="text-slate-200">{instance.region}</strong></span>
                  <span>• User: <strong className="text-blue-400">{username}</strong></span>
                </span>
              </div>
            </div>

            {/* Right Status Badges & Controls */}
            <div className="flex items-center gap-3 shrink-0">
              {/* Status Badge */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-900 border border-slate-800">
                <span
                  className={`w-2 h-2 rounded-full ${
                    status === 'connected'
                      ? 'bg-emerald-400 animate-pulse'
                      : status === 'connecting'
                      ? 'bg-amber-400 animate-ping'
                      : 'bg-rose-500'
                  }`}
                />
                <span className="text-[11px] font-semibold text-slate-200 uppercase tracking-wider">
                  {status}
                </span>
              </div>

              {/* Ping Indicator */}
              {status === 'connected' && (
                <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-400 bg-slate-900 border border-slate-800 px-2 py-1 rounded">
                  <Activity className="w-3 h-3 text-blue-400" />
                  <span>{ping}ms</span>
                </div>
              )}

              {/* Session Timer */}
              <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-400 bg-slate-900 border border-slate-800 px-2 py-1 rounded">
                <Clock className="w-3 h-3 text-emerald-400" />
                <span>{formatTimer(secondsElapsed)}</span>
              </div>

              {/* Actions Toolbar */}
              <div className="flex items-center gap-1 border-l border-slate-800 pl-2">
                <button
                  onClick={handleReconnect}
                  className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition-colors"
                  title="Reconnect Session"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={handleCopySelection}
                  className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition-colors"
                  title="Copy Selected Text"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={handlePasteToTerminal}
                  className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition-colors"
                  title="Paste Clipboard to Terminal"
                >
                  <Clipboard className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={handleClearTerminal}
                  className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition-colors"
                  title="Clear Terminal Screen"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={handleDownloadLog}
                  className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition-colors"
                  title="Download Session Log File"
                >
                  <Download className="w-3.5 h-3.5 text-blue-400" />
                </button>

                <button
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition-colors"
                  title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                >
                  {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>

                <button
                  onClick={onClose}
                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                  title="Close Terminal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Subheader Status Message / Error Banner */}
          {errorMsg ? (
            <div className="p-3 bg-rose-500/10 border-b border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                <span><strong>SSH Error:</strong> {errorMsg}</span>
              </div>
              <button
                onClick={handleReconnect}
                className="px-2.5 py-1 bg-rose-600 text-white rounded text-[11px] font-semibold"
              >
                Retry SSH
              </button>
            </div>
          ) : (
            <div className="px-4 py-1.5 bg-[#0b0f19] border-b border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between shrink-0">
              <span className="truncate">{statusMsg}</span>
              <button
                onClick={() => setShowPemInput(!showPemInput)}
                className="text-blue-400 hover:underline flex items-center gap-1 shrink-0 ml-2"
              >
                <Key className="w-3.5 h-3.5" />
                <span>{showPemInput ? 'Hide Key Options' : 'Custom PEM Key Option'}</span>
                {showPemInput ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}

          {/* Optional Custom PEM Key Drawer */}
          {showPemInput && (
            <div className="p-3 bg-slate-900 border-b border-slate-800 space-y-2 text-xs shrink-0">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-200">Custom Private Key (.pem file content):</label>
                <span className="text-[11px] text-slate-500">Leave blank to use AWS EC2 Instance Connect</span>
              </div>
              <textarea
                rows={3}
                value={pemKey}
                onChange={(e) => setPemKey(e.target.value)}
                placeholder="-----BEGIN RSA PRIVATE KEY-----\n..."
                className="w-full p-2 bg-slate-950 border border-slate-800 rounded text-slate-200 font-mono-tabular text-[11px] focus:outline-none focus:border-blue-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={handleReconnect}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded font-semibold text-xs"
                >
                  Connect with Key
                </button>
              </div>
            </div>
          )}

          {/* Main xterm.js Terminal Canvas */}
          <div className="flex-1 p-2 bg-[#090d16] overflow-hidden relative">
            <div ref={terminalRef} className="w-full h-full" />
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
