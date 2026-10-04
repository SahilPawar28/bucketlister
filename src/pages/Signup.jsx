import { useState } from 'react';
import { auth } from '../firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, AlertCircle, ArrowRight } from 'lucide-react';

function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSignup(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      navigate('/choose-avatar');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
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
            Start your adventure today.
          </p>
        </div>

        <form onSubmit={handleSignup} className="space-y-3">
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
            {loading ? 'Creating account…' : 'Create account'}
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>

        <p className="text-center text-sm mt-5" style={{ color: 'var(--ink-soft)' }}>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold underline underline-offset-4" style={{ color: 'var(--primary)' }}>
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default Signup;
