"use client"

import * as React from "react"
import { Search, Landmark, Check } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useBankList } from "@/hooks/use-wallet"
import { cn } from "@/lib/utils"

interface Bank {
  code: string
  name: string
}

interface BankPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  value?: string
  onSelect: (bank: Bank) => void
}

export function BankPickerDialog({
  open,
  onOpenChange,
  value,
  onSelect,
}: BankPickerDialogProps) {
  const banks = useBankList()
  const [query, setQuery] = React.useState("")

  const filtered = React.useMemo(() => {
    if (!banks.data) return []
    const q = query.trim().toLowerCase()
    if (!q) return banks.data
    return banks.data.filter((b) => b.name.toLowerCase().includes(q))
  }, [banks.data, query])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Select bank</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-muted" />
          <Input
            autoFocus
            placeholder="Search banks"
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="-mx-1 max-h-72 overflow-y-auto px-1">
          {banks.isPending ? (
            <p className="py-6 text-center text-sm text-text-muted">Loading banks…</p>
          ) : banks.isError ? (
            <p className="py-6 text-center text-sm text-destructive">
              Couldn&apos;t load the bank list. Try again.
            </p>
          ) : filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-muted">No banks match &ldquo;{query}&rdquo;</p>
          ) : (
            <ul className="flex flex-col">
              {filtered.map((bank) => (
                <li key={bank.code}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(bank)
                      onOpenChange(false)
                      setQuery("")
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent",
                      value === bank.code && "bg-accent"
                    )}
                  >
                    <Landmark className="size-4 shrink-0 text-text-muted" />
                    <span className="flex-1 text-foreground">{bank.name}</span>
                    {value === bank.code && (
                      <Check className="size-4 shrink-0 text-primary" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
