import { Link, useLocation } from "wouter";
import { LayoutDashboard, Package, Users, LogOut, Shield, Tag, MessageCircle, ShoppingBag, FolderTree, Star, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ASSETS } from "@/lib/product";
import { useAuth } from "@/contexts/AuthContext";

interface AdminDashboardLayoutProps {
  children: React.ReactNode;
}

export function AdminDashboardLayout({ children }: AdminDashboardLayoutProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const adminName = user?.username ?? "Admin";
  const adminEmail = user?.email ?? "—";

  const navItems = [
    { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/products", label: "Products", icon: Package },
    { href: "/admin/retailers", label: "Retailers", icon: Users },
    { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
    { href: "/admin/categories", label: "Categories", icon: FolderTree },
    { href: "/admin/reviews", label: "Reviews", icon: Star },
    { href: "/admin/settings", label: "Settings", icon: Settings },
    { href: "/admin/messages", label: "Support Messages", icon: MessageCircle },
    { href: "/admin/discount-codes", label: "Discount Codes", icon: Tag },
  ];

  // Get page title based on current route
  const getPageTitle = () => {
    if (location === "/admin/products") return "Product Approvals";
    if (location === "/admin/retailers") return "Retailer Approvals";
    if (location === "/admin/orders") return "Order Management";
    if (location === "/admin/categories") return "Category Management";
    if (location === "/admin/reviews") return "Review Moderation";
    if (location === "/admin/settings") return "Platform Settings";
    if (location === "/admin/messages") return "Support Messages";
    if (location === "/admin/discount-codes") return "Discount Codes";
    return "Admin Dashboard";
  };

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
                   <Shield className="h-5 w-5" />
                </div>
                <div className="overflow-hidden">
                   <p className="font-medium text-sm truncate">{adminName}</p>
                   <p className="text-xs text-muted-foreground truncate">{adminEmail}</p>
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
        </header>
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

