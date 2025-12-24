import { useEffect, useState } from "react";
import { useRoute, Link } from "wouter";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ArrowLeft, Package, Calendar, User, Mail, Phone } from "lucide-react";
import { useRequireRole } from "@/hooks/useRequireRole";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
  images: string[];
}

interface Order {
  id: string;
  total: number;
  status: string;
  created_at: string;
  updated_at: string;
  retailer_name: string;
  customer_name: string;
  customer_email: string;
  items: OrderItem[];
  pickup_location?: string;
  pickup_instructions?: string;
  ready_for_pickup_at?: string;
  picked_up_at?: string;
}

export default function RetailerOrderDetailPage() {
  const [match, params] = useRoute("/retailer/orders/:id");
  const orderId = params?.id;
  useRequireRole("retailer", "/login/retailer");
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    if (!orderId) return;
    loadOrder();
  }, [orderId]);

  const loadOrder = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/orders/${orderId}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to load order");
      }
      setOrder(data.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus: string) => {
    setUpdatingStatus(true);
    try {
      const res = await fetch(`${API_BASE_URL}/orders/${orderId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to update order status");
      }

      // Reload order
      loadOrder();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      pending: { variant: "outline", label: "Pending" },
      processing: { variant: "default", label: "Processing" },
      shipped: { variant: "default", label: "Shipped" },
      delivered: { variant: "default", label: "Delivered" },
      ready_for_pickup: { variant: "default", label: "Ready for Pickup" },
      picked_up: { variant: "default", label: "Picked Up" },
      cancelled: { variant: "destructive", label: "Cancelled" },
    };
    const config = variants[status] || variants.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
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

  if (error || !order) {
    return (
      <DashboardLayout>
        <div className="text-center py-20">
          <h1 className="text-2xl font-bold mb-4">Order not found</h1>
          <p className="text-muted-foreground mb-4">{error || "The order you're looking for doesn't exist."}</p>
          <Link href="/retailer/orders">
            <Button>Back to Orders</Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Link href="/retailer/orders">
              <Button variant="ghost" className="mb-2">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Orders
              </Button>
            </Link>
            <h1 className="text-3xl font-bold">Order Details</h1>
            <p className="text-muted-foreground">Order #{order.id.slice(0, 8)}</p>
          </div>
          <div className="flex items-center gap-3">
            {getStatusBadge(order.status)}
            <Select
              value={order.status}
              onValueChange={handleStatusUpdate}
              disabled={updatingStatus}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="ready_for_pickup">Ready for Pickup</SelectItem>
                <SelectItem value="picked_up">Picked Up</SelectItem>
                {/* <SelectItem value="shipped">Shipped</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem> */}
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            {updatingStatus && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {/* Order Items */}
            <Card>
              <CardHeader>
                <CardTitle>Order Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex gap-4 pb-4 border-b last:border-0">
                      <img
                        src={item.images?.[0] || "/opengraph.jpg"}
                        alt={item.product_name}
                        className="h-20 w-20 rounded-lg object-cover"
                      />
                      <div className="flex-1">
                        <h3 className="font-semibold">{item.product_name}</h3>
                        <p className="text-sm text-muted-foreground">Quantity: {item.quantity}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          £{Number(item.price).toFixed(2)} each
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">
                          £{(Number(item.price) * item.quantity).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Customer Information */}
            <Card>
              <CardHeader>
                <CardTitle>Customer Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-semibold">Name</p>
                    <p className="text-sm text-muted-foreground">{order.customer_name}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-semibold">Email</p>
                    <p className="text-sm text-muted-foreground">{order.customer_email}</p>
                  </div>
                </div>
                {order.pickup_location && (
                  <div className="flex items-start gap-3">
                    <Package className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-semibold">Pickup Location</p>
                      <p className="text-sm text-muted-foreground">{order.pickup_location}</p>
                    </div>
                  </div>
                )}
                {order.pickup_instructions && (
                  <div className="flex items-start gap-3">
                    <Package className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-semibold">Pickup Instructions</p>
                      <p className="text-sm text-muted-foreground">{order.pickup_instructions}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Order Timeline */}
            <Card>
              <CardHeader>
                <CardTitle>Order Timeline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-semibold">Order Placed</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(order.created_at).toLocaleDateString("en-GB", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
                {order.ready_for_pickup_at && (
                  <div className="flex items-start gap-3">
                    <Package className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-semibold">Ready for Pickup</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(order.ready_for_pickup_at).toLocaleDateString("en-GB", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                )}
                {order.picked_up_at && (
                  <div className="flex items-start gap-3">
                    <Package className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-semibold">Picked Up</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(order.picked_up_at).toLocaleDateString("en-GB", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                )}
                {order.updated_at !== order.created_at && !order.ready_for_pickup_at && !order.picked_up_at && (
                  <div className="flex items-start gap-3">
                    <Package className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-semibold">Last Updated</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(order.updated_at).toLocaleDateString("en-GB", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Order Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>£{Number(order.total).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pickup</span>
                <span>Free</span>
              </div>
              <div className="flex justify-between text-lg font-semibold pt-2 border-t">
                <span>Total</span>
                <span>£{Number(order.total).toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

