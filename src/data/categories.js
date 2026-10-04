import { Mountain, UtensilsCrossed, Footprints, Heart, Landmark, Users, MapPin, CheckCircle2, Globe2 } from 'lucide-react';

export const CATEGORIES = [
  { key: 'Adventure', label: 'Adventure', icon: Mountain,         color: 'var(--teal)' },
  { key: 'Food',      label: 'Food',      icon: UtensilsCrossed,  color: 'var(--amber)' },
  { key: 'Solo',      label: 'Solo',      icon: Footprints,       color: 'var(--violet)' },
  { key: 'Romantic',  label: 'Romantic',  icon: Heart,            color: 'var(--pink)' },
  { key: 'Culture',   label: 'Culture',   icon: Landmark,         color: 'var(--blue)' },
  { key: 'Family',    label: 'Family',    icon: Users,            color: 'var(--green)' },
];

export const ALL_FILTERS = [
  { key: 'All', label: 'All', icon: Globe2, color: 'var(--ink-soft)' },
  ...CATEGORIES,
  { key: 'Completed', label: 'Visited', icon: CheckCircle2, color: 'var(--green)' },
];

export function catMeta(key) {
  return CATEGORIES.find((c) => c.key === key) || { icon: MapPin, color: 'var(--primary)', label: key };
}
