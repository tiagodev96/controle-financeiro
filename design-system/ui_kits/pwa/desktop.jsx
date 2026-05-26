/* global React, Icon, T, Num, HeroNumber, Eyebrow, StatusPill, Btn, Card, CCY, fmt */
// ============================================================================
// Controle Financeiro — Desktop layouts
// 1 ChromeWindow with internal sidebar navigation across 9 screens.
// ============================================================================

const useStateD = React.useState;

// ─── Shared sidebar nav ──────────────────────────────────────────────────
function DesktopNavItem({ icon: I, label, active, count, shortcut, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 10, width: '100%',
      padding: '7px 10px', borderRadius: 6, border: 0,
      background: active ? T.brandBg : 'transparent',
      color: active ? T.brandQF : T.fg2,
      cursor: 'pointer', textAlign: 'left',
      fontFamily: T.fontSans, fontSize: 13, fontWeight: active ? 600 : 500,
      transition: 'background 150ms cubic-bezier(0.2,0,0,1)',
    }}>
      <I size={15} sw={active ? 1.9 : 1.6} />
      <span style={{ flex: 1 }}>{label}</span>
      {count !== undefined && (
        <span style={{
          fontFamily: T.fontMono, fontSize: 10.5, color: T.fg4,
          background: T.inset, padding: '1px 6px', borderRadius: 4,
        }}>{count}</span>
      )}
      {shortcut && (
        <kbd style={{
          fontFamily: T.fontMono, fontSize: 10, padding: '1px 6px',
          background: T.inset, border: `1px solid ${T.borderSoft}`,
          borderRadius: 4, color: T.fg3,
        }}>{shortcut}</kbd>
      )}
    </button>
  );
}

function DesktopSidebar({ active, onChange }) {
  const items = [
    { id: 'dashboard',  icon: Icon.Dashboard, label: 'Dashboard' },
    { id: 'lancar',     icon: Icon.Plus,      label: 'Lançar',      shortcut: 'L' },
    { id: 'transacoes', icon: Icon.Receipt,   label: 'Transações',  count: 21 },
    { id: 'dividas',    icon: Icon.Card,      label: 'Dívidas',     count: 3 },
    { id: 'recorrentes',icon: Icon.Refresh,   label: 'Recorrentes', count: 7 },
    { id: 'contas',     icon: Icon.More,      label: 'Contas',      count: 3 },
    { id: 'categorias', icon: Icon.Cal,       label: 'Categorias' },
    { id: 'resumo',     icon: Icon.Receipt,   label: 'Resumo do mês' },
    { id: 'mais',       icon: Icon.Settings,  label: 'Configurações' },
  ];
  return (
    <aside style={{
      background: T.surface, borderRight: `1px solid ${T.borderSoft}`,
      padding: '20px 14px',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px 14px' }}>
        <svg width="22" height="22" viewBox="0 0 64 64" fill="none">
          <rect x="6" y="8" width="52" height="48" rx="3" stroke="var(--fg2)" strokeWidth="2"/>
          <line x1="14" y1="22" x2="50" y2="22" stroke="var(--border-strong)" strokeWidth="1.5"/>
          <line x1="14" y1="30" x2="42" y2="30" stroke="var(--border-strong)" strokeWidth="1.5"/>
          <line x1="14" y1="38" x2="46" y2="38" stroke="var(--border-strong)" strokeWidth="1.5"/>
          <line x1="14" y1="46" x2="36" y2="46" stroke="var(--border-strong)" strokeWidth="1.5"/>
          <rect x="42" y="42" width="10" height="2" fill="var(--brand)"/>
        </svg>
        <span style={{ fontSize: 14, fontWeight: 700, color: T.fg1, letterSpacing: '-0.02em' }}>
          controle<span style={{ color: T.fg4, fontWeight: 400, margin: '0 2px' }}>·</span>cf
        </span>
      </div>

      {items.map((it) => (
        <DesktopNavItem key={it.id} {...it} active={active === it.id} onClick={() => onChange(it.id)} />
      ))}

      <div style={{ flex: 1 }} />

      <div style={{
        padding: '10px 12px', background: T.inset,
        border: `1px solid ${T.borderSoft}`, borderRadius: 6,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 9999,
          background: T.brandBg, color: T.brandQF,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 12,
        }}>T</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: T.fg1 }}>Owner</span>
          <span style={{ fontFamily: T.fontMono, fontSize: 10, color: T.fg4 }}>+ Member</span>
        </div>
      </div>
    </aside>
  );
}

// ─── Shared page header ──────────────────────────────────────────────────
function DesktopHeader({ eyebrow, title, actions }) {
  return (
    <header style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
      marginBottom: 22, gap: 16,
    }}>
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 style={{ margin: '4px 0 0', fontSize: 30, fontWeight: 600, color: T.fg1, letterSpacing: '-0.03em' }}>
          {title}
        </h1>
      </div>
      {actions && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
    </header>
  );
}

function DesktopMain({ children }) {
  return <main style={{ padding: '28px 32px', overflow: 'auto' }}>{children}</main>;
}
function DesktopAside({ children }) {
  return (
    <aside style={{
      borderLeft: `1px solid ${T.borderSoft}`, background: T.bg,
      padding: '28px 22px', overflow: 'auto',
      display: 'flex', flexDirection: 'column', gap: 18,
    }}>{children}</aside>
  );
}

const sectionCss = { padding: '0 0 18px' };

