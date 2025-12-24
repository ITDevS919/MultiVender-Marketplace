import { useEffect, useState } from "react";
import { Link } from "wouter";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, ShoppingBag, Users, TrendingUp, Loader2, ExternalLink } from "lucide-react";
import { useRequireRole } from "@/hooks/useRequireRole";
import { Badge } from "@/components/ui/badge";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

interface DashboardStats {
  revenue: number;
  totalOrders: number;
  pendingOrders: number;
  totalProducts: number;
  approvedProducts: number;
  lowStockCount: number;
  recentOrders: Array<{
    id: string;
    total: number | string;
    status: string;
    created_at: string;
    customer_name: string;
    item_count: number;
  }>;
  topProducts: Array<{
    id: string;
    name: string;
    images: string[];
    price: number;
    order_count: number;
  }>;
}

export default function RetailerDashboard() {
  useRequireRole("retailer", "/login/retailer");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [retailerId, setRetailerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch retailer profile to get ID
        const profileRes = await fetch(`${API_BASE_URL}/retailer/profile`, {
          credentials: "include",
        });
        const profileData = await profileRes.json();
        if (profileRes.ok && profileData.success) {
          setRetailerId(profileData.data.id);
        }

        // Fetch dashboard stats
        const statsRes = await fetch(`${API_BASE_URL}/retailer/stats`, {
          credentials: "include",
        });
        const statsData = await statsRes.json();
        if (!statsRes.ok || !statsData.success) {
          throw new Error(statsData.message || "Failed to load dashboard stats");
        }
        setStats(statsData.data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      pending: "bg-yellow-600",
      processing: "bg-blue-600",
      shipped: "bg-purple-600",
      delivered: "bg-green-600",
      cancelled: "bg-red-600",
    };
    return (
      <Badge className={statusColors[status] || "bg-gray-600"}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-destructive">{error}</div>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Header with View Profile Button */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Dashboard Overview</h1>
          <p className="text-muted-foreground mt-1">Welcome back! Here's what's happening with your store.</p>
        </div>
        {retailerId && (
          <Link href={`/retailer/${retailerId}`}>
            <Button variant="outline">
              <ExternalLink className="h-4 w-4 mr-2" />
              View Public Profile
            </Button>
          </Link>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£{stats?.revenue.toFixed(2) || "0.00"}</div>
            <p className="text-xs text-muted-foreground">All time revenue</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Orders</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalOrders || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.pendingOrders || 0} pending
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Products</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalProducts || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.approvedProducts || 0} approved
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Products</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.approvedProducts || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.lowStockCount || 0} low stock alert{stats?.lowStockCount !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders Section */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.recentOrders && stats.recentOrders.length > 0 ? (
              <div className="space-y-4">
                {stats.recentOrders.map((order) => (
                  <div key={order.id} className="flex items-center">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                      {order.customer_name?.charAt(0).toUpperCase() || "?"}
                    </div>
                    <div className="ml-4 space-y-1 flex-1">
                      <p className="text-sm font-medium leading-none">
                        Order #{order.id.slice(0, 8)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {order.customer_name || "Customer"} • {order.item_count} item{order.item_count !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="ml-auto flex items-center gap-3">
                      {getStatusBadge(order.status)}
                      <span className="font-medium">
                        £{typeof order.total === "number" 
                          ? order.total.toFixed(2) 
                          : parseFloat(String(order.total)).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <ShoppingBag className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No orders yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Top Performing Products</CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.topProducts && stats.topProducts.length > 0 ? (
              <div className="space-y-6">
                {stats.topProducts.map((product) => (
                  <div key={product.id} className="flex items-center gap-4">
                    <img
                      src={product.images?.[0] || "/opengraph.jpg"}
                      alt={product.name}
                      className="h-12 w-12 rounded-md object-cover"
                    />
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-none line-clamp-1">
                        {product.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {product.order_count} order{product.order_count !== 1 ? "s" : ""} (30 days)
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm">No product sales yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
