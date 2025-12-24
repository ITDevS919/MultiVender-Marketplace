import { useEffect, useState } from "react";
import { useRoute, Link } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Star, StarHalf } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { MessageCircle } from "lucide-react";
import { startChatWithRetailer } from "@/utils/chatHelpers";
import { useLocation } from "wouter";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  images: string[];
  retailerId: string;
  isApproved: boolean;
  reviewCount?: number;
  averageRating?: number;
}

interface Review {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
  username: string;
  email: string;
}

export default function ProductDetailPage() {
  const [match, params] = useRoute("/product/:id");
  const productId = params?.id;
  const { user, isAuthenticated } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: "" });
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    if (!productId) return;
    const fetchProduct = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/products/${productId}`);
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || "Failed to load product");
        }
        setProduct(data.data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [productId]);

  useEffect(() => {
    if (!productId) return;
    const fetchReviews = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/products/${productId}/reviews`);
        const data = await res.json();
        if (res.ok && data.success) {
          setReviews(data.data || []);
        }
      } catch (err) {
        console.error("Failed to load reviews:", err);
      } finally {
        setReviewsLoading(false);
      }
    };
    fetchReviews();
  }, [productId]);

  const handleSubmitReview = async () => {
    if (!isAuthenticated || !user || user.role !== "customer") {
      setError("You must be logged in as a customer to submit a review");
      return;
    }

    if (reviewForm.rating < 1 || reviewForm.rating > 5) {
      setError("Please select a rating between 1 and 5");
      return;
    }

    setSubmittingReview(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/products/${productId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          rating: reviewForm.rating,
          comment: reviewForm.comment || null,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to submit review");
      }

      // Reload product and reviews
      const productRes = await fetch(`${API_BASE_URL}/products/${productId}`);
      const productData = await productRes.json();
      if (productRes.ok && productData.success) {
        setProduct(productData.data);
      }

      const reviewsRes = await fetch(`${API_BASE_URL}/products/${productId}/reviews`);
      const reviewsData = await reviewsRes.json();
      if (reviewsRes.ok && reviewsData.success) {
        setReviews(reviewsData.data || []);
      }

      setReviewDialogOpen(false);
      setReviewForm({ rating: 5, comment: "" });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleMessageSeller = async () => {
    if (!isAuthenticated || !user || user.role !== "customer") {
      toast({
        title: "Login required",
        description: "Please login as a customer to message the seller",
        variant: "destructive",
      });
      return;
    }

    if (!product?.retailerId) return;

    try {
      await startChatWithRetailer(product.retailerId, user, setLocation);
      toast({
        title: "Chat started",
        description: "You can now message the seller",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to start chat",
        variant: "destructive",
      });
    }
  };

  const renderStars = (rating: number) => {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    return (
      <div className="flex items-center gap-1">
        {[...Array(5)].map((_, i) => {
          if (i < fullStars) {
            return <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />;
          } else if (i === fullStars && hasHalfStar) {
            return <StarHalf key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />;
          } else {
            return <Star key={i} className="h-4 w-4 text-gray-300" />;
          }
        })}
        <span className="ml-1 text-sm text-muted-foreground">({rating.toFixed(1)})</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <div className="container mx-auto px-4 py-10">
        {loading && (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}
        {error && (
          <div className="text-center text-destructive py-10">{error}</div>
        )}
        {!loading && !error && product && (
          <div className="grid gap-10 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="aspect-square w-full overflow-hidden rounded-2xl border border-border bg-muted">
                <img
                  src={product.images?.[0] || "/opengraph.jpg"}
                  alt={product.name}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="grid grid-cols-4 gap-2">
                {(product.images || []).slice(0, 4).map((img, idx) => (
                  <img
                    key={idx}
                    src={img}
                    alt={`${product.name}-${idx}`}
                    className="h-20 w-full rounded-lg object-cover border border-border"
                  />
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">{product.category}</p>
                <h1 className="text-3xl font-bold">{product.name}</h1>
                {product.averageRating && product.averageRating > 0 && (
                  <div className="mt-2">
                    {renderStars(product.averageRating)}
                    <span className="text-sm text-muted-foreground ml-2">
                      {product.reviewCount || 0} review{product.reviewCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                )}
              </div>
              <p className="text-lg text-muted-foreground whitespace-pre-line">
                {product.description}
              </p>
              <div className="text-3xl font-semibold text-primary">£{product.price.toFixed(2)}</div>
              <p className="text-sm text-muted-foreground">
                Stock: {product.stock > 0 ? product.stock : "Out of stock"}
              </p>
              <div className="flex gap-2">
                <Button onClick={handleMessageSeller} disabled={!isAuthenticated || user?.role !== "customer"}>
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Message Seller
                </Button>
                <Link href="/cart">
                  <Button variant="outline">Go to cart</Button>
                </Link>
              </div>
              <div className="pt-4">
                <h3 className="font-semibold mb-2">Seller info</h3>
                <p className="text-sm text-muted-foreground">
                  Retailer ID: {product.retailerId} (approval required for full profile)
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Reviews Section */}
        {!loading && !error && product && (
          <div className="mt-12 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Reviews</h2>
              {isAuthenticated && user?.role === "customer" && (
                <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>Write a Review</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Write a Review</DialogTitle>
                      <DialogDescription>
                        Share your experience with this product
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Rating</Label>
                        <div className="flex gap-2">
                          {[1, 2, 3, 4, 5].map((rating) => (
                            <button
                              key={rating}
                              type="button"
                              onClick={() => setReviewForm({ ...reviewForm, rating })}
                              className={`p-2 rounded ${
                                reviewForm.rating >= rating
                                  ? "bg-yellow-400"
                                  : "bg-gray-200 hover:bg-gray-300"
                              }`}
                            >
                              <Star
                                className={`h-6 w-6 ${
                                  reviewForm.rating >= rating
                                    ? "fill-yellow-600 text-yellow-600"
                                    : "text-gray-400"
                                }`}
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="comment">Comment (optional)</Label>
                        <Textarea
                          id="comment"
                          placeholder="Share your thoughts..."
                          value={reviewForm.comment}
                          onChange={(e) =>
                            setReviewForm({ ...reviewForm, comment: e.target.value })
                          }
                          rows={4}
                        />
                      </div>
                      {error && <p className="text-sm text-destructive">{error}</p>}
                      <Button
                        onClick={handleSubmitReview}
                        disabled={submittingReview}
                        className="w-full"
                      >
                        {submittingReview ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          "Submit Review"
                        )}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {reviewsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : reviews.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground py-8">
                    No reviews yet. Be the first to review this product!
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {reviews.map((review) => (
                  <Card key={review.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg">{review.username}</CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {new Date(review.created_at).toLocaleDateString("en-GB", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })}
                          </p>
                        </div>
                        {renderStars(review.rating)}
                      </div>
                    </CardHeader>
                    {review.comment && (
                      <CardContent>
                        <p className="text-muted-foreground whitespace-pre-line">{review.comment}</p>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

