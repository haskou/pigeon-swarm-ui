export type ActivityTracker = {
  isActive: () => boolean;
  stop: () => void;
};
