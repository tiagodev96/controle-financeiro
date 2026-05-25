/* global React */
// ============================================================================
// Controle Financeiro — UI Kit primitives
// Exports to window so the screens.jsx + app.jsx files can use them.
// ============================================================================

// ─── Icons (Lucide-style, inlined to avoid external dep) ──────────────────
const SI = ({ d, size = 20, sw = 1.6, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" {...rest}>
    {d}
  </svg>
);

const Icon = {
  Dashboard:   (p) => <SI {...p} d={<><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></>} />,
  Plus:        (p) => <SI {...p} d={<><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></>} />,
  Receipt:     (p) => <SI {...p} d={<><path d="M5 4h14v17l-3-2-2 2-2-2-2 2-2-2-3 2V4z"/><path d="M9 9h6M9 13h6"/></>} />,
  Card:        (p) => <SI {...p} d={<><rect x="2" y="6" width="20" height="12" rx="1"/><path d="M2 10h20"/></>} />,
  More:        (p) => <SI {...p} d={<><path d="M4 6h16M4 12h16M4 18h16"/></>} />,
  Settings:    (p) => <SI {...p} d={<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>} />,
  Refresh:     (p) => <SI {...p} d={<><path d="M3 12a9 9 0 0 1 16-5"/><path d="M19 4v4h-4"/><path d="M21 12a9 9 0 0 1-16 5"/><path d="M5 20v-4h4"/></>} />,
  Home:        (p) => <SI {...p} d={<><path d="M3 9.5l9-6 9 6V20a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1V9.5z"/></>} />,
  Food:        (p) => <SI {...p} d={<><path d="M3 11c0-1.5 2-3 9-3s9 1.5 9 3M3 11h18M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8M9 11V7M15 11V7"/></>} />,
  Pet:         (p) => <SI {...p} d={<><circle cx="5" cy="9" r="2"/><circle cx="19" cy="9" r="2"/><circle cx="9" cy="5" r="2"/><circle cx="15" cy="5" r="2"/><path d="M12 11a4 4 0 0 0-4 4c0 2 2 3 4 6 2-3 4-4 4-6a4 4 0 0 0-4-4z"/></>} />,
  Health:      (p) => <SI {...p} d={<><path d="M12 21s-7-4.5-9-10a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 5.5-9 10-9 10z"/></>} />,
  Fun:         (p) => <SI {...p} d={<><rect x="3" y="6" width="18" height="13" rx="1"/><path d="M3 10h18M8 3v6"/></>} />,
  Car:         (p) => <SI {...p} d={<><path d="M5 17v3M19 17v3M3 13l2-5h14l2 5M3 13v4h18v-4M3 13h18"/><circle cx="7" cy="15" r="1.2"/><circle cx="17" cy="15" r="1.2"/></>} />,
  Chevron:     (p) => <SI {...p} d={<><path d="M9 18l6-6-6-6"/></>} />,
  Check:       (p) => <SI {...p} d={<><path d="M20 6L9 17l-5-5"/></>} />,
  Cal:         (p) => <SI {...p} d={<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></>} />,
  Search:      (p) => <SI {...p} d={<><circle cx="11" cy="11" r="7"/><path d="M21 21l-5-5"/></>} />,
  Filter:      (p) => <SI {...p} d={<><path d="M3 5h18M6 12h12M10 19h4"/></>} />,
  Pause:       (p) => <SI {...p} d={<><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></>} />,
  Alert:       (p) => <SI {...p} d={<><path d="M12 3l10 18H2L12 3z"/><path d="M12 10v5M12 18v0.5"/></>} />,
  ArrowDown:   (p) => <SI {...p} d={<><path d="M12 5v14M5 12l7 7 7-7"/></>} />,
  ArrowUp:     (p) => <SI {...p} d={<><path d="M12 19V5M5 12l7-7 7 7"/></>} />,
  Logo:        (p) => <SI {...p} d={<><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M7 9h10M7 13h7M7 17h9"/></>} sw={1.5} />,
};

// ─── Tokens (mirror the CSS vars for inline use) ──────────────────────────
const T = {
  bg:       'var(--bg-base)',
  surface:  'var(--bg-surface)',
  inset:    'var(--bg-inset)',
  raised:   'var(--bg-raised)',
  fg1:      'var(--fg1)',
  fg2:      'var(--fg2)',
  fg3:      'var(--fg3)',
  fg4:      'var(--fg4)',
  border:   'var(--border)',
  borderSoft: 'var(--border-soft)',
  brand:    'var(--brand)',
  brandFg:  'var(--fg-on-brand)',
  brandBg:  'var(--brand-quiet-bg)',
  brandQF:  'var(--brand-quiet-fg)',
  pos:      'var(--money-positive)',
  neg:      'var(--money-negative)',
  posBg:    'var(--money-positive-bg)',
  negBg:    'var(--money-negative-bg)',
  paidFg:   'var(--status-paid-fg)',
  paidBg:   'var(--status-paid-bg)',
  pendFg:   'var(--status-pending-fg)',
  pendBg:   'var(--status-pending-bg)',
  overFg:   'var(--status-overdue-fg)',
  overBg:   'var(--status-overdue-bg)',
  fontSans: "Geist, ui-sans-serif, system-ui, sans-serif",
  fontMono: "'JetBrains Mono', ui-monospace, monospace",
  fontNum:  "Geist, ui-sans-serif, system-ui, sans-serif",
};

// ─── Number formatting ────────────────────────────────────────────────────
function fmt(cents, { currency = 'EUR', sign = false } = {}) {
  const abs = Math.abs(cents) / 100;
  const s = abs.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const symbol = currency === 'EUR' ? '€' : 'R$';
  const neg = cents < 0;
  const plus = sign && cents > 0 ? '+' : '';
  return `${neg ? '−' : plus}${symbol}\u00A0${s}`;
}

// Split formatter that returns parts for the hero treatment
function fmtParts(cents, currency = 'EUR') {
  const abs = Math.abs(cents) / 100;
  const [intPart, fracPart] = abs.toLocaleString('pt-BR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).split(',');
  return {
    symbol: currency === 'EUR' ? '€' : 'R$',
    sign: cents < 0 ? '−' : '',
    int: intPart,
    frac: fracPart,
  };
}

// ─── Primitives ───────────────────────────────────────────────────────────

function Num({ cents, currency = 'EUR', sign = false, size = 16, weight = 600, color, style }) {
  return (
    <span style={{
      fontFamily: T.fontNum,
      fontVariantNumeric: 'tabular-nums',
      fontFeatureSettings: '"tnum","lnum","ss01"',
      fontWeight: weight,
      fontSize: size,
      letterSpacing: '-0.02em',
      color: color || T.fg1,
      whiteSpace: 'nowrap',
      ...style,
    }}>{fmt(cents, { currency, sign })}</span>
  );
}

function HeroNumber({ cents, currency = 'EUR', sizeInt = 56, sizeFrac = 28, sizeSym = 24 }) {
  const p = fmtParts(cents, currency);
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
      <span style={{
        fontFamily: T.fontSans,
        fontSize: sizeSym, color: T.fg3, fontWeight: 500, lineHeight: 1,
        letterSpacing: '-0.02em',
      }}>{p.sign}{p.symbol}</span>
      <span style={{
        fontFamily: T.fontNum, fontVariantNumeric: 'tabular-nums',
        fontFeatureSettings: '"tnum","lnum","ss01"',
        fontWeight: 700, fontSize: sizeInt, color: T.fg1,
        letterSpacing: '-0.035em', lineHeight: 0.95,
      }}>{p.int}</span>
      <span style={{
        fontFamily: T.fontNum, fontVariantNumeric: 'tabular-nums',
        fontFeatureSettings: '"tnum","lnum","ss01"',
        fontWeight: 500, fontSize: sizeFrac, color: T.fg3,
        letterSpacing: '-0.02em',
      }}>,{p.frac}</span>
    </div>
  );
}

function Eyebrow({ children, color = T.fg3, style }) {
  return (
    <span style={{
      fontFamily: T.fontSans, fontSize: 11, fontWeight: 600,
      textTransform: 'uppercase', letterSpacing: '0.08em',
      color, ...style,
    }}>{children}</span>
  );
}

// SectionLabel — sentence-case sans label that sits ABOVE the hero number.
// Replaces the old Editorial italic. Kept under the name `Editorial` for
// backward compat in screens.jsx — but it's plain Geist now.
function Editorial({ children, size = 13, color = T.fg3, style }) {
  return (
    <span style={{
      fontFamily: T.fontSans,
      fontSize: size, color, letterSpacing: '0.005em',
      fontWeight: 500, lineHeight: 1.2, ...style,
    }}>{children}</span>
  );
}

function StatusPill({ kind, children, dot = true }) {
  const map = {
    paid:    { fg: T.paidFg, bg: T.paidBg },
    pending: { fg: T.pendFg, bg: T.pendBg },
    overdue: { fg: T.overFg, bg: T.overBg },
    rec:     { fg: T.brandQF, bg: T.brandBg },
    neutral: { fg: T.fg3, bg: T.inset },
  };
  const c = map[kind] || map.neutral;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 8px', borderRadius: 9999,
      fontFamily: T.fontSans, fontSize: 10, fontWeight: 600,
      textTransform: 'uppercase', letterSpacing: '0.06em',
      color: c.fg, background: c.bg,
      border: `1px solid ${c.fg}22`,
    }}>
      {dot && <span style={{ width: 5, height: 5, borderRadius: '50%', background: c.fg }} />}
      {children}
    </span>
  );
}

