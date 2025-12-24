import { useEffect, useState } from "react";
import { useRoute, Link } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Package, MapPin, Calendar, CreditCard, Tag, Coins } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

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
  discount_amount?: number;
  points_used?: number;
  points_earned?: number;
  stripe_payment_intent_id?: string;
  platform_commission?: number;
  retailer_amount?: number;
}

export default function OrderDetailPage() {
  const [match, params] = useRoute("/orders/:id");
  const orderId = params?.id;
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!orderId) return;
    loadOrder();
  }, [orderId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "true") {
      toast({
        title: "Payment successful",
        description: "Your order has been confirmed",
      });
      // Reload order to get updated payment status
      if (orderId) {
        loadOrder();
      }
    }
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

  // Calculate subtotal (total + discounts)
  const subtotal = order
    ? Number(order.total) + (Number(order.discount_amount) || 0) + (Number(order.points_used) || 0)
    : 0;

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
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <div className="container mx-auto px-4 py-10">
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <div className="container mx-auto px-4 py-10">
          <div className="text-center py-20">
            <h1 className="text-2xl font-bold mb-4">Order not found</h1>
            <p className="text-muted-foreground mb-4">{error || "The order you're looking for doesn't exist."}</p>
            <Link href="/orders">
              <Button>Back to Orders</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <div className="container mx-auto px-4 py-10">
        <div className="mb-6">
          <Link href="/orders">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Orders
            </Button>
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Order Details</h1>
              <p className="text-muted-foreground">Order #{order.id.slice(0, 8)}</p>
            </div>
            {getStatusBadge(order.status)}
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

            {/* Order Information */}
            <Card>
              <CardHeader>
                <CardTitle>Order Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <Package className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-semibold">Retailer</p>
                    <p className="text-sm text-muted-foreground">{order.retailer_name}</p>
                  </div>
                </div>
                {order.pickup_location && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-semibold">Pickup Location</p>
                      <p className="text-sm text-muted-foreground">{order.pickup_location}</p>
                    </div>
                  </div>
                )}
                {order.pickup_instructions && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-semibold">Pickup Instructions</p>
                      <p className="text-sm text-muted-foreground">{order.pickup_instructions}</p>
                    </div>
                  </div>
                )}
                {order.ready_for_pickup_at && (
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
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
                    <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
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
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-semibold">Order Date</p>
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
                {order.updated_at !== order.created_at && (
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
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
                <span>£{subtotal.toFixed(2)}</span>
              </div>
              {order.discount_amount && order.discount_amount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span className="flex items-center gap-1">
                    <Tag className="h-3 w-3" />
                    Discount
                  </span>
                  <span>-£{Number(order.discount_amount).toFixed(2)}</span>
                </div>
              )}
              {order.points_used && order.points_used > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span className="flex items-center gap-1">
                    <Coins className="h-3 w-3" />
                    Points Redeemed
                  </span>
                  <span>-£{Number(order.points_used).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pickup</span>
                <span>Free</span>
              </div>
              <div className="flex justify-between text-lg font-semibold pt-2 border-t">
                <span>Total</span>
                <span>£{Number(order.total).toFixed(2)}</span>
              </div>
              {order.points_earned && order.points_earned > 0 && (
                <div className="pt-2 border-t">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Coins className="h-4 w-4 text-primary" />
                    <span>You earned £{Number(order.points_earned).toFixed(2)} cashback (1%)</span>
                  </div>
                </div>
              )}
              <div className="pt-4">
                <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                  <CreditCard className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm">Payment Method</p>
                    <p className="text-xs text-muted-foreground">
                      {order.stripe_payment_intent_id
                        ? "Paid via Stripe"
                        : "Pay on pickup"}
                    </p>
                    {order.stripe_payment_intent_id && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Payment ID: {order.stripe_payment_intent_id.slice(0, 20)}...
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

