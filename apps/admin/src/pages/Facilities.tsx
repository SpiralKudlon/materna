import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Plus, Edit2 } from "lucide-react"

export function Facilities() {
  const [facilities] = useState([
    { id: "1", name: "Central Hospital", type: "HOSPITAL", latitude: 12.34, longitude: 56.78 },
    { id: "2", name: "North Clinic", type: "HEALTH_CENTER", latitude: 12.50, longitude: 56.90 },
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Facilities</h2>
          <p className="text-sm text-muted-foreground">Manage health facilities and clinics.</p>
        </div>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Add Facility
        </Button>
      </div>
      
      <div className="flex items-center gap-2 max-w-sm">
        <Input placeholder="Search facilities..." className="h-9" />
      </div>

      <div className="border border-border rounded-md bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Coordinates</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {facilities.map((facility) => (
              <TableRow key={facility.id}>
                <TableCell className="font-medium">{facility.name}</TableCell>
                <TableCell>{facility.type}</TableCell>
                <TableCell className="text-muted-foreground font-mono text-xs">
                  {facility.latitude}, {facility.longitude}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
