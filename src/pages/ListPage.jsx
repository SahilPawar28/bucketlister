import { useEffect, useState } from 'react';
import { db, auth } from '../firebase';
import {
  collection, query, where, getDocs,
  doc, deleteDoc, updateDoc, getDoc,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Check, Save, X, Pencil, Trash2, MapPinned } from 'lucide-react';
import { ALL_FILTERS, catMeta } from '../data/categories';

function ListPage() {
  const [places, setPlaces]       = useState([]);
  const [filter, setFilter]       = useState('All');
  const [userProfile, setUserProfile] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editDesc, setEditDesc]   = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchPlaces(user.uid);
        fetchUserProfile(user.uid);
      } else {
        setPlaces([]);
        setUserProfile(null);
      }
    });
    return () => unsub();
  }, []);

  async function fetchUserProfile(uid) {
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) setUserProfile(snap.data());
    } catch (e) { console.error(e); }
  }

  async function fetchPlaces(uid) {
    try {
      const q = query(collection(db, 'places'), where('userId', '==', uid));
      const snap = await getDocs(q);
      setPlaces(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); }
  }

  async function handleDelete(id) {
    try {
      await deleteDoc(doc(db, 'places', id));
      setPlaces((prev) => prev.filter((p) => p.id !== id));
    } catch (e) { console.error(e); }
  }

  async function saveEdit(id) {
    try {
      await updateDoc(doc(db, 'places', id), { description: editDesc });
      setPlaces((prev) =>
        prev.map((p) => (p.id === id ? { ...p, description: editDesc } : p))
      );
      setEditingId(null);
    } catch (e) { console.error(e); }
  }

  async function toggleCompleted(place) {
    try {
      await updateDoc(doc(db, 'places', place.id), { completed: !place.completed });
      setPlaces((prev) =>
        prev.map((p) => (p.id === place.id ? { ...p, completed: !p.completed } : p))
      );
    } catch (e) { console.error(e); }
  }

  const filtered = places.filter((p) => {
    if (filter === 'All')       return true;
    if (filter === 'Completed') return p.completed;
    return p.category === filter;
  });

  return (
    <div className="bg-app min-h-screen">
      {/* Top bar — structurally matches MapPage's navbar */}
      <div
        className="glass"
        style={{
          position: 'sticky', top: 0, zIndex: 1500,
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
        }}
      >
        {/* Logo */}
        <div className="font-display flex items-center gap-2 shrink-0" style={{ color: 'var(--ink)', fontSize: 23, fontWeight: 700 }}>
          <img src="/logo.png" alt="BucketLister" className="rounded-xl" style={{ width: 42, height: 42, objectFit: 'cover' }} />
          <span className="hidden sm:inline">BucketLister</span>
        </div>

        <span
          className="font-display hidden sm:inline"
          style={{
            position: 'absolute', left: '50%', transform: 'translateX(-50%)',
            fontSize: 16, fontWeight: 700, color: 'var(--ink)',
          }}
        >
          My Bucket List
        </span>

        {/* Right side */}
        <div className="flex items-center gap-2 shrink-0" style={{ marginLeft: 'auto' }}>
          <button className="btn-ghost" style={{ fontSize: 13, padding: '0.55rem 1rem' }} onClick={() => navigate('/map')}>
            <ArrowLeft size={15} /> Map
          </button>

          {userProfile && (
            <div className="flex items-center gap-2" style={{ padding: '4px 10px 4px 4px', borderRadius: 9999, border: '1.5px solid var(--border)' }}>
              <img
                src={userProfile.avatar}
                alt="avatar"
                style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--primary)' }}
              />
              <span className="hidden sm:inline text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                {userProfile.username}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Filter chips */}
        <div className="flex flex-wrap gap-2 mb-6">
          {ALL_FILTERS.map((c) => {
            const Icon = c.icon;
            const active = filter === c.key;
            return (
              <button
                key={c.key}
                onClick={() => setFilter(c.key)}
                className="chip"
                style={active ? { background: c.color, color: 'white', borderColor: 'transparent' } : {}}
              >
                <Icon size={14} />{c.label}
              </button>
            );
          })}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="mx-auto mb-4 grid place-items-center rounded-2xl" style={{ width: 64, height: 64, background: 'var(--muted)' }}>
              <MapPinned size={30} style={{ color: 'var(--ink-soft)' }} />
            </div>
            <p className="font-display text-xl" style={{ color: 'var(--ink)', fontWeight: 700 }}>
              No places here yet
            </p>
            <p className="text-sm mt-2" style={{ color: 'var(--ink-soft)' }}>
              Go pin some dreams on the map!
            </p>
            <button className="btn-primary mt-6" onClick={() => navigate('/map')}>
              <MapPin size={16} /> Open Map
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((place) => {
              const meta = catMeta(place.category);
              const CatIcon = meta.icon || MapPin;
              const isEditing = editingId === place.id;

              return (
                <article
                  key={place.id}
                  className="group card rounded-3xl p-5 transition hover:-translate-y-1"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl"
                      style={{ background: `color-mix(in oklab, ${meta.color} 16%, white)` }}
                    >
                      <CatIcon size={20} style={{ color: meta.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display text-lg leading-tight truncate" style={{ color: 'var(--ink)', fontWeight: 700 }}>
                        {place.placeName}
                      </h3>

                      {isEditing ? (
                        <textarea
                          className="textarea-field mt-2 text-sm"
                          rows={3}
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          autoFocus
                        />
                      ) : (
                        <p className="mt-1 text-sm line-clamp-2" style={{ color: 'var(--ink-soft)' }}>
                          {place.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex gap-2 flex-wrap">
                      <span className="badge" style={{ background: `color-mix(in oklab, ${meta.color} 14%, white)`, color: meta.color }}>
                        <CatIcon size={11} /> {place.category}
                      </span>
                      <button
                        onClick={() => toggleCompleted(place)}
                        className="badge transition"
                        style={
                          place.completed
                            ? { background: 'color-mix(in oklab, var(--green) 16%, white)', color: 'var(--green)', border: 'none', cursor: 'pointer' }
                            : { background: 'var(--muted)', color: 'var(--ink-soft)', border: 'none', cursor: 'pointer' }
                        }
                      >
                        {place.completed ? <><Check size={11} /> Visited</> : 'Pending'}
                      </button>
                    </div>

                    <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition">
                      {isEditing ? (
                        <>
                          <button onClick={() => saveEdit(place.id)} className="icon-btn" style={{ width: 30, height: 30, borderColor: 'var(--green)', color: 'var(--green)' }} title="Save">
                            <Save size={13} />
                          </button>
                          <button onClick={() => setEditingId(null)} className="icon-btn" style={{ width: 30, height: 30 }} title="Cancel">
                            <X size={13} />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => { setEditingId(place.id); setEditDesc(place.description); }}
                          className="icon-btn"
                          style={{ width: 30, height: 30 }}
                          title="Edit"
                        >
                          <Pencil size={13} />
                        </button>
                      )}
                      <button onClick={() => handleDelete(place.id)} className="icon-btn" style={{ width: 30, height: 30 }} title="Delete">
                        <Trash2 size={13} color="var(--red)" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default ListPage;
