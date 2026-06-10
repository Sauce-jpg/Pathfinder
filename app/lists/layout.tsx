// app/lists/layout.tsx
import type { ReactNode } from 'react'

export default function ListsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css"
      />
      {children}
    </>
  )
}