// ============================================================================
// SCREEN: Dashboard
// ============================================================================
function DesktopDashboardScreen() {
  return (
    <React.Fragment>
      <DesktopMain>
        <DesktopHeader
          eyebrow="Maio · 2026 · 25 mai · 09:12"
          title="Dashboard"
          actions={
            <React.Fragment>
              <Btn size="sm" variant="secondary" leading={<Icon.Search size={14} />}>Buscar</Btn>
              <Btn size="sm" variant="primary" leading={<Icon.Plus size={14} />}>Lançar despesa</Btn>
            </React.Fragment>
          }
        />

        <section style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20, marginBottom: 20 }}>
          <Card style={{ padding: '20px 24px' }}>
            <Eyebrow>Saldo atual · convertido EUR</Eyebrow>
            <div style={{ marginTop: 8 }}>
              <HeroNumber cents={218314} currency="EUR" sizeInt={60} sizeFrac={30} sizeSym={26} />
            </div>
            <div style={{
              display: 'flex', gap: 12, marginTop: 14,
              paddingTop: 12, borderTop: `1px solid ${T.borderSoft}`,
              alignItems: 'center', flexWrap: 'wrap',
            }}>
              <CCY code="EUR" />
              <span style={{ fontFamily: T.fontMono, fontSize: 12, color: T.fg2 }}>€ 1.840,00</span>
              <span style={{ color: T.fg5 }}>·</span>
              <CCY code="BRL" />
              <span style={{ fontFamily: T.fontMono, fontSize: 12, color: T.fg2 }}>R$ 2.103,80</span>
              <span style={{ marginLeft: 'auto', fontFamily: T.fontMono, fontSize: 11, color: T.fg4 }}>
                EUR→BRL · 6,1240
              </span>
            </div>
          </Card>

          <Card style={{ padding: '20px 24px' }}>
            <Eyebrow>Sobra prevista · EUR · até 31 mai</Eyebrow>
            <div style={{ marginTop: 8 }}>
              <Num cents={61240} sign size={44} weight={700} color={T.pos} style={{ letterSpacing: '-0.035em' }} />
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10,
              marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.borderSoft}`,
            }}>
              <DCalc label="entradas" cents={148000} color={T.pos} />
              <DCalc label="pendentes" cents={-77400} color={T.fg2} />
              <DCalc label="atraso" cents={-9200} color={T.neg} />
            </div>
          </Card>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1.4fr', gap: 12, marginBottom: 20 }}>
          <DStat kind="paid" label="Pago" cents={145000} count={8} />
          <DStat kind="pending" label="Pendente" cents={13760} count={3} />
          <DStat kind="overdue" label="Em atraso" cents={9200} count={1} />
          <div style={{
            background: T.brandBg, border: `1px solid color-mix(in oklch, var(--brand) 30%, transparent)`,
            borderRadius: 6, padding: '12px 14px',
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            <Eyebrow color={T.brandQF}>Sugestão</Eyebrow>
            <div style={{ fontSize: 13, color: T.fg1, lineHeight: 1.4 }}>
              Quitar <Num cents={36744} size={13} weight={600} color={T.fg1} /> da{' '}
              <span style={{ color: T.fg2 }}>Empréstimo Jefferson</span>.
            </div>
            <Btn size="sm" variant="primary" style={{ alignSelf: 'flex-start' }}>Registrar</Btn>
          </div>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div>
            <h2 style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 600, color: T.fg1 }}>Top categorias</h2>
            <Card padded={false}>
              {[
                { I: Icon.Home, label: 'Moradia', cents: 80000, pct: 0.78 },
                { I: Icon.Food, label: 'Alimentação', cents: 32450, pct: 0.32 },
                { I: Icon.Pet,  label: 'Pet', cents: 9200, pct: 0.10 },
                { I: Icon.Health, label: 'Saúde', cents: 7000, pct: 0.07 },
              ].map((c, i, arr) => (
                <React.Fragment key={i}>
                  <DCatBar {...c} />
                  {i < arr.length - 1 && <div style={{ height: 1, background: T.borderSoft }} />}
                </React.Fragment>
              ))}
            </Card>
          </div>

          <div>
            <h2 style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 600, color: T.fg1 }}>Próximos 7 dias</h2>
            <Card padded={false}>
              {[
                { date: '01 jun', desc: 'Aluguel', cat: 'Moradia · recorrente', cents: -80000 },
                { date: '03 jun', desc: 'NOS internet', cat: 'Casa · recorrente', cents: -4400 },
                { date: '05 jun', desc: 'Notebook', cat: 'Parcela 5/10', cents: -8759 },
              ].map((u, i, arr) => (
                <React.Fragment key={i}>
                  <DUpcoming {...u} />
                  {i < arr.length - 1 && <div style={{ height: 1, background: T.borderSoft }} />}
                </React.Fragment>
              ))}
            </Card>
          </div>
        </section>
      </DesktopMain>

      <DesktopAside>
        <div>
          <Eyebrow>Atividade · hoje</Eyebrow>
          <Card padded={false} style={{ marginTop: 8 }}>
            <DActivity time="09:12" who="Owner" what="Lançou Mercado · Pingo Doce" cents={-14255} />
            <div style={{ height: 1, background: T.borderSoft }} />
            <DActivity time="08:45" who="Member" what="Marcou NOS como pago" cents={-4400} />
            <div style={{ height: 1, background: T.borderSoft }} />
            <DActivity time="08:02" who="Owner" what="Ajustou saldo Revolut" cents={120000} />
          </Card>
        </div>

        <div>
          <Eyebrow>Câmbio do dia</Eyebrow>
          <Card style={{ marginTop: 8, padding: '12px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontFamily: T.fontMono, fontSize: 12, color: T.fg2 }}>EUR → BRL</span>
              <span style={{ fontFamily: T.fontMono, fontSize: 16, fontWeight: 600, color: T.fg1 }}>6,1240</span>
            </div>
            <div style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.fg4, marginTop: 6 }}>
              frankfurter · 09:12 · BCE
            </div>
          </Card>
        </div>

        <div>
          <Eyebrow>Atalhos</Eyebrow>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { k: 'L', label: 'Lançar despesa' },
              { k: 'P', label: 'Marcar como pago' },
              { k: 'B', label: 'Buscar transação' },
              { k: 'R', label: 'Recarregar câmbio' },
            ].map(s => (
              <div key={s.k} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                fontFamily: T.fontSans, fontSize: 12.5, color: T.fg2,
              }}>
                <span>{s.label}</span>
                <kbd style={{
                  fontFamily: T.fontMono, fontSize: 11, padding: '2px 7px',
                  background: T.inset, border: `1px solid ${T.borderSoft}`,
                  borderRadius: 4, color: T.fg2, letterSpacing: '0.02em',
                }}>{s.k}</kbd>
              </div>
            ))}
          </div>
        </div>
      </DesktopAside>
    </React.Fragment>
  );
}

// ============================================================================
// SCREEN: Lançar (form central + side preset panel)
// ============================================================================
function DesktopLancarScreen() {
  return (
    <React.Fragment>
      <DesktopMain>
        <DesktopHeader
          eyebrow="Nova"
          title="Lançar despesa"
          actions={<Btn size="sm" variant="secondary">Cancelar</Btn>}
        />
        <div style={{ maxWidth: 520 }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', padding: 3,
            background: T.inset, borderRadius: 8, border: `1px solid ${T.borderSoft}`, gap: 2,
            marginBottom: 18,
          }}>
            <DToggleSeg active>↓  Despesa</DToggleSeg>
            <DToggleSeg>↑  Entrada</DToggleSeg>
          </div>

          <DField label="Valor">
            <div style={{
              padding: '14px 16px', background: T.inset,
              border: `1px solid ${T.brand}`, borderRadius: 8,
              boxShadow: `0 0 0 3px oklch(73% 0.135 80 / 0.18)`,
              display: 'flex', alignItems: 'baseline', gap: 10,
            }}>
              <span style={{ fontFamily: T.fontSans, fontWeight: 500, fontSize: 28, color: T.fg3, letterSpacing: '-0.01em' }}>€</span>
              <span style={{
                fontFamily: T.fontNum, fontVariantNumeric: 'tabular-nums',
                fontWeight: 700, fontSize: 44, color: T.fg1, letterSpacing: '-0.035em',
              }}>142,55</span>
            </div>
          </DField>

          <DField label="Descrição">
            <DInput value="Mercado · Pingo Doce" />
          </DField>

          <DField label="Categoria">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {[
                { id: 'mor', I: Icon.Home, l: 'Moradia' },
                { id: 'alim',I: Icon.Food, l: 'Alimentação', active: true },
                { id: 'pet', I: Icon.Pet,  l: 'Pet' },
                { id: 'sau', I: Icon.Health, l: 'Saúde' },
                { id: 'laz', I: Icon.Fun,  l: 'Lazer' },
                { id: 'tra', I: Icon.Car,  l: 'Transporte' },
              ].map(c => <DChip key={c.id} {...c} />)}
            </div>
          </DField>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <DField label="Conta">
              <div style={{
                background: T.inset, border: `1px solid ${T.border}`, borderRadius: 6,
                padding: '11px 14px', height: 44, boxSizing: 'border-box',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <CCY code="EUR" />
                <span style={{ fontSize: 14, color: T.fg1, fontWeight: 500 }}>Revolut · principal</span>
              </div>
            </DField>
            <DField label="Data">
              <div style={{
                background: T.inset, border: `1px solid ${T.border}`, borderRadius: 6,
                padding: '11px 14px', height: 44, boxSizing: 'border-box',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <Icon.Cal size={14} style={{ color: T.fg3 }} />
                <span style={{ fontSize: 14, color: T.fg1, fontWeight: 500 }}>25 mai 2026</span>
              </div>
            </DField>
          </div>

          <DToggleRow label="Já pago" hint="desconta do saldo da conta" on />

          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <Btn size="lg" variant="primary" style={{ flex: 1 }}>Lançar despesa · € 142,55</Btn>
            <Btn size="lg" variant="ghost">Atalho L</Btn>
          </div>
          <div style={{ marginTop: 10, fontFamily: T.fontMono, fontSize: 11, color: T.fg4 }}>
            Saldo previsto após: <span style={{ color: T.fg2 }}>€ 2.040,59</span>
          </div>
        </div>
      </DesktopMain>

      <DesktopAside>
        <div>
          <Eyebrow>Últimos lançamentos</Eyebrow>
          <Card padded={false} style={{ marginTop: 8 }}>
            <DRecentItem desc="Café · A Brasileira" cat="Alimentação" cents={-380} />
            <div style={{ height: 1, background: T.borderSoft }} />
            <DRecentItem desc="Uber · centro" cat="Transporte" cents={-1200} />
            <div style={{ height: 1, background: T.borderSoft }} />
            <DRecentItem desc="Vet · Lupita" cat="Pet" cents={-9200} />
          </Card>
        </div>

        <div>
          <Eyebrow>Atalhos</Eyebrow>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { k: 'Enter', label: 'Lançar' },
              { k: 'Esc',   label: 'Cancelar' },
              { k: 'Tab',   label: 'Próximo campo' },
              { k: 'P',     label: 'Toggle pago' },
            ].map(s => (
              <div key={s.k} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                fontFamily: T.fontSans, fontSize: 12.5, color: T.fg2,
              }}>
                <span>{s.label}</span>
                <kbd style={{
                  fontFamily: T.fontMono, fontSize: 11, padding: '2px 7px',
                  background: T.inset, border: `1px solid ${T.borderSoft}`,
                  borderRadius: 4, color: T.fg2,
                }}>{s.k}</kbd>
              </div>
            ))}
          </div>
        </div>
      </DesktopAside>
    </React.Fragment>
  );
}

// ============================================================================
// SCREEN: Transações (tabela full-width)
// ============================================================================
function DesktopTransacoesScreen() {
  const rows = [
    { date: '25 mai',  desc: 'Mercado · Pingo Doce', cat: 'Alimentação',   who: 'Owner', cents: -14255, currency: 'EUR', status: 'paid' },
    { date: '24 mai',  desc: 'Café · A Brasileira',   cat: 'Alimentação',   who: 'Owner', cents: -380,   currency: 'EUR', status: 'paid' },
    { date: '24 mai',  desc: 'Uber · centro',         cat: 'Transporte',    who: 'Member', cents: -1200,  currency: 'EUR', status: 'paid' },
    { date: '24 mai',  desc: 'Cinema · Nimas',        cat: 'Lazer',         who: 'Member', cents: -1800,  currency: 'EUR', status: 'paid' },
    { date: '21 mai',  desc: 'Vet · Lupita',          cat: 'Pet',           who: 'Owner', cents: -9200,  currency: 'EUR', status: 'overdue' },
    { date: '15 mai',  desc: 'Salário · maio',        cat: 'Trabalho',      who: 'Owner', cents: 248000, currency: 'EUR', status: 'paid', positive: true },
    { date: '10 mai',  desc: 'Aluguel',               cat: 'Moradia · rec.',who: 'Owner', cents: -80000, currency: 'EUR', status: 'paid' },
    { date: '01 mai',  desc: 'NOS internet',          cat: 'Casa · rec.',   who: 'Owner', cents: -4400,  currency: 'EUR', status: 'pending' },
    { date: '01 mai',  desc: 'Spotify família',       cat: 'Lazer · rec.',  who: 'Owner', cents: -1799,  currency: 'EUR', status: 'paid' },
  ];
  return (
    <React.Fragment>
      <DesktopMain>
        <DesktopHeader
          eyebrow="Maio · 2026 · 21 transações"
          title="Transações"
          actions={
            <React.Fragment>
              <Btn size="sm" variant="secondary" leading={<Icon.Filter size={14} />}>Filtrar</Btn>
              <Btn size="sm" variant="secondary" leading={<Icon.Search size={14} />}>Buscar</Btn>
              <Btn size="sm" variant="primary" leading={<Icon.Plus size={14} />}>Nova</Btn>
            </React.Fragment>
          }
        />

        {/* Summary strip */}
        <section style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16,
        }}>
          <DStat kind="paid" label="Pago" cents={145000} count={8} />
          <DStat kind="pending" label="Pendente" cents={13760} count={3} />
          <DStat kind="overdue" label="Em atraso" cents={9200} count={1} />
          <Card style={{ padding: '14px 16px' }}>
            <Eyebrow>Total líquido</Eyebrow>
            <Num cents={148000 - 145000 - 13760 - 9200} sign size={24} weight={700} color={T.pos}
                 style={{ display: 'block', marginTop: 4 }} />
            <span style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.fg4, display: 'block', marginTop: 4 }}>
              22 lançamentos
            </span>
          </Card>
        </section>

        {/* Filter chips */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          {['Tudo', 'Pago', 'Pendente', 'Atraso', 'EUR', 'BRL', 'Owner', 'Member'].map((l, i) => (
            <button key={l} style={{
              padding: '5px 11px', borderRadius: 9999,
              background: i === 0 ? T.brandBg : T.inset,
              color: i === 0 ? T.brandQF : T.fg3,
              border: `1px solid ${i === 0 ? 'color-mix(in oklch, var(--brand) 35%, transparent)' : T.borderSoft}`,
              fontFamily: T.fontSans, fontSize: 12, fontWeight: i === 0 ? 600 : 500, cursor: 'pointer',
            }}>{l}</button>
          ))}
        </div>

        {/* Table */}
        <Card padded={false}>
          {/* Head */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '70px 1fr 140px 70px 110px 110px 36px',
            gap: 12, padding: '10px 16px',
            borderBottom: `1px solid ${T.border}`,
            background: T.surface,
          }}>
            {['Data','Descrição','Categoria','Autor','Valor','Status',''].map((h, i) => (
              <span key={i} style={{
                fontFamily: T.fontSans, fontSize: 10.5, fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.08em', color: T.fg4,
                textAlign: i === 4 ? 'right' : 'left',
              }}>{h}</span>
            ))}
          </div>
          {rows.map((r, i) => (
            <React.Fragment key={i}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '70px 1fr 140px 70px 110px 110px 36px',
                gap: 12, padding: '11px 16px', alignItems: 'center',
              }}>
                <span style={{ fontFamily: T.fontMono, fontSize: 12, color: T.fg3 }}>{r.date}</span>
                <span style={{ fontSize: 14, color: T.fg1, fontWeight: 500, letterSpacing: '-0.005em' }}>{r.desc}</span>
                <span style={{ fontSize: 12, color: T.fg3 }}>{r.cat}</span>
                <span style={{ fontFamily: T.fontMono, fontSize: 12, color: T.fg3 }}>{r.who}</span>
                <span style={{ textAlign: 'right' }}>
                  <Num cents={r.cents} currency={r.currency} sign={r.positive} size={14} weight={600}
                       color={r.positive ? T.pos : T.fg1} />
                </span>
                <span><StatusPill kind={r.status}>{r.status === 'paid' ? 'Pago' : r.status === 'pending' ? 'Pendente' : 'Atraso'}</StatusPill></span>
                <button style={{ background: 'transparent', border: 0, color: T.fg4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon.More size={14} />
                </button>
              </div>
              {i < rows.length - 1 && <div style={{ height: 1, background: T.borderSoft }} />}
            </React.Fragment>
          ))}
        </Card>
      </DesktopMain>
    </React.Fragment>
  );
}

// ============================================================================
// SCREEN: Dívidas (grid de cards)
// ============================================================================
function DesktopDividasScreen() {
  const debts = [
    { name: 'Empréstimo Jefferson', priority: 'Alta',  currency: 'EUR', total: 300000, paid: 112500, pct: 0.375, note: 'pagar 60%+ se sobrar este mês' },
    { name: 'Notebook · Apple',     priority: 'Média', currency: 'EUR', total: 175900, paid: 87596,  pct: 0.498, note: 'parcela 5/10 · 5 jun', installment: true },
    { name: 'Cartão Nubank',        priority: 'Baixa', currency: 'BRL', total: 84300,  paid: 32100,  pct: 0.381, note: 'fechamento dia 22' },
  ];
  return (
    <DesktopMain>
      <DesktopHeader
        eyebrow="3 em aberto · € 2.758,04 + R$ 522,00"
        title="Dívidas"
        actions={<Btn size="sm" variant="primary" leading={<Icon.Plus size={14} />}>Nova dívida</Btn>}
      />

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
        {debts.map((d, i) => <DDebtCard key={i} {...d} />)}
      </section>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 600, color: T.fg1 }}>Histórico de pagamentos</h2>
        <Card padded={false}>
          {[
            { date: '15 mai', who: 'Owner', what: 'Empréstimo Jefferson', cents: -25000 },
            { date: '05 mai', who: 'Owner', what: 'Notebook · parcela 4', cents: -17590 },
            { date: '01 mai', who: 'Owner', what: 'Cartão Nubank · parcial', cents: -10000 },
          ].map((h, i, arr) => (
            <React.Fragment key={i}>
              <div style={{
                display: 'grid', gridTemplateColumns: '70px 1fr 1fr 120px',
                gap: 12, padding: '11px 16px', alignItems: 'center',
              }}>
                <span style={{ fontFamily: T.fontMono, fontSize: 12, color: T.fg3 }}>{h.date}</span>
                <span style={{ fontSize: 14, color: T.fg1, fontWeight: 500 }}>{h.what}</span>
                <span style={{ fontFamily: T.fontMono, fontSize: 12, color: T.fg3 }}>{h.who}</span>
                <span style={{ textAlign: 'right' }}>
                  <Num cents={h.cents} size={13} weight={600} color={T.fg2} />
                </span>
              </div>
              {i < arr.length - 1 && <div style={{ height: 1, background: T.borderSoft }} />}
            </React.Fragment>
          ))}
        </Card>
      </section>
    </DesktopMain>
  );
}

function DDebtCard({ name, priority, currency, total, paid, pct, note, installment }) {
  const remaining = total - paid;
  const map = { Alta: { fg: T.neg, bg: 'var(--money-negative-bg)' }, Média: { fg: T.brandQF, bg: T.brandBg }, Baixa: { fg: T.fg3, bg: T.inset } };
  const p = map[priority];
  return (
    <Card style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontFamily: T.fontSans, fontSize: 15, fontWeight: 600, color: T.fg1, letterSpacing: '-0.005em' }}>{name}</span>
          <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.fg3 }}>{note}</span>
        </div>
        <span style={{
          padding: '2px 8px', borderRadius: 9999, fontSize: 10, fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '0.06em',
          color: p.fg, background: p.bg,
        }}>{priority}</span>
      </div>

      <div>
        <Eyebrow style={{ display: 'block' }}>Restante</Eyebrow>
        <Num cents={remaining} currency={currency} size={26} weight={700} color={T.fg1} style={{ display: 'block', marginTop: 4 }} />
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: T.fontMono, fontSize: 10.5, color: T.fg4, marginBottom: 4 }}>
          <span>{(pct*100).toFixed(1).replace('.', ',')}% pago</span>
          <Num cents={paid} currency={currency} size={10.5} weight={500} color={T.fg3} />
        </div>
        <div style={{ height: 4, background: T.inset, borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ width: `${pct*100}%`, height: '100%', background: T.brand }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <Btn size="sm" variant="secondary" style={{ flex: 1 }}>Registrar pagamento</Btn>
        <Btn size="sm" variant="ghost"><Icon.More size={14} /></Btn>
      </div>
    </Card>
  );
}

// ============================================================================
// SCREEN: Contas (grid de cards)
// ============================================================================
function DesktopContasScreen() {
  const accounts = [
    { name: 'Revolut · principal', who: 'Owner', currency: 'EUR', balance: 124000, updated: 'há 12 min' },
    { name: 'CGD · ordenado',      who: 'Owner', currency: 'EUR', balance: 60000,  updated: 'há 2 dias' },
    { name: 'Itaú · BR',           who: 'Owner', currency: 'BRL', balance: 210380, updated: 'há 1 semana' },
  ];
  return (
    <DesktopMain>
      <DesktopHeader
        eyebrow="3 contas · 2 moedas"
        title="Contas"
        actions={<Btn size="sm" variant="primary" leading={<Icon.Plus size={14} />}>Nova conta</Btn>}
      />

      <Card style={{ padding: '18px 22px', marginBottom: 18 }}>
        <Eyebrow>Total convertido · EUR</Eyebrow>
        <div style={{ marginTop: 6 }}>
          <HeroNumber cents={218314} currency="EUR" sizeInt={44} sizeFrac={24} sizeSym={22} />
        </div>
        <div style={{
          display: 'flex', gap: 14, marginTop: 12, paddingTop: 12,
          borderTop: `1px solid ${T.borderSoft}`,
          fontFamily: T.fontMono, fontSize: 11, color: T.fg3, alignItems: 'center',
        }}>
          <span><Icon.Refresh size={11} style={{ verticalAlign: '-2px', marginRight: 4 }} />EUR→BRL · 6,1240</span>
          <span style={{ marginLeft: 'auto', color: T.fg4 }}>frankfurter · 09:12 · próx. atualização 12:00</span>
        </div>
      </Card>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
        {accounts.map((a, i) => (
          <Card key={i} style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontFamily: T.fontSans, fontSize: 15, fontWeight: 600, color: T.fg1, letterSpacing: '-0.005em' }}>{a.name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CCY code={a.currency} />
                  <span style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.fg4 }}>· {a.who}</span>
                </div>
              </div>
              <button style={{ background: 'transparent', border: `1px solid ${T.borderSoft}`, borderRadius: 6, padding: '4px 10px', color: T.fg2, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                Editar
              </button>
            </div>
            <Num cents={a.balance} currency={a.currency} size={28} weight={700} color={T.fg1} />
            <div style={{ paddingTop: 8, borderTop: `1px solid ${T.borderSoft}`,
              display: 'flex', justifyContent: 'space-between', fontFamily: T.fontMono, fontSize: 10.5, color: T.fg4 }}>
              <span>atualizado {a.updated}</span>
              <a style={{ color: T.brandQF, cursor: 'pointer', fontWeight: 600 }}>histórico →</a>
            </div>
          </Card>
        ))}
      </section>
    </DesktopMain>
  );
}

// ============================================================================
// SCREEN: Resumo (export config + preview)
// ============================================================================
function DesktopResumoScreen() {
  const lines = [
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
  ];
  return (
    <DesktopMain>
      <DesktopHeader
        eyebrow="Export · WhatsApp"
        title="Resumo do mês"
        actions={
          <React.Fragment>
            <button style={{
              ...iconBtn0, padding: '0 10px', gap: 6, height: 32, fontFamily: T.fontSans, fontSize: 13,
              display: 'inline-flex', alignItems: 'center', color: T.fg2,
            }}>
              <Icon.Cal size={14} /> mai 2026 <Icon.Chevron size={12} />
            </button>
            <Btn size="sm" variant="primary" leading={<Icon.Check size={14} />}>Copiar texto</Btn>
          </React.Fragment>
        }
      />

      <section style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 20 }}>
        {/* Preview */}
        <div>
          <Eyebrow style={{ display: 'block', marginBottom: 8 }}>Preview · pronto pra colar</Eyebrow>
          <div style={{
            background: T.inset, border: `1px solid ${T.borderSoft}`, borderRadius: 8,
            padding: '16px 18px',
            display: 'flex', flexDirection: 'column', gap: 4,
            fontFamily: T.fontSans, fontSize: 14, color: T.fg1, lineHeight: 1.55,
          }}>
            {lines.map((line, i) => {
              if (line.kind === 'blank') return <div key={i} style={{ height: 6 }} />;
              if (line.kind === 'h') return <div key={i} style={{ fontWeight: 700, color: T.fg1 }}>{line.text}</div>;
              if (line.kind === 'l') return (
                <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 15 }}>{line.emoji}</span>
                  <span style={{ color: T.fg2, flex: 1 }}>{line.label}</span>
                  <span style={{ fontFamily: T.fontNum, fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: T.fg1 }}>{line.value}</span>
                </div>
              );
              return <div key={i} style={{ color: T.fg2 }}>{line.text}</div>;
            })}
          </div>
        </div>

        {/* Config */}
        <div>
          <Eyebrow style={{ display: 'block', marginBottom: 8 }}>Configurar</Eyebrow>
          <Card padded={false}>
            <DConfigToggle label="Incluir dívidas em aberto" on />
            <div style={{ height: 1, background: T.borderSoft }} />
            <DConfigToggle label="Incluir próximo mês" on />
            <div style={{ height: 1, background: T.borderSoft }} />
            <DConfigToggle label="Incluir top categorias" on />
            <div style={{ height: 1, background: T.borderSoft }} />
            <DConfigToggle label="Quebrar EUR e BRL separados" />
          </Card>
          <div style={{ marginTop: 14, padding: '10px 14px', background: T.surface,
            border: `1px solid ${T.borderSoft}`, borderRadius: 6 }}>
            <Eyebrow>Top categorias · quantas?</Eyebrow>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              {[3, 5, 10, 'todas'].map((n, i) => (
                <button key={i} style={{
                  padding: '5px 11px', borderRadius: 6,
                  background: i === 0 ? T.brandBg : T.inset,
                  color: i === 0 ? T.brandQF : T.fg3,
                  border: `1px solid ${i === 0 ? 'color-mix(in oklch, var(--brand) 35%, transparent)' : T.borderSoft}`,
                  fontFamily: T.fontMono, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}>{n}</button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </DesktopMain>
  );
}

// ============================================================================
// SCREEN: Recorrentes (calendar full-width + tabela)
// ============================================================================
function DesktopRecorrentesScreen() {
  const rules = [
    { day: 1,  title: 'Aluguel',         cat: 'Moradia',   account: 'Revolut', currency: 'EUR', amount: -80000,  state: 'active', kind: 'expense' },
    { day: 3,  title: 'NOS internet',    cat: 'Casa',      account: 'Revolut', currency: 'EUR', amount: -4400,   state: 'active', kind: 'expense' },
    { day: 5,  title: 'Spotify família', cat: 'Lazer',     account: 'Revolut', currency: 'EUR', amount: -1799,   state: 'active', kind: 'expense' },
    { day: 10, title: 'Adobe Creative',  cat: 'Trabalho',  account: 'Revolut', currency: 'EUR', amount: -1500,   state: 'active', kind: 'expense' },
    { day: 15, title: 'Salário · maio',  cat: 'Trabalho',  account: 'CGD',     currency: 'EUR', amount: 248000,  state: 'active', kind: 'income' },
    { day: 20, title: 'Plano de saúde',  cat: 'Saúde',     account: 'Revolut', currency: 'EUR', amount: -8500,   state: 'paused', kind: 'expense' },
    { day: 28, title: 'Aporte poupança', cat: 'Caixinha',  account: 'Itaú BR', currency: 'BRL', amount: -50000,  state: 'active', kind: 'expense' },
  ];
  return (
    <DesktopMain>
      <DesktopHeader
        eyebrow="7 regras · 6 ativas · 1 pausada"
        title="Recorrentes"
        actions={<Btn size="sm" variant="primary" leading={<Icon.Plus size={14} />}>Nova regra</Btn>}
      />

      <Card style={{ padding: '18px 22px', marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
          <div>
            <Eyebrow>Líquido mensal · EUR</Eyebrow>
            <Num cents={248000 - 80000 - 4400 - 1799 - 1500} sign size={32} weight={700}
                 color={T.pos} style={{ display: 'block', marginTop: 4, letterSpacing: '-0.03em' }} />
          </div>
          <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.fg4 }}>
            geração automática · dia 1 às 03h UTC · próx. 1 jun
          </span>
        </div>
        {/* Calendar strip — wider */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(31, 1fr)', gap: 3,
          padding: 10, background: T.inset, border: `1px solid ${T.borderSoft}`, borderRadius: 6,
        }}>
          {Array.from({ length: 31 }, (_, i) => i + 1).map(d => {
            const r = rules.find(x => x.day === d && x.state === 'active');
            const today = d === 25;
            return (
              <div key={d} style={{
                aspectRatio: '1/1.4', borderRadius: 3,
                background: r ? (r.amount > 0 ? T.posBg : T.brandBg) : 'transparent',
                border: today ? `1px solid ${T.brand}` : `1px solid ${T.borderSoft}`,
                position: 'relative',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end',
                padding: '4px 2px',
              }}>
                <span style={{
                  fontFamily: T.fontMono, fontSize: 10, color: r ? (r.amount > 0 ? T.pos : T.brandQF) : T.fg4,
                  fontWeight: 600,
                }}>{d}</span>
                {r && (
                  <span style={{
                    fontFamily: T.fontMono, fontSize: 8, color: r.amount > 0 ? T.pos : T.brandQF,
                    marginTop: 1, fontWeight: 500, whiteSpace: 'nowrap',
                  }}>{r.amount > 0 ? '+' : ''}{Math.abs(r.amount/100).toFixed(0)}</span>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Table */}
      <Card padded={false}>
        <div style={{
          display: 'grid', gridTemplateColumns: '64px 1fr 130px 120px 130px 90px 36px',
          gap: 12, padding: '10px 16px',
          borderBottom: `1px solid ${T.border}`, background: T.surface,
        }}>
          {['Dia','Título','Categoria','Conta','Valor','Estado',''].map((h, i) => (
            <span key={i} style={{
              fontFamily: T.fontSans, fontSize: 10.5, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.08em', color: T.fg4,
              textAlign: i === 4 ? 'right' : 'left',
            }}>{h}</span>
          ))}
        </div>
        {rules.map((r, i) => (
          <React.Fragment key={i}>
            <div style={{
              display: 'grid', gridTemplateColumns: '64px 1fr 130px 120px 130px 90px 36px',
              gap: 12, padding: '12px 16px', alignItems: 'center',
              opacity: r.state === 'paused' ? 0.55 : 1,
            }}>
              <span style={{
                fontFamily: T.fontNum, fontVariantNumeric: 'tabular-nums',
                fontWeight: 700, fontSize: 16, color: T.fg1, letterSpacing: '-0.02em',
              }}>{String(r.day).padStart(2,'0')}</span>
              <span style={{ fontSize: 14, color: T.fg1, fontWeight: 500 }}>{r.title}</span>
              <span style={{ fontSize: 12, color: T.fg3 }}>{r.cat}</span>
              <span style={{ fontSize: 12, color: T.fg3 }}>{r.account}</span>
              <span style={{ textAlign: 'right' }}>
                <Num cents={r.amount} currency={r.currency} sign={r.kind === 'income'} size={14} weight={600}
                     color={r.kind === 'income' ? T.pos : T.fg1} />
              </span>
              <StatusPill kind={r.state === 'active' ? 'paid' : 'neutral'} dot>
                {r.state === 'active' ? 'Ativa' : 'Pausada'}
              </StatusPill>
              <button style={{ background: 'transparent', border: 0, color: T.fg4, cursor: 'pointer' }}>
                {r.state === 'active' ? <Icon.Pause size={14} /> : <Icon.Plus size={14} />}
              </button>
            </div>
            {i < rules.length - 1 && <div style={{ height: 1, background: T.borderSoft }} />}
          </React.Fragment>
        ))}
      </Card>
    </DesktopMain>
  );
}

// ============================================================================
// SCREEN: Categorias (tabela com inline edit)
// ============================================================================
function DesktopCategoriasScreen() {
  const cats = [
    { I: Icon.Home,    name: 'Moradia',     kind: 'expense', count: 14, last: '10 mai' },
    { I: Icon.Food,    name: 'Alimentação', kind: 'expense', count: 38, last: '25 mai' },
    { I: Icon.Pet,     name: 'Pet',         kind: 'expense', count: 9,  last: '21 mai' },
    { I: Icon.Health,  name: 'Saúde',       kind: 'expense', count: 6,  last: '12 mai' },
    { I: Icon.Car,     name: 'Transporte',  kind: 'expense', count: 21, last: '24 mai' },
    { I: Icon.Fun,     name: 'Lazer',       kind: 'expense', count: 12, last: '24 mai' },
    { I: Icon.Receipt, name: 'Trabalho',    kind: 'income',  count: 4,  last: '15 mai' },
    { I: Icon.Card,    name: 'Caixinha',    kind: 'expense', count: 2,  last: '28 abr', archived: true },
  ];
  return (
    <DesktopMain>
      <DesktopHeader
        eyebrow="12 ativas · 1 arquivada"
        title="Categorias"
        actions={<Btn size="sm" variant="primary" leading={<Icon.Plus size={14} />}>Nova categoria</Btn>}
      />

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {['Tudo','Despesa','Entrada','Arquivadas'].map((l, i) => (
          <button key={l} style={{
            padding: '5px 11px', borderRadius: 9999,
            background: i === 0 ? T.brandBg : T.inset,
            color: i === 0 ? T.brandQF : T.fg3,
            border: `1px solid ${i === 0 ? 'color-mix(in oklch, var(--brand) 35%, transparent)' : T.borderSoft}`,
            fontFamily: T.fontSans, fontSize: 12, fontWeight: i === 0 ? 600 : 500, cursor: 'pointer',
          }}>{l}</button>
        ))}
      </div>

      <Card padded={false}>
        <div style={{
          display: 'grid', gridTemplateColumns: '32px 32px 1fr 110px 110px 110px 60px',
          gap: 12, padding: '10px 16px',
          borderBottom: `1px solid ${T.border}`, background: T.surface,
        }}>
          {['', '', 'Nome', 'Tipo', 'Lançamentos', 'Último uso', ''].map((h, i) => (
            <span key={i} style={{
              fontFamily: T.fontSans, fontSize: 10.5, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.08em', color: T.fg4,
            }}>{h}</span>
          ))}
        </div>
        {cats.map((c, i) => (
          <React.Fragment key={i}>
            <div style={{
              display: 'grid', gridTemplateColumns: '32px 32px 1fr 110px 110px 110px 60px',
              gap: 12, padding: '11px 16px', alignItems: 'center',
              opacity: c.archived ? 0.55 : 1,
            }}>
              <span style={{ color: T.fg4, cursor: 'grab' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/>
                  <circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/>
                  <circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/>
                </svg>
              </span>
              <span style={{
                width: 28, height: 28, borderRadius: 6,
                background: T.inset, border: `1px solid ${T.borderSoft}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.fg2,
              }}>
                <c.I size={14} sw={1.7} />
              </span>
              <span style={{ fontSize: 14, color: T.fg1, fontWeight: 500, letterSpacing: '-0.005em' }}>{c.name}</span>
              <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.fg3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {c.kind === 'income' ? 'entrada' : 'despesa'}{c.archived && ' · arq.'}
              </span>
              <span style={{ fontFamily: T.fontMono, fontSize: 12, color: T.fg2 }}>{c.count} lanç.</span>
              <span style={{ fontFamily: T.fontMono, fontSize: 12, color: T.fg3 }}>{c.last}</span>
              <button style={{ background: 'transparent', border: 0, color: T.fg3, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                Editar
              </button>
            </div>
            {i < cats.length - 1 && <div style={{ height: 1, background: T.borderSoft }} />}
          </React.Fragment>
        ))}
      </Card>
    </DesktopMain>
  );
}

