import { useEffect, useState } from "react";
import { AdminDashboardLayout } from "@/components/layout/AdminDashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, Users, AlertCircle, MapPin, Phone, Mail } from "lucide-react";
import { useRequireRole } from "@/hooks/useRequireRole";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

interface PendingRetailer {
  id: string;
  business_name: string;
  business_address?: string;
  postcode?: string;
  city?: string;
  phone?: string;
  email: string;
  username: string;
  created_at: string;
}

export default function AdminRetailersPage() {
  useRequireRole("admin", "/admin");
  const [retailers, setRetailers] = useState<PendingRetailer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState<string | null>(null);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [selectedRetailer, setSelectedRetailer] = useState<PendingRetailer | null>(null);

  useEffect(() => {
    loadRetailers();
  }, []);

  const loadRetailers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/retailers/pending`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to load retailers");
      }
      setRetailers(data.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveClick = (retailer: PendingRetailer) => {
    setSelectedRetailer(retailer);
    setApproveDialogOpen(true);
  };

  const handleApproveConfirm = async () => {
    if (!selectedRetailer) return;

    setApproving(selectedRetailer.id);
    try {
      const res = await fetch(`${API_BASE_URL}/retailers/${selectedRetailer.id}/approve`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to approve retailer");
      }

      // Remove retailer from list
      setRetailers((prev) => prev.filter((r) => r.id !== selectedRetailer.id));
      setApproveDialogOpen(false);
      setSelectedRetailer(null);
    } catch (err: any) {
      setError(err.message);
      setApproveDialogOpen(false);
      setSelectedRetailer(null);
    } finally {
      setApproving(null);
    }
  };

  return (
    <AdminDashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Retailer Approvals</h1>
            <p className="text-muted-foreground">Review and approve pending retailer applications</p>
          </div>
        </div>

        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}

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

        {!loading && !error && retailers.length === 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No pending retailers</h3>
                <p className="text-muted-foreground">All retailer applications have been reviewed.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {!loading && !error && retailers.length > 0 && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {retailers.map((retailer) => (
              <Card key={retailer.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{retailer.business_name}</CardTitle>
                      <Badge className="mt-2 bg-yellow-600 hover:bg-yellow-700">Pending</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-4 w-4" />
                        <span>{retailer.email}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>{retailer.username}</span>
                      </div>
                      {retailer.phone && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="h-4 w-4" />
                          <span>{retailer.phone}</span>
                        </div>
                      )}
                      {(retailer.postcode || retailer.city) && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          <span>
                            {[retailer.postcode, retailer.city].filter(Boolean).join(", ")}
                          </span>
                        </div>
                      )}
                      {retailer.business_address && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {retailer.business_address}
                        </div>
                      )}
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => handleApproveClick(retailer)}
                      disabled={approving === retailer.id}
                    >
                      {approving === retailer.id ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Approving...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Approve Retailer
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Approve Confirmation Dialog */}
      <AlertDialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Retailer?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to approve <strong>{selectedRetailer?.business_name}</strong>? This will allow them to start selling on the platform.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!approving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleApproveConfirm}
              disabled={!!approving}
              className="bg-primary"
            >
              {approving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Approving...
                </>
              ) : (
                "Approve"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminDashboardLayout>
  );
}

