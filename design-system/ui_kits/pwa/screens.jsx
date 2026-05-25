/* global React, Icon, T, Num, HeroNumber, Eyebrow, Editorial, StatusPill, Btn, Card, CCY, fmt */
// ============================================================================
// Controle Financeiro — App screens
// ============================================================================

const useStateS = React.useState;

// ─── Shared app top bar ───────────────────────────────────────────────────
function AppTopBar({ title, eyebrow, trailing }) {
  return (
    <div style={{
      padding: '14px 20px 8px',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
      gap: 12,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {eyebrow && <Eyebrow style={{ whiteSpace: 'nowrap' }}>{eyebrow}</Eyebrow>}
        <h1 style={{
          margin: 0, fontFamily: T.fontSans, fontSize: 26, fontWeight: 600,
          color: T.fg1, letterSpacing: '-0.025em', lineHeight: 1.1,
        }}>{title}</h1>
      </div>
      {trailing}
    </div>
  );
}

// ─── Bottom nav ───────────────────────────────────────────────────────────
function BottomNav({ active, onChange }) {
  const items = [
    { id: 'dashboard',  label: 'Dashboard', Icon: Icon.Dashboard },
    { id: 'lancar',     label: 'Lançar',    Icon: Icon.Plus },
    { id: 'transacoes', label: 'Transações',Icon: Icon.Receipt },
    { id: 'dividas',    label: 'Dívidas',   Icon: Icon.Card },
    { id: 'mais',       label: 'Mais',      Icon: Icon.More },
  ];
  // sub-pages of "Mais"
  const navMap = {
    dashboard: 'dashboard', lancar: 'lancar', transacoes: 'transacoes', dividas: 'dividas',
    mais: 'mais', contas: 'mais', resumo: 'mais', recorrentes: 'mais', categorias: 'mais',
  };
  const parent = navMap[active] || active;
  return (
    <nav style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 40,
      background: 'color-mix(in oklch, var(--bg-base) 92%, transparent)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderTop: `1px solid ${T.borderSoft}`,
      paddingBottom: 30, // home indicator space
      paddingTop: 6,
    }}>
      <ul style={{
        margin: 0, padding: 0, listStyle: 'none',
        display: 'grid', gridTemplateColumns: 'repeat(5,1fr)',
      }}>
        {items.map(({ id, label, Icon: I }) => {
          const a = id === parent;
          return (
            <li key={id}>
              <button onClick={() => onChange(id)} style={{
                width: '100%', height: 50, background: 'transparent', border: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
                cursor: 'pointer', color: a ? T.brand : T.fg3,
                fontFamily: T.fontSans, fontSize: 10, fontWeight: 600,
                letterSpacing: '0.01em',
              }}>
                <I size={20} sw={a ? 1.9 : 1.6} />
                <span>{label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// ─── Ledger divider (full-width hairline) ─────────────────────────────────
function Hr() {
  return <div style={{ height: 1, background: T.borderSoft }} />;
}

// ============================================================================
// SCREEN: Dashboard
// ============================================================================
function DashboardScreen() {
  return (
    <div style={{ paddingBottom: 100 }}>
      <AppTopBar
        eyebrow="Maio · 2026"
        title="Dashboard"
        trailing={
          <div style={{ display: 'flex', gap: 6 }}>
            <button style={iconBtn}><Icon.Search size={18} /></button>
            <button style={iconBtn}><Icon.Settings size={18} /></button>
          </div>
        }
      />

      {/* HERO — Saldo atual */}
      <section style={{ padding: '12px 20px 18px' }}>
        <Editorial size={15} color={T.fg3}>Saldo atual</Editorial>
        <div style={{ marginTop: 6 }}>
          <HeroNumber cents={218314} currency="EUR" sizeInt={56} sizeFrac={28} sizeSym={26} />
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginTop: 12,
        }}>
          <CCY code="EUR" />
          <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.fg3 }}>€ 1.840,00</span>
          <span style={{ color: T.fg5 }}>·</span>
          <CCY code="BRL" />
          <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.fg3 }}>R$ 2.103,80</span>
        </div>
        <div style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.fg4, marginTop: 6 }}>
          EUR→BRL · 6,1240 · atualizado 09:12
        </div>
      </section>

      {/* SOBRA PREVISTA */}
      <section style={{ padding: '0 20px 16px' }}>
        <Card padded={false} style={{ background: T.surface, padding: '16px 18px', borderRadius: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <Editorial size={15} color={T.fg3}>Sobra prevista</Editorial>
              <div style={{ fontSize: 10, fontFamily: T.fontMono, color: T.fg4, marginTop: 2 }}>
                até 31 mai
              </div>
            </div>
            <span style={{
              fontFamily: T.fontMono, fontSize: 10, color: T.brandQF,
              padding: '2px 7px', background: T.brandBg, borderRadius: 4,
              letterSpacing: '0.04em',
            }}>EUR</span>
          </div>
          <div style={{ marginTop: 8 }}>
            <Num cents={61240} sign size={36} weight={700} color={T.pos} style={{ letterSpacing: '-0.03em' }} />
          </div>
          <Hr />
          <div style={{
            marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12,
          }}>
            <Calc label="entradas" cents={148000} color={T.pos} />
            <Calc label="pendentes" cents={-77400} color={T.fg2} />
            <Calc label="atraso" cents={-9200} color={T.neg} />
          </div>
        </Card>
      </section>

      {/* STAT CARDS */}
      <section style={{ padding: '0 20px 16px', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
        <StatCard kind="paid"    label="Pago"     cents={145000} sub="8 lanç." />
        <StatCard kind="pending" label="Pendente" cents={13760}  sub="3 lanç." />
        <StatCard kind="overdue" label="Atraso"   cents={9200}   sub="1 · 4d" />
      </section>

      {/* DEBT SUGGESTION */}
      <section style={{ padding: '4px 20px 16px' }}>
        <div style={{
          background: T.brandBg, border: `1px solid color-mix(in oklch, var(--brand) 30%, transparent)`,
          borderRadius: 6, padding: '14px 16px',
        }}>
          <Eyebrow color={T.brandQF}>Sugestão</Eyebrow>
          <div style={{ marginTop: 6, fontSize: 14, color: T.fg1, lineHeight: 1.4 }}>
            Sua sobra prevista é <Num cents={61240} size={14} weight={600} color={T.fg1} />. Quitar{' '}
            <Num cents={36744} size={14} weight={600} color={T.fg1} />{' '}
            da <span style={{ color: T.fg2 }}>Empréstimo Jefferson</span> (19,6%).
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
            <Btn size="sm" variant="primary">Registrar pagamento</Btn>
            <Btn size="sm" variant="ghost" style={{ color: T.brandQF }}>Outras dívidas</Btn>
          </div>
        </div>
      </section>

      {/* TOP CATEGORIAS */}
      <section style={{ padding: '4px 20px 16px' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <h2 style={{ margin: 0, fontFamily: T.fontSans, fontSize: 18, fontWeight: 600, color: T.fg1 }}>Top categorias</h2>
          <span style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.fg4 }}>maio</span>
        </header>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <CatBar Icon={Icon.Home}   label="Moradia"     cents={80000} pct={0.78} />
          <CatBar Icon={Icon.Food}   label="Alimentação" cents={32450} pct={0.32} />
          <CatBar Icon={Icon.Pet}    label="Pet"         cents={9200}  pct={0.10} />
          <CatBar Icon={Icon.Health} label="Saúde"       cents={7000}  pct={0.07} />
        </div>
      </section>

      {/* PRÓXIMOS 7 DIAS */}
      <section style={{ padding: '4px 20px 24px' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <h2 style={{ margin: 0, fontFamily: T.fontSans, fontSize: 18, fontWeight: 600, color: T.fg1 }}>Próximos 7 dias</h2>
          <span style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.fg4 }}>3 lanç.</span>
        </header>
        <Card padded={false}>
          <UpcomingRow date="01 jun" desc="Aluguel"      cat="Moradia"  cents={-80000} pill="rec" />
          <Hr />
          <UpcomingRow date="03 jun" desc="NOS internet" cat="Casa"     cents={-4400}  pill="rec" />
          <Hr />
          <UpcomingRow date="05 jun" desc="Notebook"     cat="Parcela 3/10" cents={-8759}  pill="inst" />
        </Card>
      </section>
    </div>
  );
}

// helpers for the dashboard
const iconBtn = {
  width: 36, height: 36, borderRadius: 6,
  background: 'transparent', border: `1px solid ${T.borderSoft}`,
  color: T.fg2, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

function Calc({ label, cents, color }) {
  return (
    <div>
      <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.fg4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </div>
      <div style={{ marginTop: 3 }}>
        <Num cents={cents} sign size={14} weight={600} color={color} />
      </div>
    </div>
  );
}

function StatCard({ kind, label, cents, sub }) {
  const map = { paid: T.paidFg, pending: T.pendFg, overdue: T.overFg };
  const c = map[kind];
  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.borderSoft}`, borderRadius: 6,
      padding: '11px 12px', display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: c }} />
        <span style={{ fontFamily: T.fontSans, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: c }}>
          {label}
        </span>
      </div>
      <Num cents={cents} size={22} weight={700} color={kind === 'overdue' ? T.neg : T.fg1} />
      <span style={{ fontFamily: T.fontMono, fontSize: 10, color: T.fg4 }}>{sub}</span>
    </div>
  );
}

function CatBar({ Icon: I, label, cents, pct }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.fg2, fontSize: 13, fontWeight: 500 }}>
          <span style={{ color: T.fg3 }}><I size={14} /></span>{label}
        </span>
        <Num cents={cents} size={13} weight={600} color={T.fg2} />
      </div>
      <div style={{ height: 4, background: T.inset, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct*100}%`, height: '100%', background: T.brand }} />
      </div>
    </div>
  );
}

