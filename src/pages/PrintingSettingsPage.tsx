import { useState, type FormEvent, type ReactNode } from 'react'
import {
  Clock3,
  Copy,
  Printer as PrinterIcon,
  RefreshCw,
  RotateCcw,
  Route,
  Save,
  Server,
  Settings2,
  ShieldAlert,
  TestTube2,
  Trash2,
  Wifi,
  WifiOff,
  XCircle,
} from 'lucide-react'

import { PageShell } from '@/components/shared/PageShell'
import { SectionHeader } from '@/components/shared/SectionHeader'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type {
  PrintAgentSummary,
  PrintConnectionType,
  PrintJob,
  PrintJobStatus,
  PrintJobType,
  Printer as PrinterConfig,
  PrinterRoutingRule,
  PrinterStation,
  PrintingOverviewResponse,
  PrintingSettings,
  SavePrinterRequest,
  UpdatePrintingSettingsRequest,
} from '@/contracts'
import {
  useCancelPrintJobMutation,
  useCategoriesQuery,
  useCreateTestPrintMutation,
  useDeletePrintRoutingRuleMutation,
  usePrintJobsQuery,
  usePrintingOverviewQuery,
  useProductsQuery,
  useProvisionPrintAgentMutation,
  useReprintJobMutation,
  useRetryPrintJobMutation,
  useRevokePrintAgentMutation,
  useRotatePrintAgentMutation,
  useSavePrinterMutation,
  useSavePrinterStationMutation,
  useSavePrintRoutingRuleMutation,
  useUpdatePrintingSettingsMutation,
} from '@/hooks/queries'
import { usePageTitle } from '@/hooks/use-page-title'
import { useCan } from '@/hooks/use-permissions'
import { useToast } from '@/hooks/use-toast'
import type { Category, Product } from '@/types'

const controlClass =
  'h-11 w-full rounded-lg border border-input bg-white px-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20'

const statuses: Array<{ value: PrintJobStatus | 'all'; label: string }> = [
  { value: 'all', label: 'Todos os estados' },
  { value: 'PENDING', label: 'Pendentes' },
  { value: 'CLAIMED', label: 'Reservados' },
  { value: 'PRINTING', label: 'Imprimindo' },
  { value: 'PRINTED', label: 'Impressos' },
  { value: 'RETRY_WAIT', label: 'Aguardando nova tentativa' },
  { value: 'FAILED', label: 'Falhos' },
  { value: 'PRINT_RESULT_UNKNOWN', label: 'Precisa de revisao' },
  { value: 'CANCELLED', label: 'Cancelados' },
]

