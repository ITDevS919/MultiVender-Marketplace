import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, AlertCircle, Tag, Coins, CheckCircle2, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

interface CartItem {
  id: string;
  product_id: string;
  quantity: number;
  name: string;
  price: number;
  images: string[];
  stock: number;
  retailer_name: string;
  retailer_id: string;
}

interface OrderGroup {
  retailer_id: string;
  retailer_name: string;
  items: CartItem[];
  subtotal: number;
}

interface UserPoints {
  balance: number;
  totalEarned: number;
  totalRedeemed: number;
}

export default function CheckoutPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userPoints, setUserPoints] = useState<UserPoints | null>(null);
  const [discountCode, setDiscountCode] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<{ code: string; amount: number } | null>(null);
  const [validatingDiscount, setValidatingDiscount] = useState(false);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  const [formData, setFormData] = useState({
    fullName: user?.username || "",
    email: user?.email || "",
    pickupInstructions: "",
  });

  useEffect(() => {
    loadCart();
    if (user) {
      loadUserPoints();
    }
  }, [user]);

  const loadCart = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/cart`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to load cart");
      setItems(data.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadUserPoints = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/user/points`, { credentials: "include" });
      const data = await res.json();
      if (res.ok && data.success) {
        setUserPoints(data.data);
      }
    } catch (err) {
      console.error("Failed to load user points:", err);
    }
  };

  const handleValidateDiscount = async () => {
    if (!discountCode.trim()) {
      toast({
        title: "Error",
        description: "Please enter a discount code",
        variant: "destructive",
      });
      return;
    }

    setValidatingDiscount(true);
    try {
      const total = orderGroups.reduce((sum, group) => sum + group.subtotal, 0);
      const res = await fetch(`${API_BASE_URL}/discount-codes/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code: discountCode.trim(), orderTotal: total }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.data.valid) {
        setAppliedDiscount({
          code: discountCode.trim().toUpperCase(),
          amount: data.data.discount.amount,
        });
        toast({
          title: "Discount applied",
          description: `You saved £${data.data.discount.amount.toFixed(2)}!`,
        });
      } else {
        toast({
          title: "Invalid code",
          description: data.data?.message || "This discount code is not valid",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: "Failed to validate discount code",
        variant: "destructive",
      });
    } finally {
      setValidatingDiscount(false);
    }
  };

  const handleRemoveDiscount = () => {
    setAppliedDiscount(null);
    setDiscountCode("");
  };

  const handleMaxPoints = () => {
    if (userPoints && userPoints.balance > 0) {
      const total = orderGroups.reduce((sum, group) => sum + group.subtotal, 0);
      const discountAmount = appliedDiscount?.amount || 0;
      const maxRedeemable = Math.min(userPoints.balance, total - discountAmount);
      setPointsToRedeem(maxRedeemable);
    }
  };

  // Group items by retailer
  const orderGroups: OrderGroup[] = items.reduce((groups, item) => {
    const retailerId = item.retailer_id;
    const existingGroup = groups.find((g) => g.retailer_id === retailerId);

    if (existingGroup) {
      existingGroup.items.push(item);
      existingGroup.subtotal += item.price * item.quantity;
    } else {
      groups.push({
        retailer_id: retailerId,
        retailer_name: item.retailer_name,
        items: [item],
        subtotal: item.price * item.quantity,
      });
    }

    return groups;
  }, [] as OrderGroup[]);

  const subtotal = orderGroups.reduce((sum, group) => sum + group.subtotal, 0);
  const discountAmount = appliedDiscount?.amount || 0;
  const pointsDiscount = pointsToRedeem || 0;
  const total = Math.max(0, subtotal - discountAmount - pointsDiscount);

  const handlePlaceOrder = async () => {
    if (items.length === 0) {
      setError("Your cart is empty");
      return;
    }

    if (!formData.fullName || !formData.email) {
      setError("Please fill in all required fields");
      return;
    }

    setPlacingOrder(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          pickupInstructions: formData.pickupInstructions || null,
          discountCode: appliedDiscount?.code || null,
          pointsToRedeem: pointsToRedeem > 0 ? pointsToRedeem : null,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to create order");
      }

      // Check if Stripe checkout is required
      if (data.data.checkoutSessions && data.data.checkoutSessions.length > 0) {
        // Redirect to Stripe Checkout
        const checkoutUrl = data.data.checkoutSessions[0].checkoutUrl;
        if (checkoutUrl) {
          window.location.href = checkoutUrl;
          return;
        } else {
          console.error('Checkout session created but URL is missing');
          setError("Payment processing error. Please contact support.");
          setPlacingOrder(false);
          return;
        }
      }

      // No Stripe checkout needed - this shouldn't happen for normal orders
      // Log a warning and show an error
      console.warn('Order created but no checkout session was created. This may indicate the retailer has not set up Stripe Connect.');
      setError("Payment processing is not available for this retailer. Please contact the retailer directly.");
      setPlacingOrder(false);
    } catch (err: any) {
      setError(err.message || "Failed to place order");
      setPlacingOrder(false);
    }
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

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <div className="container mx-auto px-4 py-10">
          <div className="text-center py-20">
            <h1 className="text-3xl font-bold mb-4">Your cart is empty</h1>
            <Button onClick={() => setLocation("/")}>Continue Shopping</Button>
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
          <h1 className="text-3xl font-bold">Checkout</h1>
          <p className="text-muted-foreground">Review your order and complete your purchase.</p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Contact details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Full name *</Label>
                    <Input
                      placeholder="Jane Doe"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email *</Label>
                    <Input
                      type="email"
                      placeholder="jane@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Pickup instructions (optional)</Label>
                  <Input
                    placeholder="Any special instructions for pickup"
                    value={formData.pickupInstructions}
                    onChange={(e) => setFormData({ ...formData, pickupInstructions: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Add any special instructions for when you pick up your order
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Discount Code Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="h-5 w-5" />
                  Discount Code
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {appliedDiscount ? (
                  <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="font-medium text-green-900 dark:text-green-100">
                          Code: {appliedDiscount.code}
                        </p>
                        <p className="text-sm text-green-700 dark:text-green-300">
                          You saved £{appliedDiscount.amount.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={handleRemoveDiscount}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter discount code"
                      value={discountCode}
                      onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                      onKeyPress={(e) => {
                        if (e.key === "Enter") {
                          handleValidateDiscount();
                        }
                      }}
                    />
                    <Button
                      onClick={handleValidateDiscount}
                      disabled={validatingDiscount || !discountCode.trim()}
                    >
                      {validatingDiscount ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Apply"
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Points Redemption Section */}
            {userPoints && userPoints.balance > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Coins className="h-5 w-5" />
                    Redeem Points
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                    <div>
                      <p className="font-medium">Available Points</p>
                      <p className="text-sm text-muted-foreground">
                        £{userPoints.balance.toFixed(2)} available
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-lg">
                      £{userPoints.balance.toFixed(2)}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <Label>Amount to redeem (£)</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max={Math.min(userPoints.balance, subtotal - discountAmount)}
                        value={pointsToRedeem}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value) || 0;
                          const max = Math.min(userPoints.balance, subtotal - discountAmount);
                          setPointsToRedeem(Math.min(value, max));
                        }}
                        placeholder="0.00"
                      />
                      <Button variant="outline" onClick={handleMaxPoints}>
                        Max
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Maximum: £{Math.min(userPoints.balance, subtotal - discountAmount).toFixed(2)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {orderGroups.map((group) => (
                  <div key={group.retailer_id} className="border-b pb-4 last:border-0">
                    <div className="font-semibold mb-2">{group.retailer_name}</div>
                    {group.items.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm text-muted-foreground mb-1">
                        <span>
                          {item.name} × {item.quantity}
                        </span>
                        <span>£{(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-semibold mt-2">
                      <span>Subtotal</span>
                      <span>£{group.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="mt-3 pt-3 border-t text-sm">
                      <div className="font-medium mb-1">Pickup Location:</div>
                      <div className="text-muted-foreground">
                        Pick up at {group.retailer_name} store. Exact address will be provided in your order confirmation.
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Order summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Items ({items.reduce((sum, item) => sum + item.quantity, 0)})</span>
                <span>£{subtotal.toFixed(2)}</span>
              </div>
              {appliedDiscount && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Discount ({appliedDiscount.code})</span>
                  <span>-£{discountAmount.toFixed(2)}</span>
                </div>
              )}
              {pointsToRedeem > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Points redeemed</span>
                  <span>-£{pointsToRedeem.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Pickup</span>
                <span>Free</span>
              </div>
              <div className="flex justify-between text-lg font-semibold pt-2 border-t">
                <span>Total</span>
                <span>£{total.toFixed(2)}</span>
              </div>
              {userPoints && userPoints.balance > 0 && (
                <div className="text-xs text-muted-foreground pt-2 border-t">
                  <p>You'll earn £{(total * 0.01).toFixed(2)} cashback (1%) on this order</p>
                </div>
              )}
              <Button className="w-full" onClick={handlePlaceOrder} disabled={placingOrder}>
                {placingOrder ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Place order"
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