function UpcomingRow({ date, desc, cat, cents, pill }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '46px 1fr auto',
      gap: 10, alignItems: 'center', padding: '10px 14px',
    }}>
      <div style={{
        fontFamily: T.fontMono, fontSize: 11, color: T.fg3, textAlign: 'center',
        lineHeight: 1.2, padding: '4px 0',
        borderRight: `1px solid ${T.borderSoft}`,
      }}>
        <div style={{ fontWeight: 600, color: T.fg2 }}>{date.split(' ')[0]}</div>
        <div style={{ fontSize: 9, color: T.fg4 }}>{date.split(' ')[1]}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: T.fg1 }}>{desc}</span>
        <span style={{ fontSize: 11, color: T.fg3 }}>
          {cat} {pill === 'rec' && '· recorrente'} {pill === 'inst' && '· parcela'}
        </span>
      </div>
      <Num cents={cents} size={14} weight={600} color={T.fg2} />
    </div>
  );
}

// ============================================================================
// SCREEN: Lançar despesa
// ============================================================================
function LancarScreen() {
  const [amount, setAmount] = useStateS(14255);
  const [desc, setDesc] = useStateS('Mercado · Pingo Doce');
  const [cat, setCat] = useStateS('alim');
  const [acct, setAcct] = useStateS('eur');
  const [paid, setPaid] = useStateS(true);
  const [direction, setDirection] = useStateS('out');

  const categories = [
    { id: 'mor',    label: 'Moradia',     Icon: Icon.Home },
    { id: 'alim',   label: 'Alimentação', Icon: Icon.Food },
    { id: 'pet',    label: 'Pet',         Icon: Icon.Pet },
    { id: 'saude',  label: 'Saúde',       Icon: Icon.Health },
    { id: 'lazer',  label: 'Lazer',       Icon: Icon.Fun },
    { id: 'transp', label: 'Transporte',  Icon: Icon.Car },
  ];

  return (
    <div style={{ paddingBottom: 100 }}>
      <AppTopBar
        eyebrow="Nova"
        title="Lançar"
        trailing={
          <button style={{ ...iconBtn, width: 'auto', padding: '0 12px', gap: 6, display: 'inline-flex', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: T.fg2 }}>Cancelar</span>
          </button>
        }
      />

      {/* Direction toggle */}
      <section style={{ padding: '6px 20px 14px' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', padding: 3,
          background: T.inset, borderRadius: 8, border: `1px solid ${T.borderSoft}`,
          gap: 2,
        }}>
          <ToggleSeg active={direction === 'out'} onClick={() => setDirection('out')}>
            <Icon.ArrowDown size={14} /> Despesa
          </ToggleSeg>
          <ToggleSeg active={direction === 'in'} onClick={() => setDirection('in')}>
            <Icon.ArrowUp size={14} /> Entrada
          </ToggleSeg>
        </div>
      </section>

      {/* Value — hero input */}
      <section style={{ padding: '0 20px 18px' }}>
        <Eyebrow>Valor</Eyebrow>
        <div style={{
          marginTop: 6, padding: '14px 16px',
          background: T.inset, border: `1px solid ${T.brand}`,
          borderRadius: 8,
          boxShadow: `0 0 0 3px oklch(73% 0.135 80 / 0.18)`,
          display: 'flex', alignItems: 'baseline', gap: 8,
        }}>
          <span style={{
            fontFamily: T.fontSans,
            fontSize: 26, color: T.fg3, fontWeight: 500, letterSpacing: '-0.01em',
          }}>{acct === 'eur' ? '€' : 'R$'}</span>
          <span style={{
            fontFamily: T.fontNum, fontVariantNumeric: 'tabular-nums',
            fontWeight: 700, fontSize: 38, color: T.fg1,
            letterSpacing: '-0.03em', lineHeight: 1,
          }}>
            {(amount/100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </section>

      {/* Descrição */}
      <section style={{ padding: '0 20px 18px' }}>
        <Eyebrow>Descrição</Eyebrow>
        <input
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          style={{
            marginTop: 6, width: '100%', boxSizing: 'border-box',
            background: T.inset, border: `1px solid ${T.border}`,
            borderRadius: 6, padding: '12px 14px',
            fontFamily: T.fontSans, fontSize: 15, color: T.fg1,
            outline: 'none',
          }}
        />
      </section>

      {/* Categoria */}
      <section style={{ padding: '0 20px 18px' }}>
        <Eyebrow>Categoria</Eyebrow>
        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {categories.map(({ id, label, Icon: I }) => {
            const a = id === cat;
            return (
              <button key={id} onClick={() => setCat(id)} aria-pressed={a} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                height: 32, padding: '0 12px', borderRadius: 9999,
                background: a ? T.brandBg : T.inset,
                color: a ? T.brandQF : T.fg2,
                border: `1px solid ${a ? 'color-mix(in oklch, var(--brand) 40%, transparent)' : T.borderSoft}`,
                fontFamily: T.fontSans, fontSize: 13, fontWeight: a ? 600 : 500,
                cursor: 'pointer',
              }}>
                <I size={13} sw={a ? 1.9 : 1.6} />{label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Conta + Data */}
      <section style={{ padding: '0 20px 18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Field label="Conta">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              fontFamily: T.fontMono, fontSize: 10, color: T.brandQF,
              padding: '1px 5px', background: T.brandBg, borderRadius: 3,
              letterSpacing: '0.04em',
            }}>{acct === 'eur' ? 'EUR' : 'BRL'}</span>
            <span style={{ fontSize: 14, color: T.fg1, fontWeight: 500 }}>Tiago · revolut</span>
          </div>
        </Field>
        <Field label="Data">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon.Cal size={14} style={{ color: T.fg3 }} />
            <span style={{ fontSize: 14, color: T.fg1, fontWeight: 500 }}>25 mai 2026</span>
          </div>
        </Field>
      </section>

      {/* Já pago */}
      <section style={{ padding: '0 20px 22px' }}>
        <button onClick={() => setPaid(!paid)} style={{
          width: '100%', background: T.surface, border: `1px solid ${T.borderSoft}`,
          borderRadius: 6, padding: '12px 14px', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start' }}>
            <span style={{ fontFamily: T.fontSans, fontSize: 14, fontWeight: 500, color: T.fg1 }}>Já pago</span>
            <span style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.fg4 }}>desconta do saldo da conta</span>
          </div>
          <div style={{
            width: 38, height: 22, borderRadius: 12,
            background: paid ? T.brand : T.inset,
            border: `1px solid ${paid ? T.brand : T.border}`,
            position: 'relative', transition: '150ms',
          }}>
            <div style={{
              position: 'absolute', top: 2, left: paid ? 18 : 2,
              width: 16, height: 16, borderRadius: '50%',
              background: paid ? T.brandFg : T.fg2,
              transition: 'left 150ms cubic-bezier(0.2,0,0,1)',
            }} />
          </div>
        </button>
      </section>

      {/* Submit */}
      <section style={{ padding: '0 20px 24px' }}>
        <Btn size="lg" variant="primary" style={{ width: '100%' }}>
          Lançar despesa · {fmt(amount, { currency: acct === 'eur' ? 'EUR' : 'BRL' })}
        </Btn>
        <div style={{
          marginTop: 10, fontFamily: T.fontMono, fontSize: 10.5,
          color: T.fg4, textAlign: 'center',
        }}>
          Saldo previsto após: <span style={{ color: T.fg2 }}>{fmt(218314 - amount, { currency: 'EUR' })}</span>
        </div>
      </section>
    </div>
  );
}

function ToggleSeg({ active, children, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      height: 36, borderRadius: 6, cursor: 'pointer',
      background: active ? T.surface : 'transparent',
      color: active ? T.fg1 : T.fg3,
      border: active ? `1px solid ${T.border}` : '1px solid transparent',
      fontFamily: T.fontSans, fontSize: 13, fontWeight: active ? 600 : 500,
    }}>{children}</button>
  );
}

function Field({ label, children }) {
  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.borderSoft}`, borderRadius: 6,
      padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <Eyebrow style={{ fontSize: 10 }}>{label}</Eyebrow>
      {children}
    </div>
  );
}

// ============================================================================
// SCREEN: Dívidas
// ============================================================================
function DividasScreen() {
  const debts = [
    {
      name: 'Empréstimo Jefferson', priority: 'Alta', currency: 'EUR',
      total: 300000, paid: 112500, pct: 0.375,
      note: 'Pagar 60%+ se sobrar este mês',
    },
    {
      name: 'Notebook · Apple', priority: 'Média', currency: 'EUR',
      total: 175900, paid: 87596, pct: 0.498,
      note: 'Parcela 5/10 · 5 jun',
      installment: true,
    },
    {
      name: 'Cartão Nubank', priority: 'Baixa', currency: 'BRL',
      total: 84300, paid: 32100, pct: 0.381,
      note: 'Fechamento dia 22',
    },
  ];
  const totalRestEur = (300000 - 112500) + (175900 - 87596);
  const totalRestBrl = (84300 - 32100);

  return (
    <div style={{ paddingBottom: 100 }}>
      <AppTopBar
        eyebrow="3 em aberto"
        title="Dívidas"
        trailing={
          <button style={{
            ...iconBtn, width: 'auto', padding: '0 12px', gap: 6,
            color: T.brand, borderColor: 'transparent', display: 'inline-flex', alignItems: 'center',
          }}>
            <Icon.Plus size={16} /><span style={{ fontSize: 13, fontWeight: 600 }}>Nova</span>
          </button>
        }
      />

      {/* Total a quitar */}
      <section style={{ padding: '6px 20px 18px' }}>
        <Card style={{ padding: '14px 16px' }}>
          <Editorial size={14} color={T.fg3}>Total em aberto</Editorial>
          <div style={{ marginTop: 4, display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <Num cents={totalRestEur} size={28} weight={700} color={T.fg1} style={{ letterSpacing: '-0.025em' }} />
            <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.fg4 }}>+</span>
            <Num cents={totalRestBrl} currency="BRL" size={18} weight={600} color={T.fg2} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <CCY code="EUR" />
            <CCY code="BRL" />
          </div>
        </Card>
      </section>

      {/* DEBT LIST */}
      <section style={{ padding: '0 20px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {debts.map((d) => (
          <DebtRow key={d.name} {...d} />
        ))}
      </section>
    </div>
  );
}

function DebtRow({ name, priority, currency, total, paid, pct, note, installment }) {
  const remaining = total - paid;
  const priorityMap = {
    Alta: { fg: T.neg, bg: 'var(--money-negative-bg)' },
    Média: { fg: T.brandQF, bg: T.brandBg },
    Baixa: { fg: T.fg3, bg: T.inset },
  };
  const p = priorityMap[priority];
  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.borderSoft}`, borderRadius: 6,
      padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: T.fontSans, fontSize: 15, fontWeight: 600, color: T.fg1 }}>{name}</span>
            {installment && <StatusPill kind="rec" dot={false}>Parcela</StatusPill>}
          </div>
          <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.fg3 }}>{note}</span>
        </div>
        <span style={{
          padding: '2px 8px', borderRadius: 9999,
          fontFamily: T.fontSans, fontSize: 10, fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '0.06em',
          color: p.fg, background: p.bg,
        }}>{priority}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontFamily: T.fontMono, fontSize: 10, color: T.fg4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Restante
          </span>
          <Num cents={remaining} currency={currency} size={22} weight={700} color={T.fg1} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end' }}>
          <span style={{ fontFamily: T.fontMono, fontSize: 10, color: T.fg4 }}>
            {(pct * 100).toFixed(1).replace('.', ',')}% pago
          </span>
          <Num cents={paid} currency={currency} size={12} weight={500} color={T.fg3} />
        </div>
      </div>

      <div style={{ height: 4, background: T.inset, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct*100}%`, height: '100%', background: T.brand }} />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <Btn size="sm" variant="secondary" style={{ flex: 1 }}>Registrar pagamento</Btn>
        <Btn size="sm" variant="ghost"><Icon.More size={16} /></Btn>
      </div>
    </div>
  );
}

Object.assign(window, { AppTopBar, BottomNav, DashboardScreen, LancarScreen, DividasScreen, TransacoesScreen, ContasScreen, ResumoScreen, MaisScreen, RecorrentesScreen, CategoriasScreen });

// ============================================================================
// SCREEN: Recorrentes
// ============================================================================
function RecorrentesScreen() {
  const rules = [
    { day: 1,  title: 'Aluguel',           cat: 'Moradia',     account: 'Revolut',     currency: 'EUR', amount: -80000, kind: 'expense', state: 'active' },
    { day: 3,  title: 'NOS internet',      cat: 'Casa',        account: 'Revolut',     currency: 'EUR', amount: -4400,  kind: 'expense', state: 'active' },
    { day: 5,  title: 'Spotify família',   cat: 'Lazer',       account: 'Revolut',     currency: 'EUR', amount: -1799,  kind: 'expense', state: 'active' },
    { day: 10, title: 'Adobe Creative',    cat: 'Trabalho',    account: 'Revolut',     currency: 'EUR', amount: -1500,  kind: 'expense', state: 'active' },
    { day: 15, title: 'Salário · maio',    cat: 'Trabalho',    account: 'CGD',         currency: 'EUR', amount: 248000, kind: 'income',  state: 'active' },
    { day: 20, title: 'Plano de saúde',    cat: 'Saúde',       account: 'Revolut',     currency: 'EUR', amount: -8500,  kind: 'expense', state: 'paused' },
    { day: 28, title: 'Aporte poupança',   cat: 'Caixinha',    account: 'Itaú BR',     currency: 'BRL', amount: -50000, kind: 'expense', state: 'active' },
  ];
  const active = rules.filter(r => r.state === 'active');
  const totalOut = active.filter(r => r.amount < 0 && r.currency === 'EUR').reduce((s, r) => s + r.amount, 0);
  const totalIn  = active.filter(r => r.amount > 0 && r.currency === 'EUR').reduce((s, r) => s + r.amount, 0);

  return (
    <div style={{ paddingBottom: 100 }}>
      <AppTopBar
        eyebrow={`${active.length} ativas · 1 pausada`}
        title="Recorrentes"
        trailing={
          <button style={{
            ...iconBtn, width: 'auto', padding: '0 12px', gap: 6,
            color: T.brand, borderColor: 'transparent', display: 'inline-flex', alignItems: 'center',
          }}>
            <Icon.Plus size={16} /><span style={{ fontSize: 13, fontWeight: 600 }}>Nova</span>
          </button>
        }
      />

      {/* Net monthly summary */}
      <section style={{ padding: '4px 20px 14px' }}>
        <Card style={{ padding: '12px 16px' }}>
          <span style={{
            fontFamily: T.fontSans, fontSize: 11, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.08em', color: T.fg3,
          }}>Líquido mensal · EUR</span>
          <div style={{ marginTop: 4, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <Num cents={totalIn + totalOut} sign size={26} weight={700}
                 color={(totalIn + totalOut) >= 0 ? T.pos : T.neg} />
            <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.fg4 }}>
              gera dia 1 · 03h UTC
            </span>
          </div>
          <div style={{
            marginTop: 8, paddingTop: 8, borderTop: `1px solid ${T.borderSoft}`,
            display: 'flex', gap: 14, fontFamily: T.fontMono, fontSize: 11, color: T.fg3,
          }}>
            <span>Entradas <Num cents={totalIn}  size={11} weight={600} color={T.pos} style={{ marginLeft: 4 }} /></span>
            <span>Saídas   <Num cents={totalOut} size={11} weight={600} color={T.fg2} style={{ marginLeft: 4 }} /></span>
          </div>
        </Card>
      </section>

      {/* Calendar strip — visualize day-of-month distribution */}
      <section style={{ padding: '0 20px 14px' }}>
        <span style={{
          fontFamily: T.fontSans, fontSize: 11, fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '0.08em', color: T.fg3,
          display: 'block', marginBottom: 6,
        }}>Distribuição no mês</span>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(31, 1fr)', gap: 2,
          padding: 8, background: T.surface, border: `1px solid ${T.borderSoft}`, borderRadius: 6,
        }}>
          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => {
            const r = rules.find(x => x.day === d && x.state === 'active');
            const today = d === 25;
            return (
              <div key={d} style={{
                aspectRatio: '1/1.4', borderRadius: 2,
                background: r ? (r.amount > 0 ? T.posBg : T.brandBg) : T.inset,
                border: today ? `1px solid ${T.brand}` : `1px solid transparent`,
                position: 'relative',
              }} title={r ? `${d}: ${r.title}` : `${d}`}>
                <span style={{
                  position: 'absolute', top: 1, left: 0, right: 0,
                  textAlign: 'center', fontFamily: T.fontMono, fontSize: 8,
                  color: r ? (r.amount > 0 ? T.pos : T.brandQF) : T.fg5,
                  fontWeight: 600,
                }}>{d}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Rule list */}
      <section style={{ padding: '0 20px 22px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rules.map((r, i) => <RuleRow key={i} {...r} />)}
      </section>
    </div>
  );
}

function RuleRow({ day, title, cat, account, currency, amount, kind, state }) {
  const paused = state === 'paused';
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '48px 1fr auto auto',
      gap: 10, alignItems: 'center',
      background: T.surface, border: `1px solid ${T.borderSoft}`,
      borderRadius: 6, padding: '10px 12px',
      opacity: paused ? 0.55 : 1,
    }}>
      {/* Day pill */}
      <div style={{
        width: 44, height: 44, borderRadius: 6,
        background: T.inset, border: `1px solid ${T.borderSoft}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontFamily: T.fontMono, fontSize: 9, color: T.fg4, letterSpacing: '0.04em' }}>DIA</span>
        <span style={{ fontFamily: T.fontNum, fontWeight: 700, fontSize: 17, color: T.fg1, letterSpacing: '-0.02em', lineHeight: 1 }}>
          {String(day).padStart(2, '0')}
        </span>
      </div>

      {/* Title + meta */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontFamily: T.fontSans, fontSize: 14, fontWeight: 500, color: T.fg1,
            letterSpacing: '-0.005em',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{title}</span>
          {paused && <StatusPill kind="neutral" dot={false}>Pausada</StatusPill>}
        </div>
        <span style={{ fontFamily: T.fontSans, fontSize: 11, color: T.fg3 }}>
          {cat} · {account}
        </span>
      </div>

      {/* Amount + state */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
        <Num cents={amount} currency={currency} sign={kind === 'income'} size={14} weight={600}
             color={kind === 'income' ? T.pos : T.fg1} />
        <CCY code={currency} />
      </div>

      {/* Pause/play */}
      <button style={{
        background: 'transparent', border: 0, color: T.fg3, cursor: 'pointer',
        padding: 4, marginLeft: 4,
      }}>
        {paused ? <Icon.Plus size={16} /> : <Icon.Pause size={14} />}
      </button>
    </div>
  );
}

