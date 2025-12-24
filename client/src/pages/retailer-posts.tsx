import { useEffect, useState, useRef } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useRequireRole } from "@/hooks/useRequireRole";
import { Plus, Trash2, Edit, Image as ImageIcon, Upload, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

interface RetailerPost {
  id: string;
  content: string;
  images: string[];
  created_at: string;
  updated_at: string;
}

interface UploadedImage {
  file: File;
  preview: string;
  dataUrl: string;
}

export default function RetailerPostsPage() {
  useRequireRole("retailer", "/login/retailer");
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [posts, setPosts] = useState<RetailerPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<RetailerPost | null>(null);
  const [formData, setFormData] = useState({ content: "", images: [] as string[] });
  const [submitting, setSubmitting] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [imageMethod, setImageMethod] = useState<"upload" | "url">("upload");

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/retailer/posts`, {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPosts(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch posts:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatImageUrl = (url: string): string => {
    // Handle base64 data URLs
    if (url.startsWith("data:image/")) {
      // Extract mime type (e.g., "data:image/jpeg" or "data:image/png")
      const mimeMatch = url.match(/^data:image\/([^;]+)/);
      if (mimeMatch) {
        const mimeType = mimeMatch[1];
        return `data:image/${mimeType} ...`;
      }
      return "data:image/...";
    }
    
    // Handle regular URLs - truncate if too long
    if (url.length > 50) {
      return url.substring(0, 47) + "...";
    }
    
    return url;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Invalid file type",
          description: "Please select image files only",
          variant: "destructive",
        });
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Image size must be less than 5MB",
          variant: "destructive",
        });
        return;
      }

      // Create preview and convert to base64
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        setUploadedImages((prev) => [
          ...prev,
          {
            file,
            preview: URL.createObjectURL(file),
            dataUrl,
          },
        ]);
      };
      reader.onerror = () => {
        toast({
          title: "Error",
          description: "Failed to read image file",
          variant: "destructive",
        });
      };
      reader.readAsDataURL(file);
    });

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveUploadedImage = (index: number) => {
    const image = uploadedImages[index];
    if (image?.preview) {
      URL.revokeObjectURL(image.preview);
    }
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Combine uploaded images (base64) and URL images
      const allImages: string[] = [
        ...uploadedImages.map((img) => img.dataUrl),
        ...imageUrls,
      ];

      const url = editingPost
        ? `${API_BASE_URL}/retailer/posts/${editingPost.id}`
        : `${API_BASE_URL}/retailer/posts`;
      const method = editingPost ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          content: formData.content,
          images: allImages,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast({
          title: editingPost ? "Post updated" : "Post created",
          description: editingPost
            ? "Your post has been updated successfully"
            : "Your post has been published",
        });
        setIsDialogOpen(false);
        resetForm();
        fetchPosts();
      } else {
        throw new Error(data.message || "Failed to save post");
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to save post",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (postId: string) => {
    if (!confirm("Are you sure you want to delete this post?")) return;

    try {
      const res = await fetch(`${API_BASE_URL}/retailer/posts/${postId}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast({
          title: "Post deleted",
          description: "Your post has been deleted successfully",
        });
        fetchPosts();
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to delete post",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (post: RetailerPost) => {
    setEditingPost(post);
    setFormData({ content: post.content, images: post.images });
    // Separate base64 images (uploaded) from URLs
    const base64Images: UploadedImage[] = [];
    const urlImages: string[] = [];
    
    post.images.forEach((img) => {
      if (img.startsWith("data:image")) {
        // This is a base64 image - we can't recreate the File object, so treat as URL
        urlImages.push(img);
      } else {
        urlImages.push(img);
      }
    });
    
    setImageUrls(urlImages);
    setUploadedImages([]);
    setImageMethod("url");
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({ content: "", images: [] });
    setImageUrls([]);
    setUploadedImages([]);
    setEditingPost(null);
    setImageMethod("upload");
    // Clean up object URLs
    uploadedImages.forEach((img) => {
      if (img.preview) {
        URL.revokeObjectURL(img.preview);
      }
    });
  };

  const handleImageUrlAdd = () => {
    const url = prompt("Enter image URL:");
    if (url && url.trim()) {
      setImageUrls([...imageUrls, url.trim()]);
    }
  };

  const handleImageUrlRemove = (index: number) => {
    setImageUrls(imageUrls.filter((_, i) => i !== index));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Posts & Updates</h1>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Post
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingPost ? "Edit Post" : "Create New Post"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="content">Content *</Label>
                  <Textarea
                    id="content"
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    placeholder="What's new with your store?"
                    rows={6}
                    required
                  />
                </div>

                <div className="space-y-3">
                  <Label>Images</Label>
                  
                  {/* Method Selection */}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={imageMethod === "upload" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setImageMethod("upload")}
                      disabled={submitting}
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
                      disabled={submitting}
                      className="flex-1"
                    >
                      <ImageIcon className="mr-2 h-4 w-4" />
                      Use URL
                    </Button>
                  </div>

                  {/* Upload Method */}
                  {imageMethod === "upload" && (
                    <div className="space-y-2">
                      <Input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleFileUpload}
                        disabled={submitting}
                        className="hidden"
                        id="imageFile"
                      />
                      <Label
                        htmlFor="imageFile"
                        className="cursor-pointer"
                      >
                        <div className="flex items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg hover:bg-secondary/50 transition-colors">
                          <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <Upload className="h-8 w-8" />
                            <span className="text-sm">Click to upload images</span>
                            <span className="text-xs">PNG, JPG up to 5MB each</span>
                          </div>
                        </div>
                      </Label>
                      
                      {/* Uploaded Images Preview */}
                      {uploadedImages.length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                          {uploadedImages.map((img, index) => (
                            <div key={index} className="relative">
                              <img
                                src={img.preview}
                                alt={`Upload ${index + 1}`}
                                className="w-full h-32 object-cover rounded-lg"
                              />
                              <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                className="absolute top-1 right-1 h-6 w-6"
                                onClick={() => handleRemoveUploadedImage(index)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* URL Method */}
                  {imageMethod === "url" && (
                    <div className="space-y-2">
                      <div className="space-y-2">
                        {imageUrls.map((url, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <img
                              src={url}
                              alt={`Preview ${index + 1}`}
                              className="h-20 w-20 object-cover rounded flex-shrink-0"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none";
                              }}
                            />
                            <div className="flex-1 text-sm text-muted-foreground break-words min-w-0">
                              <span className="truncate block" title={url}>
                                {formatImageUrl(url)}
                              </span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="flex-shrink-0"
                              onClick={() => handleImageUrlRemove(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        <Button type="button" variant="outline" onClick={handleImageUrlAdd}>
                          <ImageIcon className="h-4 w-4 mr-2" />
                          Add Image URL
                        </Button>
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    You can add multiple images to your post
                  </p>
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
                        {editingPost ? "Updating..." : "Publishing..."}
                      </>
                    ) : (
                      editingPost ? "Update Post" : "Publish Post"
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
        ) : posts.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              <p className="mb-4">No posts yet. Create your first post to engage with your followers!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <Card key={post.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">
                      {new Date(post.created_at).toLocaleDateString()}
                    </CardTitle>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(post)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(post.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap mb-4">{post.content}</p>
                  {post.images && post.images.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {post.images.map((img, idx) => (
                        <img
                          key={idx}
                          src={img}
                          alt={`Post image ${idx + 1}`}
                          className="w-full h-48 object-cover rounded-lg"
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}