// ============================================================================
// SCREEN: Configurações (Mais)
// ============================================================================
function DesktopMaisScreen() {
  const [section, setSection] = useStateD('household');
  const sections = [
    { id: 'household', label: 'Household', icon: Icon.More },
    { id: 'cambio',    label: 'Câmbio',    icon: Icon.Refresh },
    { id: 'tema',      label: 'Tema e aparência', icon: Icon.Settings },
    { id: 'noti',      label: 'Notificações',     icon: Icon.Alert },
    { id: 'pwa',       label: 'PWA · install',    icon: Icon.Card },
    { id: 'dados',     label: 'Dados e privacidade', icon: Icon.Receipt },
    { id: 'sair',      label: 'Sair',     icon: Icon.More },
  ];
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '220px 1fr', height: '100%',
    }}>
      <nav style={{
        background: T.surface, borderRight: `1px solid ${T.borderSoft}`,
        padding: '28px 14px', display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        <Eyebrow style={{ padding: '0 8px 8px' }}>Configurações</Eyebrow>
        {sections.map(s => (
          <button key={s.id} onClick={() => setSection(s.id)} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px',
            borderRadius: 6, border: 0,
            background: section === s.id ? T.brandBg : 'transparent',
            color: section === s.id ? T.brandQF : T.fg2,
            cursor: 'pointer', textAlign: 'left',
            fontFamily: T.fontSans, fontSize: 13, fontWeight: section === s.id ? 600 : 500,
          }}>
            <s.icon size={15} sw={section === s.id ? 1.9 : 1.6} />
            {s.label}
          </button>
        ))}
      </nav>
      <DesktopMain>
        <DesktopHeader
          eyebrow={sections.find(s => s.id === section).label}
          title={section === 'household' ? 'Household' : sections.find(s => s.id === section).label}
        />

        {section === 'household' && (
          <Card padded={false} style={{ maxWidth: 600 }}>
            <DMaisRow label="Nome do household" value="Owner + Member" editable />
            <div style={{ height: 1, background: T.borderSoft }} />
            <DMaisRow label="Email · Owner" value="owner@email.pt" mono />
            <div style={{ height: 1, background: T.borderSoft }} />
            <DMaisRow label="Email · Member" value="member@email.pt" mono />
            <div style={{ height: 1, background: T.borderSoft }} />
            <DMaisRow label="Moeda base" value="EUR · Euro" editable />
            <div style={{ height: 1, background: T.borderSoft }} />
            <DMaisRow label="Fuso horário" value="Europe/Lisbon · UTC+1" mono />
          </Card>
        )}
        {section === 'cambio' && (
          <Card padded={false} style={{ maxWidth: 600 }}>
            <DMaisRow label="Provedor" value="frankfurter.app · BCE" mono />
            <div style={{ height: 1, background: T.borderSoft }} />
            <DMaisRow label="Cotação atual EUR→BRL" value="6,1240" mono />
            <div style={{ height: 1, background: T.borderSoft }} />
            <DMaisRow label="Cotação atual BRL→EUR" value="0,1633" mono />
            <div style={{ height: 1, background: T.borderSoft }} />
            <DMaisRow label="Última atualização" value="hoje · 09:12" mono />
            <div style={{ height: 1, background: T.borderSoft }} />
            <DMaisRow label="Atualização automática" value="Diária · meio-dia UTC" editable />
          </Card>
        )}
        {section === 'tema' && (
          <Card padded={false} style={{ maxWidth: 600 }}>
            <DMaisRow label="Modo" value="Dark" editable />
            <div style={{ height: 1, background: T.borderSoft }} />
            <DMaisRow label="Densidade" value="Padrão" editable />
            <div style={{ height: 1, background: T.borderSoft }} />
            <DMaisRow label="Tabular numerals" value="Sempre" mono />
          </Card>
        )}
        {section === 'noti' && (
          <Card padded={false} style={{ maxWidth: 600 }}>
            <DMaisRow label="Push" value="Desligado" editable />
            <div style={{ height: 1, background: T.borderSoft }} />
            <DMaisRow label="Lembrete fim do mês" value="Dia 28 às 09h" editable />
            <div style={{ height: 1, background: T.borderSoft }} />
            <DMaisRow label="Alerta de divergência" value="Ativado" editable />
          </Card>
        )}
        {section === 'pwa' && (
          <Card style={{ maxWidth: 600, padding: '20px 24px' }}>
            <Eyebrow>Instalar como app</Eyebrow>
            <p style={{ marginTop: 8, color: T.fg2, fontSize: 14, lineHeight: 1.5 }}>
              No iPhone: Compartilhar → "Adicionar à Tela de Início". No Android: menu → "Instalar app". No desktop: ícone "+" na barra de URL.
            </p>
            <Btn size="md" variant="primary" leading={<Icon.Plus size={14} />} style={{ marginTop: 12 }}>
              Mostrar instruções
            </Btn>
          </Card>
        )}
        {section === 'dados' && (
          <Card padded={false} style={{ maxWidth: 600 }}>
            <DMaisRow label="Backup automático" value="Supabase · auto" mono />
            <div style={{ height: 1, background: T.borderSoft }} />
            <DMaisRow label="Exportar dados" value="CSV · JSON" editable />
            <div style={{ height: 1, background: T.borderSoft }} />
            <DMaisRow label="Apagar conta" value="Permanente" editable danger />
          </Card>
        )}
        {section === 'sair' && (
          <Card style={{ maxWidth: 600, padding: '20px 24px' }}>
            <p style={{ margin: 0, color: T.fg2, fontSize: 14 }}>
              Sair encerra a sessão. Magic link via email pra entrar de novo.
            </p>
            <Btn size="md" variant="danger" style={{ marginTop: 14 }}>Sair de owner@email.pt</Btn>
          </Card>
        )}
      </DesktopMain>
    </div>
  );
}

