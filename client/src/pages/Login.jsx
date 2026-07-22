import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Shield, Mail, Lock, User, AlertCircle, CheckCircle2,
  Eye, EyeOff, ArrowRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import WhatsAppButton from '../components/WhatsAppButton';

const RIDER_IMG = '/images/rider-hero.png';

export default function Login() {
  const { signIn, signUp, session, isApproved, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState(searchParams.get('register') ? 'register' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!authLoading && session) {
      navigate('/dashboard', { replace: true });
    }
  }, [session, authLoading, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await signIn(email, password);
      } else {
        await signUp(email, password, fullName);
        setSuccess('Account created — awaiting manager approval.');
        setMode('login');
        setPassword('');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 auth-gradient relative overflow-hidden">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-20 left-20 w-72 h-72 bg-primary/20 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-accent/15 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-16 py-12 w-full">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Smart Box Delivery</h1>
              <p className="text-xs text-slate-400">Anti-tamper · GPS tracked</p>
            </div>
          </div>

          <p className="text-slate-400 mb-8 max-w-sm text-lg">
            Order · Pay · Unlock with token · Review
          </p>

          <div className="relative rounded-2xl overflow-hidden border border-primary/25 shadow-2xl max-w-md">
            <img
              src={RIDER_IMG}
              alt="Motor rider delivering Smart Box"
              className="w-full h-52 object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <p className="text-sm font-semibold text-white">Motor rider delivery</p>
              <p className="text-xs text-slate-300">GPS tracked · Anti-tamper box</p>
            </div>
          </div>

          <ul className="mt-8 space-y-2 text-sm text-slate-400">
            <li>• Auto pricing & MoMo / bank pay</li>
            <li>• Token unlock at delivery</li>
            <li>• Rwanda full address + map</li>
          </ul>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-surface">
        <div className="w-full max-w-md animate-fade-in">
          <div className="lg:hidden flex items-center gap-3 mb-6 justify-center">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Smart Box Delivery</h1>
              <p className="text-xs text-slate-500">Rwanda delivery platform</p>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-8 shadow-2xl">
            <Link to="/" className="text-xs text-slate-500 hover:text-primary-light mb-4 inline-block">
              ← Back to website
            </Link>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white">
                {mode === 'login' ? 'Sign in' : 'Create account'}
              </h2>
              <p className="text-slate-400 text-sm mt-1">
                {mode === 'login' ? 'Access your deliveries' : 'Register as customer'}
              </p>
            </div>

            <div className="flex p-1 bg-surface rounded-xl mb-6 border border-border">
              {['login', 'register'].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMode(m); setError(''); setSuccess(''); }}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition ${
                    mode === m ? 'bg-primary text-white shadow-lg shadow-primary/25' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {m === 'login' ? 'Sign in' : 'Register'}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Full name</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      placeholder="John Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-surface rounded-xl border border-border focus:border-primary focus:outline-none text-white placeholder-slate-600"
                      required
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    placeholder="you@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-surface rounded-xl border border-border focus:border-primary focus:outline-none text-white placeholder-slate-600"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-12 py-3 bg-surface rounded-xl border border-border focus:border-primary focus:outline-none text-white placeholder-slate-600"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 text-danger text-sm bg-danger/10 border border-danger/20 p-3 rounded-xl">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  {error}
                </div>
              )}
              {success && (
                <div className="flex items-start gap-2 text-success text-sm bg-success/10 border border-success/20 p-3 rounded-xl">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  {success}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-gradient-to-r from-primary to-primary-dark text-white font-semibold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-primary/25"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    {mode === 'login' ? 'Sign in' : 'Create account'}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
      <WhatsAppButton />
    </div>
  );
}
