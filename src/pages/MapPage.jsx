import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, ZoomControl } from 'react-leaflet';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useMap } from 'react-leaflet';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { db } from '../firebase';
import {
  collection, addDoc, getDocs, query, where,
  getDoc, serverTimestamp, doc, deleteDoc, updateDoc,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  Compass, Search, List, Share2, Globe2, ChevronDown, LogOut, X, Plus,
  Save, Pencil, Trash2, MapPin, Layers, Lock, Globe, Link2, Check,
  Crosshair, Loader2,
} from 'lucide-react';
import { CATEGORIES, ALL_FILTERS, catMeta } from '../data/categories';
import { MAPBOX_TOKEN, MAPBOX_STYLE_OWNER, MAPBOX_STYLE_ID, MAPBOX_STYLE_VERSION } from '../mapboxConfig';

// ─── Map tile URLs ────────────────────────────────────────────────────────────
const mapStyles = {
  mapbox:        `https://api.mapbox.com/styles/v1/${MAPBOX_STYLE_OWNER}/${MAPBOX_STYLE_ID}/tiles/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}&v=${MAPBOX_STYLE_VERSION}`,
  vivid:         'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  streets:       'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  satellite:     'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  light:         'https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png',
  dark:          'https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png',
  googleStreets: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
  googleHybrid:  'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
  googleSat:     'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
  googleTerrain: 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
};

// Styles that get the extra saturation/contrast boost for a punchier, gamified look
const VIVID_FILTER_STYLES = new Set(['vivid']);

const MAP_STYLE_OPTIONS = [
  { key: 'mapbox',        label: 'Mapbox' },
  { key: 'vivid',         label: 'Vivid' },
  { key: 'googleStreets', label: 'Streets' },
  { key: 'googleSat',     label: 'Satellite' },
  { key: 'googleHybrid',  label: 'Hybrid' },
  { key: 'googleTerrain', label: 'Terrain' },
  { key: 'streets',       label: 'OpenStreetMap' },
  { key: 'light',         label: 'Light' },
  { key: 'dark',          label: 'Dark' },
];

// ─── Custom marker icons (rendered from a React icon into a divIcon) ──────────
const iconCache = {};
function categoryDivIcon(categoryKey) {
  if (iconCache[categoryKey]) return iconCache[categoryKey];
  const meta = catMeta(categoryKey);
  const Icon = meta.icon || MapPin;
  const iconSvg = renderToStaticMarkup(<Icon size={18} color="white" strokeWidth={2.5} />);
  const icon = L.divIcon({
    html: `<div style="
      width:36px;height:36px;
      background:${meta.color};
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      display:grid;place-items:center;
      box-shadow:0 4px 10px rgba(0,0,0,0.3);
      border:2px solid white;
    "><div style="transform:rotate(45deg);display:flex">${iconSvg}</div></div>`,
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 34],
    popupAnchor: [0, -36],
  });
  iconCache[categoryKey] = icon;
  return icon;
}
const defaultPinIcon = L.divIcon({
  html: `<div style="
    width:30px;height:30px;background:var(--ink);border-radius:50% 50% 50% 0;
    transform:rotate(-45deg);border:2px solid white;box-shadow:0 3px 8px rgba(0,0,0,0.3);
  "></div>`,
  className: '',
  iconSize: [30, 30],
  iconAnchor: [15, 28],
});

// ─── Sub-components ───────────────────────────────────────────────────────────
function MapClickHandler({ setPosition, setPlaceName }) {
  useMapEvents({
    click: async (e) => {
      setPosition({ lat: e.latlng.lat, lng: e.latlng.lng });
      try {
        const res = await axios.get('https://nominatim.openstreetmap.org/reverse', {
          params: { lat: e.latlng.lat, lon: e.latlng.lng, format: 'json', 'accept-language': 'en' },
          headers: { 'Accept-Language': 'en' },
        });
        const a = res.data.address;
        const short = a.city || a.town || a.village || a.hamlet || res.data.name;
        setPlaceName(short || `${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`);
      } catch {
        setPlaceName(`${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`);
      }
    },
  });
  return null;
}

function FlyToLocation({ lat, lon, setFlyCoords }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lon) { map.flyTo([lat, lon], 10); setFlyCoords(null); }
  }, [lat, lon, map, setFlyCoords]);
  return null;
}

function LocateControl() {
  const map = useMap();
  function locate() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      map.flyTo([pos.coords.latitude, pos.coords.longitude], 12);
    });
  }
  return (
    <button
      onClick={locate}
      className="icon-btn"
      style={{ background: 'white', position: 'absolute', bottom: 108, right: 10, zIndex: 1000, width: 34, height: 34 }}
      title="Find my location"
    >
      <Crosshair size={17} />
    </button>
  );
}

// ─── Toast helper ─────────────────────────────────────────────────────────────
function showToast(message, tone = 'success') {
  const colors = {
    success: 'var(--green)',
    error: 'var(--red)',
    warn: 'var(--amber)',
    info: 'var(--primary)',
  };
  const el = document.createElement('div');
  el.style.cssText = `
    position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
    background:var(--ink);color:white;
    padding:12px 18px;border-radius:14px;
    box-shadow:0 10px 30px -10px rgba(0,0,0,0.4);
    display:flex;align-items:center;gap:10px;
    font-family:'Poppins',sans-serif;font-weight:600;font-size:13.5px;
    z-index:9999;max-width:90vw;
    animation:fade-in-up .22s ease-out;
    border-left:3px solid ${colors[tone] || colors.success};
  `;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => { el.style.transition = 'opacity .2s'; el.style.opacity = '0'; }, 2600);
  setTimeout(() => el.remove(), 2900);
}

