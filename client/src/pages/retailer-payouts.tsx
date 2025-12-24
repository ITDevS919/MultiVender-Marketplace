import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useRequireRole } from "@/hooks/useRequireRole";
import { DollarSign, Wallet, TrendingUp, Loader2, Plus, CheckCircle2, XCircle, Clock, CreditCard, ExternalLink, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Alert,AlertDescription } from "@/components/ui/alert";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const currencyRates: Record<string, number> = {
  GBP: 1,
  USD: Number(import.meta.env.VITE_FX_USD_TO_GBP || 0.79),
  EUR: Number(import.meta.env.VITE_FX_EUR_TO_GBP || 0.86),
};

interface Earnings {
  totalRevenue: number;
  totalPayouts: number;
  pendingPayouts: number;
  availableBalance: number;
}

interface Payout {
  id: string;
  amount: number;
  status: string;
  payout_method: string;
  currency?: string;
  transaction_id?: string;
  notes?: string;
  created_at: string;
  processed_at?: string;
  completed_at?: string;
}

interface PayoutSettings {
  id: string;
  retailerId: string;
  payoutMethod: string;
  isVerified: boolean;
  accountDetails?: { last4?: string };
}

interface StripeAccountStatus {
  id: string;
  retailer_id: string;
  stripe_account_id: string;
  onboarding_completed: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted?: boolean;
}

