import { TileLayer } from 'react-leaflet';
import { MAP_TILE_CONFIG } from '../lib/mapConfig';

/** OpenStreetMap tiles — real streets and place names in Rwanda */
export default function AppMapTileLayer() {
  return (
    <TileLayer
      attribution={MAP_TILE_CONFIG.attribution}
      url={MAP_TILE_CONFIG.url}
      subdomains={MAP_TILE_CONFIG.subdomains}
      maxZoom={MAP_TILE_CONFIG.maxZoom}
      minZoom={MAP_TILE_CONFIG.minZoom}
    />
  );
}
