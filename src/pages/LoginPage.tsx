import { type FormEvent, useMemo, useState } from 'react'
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Fingerprint,
  Lock,
  LockKeyhole,
  Mail,
  UserRound,
  Zap,
} from 'lucide-react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'

import { getFirstAuthorizedPath } from '@/app/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLoginMutation } from '@/hooks/queries'
import { usePageTitle } from '@/hooks/use-page-title'
import { useToast } from '@/hooks/use-toast'
import { roleLabelMap } from '@/lib/domain'
import { cn } from '@/lib/utils'
import { ApiClientError } from '@/services/http/api-client'
import { useAuthStore } from '@/stores/auth-store'
import type { UserRole } from '@/types'

const demoAccounts: Array<{ email: string; role: UserRole }> = [
  { email: 'owner@cain.local', role: 'owner' },
  { email: 'manager@cain.local', role: 'manager' },
  { email: 'cashier@cain.local', role: 'cashier' },
  { email: 'kitchen@cain.local', role: 'kitchen' },
  { email: 'waiter@cain.local', role: 'waiter' },
  { email: 'driver@cain.local', role: 'driver' },
]

const loginBrandPanelSrc = '/auth/login-brand-panel.png'

export function LoginPage() {
  usePageTitle('Login')
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const status = useAuthStore((state) => state.status)
  const setSession = useAuthStore((state) => state.setSession)
  const loginMutation = useLoginMutation()
  const [email, setEmail] = useState('owner@cain.local')
  const [password, setPassword] = useState('Demo@123456')
  const [rememberDevice, setRememberDevice] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [showAccountPicker, setShowAccountPicker] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const redirectTo = useMemo(() => {
    const from = location.state as { from?: { pathname?: string } } | null
    return from?.from?.pathname ?? '/orders'
  }, [location.state])

  if (status === 'authenticated') {
    return <Navigate to={redirectTo} replace />
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage('')

    loginMutation.mutate(
      { email: email.trim(), password },
      {
        onSuccess: (response) => {
          setSession(response.data)
          toast.success('Sessao iniciada', `Bem-vindo, ${response.data.user.name}.`)
          const target =
            redirectTo === '/orders' && !response.data.user.permissions.includes('orders:view')
              ? getFirstAuthorizedPath(response.data.user.permissions)
              : redirectTo
          navigate(target, { replace: true })
        },
        onError: (error) => {
          const message =
            error instanceof ApiClientError
              ? error.message
              : 'Nao foi possivel iniciar a sessao.'
          setErrorMessage(message)
        },
      },
    )
  }

  const selectAccount = (accountEmail: string) => {
    setEmail(accountEmail)
    setPassword('Demo@123456')
    setErrorMessage('')
    setShowAccountPicker(false)
  }

  return (
    <main className="min-h-[100svh] w-full overflow-x-hidden bg-[#f8f3ed] text-graphite lg:grid lg:min-h-screen lg:grid-cols-2 lg:overflow-hidden">
      <section className="relative h-[430px] overflow-hidden bg-[#07111f] lg:h-screen lg:min-h-screen">
        <img
          src={loginBrandPanelSrc}
          alt="Painel visual Cain Delivery"
          className="h-full w-full object-cover object-[46%_center] lg:object-[47%_center]"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#f8f3ed] via-[#f8f3ed]/40 to-transparent lg:hidden" />
      </section>

      <section className="relative z-20 -mt-24 flex min-h-[calc(100svh-334px)] w-full min-w-0 items-end bg-[#f8f3ed] px-0 pb-0 sm:px-4 sm:pb-5 lg:mt-0 lg:min-h-screen lg:items-center lg:justify-center lg:px-12 lg:py-8">
        <div className="relative mx-auto w-full max-w-none rounded-t-[34px] bg-[#fffdf9] px-6 pb-5 pt-16 shadow-[0_28px_90px_rgba(30,28,24,0.16)] ring-1 ring-black/5 backdrop-blur-xl sm:max-w-[430px] sm:rounded-[34px] sm:px-8 lg:max-w-[540px] lg:rounded-[32px] lg:px-12 lg:py-10">
          <div className="absolute left-1/2 top-[-52px] flex h-[104px] w-[104px] -translate-x-1/2 items-center justify-center rounded-full border-[8px] border-white bg-[#fbefe6] text-[#d56b3c] shadow-[0_18px_38px_rgba(191,101,55,0.22)] lg:static lg:mb-7 lg:h-12 lg:w-12 lg:translate-x-0 lg:border-0 lg:bg-[#fbefe6] lg:shadow-none">
            <UserRound className="h-11 w-11 lg:h-5 lg:w-5" />
          </div>

          <div className="mb-5 text-center lg:mb-7 lg:text-left">
            <p className="hidden text-base text-muted-foreground lg:block">Bem-vindo de volta!</p>
            <h2 className="mt-1 text-[30px] font-black leading-tight tracking-tight sm:text-[34px] lg:text-[42px]">
              <span className="lg:hidden">Bem-vindo de volta</span>
              <span className="hidden lg:inline">Acesse sua operacao</span>
            </h2>
            <button
              type="button"
              className="mt-3 text-lg text-muted-foreground transition hover:text-primary lg:hidden"
              onClick={() => setShowAccountPicker((current) => !current)}
            >
              {email}
            </button>
            <p className="mt-3 hidden text-base leading-7 text-muted-foreground lg:block">
              Use seu email e senha para entrar no painel administrativo.
            </p>
          </div>

          <form
            className="mx-auto w-[280px] max-w-[calc(100%-48px)] min-w-0 space-y-4 sm:w-full sm:max-w-full lg:space-y-5"
            onSubmit={handleSubmit}
          >
            <label className={cn('space-y-2', showAccountPicker ? 'block' : 'hidden lg:block')}>
              <span className="text-sm font-semibold">Email</span>
              <span className="relative block">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="email"
                  autoComplete="email"
                  value={email}
                  placeholder="seu@email.com"
                  className="h-[54px] rounded-2xl border-[#ded8d1] bg-white pl-12 text-base shadow-none"
                  onChange={(event) => setEmail(event.target.value)}
                />
              </span>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold">Senha</span>
              <span className="relative block">
                <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  className="h-[54px] rounded-2xl border-[#ded8d1] bg-white px-12 text-base shadow-none"
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </span>
            </label>

            <div className="flex min-w-0 flex-col gap-3 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <label className="flex min-w-0 items-center gap-3 text-muted-foreground sm:flex-1">
                <button
                  type="button"
                  aria-pressed={rememberDevice}
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-md border transition',
                    rememberDevice
                      ? 'border-[#c9572f] bg-[#c9572f] text-white'
                      : 'border-[#d7d0c9] bg-white text-transparent',
                  )}
                  onClick={() => setRememberDevice((current) => !current)}
                >
                  <Check className="h-4 w-4" />
                </button>
                <span className="hidden truncate sm:inline">Confiar neste dispositivo</span>
                <span className="truncate sm:hidden">Manter conectado neste celular</span>
              </label>
              <button
                type="button"
                className="w-full text-right font-medium text-[#c9572f] underline-offset-4 hover:underline sm:w-auto sm:shrink-0 sm:self-auto"
                onClick={() =>
                  setErrorMessage('Solicite o reset de senha para um owner ou gerente.')
                }
              >
                Esqueci minha senha
              </button>
            </div>

            {errorMessage ? (
              <div
                role="alert"
                className="rounded-2xl bg-status-danger/10 px-4 py-3 text-sm font-medium text-status-danger"
              >
                {errorMessage}
              </div>
            ) : null}

            <Button
              className="h-[58px] w-full rounded-2xl bg-[#cc562d] text-base shadow-[0_14px_34px_rgba(204,86,45,0.32)] hover:bg-[#b94825]"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? 'Entrando...' : 'Entrar'}
              <ArrowRight className="ml-auto h-5 w-5" />
            </Button>
          </form>

          <div className="mx-auto my-5 flex w-[280px] max-w-[calc(100%-48px)] items-center gap-5 text-sm text-muted-foreground sm:w-full sm:max-w-full lg:my-7">
            <span className="h-px flex-1 bg-[#ded8d1]" />
            <span>ou</span>
            <span className="h-px flex-1 bg-[#ded8d1]" />
          </div>

          <button
            type="button"
            className="mx-auto flex h-[54px] w-[280px] max-w-[calc(100%-48px)] items-center justify-center gap-3 rounded-2xl border border-[#ded8d1] bg-white text-sm font-semibold transition hover:border-primary/40 hover:bg-secondary/35 sm:w-full sm:max-w-full"
            onClick={() => setErrorMessage('Autenticacao rapida ainda nao esta habilitada neste ambiente.')}
          >
            <span className="lg:hidden">
              <Fingerprint className="h-6 w-6" />
            </span>
            <span className="hidden lg:inline">
              <Zap className="h-5 w-5" />
            </span>
            <span className="lg:hidden">Entrar com biometria</span>
            <span className="hidden lg:inline">Continuar com autenticacao rapida</span>
          </button>

          <div className="mt-5 text-center lg:mt-6">
            <button
              type="button"
              className="font-medium text-[#c9572f] underline underline-offset-4"
              onClick={() => setShowAccountPicker((current) => !current)}
            >
              Usar outra conta
            </button>
          </div>

          {showAccountPicker ? (
            <div className="mt-5 grid gap-2 rounded-2xl bg-[#f4eee7] p-3 sm:grid-cols-2">
              {demoAccounts.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  className="rounded-xl bg-white/80 px-3 py-2 text-left text-xs font-semibold transition hover:bg-white"
                  onClick={() => selectAccount(account.email)}
                >
                  <span className="block">{roleLabelMap[account.role]}</span>
                  <span className="block truncate font-normal text-muted-foreground">
                    {account.email}
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          <p className="mt-6 hidden items-center justify-center gap-2 text-sm text-muted-foreground lg:flex">
            <Lock className="h-4 w-4" />
            Conexao segura e protegida com criptografia de ponta.
          </p>
        </div>
      </section>
    </main>
  )
}