// ============================================================================
// SCREEN: Categorias (CRUD)
// ============================================================================
function CategoriasScreen() {
  const cats = [
    { Icon: Icon.Home,   name: 'Moradia',     kind: 'expense', count: 14 },
    { Icon: Icon.Food,   name: 'Alimentação', kind: 'expense', count: 38 },
    { Icon: Icon.Pet,    name: 'Pet',         kind: 'expense', count: 9 },
    { Icon: Icon.Health, name: 'Saúde',       kind: 'expense', count: 6 },
    { Icon: Icon.Car,    name: 'Transporte',  kind: 'expense', count: 21 },
    { Icon: Icon.Fun,    name: 'Lazer',       kind: 'expense', count: 12 },
    { Icon: Icon.Receipt,name: 'Trabalho',    kind: 'income',  count: 4 },
    { Icon: Icon.Card,   name: 'Caixinha',    kind: 'expense', count: 2, archived: true },
  ];
  const active = cats.filter(c => !c.archived);
  const archived = cats.filter(c => c.archived);

  return (
    <div style={{ paddingBottom: 100 }}>
      <AppTopBar
        eyebrow={`${active.length} ativas · ${archived.length} arquivada${archived.length === 1 ? '' : 's'}`}
        title="Categorias"
        trailing={
          <button style={{
            ...iconBtn, width: 'auto', padding: '0 12px', gap: 6,
            color: T.brand, borderColor: 'transparent', display: 'inline-flex', alignItems: 'center',
          }}>
            <Icon.Plus size={16} /><span style={{ fontSize: 13, fontWeight: 600 }}>Nova</span>
          </button>
        }
      />

      {/* Filter chips */}
      <section style={{ padding: '4px 20px 14px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <FilterChip active>Tudo</FilterChip>
        <FilterChip>Despesa</FilterChip>
        <FilterChip>Entrada</FilterChip>
        <FilterChip>Arquivadas</FilterChip>
      </section>

      {/* Active category list */}
      <section style={{ padding: '0 20px 14px' }}>
        <span style={{
          fontFamily: T.fontSans, fontSize: 11, fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '0.08em', color: T.fg3,
          display: 'block', marginBottom: 6,
        }}>Ativas · arrasta pra reordenar</span>
        <Card padded={false}>
          {active.map((c, i) => (
            <React.Fragment key={i}>
              <CategoryRow {...c} />
              {i < active.length - 1 && <Hr />}
            </React.Fragment>
          ))}
        </Card>
      </section>

      {/* Archived */}
      {archived.length > 0 && (
        <section style={{ padding: '0 20px 14px' }}>
          <span style={{
            fontFamily: T.fontSans, fontSize: 11, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.08em', color: T.fg4,
            display: 'block', marginBottom: 6,
          }}>Arquivadas</span>
          <Card padded={false} style={{ opacity: 0.6 }}>
            {archived.map((c, i) => (
              <React.Fragment key={i}>
                <CategoryRow {...c} />
                {i < archived.length - 1 && <Hr />}
              </React.Fragment>
            ))}
          </Card>
        </section>
      )}

      <section style={{ padding: '4px 20px 24px' }}>
        <Btn size="md" variant="secondary" style={{ width: '100%' }} leading={<Icon.Plus size={14} />}>
          Adicionar categoria
        </Btn>
      </section>
    </div>
  );
}

function CategoryRow({ Icon: I, name, kind, count, archived }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '18px 28px 1fr auto 24px',
      gap: 10, alignItems: 'center', padding: '10px 12px',
    }}>
      {/* Drag handle */}
      <span style={{ color: T.fg4, cursor: 'grab', display: 'flex', alignItems: 'center' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/>
          <circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/>
          <circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/>
        </svg>
      </span>
      {/* Icon */}
      <span style={{
        width: 28, height: 28, borderRadius: 6,
        background: T.inset, border: `1px solid ${T.borderSoft}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: T.fg2,
      }}>
        <I size={14} sw={1.7} />
      </span>
      {/* Name + kind */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
        <span style={{ fontFamily: T.fontSans, fontSize: 14, fontWeight: 500, color: T.fg1, letterSpacing: '-0.005em' }}>
          {name}
        </span>
        <span style={{ fontFamily: T.fontMono, fontSize: 10, color: T.fg4, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          {kind === 'income' ? 'entrada' : 'despesa'}{archived && ' · arquivada'}
        </span>
      </div>
      {/* Usage count */}
      <span style={{
        fontFamily: T.fontMono, fontSize: 11, color: T.fg3, textAlign: 'right',
      }}>
        {count} lanç.
      </span>
      {/* Edit */}
      <button style={{
        background: 'transparent', border: 0, color: T.fg4, cursor: 'pointer',
        padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon.Chevron size={14} />
      </button>
    </div>
  );
}

// ============================================================================
// SCREEN: Transações
// ============================================================================
function TransacoesScreen() {
  const days = [
    {
      date: 'Hoje · 25 mai', total: -14255, items: [
        { desc: 'Mercado · Pingo Doce', cat: 'Alimentação', cents: -14255, status: 'paid', who: 'Tiago', currency: 'EUR' },
      ],
    },
    {
      date: '24 mai · sáb', total: -3380, items: [
        { desc: 'Café · A Brasileira', cat: 'Alimentação', cents: -380,  status: 'paid', who: 'Tiago', currency: 'EUR' },
        { desc: 'Uber · centro',       cat: 'Transporte',  cents: -1200, status: 'paid', who: 'Laine', currency: 'EUR' },
        { desc: 'Cinema · Nimas',      cat: 'Lazer',       cents: -1800, status: 'paid', who: 'Laine', currency: 'EUR' },
      ],
    },
    {
      date: '21 mai · qua', total: -9200, items: [
        { desc: 'Vet · Lupita', cat: 'Pet', cents: -9200, status: 'overdue', who: 'Tiago', currency: 'EUR' },
      ],
    },
    {
      date: '15 mai · qui', total: 248000, items: [
        { desc: 'Salário · maio', cat: 'Trabalho', cents: 248000, status: 'paid', who: 'Tiago', currency: 'EUR', positive: true },
      ],
    },
    {
      date: '10 mai · sáb', total: -80000, items: [
        { desc: 'Aluguel', cat: 'Moradia · recorrente', cents: -80000, status: 'paid', who: 'Tiago', currency: 'EUR' },
      ],
    },
  ];

  return (
    <div style={{ paddingBottom: 100 }}>
      <AppTopBar
        eyebrow="Maio · 2026"
        title="Transações"
        trailing={
          <div style={{ display: 'flex', gap: 6 }}>
            <button style={iconBtn}><Icon.Search size={18} /></button>
            <button style={iconBtn}><Icon.Filter size={18} /></button>
          </div>
        }
      />

      {/* Month summary strip */}
      <section style={{ padding: '4px 20px 16px' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          background: T.surface, border: `1px solid ${T.borderSoft}`, borderRadius: 6,
          overflow: 'hidden',
        }}>
          <SummaryStat label="Pago" cents={145000} fg={T.paidFg} />
          <SummaryStat label="Pendente" cents={13760} fg={T.pendFg} divider />
          <SummaryStat label="Em atraso" cents={9200} fg={T.overFg} divider />
        </div>
        <div style={{
          display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap',
        }}>
          <FilterChip active>Tudo</FilterChip>
          <FilterChip>Pago</FilterChip>
          <FilterChip>Pendente</FilterChip>
          <FilterChip>Atraso</FilterChip>
          <FilterChip>EUR</FilterChip>
          <FilterChip>BRL</FilterChip>
        </div>
      </section>

      {/* Day groups */}
      {days.map((day, i) => (
        <section key={i} style={{ padding: '0 20px 14px' }}>
          <header style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            marginBottom: 6,
          }}>
            <span style={{
              fontFamily: T.fontSans, fontSize: 11, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.08em', color: T.fg3,
              whiteSpace: 'nowrap',
            }}>{day.date}</span>
            <Num cents={day.total} size={12} weight={500} color={T.fg3} />
          </header>
          <Card padded={false}>
            {day.items.map((t, j) => (
              <React.Fragment key={j}>
                <TxnRow {...t} />
                {j < day.items.length - 1 && <Hr />}
              </React.Fragment>
            ))}
          </Card>
        </section>
      ))}

      <section style={{ padding: '8px 20px 24px', display: 'flex', justifyContent: 'center' }}>
        <Btn size="sm" variant="ghost">Carregar abril</Btn>
      </section>
    </div>
  );
}

function SummaryStat({ label, cents, fg, divider }) {
  return (
    <div style={{
      padding: '10px 12px',
      borderLeft: divider ? `1px solid ${T.borderSoft}` : 'none',
      display: 'flex', flexDirection: 'column', gap: 2,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: fg }} />
        <span style={{ fontFamily: T.fontSans, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: fg }}>
          {label}
        </span>
      </div>
      <Num cents={cents} size={15} weight={600} color={T.fg1} />
    </div>
  );
}

function FilterChip({ active, children }) {
  return (
    <button style={{
      padding: '5px 11px', borderRadius: 9999,
      background: active ? T.brandBg : T.inset,
      color: active ? T.brandQF : T.fg3,
      border: `1px solid ${active ? 'color-mix(in oklch, var(--brand) 35%, transparent)' : T.borderSoft}`,
      fontFamily: T.fontSans, fontSize: 12, fontWeight: active ? 600 : 500,
      cursor: 'pointer',
    }}>{children}</button>
  );
}

function TxnRow({ desc, cat, cents, status, who, currency, positive }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr auto',
      gap: 10, alignItems: 'center', padding: '10px 14px',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span style={{
          fontFamily: T.fontSans, fontSize: 14, fontWeight: 500, color: T.fg1,
          letterSpacing: '-0.005em',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{desc}</span>
        <span style={{ fontFamily: T.fontSans, fontSize: 11, color: T.fg3 }}>
          {cat} · {who}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
        <Num cents={cents} currency={currency} sign={positive} size={14} weight={600}
             color={positive ? T.pos : (cents < 0 ? T.fg1 : T.fg1)} />
        <StatusPill kind={status} dot={false}>
          {status === 'paid' ? 'Pago' : status === 'pending' ? 'Pendente' : 'Atraso'}
        </StatusPill>
      </div>
    </div>
  );
}

// ============================================================================
// SCREEN: Contas
// ============================================================================
function ContasScreen() {
  const accounts = [
    { name: 'Revolut · principal', who: 'Tiago', currency: 'EUR', balance: 124000, updated: 'há 12 min' },
    { name: 'CGD · ordenado',      who: 'Tiago', currency: 'EUR', balance: 60000,  updated: 'há 2 dias' },
    { name: 'Itaú · BR',           who: 'Tiago', currency: 'BRL', balance: 210380, updated: 'há 1 semana' },
  ];
  return (
    <div style={{ paddingBottom: 100 }}>
      <AppTopBar
        eyebrow="3 contas"
        title="Contas"
        trailing={
          <button style={{
            ...iconBtn, width: 'auto', padding: '0 12px', gap: 6,
            color: T.brand, borderColor: 'transparent', display: 'inline-flex', alignItems: 'center',
          }}>
            <Icon.Plus size={16} /><span style={{ fontSize: 13, fontWeight: 600 }}>Nova</span>
          </button>
        }
      />

      {/* Total convertido */}
      <section style={{ padding: '6px 20px 18px' }}>
        <Card style={{ padding: '14px 16px' }}>
          <span style={{
            fontFamily: T.fontSans, fontSize: 11, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.08em', color: T.fg3,
          }}>Total convertido · EUR</span>
          <div style={{ marginTop: 4 }}>
            <HeroNumber cents={218314} currency="EUR" sizeInt={36} sizeFrac={20} sizeSym={20} />
          </div>
          <div style={{
            display: 'flex', gap: 12, marginTop: 10,
            paddingTop: 10, borderTop: `1px solid ${T.borderSoft}`,
            fontFamily: T.fontMono, fontSize: 11, color: T.fg3, alignItems: 'center',
          }}>
            <span><Icon.Refresh size={11} style={{ verticalAlign: '-2px', marginRight: 4 }} />
              EUR→BRL · 6,1240
            </span>
            <span style={{ marginLeft: 'auto', color: T.fg4 }}>frankfurter · 09:12</span>
          </div>
        </Card>
      </section>

      {/* Account list */}
      <section style={{ padding: '0 20px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {accounts.map((a, i) => <AccountRow key={i} {...a} />)}
      </section>

      <section style={{ padding: '0 20px 24px' }}>
        <Btn size="md" variant="secondary" style={{ width: '100%' }} leading={<Icon.Plus size={14} />}>
          Adicionar conta
        </Btn>
      </section>
    </div>
  );
}

function AccountRow({ name, who, currency, balance, updated }) {
  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.borderSoft}`,
      borderRadius: 6, padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <span style={{ fontFamily: T.fontSans, fontSize: 14, fontWeight: 600, color: T.fg1, letterSpacing: '-0.005em' }}>
            {name}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <CCY code={currency} />
            <span style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.fg4 }}>· {who}</span>
          </div>
        </div>
        <button style={{
          background: 'transparent', border: `1px solid ${T.borderSoft}`,
          borderRadius: 6, padding: '4px 10px',
          color: T.fg2, cursor: 'pointer', fontSize: 11, fontWeight: 600,
          fontFamily: T.fontSans, letterSpacing: '0.02em',
        }}>Editar</button>
      </div>
      <div style={{
        marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.borderSoft}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      }}>
        <Num cents={balance} currency={currency} size={24} weight={700} color={T.fg1} />
        <span style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.fg4 }}>{updated}</span>
      </div>
    </div>
  );
}

