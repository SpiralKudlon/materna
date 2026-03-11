import { useState } from "react"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export function FeatureFlags() {
  const [flags, setFlags] = useState([
    { id: "f1", name: "WhatsApp Notifications", description: "Enable SMS bridge to use WhatsApp fallback.", enabled: true },
    { id: "f2", name: "AI Risk Scoring", description: "Use ML models for risk scores instead of rules.", enabled: false },
    { id: "f3", name: "Offline Sync", description: "Enable local-first sync queue in web client.", enabled: true },
  ])

  const toggleFlag = (id: string) => {
    setFlags(flags.map(f => f.id === id ? { ...f, enabled: !f.enabled } : f))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Feature Flags (Unleash)</h2>
          <p className="text-sm text-muted-foreground">Toggle application features via Unleash integration.</p>
        </div>
      </div>

      <div className="border border-border rounded-md bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Feature Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-[100px] text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {flags.map((flag) => (
              <TableRow key={flag.id}>
                <TableCell className="font-medium">{flag.name}</TableCell>
                <TableCell className="text-muted-foreground">{flag.description}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end items-center">
                    <Switch
                      checked={flag.enabled}
                      onCheckedChange={() => toggleFlag(flag.id)}
                      className={flag.enabled ? "bg-primary" : "bg-muted"}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
