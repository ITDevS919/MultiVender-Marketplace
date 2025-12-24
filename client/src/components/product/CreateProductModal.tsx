import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Upload, X, Image as ImageIcon } from "lucide-react";
import type { Product } from "@/lib/product";

interface Category {
  id: string;
  name: string;
  description: string | null;
}

interface CreateProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  product?: Product | null; // Optional product for edit mode
}

export function CreateProductModal({
  open,
  onOpenChange,
  onSuccess,
  product,
}: CreateProductModalProps) {
  const isEditMode = !!product;
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    stock: "",
    category: "",
    imageUrl: "",
    syncFromEpos: false,
    squareItemId: "",
  });
  const [squareConnected, setSquareConnected] = useState(false);
  const [squareItems, setSquareItems] = useState<Array<{ id: string; name: string; price?: number }>>([]);
  const [loadingSquareItems, setLoadingSquareItems] = useState(false);
  const [syncingItemDetails, setSyncingItemDetails] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<{
    file: File;
    preview: string;
    dataUrl: string;
  } | null>(null);
  const [imageMethod, setImageMethod] = useState<"upload" | "url">("url");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

  // Fetch categories and check Square connection status
  useEffect(() => {
    if (open) {
      // Fetch categories
      const fetchCategories = async () => {
        setLoadingCategories(true);
        try {
          const res = await fetch(`${API_BASE_URL}/categories`);
          const data = await res.json();
          if (res.ok && data.success) {
            setCategories(data.data || []);
          }
        } catch (err) {
          console.error("Failed to fetch categories:", err);
        } finally {
          setLoadingCategories(false);
        }
      };

      // Check Square connection status
      const checkSquareStatus = async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/retailer/square/status`, {
            credentials: "include",
          });
          const data = await res.json();
          if (res.ok && data.success) {
            setSquareConnected(data.data.connected || false);
          }
        } catch (err) {
          // Silently fail - Square connection check is optional
          setSquareConnected(false);
        }
      };

      fetchCategories();
      checkSquareStatus();
    }
  }, [open]);

  // Populate form when product changes (edit mode)
  useEffect(() => {
    if (product && open) {
      setFormData({
        name: product.name || "",
        description: product.description || "",
        price: product.price?.toString() || "",
        stock: product.stock?.toString() || "",
        category: product.category || "",
        imageUrl: product.image || "",
        syncFromEpos: (product as any).syncFromEpos || false,
        squareItemId: (product as any).squareItemId || "",
      });
      setImageMethod("url");
      setUploadedImage(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } else if (!product && open) {
      // Reset form for create mode
      setFormData({
        name: "",
        description: "",
        price: "",
        stock: "",
        category: "",
        imageUrl: "",
        syncFromEpos: false,
        squareItemId: "",
      });
      setUploadedImage(null);
      setImageMethod("upload");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [product, open]);

  // Fetch Square items when sync is enabled
  useEffect(() => {
    if (open && squareConnected && formData.syncFromEpos && squareItems.length === 0) {
      fetchSquareItems();
    }
  }, [open, squareConnected, formData.syncFromEpos]);

  const fetchSquareItems = async () => {
    setLoadingSquareItems(true);
    try {
      const res = await fetch(`${API_BASE_URL}/retailer/square/items`, {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSquareItems(data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch Square items:", err);
      setError("Failed to load Square items");
    } finally {
      setLoadingSquareItems(false);
    }
  };

  const handleSquareItemSelect = async (itemId: string) => {
    // Find the selected item in the squareItems array to get price immediately
    const selectedItem = squareItems.find(item => item.id === itemId);
    
    // Update formData with squareItemId and price (if available)
    setFormData((prev) => ({
      ...prev,
      squareItemId: itemId,
      price: selectedItem?.price ? selectedItem.price.toString() : prev.price,
      // Set stock to empty string initially, will be updated after API call
      stock: "",
    }));
    
    setSyncingItemDetails(true);
    
    try {
      const res = await fetch(`${API_BASE_URL}/retailer/square/items/${itemId}/details`, {
        credentials: "include",
      });
      const data = await res.json();
      
      if (res.ok && data.success && data.data) {
        // Update formData with synced values (price from API takes precedence, stock from API)
        setFormData((prev) => ({
          ...prev,
          squareItemId: itemId,
          price: data.data.price ? data.data.price.toString() : prev.price,
          stock: data.data.stock !== null && data.data.stock !== undefined ? data.data.stock.toString() : "0",
        }));
      }
    } catch (err) {
      console.error("Failed to fetch item details:", err);
      setError("Failed to sync item details from Square");
      // Reset stock if sync fails
      setFormData((prev) => ({
        ...prev,
        stock: "",
      }));
    } finally {
      setSyncingItemDetails(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Validation
    if (!formData.name.trim()) {
      setError("Product name is required");
      setLoading(false);
      return;
    }
    if (!formData.description.trim()) {
      setError("Description is required");
      setLoading(false);
      return;
    }
    if (!formData.price || parseFloat(formData.price) <= 0) {
      setError("Valid price is required");
      setLoading(false);
      return;
    }
    
    // Stock validation - only required if sync is NOT enabled
    if (!formData.syncFromEpos) {
      if (!formData.stock || parseInt(formData.stock) < 0) {
        setError("Valid stock quantity is required");
        setLoading(false);
        return;
      }
    }
    
    // Validate Square Item ID when sync is enabled
    if (formData.syncFromEpos && !formData.squareItemId.trim()) {
      setError("Square Item ID is required when EPOS sync is enabled");
      setLoading(false);
      return;
    }
    
    if (!formData.category) {
      setError("Category is required");
      setLoading(false);
      return;
    }

    try {
      // Determine image source: uploaded file or URL
      let images: string[] = [];
      if (imageMethod === "upload" && uploadedImage) {
        // Use base64 data URL from uploaded file
        images = [uploadedImage.dataUrl];
      } else if (imageMethod === "url" && formData.imageUrl.trim()) {
        // Use provided URL
        images = [formData.imageUrl.trim()];
      } else if (isEditMode && product?.image) {
        // Keep existing image if no new one provided in edit mode
        images = [product.image];
      }

      const url = isEditMode
        ? `${API_BASE_URL}/products/${product.id}`
        : `${API_BASE_URL}/products`;
      const method = isEditMode ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim(),
          price: parseFloat(formData.price),
          stock: formData.syncFromEpos ? 0 : parseInt(formData.stock), // Use 0 as placeholder when syncing
          category: formData.category,
          images,
          syncFromEpos: formData.syncFromEpos,
          squareItemId: formData.syncFromEpos ? formData.squareItemId.trim() || null : null,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || `Failed to ${isEditMode ? "update" : "create"} product`
        );
      }

      // Reset form only in create mode
      if (!isEditMode) {
        setFormData({
          name: "",
          description: "",
          price: "",
          stock: "",
          category: "",
          imageUrl: "",
          syncFromEpos: false,
          squareItemId: "",
        });
        setUploadedImage(null);
        setImageMethod("upload");
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }

      onSuccess?.();
      onOpenChange(false);
    } catch (err: any) {
      setError(
        err.message ||
          `Failed to ${isEditMode ? "update" : "create"} product. Please try again.`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    field: keyof typeof formData,
    value: string
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      setUploadedImage({
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

  const handleRemoveUploadedImage = () => {
    if (uploadedImage?.preview) {
      URL.revokeObjectURL(uploadedImage.preview);
    }
    setUploadedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Product" : "Create New Product"}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Update your product information. Changes will require admin approval if the product was previously approved."
              : "Add a new product to your store. Products require admin approval before being visible to customers."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Product Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="e.g., Artisan Sourdough Loaf"
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange("description", e.target.value)}
              placeholder="Describe your product..."
              rows={4}
              required
              disabled={loading}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Price (£) *</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                value={formData.price}
                onChange={(e) => handleChange("price", e.target.value)}
                placeholder="0.00"
                required
                disabled={loading || !!(formData.syncFromEpos && formData.squareItemId)}
              />
              {formData.syncFromEpos && formData.squareItemId && (
                <p className="text-xs text-muted-foreground">
                  Price synced from Square
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="stock">
                Stock Quantity {!formData.syncFromEpos && "*"}
              </Label>
              <Input
                id="stock"
                type="number"
                min="0"
                value={formData.stock}
                onChange={(e) => handleChange("stock", e.target.value)}
                placeholder={formData.syncFromEpos ? "Synced from Square" : "0"}
                required={!formData.syncFromEpos}
                disabled={loading || formData.syncFromEpos}
              />
              {formData.syncFromEpos && (
                <p className="text-xs text-muted-foreground">
                  Stock synced automatically from Square EPOS
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category *</Label>
            <Select
              value={formData.category}
              onValueChange={(value) => handleChange("category", value)}
              disabled={loading || loadingCategories || categories.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingCategories ? "Loading categories..." : "Select a category"} />
              </SelectTrigger>
              <SelectContent>
                {categories.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    {loadingCategories ? "Loading..." : "No categories available"}
                  </div>
                ) : (
                  categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.name}>
                      {cat.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* EPOS Sync Section */}
          {squareConnected && (
            <div className="space-y-4 p-4 border rounded-lg bg-secondary/50">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="syncFromEpos"
                  checked={formData.syncFromEpos}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, syncFromEpos: checked === true })
                  }
                  disabled={loading}
                />
                <Label htmlFor="syncFromEpos" className="font-semibold cursor-pointer">
                  Sync Stock from Square EPOS
                </Label>
              </div>
              <p className="text-xs text-muted-foreground ml-6">
                Enable real-time stock synchronization from your Square POS system
              </p>

              {formData.syncFromEpos && (
                <div className="space-y-2 ml-6">
                  <Label htmlFor="squareItemId">Square Item *</Label>
                  <Select
                    value={formData.squareItemId}
                    onValueChange={handleSquareItemSelect}
                    disabled={loading || loadingSquareItems || syncingItemDetails}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={loadingSquareItems ? "Loading items..." : "Select a Square item"} />
                    </SelectTrigger>
                    <SelectContent>
                      {squareItems.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name} {item.price ? `(£${item.price.toFixed(2)})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {syncingItemDetails && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Syncing item details...
                    </p>
                  )}
                  {formData.squareItemId && !syncingItemDetails && (
                    <p className="text-xs text-muted-foreground">
                      Stock and price will be synced from Square
                    </p>
                  )}
                  {loadingSquareItems && (
                    <p className="text-xs text-muted-foreground">Loading Square items...</p>
                  )}
                  {!loadingSquareItems && squareItems.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No items found in your Square catalog
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {!squareConnected && (
            <Alert>
              <AlertDescription className="text-xs">
                <strong>Square Integration:</strong> Connect your Square account in{" "}
                <a href="/retailer/square-settings" className="underline text-primary">
                  Square Settings
                </a>{" "}
                to enable real-time stock synchronization.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-3">
            <Label>Product Image</Label>
            
            {/* Method Selection */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant={imageMethod === "upload" ? "default" : "outline"}
                size="sm"
                onClick={() => setImageMethod("upload")}
                disabled={loading}
                className="flex-1"
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload File
              </Button>
              <Button
                type="button"
                variant={imageMethod === "url" ? "default" : "outline"}
                size="sm"
                onClick={() => setImageMethod("url")}
                disabled={loading}
                className="flex-1"
              >
                <ImageIcon className="mr-2 h-4 w-4" />
                Use URL
              </Button>
            </div>

            {/* Upload Method */}
            {imageMethod === "upload" && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    disabled={loading}
                    className="hidden"
                    id="imageFile"
                  />
                  <Label
                    htmlFor="imageFile"
                    className="flex-1 cursor-pointer"
                  >
                    <div className="flex items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg hover:bg-secondary/50 transition-colors">
                      {uploadedImage ? (
                        <div className="relative w-full h-full">
                          <img
                            src={uploadedImage.preview}
                            alt="Preview"
                            className="w-full h-full object-cover rounded-lg"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute top-2 right-2 h-6 w-6"
                            onClick={handleRemoveUploadedImage}
                            disabled={loading}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Upload className="h-8 w-8" />
                          <span className="text-sm">
                            {isEditMode ? "Click to upload new image" : "Click to upload image"}
                          </span>
                          <span className="text-xs">PNG, JPG up to 5MB</span>
                        </div>
                      )}
                    </div>
                  </Label>
                </div>
                {isEditMode && product?.image && !uploadedImage && (
                  <p className="text-xs text-muted-foreground">
                    Current image will be kept if no new image is uploaded
                  </p>
                )}
              </div>
            )}

            {/* URL Method */}
            {imageMethod === "url" && (
              <div className="space-y-2">
                <Input
                  id="imageUrl"
                  type="url"
                  value={formData.imageUrl}
                  onChange={(e) => handleChange("imageUrl", e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  disabled={loading}
                />
                {formData.imageUrl && (
                  <div className="mt-2">
                    <img
                      src={formData.imageUrl}
                      alt="Preview"
                      className="w-full h-32 object-cover rounded-lg border border-border"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              {isEditMode
                ? "Optional: Update product image"
                : "Optional: Add a product image. You can add more images later."}
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isEditMode ? "Updating..." : "Creating..."}
                </>
              ) : (
                isEditMode ? "Update Product" : "Create Product"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

