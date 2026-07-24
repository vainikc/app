import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import SherlockLogo from '@/components/SherlockLogo';

const Login = () => {
  const navigate = useNavigate();
  const { login, register, formatApiErrorDetail } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') await login(email, password);
      else await register(email, password, name || undefined);
      navigate('/');
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#000] px-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2.5 mb-10">
          <SherlockLogo size={28} />
          <span className="font-mono text-lg font-medium text-white tracking-tight">Sherlock</span>
        </div>

        <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
          {mode === 'login' ? 'Sign in' : 'Create account'}
        </h1>
        <p className="text-sm text-[#a1a1aa] mb-8">
          {mode === 'login' ? 'Access your Instagram intelligence dashboard.' : 'Start tracking public Instagram data.'}
        </p>

        <form onSubmit={submit} className="space-y-4" data-testid="auth-form">
          {mode === 'register' && (
            <div>
              <label className="text-[11px] font-mono uppercase text-[#737373] tracking-wider block mb-1.5">Name (optional)</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                data-testid="auth-name-input"
                className="w-full bg-[#0a0a0a] border border-[#1f1f1f] rounded-md px-3.5 py-2.5 text-sm text-white placeholder-[#525252] focus:outline-none focus:border-[#3a3a3a] transition-colors"
                placeholder="Your name"
              />
            </div>
          )}

          <div>
            <label className="text-[11px] font-mono uppercase text-[#737373] tracking-wider block mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              data-testid="auth-email-input"
              className="w-full bg-[#0a0a0a] border border-[#1f1f1f] rounded-md px-3.5 py-2.5 text-sm text-white placeholder-[#525252] focus:outline-none focus:border-[#3a3a3a] transition-colors"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="text-[11px] font-mono uppercase text-[#737373] tracking-wider block mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={mode === 'register' ? 8 : undefined}
                data-testid="auth-password-input"
                className="w-full bg-[#0a0a0a] border border-[#1f1f1f] rounded-md px-3.5 py-2.5 pr-10 text-sm text-white placeholder-[#525252] focus:outline-none focus:border-[#3a3a3a] transition-colors"
                placeholder={mode === 'register' ? 'At least 8 characters' : '••••••••'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#737373] hover:text-white"
                tabIndex={-1}
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div
              className="text-xs text-[#dc2626] bg-[#1a0808] border border-[#3a1010] rounded-md px-3 py-2"
              data-testid="auth-error"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            data-testid="auth-submit-btn"
            className="w-full bg-white text-black rounded-md py-2.5 text-sm font-medium hover:bg-[#e5e5e5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }}
            data-testid="auth-mode-toggle"
            className="text-xs text-[#737373] hover:text-white transition-colors"
          >
            {mode === 'login' ? "Don't have an account? Register" : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
