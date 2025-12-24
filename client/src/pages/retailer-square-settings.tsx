import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, XCircle, Link2, Unlink, TestTube, AlertCircle } from "lucide-react";
import { useRequireRole } from "@/hooks/useRequireRole";
import { useToast } from "@/hooks/use-toast";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

interface SquareStatus {
  connected: boolean;
  syncEnabled: boolean;
  connectedAt: string | null;
  locationId: string | null;
}

export default function RetailerSquareSettingsPage() {
  useRequireRole("retailer", "/login/retailer");
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<SquareStatus | null>(null);
  const [testing, setTesting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [formData, setFormData] = useState({
    accessToken: "",
    locationId: "",
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSquareStatus();
  }, []);

  const loadSquareStatus = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/retailer/square/status`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to load Square status");
      }
      setStatus(data.data);
    } catch (err: any) {
      setError(err.message);
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    if (!status?.connected) {
      toast({
        title: "Not Connected",
        description: "Please connect your Square account first",
        variant: "destructive",
      });
      return;
    }

    setTesting(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/retailer/square/test`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Connection test failed");
      }

      if (data.data.valid) {
        toast({
          title: "Connection Test Successful",
          description: "Your Square account is connected and working correctly",
        });
      } else {
        toast({
          title: "Connection Test Failed",
          description: data.data.message || "Unable to verify Square connection",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      setError(err.message);
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleConnect = async () => {
    if (!formData.accessToken || !formData.locationId) {
      setError("Access token and location ID are required");
      return;
    }

    setConnecting(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/retailer/square/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          accessToken: formData.accessToken,
          locationId: formData.locationId,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to connect Square account");
      }

      toast({
        title: "Square Account Connected",
        description: "Your Square account has been connected successfully",
      });

      // Clear form and reload status
      setFormData({ accessToken: "", locationId: "" });
      await loadSquareStatus();
    } catch (err: any) {
      setError(err.message);
      toast({
        title: "Connection Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect your Square account? This will disable EPOS sync for all your products.")) {
      return;
    }

    setDisconnecting(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/retailer/square/disconnect`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to disconnect Square account");
      }

      toast({
        title: "Square Account Disconnected",
        description: "Your Square account has been disconnected",
      });

      await loadSquareStatus();
    } catch (err: any) {
      setError(err.message);
      toast({
        title: "Disconnect Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setDisconnecting(false);
    }
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Square Integration</h1>
          <p className="text-muted-foreground">
            Connect your Square POS account to enable real-time stock synchronization
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Connection Status */}
        <Card>
          <CardHeader>
            <CardTitle>Connection Status</CardTitle>
            <CardDescription>Current Square account connection status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              {status?.connected ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-semibold">Connected</p>
                    <p className="text-sm text-muted-foreground">
                      {status.locationId && `Location ID: ${status.locationId}`}
                      {status.connectedAt && (
                        <>
                          <br />
                          Connected: {new Date(status.connectedAt).toLocaleDateString()}
                        </>
                      )}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-600" />
                  <div>
                    <p className="font-semibold">Not Connected</p>
                    <p className="text-sm text-muted-foreground">
                      Connect your Square account to enable stock synchronization
                    </p>
                  </div>
                </>
              )}
            </div>

            {status?.connected && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={testing}
                  size="sm"
                >
                  {testing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <TestTube className="mr-2 h-4 w-4" />
                      Test Connection
                    </>
                  )}
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  size="sm"
                >
                  {disconnecting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Disconnecting...
                    </>
                  ) : (
                    <>
                      <Unlink className="mr-2 h-4 w-4" />
                      Disconnect
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Connect Square Account */}
        {!status?.connected && (
          <Card>
            <CardHeader>
              <CardTitle>Connect Square Account</CardTitle>
              <CardDescription>
                Enter your Square access token and location ID to enable stock synchronization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="accessToken">Square Access Token</Label>
                <Input
                  id="accessToken"
                  type="password"
                  placeholder="EAAAxxxxxxxxxxxx"
                  value={formData.accessToken}
                  onChange={(e) => setFormData({ ...formData, accessToken: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Your Square API access token. You can find this in your Square Developer Dashboard.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="locationId">Square Location ID</Label>
                <Input
                  id="locationId"
                  placeholder="LOCATION_ID"
                  value={formData.locationId}
                  onChange={(e) => setFormData({ ...formData, locationId: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  The location ID where your inventory is managed in Square.
                </p>
              </div>

              <Button
                onClick={handleConnect}
                disabled={connecting || !formData.accessToken || !formData.locationId}
                className="w-full"
              >
                {connecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Link2 className="mr-2 h-4 w-4" />
                    Connect Square Account
                  </>
                )}
              </Button>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <strong>Note:</strong> Your access token will be securely stored and used only for
                  inventory synchronization. Make sure you're using a token with the appropriate
                  permissions (inventory read access).
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        )}

        {/* Information Card */}
        <Card>
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              <strong>Real-time Stock Sync:</strong> When enabled, product stock levels will be
              automatically synchronized from your Square POS system on every product view or API call.
            </p>
            <p>
              <strong>Per-Product Control:</strong> You can choose which products sync from Square by
              enabling the "Sync from EPOS" option in the product creation/edit form.
            </p>
            <p>
              <strong>Manual Override:</strong> Products with EPOS sync enabled will use Square stock
              levels. Products without EPOS sync will use manually entered stock levels.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

