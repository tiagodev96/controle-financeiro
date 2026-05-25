/* global React, Icon, T, Num, HeroNumber, Eyebrow, StatusPill, Btn, Card, CCY, fmt */
// ============================================================================
// Controle Financeiro — Extras: Onboarding, Sheets, Install banner
// ============================================================================

const useStateE = React.useState;

// ─── Sheet primitive — bottom-anchored modal over a base screen ──────────
function Sheet({ title, children, height = '78%' }) {
  return (
    <React.Fragment>
      {/* Scrim */}
      <div style={{
        position: 'absolute', inset: 0, background: 'oklch(0% 0 0 / 0.55)',
        backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)',
        zIndex: 30,
      }} />
      {/* Sheet */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 31,
        height,
        background: T.bg,
        borderTop: `1px solid ${T.border}`,
        borderRadius: '14px 14px 0 0',
        boxShadow: '0 -24px 48px -8px oklch(0% 0 0 / 0.5)',
        display: 'flex', flexDirection: 'column',
        animation: 'cfSheetIn 280ms cubic-bezier(0.2, 0, 0, 1)',
      }}>
        {/* Grabber */}
        <div style={{
          padding: '8px 0 6px', display: 'flex', justifyContent: 'center',
        }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: T.fg5 }} />
        </div>
        {/* Title */}
        <div style={{
          padding: '4px 20px 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: `1px solid ${T.borderSoft}`,
        }}>
          <h2 style={{ margin: 0, fontFamily: T.fontSans, fontSize: 18, fontWeight: 600, color: T.fg1, letterSpacing: '-0.02em' }}>{title}</h2>
          <button style={{
            background: T.inset, border: `1px solid ${T.borderSoft}`,
            width: 30, height: 30, borderRadius: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: T.fg2, cursor: 'pointer',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>{children}</div>
      </div>
    </React.Fragment>
  );
}

// ─── Field wrapper ────────────────────────────────────────────────────────
function FormField({ label, hint, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
      <span style={{
        fontFamily: T.fontSans, fontSize: 11, fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.08em', color: T.fg3,
      }}>{label}</span>
      {children}
      {hint && <span style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.fg4 }}>{hint}</span>}
    </div>
  );
}

function TextInput({ value, placeholder, autoFocus, mono }) {
  return (
    <input value={value} placeholder={placeholder} autoFocus={autoFocus}
      readOnly
      style={{
        background: T.inset, border: `1px solid ${T.border}`,
        borderRadius: 6, padding: '11px 14px', height: 44, boxSizing: 'border-box',
        fontFamily: mono ? T.fontMono : T.fontSans,
        fontSize: 15, color: T.fg1, outline: 'none', width: '100%',
      }} />
  );
}

