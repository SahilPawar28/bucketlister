import { useState } from 'react';
import { auth, db } from '../firebase';
import { signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { useNavigate, Link } from 'react-router-dom';
import { provider } from '../firebase';
import { getDoc, doc } from 'firebase/firestore';
import { Mail, Lock, AlertCircle, ArrowRight } from 'lucide-react';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists() && userDoc.data().avatar && userDoc.data().username) {
        navigate('/map');
      } else {
        navigate('/choose-avatar');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setError('');
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists() && userDoc.data().avatar && userDoc.data().username) {
        navigate('/map');
      } else {
        navigate('/choose-avatar');
      }
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="bg-app min-h-screen flex items-center justify-center px-4 py-10">
      <div className="card w-full max-w-md rounded-3xl p-7 sm:p-9 animate-fade-in-up">
        <div className="text-center mb-7">
          <img
            src="/logo.png"
            alt="BucketLister"
            className="mx-auto mb-4 rounded-2xl"
            style={{ width: 84, height: 84, boxShadow: 'var(--shadow-soft)', objectFit: 'cover' }}
          />
          <h1 className="font-display text-4xl font-bold" style={{ color: 'var(--ink)' }}>
            BucketLister
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--ink-soft)' }}>
            Pin your dreams. Live the adventure.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-3">
          <div className="relative">
            <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--ink-soft)' }} />
            <input
              className="input-field"
              style={{ paddingLeft: 42 }}
              type="email"
              placeholder="you@wander.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="relative">
            <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--ink-soft)' }} />
            <input
              className="input-field"
              style={{ paddingLeft: 42 }}
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <p
              className="text-sm flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: 'color-mix(in oklab, var(--red) 10%, white)', color: 'var(--red)' }}
            >
              <AlertCircle size={16} className="shrink-0" />
              {error}
            </p>
          )}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Logging in…' : 'Log in'}
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>

        <div className="flex items-center gap-3 py-4 text-xs font-semibold" style={{ color: 'var(--ink-soft)' }}>
          <div className="h-px flex-1" style={{ background: 'var(--border)' }} />
          OR
          <div className="h-px flex-1" style={{ background: 'var(--border)' }} />
        </div>

        <button
          onClick={handleGoogleSignIn}
          className="btn-ghost w-full"
          style={{ padding: '0.75rem 1.25rem' }}
        >
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C33.9 5.5 29.2 3.5 24 3.5 12.7 3.5 3.5 12.7 3.5 24S12.7 44.5 24 44.5 44.5 35.3 44.5 24c0-1.2-.1-2.4-.3-3.5z" />
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C33.9 6.5 29.2 4.5 24 4.5c-7.7 0-14.3 4.4-17.7 10.2z" />
            <path fill="#4CAF50" d="M24 44.5c5.1 0 9.7-1.9 13.2-5.1l-6.1-5.2c-2 1.5-4.5 2.3-7.1 2.3-5.2 0-9.6-3.4-11.3-8.1l-6.5 5C9.6 39.9 16.2 44.5 24 44.5z" />
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.1 5.2C40.5 36.3 44.5 30.7 44.5 24c0-1.2-.1-2.4-.3-3.5z" />
          </svg>
          Continue with Google
        </button>

        <p className="text-center text-sm mt-5" style={{ color: 'var(--ink-soft)' }}>
          Don't have an account?{' '}
          <Link to="/signup" className="font-semibold underline underline-offset-4" style={{ color: 'var(--primary)' }}>
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
