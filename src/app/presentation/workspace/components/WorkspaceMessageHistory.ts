export type WorkspaceMessageHistory = {
  handleLoadOlder: () => Promise<void>;
  handleScroll: () => void;
};
