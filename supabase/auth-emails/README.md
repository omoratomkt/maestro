# Emails do Auth (Supabase) em português

Textos prontos para colar em **Authentication → Emails → Templates** no painel do Supabase.
Para cada modelo: copie o **Assunto** na caixa "Subject heading" e o conteúdo do arquivo `.html` na caixa "Message body".

| Modelo no painel | Assunto | Arquivo |
|---|---|---|
| Invite user | Você foi convidado para o Maestro | `convite.html` |
| Reset password | Redefinir sua senha do Maestro | `recuperar-senha.html` |
| Change email address | Confirme a alteração do seu email no Maestro | `alterar-email.html` |
| Magic link (não usado: o Maestro entra com email e senha) | Seu link de acesso ao Maestro | `magic-link.html` |
| Confirm sign up (não usado: o cadastro público está desligado) | Confirme seu cadastro no Maestro | `confirmar-cadastro.html` |
| Reauthentication | Código de confirmação do Maestro | `reautenticacao.html` |

Os dois que importam de verdade são **Invite user** (convite) e **Reset password** (recuperar senha).
Os outros ficam traduzidos só para não aparecer inglês caso algum dia sejam acionados.

## Prazo dos links

Os links expiram em 1 hora por padrão. Para convites isso é pouco (a pessoa pode abrir no dia seguinte). Em
Authentication → Sign In / Providers → Email, aumente **Email OTP Expiration** para `86400` (24 horas, o máximo).

## Variáveis usadas

`{{ .ConfirmationURL }}` (link), `{{ .Email }}`, `{{ .NewEmail }}` e `{{ .Token }}` são preenchidas pelo Supabase.
