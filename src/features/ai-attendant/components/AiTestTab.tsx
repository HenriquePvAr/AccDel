import { useState, type FormEvent } from 'react'
import { AlertCircle, Bot, CheckCircle2, Loader2, Send, TestTube } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useTestReplyMutation } from '@/hooks/queries/ai-attendant'
import { useToastStore } from '@/stores/toast-store'
import type { TestReplyResult } from '@/contracts/ai-attendant'

import { recommendedActionLabels } from './ai-attendant-labels'

export function AiTestTab() {
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<TestReplyResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const testReply = useTestReplyMutation()
  const { pushToast } = useToastStore()

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedMessage = message.trim()

    if (!trimmedMessage) {
      pushToast({ title: 'Digite uma mensagem para testar', variant: 'warning' })
      return
    }

    setErrorMessage(null)
    setResult(null)

    try {
      const response = await testReply.mutateAsync({ message: trimmedMessage })
      setResult(response)
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'A API nao conseguiu gerar resposta de teste.'))
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5 text-primary" />
            Testar atendente
          </CardTitle>
          <CardDescription>
            Envie uma mensagem para a API real gerar uma resposta com o contexto atual da loja.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label htmlFor="ai-test-message" className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                Mensagem do cliente
              </label>
              <textarea
                id="ai-test-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={9}
                maxLength={2000}
                className="min-h-56 w-full resize-y rounded-xl border border-white/10 bg-[#071525] px-3 py-2 text-sm leading-6 text-slate-100 shadow-sm outline-none transition placeholder:text-slate-500 focus:border-primary/70 focus:ring-2 focus:ring-primary/20"
                placeholder="Ex: voces entregam no bairro Centro? Quero uma pizza grande sem cebola."
              />
            </div>

            <Alert>
              <AlertTitle>
                <Bot className="h-4 w-4" />
                Sem resposta falsa
              </AlertTitle>
              <AlertDescription>
                Este teste chama o endpoint /ai-attendant/test-reply. Se o provider IA/Lovable nao estiver configurado ou integrado, a tela mostra o erro retornado pela API.
              </AlertDescription>
            </Alert>

            <Button type="submit" disabled={testReply.isPending}>
              {testReply.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Gerar resposta
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resultado</CardTitle>
          <CardDescription>
            Resposta, fontes e acao recomendada retornadas pelo provider.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {testReply.isPending ? (
            <div className="flex min-h-72 flex-col items-center justify-center gap-3 rounded-[22px] border border-white/10 bg-white/[0.03] text-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm font-semibold text-slate-300">Gerando resposta pela API...</p>
            </div>
          ) : null}

          {errorMessage ? (
            <Alert variant="danger">
              <AlertTitle>
                <AlertCircle className="h-4 w-4" />
                Provider IA indisponivel
              </AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}

          {result ? <TestResultPanel result={result} /> : null}

          {!testReply.isPending && !errorMessage && !result ? (
            <div className="flex min-h-72 flex-col items-center justify-center gap-3 rounded-[22px] border border-dashed border-white/10 bg-white/[0.03] text-center">
              <TestTube className="h-10 w-10 text-primary" />
              <div>
                <p className="font-black text-white">Nenhum teste executado</p>
                <p className="mt-1 max-w-md text-sm leading-6 text-slate-400">
                  Digite uma mensagem e gere a resposta para validar a integracao IA com dados reais.
                </p>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

function TestResultPanel({ result }: { result: TestReplyResult }) {
  return (
    <div className="space-y-4">
      <Alert variant="success">
        <AlertTitle>
          <CheckCircle2 className="h-4 w-4" />
          Resposta gerada pela API
        </AlertTitle>
        <AlertDescription>
          Confianca de {Math.round(result.confidence * 100)}% e acao recomendada: {recommendedActionLabels[result.recommendedAction]}.
        </AlertDescription>
      </Alert>

      <div className="rounded-[22px] border border-white/10 bg-[#050d18]/70 p-5">
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
          Resposta sugerida
        </p>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-100">{result.reply}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
            Acao recomendada
          </p>
          <Badge className="mt-3" variant={result.recommendedAction === 'respond_automatically' ? 'success' : 'warning'}>
            {recommendedActionLabels[result.recommendedAction]}
          </Badge>
        </div>

        <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
            Fontes usadas
          </p>
          {result.sourcesUsed.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {result.sourcesUsed.map((source) => (
                <Badge key={source}>{source}</Badge>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-400">Nenhuma fonte retornada pelo provider.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}
