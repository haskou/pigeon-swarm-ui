export function LockIcon({ locked }: { locked: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="block h-4 w-4"
    >
      <path
        d={locked ? 'M7 10V8a5 5 0 0 1 10 0v2' : 'M9 10V8a5 5 0 0 1 8.7-3.4'}
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <path
        d="M6.5 10h11A1.5 1.5 0 0 1 19 11.5v7A1.5 1.5 0 0 1 17.5 20h-11A1.5 1.5 0 0 1 5 18.5v-7A1.5 1.5 0 0 1 6.5 10Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M12 14v2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
