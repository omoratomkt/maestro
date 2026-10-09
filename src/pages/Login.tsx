import { Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export default function Login() {
  const { session, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && session) return <Navigate to="/" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) setError('Email ou senha inválidos.')
    setSubmitting(false)
  }

  async function forgot() {
    if (!email) return toast.error('Digite seu email acima para receber o link.')
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/definir-senha` })
    // Resposta igual para email existente ou não: não revela quem tem conta.
    if (err && err.status !== 400) toast.error('Não foi possível enviar o email agora. Tente novamente.')
    else toast.success('Se o email existir, o link para redefinir a senha já está a caminho.')
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="mb-2 flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Sparkles className="size-4" />
          </div>
          <CardTitle>Maestro</CardTitle>
          <CardDescription>Entre com sua conta para acessar o painel.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-3">
            <Input
              type="email"
              placeholder="Email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              type="password"
              placeholder="Senha"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Entrando…' : 'Entrar'}
            </Button>
            <button type="button" onClick={forgot} className="w-full text-center text-xs text-muted-foreground underline">
              Esqueci minha senha
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
