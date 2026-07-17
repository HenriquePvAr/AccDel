import { Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '@/lib/auth-context'
import { trackMetric } from '@/lib/metrics'

export function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/" replace />

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setBusy(true)
    const startedAt = performance.now()
    try {
      await login(email, password)
      trackMetric('login_success', performance.now() - startedAt)
      const destination = (location.state as { from?: string } | null)?.from ?? '/'
      navigate(destination, { replace: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível entrar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="login-title">
        <div className="brand-lockup login-brand">
          <span className="brand-mark" aria-hidden="true">ϟ</span>
          <span><strong>Cain</strong><small>Garçom</small></span>
        </div>
        <div className="login-copy">
          <span className="eyebrow">Seu salão, no ritmo certo</span>
          <h1 id="login-title">Bom atendimento começa aqui.</h1>
          <p>Entre com seu acesso de garçom ou gerente para acompanhar mesas, cozinha e entregas.</p>
        </div>
        <form onSubmit={submit} noValidate>
          <div className="form-field">
            <label className="field-label" htmlFor="waiter-email">E-mail</label>
            <span className="input-with-icon"><Mail size={19} /><input id="waiter-email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></span>
          </div>
          <div className="form-field">
            <label className="field-label" htmlFor="waiter-password">Senha</label>
            <span className="input-with-icon"><LockKeyhole size={19} /><input id="waiter-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required /><button className="password-toggle" type="button" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></span>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button primary login-submit" disabled={busy || !email || password.length < 8} type="submit">{busy ? 'Entrando…' : 'Entrar no salão'}</button>
        </form>
        <p className="login-security">A senha nunca é armazenada neste dispositivo.</p>
      </section>
      <aside className="login-visual" aria-hidden="true">
        <div className="visual-card visual-card-main"><span>Mesa 12</span><strong>3 itens prontos</strong><small>Agora mesmo</small></div>
        <div className="visual-card visual-card-secondary"><span>Cozinha</span><strong>Pedido #1042</strong><small>Em preparo · 8 min</small></div>
      </aside>
    </main>
  )
}