function ChipSelect({ options, value }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {options.map((o) => {
        const a = o.value === value;
        return (
          <button key={o.value} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            height: 36, padding: '0 14px', borderRadius: 9999,
            background: a ? T.brandBg : T.inset,
            color: a ? T.brandQF : T.fg2,
            border: `1px solid ${a ? 'color-mix(in oklch, var(--brand) 40%, transparent)' : T.borderSoft}`,
            fontFamily: T.fontSans, fontSize: 13, fontWeight: a ? 600 : 500,
            cursor: 'pointer',
          }}>
            {o.icon && <o.icon size={13} sw={a ? 1.9 : 1.6} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// SHEET: Nova categoria
// ============================================================================
function NovaCategoriaSheet() {
  const iconGrid = [
    { key: 'home', I: Icon.Home, on: true },
    { key: 'food', I: Icon.Food },
    { key: 'pet',  I: Icon.Pet },
    { key: 'heal', I: Icon.Health },
    { key: 'car',  I: Icon.Car },
    { key: 'fun',  I: Icon.Fun },
    { key: 'cal',  I: Icon.Cal },
    { key: 'card', I: Icon.Card },
    { key: 'more', I: Icon.More },
    { key: 'set',  I: Icon.Settings },
    { key: 'ref',  I: Icon.Refresh },
    { key: 'plus', I: Icon.Plus },
  ];
  return (
    <Sheet title="Nova categoria" height="80%">
      <div style={{ padding: '14px 20px 20px' }}>
        <FormField label="Nome">
          <TextInput value="Pet" autoFocus />
        </FormField>
        <FormField label="Tipo">
          <ChipSelect value="expense" options={[
            { value: 'expense', label: 'Despesa', icon: Icon.ArrowDown },
            { value: 'income',  label: 'Entrada', icon: Icon.ArrowUp },
          ]}/>
        </FormField>
        <FormField label="Ícone" hint="Lucide · stroke 1.6">
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6,
            padding: 8, background: T.inset, border: `1px solid ${T.borderSoft}`, borderRadius: 6,
          }}>
            {iconGrid.map(({ key, I, on }) => (
              <button key={key} style={{
                aspectRatio: '1', borderRadius: 6, cursor: 'pointer',
                background: on ? T.brandBg : 'transparent',
                color: on ? T.brandQF : T.fg2,
                border: `1px solid ${on ? 'color-mix(in oklch, var(--brand) 35%, transparent)' : 'transparent'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <I size={18} sw={on ? 1.9 : 1.6} />
              </button>
            ))}
          </div>
        </FormField>
      </div>
      <div style={{
        padding: '14px 20px 28px', display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8,
        borderTop: `1px solid ${T.borderSoft}`, background: T.bg,
      }}>
        <Btn size="lg" variant="secondary">Cancelar</Btn>
        <Btn size="lg" variant="primary" leading={<Icon.Check size={16} />}>Criar categoria</Btn>
      </div>
    </Sheet>
  );
}

// ============================================================================
// SHEET: Nova dívida
// ============================================================================
function NovaDividaSheet() {
  return (
    <Sheet title="Nova dívida" height="88%">
      <div style={{ padding: '14px 20px 20px' }}>
        <FormField label="Nome">
          <TextInput value="Empréstimo Jefferson" autoFocus />
        </FormField>

        <FormField label="Valor original" hint="o quanto você deve no total">
          <div style={{
            padding: '12px 14px',
            background: T.inset, border: `1px solid ${T.brand}`,
            borderRadius: 8,
            boxShadow: `0 0 0 3px oklch(73% 0.135 80 / 0.18)`,
            display: 'flex', alignItems: 'baseline', gap: 8,
          }}>
            <span style={{
              fontFamily: T.fontSans, fontWeight: 500,
              fontSize: 22, color: T.fg3, letterSpacing: '-0.01em',
            }}>€</span>
            <span style={{
              fontFamily: T.fontNum, fontVariantNumeric: 'tabular-nums',
              fontWeight: 700, fontSize: 32, color: T.fg1, letterSpacing: '-0.03em',
            }}>3.000,00</span>
          </div>
        </FormField>

        <FormField label="Moeda">
          <ChipSelect value="EUR" options={[
            { value: 'EUR', label: 'EUR' },
            { value: 'BRL', label: 'BRL' },
          ]}/>
        </FormField>

        <FormField label="Prioridade">
          <ChipSelect value="alta" options={[
            { value: 'alta', label: 'Alta' },
            { value: 'media', label: 'Média' },
            { value: 'baixa', label: 'Baixa' },
          ]}/>
        </FormField>

        <FormField label="Notas" hint="opcional · 0/200">
          <TextInput value="" placeholder="Ex: pagar 60%+ se sobrar este mês" />
        </FormField>

        <div style={{
          marginTop: 4, padding: '10px 14px',
          background: T.surface, border: `1px solid ${T.borderSoft}`, borderRadius: 6,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontFamily: T.fontSans, fontSize: 13, fontWeight: 500, color: T.fg1 }}>Avançado</span>
            <span style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.fg4 }}>parcelas-alvo · data-alvo</span>
          </div>
          <Icon.Chevron size={14} style={{ color: T.fg4 }} />
        </div>
      </div>

      <div style={{
        padding: '14px 20px 28px', display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8,
        borderTop: `1px solid ${T.borderSoft}`, background: T.bg,
      }}>
        <Btn size="lg" variant="secondary">Cancelar</Btn>
        <Btn size="lg" variant="primary">Criar dívida</Btn>
      </div>
    </Sheet>
  );
}

// ============================================================================
// SHEET: Registrar pagamento (against a debt)
// ============================================================================
function RegistrarPagamentoSheet() {
  return (
    <Sheet title="Registrar pagamento" height="74%">
      <div style={{ padding: '14px 20px 8px' }}>
        <div style={{
          padding: '10px 12px', background: T.surface,
          border: `1px solid ${T.borderSoft}`, borderRadius: 6,
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          <span style={{ fontFamily: T.fontSans, fontSize: 14, fontWeight: 600, color: T.fg1 }}>
            Empréstimo Jefferson
          </span>
          <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.fg3 }}>
            resta <span style={{ color: T.fg1, fontWeight: 600 }}>€ 1.875,00</span> · prioridade alta
          </span>
        </div>
      </div>

      <div style={{ padding: '12px 20px 8px' }}>
        <FormField label="Valor">
          <div style={{
            padding: '12px 14px',
            background: T.inset, border: `1px solid ${T.brand}`,
            borderRadius: 8,
            boxShadow: `0 0 0 3px oklch(73% 0.135 80 / 0.18)`,
            display: 'flex', alignItems: 'baseline', gap: 8,
          }}>
            <span style={{
              fontFamily: T.fontSans, fontWeight: 500,
              fontSize: 22, color: T.fg3, letterSpacing: '-0.01em',
            }}>€</span>
            <span style={{
              fontFamily: T.fontNum, fontVariantNumeric: 'tabular-nums',
              fontWeight: 700, fontSize: 32, color: T.fg1, letterSpacing: '-0.03em',
            }}>367,44</span>
            <span style={{ marginLeft: 'auto', fontFamily: T.fontMono, fontSize: 11, color: T.brandQF }}>
              19,6%
            </span>
          </div>
        </FormField>

        <FormField label="Conta de origem">
          <div style={{
            background: T.inset, border: `1px solid ${T.border}`, borderRadius: 6,
            padding: '11px 14px', height: 44, boxSizing: 'border-box',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CCY code="EUR" />
              <span style={{ fontSize: 14, color: T.fg1, fontWeight: 500 }}>Revolut · principal</span>
            </div>
            <Icon.Chevron size={14} style={{ color: T.fg4 }} />
          </div>
        </FormField>

        <FormField label="Data">
          <div style={{
            background: T.inset, border: `1px solid ${T.border}`, borderRadius: 6,
            padding: '11px 14px', height: 44, boxSizing: 'border-box',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <Icon.Cal size={14} style={{ color: T.fg3 }} />
            <span style={{ fontSize: 14, color: T.fg1, fontWeight: 500 }}>25 mai 2026</span>
          </div>
        </FormField>

        <label style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 14px', background: T.surface,
          border: `1px solid ${T.borderSoft}`, borderRadius: 6, cursor: 'pointer',
          marginTop: 6,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontFamily: T.fontSans, fontSize: 13, fontWeight: 500, color: T.fg1 }}>
              Deduzir do saldo
            </span>
            <span style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.fg4 }}>
              ajusta Revolut · principal automaticamente
            </span>
          </div>
          <div style={{
            width: 36, height: 22, borderRadius: 12, background: T.brand,
            border: `1px solid ${T.brand}`, position: 'relative',
          }}>
            <div style={{
              position: 'absolute', top: 2, left: 16,
              width: 16, height: 16, borderRadius: '50%', background: T.brandFg,
            }} />
          </div>
        </label>
      </div>

      <div style={{
        padding: '14px 20px 28px', display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8,
        borderTop: `1px solid ${T.borderSoft}`, background: T.bg,
      }}>
        <Btn size="lg" variant="secondary">Cancelar</Btn>
        <Btn size="lg" variant="primary" leading={<Icon.Check size={16} />}>Confirmar pagamento</Btn>
      </div>
    </Sheet>
  );
}

// ============================================================================
// ONBOARDING — Login (magic link)
// ============================================================================
function OnboardingLoginScreen() {
  return (
    <div style={{
      padding: '60px 28px 28px',
      display: 'flex', flexDirection: 'column', gap: 24,
      height: '100%', boxSizing: 'border-box',
    }}>
      {/* Logo / wordmark */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <svg width="32" height="32" viewBox="0 0 64 64" fill="none">
          <rect x="6" y="8" width="52" height="48" rx="3" stroke="var(--fg2)" strokeWidth="1.5"/>
          <line x1="14" y1="22" x2="50" y2="22" stroke="var(--border-strong)" strokeWidth="1"/>
          <line x1="14" y1="30" x2="42" y2="30" stroke="var(--border-strong)" strokeWidth="1"/>
          <line x1="14" y1="38" x2="46" y2="38" stroke="var(--border-strong)" strokeWidth="1"/>
          <line x1="14" y1="46" x2="36" y2="46" stroke="var(--border-strong)" strokeWidth="1"/>
          <rect x="42" y="42" width="10" height="2" fill="var(--brand)"/>
        </svg>
        <span style={{
          fontFamily: T.fontSans, fontSize: 18, fontWeight: 700,
          color: T.fg1, letterSpacing: '-0.03em',
        }}>controle<span style={{ color: T.fg4, fontWeight: 400, margin: '0 2px' }}>·</span>cf<span style={{ display: 'inline-block', width: 4, height: 4, borderRadius: '50%', background: T.brand, marginLeft: 4, transform: 'translateY(-1px)' }} /></span>
      </div>

      <div style={{ marginTop: 28 }}>
        <h1 style={{ margin: 0, fontFamily: T.fontSans, fontSize: 26, fontWeight: 600, color: T.fg1, letterSpacing: '-0.025em' }}>
          Entrar
        </h1>
        <p style={{ margin: '6px 0 0', color: T.fg3, fontSize: 14, lineHeight: 1.45 }}>
          Te enviamos um link mágico por email. Sem senha, sem fricção.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
        <FormField label="Email">
          <TextInput value="tiago@email.pt" mono />
        </FormField>

        <Btn size="lg" variant="primary" style={{ width: '100%' }}>
          Enviar link
        </Btn>
      </div>

      <div style={{ flex: 1 }} />

      <div style={{
        padding: '12px 14px', background: T.surface,
        border: `1px solid ${T.borderSoft}`, borderRadius: 6,
        display: 'flex', alignItems: 'flex-start', gap: 10,
      }}>
        <Icon.Alert size={16} style={{ color: T.fg3, marginTop: 2, flexShrink: 0 }} />
        <span style={{ fontFamily: T.fontSans, fontSize: 12.5, color: T.fg3, lineHeight: 1.45 }}>
          Apenas <b style={{ color: T.fg2 }}>Tiago</b> e <b style={{ color: T.fg2 }}>Laine</b> têm acesso a este household — allowlist do env. Outros emails não recebem link válido.
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// ONBOARDING — Primeira conta
// ============================================================================
function OnboardingFirstAccountScreen() {
  return (
    <div style={{
      padding: '50px 28px 28px',
      display: 'flex', flexDirection: 'column', gap: 18,
      height: '100%', boxSizing: 'border-box',
    }}>
      {/* Step indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.fg4, letterSpacing: '0.02em' }}>
          1 de 2
        </span>
        <div style={{ flex: 1, height: 3, borderRadius: 2, background: T.inset, overflow: 'hidden' }}>
          <div style={{ width: '50%', height: '100%', background: T.brand }} />
        </div>
      </div>

      <div>
        <h1 style={{ margin: 0, fontFamily: T.fontSans, fontSize: 24, fontWeight: 600, color: T.fg1, letterSpacing: '-0.025em' }}>
          Crie sua primeira conta
        </h1>
        <p style={{ margin: '6px 0 0', color: T.fg3, fontSize: 14, lineHeight: 1.45 }}>
          O saldo é digitado por você — não derivamos de transações. Você confia no input manual.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
        <FormField label="Nome da conta">
          <TextInput value="Revolut · principal" />
        </FormField>

        <FormField label="Moeda">
          <ChipSelect value="EUR" options={[
            { value: 'EUR', label: 'EUR · Euro' },
            { value: 'BRL', label: 'BRL · Real' },
          ]}/>
        </FormField>

        <FormField label="Saldo atual" hint="quanto tem agora? você pode ajustar depois">
          <div style={{
            padding: '12px 14px',
            background: T.inset, border: `1px solid ${T.brand}`,
            borderRadius: 8,
            boxShadow: `0 0 0 3px oklch(73% 0.135 80 / 0.18)`,
            display: 'flex', alignItems: 'baseline', gap: 8,
          }}>
            <span style={{
              fontFamily: T.fontSans, fontWeight: 500,
              fontSize: 22, color: T.fg3, letterSpacing: '-0.01em',
            }}>€</span>
            <span style={{
              fontFamily: T.fontNum, fontVariantNumeric: 'tabular-nums',
              fontWeight: 700, fontSize: 32, color: T.fg1, letterSpacing: '-0.03em',
            }}>1.240,00</span>
          </div>
        </FormField>
      </div>

      <div style={{ flex: 1 }} />

      <Btn size="lg" variant="primary" style={{ width: '100%' }}>
        Continuar
      </Btn>
    </div>
  );
}

// ============================================================================
// ONBOARDING — Pronto (com PWA install banner)
// ============================================================================
function OnboardingReadyScreen() {
  return (
    <div style={{
      padding: '60px 28px 28px',
      display: 'flex', flexDirection: 'column', gap: 20,
      height: '100%', boxSizing: 'border-box',
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 9999,
        background: T.posBg, color: T.pos,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: `1px solid color-mix(in oklch, var(--money-positive) 30%, transparent)`,
      }}>
        <Icon.Check size={26} sw={2} />
      </div>

      <div>
        <h1 style={{ margin: 0, fontFamily: T.fontSans, fontSize: 26, fontWeight: 600, color: T.fg1, letterSpacing: '-0.025em' }}>
          Tudo pronto, Tiago.
        </h1>
        <p style={{ margin: '6px 0 0', color: T.fg3, fontSize: 14, lineHeight: 1.45 }}>
          Sua conta está criada. Lance a primeira despesa ou explore o dashboard.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
        <Btn size="lg" variant="primary" style={{ width: '100%' }} leading={<Icon.Plus size={16} />}>
          Lançar primeira despesa
        </Btn>
        <Btn size="lg" variant="secondary" style={{ width: '100%' }}>
          Ir pro dashboard
        </Btn>
      </div>

      <InstallBanner />

      <div style={{ flex: 1 }} />

      <span style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.fg4, textAlign: 'center' }}>
        Logado como tiago@email.pt
      </span>
    </div>
  );
}

// ─── PWA install banner ──────────────────────────────────────────────────
function InstallBanner() {
  return (
    <div style={{
      padding: '14px 14px',
      background: T.brandBg,
      border: `1px solid color-mix(in oklch, var(--brand) 30%, transparent)`,
      borderRadius: 8,
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 7,
          background: T.brand, color: T.brandFg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="18" height="18" viewBox="0 0 64 64" fill="none">
            <rect x="6" y="8" width="52" height="48" rx="3" stroke="currentColor" strokeWidth="2"/>
            <line x1="14" y1="22" x2="50" y2="22" stroke="currentColor" strokeWidth="1.5"/>
            <line x1="14" y1="30" x2="42" y2="30" stroke="currentColor" strokeWidth="1.5"/>
            <line x1="14" y1="38" x2="46" y2="38" stroke="currentColor" strokeWidth="1.5"/>
            <line x1="14" y1="46" x2="36" y2="46" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontFamily: T.fontSans, fontSize: 14, fontWeight: 600, color: T.fg1 }}>
            Instalar na tela inicial
          </span>
          <span style={{ fontFamily: T.fontSans, fontSize: 12, color: T.fg3 }}>
            Use como app nativo, abre sem barra do browser.
          </span>
        </div>
      </div>
      <ol style={{
        margin: 0, paddingLeft: 22,
        display: 'flex', flexDirection: 'column', gap: 4,
        fontFamily: T.fontSans, fontSize: 12, color: T.fg2, lineHeight: 1.4,
      }}>
        <li>Toque no botão <b>Compartilhar</b></li>
        <li>Role e escolha <b>Adicionar à Tela de Início</b></li>
        <li>Confirme em <b>Adicionar</b></li>
      </ol>
    </div>
  );
}

// ============================================================================
// MOTION DEMO — pulse / press / fade-in
// ============================================================================
function MotionDemoScreen() {
  const [count, setCount] = useStateE(0);
  const [pulseKey, setPulseKey] = useStateE(0);

  return (
    <div style={{ paddingBottom: 100, animation: 'cfFadeUp 320ms cubic-bezier(0.2, 0, 0, 1)' }}>
      <AppTopBar
        eyebrow="Motion"
        title="Animações"
      />

      <section style={{ padding: '8px 20px 14px' }}>
        <p style={{ margin: 0, fontFamily: T.fontSans, fontSize: 13, color: T.fg3, lineHeight: 1.45 }}>
          150–280ms, ease-out cubic-bezier(0.2, 0, 0, 1). Sem bounces. Sem celebração performativa.
        </p>
      </section>

      <section style={{ padding: '0 20px 14px' }}>
        <Eyebrow style={{ display: 'block', marginBottom: 6 }}>Pulse · número atualizado</Eyebrow>
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span key={pulseKey} className="cf-pulse" style={{ display: 'inline-block' }}>
              <Num cents={218314 + count * 14255} sign size={32} weight={700} color={T.fg1} />
            </span>
            <Btn size="sm" variant="secondary" onClick={() => { setCount(count + 1); setPulseKey(pulseKey + 1); }}>
              Lançar +€ 142,55
            </Btn>
          </div>
        </Card>
      </section>

      <section style={{ padding: '0 20px 14px' }}>
        <Eyebrow style={{ display: 'block', marginBottom: 6 }}>Press · scale 0.97 + 80ms</Eyebrow>
        <Card>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="cf-press" style={{
              padding: '8px 16px', borderRadius: 6, background: T.brand, color: T.brandFg,
              border: 0, fontFamily: T.fontSans, fontWeight: 600, fontSize: 14, cursor: 'pointer',
            }}>Pressione</button>
            <button className="cf-press" style={{
              padding: '8px 16px', borderRadius: 6, background: T.inset, color: T.fg1,
              border: `1px solid ${T.border}`, fontFamily: T.fontSans, fontWeight: 600, fontSize: 14, cursor: 'pointer',
            }}>Cancelar</button>
          </div>
        </Card>
      </section>

      <section style={{ padding: '0 20px 14px' }}>
        <Eyebrow style={{ display: 'block', marginBottom: 6 }}>Fade-up · entrada da tela</Eyebrow>
        <Card>
          <div style={{ fontFamily: T.fontSans, fontSize: 13, color: T.fg3, lineHeight: 1.45 }}>
            Toda a tela tem fade-up 320ms na entrada — 8px translateY, 0→1 opacity. Subtle, não distrai.
          </div>
        </Card>
      </section>

      <section style={{ padding: '0 20px 14px' }}>
        <Eyebrow style={{ display: 'block', marginBottom: 6 }}>Sheet · slide-up 280ms</Eyebrow>
        <Card>
          <div style={{ fontFamily: T.fontSans, fontSize: 13, color: T.fg3, lineHeight: 1.45 }}>
            Bottom sheets sobem com ease-out 280ms. Sem overshoot.
          </div>
        </Card>
      </section>
    </div>
  );
}

Object.assign(window, {
  Sheet, InstallBanner,
  NovaCategoriaSheet, NovaDividaSheet, RegistrarPagamentoSheet,
  OnboardingLoginScreen, OnboardingFirstAccountScreen, OnboardingReadyScreen,
  MotionDemoScreen,
});
