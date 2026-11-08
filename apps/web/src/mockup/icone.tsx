const TRACCIATI = {
  treno: (
    <>
      <rect x="5" y="3" width="14" height="14" rx="3" />
      <path d="M5 10h14M8 17l-2 4M16 17l2 4" />
      <circle cx="9" cy="13.5" r=".6" />
      <circle cx="15" cy="13.5" r=".6" />
    </>
  ),
  busta: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="1.5" />
      <path d="m3.5 6 8.5 7 8.5-7" />
    </>
  ),
  cartolina: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="1.5" />
      <path d="M13 8v8M5 10h5M5 13h5" />
      <rect x="15.5" y="7.5" width="3.5" height="4" />
    </>
  ),
  percento: (
    <>
      <path d="M19 5 5 19" />
      <circle cx="7" cy="7" r="2.5" />
      <circle cx="17" cy="17" r="2.5" />
    </>
  ),
  freccia: <path d="M20 12H4m6-6-6 6 6 6" />,
  casa: <path d="M4 11 12 4l8 7v9H4z" />,
  corona: <path d="m3 8 4.5 4L12 5l4.5 7L21 8l-2 11H5z" />,
} as const;

export type NomeIcona = keyof typeof TRACCIATI;

export function Icona({ nome, className }: { nome: NomeIcona; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {TRACCIATI[nome]}
    </svg>
  );
}
