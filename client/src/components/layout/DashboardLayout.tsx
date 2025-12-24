import { Link, useLocation } from "wouter";
import { LayoutDashboard, Package, ShoppingBag, Settings, LogOut, Store, MessageSquare, Wallet, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ASSETS } from "@/lib/product";
import { useAuth } from "@/contexts/AuthContext";
import { CreateProductModal } from "@/components/product/CreateProductModal";
import { useState } from "react";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [createProductOpen, setCreateProductOpen] = useState(false);

  const retailerName = user?.username ?? "Retailer";
  const retailerEmail = user?.email ?? "—";

  const navItems = [
    { href: "/retailer/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/retailer/products", label: "Products", icon: Package },
    { href: "/retailer/orders", label: "Orders", icon: ShoppingBag },
    { href: "/retailer/messages", label: "Messages", icon: MessageCircle },
    { href: "/retailer/posts", label: "Posts", icon: MessageSquare },
    { href: "/retailer/payouts", label: "Payouts", icon: Wallet },
    { href: "/retailer/settings", label: "Settings", icon: Settings },
  ];

  // Get page title based on current route
  const getPageTitle = () => {
    if (location === "/retailer/products") return "Products";
    if (location === "/retailer/orders") return "Orders";
    if (location === "/retailer/messages") return "Messages";
    if (location === "/retailer/posts") return "Posts";
    if (location === "/retailer/payouts") return "Payouts";
    if (location === "/retailer/settings") return "Settings";
    return "Dashboard";
  };

  // Show Create Product button only on Products and Dashboard pages
  const showCreateButton = location === "/retailer/dashboard" || location === "/retailer/products";

  return (
    <div className="min-h-screen bg-muted/20 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-background border-r border-border hidden md:flex flex-col fixed h-full">
        <div className="h-16 flex items-center justify-center px-6 border-b border-border">
          <Link href="/" className="flex items-center gap-2">
             <div className="h-10 w-auto overflow-hidden rounded-md">
                <img src={ASSETS.logo} alt="Localito" className="h-full w-full object-cover" />
             </div>
          </Link>
        </div>

        <div className="p-4">
          <div className="mb-6 px-2">
             <div className="flex items-center gap-3 rounded-lg bg-secondary/50 p-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                   <Store className="h-5 w-5" />
                </div>
                <div className="overflow-hidden">
                   <p className="font-medium text-sm truncate">{retailerName}</p>
                   <p className="text-xs text-muted-foreground truncate">{retailerEmail}</p>
                </div>
             </div>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <div className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer",
                    isActive 
                      ? "bg-primary text-primary-foreground" 
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}>
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto p-4 border-t border-border">
           <Button
             variant="ghost"
             className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10"
             onClick={logout}
           >
              <LogOut className="mr-2 h-4 w-4" />
              Log Out
           </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-64">
        <header className="h-16 bg-background border-b border-border px-8 flex items-center justify-between sticky top-0 z-10">
           <h2 className="font-heading font-semibold text-lg">{getPageTitle()}</h2>
           {showCreateButton && (
             <Button size="sm" onClick={() => setCreateProductOpen(true)}>
               Create New Product
             </Button>
           )}
        </header>
        <div className="p-8">
          {children}
        </div>
      </main>

      {/* Create Product Modal */}
      <CreateProductModal
        open={createProductOpen}
        onOpenChange={setCreateProductOpen}
        onSuccess={() => {
          // Refresh the page to show new product
          // If on products page, it will reload and fetch updated products
          if (location === "/retailer/products") {
            window.location.reload();
          } else {
            // If on dashboard, just reload to update stats
            window.location.reload();
          }
        }}
      />
    </div>
  );
}