function DMaisRow({ label, value, mono, editable, danger }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '12px 18px',
    }}>
      <span style={{ fontFamily: T.fontSans, fontSize: 13, fontWeight: 500, color: T.fg2 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          fontFamily: mono ? T.fontMono : T.fontSans, fontSize: 13,
          color: danger ? T.neg : T.fg1, fontWeight: mono ? 500 : 500,
        }}>{value}</span>
        {editable && <Icon.Chevron size={14} style={{ color: T.fg4 }} />}
      </div>
    </div>
  );
}

// ============================================================================
// SHARED helpers
// ============================================================================
const iconBtn0 = {
  background: 'transparent', border: `1px solid ${T.borderSoft}`,
  color: T.fg2, cursor: 'pointer', borderRadius: 6, height: 32,
};

function DCalc({ label, cents, color }) {
  return (
    <div>
      <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.fg4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ marginTop: 3 }}><Num cents={cents} sign size={15} weight={600} color={color} /></div>
    </div>
  );
}
function DStat({ kind, label, cents, count }) {
  const map = { paid: T.paidFg, pending: T.pendFg, overdue: T.overFg };
  const c = map[kind];
  return (
    <Card style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: c }} />
        <span style={{ fontFamily: T.fontSans, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: c }}>{label}</span>
      </div>
      <Num cents={cents} size={26} weight={700} color={kind === 'overdue' ? T.neg : T.fg1} style={{ display: 'block', marginTop: 4 }} />
      <span style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.fg4, display: 'block', marginTop: 4 }}>
        {count} {count === 1 ? 'lançamento' : 'lançamentos'}
      </span>
    </Card>
  );
}
function DCatBar({ I, label, cents, pct }) {
  return (
    <div style={{ padding: '12px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
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
function DUpcoming({ date, desc, cat, cents }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '54px 1fr auto', gap: 12, alignItems: 'center', padding: '12px 14px' }}>
      <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.fg3, textAlign: 'center', padding: '4px 0', borderRight: `1px solid ${T.borderSoft}` }}>
        <div style={{ fontWeight: 600, color: T.fg2 }}>{date.split(' ')[0]}</div>
        <div style={{ fontSize: 9, color: T.fg4 }}>{date.split(' ')[1]}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: T.fg1 }}>{desc}</span>
        <span style={{ fontSize: 11, color: T.fg3 }}>{cat}</span>
      </div>
      <Num cents={cents} size={13} weight={600} color={T.fg2} />
    </div>
  );
}
function DActivity({ time, who, what, cents }) {
  return (
    <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: T.fontSans, fontSize: 12, fontWeight: 500, color: T.fg1 }}>{what}</span>
        <Num cents={cents} size={12} weight={600} color={T.fg2} />
      </div>
      <div style={{ display: 'flex', gap: 8, fontFamily: T.fontMono, fontSize: 10.5, color: T.fg4 }}>
        <span>{time}</span><span>·</span><span>{who}</span>
      </div>
    </div>
  );
}
function DField({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
      <Eyebrow>{label}</Eyebrow>
      {children}
    </div>
  );
}
function DInput({ value }) {
  return (
    <input value={value} readOnly style={{
      background: T.inset, border: `1px solid ${T.border}`, borderRadius: 6,
      padding: '11px 14px', height: 44, boxSizing: 'border-box',
      fontFamily: T.fontSans, fontSize: 15, color: T.fg1, outline: 'none', width: '100%',
    }} />
  );
}
function DToggleSeg({ active, children }) {
  return (
    <button style={{
      height: 36, borderRadius: 6, cursor: 'pointer',
      background: active ? T.surface : 'transparent',
      color: active ? T.fg1 : T.fg3,
      border: active ? `1px solid ${T.border}` : '1px solid transparent',
      fontFamily: T.fontSans, fontSize: 13, fontWeight: active ? 600 : 500,
    }}>{children}</button>
  );
}
function DChip({ I, l, active }) {
  return (
    <button style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px',
      borderRadius: 9999,
      background: active ? T.brandBg : T.inset,
      color: active ? T.brandQF : T.fg2,
      border: `1px solid ${active ? 'color-mix(in oklch, var(--brand) 40%, transparent)' : T.borderSoft}`,
      fontFamily: T.fontSans, fontSize: 13, fontWeight: active ? 600 : 500, cursor: 'pointer',
    }}>
      <I size={13} sw={active ? 1.9 : 1.6} />{l}
    </button>
  );
}
function DToggleRow({ label, hint, on }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '12px 14px', background: T.surface,
      border: `1px solid ${T.borderSoft}`, borderRadius: 6,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontFamily: T.fontSans, fontSize: 13, fontWeight: 500, color: T.fg1 }}>{label}</span>
        <span style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.fg4 }}>{hint}</span>
      </div>
      <div style={{
        width: 36, height: 22, borderRadius: 12,
        background: on ? T.brand : T.inset,
        border: `1px solid ${on ? T.brand : T.border}`, position: 'relative',
      }}>
        <div style={{
          position: 'absolute', top: 2, left: on ? 16 : 2,
          width: 16, height: 16, borderRadius: '50%',
          background: on ? T.brandFg : T.fg2,
        }} />
      </div>
    </div>
  );
}
function DRecentItem({ desc, cat, cents }) {
  return (
    <div style={{ padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontFamily: T.fontSans, fontSize: 13, fontWeight: 500, color: T.fg1 }}>{desc}</span>
        <span style={{ fontFamily: T.fontSans, fontSize: 11, color: T.fg3 }}>{cat}</span>
      </div>
      <Num cents={cents} size={13} weight={600} color={T.fg2} />
    </div>
  );
}
function DConfigToggle({ label, on }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '11px 14px',
    }}>
      <span style={{ fontFamily: T.fontSans, fontSize: 13, color: T.fg1, fontWeight: 500 }}>{label}</span>
      <div style={{
        width: 32, height: 20, borderRadius: 10,
        background: on ? T.brand : T.inset,
        border: `1px solid ${on ? T.brand : T.border}`, position: 'relative',
      }}>
        <div style={{
          position: 'absolute', top: 1, left: on ? 13 : 1,
          width: 14, height: 14, borderRadius: '50%',
          background: on ? T.brandFg : T.fg2,
        }} />
      </div>
    </div>
  );
}

// ============================================================================
// DesktopApp — router with sidebar + screen content
// ============================================================================
function DesktopApp() {
  const [active, setActive] = useStateD('dashboard');
  const map = {
    dashboard:   DesktopDashboardScreen,
    lancar:      DesktopLancarScreen,
    transacoes:  DesktopTransacoesScreen,
    dividas:     DesktopDividasScreen,
    contas:      DesktopContasScreen,
    resumo:      DesktopResumoScreen,
    recorrentes: DesktopRecorrentesScreen,
    categorias:  DesktopCategoriasScreen,
    mais:        DesktopMaisScreen,
  };
  const Screen = map[active] || DesktopDashboardScreen;

  // 'mais' has its own internal sub-nav, so we render it differently
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: active === 'dashboard' ? '240px 1fr 340px'
                          : active === 'lancar'    ? '240px 1fr 340px'
                          : '240px 1fr',
      height: '100%',
      background: T.bg,
      fontFamily: T.fontSans,
      color: T.fg1,
    }}>
      <DesktopSidebar active={active} onChange={setActive} />
      <Screen />
    </div>
  );
}

Object.assign(window, { DesktopApp });
