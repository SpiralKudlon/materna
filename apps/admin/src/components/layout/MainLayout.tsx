import { Outlet } from "react-router-dom"
import { Sidebar } from "./Sidebar"

export function MainLayout() {
  return (
    <div className="flex h-screen w-full bg-background overflow-hidden font-sans text-foreground">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <header className="h-14 border-b border-border bg-card px-6 flex items-center justify-between">
          <h1 className="text-sm font-semibold">Maternal-AI Admin</h1>
          <div className="text-sm text-muted-foreground">Admin User</div>
        </header>
        <main className="flex-1 overflow-y-auto p-6 md:p-8 max-w-[1200px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
