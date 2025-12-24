import { useEffect, useState } from "react";
import { AdminDashboardLayout } from "@/components/layout/AdminDashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShoppingBag, AlertCircle } from "lucide-react";
import { useRequireRole } from "@/hooks/useRequireRole";
import { Link } from "wouter";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

interface Order {
  id: string;
  user_id: string;
  retailer_id: string;
  status: string;
  total: number;
  created_at: string;
  updated_at: string;
  customer_name: string;
  customer_email: string;
  retailer_name: string;
  item_count: number;
  items: Array<{
    id: string;
    product_id: string;
    product_name: string;
    quantity: number;
    price: number;
    images: string[];
  }>;
  discount_amount?: number;
  points_redeemed?: number;
  points_earned?: number;
}

export default function AdminOrdersPage() {
  useRequireRole("admin", "/admin");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    fetchOrders();
  }, [filter]);

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/orders${filter !== "all" ? `?status=${filter}` : ""}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to load orders");
      }
      setOrders(data.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { label: "Pending", variant: "outline" },
      processing: { label: "Processing", variant: "default" },
      ready_for_pickup: { label: "Ready for Pickup", variant: "default" },
      picked_up: { label: "Picked Up", variant: "secondary" },
      shipped: { label: "Shipped", variant: "default" },
      delivered: { label: "Delivered", variant: "secondary" },
      cancelled: { label: "Cancelled", variant: "destructive" },
    };
    const config = statusConfig[status] || { label: status, variant: "outline" };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getTotalRevenue = () => {
    return orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  };

  const getOrderCountByStatus = (status: string) => {
    return orders.filter((o) => o.status === status).length;
  };

  if (loading) {
    return (
      <AdminDashboardLayout>
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </AdminDashboardLayout>
    );
  }

  return (
    <AdminDashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Order Management</h1>
          <p className="text-muted-foreground">View and manage all orders across the platform</p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
              <ShoppingBag className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{orders.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <ShoppingBag className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">£{getTotalRevenue().toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <ShoppingBag className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{getOrderCountByStatus("pending")}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Processing</CardTitle>
              <ShoppingBag className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{getOrderCountByStatus("processing")}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            onClick={() => setFilter("all")}
          >
            All Orders
          </Button>
          <Button
            variant={filter === "pending" ? "default" : "outline"}
            onClick={() => setFilter("pending")}
          >
            Pending
          </Button>
          <Button
            variant={filter === "processing" ? "default" : "outline"}
            onClick={() => setFilter("processing")}
          >
            Processing
          </Button>
          <Button
            variant={filter === "delivered" ? "default" : "outline"}
            onClick={() => setFilter("delivered")}
          >
            Delivered
          </Button>
          <Button
            variant={filter === "cancelled" ? "default" : "outline"}
            onClick={() => setFilter("cancelled")}
          >
            Cancelled
          </Button>
        </div>

        {error && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Orders List */}
        {orders.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12 text-muted-foreground">
                <ShoppingBag className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No orders found</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <Card key={order.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        Order #{order.id.substring(0, 8)}
                        {getStatusBadge(order.status)}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {new Date(order.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">£{Number(order.total).toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{order.item_count} items</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-sm font-medium mb-1">Customer</p>
                      <p className="text-sm text-muted-foreground">{order.customer_name}</p>
                      <p className="text-xs text-muted-foreground">{order.customer_email}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-1">Retailer</p>
                      <p className="text-sm text-muted-foreground">{order.retailer_name}</p>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t">
                    <Link href={`/admin/orders/${order.id}`}>
                      <Button variant="outline" className="w-full">
                        View Order Details
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminDashboardLayout>
  );
}

