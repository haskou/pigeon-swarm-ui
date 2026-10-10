export function VerifiedIcon({ className }: { className: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M12 3.5 19 6v5.2c0 4.3-2.9 7.9-7 9.3-4.1-1.4-7-5-7-9.3V6l7-2.5Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="m8.8 12 2.2 2.2 4.2-4.4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
