declare module 'tailwindcss-rtl' {
  import type { PluginCreator } from 'tailwindcss/types/config';
  const plugin: PluginCreator;
  export default plugin;
}

declare module 'shpjs' {
  import type { FeatureCollection } from 'geojson';
  function shp(input: ArrayBuffer | Buffer | string): Promise<FeatureCollection | FeatureCollection[]>;
  export default shp;
}

declare module 'ws' {
  const WebSocket: unknown;
  export default WebSocket;
}
