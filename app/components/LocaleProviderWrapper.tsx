'use client'

import { LocaleProvider } from '@/app/lib/i18n'

export function LocaleProviderWrapper({ children }: { children: React.ReactNode }) {
  return <LocaleProvider>{children}</LocaleProvider>
}
