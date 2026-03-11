import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export function CHVAssignments() {
  const [assignments] = useState([
    { id: "a1", chvName: "Jane Doe", chvId: "c1", activePatients: 48, status: "ACTIVE" },
    { id: "a2", chvName: "John Smith", chvId: "c2", activePatients: 12, status: "ACTIVE" },
    { id: "a3", chvName: "Mary Johnson", chvId: "c3", activePatients: 50, status: "ACTIVE" },
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">CHV Assignments</h2>
          <p className="text-sm text-muted-foreground">Manage Community Health Volunteer patient assignments.</p>
        </div>
      </div>
      
      <div className="flex items-center gap-2 max-w-sm">
        <Input placeholder="Search CHVs..." className="h-9" />
      </div>

      <div className="border border-border rounded-md bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>CHV Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Active Patients</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assignments.map((assignment) => {
              const nearingLimit = assignment.activePatients >= 45
              const atLimit = assignment.activePatients >= 50
              return (
                <TableRow key={assignment.id}>
                  <TableCell className="font-medium">{assignment.chvName}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {assignment.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className={atLimit ? "text-destructive font-semibold" : ""}>
                        {assignment.activePatients} / 50
                      </span>
                      {nearingLimit && !atLimit && (
                        <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800 border-amber-200">
                          Nearing Limit
                        </Badge>
                      )}
                      {atLimit && (
                        <Badge variant="destructive" className="text-xs">
                          Max Capacity
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">Manage</Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
