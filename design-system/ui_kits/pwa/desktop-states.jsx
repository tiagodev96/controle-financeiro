/* global React, Icon, T, Num, HeroNumber, Eyebrow, StatusPill, Btn, Card, CCY, fmt,
          DesktopSidebar, DesktopMain, DesktopAside, DesktopHeader */
// ============================================================================
// Controle Financeiro — Desktop states / modals / toasts / tablet
// ============================================================================

const useStateS = React.useState;

// ─── Selector tabs (used inside a Chrome window) ─────────────────────────
function StateTabs({ value, options, onChange }) {
  return (
    <div style={{
      display: 'flex', gap: 2, padding: 3,
      background: T.inset, border: `1px solid ${T.borderSoft}`, borderRadius: 9999,
      width: 'fit-content', marginBottom: 18,
    }}>
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)} style={{
          padding: '6px 14px', borderRadius: 9999, border: 0, cursor: 'pointer',
          background: value === o.value ? T.surface : 'transparent',
          color: value === o.value ? T.fg1 : T.fg3,
          fontFamily: T.fontSans, fontSize: 12, fontWeight: value === o.value ? 600 : 500,
          boxShadow: value === o.value ? '0 1px 2px oklch(0% 0 0 / 0.3)' : 'none',
        }}>{o.label}</button>
      ))}
    </div>
  );
}

// ============================================================================
// DESKTOP STATES: empty / loading / error
// ============================================================================
function DesktopStatesDemo() {
  const [state, setState] = useStateS('empty');
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '240px 1fr',
      height: '100%', background: T.bg, fontFamily: T.fontSans, color: T.fg1,
    }}>
      <DesktopSidebar active="dashboard" onChange={() => {}} />
      <DesktopMain>
        <DesktopHeader
          eyebrow="Maio · 2026"
          title="Dashboard"
          actions={
            <StateTabs
              value={state} onChange={setState}
              options={[
                { value: 'empty',   label: 'Empty' },
                { value: 'loading', label: 'Loading' },
                { value: 'cambio',  label: 'Câmbio offline' },
                { value: 'sync',    label: 'Saldo divergente' },
              ]}
            />
          }
        />
        {state === 'empty'   && <DesktopEmptyContent />}
        {state === 'loading' && <DesktopLoadingContent />}
        {state === 'cambio'  && <DesktopCambioOfflineContent />}
        {state === 'sync'    && <DesktopSyncWarningContent />}
      </DesktopMain>
    </div>
  );
}

