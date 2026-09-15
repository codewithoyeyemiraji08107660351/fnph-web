import { useEffect } from 'react'

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} | FNPH Kaduna Telepsychiatry` : 'FNPH Kaduna Telepsychiatry'
  }, [title])
}
