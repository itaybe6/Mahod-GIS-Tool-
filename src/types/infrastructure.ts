import type { Coordinates } from './common';

/**
 * 4th data layer (new) — infrastructure assets such as bridges, tunnels,
 * substations, railway stations, etc. Sources include Israel Rail, NTA,
 * Netivei Israel asset inventories.
 */

export type InfrastructureKind =
  | 'bridge'
  | 'tunnel'
  | 'substation'
  | 'train_station'
  | 'depot'
  | 'other';

export interface InfrastructureItem extends Coordinates {
  id: string;
  name: string;
  kind: InfrastructureKind;
  status?: 'planned' | 'in_progress' | 'active' | 'archived';
}
