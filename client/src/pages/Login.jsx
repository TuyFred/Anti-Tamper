import { useState, useEffect } from 'react';

import { Link, useSearchParams, useNavigate } from 'react-router-dom';

import {

  Shield, Mail, Lock, User, Phone, AlertCircle, CheckCircle2,

  Eye, EyeOff, ArrowRight, KeyRound, ArrowLeft,

} from 'lucide-react';

import { useAuth } from '../context/AuthContext';

import WhatsAppButton from '../components/WhatsAppButton';



const RIDER_IMG = '/images/rider-hero.png';
const OTP_TTL_MINUTES = 10;
const RESEND_WAIT_SECONDS = 10;



export default function Login() {

  const {

    signIn, signUp, sendRegisterOtp, requestPasswordReset, resetPasswordWithOtp,

    session, loading: authLoading,

  } = useAuth();

  const navigate = useNavigate();

  const [searchParams] = useSearchParams();

  const initialMode = searchParams.get('register') ? 'register' : 'login';

  const [mode, setMode] = useState(initialMode);

  const [email, setEmail] = useState('');

  const [password, setPassword] = useState('');

  const [confirmPassword, setConfirmPassword] = useState('');

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');

  const [error, setError] = useState('');

  const [success, setSuccess] = useState('');

  const [loading, setLoading] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [resendWait, setResendWait] = useState(0);



  useEffect(() => {

    if (!authLoading && session) {

      navigate('/dashboard', { replace: true });

    }

  }, [session, authLoading, navigate]);

  useEffect(() => {
    if (searchParams.get('reason') === 'session') {
      setError('Your session expired. Please sign in again.');
    }
  }, [searchParams]);

  useEffect(() => {
    if (resendWait <= 0) return undefined;
    const timer = setTimeout(() => setResendWait((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendWait]);

  const startResendWait = (seconds) => {
    setResendWait(Number(seconds) > 0 ? Number(seconds) : RESEND_WAIT_SECONDS);
  };



  const resetMessages = () => {

    setError('');

    setSuccess('');

  };



  const switchMode = (next) => {

    setMode(next);

    resetMessages();

    setOtp('');

    setConfirmPassword('');

  };



  const handleLogin = async (e) => {

    e.preventDefault();

    resetMessages();

    setLoading(true);

    try {

      await signIn(email, password);

    } catch (err) {

      setError(err.message);

    } finally {

      setLoading(false);

    }

  };



  const handleRegisterSendOtp = async (e) => {

    e.preventDefault();

    resetMessages();

    setLoading(true);

    try {

      const result = await sendRegisterOtp(email, password, fullName, phone);

      setSuccess(result.message || `Verification code sent. Valid for ${OTP_TTL_MINUTES} minutes.`);
      startResendWait(result.resendAfterSeconds);
      setMode('register-otp');

    } catch (err) {

      setError(err.message);

    } finally {

      setLoading(false);

    }

  };



  const handleResendRegisterOtp = async () => {
    resetMessages();
    setLoading(true);
    try {
      const result = await sendRegisterOtp(email, password, fullName, phone);
      setSuccess(result.message || 'New code sent.');
      startResendWait(result.resendAfterSeconds);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterVerify = async (e) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    try {
      await signUp(email, password, fullName, otp);
      setSuccess('Account verified — welcome!');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSendOtp = async (e) => {

    e.preventDefault();

    resetMessages();

    setLoading(true);

    try {

      const result = await requestPasswordReset(email);

      setSuccess(result.message || `If an account exists, a code was sent. Valid for ${OTP_TTL_MINUTES} minutes.`);
      startResendWait(result.resendAfterSeconds);
      setMode('forgot-otp');

    } catch (err) {

      setError(err.message);

    } finally {

      setLoading(false);

    }

  };



  const handleResendForgotOtp = async () => {
    resetMessages();
    setLoading(true);
    try {
      const result = await requestPasswordReset(email);
      setSuccess(result.message || 'New code sent.');
      startResendWait(result.resendAfterSeconds);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {

    e.preventDefault();

    resetMessages();

    if (password !== confirmPassword) {

      setError('Passwords do not match.');

      return;

    }

    setLoading(true);

    try {

      const result = await resetPasswordWithOtp(email, otp, password);

      setSuccess(result.message || 'Password updated. You can sign in now.');

      setPassword('');

      setConfirmPassword('');

      setOtp('');

      setMode('login');

    } catch (err) {

      setError(err.message);

    } finally {

      setLoading(false);

    }

  };



  const titles = {

    login: { h: 'Sign in', sub: 'Access your deliveries' },

    register: { h: 'Create account', sub: 'Register as customer — email verification required' },

    'register-otp': { h: 'Verify email', sub: `Enter the 6-digit code — valid for ${OTP_TTL_MINUTES} minutes` },

    forgot: { h: 'Forgot password', sub: 'We will email you a verification code' },

    'forgot-otp': { h: 'Reset password', sub: `Enter the code and new password — valid for ${OTP_TTL_MINUTES} minutes` },

  };



  const title = titles[mode] || titles.login;



  return (

    <div className="min-h-screen flex">

      <div className="hidden lg:flex lg:w-1/2 auth-gradient relative overflow-hidden">

        <div className="absolute inset-0 opacity-30">

          <div className="absolute top-20 left-20 w-72 h-72 bg-primary/20 rounded-full blur-3xl" />

          <div className="absolute bottom-20 right-20 w-96 h-96 bg-accent/15 rounded-full blur-3xl" />

        </div>

        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-16 py-12 w-full">

          <Link to="/" className="flex items-center gap-3 mb-8 hover:opacity-90 transition">

            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">

              <Shield className="w-6 h-6 text-white" />

            </div>

            <div>

              <h1 className="text-xl font-bold text-white">Smart Box Delivery</h1>

              <p className="text-xs text-slate-400">Anti-tamper · GPS tracked</p>

            </div>

          </Link>

          <p className="text-slate-400 mb-8 max-w-sm text-lg">Order · Pay · Unlock with token · Review</p>

          <div className="relative rounded-2xl overflow-hidden border border-primary/25 shadow-2xl max-w-md">

            <img src={RIDER_IMG} alt="Motor rider delivering Smart Box" className="w-full h-52 object-cover" />

            <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent" />

            <div className="absolute bottom-0 left-0 right-0 p-4">

              <p className="text-sm font-semibold text-white">Motor rider delivery</p>

              <p className="text-xs text-slate-300">GPS tracked · Anti-tamper box</p>

            </div>

          </div>

          <ul className="mt-8 space-y-2 text-sm text-slate-400">

            <li>• Customer signup verified by email OTP</li>

            <li>• Reset password anytime via email</li>

            <li>• Staff accounts created by admin/manager</li>

          </ul>

        </div>

      </div>



      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-surface">

        <div className="w-full max-w-md animate-fade-in">

          <div className="glass-card rounded-2xl p-8 shadow-2xl">

            <div className="mb-6">

              <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-primary-light mb-3">

                <ArrowLeft className="w-3.5 h-3.5" />

                Back to home

              </Link>

              <h2 className="text-2xl font-bold text-white">{title.h}</h2>

              <p className="text-slate-400 text-sm mt-1">{title.sub}</p>

            </div>



            {(mode === 'login' || mode === 'register') && (

              <div className="flex p-1 bg-surface rounded-xl mb-6 border border-border">

                {['login', 'register'].map((m) => (

                  <button

                    key={m}

                    type="button"

                    onClick={() => switchMode(m)}

                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition ${

                      mode === m ? 'bg-primary text-white shadow-lg shadow-primary/25' : 'text-slate-400 hover:text-white'

                    }`}

                  >

                    {m === 'login' ? 'Sign in' : 'Register'}

                  </button>

                ))}

              </div>

            )}



            {(mode === 'register-otp' || mode === 'forgot' || mode === 'forgot-otp') && (

              <button

                type="button"

                onClick={() => switchMode(mode.startsWith('forgot') ? 'login' : 'register')}

                className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-primary-light mb-4"

              >

                <ArrowLeft className="w-3.5 h-3.5" />

                Back

              </button>

            )}



            {mode === 'login' && (

              <form onSubmit={handleLogin} className="space-y-5">

                <EmailField email={email} setEmail={setEmail} />

                <PasswordField password={password} setPassword={setPassword} showPassword={showPassword} setShowPassword={setShowPassword} />

                <button type="button" onClick={() => switchMode('forgot')} className="text-xs text-primary-light hover:underline">

                  Forgot password?

                </button>

                <FormMessages error={error} success={success} />

                <SubmitButton loading={loading} label="Sign in" />

              </form>

            )}



            {mode === 'register' && (

              <form onSubmit={handleRegisterSendOtp} className="space-y-5">

                <NameField fullName={fullName} setFullName={setFullName} />
                <PhoneField phone={phone} setPhone={setPhone} />
                <EmailField email={email} setEmail={setEmail} />

                <PasswordField password={password} setPassword={setPassword} showPassword={showPassword} setShowPassword={setShowPassword} label="Password" />

                <p className="text-[11px] text-slate-500">We will send a 6-digit code to your email. It is valid for {OTP_TTL_MINUTES} minutes. You can resend after {RESEND_WAIT_SECONDS} seconds.</p>

                <FormMessages error={error} success={success} />

                <SubmitButton loading={loading} label="Send verification code" />

              </form>

            )}



            {mode === 'register-otp' && (

              <form onSubmit={handleRegisterVerify} className="space-y-5">

                <OtpField otp={otp} setOtp={setOtp} email={email} />

                <FormMessages error={error} success={success} />

                <SubmitButton loading={loading} label="Verify & create account" />

                <button

                  type="button"

                  disabled={loading || resendWait > 0}

                  onClick={handleResendRegisterOtp}

                  className="w-full text-xs text-slate-500 hover:text-primary-light disabled:opacity-50"

                >

                  {resendWait > 0 ? `Resend code in ${resendWait}s` : 'Resend code'}

                </button>

              </form>

            )}



            {mode === 'forgot' && (

              <form onSubmit={handleForgotSendOtp} className="space-y-5">

                <EmailField email={email} setEmail={setEmail} />

                <p className="text-[11px] text-slate-500">The reset code is valid for {OTP_TTL_MINUTES} minutes. You can request another after {RESEND_WAIT_SECONDS} seconds.</p>

                <FormMessages error={error} success={success} />

                <SubmitButton loading={loading} label="Send reset code" />

              </form>

            )}



            {mode === 'forgot-otp' && (

              <form onSubmit={handleResetPassword} className="space-y-5">

                <OtpField otp={otp} setOtp={setOtp} email={email} />

                <PasswordField password={password} setPassword={setPassword} showPassword={showPassword} setShowPassword={setShowPassword} label="New password" />

                <PasswordField password={confirmPassword} setPassword={setConfirmPassword} showPassword={showPassword} setShowPassword={setShowPassword} label="Confirm password" />

                <FormMessages error={error} success={success} />

                <SubmitButton loading={loading} label="Update password" />

                <button
                  type="button"
                  disabled={loading || resendWait > 0}
                  onClick={handleResendForgotOtp}
                  className="w-full text-xs text-slate-500 hover:text-primary-light disabled:opacity-50"
                >
                  {resendWait > 0 ? `Resend code in ${resendWait}s` : 'Resend code'}
                </button>

              </form>

            )}

          </div>

        </div>

      </div>

      <WhatsAppButton />

    </div>

  );

}



function EmailField({ email, setEmail }) {

  return (

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

  );

}



function PhoneField({ phone, setPhone }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">Contact phone</label>
      <div className="relative">
        <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="tel"
          placeholder="0781234567"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-surface rounded-xl border border-border focus:border-primary focus:outline-none text-white placeholder-slate-600"
          required
          autoComplete="tel"
        />
      </div>
    </div>
  );
}


function NameField({ fullName, setFullName }) {

  return (

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

  );

}



function PasswordField({ password, setPassword, showPassword, setShowPassword, label = 'Password' }) {

  return (

    <div>

      <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>

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

  );

}



function OtpField({ otp, setOtp, email }) {

  return (

    <div>

      <label className="block text-xs font-medium text-slate-400 mb-1.5">Verification code</label>

      <div className="relative">

        <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />

        <input

          type="text"

          inputMode="numeric"

          pattern="[0-9]{6}"

          maxLength={6}

          placeholder="123456"

          value={otp}

          onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}

          className="w-full pl-10 pr-4 py-3 bg-surface rounded-xl border border-border focus:border-primary focus:outline-none text-white placeholder-slate-600 tracking-[0.35em] font-mono text-lg"

          required

        />

      </div>

      {email && (
        <p className="text-[11px] text-slate-500 mt-1.5">
          Sent to {email}. Valid for {OTP_TTL_MINUTES} minutes — you can resend after {RESEND_WAIT_SECONDS}s.
        </p>
      )}

    </div>

  );

}



function FormMessages({ error, success }) {

  return (

    <>

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

    </>

  );

}



function SubmitButton({ loading, label }) {

  return (

    <button

      type="submit"

      disabled={loading}

      className="w-full py-3.5 bg-gradient-to-r from-primary to-primary-dark text-white font-semibold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-primary/25"

    >

      {loading ? (

        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />

      ) : (

        <>

          {label}

          <ArrowRight className="w-4 h-4" />

        </>

      )}

    </button>

  );

}


