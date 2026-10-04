import { useState } from 'react';
import { db, auth } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const SEEDS = ['Luna', 'Milo', 'Nova', 'Kai', 'Ari', 'Suki', 'Theo', 'Pip'];

function ChooseAvatar() {
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [username, setUsername] = useState('');
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const avatarUrl = (seed) =>
    `https://api.dicebear.com/7.x/adventurer/svg?seed=${seed}&backgroundColor=ffd5dc,ffdfbf,c0aede,b6e3f4,d1d4f9`;

  async function handleSave() {
    if (selectedIdx === null || !username.trim()) {
      return;
    }
    setSaving(true);
    try {
      const user = auth.currentUser;
      if (user) {
        await setDoc(doc(db, 'users', user.uid), {
          avatar: avatarUrl(SEEDS[selectedIdx]),
          username: username.trim(),
        });
        navigate('/map');
      }
    } catch (err) {
      console.error('Error saving profile:', err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-app min-h-screen flex items-center justify-center px-4 py-12">
      <div className="card w-full max-w-2xl rounded-3xl p-7 sm:p-9 animate-fade-in-up">
        <div className="text-center mb-8">
          <img
            src="/logo.png"
            alt="BucketLister"
            className="mx-auto mb-4 rounded-2xl"
            style={{ width: 80, height: 80, boxShadow: 'var(--shadow-soft)', objectFit: 'cover' }}
          />
          <h2 className="font-display text-2xl sm:text-3xl font-semibold" style={{ color: 'var(--ink)' }}>
            Who's adventuring today?
          </h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>
            Pick a buddy and tell us your name
          </p>
        </div>

        <div className="grid grid-cols-4 gap-3 sm:gap-4 mb-8">
          {SEEDS.map((seed, i) => {
            const active = selectedIdx === i;
            return (
              <button
                key={seed}
                onClick={() => setSelectedIdx(i)}
                className="relative aspect-square rounded-full p-1 transition"
                style={{
                  background: active ? 'var(--gradient-primary)' : 'transparent',
                  boxShadow: active ? 'var(--shadow-glow)' : 'none',
                  transform: active ? 'scale(1.08)' : 'scale(1)',
                  border: 'none',
                }}
              >
                <img
                  src={avatarUrl(seed)}
                  alt={seed}
                  className="h-full w-full rounded-full bg-white"
                  style={{ display: 'block', border: '2px solid var(--border)' }}
                />
              </button>
            );
          })}
        </div>

        <div className="max-w-sm mx-auto space-y-3">
          <input
            className="input-field text-center"
            placeholder="Your traveler name"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <button
            onClick={handleSave}
            disabled={saving || selectedIdx === null || !username.trim()}
            className="btn-primary w-full text-base"
          >
            {saving ? 'Saving…' : "Let's go"}
            {!saving && <ArrowRight size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChooseAvatar;