// ─── Popup card for a place ───────────────────────────────────────────────────
function PlacePopup({ place, onEdit, onDelete, onToggle, isShared, sharedBy }) {
  const [editing, setEditing] = useState(false);
  const [desc, setDesc] = useState(place.description);
  const meta = catMeta(place.category);
  const CatIcon = meta.icon || MapPin;

  function handleSave() {
    onEdit(place.id, desc);
    setEditing(false);
  }

  return (
    <div style={{ minWidth: 220, maxWidth: 280, fontFamily: "'Poppins', sans-serif" }}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 style={{ margin: 0, fontFamily: "'Poppins',sans-serif", fontWeight: 700, fontSize: 16, color: 'var(--ink)', lineHeight: 1.25 }}>
          {place.placeName}
        </h4>
        <span
          className="badge shrink-0"
          style={{ background: `color-mix(in oklab, ${meta.color} 16%, white)`, color: meta.color }}
        >
          <CatIcon size={12} /> {meta.label}
        </span>
      </div>

      {editing ? (
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          rows={3}
          autoFocus
          className="textarea-field"
          style={{ fontSize: 13, marginBottom: 8 }}
        />
      ) : (
        <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
          {place.description}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span
          className="badge"
          style={
            place.completed
              ? { background: 'color-mix(in oklab, var(--green) 16%, white)', color: 'var(--green)' }
              : { background: 'var(--muted)', color: 'var(--ink-soft)' }
          }
        >
          {place.completed ? <><Check size={12} /> Visited</> : 'Pending'}
        </span>

        {isShared ? (
          <span style={{ fontSize: 11, color: 'var(--ink-soft)', fontStyle: 'italic' }}>
            by {sharedBy}
          </span>
        ) : (
          <div className="flex gap-1">
            {editing ? (
              <>
                <button onClick={handleSave} className="icon-btn" style={{ width: 30, height: 30, borderColor: 'var(--green)', color: 'var(--green)' }} title="Save">
                  <Save size={14} />
                </button>
                <button onClick={() => { setEditing(false); setDesc(place.description); }} className="icon-btn" style={{ width: 30, height: 30 }}>
                  <X size={14} />
                </button>
              </>
            ) : (
              <button onClick={() => setEditing(true)} className="icon-btn" style={{ width: 30, height: 30 }} title="Edit">
                <Pencil size={14} />
              </button>
            )}
            <button
              onClick={() => onToggle(place)}
              className="btn-ghost"
              style={{
                height: 30, padding: '0 10px', fontSize: 12,
                color: place.completed ? 'var(--amber)' : 'var(--green)',
              }}
            >
              {place.completed ? 'Unvisit' : 'Visited!'}
            </button>
            <button onClick={() => onDelete(place.id)} className="icon-btn" style={{ width: 30, height: 30 }} title="Delete">
              <Trash2 size={14} color="var(--red)" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Add-to-bucket form (shared between desktop panel & mobile sheet) ─────────
function AddBucketForm({
  placeName, setPlaceName, description, setDescription, category, setCategory,
  completedToggle, setCompletedToggle, handleSave, savingPlace,
  placeSuggestions, showPlaceSuggestions, setShowPlaceSuggestions, placeSearchLoading,
  handlePlaceSuggestionSelect, placeSearchRef,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div ref={placeSearchRef} style={{ position: 'relative' }}>
        <input
          className="input-field input-pill"
          style={{ paddingRight: 40 }}
          placeholder="Place name…"
          value={placeName}
          onChange={(e) => setPlaceName(e.target.value)}
          onFocus={() => placeSuggestions.length > 0 && setShowPlaceSuggestions(true)}
        />
        <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-soft)' }}>
          {placeSearchLoading ? <Loader2 size={16} className="animate-spin-smooth" /> : <MapPin size={16} />}
        </span>
        {showPlaceSuggestions && placeSuggestions.length > 0 && (
          <div className="card animate-fade-in-up" style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
            borderRadius: 14, overflow: 'hidden', zIndex: 2000, maxHeight: 200, overflowY: 'auto',
          }}>
            {placeSuggestions.map((s, i) => (
              <div
                key={i}
                onClick={() => handlePlaceSuggestionSelect(s)}
                style={{
                  padding: '10px 14px', cursor: 'pointer', fontSize: 13,
                  borderBottom: i < placeSuggestions.length - 1 ? '1px solid var(--border)' : 'none',
                  color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--muted)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <MapPin size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <textarea
        className="textarea-field"
        rows={2}
        placeholder="What's the dream?"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        style={{ fontSize: 14 }}
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {CATEGORIES.map((c) => {
          const Icon = c.icon;
          const active = category === c.key;
          return (
            <button
              key={c.key}
              onClick={() => setCategory(c.key)}
              className="chip"
              style={active ? { background: c.color, color: 'white', borderColor: 'transparent' } : {}}
            >
              <Icon size={14} />{c.label}
            </button>
          );
        })}
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--muted)', borderRadius: 14,
        padding: '8px 14px', border: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Already visited?</span>
        <button
          onClick={() => setCompletedToggle((v) => !v)}
          style={{
            position: 'relative', width: 46, height: 26, borderRadius: 9999,
            background: completedToggle ? 'var(--green)' : 'var(--border)',
            border: 'none', cursor: 'pointer', transition: 'background .2s',
            flexShrink: 0,
          }}
        >
          <span style={{
            position: 'absolute', top: 2,
            left: completedToggle ? 22 : 2,
            width: 22, height: 22, borderRadius: '50%',
            background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
            transition: 'left .2s',
          }} />
        </button>
      </div>

      <button className="btn-primary w-full" onClick={handleSave} disabled={savingPlace}>
        {savingPlace ? 'Pinning…' : 'Pin it!'}
        {!savingPlace && <Plus size={18} />}
      </button>
    </div>
  );
}

// ─── Main MapPage ─────────────────────────────────────────────────────────────
function MapPage() {
  const [position, setPosition]       = useState(null);
  const [placeName, setPlaceName]     = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory]       = useState('');
  const [savedPlaces, setSavedPlaces] = useState([]);
  const [filter, setFilter]           = useState('All');
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [flyCoords, setFlyCoords]     = useState(null);
  const [mapStyle, setMapStyle]       = useState('mapbox');
  const [completedToggle, setCompletedToggle] = useState(false);
  const [mobileFormOpen, setMobileFormOpen]   = useState(false);

  // search
  const [searchQuery, setSearchQuery]     = useState('');
  const [suggestions, setSuggestions]     = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const searchRef = useRef(null);

  // place name search in form
  const [placeSuggestions, setPlaceSuggestions]         = useState([]);
  const [showPlaceSuggestions, setShowPlaceSuggestions] = useState(false);
  const [placeSearchLoading, setPlaceSearchLoading]     = useState(false);
  const placeSearchRef = useRef(null);

  // UI toggles
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);
  const [mapStyleOpen, setMapStyleOpen] = useState(false);
  const [savingPlace, setSavingPlace]   = useState(false);
  const settingsRef  = useRef(null);
  const mapStyleRef  = useRef(null);
  const mapStyleRefMobile = useRef(null);

  // sharing
  const [showShareModal, setShowShareModal]           = useState(false);
  const [shareTitle, setShareTitle]                   = useState('');
  const [shareDescription, setShareDescription]       = useState('');
  const [shareType, setShareType]                     = useState('public');
  const [privateShareLink, setPrivateShareLink]       = useState('');
  const [showShareLinkCopied, setShowShareLinkCopied] = useState(false);
  const [sharingMap, setSharingMap]                   = useState(false);

  const [sharedMaps, setSharedMaps]                   = useState([]);
  const [showSharedMapsModal, setShowSharedMapsModal] = useState(false);
  const [selectedSharedMap, setSelectedSharedMap]     = useState(null);
  const [sharedMapsLoading, setSharedMapsLoading]     = useState(false);
  const [accessedPrivateMaps, setAccessedPrivateMaps] = useState([]);

  const navigate = useNavigate();

  // ── Auth & data load ──────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
        fetchPlaces(user.uid);
        fetchUserProfile(user.uid);
        loadAccessedPrivateMaps();
      } else {
        setCurrentUser(null);
        setSavedPlaces([]);
        setUserProfile(null);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => { fetchSharedMaps(); }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mapId = params.get('mapId');
    if (mapId) {
      localStorage.setItem('pendingSharedMapId', mapId);
      if (currentUser) fetchSharedMapById(mapId);
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      const pending = localStorage.getItem('pendingSharedMapId');
      if (pending) {
        fetchSharedMapById(pending);
        localStorage.removeItem('pendingSharedMapId');
      }
    }
  }, [currentUser]);

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
      setSavedPlaces(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); }
  }

  // ── Click-outside handlers ─────────────────────────────────────────────────
  useEffect(() => {
    function handle(e) {
      if (searchRef.current && !searchRef.current.contains(e.target))    setShowSuggestions(false);
      if (settingsRef.current && !settingsRef.current.contains(e.target)) setShowSettingsDropdown(false);
      if (
        mapStyleRef.current && !mapStyleRef.current.contains(e.target) &&
        mapStyleRefMobile.current && !mapStyleRefMobile.current.contains(e.target)
      ) setMapStyleOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  useEffect(() => {
    function handle(e) {
      if (placeSearchRef.current && !placeSearchRef.current.contains(e.target))
        setShowPlaceSuggestions(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  // ── Search (navbar) ────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchQuery.length >= 2) fetchSuggestions(searchQuery);
      else { setSuggestions([]); setShowSuggestions(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  async function fetchSuggestions(q) {
    setSearchLoading(true);
    try {
      const res = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: { q, format: 'json', limit: 5, 'accept-language': 'en' },
        headers: { 'Accept-Language': 'en' },
      });
      if (res.data.length > 0) {
        setSuggestions(res.data.map((p) => ({ name: p.display_name, lat: p.lat, lon: p.lon })));
        setShowSuggestions(true);
      } else { setSuggestions([]); setShowSuggestions(false); }
    } catch { setSuggestions([]); }
    finally { setSearchLoading(false); }
  }

  function handleSuggestionSelect(s) {
    setSearchQuery(s.name);
    setShowSuggestions(false);
    setMobileSearchOpen(false);
    setFlyCoords({ lat: parseFloat(s.lat), lon: parseFloat(s.lon) });
  }

  // ── Search (add-place form) ────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => {
      if (placeName.length >= 2) fetchPlaceSuggestions(placeName);
      else { setPlaceSuggestions([]); setShowPlaceSuggestions(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [placeName]);

  async function fetchPlaceSuggestions(q) {
    setPlaceSearchLoading(true);
    try {
      const res = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: { q, format: 'json', limit: 5, 'accept-language': 'en' },
        headers: { 'Accept-Language': 'en' },
      });
      if (res.data.length > 0) {
        setPlaceSuggestions(res.data.map((p) => ({
          name: p.display_name,
          shortName: p.display_name.split(',')[0],
          lat: p.lat, lon: p.lon,
        })));
        setShowPlaceSuggestions(true);
      } else { setPlaceSuggestions([]); setShowPlaceSuggestions(false); }
    } catch { setPlaceSuggestions([]); }
    finally { setPlaceSearchLoading(false); }
  }

  function handlePlaceSuggestionSelect(s) {
    setPlaceName(s.shortName);
    setPosition({ lat: parseFloat(s.lat), lng: parseFloat(s.lon) });
    setFlyCoords({ lat: parseFloat(s.lat), lon: parseFloat(s.lon) });
    setShowPlaceSuggestions(false);
  }

  // ── Save place ─────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!description) { showToast('Please describe why you want to visit', 'warn'); return; }
    if (!category)    { showToast('Please pick a category', 'warn'); return; }
    if (!position)    { showToast('Click the map or search to set a location', 'warn'); return; }
    if (!currentUser) return;
    setSavingPlace(true);
    try {
      await addDoc(collection(db, 'places'), {
        lat: position.lat, lng: position.lng,
        placeName, description, category,
        completed: completedToggle,
        userId: currentUser.uid,
      });
      fetchPlaces(currentUser.uid);
      showToast('Added to your bucket list!', 'success');
      setPosition(null); setDescription(''); setPlaceName(''); setCategory(''); setCompletedToggle(false);
      setMobileFormOpen(false);
    } catch (e) {
      console.error('Save error:', e);
      showToast(e?.code ? `Error: ${e.code}` : 'Error saving place — check console', 'error');
    } finally { setSavingPlace(false); }
  }

  // ── Edit / delete / toggle ─────────────────────────────────────────────────
  async function handleEdit(id, newDesc) {
    try {
      await updateDoc(doc(db, 'places', id), { description: newDesc });
      setSavedPlaces((prev) => prev.map((p) => p.id === id ? { ...p, description: newDesc } : p));
    } catch (e) { console.error(e); }
  }

  async function handleDelete(id) {
    try {
      await deleteDoc(doc(db, 'places', id));
      fetchPlaces(currentUser.uid);
    } catch (e) { console.error(e); }
  }

  async function handleToggleCompleted(place) {
    try {
      await updateDoc(doc(db, 'places', place.id), { completed: !place.completed });
      setSavedPlaces((prev) => prev.map((p) => p.id === place.id ? { ...p, completed: !p.completed } : p));
    } catch (e) { console.error(e); }
  }

  // ── Shared maps ────────────────────────────────────────────────────────────
  async function fetchSharedMaps() {
    setSharedMapsLoading(true);
    try {
      const q = query(collection(db, 'sharedMaps'), where('isPublic', '==', true));
      const snap = await getDocs(q);
      const publicMaps = snap.docs.map((d) => ({ id: d.id, ...d.data(), isPublic: true }));
      const privateMaps = sharedMaps.filter((m) => !m.isPublic && m.isPrivatelyAccessible);
      setSharedMaps([...publicMaps, ...privateMaps]);
    } catch (e) { console.error(e); }
    finally { setSharedMapsLoading(false); }
  }

  async function handleShareMap() {
    if (!shareTitle) { showToast('Please enter a title', 'warn'); return; }
    if (!currentUser) return;
    setSharingMap(true);
    try {
      const placesToShare = savedPlaces.filter((p) => {
        if (filter === 'All') return true;
        if (filter === 'Completed') return p.completed;
        return p.category === filter;
      });
      const ref = await addDoc(collection(db, 'sharedMaps'), {
        title: shareTitle, description: shareDescription,
        createdBy: currentUser.uid,
        creatorName: userProfile?.username || 'Anonymous',
        places: placesToShare, createdAt: serverTimestamp(),
        isPublic: shareType === 'public', mapStyle,
      });
      if (shareType === 'private') {
        const link = `${window.location.origin}${window.location.pathname}?mapId=${ref.id}`;
        setPrivateShareLink(link);
      } else {
        showToast('Map shared publicly!', 'success');
        setShowShareModal(false);
        setShareTitle(''); setShareDescription(''); setShareType('public');
      }
    } catch (e) { console.error(e); showToast('Error sharing map', 'error'); }
    finally { setSharingMap(false); }
  }

  function loadSharedMap(map) {
    if (!map.places?.length) { showToast('This shared map has no places', 'warn'); return; }
    if (map.mapStyle) setMapStyle(map.mapStyle);
    if (map.places[0]) setFlyCoords({ lat: map.places[0].lat, lon: map.places[0].lng });
    setSelectedSharedMap(map);
    setShowSharedMapsModal(false);
    showToast(`Viewing "${map.title}"`, 'info');
  }

  async function fetchSharedMapById(mapId, autoLoad = true) {
    try {
      if (autoLoad) setSharedMapsLoading(true);
      const snap = await getDoc(doc(db, 'sharedMaps', mapId));
      if (!snap.exists()) { if (autoLoad) showToast('Shared map not found', 'warn'); return null; }
      const mapData = { id: snap.id, ...snap.data() };
      if (!mapData.isPublic) {
        const now = Date.now();
        const updated = [...accessedPrivateMaps];
        const idx = updated.findIndex((m) => m.id === mapId);
        const entry = { id: mapId, title: mapData.title, creatorName: mapData.creatorName, accessedAt: now };
        if (idx >= 0) updated[idx] = entry; else updated.push(entry);
        setAccessedPrivateMaps(updated);
        localStorage.setItem('accessedPrivateMaps', JSON.stringify(updated));
        const existing = sharedMaps.findIndex((m) => m.id === mapId);
        const updatedMaps = [...sharedMaps];
        if (existing >= 0) updatedMaps[existing] = mapData;
        else updatedMaps.push({ ...mapData, isPrivatelyAccessible: true });
        setSharedMaps(updatedMaps);
      }
      if (autoLoad) loadSharedMap(mapData);
      return mapData;
    } catch (e) { console.error(e); if (autoLoad) showToast('Error loading shared map', 'error'); return null; }
    finally { if (autoLoad) setSharedMapsLoading(false); }
  }

  function loadAccessedPrivateMaps() {
    const stored = localStorage.getItem('accessedPrivateMaps');
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const recent = parsed.filter((m) => m.accessedAt > cutoff);
      localStorage.setItem('accessedPrivateMaps', JSON.stringify(recent));
      setAccessedPrivateMaps(recent);
      recent.forEach((m) => fetchSharedMapById(m.id, false));
    } catch { localStorage.removeItem('accessedPrivateMaps'); }
  }

  function handleLogout() {
    signOut(auth).then(() => (window.location.href = '/login')).catch(console.error);
  }

  // ── Filter helpers ─────────────────────────────────────────────────────────
  const visiblePlaces = savedPlaces.filter((p) => {
    if (filter === 'All')       return true;
    if (filter === 'Completed') return p.completed;
    return p.category === filter;
  });

  const addFormProps = {
    placeName, setPlaceName, description, setDescription, category, setCategory,
    completedToggle, setCompletedToggle, handleSave, savingPlace,
    placeSuggestions, showPlaceSuggestions, setShowPlaceSuggestions, placeSearchLoading,
    handlePlaceSuggestionSelect, placeSearchRef,
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100dvh', width: '100vw', position: 'relative', overflow: 'hidden' }}>

      {/* ── Loading overlay ─────────────────────────────── */}
      {(savingPlace || sharedMapsLoading || sharingMap) && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'color-mix(in oklab, var(--background) 75%, transparent)',
          backdropFilter: 'blur(4px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          zIndex: 3000,
        }}>
          <div
            className="grid h-14 w-14 place-items-center rounded-full animate-spin-smooth"
            style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-soft)' }}
          >
            <Compass size={26} color="white" />
          </div>
          <p className="font-display" style={{ color: 'var(--ink)', marginTop: 16, fontSize: 19, fontWeight: 500 }}>
            {savingPlace ? 'Pinning your dream…' : sharingMap ? 'Sharing your map…' : 'Loading shared maps…'}
          </p>
        </div>
      )}

      {/* ── Navbar ──────────────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1500,
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
      }}
        className="glass"
      >
        {/* Logo */}
        <div className="font-display flex items-center gap-2 shrink-0" style={{ color: 'var(--ink)', fontSize: 23, fontWeight: 700 }}>
          <img src="/logo.png" alt="BucketLister" className="rounded-xl" style={{ width: 42, height: 42, objectFit: 'cover' }} />
          <span className="hidden sm:inline">BucketLister</span>
        </div>

        {/* Search — desktop */}
        <div ref={searchRef} className="hidden sm:block" style={{ flex: 1, maxWidth: 380, position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-soft)' }} />
          <input
            className="input-field input-pill"
            style={{ paddingLeft: 40, paddingRight: 40, fontSize: 14 }}
            placeholder="Search a place…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && suggestions[0] && handleSuggestionSelect(suggestions[0])}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          />
          {searchLoading && (
            <Loader2 size={15} className="animate-spin-smooth" style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-soft)' }} />
          )}
          {showSuggestions && suggestions.length > 0 && (
            <div className="card animate-fade-in-up" style={{
              position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
              borderRadius: 16, overflow: 'hidden', zIndex: 2000,
            }}>
              {suggestions.map((s, i) => (
                <div
                  key={i}
                  onClick={() => handleSuggestionSelect(s)}
                  style={{
                    padding: '10px 16px', cursor: 'pointer', fontSize: 13,
                    borderBottom: i < suggestions.length - 1 ? '1px solid var(--border)' : 'none',
                    color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--muted)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <MapPin size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ flex: 1 }} className="sm:hidden" />

        {/* Right buttons */}
        <div className="flex items-center gap-2 shrink-0" style={{ marginLeft: 'auto' }}>
          {/* Search — mobile icon */}
          <button className="icon-btn sm:hidden" onClick={() => setMobileSearchOpen(true)} title="Search">
            <Search size={16} />
          </button>

          <button className="btn-ghost hidden sm:inline-flex" style={{ fontSize: 13, padding: '0.55rem 1rem' }} onClick={() => navigate('/list')}>
            <List size={15} /> List
          </button>
          <button className="icon-btn sm:hidden" onClick={() => navigate('/list')} title="List view">
            <List size={16} />
          </button>

          <button
            className="btn-primary hidden sm:inline-flex"
            style={{ padding: '0.55rem 1rem', fontSize: 13 }}
            onClick={() => setShowShareModal(true)}
          >
            <Share2 size={15} /> Share
          </button>
          <button className="icon-btn sm:hidden" onClick={() => setShowShareModal(true)} title="Share map">
            <Share2 size={16} />
          </button>

          <button
            className="btn-ghost hidden sm:inline-flex"
            style={{ fontSize: 13, padding: '0.55rem 1rem' }}
            onClick={() => { fetchSharedMaps(); setShowSharedMapsModal(true); }}
          >
            <Globe2 size={15} /> Shared Maps
          </button>
          <button className="icon-btn sm:hidden" onClick={() => { fetchSharedMaps(); setShowSharedMapsModal(true); }} title="Browse shared maps">
            <Globe2 size={16} />
          </button>

          {/* User avatar + dropdown */}
          {currentUser && (
            <div ref={settingsRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setShowSettingsDropdown((v) => !v)}
                className="icon-btn"
                style={{
                  width: 'auto', height: 'auto', padding: '4px 10px 4px 4px', borderRadius: 9999,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {userProfile?.avatar && (
                  <img src={userProfile.avatar} alt="avatar" style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--primary)' }} />
                )}
                {userProfile?.username && (
                  <span className="hidden sm:inline" style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {userProfile.username}
                  </span>
                )}
                <ChevronDown size={13} />
              </button>

              {showSettingsDropdown && (
                <div className="card animate-fade-in-up" style={{
                  position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                  borderRadius: 16, overflow: 'hidden', minWidth: 170, zIndex: 2000,
                }}>
                  <button
                    onClick={handleLogout}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      width: '100%', padding: '12px 16px', border: 'none', background: 'none',
                      cursor: 'pointer', fontSize: 14, fontWeight: 600,
                      color: 'var(--red)', fontFamily: "'Poppins', sans-serif",
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--muted)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                  >
                    <LogOut size={16} /> Logout
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile search overlay ─────────────────────────── */}
      {mobileSearchOpen && (
        <div className="sheet-overlay sm:hidden" onClick={() => setMobileSearchOpen(false)}>
          <div
            className="glass animate-fade-in-up"
            style={{ padding: '12px', display: 'flex', gap: 8, alignItems: 'center' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-soft)' }} />
              <input
                className="input-field input-pill"
                style={{ paddingLeft: 38 }}
                placeholder="Search a place…"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && suggestions[0] && handleSuggestionSelect(suggestions[0])}
              />
            </div>
            <button className="icon-btn" onClick={() => setMobileSearchOpen(false)}><X size={16} /></button>
            {showSuggestions && suggestions.length > 0 && (
              <div className="card animate-fade-in-up" style={{
                position: 'absolute', top: '100%', left: 12, right: 12, marginTop: 6,
                borderRadius: 16, overflow: 'hidden', zIndex: 2000,
              }}>
                {suggestions.map((s, i) => (
                  <div
                    key={i}
                    onClick={() => handleSuggestionSelect(s)}
                    style={{
                      padding: '12px 16px', cursor: 'pointer', fontSize: 13,
                      borderBottom: i < suggestions.length - 1 ? '1px solid var(--border)' : 'none',
                      color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8,
                    }}
                  >
                    <MapPin size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Map ─────────────────────────────────────────── */}
      <div
        className={VIVID_FILTER_STYLES.has(mapStyle) ? 'map-vivid' : ''}
        style={{ position: 'absolute', inset: 0, paddingTop: 66 }}
      >
        <MapContainer
          center={[20.5937, 78.9629]}
          zoom={5}
          minZoom={3}
          maxBounds={[[-90, -180], [90, 180]]}
          maxBoundsViscosity={1.0}
          worldCopyJump={false}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
        >
          <ZoomControl position="bottomright" />
          <LocateControl />
          <TileLayer
            key={mapStyle}
            attribution={mapStyle === 'mapbox' ? '&copy; Mapbox &copy; OpenStreetMap' : '&copy; Map data'}
            url={mapStyles[mapStyle]}
            {...(mapStyle === 'mapbox' ? { tileSize: 512, zoomOffset: -1 } : {})}
          />
          {flyCoords && <FlyToLocation lat={flyCoords.lat} lon={flyCoords.lon} setFlyCoords={setFlyCoords} />}
          <MapClickHandler setPosition={setPosition} setPlaceName={setPlaceName} />

          {selectedSharedMap
            ? selectedSharedMap.places.map((place, i) => (
              <Marker key={`s${i}`} position={[place.lat, place.lng]} icon={categoryDivIcon(place.category)}>
                <Popup>
                  <PlacePopup place={place} isShared sharedBy={selectedSharedMap.creatorName} />
                </Popup>
              </Marker>
            ))
            : visiblePlaces.map((place) => (
              <Marker key={place.id} position={[place.lat, place.lng]} icon={categoryDivIcon(place.category)}>
                <Popup>
                  <PlacePopup
                    key={`${place.completed}-${place.description}`}
                    place={place}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onToggle={handleToggleCompleted}
                  />
                </Popup>
              </Marker>
            ))
          }

          {position && !savedPlaces.find((p) => p.lat === position.lat && p.lng === position.lng) && (
            <Marker position={position} icon={defaultPinIcon} />
          )}
        </MapContainer>
      </div>

      {/* ── Category filter bar (top, below navbar) ─── */}
      <div
        className="scrollbar-none"
        style={{
          position: 'absolute', top: 86, left: 0, right: 0,
          zIndex: 1200, display: 'flex', gap: 8, overflowX: 'auto',
          padding: '0 12px',
        }}
      >
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

      {/* ── Add-to-bucket form — desktop panel ──────────── */}
      <div className="hidden md:block" style={{ position: 'absolute', bottom: 24, left: 16, width: 320, zIndex: 1200 }}>
        <div className="card rounded-3xl p-5">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div className="grid place-items-center rounded-xl" style={{ width: 28, height: 28, background: 'var(--gradient-primary)' }}>
              <Plus size={16} color="white" />
            </div>
            <h3 className="font-display" style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>
              Add to bucket
            </h3>
          </div>
          <AddBucketForm {...addFormProps} />
        </div>
      </div>

      {/* ── Add-to-bucket — mobile FAB ──────────────────── */}
      <button
        className="fab md:hidden"
        style={{ position: 'absolute', bottom: 24, right: 16, zIndex: 1200 }}
        onClick={() => setMobileFormOpen(true)}
        title="Add to bucket"
      >
        <Plus size={26} />
      </button>

      {mobileFormOpen && (
        <div className="sheet-overlay md:hidden" onClick={() => setMobileFormOpen(false)}>
          <div
            className="card animate-sheet-up"
            style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              borderRadius: '24px 24px 0 0', padding: '18px 16px 24px',
              maxHeight: '85vh', overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="grid place-items-center rounded-xl" style={{ width: 28, height: 28, background: 'var(--gradient-primary)' }}>
                  <Plus size={16} color="white" />
                </div>
                <h3 className="font-display" style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>
                  Add to bucket
                </h3>
              </div>
              <button className="icon-btn" onClick={() => setMobileFormOpen(false)}><X size={16} /></button>
            </div>
            <AddBucketForm {...addFormProps} />
          </div>
        </div>
      )}

      {/* ── Map style switcher (bottom right) ─────────── */}
      <div ref={mapStyleRef} style={{ position: 'absolute', bottom: 24, right: 16, zIndex: 1200 }} className="hidden md:block">
        <button
          onClick={() => setMapStyleOpen((v) => !v)}
          className="card"
          style={{
            borderRadius: 14, padding: '8px 14px', fontSize: 13, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 6, border: 'none', cursor: 'pointer',
            color: 'var(--ink)',
          }}
        >
          <Layers size={15} /> {MAP_STYLE_OPTIONS.find((s) => s.key === mapStyle)?.label || 'Style'}
          <ChevronDown size={13} style={{ transform: mapStyleOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
        </button>
        {mapStyleOpen && (
          <div className="animate-fade-in-up card" style={{
            position: 'absolute', bottom: 'calc(100% + 8px)', right: 0,
            borderRadius: 16, padding: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, width: 240,
          }}>
            {MAP_STYLE_OPTIONS.map((s) => (
              <button
                key={s.key}
                onClick={() => { setMapStyle(s.key); setMapStyleOpen(false); }}
                style={{
                  padding: '8px 10px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: mapStyle === s.key ? 'var(--gradient-primary)' : 'var(--muted)',
                  color: mapStyle === s.key ? 'white' : 'var(--ink)',
                  fontWeight: 600, fontSize: 12, fontFamily: "'Poppins', sans-serif",
                  transition: 'all .15s',
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Mobile map style icon button */}
      <div ref={mapStyleRefMobile} className="md:hidden" style={{ position: 'absolute', bottom: 96, right: 16, zIndex: 1200 }}>
        <button onClick={() => setMapStyleOpen((v) => !v)} className="icon-btn" style={{ background: 'white', width: 40, height: 40 }}>
          <Layers size={17} />
        </button>
        {mapStyleOpen && (
          <div className="animate-fade-in-up card" style={{
            position: 'absolute', bottom: 'calc(100% + 8px)', right: 0,
            borderRadius: 16, padding: 8, display: 'grid', gap: 6, width: 170,
          }}>
            {MAP_STYLE_OPTIONS.map((s) => (
              <button
                key={s.key}
                onClick={() => { setMapStyle(s.key); setMapStyleOpen(false); }}
                style={{
                  padding: '8px 10px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: mapStyle === s.key ? 'var(--gradient-primary)' : 'var(--muted)',
                  color: mapStyle === s.key ? 'white' : 'var(--ink)',
                  fontWeight: 600, fontSize: 12, textAlign: 'left',
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Viewing shared map banner ──────────────────── */}
      {selectedSharedMap && (
        <div style={{
          position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          zIndex: 1300, maxWidth: 'calc(100vw - 32px)',
        }}>
          <div className="card" style={{
            borderRadius: 9999, padding: '10px 18px',
            display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600,
            color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {selectedSharedMap.isPublic ? <Globe size={15} style={{ flexShrink: 0, color: 'var(--primary)' }} /> : <Lock size={15} style={{ flexShrink: 0, color: 'var(--primary)' }} />}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>Viewing "{selectedSharedMap.title}"</span>
            <button
              onClick={() => setSelectedSharedMap(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-soft)', flexShrink: 0, display: 'flex' }}
            ><X size={16} /></button>
          </div>
        </div>
      )}

      {/* ── Share map modal ────────────────────────────── */}
      {showShareModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 2500,
          background: 'color-mix(in oklab, var(--ink) 45%, transparent)',
          backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div className="animate-scale-in card" style={{
            borderRadius: 24, padding: 24, width: '100%', maxWidth: 460,
            maxHeight: '90vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 className="font-display flex items-center gap-2" style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--ink)' }}>
                <Link2 size={18} style={{ color: 'var(--primary)' }} /> Share your map
              </h3>
              <button
                onClick={() => { setShowShareModal(false); setPrivateShareLink(''); setShareTitle(''); setShareDescription(''); setShareType('public'); }}
                className="icon-btn"
              ><X size={16} /></button>
            </div>

            {!privateShareLink ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <input
                  className="input-field"
                  placeholder="Map title…"
                  value={shareTitle}
                  onChange={(e) => setShareTitle(e.target.value)}
                />
                <textarea
                  className="textarea-field"
                  rows={3}
                  placeholder="Add a description (optional)…"
                  value={shareDescription}
                  onChange={(e) => setShareDescription(e.target.value)}
                />

                <div style={{ display: 'flex', gap: 10 }}>
                  {[
                    { key: 'public',  label: 'Public',  icon: Globe, desc: 'Anyone can discover & view' },
                    { key: 'private', label: 'Private', icon: Lock,  desc: 'Only people with the link' },
                  ].map((t) => {
                    const Icon = t.icon;
                    const active = shareType === t.key;
                    return (
                      <div
                        key={t.key}
                        onClick={() => setShareType(t.key)}
                        style={{
                          flex: 1, padding: '14px', borderRadius: 16, cursor: 'pointer', textAlign: 'center',
                          border: `1.5px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
                          background: active ? 'color-mix(in oklab, var(--primary) 8%, white)' : 'var(--muted)',
                          transition: 'all .18s',
                        }}
                      >
                        <Icon size={20} style={{ margin: '0 auto 6px', color: active ? 'var(--primary)' : 'var(--ink-soft)' }} />
                        <div style={{ fontWeight: 600, fontSize: 14, color: active ? 'var(--primary)' : 'var(--ink)' }}>{t.label}</div>
                        <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>{t.desc}</div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button className="btn-ghost" onClick={() => { setShowShareModal(false); setShareTitle(''); setShareDescription(''); setShareType('public'); }}>
                    Cancel
                  </button>
                  <button className="btn-primary" onClick={handleShareMap} disabled={sharingMap}>
                    {sharingMap ? 'Sharing…' : 'Share Map'}
                    {!sharingMap && <Share2 size={16} />}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <div className="mx-auto mb-3 grid place-items-center rounded-2xl" style={{ width: 56, height: 56, background: 'color-mix(in oklab, var(--green) 14%, white)' }}>
                  <Check size={28} style={{ color: 'var(--green)' }} />
                </div>
                <h4 className="font-display" style={{ color: 'var(--green)', margin: '0 0 8px', fontWeight: 700 }}>Map Shared!</h4>
                <p style={{ color: 'var(--ink-soft)', fontSize: 14, marginBottom: 16 }}>
                  Share this private link with your fellow dreamers.
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="input-field" value={privateShareLink} readOnly style={{ fontSize: 13 }} />
                  <button
                    className="btn-primary"
                    style={{ padding: '0.75rem 1.1rem', whiteSpace: 'nowrap' }}
                    onClick={() => { navigator.clipboard.writeText(privateShareLink); setShowShareLinkCopied(true); setTimeout(() => setShowShareLinkCopied(false), 2000); }}
                  >
                    {showShareLinkCopied ? <Check size={16} /> : <Link2 size={16} />}
                    {showShareLinkCopied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <button className="btn-ghost mt-4" onClick={() => { setShowShareModal(false); setPrivateShareLink(''); setShareTitle(''); setShareDescription(''); setShareType('public'); }}>
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Shared maps browser modal ──────────────────── */}
      {showSharedMapsModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 2500,
          background: 'color-mix(in oklab, var(--ink) 45%, transparent)',
          backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div className="animate-scale-in card" style={{
            borderRadius: 24, padding: 24, width: '100%', maxWidth: 560,
            maxHeight: '85vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 className="font-display flex items-center gap-2" style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--ink)' }}>
                <Globe2 size={18} style={{ color: 'var(--primary)' }} /> Shared Maps
              </h3>
              <button onClick={() => setShowSharedMapsModal(false)} className="icon-btn"><X size={16} /></button>
            </div>

            {sharedMapsLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <Loader2 size={38} className="animate-spin-smooth" style={{ color: 'var(--primary)', margin: '0 auto' }} />
                <p className="font-display" style={{ color: 'var(--ink)', marginTop: 12, fontWeight: 600 }}>Loading maps…</p>
              </div>
            ) : sharedMaps.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <Globe2 size={44} style={{ color: 'var(--border)', margin: '0 auto 12px' }} />
                <p style={{ color: 'var(--ink-soft)' }}>No shared maps yet. Be the first!</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {sharedMaps.map((map) => (
                  <div
                    key={map.id}
                    onClick={() => loadSharedMap(map)}
                    className="card"
                    style={{
                      borderRadius: 16, padding: '14px 16px', cursor: 'pointer',
                      background: map.isPublic ? 'var(--surface)' : 'color-mix(in oklab, var(--primary) 4%, white)',
                      transition: 'all .18s', position: 'relative',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; }}
                  >
                    {!map.isPublic && (
                      <span className="badge" style={{
                        position: 'absolute', top: 10, right: 10,
                        background: 'color-mix(in oklab, var(--primary) 12%, white)', color: 'var(--primary)',
                      }}><Lock size={11} /> Private</span>
                    )}
                    <h4 className="font-display" style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: 'var(--ink)', paddingRight: map.isPublic ? 0 : 80 }}>
                      {map.title}
                    </h4>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 13, color: 'var(--ink-soft)', display: 'flex', alignItems: 'center', gap: 5 }}>
                        {map.isPublic ? <Globe size={13} /> : <Lock size={13} />} by {map.creatorName}
                      </span>
                      <span className="badge" style={{ background: 'color-mix(in oklab, var(--teal) 14%, white)', color: 'var(--teal)' }}>
                        <MapPin size={11} /> {map.places?.length || 0}
                      </span>
                    </div>
                    {map.description && (
                      <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {map.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* leaflet attribution + popup overrides */}
      <style>{`
        .leaflet-control-attribution { font-size: 10px !important; }
        .leaflet-popup-content-wrapper { border-radius: 16px !important; box-shadow: var(--shadow-card) !important; border: 1px solid var(--border) !important; padding: 4px !important; }
        .leaflet-popup-tip { display: none !important; }
        .leaflet-popup-content { margin: 12px 14px !important; }
        .leaflet-bar a { color: var(--ink) !important; }
        .map-vivid .leaflet-tile-pane {
          filter: saturate(1.9) contrast(1.15) brightness(0.98);
        }
      `}</style>
    </div>
  );
}

export default MapPage;