export function PrintingSettingsPage() {
  usePageTitle('Impressão')
  const canManage = useCan('printing:manage')
  const canReprint = useCan('printing:reprint')
  const [jobStatus, setJobStatus] = useState<PrintJobStatus | 'all'>('all')
  const [activeTab, setActiveTab] = useState('queue')
  const overviewQuery = usePrintingOverviewQuery()
  const jobsQuery = usePrintJobsQuery({ page: 1, pageSize: 50, status: jobStatus })
  const categoriesQuery = useCategoriesQuery()
  const productsQuery = useProductsQuery({ page: 1, pageSize: 100 })

  const overview = overviewQuery.data?.data
  const jobs = jobsQuery.data?.data ?? []
  const printingDisconnected = Boolean(
    overview?.settings.enabled &&
      overview.printers.some((printer) => printer.enabled) &&
      !overview.agents.some((agent) => agent.online && agent.enabled && !agent.revokedAt),
  )

  return (
    <PageShell>
      <SectionHeader
        title="Impressão"
        description="Acompanhe e recupere impressões da loja."
        actions={
          <Button
            type="button"
            variant="secondary"
            onClick={() => void Promise.all([overviewQuery.refetch(), jobsQuery.refetch()])}
            disabled={overviewQuery.isFetching || jobsQuery.isFetching}
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
        }
      />

      {overviewQuery.isLoading ? (
        <Card><CardContent className="p-8 text-sm text-slate-400">Carregando configuracao persistida...</CardContent></Card>
      ) : overviewQuery.isError || !overview ? (
        <Alert variant="danger">
          <AlertTitle><XCircle className="h-4 w-4" /> Nao foi possivel carregar a impressao</AlertTitle>
          <AlertDescription>{errorMessage(overviewQuery.error)}</AlertDescription>
        </Alert>
      ) : (
        <>
          <Metrics overview={overview} />
          {printingDisconnected ? (
            <Alert variant="danger">
              <AlertTitle><WifiOff className="h-4 w-4" /> Impressao desconectada</AlertTitle>
              <AlertDescription>
                Nenhum computador de impressao esta conectado. Os pedidos permanecem seguros na fila ate a conexao voltar.
              </AlertDescription>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" size="sm" onClick={() => setActiveTab('agents')}>
                  Ver computadores
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => void overviewQuery.refetch()}>
                  Atualizar estado
                </Button>
              </div>
            </Alert>
          ) : null}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
            <TabsList>
              <TabsTrigger value="queue"><Clock3 className="h-4 w-4" /> Fila</TabsTrigger>
              <TabsTrigger value="printers"><PrinterIcon className="h-4 w-4" /> Impressoras</TabsTrigger>
              <TabsTrigger value="agents"><Server className="h-4 w-4" /> Computadores</TabsTrigger>
              <TabsTrigger value="routing"><Route className="h-4 w-4" /> Onde imprimir</TabsTrigger>
              <TabsTrigger value="policies"><Settings2 className="h-4 w-4" /> Quando imprimir</TabsTrigger>
            </TabsList>

            <TabsContent value="policies">
              <PolicyPanel
                key={overview.settings.updatedAt}
                settings={overview.settings}
                stations={overview.stations}
                canManage={canManage}
              />
            </TabsContent>
            <TabsContent value="printers">
              <PrinterPanel
                stations={overview.stations}
                printers={overview.printers}
                agents={overview.agents}
                canManage={canManage}
              />
            </TabsContent>
            <TabsContent value="routing">
              <RoutingPanel
                stations={overview.stations}
                rules={overview.routes}
                categories={categoriesQuery.data?.data ?? []}
                products={productsQuery.data?.data ?? []}
                canManage={canManage}
              />
            </TabsContent>
            <TabsContent value="queue">
              <QueuePanel
                jobs={jobs}
                total={jobsQuery.data?.meta.total ?? 0}
                status={jobStatus}
                setStatus={setJobStatus}
                loading={jobsQuery.isLoading || jobsQuery.isFetching}
                error={jobsQuery.error}
                canManage={canManage}
                canReprint={canReprint}
              />
            </TabsContent>
            <TabsContent value="agents">
              <AgentsPanel agents={overview.agents} canManage={canManage} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </PageShell>
  )
}

function Metrics({ overview }: { overview: PrintingOverviewResponse['data'] }) {
  const pending =
    (overview.jobCounts.PENDING ?? 0) +
    (overview.jobCounts.CLAIMED ?? 0) +
    (overview.jobCounts.PRINTING ?? 0) +
    (overview.jobCounts.RETRY_WAIT ?? 0)
  const values = [
    { label: 'Funcionamento', value: overview.settings.enabled ? 'Ativo' : 'Desativado', tone: overview.settings.enabled ? 'success' : 'warning' },
    { label: 'Pontos conectados', value: String(overview.agents.filter((agent) => agent.online).length), tone: 'success' },
    { label: 'Na fila', value: String(pending), tone: pending > 0 ? 'warning' : 'default' },
    { label: 'Com problema', value: String(overview.jobCounts.PRINT_RESULT_UNKNOWN ?? 0), tone: (overview.jobCounts.PRINT_RESULT_UNKNOWN ?? 0) > 0 ? 'danger' : 'default' },
  ] as const
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {values.map((metric) => (
        <Card key={metric.label}>
          <CardContent className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{metric.label}</p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-2xl font-black text-white">{metric.value}</p>
              <Badge variant={metric.tone}>{metric.tone === 'success' ? 'OK' : metric.tone === 'danger' ? 'Acao' : 'Fila'}</Badge>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function PolicyPanel({
  settings,
  stations,
  canManage,
}: {
  settings: PrintingSettings
  stations: PrinterStation[]
  canManage: boolean
}) {
  const toast = useToast()
  const mutation = useUpdatePrintingSettingsMutation()
  const [draft, setDraft] = useState<UpdatePrintingSettingsRequest>(() => ({
    enabled: settings.enabled,
    fallbackPolicy: settings.fallbackPolicy,
    fallbackStationId: settings.fallbackStationId,
    printOrderReady: settings.printOrderReady,
    printPaymentConfirmed: settings.printPaymentConfirmed,
    printCancellation: settings.printCancellation,
    customerReceiptEnabled: settings.customerReceiptEnabled,
    defaultMaxAttempts: settings.defaultMaxAttempts,
    leaseDurationSeconds: settings.leaseDurationSeconds,
  }))

  const save = async (event: FormEvent) => {
    event.preventDefault()
    try {
      await mutation.mutateAsync(draft)
    } catch (error) {
      toast.danger('Falha ao salvar politicas', errorMessage(error))
    }
  }

  return (
    <form onSubmit={(event) => void save(event)} className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
      <Card>
        <CardHeader>
          <CardTitle>Quando imprimir</CardTitle>
          <CardDescription>Escolha quando uma impressão deve ser criada.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Toggle label="Impressao habilitada" checked={draft.enabled} disabled={!canManage} onChange={(enabled) => setDraft({ ...draft, enabled })} />
          <Toggle label="Imprimir quando ficar pronto" checked={draft.printOrderReady} disabled={!canManage} onChange={(printOrderReady) => setDraft({ ...draft, printOrderReady })} />
          <Toggle label="Caixa ao confirmar pagamento" checked={draft.printPaymentConfirmed} disabled={!canManage} onChange={(printPaymentConfirmed) => setDraft({ ...draft, printPaymentConfirmed })} />
          <Toggle label="Aviso de cancelamento" checked={draft.printCancellation} disabled={!canManage} onChange={(printCancellation) => setDraft({ ...draft, printCancellation })} />
          <Toggle label="Via do cliente" checked={draft.customerReceiptEnabled} disabled={!canManage} onChange={(customerReceiptEnabled) => setDraft({ ...draft, customerReceiptEnabled })} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Destino padrao e tentativas</CardTitle>
          <CardDescription>Defina para onde enviar itens sem uma regra especifica.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Quando o item nao tem destino">
            <select className={controlClass} value={draft.fallbackPolicy} disabled={!canManage} onChange={(event) => setDraft({ ...draft, fallbackPolicy: event.target.value as UpdatePrintingSettingsRequest['fallbackPolicy'] })}>
              <option value="DEFAULT_STATION">Estacao padrao</option>
              <option value="BLOCK">Bloquear e alertar</option>
            </select>
          </Field>
          <Field label="Estacao padrao">
            <select className={controlClass} value={draft.fallbackStationId ?? ''} disabled={!canManage || draft.fallbackPolicy === 'BLOCK'} onChange={(event) => setDraft({ ...draft, fallbackStationId: event.target.value || null })}>
              <option value="">Selecione</option>
              {stations.filter((station) => station.enabled).map((station) => <option key={station.id} value={station.id}>{station.name} ({station.code})</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Max. tentativas"><Input type="number" min={1} max={20} value={draft.defaultMaxAttempts} disabled={!canManage} onChange={(event) => setDraft({ ...draft, defaultMaxAttempts: Number(event.target.value) })} /></Field>
            <Field label="Tempo reservado (segundos)"><Input type="number" min={15} max={300} value={draft.leaseDurationSeconds} disabled={!canManage} onChange={(event) => setDraft({ ...draft, leaseDurationSeconds: Number(event.target.value) })} /></Field>
          </div>
          {canManage ? <Button type="submit" className="w-full" disabled={mutation.isPending}><Save className="h-4 w-4" /> Salvar politicas</Button> : null}
        </CardContent>
      </Card>
    </form>
  )
}

function PrinterPanel({
  stations,
  printers,
  agents,
  canManage,
}: {
  stations: PrinterStation[]
  printers: PrinterConfig[]
  agents: PrintAgentSummary[]
  canManage: boolean
}) {
  const toast = useToast()
  const savePrinter = useSavePrinterMutation()
  const saveStation = useSavePrinterStationMutation()
  const testPrint = useCreateTestPrintMutation()
  const emptyPrinter = (): SavePrinterRequest => ({
    name: '',
    stationId: stations[0]?.id ?? '',
    agentId: agents.find((agent) => agent.enabled)?.id ?? null,
    connectionType: 'FILE_OR_VIRTUAL',
    address: 'dry-run',
    port: null,
    paperWidth: 80,
    encoding: 'CP860',
    enabled: Boolean(agents.find((agent) => agent.enabled && !agent.revokedAt)),
    isDefault: true,
  })
  const [printerDraft, setPrinterDraft] = useState<SavePrinterRequest>(emptyPrinter)
  const [stationDraft, setStationDraft] = useState({ id: '', code: '', name: '', enabled: true })

  const submitPrinter = async (event: FormEvent) => {
    event.preventDefault()
    try {
      await savePrinter.mutateAsync({
        ...printerDraft,
        name: printerDraft.name.trim(),
        address: printerDraft.address.trim(),
        agentId: printerDraft.agentId || null,
        port: printerDraft.connectionType === 'NETWORK_TCP' ? printerDraft.port : null,
      })
      setPrinterDraft(emptyPrinter())
    } catch (error) {
      toast.danger('Falha ao salvar impressora', errorMessage(error))
    }
  }

  const submitStation = async (event: FormEvent) => {
    event.preventDefault()
    try {
      await saveStation.mutateAsync({
        id: stationDraft.id || undefined,
        code: stationDraft.code.trim().toUpperCase(),
        name: stationDraft.name.trim(),
        enabled: stationDraft.enabled,
      })
      setStationDraft({ id: '', code: '', name: '', enabled: true })
    } catch (error) {
      toast.danger('Falha ao salvar estacao', errorMessage(error))
    }
  }

  const editPrinter = (printer: PrinterConfig) => setPrinterDraft({
    id: printer.id,
    name: printer.name,
    stationId: printer.stationId,
    agentId: printer.agentId,
    connectionType: printer.connectionType,
    address: printer.address,
    port: printer.port,
    paperWidth: printer.paperWidth === 58 ? 58 : 80,
    encoding: printer.encoding,
    enabled: printer.enabled,
    isDefault: printer.isDefault,
  })

  const setEnabled = async (printer: PrinterConfig, enabled: boolean) => {
    try {
      await savePrinter.mutateAsync({
        id: printer.id,
        name: printer.name,
        stationId: printer.stationId,
        agentId: printer.agentId,
        connectionType: printer.connectionType,
        address: printer.address,
        port: printer.port,
        paperWidth: printer.paperWidth === 58 ? 58 : 80,
        encoding: printer.encoding,
        enabled,
        isDefault: printer.isDefault,
      })
    } catch (error) {
      toast.danger('Falha ao alterar impressora', errorMessage(error))
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
      {canManage ? (
        <div className="space-y-5">
          <Card>
            <CardHeader><CardTitle>{printerDraft.id ? 'Editar impressora' : 'Nova impressora'}</CardTitle><CardDescription>Vincule a impressora ao computador que fara a impressao.</CardDescription></CardHeader>
            <CardContent>
              <form onSubmit={(event) => void submitPrinter(event)} className="space-y-3">
                <Field label="Nome"><Input required minLength={2} value={printerDraft.name} onChange={(event) => setPrinterDraft({ ...printerDraft, name: event.target.value })} /></Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Estacao"><select required className={controlClass} value={printerDraft.stationId} onChange={(event) => setPrinterDraft({ ...printerDraft, stationId: event.target.value })}>{stations.map((station) => <option key={station.id} value={station.id}>{station.name}</option>)}</select></Field>
                  <Field label="Computador"><select className={controlClass} value={printerDraft.agentId ?? ''} onChange={(event) => setPrinterDraft({ ...printerDraft, agentId: event.target.value || null })}><option value="">Sem computador</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}{agent.online ? ' (conectado)' : ''}</option>)}</select></Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Conexao"><select className={controlClass} value={printerDraft.connectionType} onChange={(event) => setPrinterDraft({ ...printerDraft, connectionType: event.target.value as PrintConnectionType })}><option value="FILE_OR_VIRTUAL">Arquivo / dry-run</option><option value="NETWORK_TCP">TCP de rede</option><option value="WINDOWS_PRINTER">Impressora Windows</option></select></Field>
                  <Field label={printerDraft.connectionType === 'NETWORK_TCP' ? 'Host ou IP' : printerDraft.connectionType === 'WINDOWS_PRINTER' ? 'Nome no Windows' : 'Identificador virtual'}><Input required value={printerDraft.address} onChange={(event) => setPrinterDraft({ ...printerDraft, address: event.target.value })} /></Field>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Porta"><Input type="number" min={1} max={65535} disabled={printerDraft.connectionType !== 'NETWORK_TCP'} value={printerDraft.port ?? ''} onChange={(event) => setPrinterDraft({ ...printerDraft, port: event.target.value ? Number(event.target.value) : null })} /></Field>
                  <Field label="Papel"><select className={controlClass} value={printerDraft.paperWidth} onChange={(event) => setPrinterDraft({ ...printerDraft, paperWidth: Number(event.target.value) as 58 | 80 })}><option value={58}>58 mm</option><option value={80}>80 mm</option></select></Field>
                  <Field label="Encoding"><select className={controlClass} value={printerDraft.encoding} onChange={(event) => setPrinterDraft({ ...printerDraft, encoding: event.target.value as SavePrinterRequest['encoding'] })}><option value="CP860">CP860</option><option value="CP850">CP850</option><option value="ASCII">ASCII</option></select></Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-2"><Toggle label="Ativa" checked={printerDraft.enabled} onChange={(enabled) => setPrinterDraft({ ...printerDraft, enabled })} /><Toggle label="Padrao do setor" checked={printerDraft.isDefault} onChange={(isDefault) => setPrinterDraft({ ...printerDraft, isDefault })} /></div>
                <div className="flex gap-2"><Button type="submit" className="flex-1" disabled={savePrinter.isPending}><Save className="h-4 w-4" /> Salvar</Button>{printerDraft.id ? <Button type="button" variant="secondary" onClick={() => setPrinterDraft(emptyPrinter())}>Cancelar</Button> : null}</div>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Estacoes</CardTitle><CardDescription>Codigos estaveis, sem depender do nome visivel do produto.</CardDescription></CardHeader>
            <CardContent>
              <form onSubmit={(event) => void submitStation(event)} className="space-y-3">
                <div className="grid grid-cols-[0.75fr_1.25fr] gap-3"><Field label="Codigo"><Input required pattern="[A-Za-z][A-Za-z0-9_]*" value={stationDraft.code} onChange={(event) => setStationDraft({ ...stationDraft, code: event.target.value })} /></Field><Field label="Nome"><Input required value={stationDraft.name} onChange={(event) => setStationDraft({ ...stationDraft, name: event.target.value })} /></Field></div>
                <div className="flex items-center gap-2"><Button type="submit" className="flex-1" disabled={saveStation.isPending}><Save className="h-4 w-4" /> Salvar estacao</Button>{stationDraft.id ? <Button type="button" variant="secondary" onClick={() => setStationDraft({ id: '', code: '', name: '', enabled: true })}>Cancelar</Button> : null}</div>
              </form>
              <div className="mt-4 flex flex-wrap gap-2">{stations.map((station) => <button key={station.id} type="button" onClick={() => setStationDraft({ id: station.id, code: station.code, name: station.name, enabled: station.enabled })} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-slate-300">{station.code}</button>)}</div>
            </CardContent>
          </Card>
        </div>
      ) : null}
      <Card className={!canManage ? 'xl:col-span-2' : undefined}>
        <CardHeader><CardTitle>Impressoras cadastradas</CardTitle><CardDescription>{printers.length} impressora(s) configurada(s) para a loja.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          {printers.length ? printers.map((printer) => (
            <div key={printer.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><p className="font-bold text-white">{printer.name}</p><Badge variant={printer.enabled ? 'success' : 'default'}>{printer.enabled ? 'Ativa' : 'Inativa'}</Badge>{printer.isDefault ? <Badge>Padrao</Badge> : null}</div>
                  <p className="mt-1 text-sm text-slate-400">{printer.station.name} · {connectionLabel(printer.connectionType)} · {printer.paperWidth} mm</p>
                  <p className="mt-1 text-xs text-slate-500">Computador: {printer.agent?.name ?? 'nao atribuido'} {printer.agent ? (printer.agent.online ? '· conectado' : '· desconectado') : ''}</p>
                </div>
                {canManage ? <div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="secondary" onClick={() => editPrinter(printer)}>Editar</Button><Button type="button" size="sm" variant="outline" disabled={!printer.enabled || !printer.agentId || testPrint.isPending} onClick={() => void testPrint.mutateAsync(printer.id).catch((error) => toast.danger('Falha ao enfileirar teste', errorMessage(error)))}><TestTube2 className="h-3.5 w-3.5" /> Testar</Button><Switch checked={printer.enabled} onCheckedChange={(value) => void setEnabled(printer, value)} /></div> : null}
              </div>
              {!printer.agentId ? <p className="mt-3 text-xs text-amber-800">Atribua um computador antes de enviar impressoes para esta impressora.</p> : null}
            </div>
          )) : <EmptyState icon={<PrinterIcon className="h-5 w-5" />} text="Nenhuma impressora cadastrada." />}
        </CardContent>
      </Card>
    </div>
  )
}

function RoutingPanel({
  stations,
  rules,
  categories,
  products,
  canManage,
}: {
  stations: PrinterStation[]
  rules: PrinterRoutingRule[]
  categories: Category[]
  products: Product[]
  canManage: boolean
}) {
  const toast = useToast()
  const saveRule = useSavePrintRoutingRuleMutation()
  const deleteRule = useDeletePrintRoutingRuleMutation()
  const [scope, setScope] = useState<'CATEGORY' | 'PRODUCT'>('CATEGORY')
  const [subjectId, setSubjectId] = useState('')
  const [stationId, setStationId] = useState(stations[0]?.id ?? '')
  const subjects = scope === 'CATEGORY' ? categories : products

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    try {
      await saveRule.mutateAsync({
        scope,
        productId: scope === 'PRODUCT' ? subjectId : null,
        categoryId: scope === 'CATEGORY' ? subjectId : null,
        stationId,
        priority: scope === 'PRODUCT' ? 10 : 0,
        enabled: true,
      })
      setSubjectId('')
    } catch (error) {
      toast.danger('Falha ao salvar roteamento', errorMessage(error))
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
      {canManage ? <Card><CardHeader><CardTitle>Novo destino</CardTitle><CardDescription>Escolha onde cada categoria ou produto deve ser impresso.</CardDescription></CardHeader><CardContent><form onSubmit={(event) => void submit(event)} className="space-y-3"><Field label="Aplicar por"><select className={controlClass} value={scope} onChange={(event) => { setScope(event.target.value as 'CATEGORY' | 'PRODUCT'); setSubjectId('') }}><option value="CATEGORY">Categoria</option><option value="PRODUCT">Produto especifico</option></select></Field><Field label={scope === 'CATEGORY' ? 'Categoria' : 'Produto'}><select required className={controlClass} value={subjectId} onChange={(event) => setSubjectId(event.target.value)}><option value="">Selecione</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></Field><Field label="Setor de impressao"><select required className={controlClass} value={stationId} onChange={(event) => setStationId(event.target.value)}>{stations.filter((station) => station.enabled).map((station) => <option key={station.id} value={station.id}>{station.name} ({station.code})</option>)}</select></Field><Button type="submit" className="w-full" disabled={saveRule.isPending || !subjectId}><Route className="h-4 w-4" /> Salvar destino</Button></form></CardContent></Card> : null}
      <Card className={!canManage ? 'xl:col-span-2' : undefined}><CardHeader><CardTitle>Destinos configurados</CardTitle><CardDescription>Cada item segue para o setor indicado pela categoria ou pelo produto.</CardDescription></CardHeader><CardContent className="space-y-3">{rules.length ? rules.map((rule) => <div key={rule.id} className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4"><div><div className="flex items-center gap-2"><Badge>{rule.scope === 'PRODUCT' ? 'Produto' : 'Categoria'}</Badge><p className="font-semibold text-white">{rule.product?.name ?? rule.category?.name ?? 'Item removido'}</p></div><p className="mt-1 text-sm text-slate-400">→ {rule.station.name} ({rule.station.code})</p></div>{canManage ? <Button type="button" size="icon" variant="ghost" aria-label="Remover regra" disabled={deleteRule.isPending} onClick={() => void deleteRule.mutateAsync(rule.id).catch((error) => toast.danger('Falha ao remover destino', errorMessage(error)))}><Trash2 className="h-4 w-4" /></Button> : null}</div>) : <EmptyState icon={<Route className="h-5 w-5" />} text="Nenhum destino especifico; o setor padrao sera usado." />}</CardContent></Card>
    </div>
  )
}

function QueuePanel({
  jobs,
  total,
  status,
  setStatus,
  loading,
  error,
  canManage,
  canReprint,
}: {
  jobs: PrintJob[]
  total: number
  status: PrintJobStatus | 'all'
  setStatus: (status: PrintJobStatus | 'all') => void
  loading: boolean
  error: unknown
  canManage: boolean
  canReprint: boolean
}) {
  const toast = useToast()
  const retry = useRetryPrintJobMutation()
  const cancel = useCancelPrintJobMutation()
  const reprint = useReprintJobMutation()

  const askReason = (title: string) => window.prompt(title, '')?.trim() ?? ''
  const cancelJob = async (job: PrintJob) => {
    const reason = askReason('Motivo do cancelamento (minimo 5 caracteres)')
    if (reason.length < 5) return
    try { await cancel.mutateAsync({ jobId: job.id, reason }) } catch (cause) { toast.danger('Falha ao cancelar impressao', errorMessage(cause)) }
  }
  const reprintJob = async (job: PrintJob) => {
    const reason = askReason('Motivo da reimpressao (minimo 5 caracteres)')
    if (reason.length < 5) return
    try { await reprint.mutateAsync({ jobId: job.id, reason }) } catch (cause) { toast.danger('Falha ao reimprimir', errorMessage(cause)) }
  }

  return (
    <Card>
      <CardHeader className="gap-4 sm:flex-row sm:items-end sm:justify-between"><div><CardTitle>Fila de impressoes</CardTitle><CardDescription>{total === 1 ? '1 impressao no filtro atual' : `${total} impressoes no filtro atual`}; a lista atualiza automaticamente.</CardDescription></div><select className={`${controlClass} sm:w-64`} value={status} onChange={(event) => setStatus(event.target.value as PrintJobStatus | 'all')}>{statuses.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select></CardHeader>
      <CardContent className="space-y-3">
        {error ? <Alert variant="danger"><AlertTitle>Falha ao carregar fila</AlertTitle><AlertDescription>{errorMessage(error)}</AlertDescription></Alert> : null}
        {loading && !jobs.length ? <p className="py-6 text-center text-sm text-slate-400">Carregando impressoes...</p> : null}
        {jobs.map((job) => {
          const meta = statusMeta(job.status)
          const cancellable = ['PENDING', 'RETRY_WAIT', 'FAILED'].includes(job.status)
          const retryable = ['FAILED', 'RETRY_WAIT'].includes(job.status)
          const active = ['PENDING', 'CLAIMED', 'PRINTING', 'RETRY_WAIT'].includes(job.status)
          return <div key={job.id} className={`rounded-xl border p-4 ${job.status === 'PRINT_RESULT_UNKNOWN' ? 'border-amber-300 bg-amber-50' : 'border-border bg-white'}`}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge variant={meta.variant}>{meta.label}</Badge><Badge>{printTypeLabel(job.jobType)}</Badge></div><p className="mt-2 font-semibold text-white">{job.station?.name ?? job.stationCode ?? 'Sem setor'} · {job.printer?.name ?? 'Sem impressora'}</p><p className="mt-1 text-xs text-slate-500">Tentativa {job.attemptCount}/{job.maxAttempts} · criada em {formatDate(job.createdAt)}</p>{job.lastErrorCode ? <p className="mt-2 text-sm font-semibold text-amber-800">{printErrorMessage(job)}</p> : null}</div>
              <div className="flex flex-wrap gap-2">{canManage && retryable ? <Button type="button" size="sm" disabled={retry.isPending} onClick={() => void retry.mutateAsync(job.id).catch((cause) => toast.danger('Falha ao tentar novamente', errorMessage(cause)))}><RotateCcw className="h-3.5 w-3.5" /> Tentar novamente</Button> : null}{canManage && cancellable ? <Button type="button" size="sm" variant="outline" onClick={() => void cancelJob(job)}>Cancelar</Button> : null}{canReprint && !active ? <Button type="button" size="sm" onClick={() => void reprintJob(job)}><PrinterIcon className="h-3.5 w-3.5" /> Reimprimir</Button> : null}</div>
            </div>
            <details className="mt-3 rounded-lg bg-muted/45 px-3 py-2 text-xs text-muted-foreground"><summary className="cursor-pointer font-semibold text-foreground">Detalhes da impressão</summary><div className="mt-2 space-y-1 font-mono"><p>Impressão {shortId(job.id)} · tipo {job.jobType}</p><p>Modelo {job.templateKey}:{job.templateVersion}</p>{job.lastErrorCode ? <p>Código {job.lastErrorCode}</p> : null}{job.attempts.map((attempt) => <p key={attempt.id}>#{attempt.attemptNumber} · {attempt.status} · {attempt.durationMs ?? '—'} ms {attempt.errorCode ? `· ${attempt.errorCode}` : ''}</p>)}</div></details>
          </div>
        })}
        {!loading && !jobs.length ? <EmptyState icon={<Clock3 className="h-5 w-5" />} text="Nenhuma impressao encontrada neste filtro." /> : null}
      </CardContent>
    </Card>
  )
}

function AgentsPanel({ agents, canManage }: { agents: PrintAgentSummary[]; canManage: boolean }) {
  const toast = useToast()
  const provision = useProvisionPrintAgentMutation()
  const rotate = useRotatePrintAgentMutation()
  const revoke = useRevokePrintAgentMutation()
  const [draft, setDraft] = useState({ name: '', deviceName: '' })
  const [credential, setCredential] = useState<{ token: string; warning: string } | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    try {
      const response = await provision.mutateAsync(draft)
      setCredential({ token: response.data.token, warning: response.data.warning })
      setDraft({ name: '', deviceName: '' })
    } catch (error) { toast.danger('Falha ao cadastrar computador', errorMessage(error)) }
  }
  const rotateToken = async (agentId: string) => {
    if (!window.confirm('O token atual sera invalidado imediatamente. Continuar?')) return
    try {
      const response = await rotate.mutateAsync(agentId)
      setCredential({ token: response.data.token, warning: response.data.warning })
    } catch (error) { toast.danger('Falha ao rotacionar token', errorMessage(error)) }
  }
  const copyCredential = async () => {
    if (!credential) return
    try { await navigator.clipboard.writeText(credential.token); toast.success('Credencial copiada') } catch { toast.warning('Nao foi possivel copiar automaticamente') }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[0.75fr_1.25fr]">
      {canManage ? <div className="space-y-5"><Card><CardHeader><CardTitle>Cadastrar computador</CardTitle><CardDescription>Crie o acesso usado pelo computador que imprime os pedidos.</CardDescription></CardHeader><CardContent><form onSubmit={(event) => void submit(event)} className="space-y-3"><Field label="Nome do ponto"><Input required minLength={2} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></Field><Field label="Nome do computador"><Input required minLength={2} value={draft.deviceName} onChange={(event) => setDraft({ ...draft, deviceName: event.target.value })} /></Field><Button type="submit" className="w-full" disabled={provision.isPending}><ShieldAlert className="h-4 w-4" /> Gerar acesso</Button></form></CardContent></Card>{credential ? <Alert variant="warning"><AlertTitle>Acesso exibido uma unica vez</AlertTitle><AlertDescription>{credential.warning}</AlertDescription><div className="mt-3 flex gap-2"><code className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-black/25 p-2 text-xs text-amber-100">{credential.token}</code><Button type="button" size="icon" variant="secondary" aria-label="Copiar acesso" onClick={() => void copyCredential()}><Copy className="h-4 w-4" /></Button></div><Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => setCredential(null)}>Ocultar acesso</Button></Alert> : null}</div> : null}
      <Card className={!canManage ? 'xl:col-span-2' : undefined}><CardHeader><CardTitle>Pontos e computadores</CardTitle><CardDescription>Conectado significa que o computador respondeu recentemente.</CardDescription></CardHeader><CardContent className="space-y-3">{agents.length ? agents.map((agent) => <div key={agent.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2">{agent.online ? <Wifi className="h-4 w-4 text-emerald-400" /> : <WifiOff className="h-4 w-4 text-slate-500" />}<p className="font-semibold text-white">{agent.name}</p><Badge variant={agent.online ? 'success' : agent.revokedAt ? 'danger' : 'default'}>{agent.revokedAt ? 'Desativado' : agent.online ? 'Conectado' : 'Desconectado'}</Badge></div><p className="mt-1 text-sm text-slate-400">{agent.deviceName} · versao {agent.version ?? 'nao informada'}</p><p className="mt-1 text-xs text-slate-500">Ultima conexao: {agent.lastSeenAt ? formatDate(agent.lastSeenAt) : 'nunca'}</p><p className="mt-2 text-xs text-slate-400">Impressoras: {agent.printers.map((printer) => printer.name).join(', ') || 'nenhuma'}</p></div>{canManage && !agent.revokedAt ? <div className="flex gap-2"><Button type="button" size="sm" variant="secondary" onClick={() => void rotateToken(agent.id)} disabled={rotate.isPending}>Trocar acesso</Button><Button type="button" size="sm" variant="outline" disabled={revoke.isPending} onClick={() => { if (window.confirm('Desativar este computador agora?')) void revoke.mutateAsync(agent.id).catch((error) => toast.danger('Falha ao desativar computador', errorMessage(error))) }}>Desativar</Button></div> : null}</div></div>) : <EmptyState icon={<Server className="h-5 w-5" />} text="Nenhum computador de impressao cadastrado." />}</CardContent></Card>
    </div>
  )
}

function Toggle({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm font-medium text-slate-200"><span>{label}</span><Switch checked={checked} disabled={disabled} onCheckedChange={onChange} /></label>
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block space-y-1.5"><span className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">{label}</span>{children}</label>
}

function EmptyState({ icon, text }: { icon: ReactNode; text: string }) {
  return <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-white/10 px-4 py-8 text-sm text-slate-500">{icon}{text}</div>
}

function statusMeta(status: PrintJobStatus): { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'analysis' } {
  switch (status) {
    case 'PRINTED': return { label: 'Impresso', variant: 'success' }
    case 'FAILED': return { label: 'Falhou', variant: 'danger' }
    case 'PRINT_RESULT_UNKNOWN': return { label: 'Precisa de revisao', variant: 'warning' }
    case 'CANCELLED': return { label: 'Cancelado', variant: 'default' }
    case 'PRINTING': return { label: 'Imprimindo', variant: 'analysis' }
    case 'CLAIMED': return { label: 'Reservado', variant: 'analysis' }
    case 'RETRY_WAIT': return { label: 'Nova tentativa', variant: 'warning' }
    default: return { label: 'Pendente', variant: 'default' }
  }
}

const printTypeLabels: Record<PrintJobType, string> = {
  ORDER_INITIAL: 'Pedido recebido',
  ORDER_ADDITION: 'Item adicionado',
  ORDER_REMOVAL: 'Item removido',
  ORDER_CORRECTION: 'Pedido corrigido',
  ORDER_CANCELLATION: 'Pedido cancelado',
  CASHIER_RECEIPT: 'Via do caixa',
  DISPATCH_ORDER: 'Despacho',
  CUSTOMER_RECEIPT: 'Via do cliente',
  TEST_PAGE: 'Pagina de teste',
  REPRINT: 'Reimpressao',
}

function printTypeLabel(type: PrintJobType) {
  return printTypeLabels[type]
}

function printErrorMessage(job: PrintJob) {
  if (job.lastErrorCode === 'PRINTER_OFFLINE') {
    return 'Impressora desconectada. Confira o computador e tente novamente.'
  }

  return job.lastErrorMessageSanitized ?? 'Nao foi possivel concluir a impressao.'
}

function connectionLabel(value: PrintConnectionType) {
  return value === 'NETWORK_TCP' ? 'TCP de rede' : value === 'WINDOWS_PRINTER' ? 'Windows' : 'Arquivo / dry-run'
}

function shortId(value: string) { return value.replace(/-/g, '').slice(0, 12).toUpperCase() }

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'indisponivel' : date.toLocaleString('pt-BR')
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Erro inesperado ao imprimir.'
}