// ─── Empty: primeira vez ─────────────────────────────────────────────────
function DesktopEmptyContent() {
  return (
    <React.Fragment>
      <section style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20, marginBottom: 20 }}>
        <Card style={{ padding: '20px 24px', opacity: 0.6 }}>
          <Eyebrow>Saldo atual</Eyebrow>
          <div style={{ marginTop: 8 }}>
            <HeroNumber cents={0} currency="EUR" sizeInt={56} sizeFrac={28} sizeSym={26} />
          </div>
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.borderSoft}`,
            fontFamily: T.fontMono, fontSize: 11, color: T.fg4 }}>
            adicione uma conta pra começar
          </div>
        </Card>
        <Card style={{
          padding: '20px 22px',
          background: T.bg, border: `1px dashed ${T.border}`,
          display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start',
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 8,
            background: T.brandBg, color: T.brandQF,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon.Plus size={20} sw={1.8} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontFamily: T.fontSans, fontSize: 17, fontWeight: 600, color: T.fg1 }}>
              Comece aqui
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: T.fg3, lineHeight: 1.45 }}>
              Crie uma conta e digite o saldo atual. Lance a primeira despesa do mês. O dashboard se monta a partir disso.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn size="sm" variant="primary" leading={<Icon.Plus size={14} />}>Primeira conta</Btn>
            <Btn size="sm" variant="secondary">Tour rápido</Btn>
          </div>
        </Card>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {['Pago', 'Pendente', 'Em atraso'].map(l => (
          <Card key={l} style={{ padding: '14px 16px', opacity: 0.4 }}>
            <Eyebrow>{l}</Eyebrow>
            <Num cents={0} size={24} weight={700} color={T.fg4} style={{ display: 'block', marginTop: 4 }} />
            <span style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.fg5, display: 'block', marginTop: 4 }}>—</span>
          </Card>
        ))}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, opacity: 0.5 }}>
        <Card style={{ padding: '14px 16px' }}>
          <h2 style={{ margin: 0, fontSize: 14, color: T.fg3 }}>Top categorias</h2>
          <div style={{ marginTop: 20, fontSize: 13, color: T.fg4, fontStyle: 'italic' }}>
            aparece após o primeiro lançamento
          </div>
        </Card>
        <Card style={{ padding: '14px 16px' }}>
          <h2 style={{ margin: 0, fontSize: 14, color: T.fg3 }}>Próximos 7 dias</h2>
          <div style={{ marginTop: 20, fontSize: 13, color: T.fg4, fontStyle: 'italic' }}>
            aparece após criar recorrentes
          </div>
        </Card>
      </section>
    </React.Fragment>
  );
}

// ─── Loading: skeleton everywhere ────────────────────────────────────────
function DesktopLoadingContent() {
  const sk = (w, h = 14) => (
    <div style={{
      height: h, width: typeof w === 'number' ? `${w}%` : w, borderRadius: 3,
      background: `linear-gradient(90deg, ${T.inset} 0%, ${T.raised} 50%, ${T.inset} 100%)`,
      backgroundSize: '200% 100%',
      animation: 'cfShimmer 1.2s linear infinite',
    }} />
  );
  return (
    <React.Fragment>
      <section style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20, marginBottom: 20 }}>
        <Card style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sk(35, 10)}
          {sk(50, 48)}
          <div style={{ paddingTop: 8, borderTop: `1px solid ${T.borderSoft}`, display: 'flex', gap: 12 }}>
            {sk(30, 12)}{sk(20, 12)}
          </div>
        </Card>
        <Card style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sk(40, 10)}
          {sk(60, 36)}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, paddingTop: 8, borderTop: `1px solid ${T.borderSoft}` }}>
            {sk(60, 12)}{sk(80, 12)}{sk(50, 12)}
          </div>
        </Card>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[0,1,2,3].map(i => (
          <Card key={i} style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sk(40, 10)}{sk(70, 24)}{sk(30, 10)}
          </Card>
        ))}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <Card padded={false}>
          {[0,1,2,3].map(i => (
            <React.Fragment key={i}>
              <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {sk(50)}{sk(30, 6)}
              </div>
              {i < 3 && <div style={{ height: 1, background: T.borderSoft }} />}
            </React.Fragment>
          ))}
        </Card>
        <Card padded={false}>
          {[0,1,2,3].map(i => (
            <React.Fragment key={i}>
              <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {sk(60)}{sk(40, 6)}
              </div>
              {i < 3 && <div style={{ height: 1, background: T.borderSoft }} />}
            </React.Fragment>
          ))}
        </Card>
      </section>
    </React.Fragment>
  );
}

// ─── Erro: câmbio offline ─────────────────────────────────────────────────
function DesktopCambioOfflineContent() {
  return (
    <React.Fragment>
      <section style={{ marginBottom: 20 }}>
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 12,
          padding: '14px 16px',
          background: 'var(--status-pending-bg)',
          border: `1px solid color-mix(in oklch, var(--status-pending-fg) 28%, transparent)`,
          borderRadius: 6,
        }}>
          <Icon.Alert size={18} sw={1.8} style={{ color: 'var(--status-pending-fg)', marginTop: 1, flexShrink: 0 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
            <span style={{ fontFamily: T.fontSans, fontSize: 14, fontWeight: 600, color: 'var(--status-pending-fg)' }}>
              Câmbio indisponível · frankfurter.app não respondeu
            </span>
            <span style={{ fontFamily: T.fontSans, fontSize: 13, color: T.fg2, lineHeight: 1.45 }}>
              Usando última cotação salva (23/05 · EUR→BRL 6,1240). Os valores em BRL convertidos podem estar desatualizados em até 2 dias.
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <Btn size="sm" variant="secondary">Tentar agora</Btn>
            <Btn size="sm" variant="ghost">Ignorar</Btn>
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20 }}>
        <Card style={{ padding: '20px 24px' }}>
          <Eyebrow>Saldo atual · cache 23 mai</Eyebrow>
          <div style={{ marginTop: 8 }}>
            <HeroNumber cents={218314} currency="EUR" sizeInt={56} sizeFrac={28} sizeSym={26} />
          </div>
          <div style={{
            display: 'flex', gap: 12, marginTop: 14,
            paddingTop: 12, borderTop: `1px solid ${T.borderSoft}`,
            alignItems: 'center',
          }}>
            <CCY code="EUR" />
            <span style={{ fontFamily: T.fontMono, fontSize: 12, color: T.fg2 }}>€ 1.840,00</span>
            <span style={{ color: T.fg5 }}>·</span>
            <CCY code="BRL" />
            <span style={{ fontFamily: T.fontMono, fontSize: 12, color: 'var(--status-pending-fg)' }}>R$ 2.103,80 ⓘ</span>
            <span style={{ marginLeft: 'auto', fontFamily: T.fontMono, fontSize: 11, color: 'var(--status-pending-fg)' }}>
              cache 23 mai
            </span>
          </div>
        </Card>
        <Card style={{ padding: '20px 24px' }}>
          <Eyebrow>Sobra prevista · EUR</Eyebrow>
          <div style={{ marginTop: 8 }}>
            <Num cents={61240} sign size={40} weight={700} color={T.pos} />
          </div>
        </Card>
      </section>
    </React.Fragment>
  );
}

// ─── Erro: saldo divergente ──────────────────────────────────────────────
function DesktopSyncWarningContent() {
  return (
    <React.Fragment>
      <section style={{ marginBottom: 20 }}>
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 12,
          padding: '14px 16px',
          background: 'var(--status-overdue-bg)',
          border: `1px solid color-mix(in oklch, var(--status-overdue-fg) 28%, transparent)`,
          borderRadius: 6,
        }}>
          <Icon.Alert size={18} sw={1.8} style={{ color: 'var(--status-overdue-fg)', marginTop: 1, flexShrink: 0 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
            <span style={{ fontFamily: T.fontSans, fontSize: 14, fontWeight: 600, color: 'var(--status-overdue-fg)' }}>
              Saldo divergente · Revolut · principal
            </span>
            <span style={{ fontFamily: T.fontSans, fontSize: 13, color: T.fg2, lineHeight: 1.45 }}>
              Σ dos pagos do mês é <Num cents={148260} size={13} weight={600} color={T.fg1} />, mas ajustes manuais somam só <Num cents={120000} size={13} weight={600} color={T.fg1} />. Diferença de <Num cents={28260} size={13} weight={600} color="var(--status-overdue-fg)" /> que pode estar perdida.
            </span>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <Btn size="sm" variant="primary">Conciliar saldo</Btn>
              <Btn size="sm" variant="secondary">Ver discrepância</Btn>
              <Btn size="sm" variant="ghost">Ignorar este mês</Btn>
            </div>
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <Card style={{ padding: '14px 16px' }}>
          <Eyebrow>Revolut · principal</Eyebrow>
          <Num cents={120000} currency="EUR" size={24} weight={700} color={T.fg1} style={{ display: 'block', marginTop: 4 }} />
          <span style={{ fontFamily: T.fontMono, fontSize: 11, color: 'var(--status-overdue-fg)', display: 'block', marginTop: 4 }}>
            −€ 282,60 vs. esperado
          </span>
        </Card>
        <Card style={{ padding: '14px 16px' }}>
          <Eyebrow>CGD · ordenado</Eyebrow>
          <Num cents={60000} currency="EUR" size={24} weight={700} color={T.fg1} style={{ display: 'block', marginTop: 4 }} />
          <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.pos, display: 'block', marginTop: 4 }}>
            ok · sem divergência
          </span>
        </Card>
        <Card style={{ padding: '14px 16px' }}>
          <Eyebrow>Itaú · BR</Eyebrow>
          <Num cents={210380} currency="BRL" size={20} weight={700} color={T.fg1} style={{ display: 'block', marginTop: 4 }} />
          <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.pos, display: 'block', marginTop: 4 }}>
            ok · sem divergência
          </span>
        </Card>
      </section>
    </React.Fragment>
  );
}

// ============================================================================
// CENTERED MODAL — desktop pattern (NOT bottom sheet)
// ============================================================================
function CenteredModal({ title, width = 480, children, footer }) {
  return (
    <React.Fragment>
      <div style={{
        position: 'absolute', inset: 0, background: 'oklch(0% 0 0 / 0.55)',
        backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)', zIndex: 30,
      }} />
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width, maxHeight: '85%',
        background: T.bg,
        border: `1px solid ${T.border}`,
        borderRadius: 10,
        boxShadow: '0 24px 64px -8px oklch(0% 0 0 / 0.55), 0 8px 16px -4px oklch(0% 0 0 / 0.4)',
        display: 'flex', flexDirection: 'column',
        zIndex: 31,
        animation: 'cfModalIn 220ms cubic-bezier(0.2, 0, 0, 1)',
        overflow: 'hidden',
      }}>
        <header style={{
          padding: '14px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: `1px solid ${T.borderSoft}`,
        }}>
          <h2 style={{ margin: 0, fontFamily: T.fontSans, fontSize: 16, fontWeight: 600, color: T.fg1, letterSpacing: '-0.02em' }}>{title}</h2>
          <button style={{
            background: 'transparent', border: 0, color: T.fg3, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 26, height: 26, borderRadius: 6,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </header>
        <div style={{ flex: 1, overflow: 'auto', padding: '18px 20px' }}>{children}</div>
        {footer && (
          <footer style={{
            padding: '14px 20px',
            borderTop: `1px solid ${T.borderSoft}`,
            display: 'flex', gap: 8, justifyContent: 'flex-end',
          }}>{footer}</footer>
        )}
      </div>
    </React.Fragment>
  );
}

function DesktopModalsDemo() {
  const [open, setOpen] = useStateS('cat');
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '240px 1fr',
      height: '100%', background: T.bg, fontFamily: T.fontSans, color: T.fg1,
      position: 'relative',
    }}>
      <DesktopSidebar active="categorias" onChange={() => {}} />
      <DesktopMain>
        <DesktopHeader
          eyebrow="12 ativas"
          title="Categorias"
          actions={
            <StateTabs
              value={open} onChange={setOpen}
              options={[
                { value: 'cat',  label: 'Nova categoria' },
                { value: 'div',  label: 'Nova dívida' },
                { value: 'pgto', label: 'Pagamento de dívida' },
                { value: 'conf', label: 'Confirmação destrutiva' },
              ]}
            />
          }
        />
        {/* Faded background — would be the actual page */}
        <div style={{ opacity: 0.35, pointerEvents: 'none' }}>
          <p style={{ color: T.fg3, fontSize: 13, marginBottom: 14 }}>conteúdo da tela atrás do modal…</p>
          <Card padded={false}>
            {['Moradia', 'Alimentação', 'Pet', 'Saúde', 'Lazer'].map((c, i, arr) => (
              <React.Fragment key={c}>
                <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: T.fg1 }}>{c}</span>
                  <span style={{ fontFamily: T.fontMono, fontSize: 12, color: T.fg3 }}>despesa</span>
                </div>
                {i < arr.length - 1 && <div style={{ height: 1, background: T.borderSoft }} />}
              </React.Fragment>
            ))}
          </Card>
        </div>
      </DesktopMain>

      {open === 'cat'  && <ModalNovaCategoria />}
      {open === 'div'  && <ModalNovaDivida />}
      {open === 'pgto' && <ModalRegistrarPagamento />}
      {open === 'conf' && <ModalConfirmDestructive />}
    </div>
  );
}

function ModalNovaCategoria() {
  const icons = [Icon.Home, Icon.Food, Icon.Pet, Icon.Health, Icon.Car, Icon.Fun, Icon.Cal, Icon.Card, Icon.More, Icon.Settings, Icon.Refresh, Icon.Plus];
  return (
    <CenteredModal title="Nova categoria" width={460}
      footer={
        <React.Fragment>
          <Btn size="md" variant="secondary">Cancelar</Btn>
          <Btn size="md" variant="primary" leading={<Icon.Check size={14} />}>Criar categoria</Btn>
        </React.Fragment>
      }>
      <ModalField label="Nome" value="Pet" />
      <ModalField label="Tipo">
        <div style={{ display: 'flex', gap: 6 }}>
          {['Despesa', 'Entrada'].map((l, i) => (
            <button key={l} style={{
              flex: 1, padding: '9px 12px', borderRadius: 6,
              background: i === 0 ? T.brandBg : T.inset,
              color: i === 0 ? T.brandQF : T.fg2,
              border: `1px solid ${i === 0 ? 'color-mix(in oklch, var(--brand) 40%, transparent)' : T.borderSoft}`,
              fontFamily: T.fontSans, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>{l}</button>
          ))}
        </div>
      </ModalField>
      <ModalField label="Ícone" hint="Lucide · stroke 1.6">
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6,
          padding: 8, background: T.inset, border: `1px solid ${T.borderSoft}`, borderRadius: 6,
        }}>
          {icons.map((I, i) => {
            const on = i === 1;
            return (
              <button key={i} style={{
                aspectRatio: '1', borderRadius: 6,
                background: on ? T.brandBg : 'transparent',
                color: on ? T.brandQF : T.fg2,
                border: `1px solid ${on ? 'color-mix(in oklch, var(--brand) 35%, transparent)' : 'transparent'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              }}>
                <I size={18} sw={on ? 1.9 : 1.6} />
              </button>
            );
          })}
        </div>
      </ModalField>
    </CenteredModal>
  );
}

