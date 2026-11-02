type P = { size?: number; className?: string };
const s = (size = 24) => ({
  width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
});

export const IHome = ({ size }: P) => (
  <svg {...s(size)}><path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" /></svg>
);
export const IBook = ({ size }: P) => (
  <svg {...s(size)}><path d="M2.5 8.5 12 4l9.5 4.5L12 13z" /><path d="M6 10.5V15c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5" /><path d="M21.5 8.5V13" /></svg>
);
export const IPlus = ({ size }: P) => (
  <svg {...s(size)} strokeWidth={2.4}><path d="M12 5v14M5 12h14" /></svg>
);
export const IChat = ({ size }: P) => (
  <svg {...s(size)}><path d="M12 20a8 8 0 1 0-7.2-4.5L4 20l4.5-.8A8 8 0 0 0 12 20z" /><path d="M9 10.5h6M9 13.5h4" /></svg>
);
export const IChart = ({ size }: P) => (
  <svg {...s(size)}><path d="M5 20V12M10 20V6M15 20v-9M20 20V9" strokeWidth={3} /></svg>
);
export const ICheck = ({ size }: P) => (
  <svg {...s(size)}><path d="M5 12.5 10 17l9-10" /></svg>
);
export const IReview = ({ size }: P) => (
  <svg {...s(size)}><rect x="4" y="3.5" width="16" height="17" rx="3" /><path d="m8.5 12 2.5 2.5 4.5-5" /></svg>
);
export const IUsers = ({ size }: P) => (
  <svg {...s(size)}><circle cx="9" cy="8" r="3.2" /><path d="M3 19c.6-3 3-4.8 6-4.8s5.4 1.8 6 4.8" /><path d="M16 5.2a3 3 0 0 1 0 5.6M18 14.6c1.6.6 2.7 2 3 4.4" /></svg>
);
export const IBack = ({ size }: P) => (
  <svg {...s(size)}><path d="M15 5 8 12l7 7" /></svg>
);
export const IChevron = ({ size }: P) => (
  <svg {...s(size ?? 18)}><path d="m9 5 7 7-7 7" /></svg>
);
export const IQr = ({ size }: P) => (
  <svg {...s(size)}><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><path d="M14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2" /></svg>
);
export const IPlay = ({ size }: P) => (
  <svg {...s(size)}><path d="M8 5.5v13l11-6.5z" fill="currentColor" /></svg>
);
export const ILock = ({ size }: P) => (
  <svg {...s(size)}><rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></svg>
);
export const ISend = ({ size }: P) => (
  <svg {...s(size)}><path d="M4 12 20 4l-6 16-3-7z" /></svg>
);
export const IGear = ({ size }: P) => (
  <svg {...s(size)}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
);
export const IBell = ({ size }: P) => (
  <svg {...s(size)}><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></svg>
);
export const IFile = ({ size }: P) => (
  <svg {...s(size)}><path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5z" /><path d="M14 3.5v5h5" /></svg>
);