export default function RetailerPayoutsPage() {
  useRequireRole("retailer", "/login/retailer");
  const { toast } = useToast();
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [settings, setSettings] = useState<PayoutSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    payoutMethod: "bank" as "bank" | "paypal" | "stripe",
    accountDetails: {} as Record<string, any>,
  });
  const [requestForm, setRequestForm] = useState({ amount: "", notes: "", currency: "GBP" });
  const [stripeStatus, setStripeStatus] = useState<StripeAccountStatus | null>(null);
  const [loadingStripe, setLoadingStripe] = useState(false);

  useEffect(() => {
    fetchData();
    fetchStripeStatus();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchEarnings(), fetchPayouts(), fetchSettings()]);
    } finally {
      setLoading(false);
    }
  };

  const fetchEarnings = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/retailer/earnings`, {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEarnings(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch earnings:", err);
    }
  };

  const fetchPayouts = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/retailer/payouts`, {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // Ensure amount is always a number
        setPayouts(
          data.data.map((payout: any) => ({
            ...payout,
            currency: payout.currency || "GBP",
            amount: typeof payout.amount === 'string' 
              ? parseFloat(payout.amount) 
              : (typeof payout.amount === 'number' ? payout.amount : 0),
          }))
        );
      }
    } catch (err) {
      console.error("Failed to fetch payouts:", err);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/retailer/payout-settings`, {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSettings(data.data);
        if (data.data) {
          setSettingsForm({
            payoutMethod: data.data.payoutMethod,
            accountDetails: data.data.accountDetails || {},
          });
        }
      }
    } catch (err) {
      console.error("Failed to fetch settings:", err);
    }
  };

  const fetchStripeStatus = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/retailer/stripe/status`, {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStripeStatus(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch Stripe status:", err);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch(`${API_BASE_URL}/retailer/payout-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(settingsForm),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast({
          title: "Settings saved",
          description: "Payout settings have been saved successfully",
        });
        setIsSettingsDialogOpen(false);
        fetchSettings();
      } else {
        throw new Error(data.message || "Failed to save settings");
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const amount = parseFloat(requestForm.amount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error("Please enter a valid amount");
      }

      const res = await fetch(`${API_BASE_URL}/retailer/payouts/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          amount,
          currency: requestForm.currency,
          notes: requestForm.notes || null,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast({
          title: "Payout requested",
          description: "Your payout request has been submitted",
        });
        setIsRequestDialogOpen(false);
        setRequestForm({ amount: "", notes: "", currency: requestForm.currency });
        fetchData();
      } else {
        throw new Error(data.message || "Failed to request payout");
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to request payout",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleConnectStripe = async () => {
    setLoadingStripe(true);
    try {
      // Get OAuth link (replaces onboarding link)
      const linkRes = await fetch(`${API_BASE_URL}/retailer/stripe/onboarding-link`, {
        credentials: "include",
      });
      const linkData = await linkRes.json();

      if (linkRes.ok && linkData.success) {
        if (linkData.data.url) {
          window.location.href = linkData.data.url;
        } else {
          toast({
            title: "Stripe already connected",
            description: linkData.data.message || "Your Stripe account is already linked.",
          });
        }
      } else {
        throw new Error(linkData.message || "Failed to get Stripe OAuth link");
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to connect Stripe",
        variant: "destructive",
      });
    } finally {
      setLoadingStripe(false);
    }
  };

  const currencySymbol = (code?: string) => {
    switch ((code || "GBP").toUpperCase()) {
      case "USD":
        return "$";
      case "EUR":
        return "€";
      case "GBP":
      default:
        return "£";
    }
  };

  const currencyRate = (code?: string) => {
    const key = (code || "GBP").toUpperCase();
    return currencyRates[key] || 1;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      pending: { variant: "secondary", icon: Clock, label: "Pending" },
      processing: { variant: "default", icon: Loader2, label: "Processing" },
      completed: { variant: "default", icon: CheckCircle2, label: "Completed" },
      failed: { variant: "destructive", icon: XCircle, label: "Failed" },
    };

    const config = variants[status] || variants.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Earnings Summary */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                £{earnings?.totalRevenue.toFixed(2) || "0.00"}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Available Balance</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                £{earnings?.availableBalance.toFixed(2) || "0.00"}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Payouts</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                £{earnings?.totalPayouts.toFixed(2) || "0.00"}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Payouts</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                £{earnings?.pendingPayouts.toFixed(2) || "0.00"}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Wallet className="h-4 w-4 mr-2" />
                {settings ? "Update Payout Settings" : "Configure Payout Settings"}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Payout Settings</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSaveSettings} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="payoutMethod">Payout Method *</Label>
                  <Select
                    value={settingsForm.payoutMethod}
                    onValueChange={(value: any) =>
                      setSettingsForm({ ...settingsForm, payoutMethod: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank">Bank Transfer</SelectItem>
                      <SelectItem value="paypal">PayPal</SelectItem>
                      <SelectItem value="stripe">Stripe</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {settingsForm.payoutMethod === "bank" && (
                  <div className="space-y-2">
                    <Label htmlFor="accountNumber">Account Number</Label>
                    <Input
                      id="accountNumber"
                      type="text"
                      value={settingsForm.accountDetails.accountNumber || ""}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          accountDetails: {
                            ...settingsForm.accountDetails,
                            accountNumber: e.target.value,
                          },
                        })
                      }
                    />
                    <Label htmlFor="sortCode">Sort Code</Label>
                    <Input
                      id="sortCode"
                      type="text"
                      value={settingsForm.accountDetails.sortCode || ""}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          accountDetails: {
                            ...settingsForm.accountDetails,
                            sortCode: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                )}

                {settingsForm.payoutMethod === "paypal" && (
                  <div className="space-y-2">
                    <Label htmlFor="paypalEmail">PayPal Email</Label>
                    <Input
                      id="paypalEmail"
                      type="email"
                      value={settingsForm.accountDetails.email || ""}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          accountDetails: {
                            ...settingsForm.accountDetails,
                            email: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsSettingsDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Settings"
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>
            <DialogTrigger asChild>
              <Button disabled={!settings || earnings?.availableBalance === 0}>
                <Plus className="h-4 w-4 mr-2" />
                Request Payout
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Request Payout</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleRequestPayout} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency *</Label>
                  <Select
                    value={requestForm.currency}
                    onValueChange={(value) => setRequestForm({ ...requestForm, currency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GBP">GBP (£)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount *</Label>
                  {(() => {
                    const rate = currencyRate(requestForm.currency);
                    const availableBase = earnings?.availableBalance || 0;
                    const availableInSelected = rate > 0 ? availableBase / rate : 0;
                    return (
                      <>
                        <Input
                          id="amount"
                          type="number"
                          step="0.01"
                          min="0.01"
                          max={availableInSelected || undefined}
                          value={requestForm.amount}
                          onChange={(e) => setRequestForm({ ...requestForm, amount: e.target.value })}
                          placeholder={`Max: ${currencySymbol(requestForm.currency)}${availableInSelected.toFixed(2)}`}
                          required
                        />
                        <p className="text-xs text-muted-foreground">
                          Available: {currencySymbol(requestForm.currency)}
                          {availableInSelected.toFixed(2)} (converted from base balance)
                        </p>
                      </>
                    );
                  })()}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Textarea
                    id="notes"
                    value={requestForm.notes}
                    onChange={(e) => setRequestForm({ ...requestForm, notes: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsRequestDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      "Request Payout"
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stripe Connect Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Stripe Connect
            </CardTitle>
            <CardDescription>
              Connect your Stripe account to receive automatic payouts from orders
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stripeStatus ? (
              <div className="space-y-4">
                {stripeStatus.charges_enabled && stripeStatus.payouts_enabled ? (
                  <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800 dark:text-green-200">
                      Your Stripe account is connected and ready to receive payments.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-800 dark:text-amber-200">
                      Complete your Stripe onboarding to enable payments.
                    </AlertDescription>
                  </Alert>
                )}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Account Status</p>
                    <p className="font-medium">
                      {stripeStatus.charges_enabled && stripeStatus.payouts_enabled
                        ? "Active"
                        : "Pending"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Charges Enabled</p>
                    <Badge variant={stripeStatus.charges_enabled ? "default" : "secondary"}>
                      {stripeStatus.charges_enabled ? "Yes" : "No"}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Payouts Enabled</p>
                    <Badge variant={stripeStatus.payouts_enabled ? "default" : "secondary"}>
                      {stripeStatus.payouts_enabled ? "Yes" : "No"}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Onboarding</p>
                    <Badge variant={stripeStatus.details_submitted ? "default" : "secondary"}>
                      {stripeStatus.details_submitted ? "Complete" : "Incomplete"}
                    </Badge>
                  </div>
                </div>
                {(!stripeStatus.charges_enabled || !stripeStatus.payouts_enabled || !stripeStatus.details_submitted) && (
                  <Button onClick={handleConnectStripe} disabled={loadingStripe}>
                    {loadingStripe ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        {stripeStatus.charges_enabled ? "Complete Additional Verification" : "Complete Stripe Onboarding"}
                      </>
                    )}
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Connect your Stripe account to receive automatic payouts. You'll be redirected to Stripe to complete the setup.
                </p>
                <Button onClick={handleConnectStripe} disabled={loadingStripe}>
                  {loadingStripe ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <CreditCard className="mr-2 h-4 w-4" />
                      Connect Stripe Account
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payout History */}
        <Card>
          <CardHeader>
            <CardTitle>Payout History</CardTitle>
            <CardDescription>View your payout requests and transactions</CardDescription>
          </CardHeader>
          <CardContent>
            {payouts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No payout history yet
              </div>
            ) : (
              <div className="space-y-4">
                {payouts.map((payout) => (
                  <div
                    key={payout.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">
                          {currencySymbol(payout.currency)}
                          {Number(payout.amount).toFixed(2)}
                        </span>
                        {getStatusBadge(payout.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {payout.payout_method} • {new Date(payout.created_at).toLocaleDateString()}
                      </p>
                      {payout.notes && (
                        <p className="text-sm text-muted-foreground mt-1">{payout.notes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
