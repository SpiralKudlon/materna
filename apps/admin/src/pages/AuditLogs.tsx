import React, { useState } from "react"

import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ChevronDown, ChevronRight } from "lucide-react"

export function AuditLogs() {
  const [logs] = useState([
    {
      id: "log1",
      action: "UPDATE",
      resourceType: "patient",
      occurredAt: "2026-03-11T09:00:00Z",
      userId: "user_alpha",
      oldValues: { status: "ACTIVE", risk_tier: "LOW" },
      newValues: { status: "ACTIVE", risk_tier: "HIGH" }
    },
    {
      id: "log2",
      action: "INSERT",
      resourceType: "anc_visit",
      occurredAt: "2026-03-11T08:45:00Z",
      userId: "user_beta",
      oldValues: null,
      newValues: { id: "visit_123", bp_systolic: 120, bp_diastolic: 80 }
    }
  ])

  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const toggleRow = (id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Audit Logs</h2>
          <p className="text-sm text-muted-foreground">View immutable global audit events.</p>
        </div>
      </div>
      
      <div className="flex items-center gap-2 max-w-sm">
        <Input placeholder="Search logs by user or resource..." className="h-9" />
      </div>

      <div className="border border-border rounded-md bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]"></TableHead>
              <TableHead>Timestamp</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Resource</TableHead>
              <TableHead>User ID</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <React.Fragment key={log.id}>
                <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => toggleRow(log.id)}>
                  <TableCell>
                    {expanded[log.id] ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{log.occurredAt}</TableCell>
                  <TableCell>
                    <span className="font-semibold text-xs tracking-wider">
                      {log.action}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{log.resourceType}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{log.userId}</TableCell>
                </TableRow>
                {expanded[log.id] && (
                  <TableRow className="bg-muted/20">
                    <TableCell colSpan={5} className="p-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <span className="text-xs font-semibold text-muted-foreground uppercase">Old Values</span>
                          <pre className="p-3 bg-muted rounded-md text-xs font-mono overflow-auto border border-border">
                            {JSON.stringify(log.oldValues || {}, null, 2)}
                          </pre>
                        </div>
                        <div className="space-y-2">
                          <span className="text-xs font-semibold text-muted-foreground uppercase">New Values</span>
                          <pre className="p-3 bg-muted rounded-md text-xs font-mono overflow-auto border border-border">
                            {JSON.stringify(log.newValues || {}, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