// ============================================================================
// SCREEN: Resumo (WhatsApp export)
// ============================================================================
function ResumoScreen() {
  // EXCEÇÃO documentada: o resumo exportado pra WhatsApp usa 4 emojis funcionais.
  // É o único lugar do produto onde emoji aparece. Veja README.md → Iconography.
  const summaryLines = [
    { kind: 'h', text: '*Resumo de Maio/2026*' },
    { kind: 'blank' },
    { kind: 'l', emoji: '💰', label: 'Saldo atual:',    value: '€ 2.183,14' },
    { kind: 'l', emoji: '📊', label: 'Sobra prevista:', value: '€ 612,40' },
    { kind: 'l', emoji: '✅', label: 'Pago:',           value: '€ 1.450,00' },
    { kind: 'l', emoji: '⏳', label: 'Pendente:',       value: '€ 137,60' },
    { kind: 'blank' },
    { kind: 'h', text: '*Top categorias*' },
    { kind: 'b', text: '• Moradia: € 800,00' },
    { kind: 'b', text: '• Pet: € 92,00' },
    { kind: 'b', text: '• Saúde: € 70,00' },
    { kind: 'blank' },
    { kind: 'h', text: '*Dívidas em aberto*' },
    { kind: 'b', text: '• Empréstimo Jefferson: € 1.875,00' },
    { kind: 'b', text: '• Notebook: € 883,04' },
    { kind: 'blank' },
    { kind: 'h', text: '*Próximo mês*' },
    { kind: 'b', text: '• Aluguel: € 800' },
    { kind: 'b', text: '• NOS: € 44' },
    { kind: 'b', text: '• Adobe: € 15' },
  ];

  return (
    <div style={{ paddingBottom: 100 }}>
      <AppTopBar
        eyebrow="Export"
        title="Resumo do mês"
        trailing={
          <button style={{ ...iconBtn, width: 'auto', padding: '0 10px', gap: 4, display: 'inline-flex', alignItems: 'center' }}>
            <Icon.Cal size={14} />
            <span style={{ fontSize: 12, color: T.fg2 }}>mai 2026</span>
            <Icon.Chevron size={12} />
          </button>
        }
      />

      <section style={{ padding: '6px 20px 14px' }}>
        <div style={{
          fontFamily: T.fontSans, fontSize: 12.5, color: T.fg3,
          lineHeight: 1.45,
        }}>
          Texto pronto pra colar no WhatsApp. Emojis funcionais como marcadores de seção — única exceção à regra "sem emoji" do app.
        </div>
      </section>

      {/* Preview card — looks like a WhatsApp bubble */}
      <section style={{ padding: '0 20px 16px' }}>
        <div style={{
          background: T.inset, border: `1px solid ${T.borderSoft}`,
          borderRadius: 8, padding: '14px 16px',
          display: 'flex', flexDirection: 'column', gap: 4,
          fontFamily: T.fontSans, fontSize: 13.5, color: T.fg1,
          lineHeight: 1.55,
        }}>
          {summaryLines.map((line, i) => {
            if (line.kind === 'blank') return <div key={i} style={{ height: 6 }} />;
            if (line.kind === 'h') {
              return <div key={i} style={{ fontWeight: 700, color: T.fg1 }}>{line.text}</div>;
            }
            if (line.kind === 'l') {
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 14 }}>{line.emoji}</span>
                  <span style={{ color: T.fg2, flex: 1 }}>{line.label}</span>
                  <span style={{
                    fontFamily: T.fontNum, fontVariantNumeric: 'tabular-nums',
                    fontWeight: 600, color: T.fg1, letterSpacing: '-0.015em',
                  }}>{line.value}</span>
                </div>
              );
            }
            return <div key={i} style={{ color: T.fg2 }}>{line.text}</div>;
          })}
        </div>
      </section>

      {/* Copy buttons */}
      <section style={{ padding: '0 20px 14px', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
        <Btn size="lg" variant="primary" leading={<Icon.Check size={16} />}>
          Copiar texto
        </Btn>
        <Btn size="lg" variant="secondary">Editar</Btn>
      </section>

      {/* Meta */}
      <section style={{ padding: '4px 20px 24px' }}>
        <div style={{
          fontFamily: T.fontMono, fontSize: 10.5, color: T.fg4,
          display: 'flex', justifyContent: 'space-between',
        }}>
          <span>21 transações · 12 categorias</span>
          <span>gerado às 09:12</span>
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// SCREEN: Mais (settings menu)
// ============================================================================
function MaisScreen() {
  const sections = [
    {
      title: 'Dados',
      items: [
        { icon: Icon.Receipt, label: 'Categorias',  meta: '12 ativas' },
        { icon: Icon.Refresh, label: 'Recorrentes', meta: '7 regras' },
        { icon: Icon.Card,    label: 'Parcelas',    meta: '2 abertas' },
      ],
    },
    {
      title: 'Casal',
      items: [
        { icon: Icon.More, label: 'Household',  meta: 'Tiago · Laine' },
        { icon: Icon.Refresh, label: 'Câmbio',  meta: 'frankfurter · auto' },
      ],
    },
    {
      title: 'App',
      items: [
        { icon: Icon.Settings, label: 'Tema',         meta: 'Auto' },
        { icon: Icon.Alert,    label: 'Notificações', meta: 'Desligado' },
        { icon: Icon.More,     label: 'Sair',         meta: '' },
      ],
    },
  ];

  return (
    <div style={{ paddingBottom: 100 }}>
      <AppTopBar
        eyebrow="Tiago Silva"
        title="Mais"
        trailing={
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: T.brandBg, color: T.brandQF,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: T.fontSans, fontWeight: 700, fontSize: 14,
          }}>T</div>
        }
      />

      {sections.map((sec, si) => (
        <section key={si} style={{ padding: '6px 20px 16px' }}>
          <h2 style={{
            margin: '4px 4px 8px', fontFamily: T.fontSans, fontSize: 11, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.08em', color: T.fg3,
          }}>{sec.title}</h2>
          <Card padded={false}>
            {sec.items.map((it, i) => (
              <React.Fragment key={i}>
                <div style={{
                  display: 'grid', gridTemplateColumns: '24px 1fr auto auto',
                  gap: 12, alignItems: 'center', padding: '12px 14px',
                }}>
                  <span style={{ color: T.fg3 }}><it.icon size={16} /></span>
                  <span style={{ fontSize: 14, color: T.fg1, fontWeight: 500 }}>{it.label}</span>
                  <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.fg4 }}>{it.meta}</span>
                  <Icon.Chevron size={14} style={{ color: T.fg4 }} />
                </div>
                {i < sec.items.length - 1 && <Hr />}
              </React.Fragment>
            ))}
          </Card>
        </section>
      ))}

      <section style={{ padding: '4px 20px 24px', textAlign: 'center' }}>
        <span style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.fg4 }}>
          v0.1.0 · build a3f9c2
        </span>
      </section>
    </div>
  );
}
