import { Sparkles } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

/** Destino dos links de convite e de recuperação de senha: o Supabase já abre a sessão pelo link. */
export default function SetPassword() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (password.length < 8) return toast.error('A senha precisa ter pelo menos 8 caracteres.')
    if (password !== confirm) return toast.error('As senhas não conferem.')
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success('Senha definida.')
    navigate('/', { replace: true })
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="mb-2 flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Sparkles className="size-4" />
          </div>
          <CardTitle>Definir senha</CardTitle>
          <CardDescription>{session ? 'Escolha uma senha para acessar o Maestro.' : 'Validando o link…'}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? null : session ? (
            <form onSubmit={onSubmit} className="space-y-3">
              <Input type="password" autoComplete="new-password" placeholder="Nova senha (mín. 8 caracteres)" required value={password} onChange={(e) => setPassword(e.target.value)} />
              <Input type="password" autoComplete="new-password" placeholder="Repita a senha" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? 'Salvando…' : 'Salvar senha'}
              </Button>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">
              O link é inválido ou expirou. <Link to="/login" className="underline">Voltar ao login</Link> e pedir um novo.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
