/** The stored form of a GroupMessageReadMarker, sealed at rest. */
export type GroupMessageReadMarkerPrimitives = {
  extra: number;
  latestAt: number;
  through: number;
  unread: string[];
};