function ModalNovaDivida() {
  return (
    <CenteredModal title="Nova dívida" width={520}
      footer={
        <React.Fragment>
          <Btn size="md" variant="secondary">Cancelar</Btn>
          <Btn size="md" variant="primary">Criar dívida</Btn>
        </React.Fragment>
      }>
      <ModalField label="Nome" value="Empréstimo Jefferson" />
      <ModalField label="Valor original" hint="o quanto você deve no total">
        <div style={{
          padding: '12px 14px', background: T.inset,
          border: `1px solid ${T.brand}`, borderRadius: 8,
          boxShadow: `0 0 0 3px oklch(73% 0.135 80 / 0.18)`,
          display: 'flex', alignItems: 'baseline', gap: 8,
        }}>
          <span style={{ fontFamily: T.fontSans, fontWeight: 500, fontSize: 22, color: T.fg3, letterSpacing: '-0.01em' }}>€</span>
          <span style={{
            fontFamily: T.fontNum, fontVariantNumeric: 'tabular-nums',
            fontWeight: 700, fontSize: 32, color: T.fg1, letterSpacing: '-0.03em',
          }}>3.000,00</span>
        </div>
      </ModalField>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <ModalField label="Moeda">
          <div style={{ display: 'flex', gap: 4 }}>
            {['EUR', 'BRL'].map((c, i) => (
              <button key={c} style={{
                flex: 1, padding: '8px 12px', borderRadius: 6,
                background: i === 0 ? T.brandBg : T.inset,
                color: i === 0 ? T.brandQF : T.fg2,
                border: `1px solid ${i === 0 ? 'color-mix(in oklch, var(--brand) 40%, transparent)' : T.borderSoft}`,
                fontFamily: T.fontMono, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>{c}</button>
            ))}
          </div>
        </ModalField>
        <ModalField label="Prioridade">
          <div style={{ display: 'flex', gap: 4 }}>
            {['Alta', 'Média', 'Baixa'].map((p, i) => (
              <button key={p} style={{
                flex: 1, padding: '8px 8px', borderRadius: 6,
                background: i === 0 ? T.brandBg : T.inset,
                color: i === 0 ? T.brandQF : T.fg2,
                border: `1px solid ${i === 0 ? 'color-mix(in oklch, var(--brand) 40%, transparent)' : T.borderSoft}`,
                fontFamily: T.fontSans, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>{p}</button>
            ))}
          </div>
        </ModalField>
      </div>
      <ModalField label="Notas" hint="opcional · 0/200" value="" placeholder="Ex: pagar 60%+ se sobrar este mês" />
    </CenteredModal>
  );
}

function ModalRegistrarPagamento() {
  return (
    <CenteredModal title="Registrar pagamento" width={440}
      footer={
        <React.Fragment>
          <Btn size="md" variant="secondary">Cancelar</Btn>
          <Btn size="md" variant="primary" leading={<Icon.Check size={14} />}>Confirmar pagamento</Btn>
        </React.Fragment>
      }>
      <div style={{
        padding: '12px 14px', background: T.surface,
        border: `1px solid ${T.borderSoft}`, borderRadius: 6,
        marginBottom: 16,
      }}>
        <span style={{ fontFamily: T.fontSans, fontSize: 14, fontWeight: 600, color: T.fg1 }}>Empréstimo Jefferson</span>
        <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.fg3, marginTop: 4 }}>
          resta <span style={{ color: T.fg1, fontWeight: 600 }}>€ 1.875,00</span> · prioridade alta
        </div>
      </div>
      <ModalField label="Valor">
        <div style={{
          padding: '12px 14px', background: T.inset,
          border: `1px solid ${T.brand}`, borderRadius: 8,
          boxShadow: `0 0 0 3px oklch(73% 0.135 80 / 0.18)`,
          display: 'flex', alignItems: 'baseline', gap: 8,
        }}>
          <span style={{ fontFamily: T.fontSans, fontWeight: 500, fontSize: 22, color: T.fg3 }}>€</span>
          <span style={{ fontFamily: T.fontNum, fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 32, color: T.fg1, letterSpacing: '-0.03em' }}>367,44</span>
          <span style={{ marginLeft: 'auto', fontFamily: T.fontMono, fontSize: 11, color: T.brandQF }}>19,6%</span>
        </div>
      </ModalField>
      <ModalField label="Conta">
        <div style={{
          background: T.inset, border: `1px solid ${T.border}`, borderRadius: 6,
          padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <CCY code="EUR" />
          <span style={{ fontSize: 14, color: T.fg1 }}>Revolut · principal</span>
        </div>
      </ModalField>
    </CenteredModal>
  );
}

function ModalConfirmDestructive() {
  return (
    <CenteredModal title="Apagar transação?" width={420}
      footer={
        <React.Fragment>
          <Btn size="md" variant="secondary">Cancelar</Btn>
          <Btn size="md" variant="danger" leading={<Icon.Alert size={14} />}>Apagar permanentemente</Btn>
        </React.Fragment>
      }>
      <div style={{
        padding: '12px 14px', background: 'var(--money-negative-bg)',
        border: `1px solid color-mix(in oklch, var(--money-negative) 30%, transparent)`,
        borderRadius: 6, marginBottom: 14,
      }}>
        <div style={{ fontFamily: T.fontSans, fontSize: 14, fontWeight: 600, color: T.fg1 }}>
          Mercado · Pingo Doce
        </div>
        <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.fg3, marginTop: 3 }}>
          25 mai · Alimentação · Tiago · <Num cents={-14255} size={11} weight={600} color={T.neg} />
        </div>
      </div>
      <p style={{ margin: 0, fontFamily: T.fontSans, fontSize: 13, color: T.fg2, lineHeight: 1.5 }}>
        Essa ação não pode ser desfeita. A transação some das listas e do total do mês. O saldo da conta <b style={{ color: T.fg1 }}>não</b> é ajustado automaticamente — você pode fazer isso depois.
      </p>
    </CenteredModal>
  );
}

function ModalField({ label, hint, value, placeholder, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
      <span style={{
        fontFamily: T.fontSans, fontSize: 11, fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.08em', color: T.fg3,
      }}>{label}</span>
      {children || (
        <input value={value || ''} placeholder={placeholder} readOnly style={{
          background: T.inset, border: `1px solid ${T.border}`, borderRadius: 6,
          padding: '11px 14px', height: 42, boxSizing: 'border-box',
          fontFamily: T.fontSans, fontSize: 14, color: T.fg1, outline: 'none', width: '100%',
        }} />
      )}
      {hint && <span style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.fg4 }}>{hint}</span>}
    </div>
  );
}

