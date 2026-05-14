declare module 'tailwindcss-rtl' {
  import type { PluginCreator } from 'tailwindcss/types/config';
  const plugin: PluginCreator;
  export default plugin;
}

declare module 'shpjs' {
  import type { FeatureCollection } from 'geojson';
  type ShpBundle = {
    shp: ArrayBuffer | Buffer | Uint8Array;
    dbf?: ArrayBuffer | Buffer | Uint8Array;
    prj?: ArrayBuffer | Buffer | Uint8Array | string;
    cpg?: ArrayBuffer | Buffer | Uint8Array | string;
  };
  function shp(
    input: ArrayBuffer | Buffer | string | ShpBundle,
  ): Promise<FeatureCollection | FeatureCollection[]>;
  export default shp;
}

declare module 'ws' {
  const WebSocket: unknown;
  export default WebSocket;
}