function Btn({ variant = 'primary', size = 'md', children, onClick, style, disabled, leading }) {
  const sizes = {
    sm: { h: 32, px: 12, fs: 13 },
    md: { h: 40, px: 16, fs: 14 },
    lg: { h: 52, px: 22, fs: 16 },
  }[size];
  const variants = {
    primary:   { bg: T.brand, fg: T.brandFg, bd: 'transparent' },
    secondary: { bg: T.inset, fg: T.fg1, bd: T.border },
    ghost:     { bg: 'transparent', fg: T.fg2, bd: 'transparent' },
    danger:    { bg: 'var(--money-negative-bg)', fg: 'var(--money-negative)', bd: 'color-mix(in oklch, var(--money-negative) 30%, transparent)' },
  }[variant];
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      height: sizes.h, padding: `0 ${sizes.px}px`, borderRadius: 6,
      fontFamily: T.fontSans, fontSize: sizes.fs, fontWeight: 600,
      letterSpacing: '-0.005em',
      background: variants.bg, color: variants.fg,
      border: `1px solid ${variants.bd}`, cursor: 'pointer',
      opacity: disabled ? 0.4 : 1,
      transition: 'background 150ms cubic-bezier(0.2,0,0,1)',
      ...style,
    }}>
      {leading}{children}
    </button>
  );
}

function Card({ children, style, padded = true }) {
  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${T.borderSoft}`,
      borderRadius: 6,
      padding: padded ? '14px 16px' : 0,
      ...style,
    }}>{children}</div>
  );
}

// Currency code tag — small, mono, dot
function CCY({ code }) {
  const c = code === 'EUR' ? 'var(--brass-300)' : 'var(--sage-300)';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 7px', borderRadius: 4,
      background: T.inset, border: `1px solid ${T.borderSoft}`,
      fontFamily: T.fontMono, fontSize: 10, fontWeight: 500,
      color: T.fg2, letterSpacing: '0.04em',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: c }} />
      {code}
    </span>
  );
}

Object.assign(window, { Icon, T, fmt, fmtParts, Num, HeroNumber, Eyebrow, Editorial, StatusPill, Btn, Card, CCY });
