/* global React, Icon, T, Num, HeroNumber, Eyebrow, Editorial, StatusPill, Btn, Card, CCY, fmt,
          AppTopBar, ChromeWindow, BottomNav */
// ============================================================================
// Controle Financeiro — Iterations: empty / loading / error / toast / desktop
// ============================================================================

const useStateI = React.useState;
const useEffectI = React.useEffect;

// ─── EmptyShell — shared layout for empty states ─────────────────────────
function EmptyShell({ icon, title, body, primary, secondary }) {
  return (
    <div style={{
      padding: '64px 28px 24px',
      display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
      gap: 16, height: '100%', boxSizing: 'border-box',
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 10,
        background: T.inset, border: `1px solid ${T.borderSoft}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: T.fg3,
      }}>
        {icon}
      </div>

      <div>
        <h1 style={{
          margin: 0, fontFamily: T.fontSans, fontSize: 22, fontWeight: 600,
          color: T.fg1, letterSpacing: '-0.025em',
        }}>{title}</h1>
        <p style={{ margin: '6px 0 0', color: T.fg3, fontSize: 14, lineHeight: 1.45 }}>
          {body}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', marginTop: 6 }}>
        {primary && <Btn size="md" variant="primary" style={{ width: '100%' }} leading={primary.icon}>{primary.label}</Btn>}
        {secondary && <Btn size="md" variant="ghost" style={{ width: '100%' }}>{secondary.label}</Btn>}
      </div>
    </div>
  );
}

// ============================================================================
// EMPTY: Dashboard (primeira vez)
// ============================================================================
function EmptyDashboardScreen() {
  return (
    <div style={{ paddingBottom: 100 }}>
      <AppTopBar eyebrow="Maio · 2026" title="Dashboard" />

      <section style={{ padding: '12px 20px 18px' }}>
        <Eyebrow style={{ display: 'block', marginBottom: 6 }}>Saldo atual</Eyebrow>
        <HeroNumber cents={0} currency="EUR" sizeInt={56} sizeFrac={28} sizeSym={24} />
        <div style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.fg4, marginTop: 8 }}>
          Adicione uma conta pra ver o saldo
        </div>
      </section>

      <section style={{ padding: '0 20px 16px' }}>
        <div style={{
          padding: '20px 18px',
          background: T.surface, border: `1px dashed ${T.border}`, borderRadius: 8,
          display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: T.brandBg, color: T.brandQF,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon.Plus size={18} sw={1.8} />
          </div>
          <div>
            <span style={{ fontFamily: T.fontSans, fontSize: 16, fontWeight: 600, color: T.fg1, letterSpacing: '-0.01em' }}>
              Comece aqui
            </span>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: T.fg3, lineHeight: 1.5 }}>
              Crie sua primeira conta e lance a primeira despesa do mês. O saldo e a previsão aparecem aqui depois disso.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, width: '100%' }}>
            <Btn size="sm" variant="primary" leading={<Icon.Plus size={14} />} style={{ flex: 1 }}>
              Criar primeira conta
            </Btn>
            <Btn size="sm" variant="secondary" style={{ flex: 1 }}>
              Importar saldo
            </Btn>
          </div>
        </div>
      </section>

      <section style={{ padding: '0 20px 16px', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
        {['Pago', 'Pendente', 'Atraso'].map((label) => (
          <div key={label} style={{
            padding: '11px 12px', background: T.surface,
            border: `1px solid ${T.borderSoft}`, borderRadius: 6,
            display: 'flex', flexDirection: 'column', gap: 4, opacity: 0.5,
          }}>
            <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: T.fg4 }}>
              {label}
            </span>
            <Num cents={0} size={20} weight={700} color={T.fg4} />
            <span style={{ fontFamily: T.fontMono, fontSize: 10, color: T.fg5 }}>—</span>
          </div>
        ))}
      </section>
    </div>
  );
}

// ============================================================================
// EMPTY: Transações
// ============================================================================
function EmptyTransacoesScreen() {
  return (
    <div style={{ paddingBottom: 100 }}>
      <AppTopBar eyebrow="Maio · 2026" title="Transações" />
      <EmptyShell
        icon={<Icon.Receipt size={20} sw={1.6} />}
        title="Sem transações em maio"
        body="O primeiro lançamento aparece aqui. Você pode lançar despesa, entrada ou pagamento de dívida."
        primary={{ label: 'Lançar primeira despesa', icon: <Icon.Plus size={14} /> }}
        secondary={{ label: 'Ver mês anterior' }}
      />
    </div>
  );
}

// ============================================================================
// EMPTY: Dívidas (estado positivo)
// ============================================================================
function EmptyDividasScreen() {
  return (
    <div style={{ paddingBottom: 100 }}>
      <AppTopBar eyebrow="Tudo em dia" title="Dívidas" />
      <div style={{
        padding: '64px 28px 24px',
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
        gap: 16, height: '100%', boxSizing: 'border-box',
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 9999,
          background: T.posBg, color: T.pos,
          border: `1px solid color-mix(in oklch, var(--money-positive) 30%, transparent)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon.Check size={22} sw={2} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontFamily: T.fontSans, fontSize: 22, fontWeight: 600, color: T.fg1, letterSpacing: '-0.025em' }}>
            Sem dívidas em aberto
          </h1>
          <p style={{ margin: '6px 0 0', color: T.fg3, fontSize: 14, lineHeight: 1.45 }}>
            Você não tem dívidas registradas. Boa notícia. Sua sobra prevista deste mês pode ir pra <b style={{ color: T.fg2 }}>caixinha</b> ou conta.
          </p>
        </div>
        <Btn size="md" variant="secondary" style={{ width: '100%' }} leading={<Icon.Plus size={14} />}>
          Registrar dívida nova
        </Btn>
      </div>
    </div>
  );
}

