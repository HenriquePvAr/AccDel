import type { ReactNode } from 'react'

interface PreviewPhoneFrameProps {
  children: ReactNode
}

export function PreviewPhoneFrame({ children }: PreviewPhoneFrameProps) {
  return (
    <div className="mx-auto w-full max-w-[360px] rounded-[40px] border-[10px] border-graphite bg-white shadow-panel">
      <div className="mx-auto mt-3 h-1.5 w-24 rounded-full bg-graphite/20" />
      <div className="min-h-[700px] overflow-hidden rounded-[30px] bg-[#fffdf9]">{children}</div>
    </div>
  )
}
