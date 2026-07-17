import { useState, type ReactNode } from 'react'
import { Bot, Brain, LayoutDashboard, MessageSquare, Settings, Smartphone, TestTube } from 'lucide-react'

import { PageShell } from '@/components/shared/PageShell'
import { SectionHeader } from '@/components/shared/SectionHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AiAttendantOverviewTab } from '@/features/ai-attendant/components/AiAttendantOverviewTab'
import { AiConversationsTab } from '@/features/ai-attendant/components/AiConversationsTab'
import { AiDashboardTab } from '@/features/ai-attendant/components/AiDashboardTab'
import { AiKnowledgeTab } from '@/features/ai-attendant/components/AiKnowledgeTab'
import { AiSettingsTab } from '@/features/ai-attendant/components/AiSettingsTab'
import { AiTestTab } from '@/features/ai-attendant/components/AiTestTab'
import { AiWhatsappTab } from '@/features/ai-attendant/components/AiWhatsappTab'

export type AiAttendantTabValue =
  | 'overview'
  | 'dashboard'
  | 'whatsapp'
  | 'knowledge'
  | 'conversations'
  | 'settings'
  | 'test'

interface AiAttendantPageTab {
  value: AiAttendantTabValue
  label: string
  icon: ReactNode
}

const tabs: AiAttendantPageTab[] = [
  { value: 'conversations', label: 'Conversas', icon: <MessageSquare className="h-4 w-4" /> },
  { value: 'overview', label: 'Visao geral', icon: <Bot className="h-4 w-4" /> },
  { value: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
  { value: 'whatsapp', label: 'WhatsApp', icon: <Smartphone className="h-4 w-4" /> },
  { value: 'knowledge', label: 'Base', icon: <Brain className="h-4 w-4" /> },
  { value: 'settings', label: 'Ajustes', icon: <Settings className="h-4 w-4" /> },
  { value: 'test', label: 'Testar IA', icon: <TestTube className="h-4 w-4" /> },
]

const dailyTabs = tabs.filter((tab) => ['conversations', 'overview', 'dashboard'].includes(tab.value))
const configurationTabs = tabs.filter((tab) => ['whatsapp', 'knowledge', 'settings', 'test'].includes(tab.value))

function isAiAttendantTabValue(value: string): value is AiAttendantTabValue {
  return tabs.some((tab) => tab.value === value)
}

export function AiAttendantPage() {
  const [activeTab, setActiveTab] = useState<AiAttendantTabValue>('conversations')

  return (
    <PageShell>
      <SectionHeader
        eyebrow="Atendimento"
        title="Central de conversas"
        description="Acompanhe clientes, assuma conversas e consulte o pedido sem sair da tela."
      />

      <Card>
        <CardContent className="p-0">
          <Tabs
            value={activeTab}
            onValueChange={(value) => {
              if (isAiAttendantTabValue(value)) {
                setActiveTab(value)
              }
            }}
          >
            <div className="sticky top-14 z-20 flex flex-col gap-2 border-b border-border bg-white p-2 sm:top-16 lg:flex-row lg:items-center">
              <TabsList aria-label="Trabalho diario do atendimento" className="min-w-0 flex-1">
                {dailyTabs.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value} className="min-h-11 flex-1">
                    {tab.icon}
                    <span>{tab.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
              <label className="flex min-h-11 items-center gap-2 rounded-lg border border-border bg-white px-3 text-sm font-semibold text-muted-foreground lg:w-[230px]">
                <Settings className="h-4 w-4 shrink-0" />
                <span className="sr-only">Configurar atendimento</span>
                <select
                  aria-label="Configurar atendimento"
                  value={configurationTabs.some((tab) => tab.value === activeTab) ? activeTab : ''}
                  onChange={(event) => {
                    if (isAiAttendantTabValue(event.target.value)) {
                      setActiveTab(event.target.value)
                    }
                  }}
                  className="h-10 min-w-0 flex-1 bg-transparent text-foreground outline-none"
                >
                  <option value="">Configurar atendimento</option>
                  {configurationTabs.map((tab) => (
                    <option key={tab.value} value={tab.value}>{tab.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="p-3 sm:p-4">
              <TabsContent value="overview">
                <AiAttendantOverviewTab onNavigate={setActiveTab} />
              </TabsContent>
              <TabsContent value="dashboard">
                <AiDashboardTab />
              </TabsContent>
              <TabsContent value="whatsapp">
                <AiWhatsappTab onOpenConversations={() => setActiveTab('conversations')} />
              </TabsContent>
              <TabsContent value="knowledge">
                <AiKnowledgeTab />
              </TabsContent>
              <TabsContent value="conversations">
                <AiConversationsTab />
              </TabsContent>
              <TabsContent value="settings">
                <AiSettingsTab />
              </TabsContent>
              <TabsContent value="test">
                <AiTestTab />
              </TabsContent>
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </PageShell>
  )
}