// ============================================================================
// LOADING: Skeleton list (Transações)
// ============================================================================
function LoadingTransacoesScreen() {
  const sk = (w) => (
    <div style={{
      height: 14, width: `${w}%`, borderRadius: 3,
      background: `linear-gradient(90deg, ${T.inset} 0%, ${T.raised} 50%, ${T.inset} 100%)`,
      backgroundSize: '200% 100%',
      animation: 'cfShimmer 1.2s linear infinite',
    }} />
  );

  return (
    <div style={{ paddingBottom: 100 }}>
      <AppTopBar eyebrow="Carregando…" title="Transações" />

      <section style={{ padding: '4px 20px 14px' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          background: T.surface, border: `1px solid ${T.borderSoft}`, borderRadius: 6,
          padding: '11px 12px', gap: 10,
        }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {sk(60)}
              {sk(90)}
            </div>
          ))}
        </div>
      </section>

      {[1, 2, 3].map(day => (
        <section key={day} style={{ padding: '0 20px 12px' }}>
          <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
            {sk(20)}{sk(15)}
          </div>
          <Card padded={false}>
            {[0,1].map(j => (
              <React.Fragment key={j}>
                <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {sk(55)}
                  {sk(30)}
                </div>
                {j === 0 && <div style={{ height: 1, background: T.borderSoft }} />}
              </React.Fragment>
            ))}
          </Card>
        </section>
      ))}
    </div>
  );
}

// ============================================================================
// ERROR: Câmbio indisponível (dashboard com banner de erro)
// ============================================================================
function OfflineExchangeScreen() {
  return (
    <div style={{ paddingBottom: 100 }}>
      <AppTopBar eyebrow="Maio · 2026" title="Dashboard" />

      {/* Error banner — câmbio offline */}
      <section style={{ padding: '6px 20px 14px' }}>
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          padding: '10px 12px',
          background: 'var(--status-pending-bg)',
          border: `1px solid color-mix(in oklch, var(--status-pending-fg) 28%, transparent)`,
          borderRadius: 6,
        }}>
          <Icon.Alert size={16} sw={1.8} style={{ color: 'var(--status-pending-fg)', marginTop: 1, flexShrink: 0 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
            <span style={{ fontFamily: T.fontSans, fontSize: 13, fontWeight: 600, color: 'var(--status-pending-fg)' }}>
              Câmbio indisponível
            </span>
            <span style={{ fontFamily: T.fontSans, fontSize: 12, color: T.fg2, lineHeight: 1.4 }}>
              Usando última cotação salva (23/05). Os valores em BRL podem estar desatualizados.
            </span>
          </div>
          <button style={{
            background: 'transparent', border: 0, color: 'var(--status-pending-fg)',
            cursor: 'pointer', fontFamily: T.fontSans, fontSize: 12, fontWeight: 600,
          }}>Tentar agora</button>
        </div>
      </section>

      <section style={{ padding: '0 20px 18px' }}>
        <Eyebrow style={{ display: 'block', marginBottom: 6 }}>Saldo atual</Eyebrow>
        <HeroNumber cents={218314} currency="EUR" sizeInt={48} sizeFrac={24} sizeSym={22} />
        <div style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.fg4, marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          EUR→BRL · 6,1240 · <span style={{ color: 'var(--status-pending-fg)' }}>cache 23 mai</span>
        </div>
      </section>

      <section style={{ padding: '0 20px 18px' }}>
        <Card>
          <Eyebrow style={{ display: 'block' }}>Sobra prevista · EUR</Eyebrow>
          <div style={{ marginTop: 4 }}>
            <Num cents={61240} sign size={28} weight={700} color={T.pos} />
          </div>
        </Card>
      </section>
    </div>
  );
}

