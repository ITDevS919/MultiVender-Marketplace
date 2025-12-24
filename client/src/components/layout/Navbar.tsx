import { Link } from "wouter";
import { Search, ShoppingCart, Menu, User, LogOut, Coins, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ASSETS } from "@/lib/product";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useEffect, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export function Navbar() {
  const { user, logout, isAuthenticated } = useAuth();
  const [userPoints, setUserPoints] = useState<{ balance: number } | null>(null);

  useEffect(() => {
    if (isAuthenticated && user?.role === "customer") {
      fetchUserPoints();
    }
  }, [isAuthenticated, user]);

  const fetchUserPoints = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/user/points`, {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUserPoints(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch user points:", err);
    }
  };

  const retailerTarget = "/login/retailer";

  const handleLogout = async () => {
    await logout();
  };

  const getUserInitials = (username: string) => {
    return username.substring(0, 2).toUpperCase();
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo Area */}
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            <div className="overflow-hidden rounded-lg">
               <img src={ASSETS.logo} alt="Localito Logo" className="h-8 w-auto object-contain" />
            </div>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-6">
          <Link href="/search?category=all" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
            Marketplace
          </Link>
          <Link href={retailerTarget} className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
            For Retailers
          </Link>
          <Link href="/about" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
            Our Story
          </Link>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Link href="/search?category=all">
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary">
            <Search className="h-5 w-5" />
            <span className="sr-only">Search</span>
          </Button>
          </Link>
          
          <Link href="/cart">
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary">
              <ShoppingCart className="h-5 w-5" />
              <span className="sr-only">Cart</span>
            </Button>
          </Link>

          {isAuthenticated && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>{getUserInitials(user.username)}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user.username}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link
                    href={
                      user.role === "admin"
                        ? "/admin/dashboard"
                        : user.role === "retailer"
                        ? "/retailer/dashboard"
                        : "/orders"
                    }
                    className="cursor-pointer"
                  >
                    <User className="mr-2 h-4 w-4" />
                    <span>Dashboard</span>
                  </Link>
                </DropdownMenuItem>
                {isAuthenticated && user?.role === "customer" && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link href="/points" className="flex items-center gap-2">
                        <Coins className="h-4 w-4" />
                        My Points
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/messages" className="flex items-center gap-2">
                        <MessageCircle className="h-4 w-4" />
                        Messages
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
          <div className="hidden sm:flex gap-2 ml-2">
              <Link href="/login/customer">
            <Button variant="ghost" size="sm">Sign In</Button>
              </Link>
              <Link href="/signup/customer">
              <Button size="sm" className="bg-primary hover:bg-primary/90">Join Now</Button>
            </Link>
          </div>
          )}

          {/* Mobile Menu */}
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </nav>
  );
}
