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
  { value: 'overview', label: 'Visao geral', icon: <Bot className="h-4 w-4" /> },
  { value: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
  { value: 'whatsapp', label: 'WhatsApp', icon: <Smartphone className="h-4 w-4" /> },
  { value: 'knowledge', label: 'Base', icon: <Brain className="h-4 w-4" /> },
  { value: 'conversations', label: 'Conversas', icon: <MessageSquare className="h-4 w-4" /> },
  { value: 'settings', label: 'Ajustes', icon: <Settings className="h-4 w-4" /> },
  { value: 'test', label: 'Testar IA', icon: <TestTube className="h-4 w-4" /> },
]

function isAiAttendantTabValue(value: string): value is AiAttendantTabValue {
  return tabs.some((tab) => tab.value === value)
}

export function AiAttendantPage() {
  const [activeTab, setActiveTab] = useState<AiAttendantTabValue>('overview')

  return (
    <PageShell>
      <SectionHeader
        eyebrow="WhatsApp + IA"
        title="Atendente IA"
        description="Configure o atendimento automatizado com contexto real da loja, controle humano e integracoes explicitas."
      />

      <Card className="text-slate-100">
        <CardContent className="p-0">
          <Tabs
            value={activeTab}
            onValueChange={(value) => {
              if (isAiAttendantTabValue(value)) {
                setActiveTab(value)
              }
            }}
          >
            <div className="border-b border-white/10 p-3">
              <TabsList aria-label="Secoes do Atendente IA" className="w-full">
                {tabs.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value} className="flex-1">
                    {tab.icon}
                    <span className="hidden sm:inline">{tab.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <div className="p-4 sm:p-6">
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