// ============================================================================
// DESKTOP TOAST stack (top-right) + advanced variants
// ============================================================================
function DesktopToastsDemo() {
  const [variant, setVariant] = useStateS('basic');
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '240px 1fr',
      height: '100%', background: T.bg, fontFamily: T.fontSans, color: T.fg1,
      position: 'relative',
    }}>
      <DesktopSidebar active="dashboard" onChange={() => {}} />
      <DesktopMain>
        <DesktopHeader
          eyebrow="Maio · 2026 · pós-lançamento"
          title="Dashboard"
          actions={
            <StateTabs
              value={variant} onChange={setVariant}
              options={[
                { value: 'basic',    label: 'Básico (3)' },
                { value: 'advanced', label: 'Avançado (3)' },
              ]}
            />
          }
        />
        <p style={{ color: T.fg3, fontSize: 13, marginBottom: 14, maxWidth: 560, lineHeight: 1.5 }}>
          {variant === 'basic'
            ? 'Toasts no desktop ficam no canto superior direito, empilhados, fora do fluxo de leitura. Auto-dismiss em 4s para sucesso/info; persistente para erro (até clicar X ou agir).'
            : 'Variantes especializadas: progress bar de auto-dismiss visível, ícone customizado (não só success/error/info), e undo flow com countdown.'}
        </p>
        <div style={{ opacity: 0.45, pointerEvents: 'none' }}>
          <Card style={{ padding: '14px 16px', marginBottom: 12 }}>
            <Eyebrow>Saldo atual</Eyebrow>
            <HeroNumber cents={204059} currency="EUR" sizeInt={42} sizeFrac={22} sizeSym={22} />
          </Card>
        </div>
      </DesktopMain>

      <div style={{
        position: 'absolute', top: 20, right: 20, zIndex: 50,
        display: 'flex', flexDirection: 'column', gap: 8, width: 360,
      }}>
        {variant === 'basic' && (
          <React.Fragment>
            <DesktopToast kind="success" title="Despesa lançada" body="Mercado · Pingo Doce · −€ 142,55 · saldo previsto € 2.040,59" action="Desfazer" />
            <DesktopToast kind="info" title="Câmbio atualizado" body="EUR→BRL · 6,1240 · há 12s" />
            <DesktopToast kind="error" title="Sync falhou" body="Sem conexão com Supabase. Tentando novamente em 15s." action="Reenviar agora" />
          </React.Fragment>
        )}
        {variant === 'advanced' && (
          <React.Fragment>
            <DesktopToastProgress kind="success" title="Despesa lançada" body="Mercado · Pingo Doce · −€ 142,55" duration={4} />
            <DesktopToastCustom
              iconKind="brand"
              icon={<Icon.Refresh size={14} sw={1.8} />}
              title="Câmbio atualizando…"
              body="frankfurter.app · BCE · próx. 12:00 UTC"
              indeterminate
            />
            <DesktopToastUndo
              title="Transação apagada"
              body="Mercado · Pingo Doce · −€ 142,55"
              remaining={3}
            />
          </React.Fragment>
        )}
      </div>
    </div>
  );
}

