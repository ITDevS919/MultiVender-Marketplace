import { useEffect, useState } from "react";
import { AdminDashboardLayout } from "@/components/layout/AdminDashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useRequireRole } from "@/hooks/useRequireRole";
import { Plus, Loader2, Tag, Trash2, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

interface DiscountCode {
  id: string;
  code: string;
  description?: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  min_purchase_amount: number;
  max_discount_amount?: number;
  usage_limit?: number;
  used_count: number;
  valid_from: string;
  valid_until?: string;
  is_active: boolean;
}

export default function AdminDiscountCodesPage() {
  useRequireRole("admin", "/admin");
  const { toast } = useToast();
  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    code: "",
    description: "",
    discountType: "percentage" as "percentage" | "fixed",
    discountValue: "",
    minPurchaseAmount: "",
    maxDiscountAmount: "",
    usageLimit: "",
    validUntil: "",
  });

  useEffect(() => {
    fetchCodes();
  }, []);

  const fetchCodes = async () => {
    try {
      // Note: You'll need to add GET /admin/discount-codes endpoint
      const res = await fetch(`${API_BASE_URL}/admin/discount-codes`, {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCodes(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch discount codes:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch(`${API_BASE_URL}/admin/discount-codes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          code: formData.code,
          description: formData.description || null,
          discountType: formData.discountType,
          discountValue: parseFloat(formData.discountValue),
          minPurchaseAmount: parseFloat(formData.minPurchaseAmount) || 0,
          maxDiscountAmount: formData.maxDiscountAmount ? parseFloat(formData.maxDiscountAmount) : null,
          usageLimit: formData.usageLimit ? parseInt(formData.usageLimit) : null,
          validUntil: formData.validUntil || null,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast({
          title: "Discount code created",
          description: "The discount code has been created successfully",
        });
        setIsDialogOpen(false);
        resetForm();
        fetchCodes();
      } else {
        throw new Error(data.message || "Failed to create discount code");
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to create discount code",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      code: "",
      description: "",
      discountType: "percentage",
      discountValue: "",
      minPurchaseAmount: "",
      maxDiscountAmount: "",
      usageLimit: "",
      validUntil: "",
    });
  };

  return (
    <AdminDashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Discount Codes</h1>
            <p className="text-muted-foreground">Manage discount codes and promotions</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Discount Code
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Discount Code</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Code *</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="SAVE10"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Optional description"
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="discountType">Discount Type *</Label>
                    <Select
                      value={formData.discountType}
                      onValueChange={(value: "percentage" | "fixed") =>
                        setFormData({ ...formData, discountType: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage</SelectItem>
                        <SelectItem value="fixed">Fixed Amount</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="discountValue">
                      {formData.discountType === "percentage" ? "Percentage (%) *" : "Amount (£) *"}
                    </Label>
                    <Input
                      id="discountValue"
                      type="number"
                      step={formData.discountType === "percentage" ? "1" : "0.01"}
                      min="0"
                      value={formData.discountValue}
                      onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                      placeholder={formData.discountType === "percentage" ? "10" : "5.00"}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="minPurchaseAmount">Min Purchase (£)</Label>
                    <Input
                      id="minPurchaseAmount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.minPurchaseAmount}
                      onChange={(e) => setFormData({ ...formData, minPurchaseAmount: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxDiscountAmount">Max Discount (£)</Label>
                    <Input
                      id="maxDiscountAmount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.maxDiscountAmount}
                      onChange={(e) => setFormData({ ...formData, maxDiscountAmount: e.target.value })}
                      placeholder="Optional"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="usageLimit">Usage Limit</Label>
                    <Input
                      id="usageLimit"
                      type="number"
                      min="1"
                      value={formData.usageLimit}
                      onChange={(e) => setFormData({ ...formData, usageLimit: e.target.value })}
                      placeholder="Unlimited"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="validUntil">Valid Until</Label>
                    <Input
                      id="validUntil"
                      type="datetime-local"
                      value={formData.validUntil}
                      onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsDialogOpen(false);
                      resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create Code"
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : codes.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              No discount codes created yet
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {codes.map((code) => (
              <Card key={code.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Tag className="h-5 w-5" />
                        <span className="text-xl font-bold">{code.code}</span>
                        <Badge variant={code.is_active ? "default" : "secondary"}>
                          {code.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      {code.description && (
                        <p className="text-sm text-muted-foreground mb-2">{code.description}</p>
                      )}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Discount</p>
                          <p className="font-medium">
                            {code.discount_type === "percentage"
                              ? `${code.discount_value}%`
                              : `£${Number(code.discount_value).toFixed(2)}`}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Min Purchase</p>
                          <p className="font-medium">  £{Number(code.min_purchase_amount).toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Usage</p>
                          <p className="font-medium">
                            {code.used_count} / {code.usage_limit || "∞"}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Valid Until</p>
                          <p className="font-medium">
                            {code.valid_until
                              ? new Date(code.valid_until).toLocaleDateString()
                              : "No expiry"}
                          </p>
                        </div>
                      </div>
                    </div>
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
