import { useEffect, useState, useMemo } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { ProductCard } from "@/components/product/ProductCard";
import { type Product } from "@/lib/product";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Filter, MapPin, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { Slider } from "@/components/ui/slider";
interface Category {
  id: string;
  name: string;
  description: string | null;
}

export default function SearchPage() {
  const [location, setLocation] = useLocation();
  
  // Extract URL params using useMemo to prevent recreation
  // Get query string from window.location to ensure we get the full URL
  const { query, locationQuery } = useMemo(() => {
    // Use window.location.search to get the query string directly
    const searchParams = new URLSearchParams(window.location.search);
    const extracted = {
      query: searchParams.get("q") || "",
      locationQuery: searchParams.get("loc") || "",
    };
    console.log("[SearchPage] URL params extracted:", { 
      location,
      windowLocationSearch: window.location.search,
      extracted 
    });
    return extracted;
  }, [location]);
  
  // Filter states
  const [searchInput, setSearchInput] = useState(query);
  const [filterLocation, setFilterLocation] = useState(locationQuery);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000]);
  const [sortBy] = useState("featured");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  // Fetch categories from API
  useEffect(() => {
    const fetchCategories = async () => {
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
    fetchCategories();
  }, []);

  // Update local state when URL params change
  useEffect(() => {
    console.log("[SearchPage] Updating local state from URL params:", { query, locationQuery });
    setSearchInput(query);
    setFilterLocation(locationQuery);
  }, [query, locationQuery]);
  
  // Listen for URL changes (browser back/forward, direct navigation)
  useEffect(() => {
    const handlePopState = () => {
      console.log("[SearchPage] PopState event - URL changed");
      // Force re-extraction of URL params
      const searchParams = new URLSearchParams(window.location.search);
      const newQuery = searchParams.get("q") || "";
      const newLocationQuery = searchParams.get("loc") || "";
      console.log("[SearchPage] New URL params from popstate:", { newQuery, newLocationQuery });
      setSearchInput(newQuery);
      setFilterLocation(newLocationQuery);
    };
    
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Fetch products when URL params change
  useEffect(() => {
    console.log("[SearchPage] useEffect triggered with:", { query, locationQuery, location });
    
    const fetchProducts = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        // Include search parameter if query exists
        if (query && query.trim()) {
          params.append("search", query.trim());
        }
        // Include location and always use radiusKm=0 for text-based search
        if (locationQuery && locationQuery.trim()) {
          params.append("location", locationQuery.trim());
          params.append("radiusKm", "0"); // Always use text-based search
        }
        
        const apiUrl = `${API_BASE_URL}/products${params.toString() ? `?${params.toString()}` : ""}`;
        console.log("[SearchPage] Fetching products from:", apiUrl);
        console.log("[SearchPage] Search params:", { 
          query: query?.trim() || null, 
          locationQuery: locationQuery?.trim() || null
        });
        
        console.log("[SearchPage] Making fetch request to:", apiUrl);
        console.log("[SearchPage] API_BASE_URL:", API_BASE_URL);
        
        const res = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        console.log("[SearchPage] Fetch completed. Response status:", res.status, res.statusText);
        
        if (!res.ok) {
          const errorText = await res.text();
          console.error("[SearchPage] API error response:", errorText);
          throw new Error(`API error: ${res.status} ${res.statusText}`);
        }
        
        const data = await res.json();
        console.log("[SearchPage] Products response:", data);
        console.log("[SearchPage] Number of products returned:", Array.isArray(data.data) ? data.data.length : 0);
        
        if (!res.ok || !data.success) {
          throw new Error(data.message || "Failed to load products");
        }
        if (Array.isArray(data.data) && data.data.length > 0) {
          setProducts(
            data.data.map((p: any) => ({
              id: p.id,
              name: p.name,
              price: parseFloat(p.price) || 0, // Parse price as number
              retailer: p.retailer_name || "Retailer",
              image: p.images?.[0] || "/opengraph.jpg",
              category: p.category,
              rating: p.averageRating || 0,
              reviews: p.reviewCount || 0,
              pickupTime: "30 mins",
              retailerPostcode: p.postcode,
              retailerCity: p.city,
            }))
          );
        } else {
          setProducts([]);
        }
      } catch (err: any) {
        console.error("[SearchPage] API error:", err);
          setError(err.message);
          setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    // Always fetch when component mounts or URL changes
    fetchProducts();
  }, [query, locationQuery, location, API_BASE_URL]);

  // Handle category toggle
  const handleCategoryToggle = (categoryId: string) => {
    setSelectedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  // Handle apply filters
  const handleApplyFilters = () => {
    console.log("[SearchPage] handleApplyFilters called with:", { searchInput, filterLocation, selectedCategories });
    const params = new URLSearchParams();
    if (searchInput.trim()) params.append("q", searchInput.trim());
    if (filterLocation.trim()) {
      params.append("loc", filterLocation.trim());
    }
    if (selectedCategories.length > 0) {
      params.append("categories", selectedCategories.join(","));
    }
    const queryString = params.toString();
    const newUrl = `/search${queryString ? `?${queryString}` : ""}`;
    console.log("[SearchPage] Updating URL to:", newUrl);
    setLocation(newUrl);
  };

  // Filter and sort products
  const filteredAndSortedProducts = useMemo(() => {
    let filtered = [...products];
    // Apply category filter
    if (selectedCategories.length > 0) {
      filtered = filtered.filter(p => 
        selectedCategories.some(catId => {
          const cat = categories.find(c => c.id === catId);
          return cat && p.category === cat.name;
        })
      );
    }


    // Apply price filter
    filtered = filtered.filter(p => p.price >= priceRange[0] && p.price <= priceRange[1]);

    // Apply sorting
    switch (sortBy) {
      case "price-low":
        filtered.sort((a, b) => a.price - b.price);
        break;
      case "price-high":
        filtered.sort((a, b) => b.price - a.price);
        break;
      case "rating":
        filtered.sort((a, b) => b.rating - a.rating);
        break;
      case "newest":
        filtered.sort((a, b) => {
          const aNew = a.isNew ? 1 : 0;
          const bNew = b.isNew ? 1 : 0;
          return bNew - aNew;
        });
        break;
      default: // featured
        // Keep original order
        break;
    }

    return filtered;
  }, [products, selectedCategories, priceRange, sortBy]);

  console.log("Filtered and sorted products:", filteredAndSortedProducts);


  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8">
        {/* Search Header */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="font-heading text-3xl font-bold text-primary">
              {query ? `Results for "${query}"` : "All Products"}
            </h1>
            <p className="text-muted-foreground">
              {products.length > 0 ? (
                locationQuery 
                  ? `Showing ${products.length} result${products.length !== 1 ? "s" : ""} near ${locationQuery}`
                  : `Showing ${products.length} result${products.length !== 1 ? "s" : ""}`
              ) : (
                locationQuery 
                  ? `No results found near ${locationQuery}`
                  : "No results found"
              )}
            </p>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-4">
          {/* Sidebar Filters */}
          <aside className="space-y-6 lg:col-span-1">
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2 font-semibold text-lg">
                <Filter className="h-5 w-5" /> Filters
              </div>

              {/* Postcode or City Filter */}
              <div className="mb-6 space-y-3">
                <Label className="text-sm font-medium">Postcode or City</Label>
                <div className="relative">
                   <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                   <Input 
                     className="pl-9" 
                     placeholder="e.g. SW1A 1AA or London" 
                     value={filterLocation}
                     onChange={(e) => setFilterLocation(e.target.value)}
                  />
                </div>
              </div>

              {/* Categories Filter */}
              <div className="mb-6 space-y-3">
                <div>
                <Label className="text-sm font-medium">Categories</Label>
                </div>
                {loadingCategories ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {categories.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No categories available</p>
                    ) : (
                      categories.map((cat) => (
                        <div key={cat.id} className="flex items-center space-x-2">
                          <Checkbox 
                            id={`cat-${cat.id}`}
                            checked={selectedCategories.includes(cat.id)}
                            onCheckedChange={() => handleCategoryToggle(cat.id)}
                          />
                          <label
                            htmlFor={`cat-${cat.id}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {cat.name}
                          </label>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Price Filter */}
              <div className="mb-6 space-y-3">
                <Label className="text-sm font-medium">Price Range</Label>
                <Slider 
                  value={priceRange} 
                  onValueChange={(vals) => setPriceRange([vals[0], vals[1]])}
                  max={1000} 
                  step={1} 
                  min={0}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>£{priceRange[0]}</span>
                  <span>£{priceRange[1]}</span>
                </div>
              </div>

              <Button 
                type="button"
                onClick={handleApplyFilters}
                className="w-full bg-primary cursor-pointer"
              >
                Apply Filters
              </Button>
            </div>
          </aside>

          {/* Results Grid */}
          <div className="lg:col-span-3">
            {loading && (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}
            {error && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
                {error}
              </div>
            )}
            {!loading && !error && (
              <>
                {products.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <p className="text-lg font-semibold text-muted-foreground">No products found</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Try adjusting your search or filters
                    </p>
                  </div>
                ) : (
                  <>
                    {filteredAndSortedProducts.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <p className="text-lg font-semibold text-muted-foreground">No products match your filters</p>
                        <p className="text-sm text-muted-foreground mt-2">
                          Try adjusting your filters
                        </p>
                      </div>
                    ) : (
                      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {filteredAndSortedProducts.map((product, index) => (
                          <ProductCard key={`${product.id}-${index}`} product={product} />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
