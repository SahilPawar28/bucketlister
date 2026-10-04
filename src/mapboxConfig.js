// Public Mapbox access token (pk.*), read from an env var so it never lands in source
// control — GitHub's push protection flags any Mapbox token in a public repo as a
// precaution against quota-draining abuse, even public ones. Set VITE_MAPBOX_TOKEN in
// your .env file locally and in your Vercel project's environment variables for deploys.
// This points at a Classic "Streets" style (raster-tile compatible, unlike the newer
// "Standard" architecture).
export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
export const MAPBOX_STYLE_OWNER = 'sahilpawar666';
export const MAPBOX_STYLE_ID = 'cmuswdl51003g01sdew8h432w';

// Bump this any time the style is republished in Mapbox Studio. Mapbox/browsers cache raster
// tiles by URL, and republishing a style does NOT change the tile URL — so without this,
// already-cached tiles keep showing old colors while freshly-fetched ones show new ones,
// producing visible "patches" of mismatched tiles on the map. Changing this value forces
// every tile to be re-fetched fresh.
export const MAPBOX_STYLE_VERSION = 3;
