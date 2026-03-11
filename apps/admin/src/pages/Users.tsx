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

export function Users() {
  const [users, setUsers] = useState([
    { id: "u1", name: "Dr. Smith", email: "smith@example.com", status: "ACTIVE" },
    { id: "u2", name: "Jane Doe (CHV)", email: "jane@example.com", status: "INACTIVE" },
  ])

  const toggleStatus = (id: string) => {
    setUsers(users.map(u => 
      u.id === id ? { ...u, status: u.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" } : u
    ))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Users</h2>
          <p className="text-sm text-muted-foreground">Manage user accounts and deactivation status.</p>
        </div>
      </div>
      
      <div className="flex items-center gap-2 max-w-sm">
        <Input placeholder="Search users by name or email..." className="h-9" />
      </div>

      <div className="border border-border rounded-md bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[150px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell className="text-muted-foreground">{user.email}</TableCell>
                <TableCell>
                  <Badge variant={user.status === "ACTIVE" ? "default" : "secondary"} className="font-mono text-[10px] tracking-wider">
                    {user.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button 
                    variant={user.status === "ACTIVE" ? "destructive" : "outline"}
                    size="sm"
                    onClick={() => toggleStatus(user.id)}
                  >
                    {user.status === "ACTIVE" ? "Deactivate" : "Activate"}
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
