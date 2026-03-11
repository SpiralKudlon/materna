import { NavLink } from "react-router-dom"
import { Building2, Users, FileText, ToggleLeft, UserSquare2 } from "lucide-react"

export function Sidebar() {
  const routes = [
    { name: "Facilities", path: "/facilities", icon: Building2 },
    { name: "Users", path: "/users", icon: Users },
    { name: "CHV Assignments", path: "/assignments", icon: UserSquare2 },
    { name: "Feature Flags", path: "/features", icon: ToggleLeft },
    { name: "Audit Logs", path: "/audit-logs", icon: FileText },
  ]

  return (
    <aside className="w-[240px] border-r border-border bg-card flex py-4 flex-col gap-4 flex-shrink-0 relative">
      <div className="px-4 pb-4">
        <h2 className="text-sm font-medium">Administration</h2>
      </div>
      <nav className="flex flex-col gap-1 px-2">
        {routes.map((route) => {
          const Icon = route.icon
          return (
            <NavLink
              key={route.path}
              to={route.path}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {route.name}
            </NavLink>
          )
        })}
      </nav>
    </aside>
  )
}
