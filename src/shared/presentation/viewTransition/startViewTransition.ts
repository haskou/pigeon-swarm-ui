type DocumentWithViewTransitions = Document & {
  startViewTransition?: (update: () => void) => {
    finished: Promise<void>;
    ready: Promise<void>;
    skipTransition: () => void;
    updateCallbackDone: Promise<void>;
  };
};

export function startViewTransition(update: () => void): void {
  if (typeof document === 'undefined') {
    update();

    return;
  }

  const reducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches;
  const viewTransition = (document as DocumentWithViewTransitions)
    .startViewTransition;

  if (reducedMotion || !viewTransition) {
    update();

    return;
  }

  viewTransition.call(document, update);
}
