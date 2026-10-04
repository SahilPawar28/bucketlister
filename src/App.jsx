import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Login from './pages/Login';
import Signup from './pages/Signup';
import MapPage from './pages/MapPage';
import ListPage from './pages/ListPage';
import ChooseAvatar from './pages/ChooseAvatar';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useState, useEffect } from 'react';
import { Compass } from 'lucide-react';

function AuthRedirect({ to }) {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const mapId = searchParams.get('mapId');
  if (mapId) localStorage.setItem('pendingSharedMapId', mapId);
  return <Navigate to={to} />;
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-app flex flex-col items-center justify-center gap-4 px-4 text-center">
        <div
          className="grid h-16 w-16 place-items-center rounded-full animate-spin-smooth"
          style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-soft)' }}
        >
          <Compass size={30} color="white" strokeWidth={2.25} />
        </div>
        <p className="font-display text-2xl font-semibold" style={{ color: 'var(--ink)' }}>
          Loading your adventures…
        </p>
        <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
          Dusting off the atlas
        </p>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/login"         element={!user ? <Login />       : <Navigate to="/map" />} />
        <Route path="/signup"        element={!user ? <Signup />      : <Navigate to="/map" />} />
        <Route path="/choose-avatar" element={user  ? <ChooseAvatar /> : <AuthRedirect to="/login" />} />
        <Route path="/map"           element={user  ? <MapPage />     : <AuthRedirect to="/login" />} />
        <Route path="/list"          element={user  ? <ListPage />    : <AuthRedirect to="/login" />} />
        <Route path="*"              element={<AuthRedirect to="/login" />} />
      </Routes>
    </Router>
  );
}

export default App;
