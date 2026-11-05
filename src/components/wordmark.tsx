/** Logo provisorio: tipográfico, con un grano de café como corazón */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 32 32" className="size-7 text-accent" aria-hidden>
        <path
          d="M16 28C9 23 4 18.5 4 12.5 4 8.4 7 5.5 10.6 5.5c2.3 0 4.2 1.2 5.4 3 1.2-1.8 3.1-3 5.4-3C25 5.5 28 8.4 28 12.5 28 18.5 23 23 16 28Z"
          fill="currentColor"
        />
        <path
          d="M16 9.5c-1.6 3.2-1.6 6.3 0 9.5s1.6 5.4 0 7"
          fill="none"
          stroke="var(--color-paper)"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
      <span className="font-display text-2xl leading-none font-medium tracking-tight">
        Kaffa <span className="italic">Love</span>
      </span>
    </span>
  );
}
