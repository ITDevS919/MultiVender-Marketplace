import { useEffect, useState, useRef } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings, Store, MapPin, Phone, Mail, Loader2, CheckCircle2, Upload, X, Image as ImageIcon } from "lucide-react";
import { useRequireRole } from "@/hooks/useRequireRole";
import { useAuth } from "@/contexts/AuthContext";
import { Alert, AlertDescription } from "@/components/ui/alert";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export default function RetailerSettingsPage() {
  useRequireRole("retailer", "/login/retailer");
  const { user } = useAuth();
  const bannerFileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingBanner, setSavingBanner] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [bannerSuccess, setBannerSuccess] = useState(false);
  const [formData, setFormData] = useState({
    businessName: "",
    businessAddress: "",
    postcode: "",
    city: "",
    phone: "",
  });
  const [bannerImage, setBannerImage] = useState<string | null>(null);
  const [uploadedBanner, setUploadedBanner] = useState<{
    file: File;
    preview: string;
    dataUrl: string;
  } | null>(null);
  const [retailerId, setRetailerId] = useState<string | null>(null);

  useEffect(() => {
    loadRetailerProfile();
  }, []);

  const loadRetailerProfile = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/retailer/profile`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to load profile");
      }

      const retailer = data.data;
      setRetailerId(retailer.id);
      setFormData({
        businessName: retailer.business_name || "",
        businessAddress: retailer.business_address || "",
        postcode: retailer.postcode || "",
        city: retailer.city || "",
        phone: retailer.phone || "",
      });
      setBannerImage(retailer.banner_image || null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBannerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("Image size must be less than 5MB");
      return;
    }

    setError(null);

    // Create preview and convert to base64
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      setUploadedBanner({
        file,
        preview: URL.createObjectURL(file),
        dataUrl,
      });
    };
    reader.onerror = () => {
      setError("Failed to read image file");
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveBanner = () => {
    if (uploadedBanner?.preview) {
      URL.revokeObjectURL(uploadedBanner.preview);
    }
    setUploadedBanner(null);
    if (bannerFileInputRef.current) {
      bannerFileInputRef.current.value = "";
    }
  };

  const handleBannerSubmit = async () => {
    if (!uploadedBanner) return;

    setSavingBanner(true);
    setError(null);
    setBannerSuccess(false);

    try {
      const res = await fetch(`${API_BASE_URL}/retailer/banner`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          bannerImage: uploadedBanner.dataUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to update banner image");
      }

      setBannerImage(uploadedBanner.dataUrl);
      setBannerSuccess(true);
      setTimeout(() => setBannerSuccess(false), 3000);
      
      // Clean up
      if (uploadedBanner.preview) {
        URL.revokeObjectURL(uploadedBanner.preview);
      }
      setUploadedBanner(null);
      if (bannerFileInputRef.current) {
        bannerFileInputRef.current.value = "";
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingBanner(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSaving(true);

    try {
      const res = await fetch(`${API_BASE_URL}/retailer/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to update settings");
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
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
        {/* Banner Image Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Store Banner Image
            </CardTitle>
            <CardDescription>
              Upload a banner image for your public store profile (recommended: 1200x300px)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {bannerSuccess && (
              <Alert className="mb-4 border-green-500 bg-green-50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  Banner image updated successfully!
                </AlertDescription>
              </Alert>
            )}
            <div className="space-y-4">
              {/* Current Banner Preview */}
              {(bannerImage || uploadedBanner) && (
                <div className="relative w-full h-48 md:h-64 rounded-lg overflow-hidden border">
                  <img
                    src={uploadedBanner?.preview || bannerImage || ""}
                    alt="Banner preview"
                    className="w-full h-full object-cover"
                  />
                  {uploadedBanner && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2"
                      onClick={handleRemoveBanner}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}

              {/* Upload Area */}
              <div className="space-y-2">
                <Input
                  ref={bannerFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleBannerUpload}
                  disabled={savingBanner}
                  className="hidden"
                  id="bannerFile"
                />
                <Label
                  htmlFor="bannerFile"
                  className="cursor-pointer"
                >
                  <div className="flex items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg hover:bg-secondary/50 transition-colors">
                    {uploadedBanner ? (
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">New banner selected</p>
                        <p className="text-xs text-muted-foreground mt-1">Click save to update</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Upload className="h-8 w-8" />
                        <span className="text-sm">
                          {bannerImage ? "Click to change banner image" : "Click to upload banner image"}
                        </span>
                        <span className="text-xs">PNG, JPG up to 5MB</span>
                      </div>
                    )}
                  </div>
                </Label>
              </div>

              {uploadedBanner && (
                <Button
                  type="button"
                  onClick={handleBannerSubmit}
                  disabled={savingBanner}
                >
                  {savingBanner ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Banner Image"
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Business Information Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Business Information
            </CardTitle>
            <CardDescription>
              Update your business details and contact information
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {success && (
              <Alert className="mb-4 border-green-500 bg-green-50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  Settings updated successfully!
                </AlertDescription>
              </Alert>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="businessName">Business Name *</Label>
                <div className="relative">
                  <Store className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="businessName"
                    className="pl-9"
                    value={formData.businessName}
                    onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessAddress">Business Address</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="businessAddress"
                    className="pl-9"
                    value={formData.businessAddress}
                    onChange={(e) => setFormData({ ...formData, businessAddress: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="postcode">Postcode</Label>
                  <Input
                    id="postcode"
                    value={formData.postcode}
                    onChange={(e) => setFormData({ ...formData, postcode: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="phone"
                    className="pl-9"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    className="pl-9"
                    type="email"
                    value={user?.email || ""}
                    disabled
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed from this page
                </p>
              </div>

              <div className="pt-4">
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