// ============================================================================
// ERROR: Sync (saldo da conta diverge)
// ============================================================================
function SyncWarningScreen() {
  return (
    <div style={{ paddingBottom: 100 }}>
      <AppTopBar eyebrow="3 contas" title="Contas" />

      <section style={{ padding: '6px 20px 14px' }}>
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          padding: '12px 12px',
          background: 'var(--status-overdue-bg)',
          border: `1px solid color-mix(in oklch, var(--status-overdue-fg) 28%, transparent)`,
          borderRadius: 6,
        }}>
          <Icon.Alert size={16} sw={1.8} style={{ color: 'var(--status-overdue-fg)', marginTop: 1, flexShrink: 0 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
            <span style={{ fontFamily: T.fontSans, fontSize: 13, fontWeight: 600, color: 'var(--status-overdue-fg)' }}>
              Saldo divergente · Revolut · principal
            </span>
            <span style={{ fontFamily: T.fontSans, fontSize: 12, color: T.fg2, lineHeight: 1.4 }}>
              Σ dos pagos do mês é <Num cents={148260} size={12} weight={600} color={T.fg1} />, mas ajustes manuais somam só <Num cents={120000} size={12} weight={600} color={T.fg1} />. Diferença de <Num cents={28260} size={12} weight={600} color="var(--status-overdue-fg)" />.
            </span>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <Btn size="sm" variant="primary">Conciliar saldo</Btn>
              <Btn size="sm" variant="ghost">Ignorar</Btn>
            </div>
          </div>
        </div>
      </section>

      <section style={{ padding: '0 20px 16px' }}>
        <Card>
          <span style={{
            fontFamily: T.fontSans, fontSize: 11, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.08em', color: T.fg3,
          }}>Revolut · principal</span>
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <Num cents={120000} currency="EUR" size={26} weight={700} color={T.fg1} />
            <span style={{ fontFamily: T.fontMono, fontSize: 11, color: 'var(--status-overdue-fg)' }}>
              −€ 282,60 vs. esperado
            </span>
          </div>
        </Card>
      </section>
    </div>
  );
}

// ============================================================================
// TOAST primitive — bottom-anchored notification
// ============================================================================
function Toast({ kind = 'success', title, body, action }) {
  const map = {
    success: { fg: T.paidFg, bg: T.paidBg, icon: <Icon.Check size={14} sw={2.2} /> },
    error:   { fg: T.overFg, bg: T.overBg, icon: <Icon.Alert size={14} sw={1.8} /> },
    info:    { fg: T.brandQF, bg: T.brandBg, icon: <Icon.Refresh size={14} sw={1.8} /> },
  };
  const c = map[kind];
  return (
    <div style={{
      position: 'absolute', left: 12, right: 12, bottom: 80, zIndex: 50,
      padding: '10px 12px',
      background: T.raised,
      border: `1px solid color-mix(in oklch, ${c.fg} 28%, transparent)`,
      borderRadius: 8,
      boxShadow: '0 12px 32px -8px oklch(0% 0 0 / 0.5)',
      display: 'flex', alignItems: 'flex-start', gap: 10,
      animation: 'cfToastIn 280ms cubic-bezier(0.2, 0, 0, 1)',
    }}>
      <span style={{
        width: 26, height: 26, borderRadius: 6,
        background: c.bg, color: c.fg, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{c.icon}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
        <span style={{ fontFamily: T.fontSans, fontSize: 13, fontWeight: 600, color: T.fg1, letterSpacing: '-0.005em' }}>
          {title}
        </span>
        {body && <span style={{ fontFamily: T.fontSans, fontSize: 12, color: T.fg3 }}>{body}</span>}
      </div>
      {action && (
        <button style={{
          background: 'transparent', border: 0, color: c.fg, cursor: 'pointer',
          fontFamily: T.fontSans, fontSize: 12, fontWeight: 600, letterSpacing: '0.02em',
          padding: '4px 8px',
        }}>{action}</button>
      )}
    </div>
  );
}

Object.assign(window, {
  Toast,
  EmptyDashboardScreen, EmptyTransacoesScreen, EmptyDividasScreen,
  LoadingTransacoesScreen, OfflineExchangeScreen, SyncWarningScreen,
});
