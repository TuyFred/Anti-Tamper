import { TileLayer } from 'react-leaflet';
import { MAP_TILE_CONFIG } from '../lib/mapConfig';

/** Standard English-friendly map tiles used across the app. */
export default function AppMapTileLayer() {
  return (
    <TileLayer
      attribution={MAP_TILE_CONFIG.attribution}
      url={MAP_TILE_CONFIG.url}
      subdomains={MAP_TILE_CONFIG.subdomains}
    />
  );
}