function DesktopToast({ kind, title, body, action }) {
  const map = {
    success: { fg: T.paidFg, bg: T.paidBg, icon: <Icon.Check size={14} sw={2.2} /> },
    error:   { fg: T.overFg, bg: T.overBg, icon: <Icon.Alert size={14} sw={1.8} /> },
    info:    { fg: T.brandQF, bg: T.brandBg, icon: <Icon.Refresh size={14} sw={1.8} /> },
  };
  const c = map[kind];
  return (
    <div style={{
      padding: '12px 14px',
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 0 }}>
        <span style={{ fontFamily: T.fontSans, fontSize: 13, fontWeight: 600, color: T.fg1, letterSpacing: '-0.005em' }}>
          {title}
        </span>
        {body && <span style={{ fontFamily: T.fontSans, fontSize: 12, color: T.fg3, lineHeight: 1.4 }}>{body}</span>}
        {action && (
          <button style={{
            alignSelf: 'flex-start', marginTop: 4, padding: '3px 0',
            background: 'transparent', border: 0, color: c.fg, cursor: 'pointer',
            fontFamily: T.fontSans, fontSize: 12, fontWeight: 600,
          }}>{action} →</button>
        )}
      </div>
      <button style={{
        background: 'transparent', border: 0, color: T.fg4, cursor: 'pointer',
        padding: 2, alignSelf: 'flex-start',
      }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>
  );
}

// ============================================================================
// TABLET app — 1024px viewport, dashboard adapted
// ============================================================================
function TabletApp() {
  const [active, setActive] = useStateS('dashboard');
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '64px 1fr',
      height: '100%', background: T.bg, fontFamily: T.fontSans, color: T.fg1,
    }}>
      {/* Compact icon-only sidebar */}
      <aside style={{
        background: T.surface, borderRight: `1px solid ${T.borderSoft}`,
        padding: '20px 8px 16px', display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 8,
      }}>
        <div style={{ padding: '4px 0 12px' }}>
          <svg width="22" height="22" viewBox="0 0 64 64" fill="none">
            <rect x="6" y="8" width="52" height="48" rx="3" stroke="var(--fg2)" strokeWidth="2"/>
            <line x1="14" y1="22" x2="50" y2="22" stroke="var(--border-strong)" strokeWidth="1.5"/>
            <line x1="14" y1="30" x2="42" y2="30" stroke="var(--border-strong)" strokeWidth="1.5"/>
            <line x1="14" y1="38" x2="46" y2="38" stroke="var(--border-strong)" strokeWidth="1.5"/>
            <line x1="14" y1="46" x2="36" y2="46" stroke="var(--border-strong)" strokeWidth="1.5"/>
            <rect x="42" y="42" width="10" height="2" fill="var(--brand)"/>
          </svg>
        </div>
        {[
          { id: 'dashboard',  I: Icon.Dashboard },
          { id: 'lancar',     I: Icon.Plus },
          { id: 'transacoes', I: Icon.Receipt },
          { id: 'dividas',    I: Icon.Card },
          { id: 'recorrentes',I: Icon.Refresh },
          { id: 'contas',     I: Icon.More },
          { id: 'mais',       I: Icon.Settings },
        ].map(it => (
          <button key={it.id} onClick={() => setActive(it.id)} style={{
            width: 44, height: 44, borderRadius: 8,
            background: active === it.id ? T.brandBg : 'transparent',
            color: active === it.id ? T.brandQF : T.fg3, border: 0, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <it.I size={18} sw={active === it.id ? 1.9 : 1.6} />
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{
          width: 36, height: 36, borderRadius: 9999,
          background: T.brandBg, color: T.brandQF,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 13,
        }}>T</div>
      </aside>

      <main style={{ padding: '24px 28px', overflow: 'auto' }}>
        <header style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
          marginBottom: 20,
        }}>
          <div>
            <Eyebrow>Maio · 2026 · 25 mai</Eyebrow>
            <h1 style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 600, color: T.fg1, letterSpacing: '-0.025em' }}>
              Dashboard
            </h1>
          </div>
          <Btn size="sm" variant="primary" leading={<Icon.Plus size={14} />}>Lançar despesa</Btn>
        </header>

        {/* Hero — saldo + sobra ainda side-by-side mas mais apertados */}
        <section style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 14, marginBottom: 16 }}>
          <Card style={{ padding: '16px 18px' }}>
            <Eyebrow>Saldo atual · EUR</Eyebrow>
            <div style={{ marginTop: 6 }}>
              <HeroNumber cents={218314} currency="EUR" sizeInt={44} sizeFrac={22} sizeSym={22} />
            </div>
            <div style={{
              display: 'flex', gap: 10, marginTop: 10, paddingTop: 10,
              borderTop: `1px solid ${T.borderSoft}`, alignItems: 'center',
              fontFamily: T.fontMono, fontSize: 11, color: T.fg3,
            }}>
              <CCY code="EUR" /> € 1.840
              <span style={{ color: T.fg5 }}>·</span>
              <CCY code="BRL" /> R$ 2.103,80
            </div>
          </Card>
          <Card style={{ padding: '16px 18px' }}>
            <Eyebrow>Sobra prevista · EUR</Eyebrow>
            <div style={{ marginTop: 6 }}>
              <Num cents={61240} sign size={32} weight={700} color={T.pos} style={{ letterSpacing: '-0.03em' }} />
            </div>
            <div style={{
              marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.borderSoft}`,
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
              fontFamily: T.fontMono, fontSize: 10.5,
            }}>
              <div><span style={{ color: T.fg4, textTransform: 'uppercase' }}>ent.</span><br/><Num cents={148000} sign size={12} weight={600} color={T.pos} /></div>
              <div><span style={{ color: T.fg4, textTransform: 'uppercase' }}>pend.</span><br/><Num cents={-77400} sign size={12} weight={600} color={T.fg2} /></div>
              <div><span style={{ color: T.fg4, textTransform: 'uppercase' }}>atra.</span><br/><Num cents={-9200} sign size={12} weight={600} color={T.neg} /></div>
            </div>
          </Card>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
          <Card style={{ padding: '12px 14px' }}>
            <Eyebrow color={T.paidFg}>● Pago</Eyebrow>
            <Num cents={145000} size={20} weight={700} color={T.fg1} style={{ display: 'block', marginTop: 3 }} />
          </Card>
          <Card style={{ padding: '12px 14px' }}>
            <Eyebrow color={T.pendFg}>● Pendente</Eyebrow>
            <Num cents={13760} size={20} weight={700} color={T.fg1} style={{ display: 'block', marginTop: 3 }} />
          </Card>
          <Card style={{ padding: '12px 14px' }}>
            <Eyebrow color={T.overFg}>● Atraso</Eyebrow>
            <Num cents={9200} size={20} weight={700} color={T.neg} style={{ display: 'block', marginTop: 3 }} />
          </Card>
        </section>

        <section style={{
          background: T.brandBg, border: `1px solid color-mix(in oklch, var(--brand) 30%, transparent)`,
          borderRadius: 6, padding: '12px 14px', marginBottom: 16,
        }}>
          <Eyebrow color={T.brandQF}>Sugestão</Eyebrow>
          <div style={{ marginTop: 4, fontSize: 13, color: T.fg1, lineHeight: 1.4 }}>
            Quitar <Num cents={36744} size={13} weight={600} color={T.fg1} /> da{' '}
            <span style={{ color: T.fg2 }}>Empréstimo Jefferson</span> (19,6%).{' '}
            <button style={{ marginLeft: 4, padding: 0, border: 0, background: 'transparent', color: T.brandQF, cursor: 'pointer', fontFamily: T.fontSans, fontSize: 13, fontWeight: 600 }}>
              Registrar →
            </button>
          </div>
        </section>

        {/* Two-column: categorias + próximos */}
        <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <h2 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600, color: T.fg1 }}>Top categorias</h2>
            <Card padded={false}>
              {[
                { I: Icon.Home, label: 'Moradia', cents: 80000, pct: 0.78 },
                { I: Icon.Food, label: 'Alimentação', cents: 32450, pct: 0.32 },
                { I: Icon.Pet,  label: 'Pet', cents: 9200, pct: 0.10 },
              ].map((c, i, arr) => (
                <React.Fragment key={i}>
                  <div style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: T.fg2, fontSize: 12, fontWeight: 500 }}>
                        <span style={{ color: T.fg3 }}><c.I size={12} /></span>{c.label}
                      </span>
                      <Num cents={c.cents} size={12} weight={600} color={T.fg2} />
                    </div>
                    <div style={{ height: 3, background: T.inset, borderRadius: 2 }}>
                      <div style={{ width: `${c.pct*100}%`, height: '100%', background: T.brand, borderRadius: 2 }} />
                    </div>
                  </div>
                  {i < arr.length - 1 && <div style={{ height: 1, background: T.borderSoft }} />}
                </React.Fragment>
              ))}
            </Card>
          </div>
          <div>
            <h2 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600, color: T.fg1 }}>Próximos 7 dias</h2>
            <Card padded={false}>
              {[
                { date: '01 jun', desc: 'Aluguel', cents: -80000 },
                { date: '03 jun', desc: 'NOS internet', cents: -4400 },
                { date: '05 jun', desc: 'Notebook · parcela', cents: -8759 },
              ].map((u, i, arr) => (
                <React.Fragment key={i}>
                  <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr auto', gap: 10, alignItems: 'center', padding: '10px 12px' }}>
                    <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.fg3, fontWeight: 600 }}>{u.date}</span>
                    <span style={{ fontSize: 13, color: T.fg1, fontWeight: 500 }}>{u.desc}</span>
                    <Num cents={u.cents} size={12} weight={600} color={T.fg2} />
                  </div>
                  {i < arr.length - 1 && <div style={{ height: 1, background: T.borderSoft }} />}
                </React.Fragment>
              ))}
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
}

// ============================================================================
// Advanced toast variants — progress bar / custom icon / undo flow
// ============================================================================
function DesktopToastProgress({ kind, title, body, duration = 4 }) {
  const map = {
    success: { fg: T.paidFg, bg: T.paidBg, icon: <Icon.Check size={14} sw={2.2} /> },
    error:   { fg: T.overFg, bg: T.overBg, icon: <Icon.Alert size={14} sw={1.8} /> },
    info:    { fg: T.brandQF, bg: T.brandBg, icon: <Icon.Refresh size={14} sw={1.8} /> },
  };
  const c = map[kind];
  return (
    <div style={{
      padding: '12px 14px 0',
      background: T.raised,
      border: `1px solid color-mix(in oklch, ${c.fg} 28%, transparent)`,
      borderRadius: 8,
      boxShadow: '0 12px 32px -8px oklch(0% 0 0 / 0.5)',
      overflow: 'hidden',
      animation: 'cfToastIn 280ms cubic-bezier(0.2, 0, 0, 1)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
        <span style={{
          width: 26, height: 26, borderRadius: 6,
          background: c.bg, color: c.fg, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{c.icon}</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 0 }}>
          <span style={{ fontFamily: T.fontSans, fontSize: 13, fontWeight: 600, color: T.fg1, letterSpacing: '-0.005em' }}>
            {title}
          </span>
          {body && <span style={{ fontFamily: T.fontSans, fontSize: 12, color: T.fg3, lineHeight: 1.4 }}>{body}</span>}
        </div>
        <span style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.fg4, alignSelf: 'flex-start', marginTop: 4 }}>
          {duration}s
        </span>
      </div>
      <div style={{
        height: 2, background: T.inset, marginLeft: -14, marginRight: -14,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: c.fg,
          transformOrigin: 'left',
          animation: `cfToastProgress ${duration}s linear forwards`,
        }} />
      </div>
    </div>
  );
}

function DesktopToastCustom({ icon, iconKind = 'brand', title, body, indeterminate }) {
  const tints = {
    brand:    { fg: T.brandQF, bg: T.brandBg },
    eur:      { fg: 'var(--brass-300)', bg: T.brandBg },
    brl:      { fg: 'var(--sage-300)', bg: T.posBg },
    danger:   { fg: T.overFg, bg: T.overBg },
  };
  const c = tints[iconKind] || tints.brand;
  return (
    <div style={{
      padding: '12px 14px',
      background: T.raised,
      border: `1px solid color-mix(in oklch, ${c.fg} 24%, transparent)`,
      borderRadius: 8,
      boxShadow: '0 12px 32px -8px oklch(0% 0 0 / 0.5)',
      display: 'flex', alignItems: 'flex-start', gap: 10,
      animation: 'cfToastIn 280ms cubic-bezier(0.2, 0, 0, 1)',
      overflow: 'hidden',
      position: 'relative',
    }}>
      <span style={{
        width: 26, height: 26, borderRadius: 6,
        background: c.bg, color: c.fg, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{icon}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 0 }}>
        <span style={{ fontFamily: T.fontSans, fontSize: 13, fontWeight: 600, color: T.fg1, letterSpacing: '-0.005em' }}>
          {title}
        </span>
        {body && <span style={{ fontFamily: T.fontSans, fontSize: 12, color: T.fg3, lineHeight: 1.4 }}>{body}</span>}
      </div>
      {indeterminate && (
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          height: 2, background: T.inset, overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: 0, bottom: 0, width: '40%',
            background: c.fg,
            animation: 'cfToastIndeterminate 1.4s cubic-bezier(0.65, 0, 0.35, 1) infinite',
          }} />
        </div>
      )}
    </div>
  );
}

function DesktopToastUndo({ title, body, remaining = 3 }) {
  return (
    <div style={{
      padding: '12px 14px 0',
      background: T.raised,
      border: `1px solid color-mix(in oklch, var(--money-negative) 28%, transparent)`,
      borderRadius: 8,
      boxShadow: '0 12px 32px -8px oklch(0% 0 0 / 0.5)',
      overflow: 'hidden',
      animation: 'cfToastIn 280ms cubic-bezier(0.2, 0, 0, 1)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
        <span style={{
          width: 26, height: 26, borderRadius: 6,
          background: T.overBg, color: T.overFg, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M8 6v14a2 2 0 002 2h4a2 2 0 002-2V6M10 11v6M14 11v6M9 6V4a2 2 0 012-2h2a2 2 0 012 2v2"/>
          </svg>
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 0 }}>
          <span style={{ fontFamily: T.fontSans, fontSize: 13, fontWeight: 600, color: T.fg1, letterSpacing: '-0.005em' }}>
            {title}
          </span>
          {body && <span style={{ fontFamily: T.fontSans, fontSize: 12, color: T.fg3, lineHeight: 1.4 }}>{body}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{
            fontFamily: T.fontMono, fontSize: 11, color: T.fg4,
            padding: '2px 6px', background: T.inset, borderRadius: 4,
            letterSpacing: '0.02em',
          }}>{remaining}s</span>
          <button style={{
            padding: '5px 12px', borderRadius: 6,
            background: T.brand, color: T.brandFg, border: 0,
            fontFamily: T.fontSans, fontSize: 12, fontWeight: 600,
            cursor: 'pointer', letterSpacing: '0.01em',
          }}>Desfazer</button>
        </div>
      </div>
      <div style={{
        height: 2, background: T.inset, marginLeft: -14, marginRight: -14,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: T.overFg,
          transformOrigin: 'left',
          animation: `cfToastProgress ${remaining}s linear forwards`,
        }} />
      </div>
    </div>
  );
}

Object.assign(window, { DesktopStatesDemo, DesktopModalsDemo, DesktopToastsDemo, TabletApp });
