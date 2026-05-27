# Política de segurança

Este é um projeto pessoal, não-comercial, com 2 usuários conhecidos via allowlist server-only. Não há programa de bug bounty, SLA, ou compromisso público de resposta.

## Reportar vulnerabilidade

Se você encontrar uma vulnerabilidade que afete a segurança dos dados, abra um [private security advisory](https://github.com/tiagodev96/controle-financeiro/security/advisories/new) no GitHub em vez de uma issue pública. Inclua:

- passos pra reproduzir,
- impacto observado,
- versão / commit afetado.

Tempo de resposta: best-effort. Sem garantia de janela.

## Escopo

Aspectos relevantes pra hardening (RLS, rotação de chaves, allowlist, Auth Hook) estão documentados em [`docs/security-notes.md`](docs/security-notes.md). Esse arquivo é o checklist canônico antes de qualquer fork virar uso real.

## Fora de escopo

- Vulnerabilidades em dependências (rastreadas via `npm audit` e atualizações manuais).
- Issues que dependem de comprometimento prévio da conta Supabase do owner (allowlist e RLS pressupõem que a conta admin do banco está segura).
- Configurações de deploy específicas de Vercel — reportar diretamente à Vercel quando aplicável.
