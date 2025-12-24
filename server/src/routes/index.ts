import express, { Router } from "express";
import Stripe from "stripe";
import passport from "passport";
import { storage } from "../services/storage";
import { isAuthenticated, getCurrentUser } from "../middleware/auth";
import { insertUserSchema, loginSchema, User } from "../../shared/schema";
// Using require to avoid TS module resolution issues in this runtime config
// eslint-disable-next-line @typescript-eslint/no-var-requires
import { stripeService } from "../services/stripeService";
import { rewardsService } from '../services/rewardsService';

const BASE_CURRENCY = (process.env.BASE_CURRENCY || "GBP").toUpperCase();
const currencyRates: Record<string, number> = {
  GBP: 1,
  USD: parseFloat(process.env.FX_USD_TO_GBP || "0.79"),
  EUR: parseFloat(process.env.FX_EUR_TO_GBP || "0.86"),
};
const toBaseCurrency = (amount: number, currency: string) => {
  const rate = Number.isFinite(currencyRates[currency]) ? currencyRates[currency] : 1;
  return amount * rate;
};

const router = Router();

// Health check endpoint
router.get("/health", (_req, res) => {
  res.json({ 
    success: true, 
    message: "Server is running",
    timestamp: new Date().toISOString(),
  });
});

// Authentication routes

// Sign up
router.post("/auth/signup", async (req, res, next) => {
  try {
    // Validate input
    const validationResult = insertUserSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validationResult.error.errors,
      });
    }

    const { username, email, password, role, retailerData } = validationResult.data;

    // Check if user already exists
    const existingUser = await storage.getUserByUsername(username) ||
      await storage.getUserByEmail(email);
    
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Username or email already exists",
      });
    }

    // Create user with role and retailer data if applicable
    const user = await storage.createUser({ 
      username, 
      email, 
      password, 
      role: role || "customer",
      retailerData: role === "retailer" ? retailerData : undefined
    });

    // Auto-login after signup
    req.login(user, (err) => {
      if (err) {
        return next(err);
      }
      
      // Return user without password
      const { password: _, ...publicUser } = user;
      res.status(201).json({
        success: true,
        data: publicUser,
      });
    });
  } catch (error: any) {
    if (error.message === "Username or email already exists") {
      return res.status(409).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
});

// Login
router.post("/auth/login", (req, res, next) => {
  // Validate input
  const validationResult = loginSchema.safeParse(req.body);
  if (!validationResult.success) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: validationResult.error.errors,
    });
  }

  passport.authenticate("local", (err: any, user: User, info: any) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      return res.status(401).json({
        success: false,
        message: info?.message || "Invalid username or password",
      });
    }
    req.login(user, (err) => {
      if (err) {
        return next(err);
      }
      // Return user without password
      const { password: _, ...publicUser } = user;
      res.json({
        success: true,
        data: publicUser,
      });
    });
  })(req, res, next);
});

// Admin Login (separate endpoint that validates admin role)
router.post("/admin/login", (req, res, next) => {
  // Validate input
  const validationResult = loginSchema.safeParse(req.body);
  if (!validationResult.success) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: validationResult.error.errors,
    });
  }

  passport.authenticate("local", (err: any, user: any, info: any) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      return res.status(401).json({
        success: false,
        message: info?.message || "Invalid username or password",
      });
    }
    
    // Check if user is an admin
    if (user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin privileges required.",
      });
    }
    
    req.login(user, (err) => {
      if (err) {
        return next(err);
      }
      // Return user without password
      const { password: _, ...publicUser } = user;
      res.json({
        success: true,
        data: publicUser,
      });
    });
  })(req, res, next);
});

// Logout
router.post("/auth/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    req.session.destroy((err) => {
      if (err) {
        return next(err);
      }
      res.json({
        success: true,
        message: "Logged out successfully",
      });
    });
  });
});

// Google OAuth routes
router.get("/auth/google", (req, res, next) => {
  const role = (req.query.role as string) || "customer";
  // Store role in session for callback
  (req.session as any).googleAuthRole = role;
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })(req, res, next);
});

router.get("/auth/google/callback",
  passport.authenticate("google", { 
    failureRedirect: `${process.env.FRONTEND_URL || "http://localhost:3000"}/login/customer?error=google_auth_failed` 
  }),
  async (req, res) => {
    try {
      // Get role from session if available
      const role = (req.session as any)?.googleAuthRole || "customer";
      delete (req.session as any).googleAuthRole;

      // If user was just created and role needs to be set, update it
      const user = req.user as any;
      if (user && role !== "customer" && user.role === "customer") {
        // Note: In a real implementation, you might want to update the user's role
        // For now, we'll use the role from the session
      }

      // Redirect based on user role
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      
      if (user.role === "retailer") {
        res.redirect(`${frontendUrl}/retailer/dashboard`);
      } else if (user.role === "admin") {
        res.redirect(`${frontendUrl}/admin/dashboard`);
      } else {
        res.redirect(`${frontendUrl}/`);
      }
    } catch (error) {
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      res.redirect(`${frontendUrl}/login/customer?error=google_auth_failed`);
    }
  }
);

// Get current user
router.get("/auth/me", isAuthenticated, (req, res) => {
  const user = getCurrentUser(req);
  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Not authenticated",
    });
  }
  // Return user without password
  const { password: _, ...publicUser } = user;
  res.json({
    success: true,
    data: publicUser,
  });
});

// Products routes
import { productService } from "../services/productService";
import { geocodingService } from "../services/geocodingService";
import { squareService } from "../services/squareService";
import { pool } from "../db/connection";

// Get products (public)
router.get("/products", async (req, res, next) => {
  try {
    console.log(`[Products API] Request received with query params:`, req.query);
    const { category, search, retailerId, location, latitude, longitude, radiusKm, page, limit } = req.query;
    
    let lat: number | undefined;
    let lon: number | undefined;
    let radius: number | undefined;

    // If latitude/longitude/radius are provided, use radius search
    if (latitude && longitude && radiusKm) {
      lat = parseFloat(latitude as string);
      lon = parseFloat(longitude as string);
      radius = parseFloat(radiusKm as string);
      
      if (isNaN(lat) || isNaN(lon) || isNaN(radius)) {
        return res.status(400).json({
          success: false,
          message: "Invalid latitude, longitude, or radius parameters",
        });
      }
    } else if (location) {
      // Always use text-based search for location (postcode/city filter)
      // No geocoding, directly search retailers.postcode and retailers.city
      console.log(`[Products API] Using text-based search for location: "${location}" (no geocoding)`);
      radius = undefined; // Ensure no radius search
    }

    // If no pagination params provided, return all results (set very high limit)
    const pageNum = page ? parseInt(page as string) : 1;
    const limitNum = limit ? parseInt(limit as string) : (page ? 12 : 10000); // If no page/limit, return all results

    // Determine which search method to use
    const useTextSearch = !(lat && lon && radius);
    const locationForSearch = useTextSearch ? (location as string) : undefined;
    
    console.log(`[Products API] Search parameters:`, {
      location: location as string,
      locationForSearch,
      lat,
      lon,
      radius,
      useTextSearch,
      search: search as string,
      category: category as string,
      retailerId: retailerId as string,
    });
    
    // Log what will be passed to productService
    console.log(`[Products API] Calling productService.getProducts with:`, {
      search: search as string,
      location: locationForSearch,
      latitude: lat,
      longitude: lon,
      radiusKm: radius,
      category: category as string,
      isApproved: true,
    });

    const result = await productService.getProducts({
      category: category as string,
      search: search as string,
      retailerId: retailerId as string,
      location: locationForSearch, // Use text search only if no coordinates or radius is 0
      latitude: lat,
      longitude: lon,
      radiusKm: radius,
      isApproved: true, // Only show approved products to public
      page: pageNum,
      limit: limitNum,
    });
    
    res.json({ 
      success: true, 
      data: result.products,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get pending products (admin only) - MUST be before /products/:id route
router.get("/products/pending", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Only admins can access this" });
    }

    // Get pending products with retailer information
    const result = await pool.query(
      `SELECT p.*, r.business_name as retailer_name, r.postcode, r.city
       FROM products p
       JOIN retailers r ON p.retailer_id = r.id
       WHERE p.is_approved = false
       ORDER BY p.created_at DESC`
    );

    const products = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      price: parseFloat(row.price),
      stock: row.stock,
      category: row.category,
      images: row.images || [],
      isApproved: row.is_approved,
      retailer_name: row.retailer_name,
      created_at: row.created_at,
    }));

    res.json({ success: true, data: products });
  } catch (error) {
    next(error);
  }
});

// Get product by ID (public)
router.get("/products/:id", async (req, res, next) => {
  try {
    const product = await productService.getProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }
    res.json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
});

// Create product (retailer only)
router.post("/products", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user || user.role !== "retailer") {
      return res.status(403).json({ success: false, message: "Only retailers can create products" });
    }

    const retailerId = await productService.getRetailerIdByUserId(user.id);
    if (!retailerId) {
      return res.status(404).json({ success: false, message: "Retailer profile not found" });
    }

    const { name, description, price, stock, category, images, syncFromEpos, squareItemId } = req.body;
    const product = await productService.createProduct({
      retailerId,
      name,
      description,
      price,
      stock,
      category,
      images,
      syncFromEpos: syncFromEpos || false,
      squareItemId: squareItemId || null,
    });

    res.status(201).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
});

// Get retailer's products
router.get("/retailer/products", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user || user.role !== "retailer") {
      return res.status(403).json({ success: false, message: "Only retailers can access this" });
    }

    const retailerId = await productService.getRetailerIdByUserId(user.id);
    if (!retailerId) {
      return res.status(404).json({ success: false, message: "Retailer profile not found" });
    }

    // Get all products for retailer (no pagination needed for retailer view)
    const result = await productService.getProducts({ 
      retailerId,
      limit: 1000, // Get all products for retailer
      page: 1,
    });
    
    // Return just the products array, not the pagination object
    res.json({ success: true, data: result.products });
  } catch (error) {
    next(error);
  }
});

// Get retailer dashboard stats
// Get retailer profile
router.get("/retailer/profile", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user || user.role !== "retailer") {
      return res.status(403).json({ success: false, message: "Only retailers can access this" });
    }

    const result = await pool.query(
      `SELECT r.*, u.email
       FROM retailers r
       JOIN users u ON r.user_id = u.id
       WHERE r.user_id = $1`,
      [user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Retailer profile not found" });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Update retailer settings
router.put("/retailer/settings", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user || user.role !== "retailer") {
      return res.status(403).json({ success: false, message: "Only retailers can update settings" });
    }

    const { businessName, businessAddress, postcode, city, phone } = req.body;

    if (!businessName || businessName.trim().length === 0) {
      return res.status(400).json({ success: false, message: "Business name is required" });
    }

    // Get retailer ID
    const retailerResult = await pool.query(
      "SELECT id FROM retailers WHERE user_id = $1",
      [user.id]
    );

    if (retailerResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Retailer profile not found" });
    }

    const retailerId = retailerResult.rows[0].id;

    // Geocode address if postcode or city is provided
    let latitude: number | null = null;
    let longitude: number | null = null;

    if (postcode || city) {
      try {
        const geocodeResult = await geocodingService.geocodeAddress(
          postcode || "",
          city || ""
        );
        if (geocodeResult) {
          latitude = geocodeResult.latitude;
          longitude = geocodeResult.longitude;
        }
      } catch (error) {
        console.error("Geocoding error:", error);
        // Continue without geocoding if it fails
      }
    }

    // Update retailer profile
    const updateResult = await pool.query(
      `UPDATE retailers 
       SET business_name = $1, 
           business_address = $2, 
           postcode = $3, 
           city = $4, 
           phone = $5,
           latitude = $6,
           longitude = $7
       WHERE id = $8
       RETURNING *`,
      [businessName, businessAddress || null, postcode || null, city || null, phone || null, latitude, longitude, retailerId]
    );

    res.json({
      success: true,
      message: "Settings updated successfully",
      data: updateResult.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// Square integration endpoints

// Connect Square account
router.post("/retailer/square/connect", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user || user.role !== "retailer") {
      return res.status(403).json({ success: false, message: "Only retailers can connect Square" });
    }

    const { accessToken, locationId } = req.body;

    if (!accessToken || !locationId) {
      return res.status(400).json({ success: false, message: "Access token and location ID are required" });
    }

    // Validate connection
    const isValid = await squareService.validateConnection(accessToken, locationId);
    if (!isValid) {
      return res.status(400).json({ success: false, message: "Invalid Square credentials or location ID" });
    }

    // Get retailer ID
    const retailerResult = await pool.query(
      "SELECT id FROM retailers WHERE user_id = $1",
      [user.id]
    );

    if (retailerResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Retailer profile not found" });
    }

    const retailerId = retailerResult.rows[0].id;

    // Update retailer with Square credentials
    const updateResult = await pool.query(
      `UPDATE retailers 
       SET square_access_token = $1,
           square_location_id = $2,
           square_connected_at = CURRENT_TIMESTAMP,
           square_sync_enabled = true
       WHERE id = $3
       RETURNING id, square_sync_enabled, square_connected_at`,
      [accessToken, locationId, retailerId]
    );

    res.json({
      success: true,
      message: "Square account connected successfully",
      data: updateResult.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// Get Square connection status
router.get("/retailer/square/status", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user || user.role !== "retailer") {
      return res.status(403).json({ success: false, message: "Only retailers can check Square status" });
    }

    const retailerResult = await pool.query(
      `SELECT square_access_token, square_location_id, square_sync_enabled, square_connected_at
       FROM retailers WHERE user_id = $1`,
      [user.id]
    );

    if (retailerResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Retailer profile not found" });
    }

    const retailer = retailerResult.rows[0];
    const isConnected = !!(retailer.square_access_token && retailer.square_location_id);

    res.json({
      success: true,
      data: {
        connected: isConnected,
        syncEnabled: retailer.square_sync_enabled || false,
        connectedAt: retailer.square_connected_at,
        locationId: retailer.square_location_id || null,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Disconnect Square account
router.delete("/retailer/square/disconnect", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user || user.role !== "retailer") {
      return res.status(403).json({ success: false, message: "Only retailers can disconnect Square" });
    }

    const retailerResult = await pool.query(
      "SELECT id FROM retailers WHERE user_id = $1",
      [user.id]
    );

    if (retailerResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Retailer profile not found" });
    }

    const retailerId = retailerResult.rows[0].id;

    // Clear Square credentials and disable sync
    await pool.query(
      `UPDATE retailers 
       SET square_access_token = NULL,
           square_location_id = NULL,
           square_connected_at = NULL,
           square_sync_enabled = false
       WHERE id = $1`,
      [retailerId]
    );

    // Also disable EPOS sync for all products
    await pool.query(
      `UPDATE products 
       SET sync_from_epos = false
       WHERE retailer_id = $1`,
      [retailerId]
    );

    res.json({
      success: true,
      message: "Square account disconnected successfully",
    });
  } catch (error) {
    next(error);
  }
});

// Test Square connection
router.post("/retailer/square/test", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user || user.role !== "retailer") {
      return res.status(403).json({ success: false, message: "Only retailers can test Square connection" });
    }

    const retailerResult = await pool.query(
      `SELECT square_access_token, square_location_id
       FROM retailers WHERE user_id = $1`,
      [user.id]
    );

    if (retailerResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Retailer profile not found" });
    }

    const retailer = retailerResult.rows[0];

    if (!retailer.square_access_token || !retailer.square_location_id) {
      return res.status(400).json({ success: false, message: "Square account not connected" });
    }

    const isValid = await squareService.validateConnection(
      retailer.square_access_token,
      retailer.square_location_id
    );

    res.json({
      success: true,
      data: {
        valid: isValid,
        message: isValid ? "Connection is valid" : "Connection test failed",
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/retailer/stats", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user || user.role !== "retailer") {
      return res.status(403).json({ success: false, message: "Only retailers can access this" });
    }

    const retailerId = await productService.getRetailerIdByUserId(user.id);
    if (!retailerId) {
      return res.status(404).json({ success: false, message: "Retailer profile not found" });
    }

    // Get total revenue from orders
    const revenueResult = await pool.query(
      `SELECT COALESCE(SUM(total), 0) as total_revenue
       FROM orders
       WHERE retailer_id = $1 AND status != 'cancelled'`,
      [retailerId]
    );
    const totalRevenue = parseFloat(revenueResult.rows[0].total_revenue) || 0;

    // Get total orders count
    const ordersCountResult = await pool.query(
      `SELECT COUNT(*) as total_orders,
              COUNT(*) FILTER (WHERE status = 'pending') as pending_orders
       FROM orders
       WHERE retailer_id = $1`,
      [retailerId]
    );
    const totalOrders = parseInt(ordersCountResult.rows[0].total_orders) || 0;
    const pendingOrders = parseInt(ordersCountResult.rows[0].pending_orders) || 0;

    // Get products stats
    const productsResult = await pool.query(
      `SELECT COUNT(*) as total_products,
              COUNT(*) FILTER (WHERE is_approved = true) as approved_products,
              COUNT(*) FILTER (WHERE stock < 10 AND stock > 0) as low_stock_count
       FROM products
       WHERE retailer_id = $1`,
      [retailerId]
    );
    const totalProducts = parseInt(productsResult.rows[0].total_products) || 0;
    const approvedProducts = parseInt(productsResult.rows[0].approved_products) || 0;
    const lowStockCount = parseInt(productsResult.rows[0].low_stock_count) || 0;

    // Get recent orders (last 5)
    const recentOrdersResult = await pool.query(
      `SELECT o.*, u.username as customer_name, u.email as customer_email,
              (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count
       FROM orders o
       JOIN users u ON o.user_id = u.id
       WHERE o.retailer_id = $1
       ORDER BY o.created_at DESC
       LIMIT 5`,
      [retailerId]
    );

    // Get top products by order count (last 30 days)
    // Use LEFT JOIN to handle cases where products have no orders
    const topProductsResult = await pool.query(
      `SELECT p.id, p.name, p.images, p.price,
              COALESCE(COUNT(oi.id), 0)::int as order_count
       FROM products p
       LEFT JOIN order_items oi ON p.id = oi.product_id
       LEFT JOIN orders o ON oi.order_id = o.id 
         AND o.created_at >= NOW() - INTERVAL '30 days'
       WHERE p.retailer_id = $1
       GROUP BY p.id, p.name, p.images, p.price
       HAVING COUNT(oi.id) > 0
       ORDER BY order_count DESC
       LIMIT 3`,
      [retailerId]
    );

    res.json({
      success: true,
      data: {
        revenue: totalRevenue,
        totalOrders,
        pendingOrders,
        totalProducts,
        approvedProducts,
        lowStockCount,
        recentOrders: recentOrdersResult.rows,
        topProducts: topProductsResult.rows,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Update product (retailer only - can only update their own products)
router.put("/products/:id", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user || user.role !== "retailer") {
      return res.status(403).json({ success: false, message: "Only retailers can update products" });
    }

    const retailerId = await productService.getRetailerIdByUserId(user.id);
    if (!retailerId) {
      return res.status(404).json({ success: false, message: "Retailer profile not found" });
    }

    // Verify product belongs to this retailer
    const product = await productService.getProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }
    if (product.retailerId !== retailerId) {
      return res.status(403).json({ success: false, message: "You can only update your own products" });
    }

    const { name, description, price, stock, category, images, syncFromEpos, squareItemId } = req.body;
    const updatedProduct = await productService.updateProduct(req.params.id, {
      name,
      description,
      price,
      stock,
      category,
      images,
      syncFromEpos,
      squareItemId,
    });

    res.json({ success: true, data: updatedProduct });
  } catch (error) {
    next(error);
  }
});

// Delete product (retailer only - can only delete their own products)
router.delete("/products/:id", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user || user.role !== "retailer") {
      return res.status(403).json({ success: false, message: "Only retailers can delete products" });
    }

    const retailerId = await productService.getRetailerIdByUserId(user.id);
    if (!retailerId) {
      return res.status(404).json({ success: false, message: "Retailer profile not found" });
    }

    await productService.deleteProduct(req.params.id, retailerId);
    res.json({ success: true, message: "Product deleted successfully" });
  } catch (error: any) {
    if (error.message?.includes("not found") || error.message?.includes("permission")) {
      return res.status(403).json({ success: false, message: error.message });
    }
    next(error);
  }
});

// Approve product (admin only)
router.post("/products/:id/approve", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Only admins can approve products" });
    }

    const product = await productService.approveProduct(req.params.id);
    res.json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
});

// Cart routes
router.get("/cart", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const result = await pool.query(
      `SELECT ci.*, p.name, p.price, p.images, p.stock, p.retailer_id, r.business_name as retailer_name
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       JOIN retailers r ON p.retailer_id = r.id
       WHERE ci.user_id = $1
       ORDER BY ci.created_at DESC`,
      [user.id]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

router.post("/cart", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const { productId, quantity } = req.body;
    if (!productId || !quantity || quantity < 1) {
      return res.status(400).json({ success: false, message: "Invalid product or quantity" });
    }

    // Check if item already in cart
    const existing = await pool.query(
      "SELECT * FROM cart_items WHERE user_id = $1 AND product_id = $2",
      [user.id, productId]
    );

    if (existing.rows.length > 0) {
      // Update quantity
      await pool.query(
        "UPDATE cart_items SET quantity = quantity + $1 WHERE user_id = $2 AND product_id = $3",
        [quantity, user.id, productId]
      );
    } else {
      // Add new item
      await pool.query(
        "INSERT INTO cart_items (user_id, product_id, quantity) VALUES ($1, $2, $3)",
        [user.id, productId, quantity]
      );
    }

    res.json({ success: true, message: "Item added to cart" });
  } catch (error) {
    next(error);
  }
});

router.put("/cart/:productId", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const { quantity } = req.body;
    if (!quantity || quantity < 1) {
      return res.status(400).json({ success: false, message: "Quantity must be at least 1" });
    }

    // Check if item exists in cart
    const existing = await pool.query(
      "SELECT * FROM cart_items WHERE user_id = $1 AND product_id = $2",
      [user.id, req.params.productId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Item not found in cart" });
    }

    // Check stock availability
    const productResult = await pool.query(
      "SELECT stock FROM products WHERE id = $1",
      [req.params.productId]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const availableStock = productResult.rows[0].stock;
    if (quantity > availableStock) {
      return res.status(400).json({
        success: false,
        message: `Only ${availableStock} items available in stock`,
      });
    }

    // Update quantity
    await pool.query(
      "UPDATE cart_items SET quantity = $1 WHERE user_id = $2 AND product_id = $3",
      [quantity, user.id, req.params.productId]
    );

    res.json({ success: true, message: "Cart updated successfully" });
  } catch (error) {
    next(error);
  }
});

router.delete("/cart/:productId", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    await pool.query(
      "DELETE FROM cart_items WHERE user_id = $1 AND product_id = $2",
      [user.id, req.params.productId]
    );

    res.json({ success: true, message: "Item removed from cart" });
  } catch (error) {
    next(error);
  }
});

// Orders routes

// Create order from cart (customer only)
router.post("/orders", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user || user.role !== "customer") {
      return res.status(403).json({ success: false, message: "Only customers can create orders" });
    }

    // Get cart items with product and retailer info
    const cartResult = await pool.query(
      `SELECT ci.*, p.name, p.price, p.stock, p.retailer_id, 
              r.business_name as retailer_name, r.business_address, r.postcode, r.city
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       JOIN retailers r ON p.retailer_id = r.id
       WHERE ci.user_id = $1
       ORDER BY p.retailer_id, ci.created_at`,
      [user.id]
    );

    if (cartResult.rows.length === 0) {
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }

    // Validate stock and group by retailer
    const retailerGroups = new Map<string, typeof cartResult.rows>();
    const stockErrors: string[] = [];

    for (const item of cartResult.rows) {
      // Check stock availability
      if (item.stock < item.quantity) {
        stockErrors.push(`${item.name}: Only ${item.stock} available, requested ${item.quantity}`);
        continue;
      }

      // Group by retailer
      const retailerId = item.retailer_id;
      if (!retailerGroups.has(retailerId)) {
        retailerGroups.set(retailerId, []);
      }
      retailerGroups.get(retailerId)!.push(item);
    }

    if (stockErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Insufficient stock for some items",
        errors: stockErrors,
      });
    }

    // Handle discount code if provided
    const { discountCode, pointsToRedeem } = req.body;
    let discountAmount = 0;
    let pointsRedeemed = 0;

    // Validate and apply discount code
    if (discountCode) {
      try {
        const totalBeforeDiscount = cartResult.rows.reduce(
          (sum, item) => sum + parseFloat(item.price) * item.quantity,
          0
        );
        const validation = await rewardsService.validateDiscountCode(discountCode, totalBeforeDiscount);
        if (validation.valid) {
          discountAmount = validation.discount!.amount;
        }
      } catch (err) {
        // Discount code invalid, continue without it
        console.error('Discount code validation error:', err);
      }
    }

    // Handle points redemption
    if (pointsToRedeem && pointsToRedeem > 0) {
      try {
        const points = await rewardsService.getUserPoints(user.id);
        const redeemAmount = Math.min(pointsToRedeem, points.balance);
        if (redeemAmount > 0) {
          pointsRedeemed = redeemAmount;
        }
      } catch (err) {
        console.error('Points redemption error:', err);
      }
    }

    // Create orders for each retailer
    const createdOrders = [];

    for (const [retailerId, items] of retailerGroups) {
      // Calculate total for this retailer's order
      let total = items.reduce((sum, item) => sum + parseFloat(item.price) * item.quantity, 0);
      
      // Apply discount proportionally (if multiple retailers, split discount)
      const retailerDiscount = retailerGroups.size > 1 
        ? (discountAmount / retailerGroups.size) 
        : discountAmount;
      const retailerPoints = retailerGroups.size > 1
        ? (pointsRedeemed / retailerGroups.size)
        : pointsRedeemed;
      
      total = Math.max(0, total - retailerDiscount - retailerPoints);

      // Build pickup location from retailer address
      const retailer = items[0];
      const pickupLocationParts: string[] = [];
      if (retailer.business_address) pickupLocationParts.push(retailer.business_address);
      if (retailer.postcode) pickupLocationParts.push(retailer.postcode);
      if (retailer.city) pickupLocationParts.push(retailer.city);
      const pickupLocation = pickupLocationParts.length > 0 ? pickupLocationParts.join(", ") : null;

      // Get pickup instructions from request body if provided
      const { pickupInstructions } = req.body;

      // Create order with BOPIS fields
      const orderResult = await pool.query(
        `INSERT INTO orders (user_id, retailer_id, status, total, pickup_location, pickup_instructions, discount_amount, points_used)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          user.id,
          retailerId,
          "pending",
          total,
          pickupLocation,
          pickupInstructions || null,
          retailerDiscount,
          retailerPoints,
        ]
      );

      const order = orderResult.rows[0];

      // Apply discount code to order if provided
      if (discountCode && retailerDiscount > 0) {
        try {
          await rewardsService.applyDiscountCode(order.id, discountCode);
        } catch (err) {
          console.error('Failed to apply discount code:', err);
        }
      }

      // Redeem points if provided
      if (retailerPoints > 0) {
        try {
          await rewardsService.redeemPoints(user.id, order.id, retailerPoints);
        } catch (err) {
          console.error('Failed to redeem points:', err);
        }
      }

      // Create order items and update stock
      for (const item of items) {
        // Create order item
        await pool.query(
          `INSERT INTO order_items (order_id, product_id, quantity, price)
           VALUES ($1, $2, $3, $4)`,
          [order.id, item.product_id, item.quantity, item.price]
        );

        // Update product stock
        await pool.query(
          "UPDATE products SET stock = stock - $1 WHERE id = $2",
          [item.quantity, item.product_id]
        );

        // Remove from cart
        await pool.query(
          "DELETE FROM cart_items WHERE user_id = $1 AND product_id = $2",
          [user.id, item.product_id]
        );
      }

      // Get order with items for response
      const itemsResult = await pool.query(
        `SELECT oi.*, p.name as product_name, p.images
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = $1`,
        [order.id]
      );

      createdOrders.push({
        ...order,
        retailer_name: items[0].retailer_name,
        items: itemsResult.rows,
      });
    }

    // After creating orders, create Stripe checkout sessions
    const checkoutSessions = [];

    for (const order of createdOrders) {
      // Check if retailer has Stripe Connect
      const stripeAccount = await pool.query(
        `SELECT sca.stripe_account_id, sca.charges_enabled
         FROM stripe_connect_accounts sca
         WHERE sca.retailer_id = $1 AND sca.charges_enabled = true`,
        [order.retailer_id]
      );

      if (stripeAccount.rows.length > 0) {
        try {
          // Create Stripe checkout session
          const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
          const successUrl = `${frontendUrl}/orders/${order.id}?success=true`;
          const cancelUrl = `${frontendUrl}/checkout?canceled=true`;   

          const session = await stripeService.createCheckoutSession(
            order.id,
            order.retailer_id,
            parseFloat(order.total),
            'gbp',
            successUrl,
            cancelUrl,
            user.email // Pass customer email for Stripe Checkout
          );

          if (!session || !session.url) {
            console.error(`[Order] Stripe checkout session created but URL is missing for order ${order.id}`);
            throw new Error('Failed to create Stripe checkout session: Missing checkout URL');
          }

          // Update order with session ID
          await pool.query(
            'UPDATE orders SET stripe_session_id = $1 WHERE id = $2',
            [session.id, order.id]
          );

          checkoutSessions.push({
            orderId: order.id,
            checkoutUrl: session.url,
          });
        } catch (error: any) {
          console.error(`[Order] Failed to create Stripe checkout session for order ${order.id}:`, error);
          // If checkout session creation fails, we should still allow the order to be created
          // but log the error and potentially notify the user
          // For now, we'll continue but the frontend should handle the missing checkout session
        }
      } else {
        console.warn(`[Order] Retailer ${order.retailer_id} does not have Stripe Connect enabled. Order ${order.id} created without payment.`);
      }
    }

    // If we have orders but no checkout sessions, this is a problem
    // All orders should require payment via Stripe
    if (createdOrders.length > 0 && checkoutSessions.length === 0) {
      console.error('[Order] Orders created but no checkout sessions were created. This may indicate missing Stripe Connect setup.');
      // You might want to return an error here, or at least warn the user
      // For now, we'll allow it but the frontend should handle this case
    }

    // Award cashback points (1% of total order amount)
    const totalAmount = createdOrders.reduce((sum, o) => sum + parseFloat(o.total), 0);
    if (createdOrders.length > 0) {
      await rewardsService.awardCashback(user.id, createdOrders[0].id, totalAmount);
    }

    res.status(201).json({
      success: true,
      message: `Created ${createdOrders.length} order(s)`,
      data: {
        orders: createdOrders,
        checkoutSessions: checkoutSessions.length > 0 ? checkoutSessions : null,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get orders
router.get("/orders", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    let query = `
      SELECT o.*, r.business_name as retailer_name,
             u.username as customer_name, u.email as customer_email,
             (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count
      FROM orders o
      JOIN retailers r ON o.retailer_id = r.id
      JOIN users u ON o.user_id = u.id
      WHERE 1=1
    `;

    let params: string[] = [];

    if (user.role === "customer") {
      query += ` AND o.user_id = $1`;
      params = [user.id];
    } else if (user.role === "retailer") {
      const retailerId = await productService.getRetailerIdByUserId(user.id);
      if (retailerId) {
        query += ` AND o.retailer_id = $1`;
        params = [retailerId];
      } else {
        return res.json({ success: true, data: [] });
      }
    }

    query += ` ORDER BY o.created_at DESC`;

    const result = await pool.query(query, params);

    // Get order items for each order
    const ordersWithItems = await Promise.all(
      result.rows.map(async (order) => {
        const itemsResult = await pool.query(
          `SELECT oi.*, p.name as product_name, p.images
           FROM order_items oi
           JOIN products p ON oi.product_id = p.id
           WHERE oi.order_id = $1`,
          [order.id]
        );
        return {
          ...order,
          items: itemsResult.rows,
        };
      })
    );

    res.json({ success: true, data: ordersWithItems });
  } catch (error) {
    next(error);
  }
});

// Get order by ID
router.get("/orders/:id", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const orderResult = await pool.query(
      `SELECT o.*, r.business_name as retailer_name,
              u.username as customer_name, u.email as customer_email
       FROM orders o
       JOIN retailers r ON o.retailer_id = r.id
       JOIN users u ON o.user_id = u.id
       WHERE o.id = $1`,
      [req.params.id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const order = orderResult.rows[0];

    // Check permissions
    if (user.role === "customer" && order.user_id !== user.id) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    if (user.role === "retailer") {
      const retailerId = await productService.getRetailerIdByUserId(user.id);
      if (!retailerId || order.retailer_id !== retailerId) {
        return res.status(403).json({ success: false, message: "Access denied" });
      }
    }

    // Get order items
    const itemsResult = await pool.query(
      `SELECT oi.*, p.name as product_name, p.images, p.description as product_description
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = $1`,
      [order.id]
    );

    res.json({
      success: true,
      data: {
        ...order,
        items: itemsResult.rows,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Update order status (retailer only)
router.put("/orders/:id/status", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user || user.role !== "retailer") {
      return res.status(403).json({ success: false, message: "Only retailers can update order status" });
    }

    const { status } = req.body;
    const validStatuses = ["pending", "processing", "shipped", "delivered", "cancelled", "ready_for_pickup", "picked_up"];
    
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    const retailerId = await productService.getRetailerIdByUserId(user.id);
    if (!retailerId) {
      return res.status(404).json({ success: false, message: "Retailer profile not found" });
    }

    // Verify order belongs to this retailer
    const orderResult = await pool.query(
      "SELECT * FROM orders WHERE id = $1 AND retailer_id = $2",
      [req.params.id, retailerId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Order not found or access denied" });
    }

    // Update order status with BOPIS timestamp tracking
    let updateQuery = `UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP`;
    const updateParams: any[] = [status, req.params.id];
    let paramCount = 2;

    // Set timestamps for BOPIS statuses
    if (status === "ready_for_pickup") {
      updateQuery += `, ready_for_pickup_at = CURRENT_TIMESTAMP`;
    } else if (status === "picked_up") {
      updateQuery += `, picked_up_at = CURRENT_TIMESTAMP`;
    }

    updateQuery += ` WHERE id = $${paramCount} RETURNING *`;

    const updatedResult = await pool.query(updateQuery, updateParams);

    // Get order with items for response
    const order = updatedResult.rows[0];
    const itemsResult = await pool.query(
      `SELECT oi.*, p.name as product_name, p.images
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = $1`,
      [order.id]
    );

    res.json({
      success: true,
      message: "Order status updated successfully",
      data: {
        ...order,
        items: itemsResult.rows,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Reviews routes

// Get reviews for a product
router.get("/products/:id/reviews", async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT r.*, u.username, u.email
       FROM reviews r
       JOIN users u ON r.user_id = u.id
       WHERE r.product_id = $1
       ORDER BY r.created_at DESC`,
      [req.params.id]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// Submit a review (customer only, must have purchased the product)
router.post("/products/:id/reviews", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user || user.role !== "customer") {
      return res.status(403).json({ success: false, message: "Only customers can submit reviews" });
    }

    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 1 and 5",
      });
    }

    // Check if product exists
    const productResult = await pool.query("SELECT id FROM products WHERE id = $1", [req.params.id]);
    if (productResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    // Check if user has purchased this product (optional validation - can be made stricter)
    const orderCheck = await pool.query(
      `SELECT oi.id
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       WHERE oi.product_id = $1 AND o.user_id = $2 AND o.status = 'delivered'
       LIMIT 1`,
      [req.params.id, user.id]
    );

    // Allow review even if not purchased (for MVP - can be made stricter later)
    // if (orderCheck.rows.length === 0) {
    //   return res.status(403).json({
    //     success: false,
    //     message: "You must purchase and receive this product before reviewing",
    //   });
    // }

    // Check if user already reviewed this product
    const existingReview = await pool.query(
      "SELECT id FROM reviews WHERE product_id = $1 AND user_id = $2",
      [req.params.id, user.id]
    );

    if (existingReview.rows.length > 0) {
      // Update existing review
      await pool.query(
        `UPDATE reviews 
         SET rating = $1, comment = $2, updated_at = CURRENT_TIMESTAMP
         WHERE product_id = $3 AND user_id = $4
         RETURNING *`,
        [rating, comment || null, req.params.id, user.id]
      );
    } else {
      // Create new review
      await pool.query(
        `INSERT INTO reviews (product_id, user_id, rating, comment)
         VALUES ($1, $2, $3, $4)`,
        [req.params.id, user.id, rating, comment || null]
      );
    }

    // Update product review statistics
    const statsResult = await pool.query(
      `SELECT 
         COUNT(*) as review_count,
         COALESCE(AVG(rating), 0) as average_rating
       FROM reviews
       WHERE product_id = $1`,
      [req.params.id]
    );

    const stats = statsResult.rows[0];
    await pool.query(
      `UPDATE products 
       SET review_count = $1, average_rating = ROUND($2::numeric, 2)
       WHERE id = $3`,
      [parseInt(stats.review_count), parseFloat(stats.average_rating), req.params.id]
    );

    res.json({ success: true, message: "Review submitted successfully" });
  } catch (error) {
    next(error);
  }
});

// Wishlist routes

// Get user's wishlist
router.get("/wishlist", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const result = await pool.query(
      `SELECT w.*, p.name, p.price, p.images, p.category, 
              r.business_name as retailer_name,
              COALESCE(p.review_count, 0) as review_count,
              COALESCE(p.average_rating, 0) as average_rating
       FROM wishlist_items w
       JOIN products p ON w.product_id = p.id
       JOIN retailers r ON p.retailer_id = r.id
       WHERE w.user_id = $1
       ORDER BY w.created_at DESC`,
      [user.id]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// Check if product is in wishlist (for multiple products) - MUST come before /wishlist/:productId
router.post("/wishlist/check", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const { productIds } = req.body;
    if (!Array.isArray(productIds)) {
      return res.status(400).json({ success: false, message: "productIds must be an array" });
    }

    if (productIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // Ensure all IDs are strings and valid
    const validIds = productIds.filter(id => id && typeof id === 'string');

    if (validIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // Use a simpler query with proper array handling
    const result = await pool.query(
      `SELECT product_id 
       FROM wishlist_items 
       WHERE user_id = $1 
       AND product_id = ANY($2)`,
      [user.id, validIds]
    );

    const wishlistProductIds = result.rows.map((row) => row.product_id);
    res.json({ success: true, data: wishlistProductIds });
  } catch (error) {
    console.error("Wishlist check error:", error);
    next(error);
  }
});

// Add product to wishlist - MUST come after /wishlist/check
router.post("/wishlist/:productId", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    // Check if product exists
    const productCheck = await pool.query(
      "SELECT id FROM products WHERE id = $1",
      [req.params.productId]
    );

    if (productCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    // Check if already in wishlist
    const existing = await pool.query(
      "SELECT id FROM wishlist_items WHERE user_id = $1 AND product_id = $2",
      [user.id, req.params.productId]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, message: "Product already in wishlist" });
    }

    // Add to wishlist
    await pool.query(
      "INSERT INTO wishlist_items (user_id, product_id) VALUES ($1, $2)",
      [user.id, req.params.productId]
    );

    res.json({ success: true, message: "Product added to wishlist" });
  } catch (error) {
    next(error);
  }
});

// Remove product from wishlist
router.delete("/wishlist/:productId", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    await pool.query(
      "DELETE FROM wishlist_items WHERE user_id = $1 AND product_id = $2",
      [user.id, req.params.productId]
    );

    res.json({ success: true, message: "Product removed from wishlist" });
  } catch (error) {
    next(error);
  }
});

// Image upload endpoint
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer storage
const multerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.resolve(__dirname, "..", "..", "public", "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `product-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage: multerStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error("Only image files (jpeg, jpg, png, gif, webp) are allowed"));
    }
  },
});

router.post("/upload/image", isAuthenticated, upload.single("image"), async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    // Return the URL to access the uploaded file
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({
      success: true,
      data: {
        url: fileUrl,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Retailer approval (admin only)
router.get("/retailers/pending", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Only admins can access this" });
    }

    const result = await pool.query(
      `SELECT r.*, u.username, u.email
       FROM retailers r
       JOIN users u ON r.user_id = u.id
       WHERE r.is_approved = false
       ORDER BY r.created_at DESC`
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

router.post("/retailers/:id/approve", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Only admins can approve retailers" });
    }

    await pool.query(
      "UPDATE retailers SET is_approved = true WHERE id = $1",
      [req.params.id]
    );

    res.json({ success: true, message: "Retailer approved" });
  } catch (error) {
    next(error);
  }
});

// Create admin user (one-time setup - only works if no admin exists)
router.post("/admin/setup", async (req, res, next) => {
  try {
    // Check if any admin already exists
    const adminCheck = await pool.query(
      "SELECT id FROM users WHERE role = 'admin' LIMIT 1"
    );

    if (adminCheck.rows.length > 0) {
      return res.status(403).json({
        success: false,
        message: "Admin user already exists. Use the script to create additional admins.",
      });
    }

    // Validate input
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Username, email, and password are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    // Check if user already exists
    const existingUser = await storage.getUserByUsername(username) ||
      await storage.getUserByEmail(email);
    
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Username or email already exists",
      });
    }

    // Create admin user
    const user = await storage.createUser({
      username,
      email,
      password,
      role: "admin",
    });

    // Return user without password
    const { password: _, ...publicUser } = user;
    res.status(201).json({
      success: true,
      message: "Admin user created successfully",
      data: publicUser,
    });
  } catch (error: any) {
    if (error.message === "Username or email already exists") {
      return res.status(409).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
});

// Get support admin ID for chat
router.get("/admin/support", async (req, res, next) => {
  try {
    // Get the first admin user (for support chat)
    const result = await pool.query(
      "SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1"
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No admin user found. Please create an admin account first.",
      });
    }

    res.json({
      success: true,
      data: {
        adminId: result.rows[0].id,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Admin: Get all orders
router.get("/admin/orders", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Only admins can access this" });
    }

    const { status } = req.query;
    let query = `
      SELECT o.*, r.business_name as retailer_name,
             u.username as customer_name, u.email as customer_email,
             (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count
      FROM orders o
      JOIN retailers r ON o.retailer_id = r.id
      JOIN users u ON o.user_id = u.id
      WHERE 1=1
    `;

    const params: string[] = [];
    if (status && status !== "all") {
      query += ` AND o.status = $1`;
      params.push(status as string);
    }

    query += ` ORDER BY o.created_at DESC`;

    const result = await pool.query(query, params);

    // Get order items for each order
    const ordersWithItems = await Promise.all(
      result.rows.map(async (order) => {
        const itemsResult = await pool.query(
          `SELECT oi.*, p.name as product_name, p.images
           FROM order_items oi
           JOIN products p ON oi.product_id = p.id
           WHERE oi.order_id = $1`,
          [order.id]
        );
        return {
          ...order,
          items: itemsResult.rows,
        };
      })
    );

    res.json({ success: true, data: ordersWithItems });
  } catch (error) {
    next(error);
  }
});

// Admin: Get order by ID
router.get("/admin/orders/:id", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Only admins can access this" });
    }

    const orderResult = await pool.query(
      `SELECT o.*, r.business_name as retailer_name,
              u.username as customer_name, u.email as customer_email
       FROM orders o
       JOIN retailers r ON o.retailer_id = r.id
       JOIN users u ON o.user_id = u.id
       WHERE o.id = $1`,
      [req.params.id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const order = orderResult.rows[0];

    // Get order items
    const itemsResult = await pool.query(
      `SELECT oi.*, p.name as product_name, p.images, p.category
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = $1`,
      [order.id]
    );

    res.json({
      success: true,
      data: {
        ...order,
        items: itemsResult.rows,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Admin: Get/Update commission settings
router.get("/admin/settings/commission", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Only admins can access this" });
    }

    const result = await pool.query(
      "SELECT setting_value FROM platform_settings WHERE setting_key = 'commission_rate'"
    );

    const commissionRate = result.rows[0]?.setting_value || "0.10";

    res.json({
      success: true,
      data: {
        commissionRate: parseFloat(commissionRate),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.put("/admin/settings/commission", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Only admins can access this" });
    }

    const { commissionRate } = req.body;
    if (typeof commissionRate !== "number" || commissionRate < 0 || commissionRate > 1) {
      return res.status(400).json({
        success: false,
        message: "Commission rate must be a number between 0 and 1",
      });
    }

    await pool.query(
      `INSERT INTO platform_settings (setting_key, setting_value, updated_by)
       VALUES ('commission_rate', $1, $2)
       ON CONFLICT (setting_key) 
       DO UPDATE SET setting_value = $1, updated_by = $2, updated_at = CURRENT_TIMESTAMP`,
      [commissionRate.toString(), user.id]
    );

    res.json({
      success: true,
      message: "Commission rate updated successfully",
      data: { commissionRate },
    });
  } catch (error) {
    next(error);
  }
});

// Public: Get active categories (for search page and product creation)
router.get("/categories", async (req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT id, name, description FROM categories WHERE is_active = TRUE ORDER BY name ASC"
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// Admin: Category management
router.get("/admin/categories", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Only admins can access this" });
    }

    const result = await pool.query(
      "SELECT * FROM categories ORDER BY name ASC"
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

router.post("/admin/categories", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Only admins can access this" });
    }

    const { name, description } = req.body;
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ success: false, message: "Category name is required" });
    }

    const result = await pool.query(
      `INSERT INTO categories (name, description)
       VALUES ($1, $2)
       RETURNING *`,
      [name.trim(), description || null]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    if (error.code === "23505") {
      return res.status(409).json({ success: false, message: "Category name already exists" });
    }
    next(error);
  }
});

router.put("/admin/categories/:id", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Only admins can access this" });
    }

    const { name, description, is_active } = req.body;
    const updates: string[] = [];
    const params: any[] = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      params.push(name.trim());
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      params.push(description || null);
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      params.push(is_active);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: "No fields to update" });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(req.params.id);

    const result = await pool.query(
      `UPDATE categories SET ${updates.join(", ")} WHERE id = $${paramCount} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    if (error.code === "23505") {
      return res.status(409).json({ success: false, message: "Category name already exists" });
    }
    next(error);
  }
});

router.delete("/admin/categories/:id", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Only admins can access this" });
    }

    const result = await pool.query("DELETE FROM categories WHERE id = $1 RETURNING *", [
      req.params.id,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    res.json({ success: true, message: "Category deleted successfully" });
  } catch (error) {
    next(error);
  }
});

// Admin: Review moderation
router.get("/admin/reviews", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Only admins can access this" });
    }

    const { status } = req.query;
    let query = `
      SELECT r.*, p.name as product_name, u.username as user_name, u.email as user_email
      FROM reviews r
      JOIN products p ON r.product_id = p.id
      JOIN users u ON r.user_id = u.id
      WHERE 1=1
    `;

    const params: string[] = [];
    if (status === "pending") {
      query += ` AND r.is_approved = FALSE`;
    } else if (status === "flagged") {
      query += ` AND r.is_flagged = TRUE`;
    } else if (status === "approved") {
      query += ` AND r.is_approved = TRUE AND r.is_flagged = FALSE`;
    }

    query += ` ORDER BY r.created_at DESC`;

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

router.put("/admin/reviews/:id/approve", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Only admins can access this" });
    }

    const { approve } = req.body;
    const result = await pool.query(
      `UPDATE reviews SET is_approved = $1, is_flagged = FALSE, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 RETURNING *`,
      [approve !== false, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

router.put("/admin/reviews/:id/flag", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Only admins can access this" });
    }

    const { flag } = req.body;
    const result = await pool.query(
      `UPDATE reviews SET is_flagged = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 RETURNING *`,
      [flag !== false, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

router.delete("/admin/reviews/:id", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Only admins can access this" });
    }

    const result = await pool.query("DELETE FROM reviews WHERE id = $1 RETURNING *", [
      req.params.id,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }

    res.json({ success: true, message: "Review deleted successfully" });
  } catch (error) {
    next(error);
  }
});

// Get Square catalog items
router.get("/retailer/square/items", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user || user.role !== "retailer") {
      return res.status(403).json({ success: false, message: "Only retailers can access this" });
    }

    const retailerResult = await pool.query(
      `SELECT square_access_token, square_location_id
       FROM retailers WHERE user_id = $1`,
      [user.id]
    );

    if (retailerResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Retailer profile not found" });
    }

    const retailer = retailerResult.rows[0];

    if (!retailer.square_access_token || !retailer.square_location_id) {
      return res.status(400).json({ success: false, message: "Square account not connected" });
    }

    const items = await squareService.getCatalogItems(
      retailer.square_access_token,
      retailer.square_location_id
    );

    res.json({
      success: true,
      data: items,
    });
  } catch (error: any) {
    next(error);
  }
});

// Get Square item details (price, stock)
router.get("/retailer/square/items/:itemId/details", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user || user.role !== "retailer") {
      return res.status(403).json({ success: false, message: "Only retailers can access this" });
    }

    const retailerResult = await pool.query(
      `SELECT square_access_token, square_location_id
       FROM retailers WHERE user_id = $1`,
      [user.id]
    );

    if (retailerResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Retailer profile not found" });
    }

    const retailer = retailerResult.rows[0];

    if (!retailer.square_access_token || !retailer.square_location_id) {
      return res.status(400).json({ success: false, message: "Square account not connected" });
    }

    const details = await squareService.getItemDetails(
      retailer.square_access_token,
      retailer.square_location_id,
      req.params.itemId
    );

    res.json({
      success: true,
      data: details,
    });
  } catch (error: any) {
    next(error);
  }
});

// ==================== RETAILER POSTS ====================

// Create retailer post
router.post("/retailer/posts", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user || user.role !== "retailer") {
      return res.status(403).json({ success: false, message: "Only retailers can create posts" });
    }

    const retailerResult = await pool.query(
      "SELECT id FROM retailers WHERE user_id = $1",
      [user.id]
    );

    if (retailerResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Retailer profile not found" });
    }

    const retailerId = retailerResult.rows[0].id;
    const { content, images } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ success: false, message: "Post content is required" });
    }

    const result = await pool.query(
      `INSERT INTO retailer_posts (retailer_id, content, images)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [retailerId, content.trim(), images || []]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Get retailer's own posts
router.get("/retailer/posts", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user || user.role !== "retailer") {
      return res.status(403).json({ success: false, message: "Only retailers can access this" });
    }

    const retailerResult = await pool.query(
      "SELECT id FROM retailers WHERE user_id = $1",
      [user.id]
    );

    if (retailerResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Retailer profile not found" });
    }

    const retailerId = retailerResult.rows[0].id;

    const result = await pool.query(
      `SELECT * FROM retailer_posts 
       WHERE retailer_id = $1 
       ORDER BY created_at DESC`,
      [retailerId]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// Get public retailer posts
router.get("/retailer/:retailerId/posts", async (req, res, next) => {
  try {
    const { retailerId } = req.params;

    const result = await pool.query(
      `SELECT p.*, r.business_name as retailer_name, r.banner_image as retailer_banner_image
       FROM retailer_posts p
       JOIN retailers r ON p.retailer_id = r.id
       WHERE p.retailer_id = $1 AND r.is_approved = true
       ORDER BY p.created_at DESC`,
      [retailerId]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// Update retailer post
router.put("/retailer/posts/:postId", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user || user.role !== "retailer") {
      return res.status(403).json({ success: false, message: "Only retailers can update posts" });
    }

    const retailerResult = await pool.query(
      "SELECT id FROM retailers WHERE user_id = $1",
      [user.id]
    );

    if (retailerResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Retailer profile not found" });
    }

    const retailerId = retailerResult.rows[0].id;
    const { content, images } = req.body;

    // Verify post belongs to retailer
    const postCheck = await pool.query(
      "SELECT retailer_id FROM retailer_posts WHERE id = $1",
      [req.params.postId]
    );

    if (postCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    if (postCheck.rows[0].retailer_id !== retailerId) {
      return res.status(403).json({ success: false, message: "You can only update your own posts" });
    }

    const result = await pool.query(
      `UPDATE retailer_posts 
       SET content = $1, images = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [content.trim(), images || [], req.params.postId]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Delete retailer post
router.delete("/retailer/posts/:postId", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user || user.role !== "retailer") {
      return res.status(403).json({ success: false, message: "Only retailers can delete posts" });
    }

    const retailerResult = await pool.query(
      "SELECT id FROM retailers WHERE user_id = $1",
      [user.id]
    );

    if (retailerResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Retailer profile not found" });
    }

    const retailerId = retailerResult.rows[0].id;

    // Verify post belongs to retailer
    const postCheck = await pool.query(
      "SELECT retailer_id FROM retailer_posts WHERE id = $1",
      [req.params.postId]
    );

    if (postCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    if (postCheck.rows[0].retailer_id !== retailerId) {
      return res.status(403).json({ success: false, message: "You can only delete your own posts" });
    }

    await pool.query("DELETE FROM retailer_posts WHERE id = $1", [req.params.postId]);

    res.json({ success: true, message: "Post deleted successfully" });
  } catch (error) {
    next(error);
  }
});

// ==================== RETAILER FOLLOWERS ====================

// Follow retailer
router.post("/retailer/:retailerId/follow", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const { retailerId } = req.params;

    // Check if retailer exists and is approved
    const retailerCheck = await pool.query(
      "SELECT id FROM retailers WHERE id = $1 AND is_approved = true",
      [retailerId]
    );

    if (retailerCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Retailer not found" });
    }

    // Check if already following
    const existing = await pool.query(
      "SELECT id FROM retailer_followers WHERE retailer_id = $1 AND user_id = $2",
      [retailerId, user.id]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, message: "Already following this retailer" });
    }

    await pool.query(
      "INSERT INTO retailer_followers (retailer_id, user_id) VALUES ($1, $2)",
      [retailerId, user.id]
    );

    res.json({ success: true, message: "Successfully followed retailer" });
  } catch (error) {
    next(error);
  }
});

// Unfollow retailer
router.delete("/retailer/:retailerId/follow", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const { retailerId } = req.params;

    await pool.query(
      "DELETE FROM retailer_followers WHERE retailer_id = $1 AND user_id = $2",
      [retailerId, user.id]
    );

    res.json({ success: true, message: "Successfully unfollowed retailer" });
  } catch (error) {
    next(error);
  }
});

// Get retailer followers count
router.get("/retailer/:retailerId/followers/count", async (req, res, next) => {
  try {
    const { retailerId } = req.params;

    const result = await pool.query(
      "SELECT COUNT(*) as count FROM retailer_followers WHERE retailer_id = $1",
      [retailerId]
    );

    res.json({ success: true, data: { count: parseInt(result.rows[0].count) } });
  } catch (error) {
    next(error);
  }
});

// Check if user is following retailer
router.get("/retailer/:retailerId/follow", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      return res.json({ success: true, data: { isFollowing: false } });
    }

    const { retailerId } = req.params;

    const result = await pool.query(
      "SELECT id FROM retailer_followers WHERE retailer_id = $1 AND user_id = $2",
      [retailerId, user.id]
    );

    res.json({ success: true, data: { isFollowing: result.rows.length > 0 } });
  } catch (error) {
    next(error);
  }
});

// Get retailers user follows
router.get("/user/following", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const result = await pool.query(
      `SELECT r.*, rf.created_at as followed_at
       FROM retailers r
       JOIN retailer_followers rf ON r.id = rf.retailer_id
       WHERE rf.user_id = $1 AND r.is_approved = true
       ORDER BY rf.created_at DESC`,
      [user.id]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// Get public retailer profile with follower count
router.get("/retailer/:retailerId/public", async (req, res, next) => {
  try {
    const { retailerId } = req.params;
    const user = getCurrentUser(req);

    const result = await pool.query(
      `SELECT r.*, 
       (SELECT COUNT(*) FROM retailer_followers WHERE retailer_id = r.id) as follower_count
       FROM retailers r
       WHERE r.id = $1 AND r.is_approved = true`,
      [retailerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Retailer not found" });
    }

    const retailer = result.rows[0];

    // Check if user is following (if authenticated)
    let isFollowing = false;
    if (user) {
      const followCheck = await pool.query(
        "SELECT id FROM retailer_followers WHERE retailer_id = $1 AND user_id = $2",
        [retailerId, user.id]
      );
      isFollowing = followCheck.rows.length > 0;
    }

    res.json({
      success: true,
      data: {
        ...retailer,
        isFollowing,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ==================== RETAILER PAYOUTS ====================

// Get or create payout settings
router.get("/retailer/payout-settings", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user || user.role !== "retailer") {
      return res.status(403).json({ success: false, message: "Only retailers can access this" });
    }

    const retailerResult = await pool.query(
      "SELECT id FROM retailers WHERE user_id = $1",
      [user.id]
    );

    if (retailerResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Retailer profile not found" });
    }

    const retailerId = retailerResult.rows[0].id;

    const result = await pool.query(
      "SELECT * FROM retailer_payout_settings WHERE retailer_id = $1",
      [retailerId]
    );

    if (result.rows.length === 0) {
      res.json({ success: true, data: null });
    } else {
      // Don't send sensitive account details in full
      const settings = result.rows[0];
      res.json({
        success: true,
        data: {
          id: settings.id,
          retailerId: settings.retailer_id,
          payoutMethod: settings.payout_method,
          isVerified: settings.is_verified,
          createdAt: settings.created_at,
          updatedAt: settings.updated_at,
          // Only show masked account details
          accountDetails: settings.account_details
            ? { last4: settings.account_details.last4 || "****" }
            : null,
        },
      });
    }
  } catch (error) {
    next(error);
  }
});

// Create or update payout settings
router.put("/retailer/payout-settings", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user || user.role !== "retailer") {
      return res.status(403).json({ success: false, message: "Only retailers can update payout settings" });
    }

    const retailerResult = await pool.query(
      "SELECT id FROM retailers WHERE user_id = $1",
      [user.id]
    );

    if (retailerResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Retailer profile not found" });
    }

    const retailerId = retailerResult.rows[0].id;
    const { payoutMethod, accountDetails } = req.body;

    if (!payoutMethod || !['bank', 'paypal', 'stripe'].includes(payoutMethod)) {
      return res.status(400).json({ success: false, message: "Valid payout method is required" });
    }

    if (!accountDetails) {
      return res.status(400).json({ success: false, message: "Account details are required" });
    }

    // Check if settings exist
    const existing = await pool.query(
      "SELECT id FROM retailer_payout_settings WHERE retailer_id = $1",
      [retailerId]
    );

    let result;
    if (existing.rows.length > 0) {
      // Update existing
      result = await pool.query(
        `UPDATE retailer_payout_settings 
         SET payout_method = $1, account_details = $2, updated_at = CURRENT_TIMESTAMP
         WHERE retailer_id = $3
         RETURNING *`,
        [payoutMethod, JSON.stringify(accountDetails), retailerId]
      );
    } else {
      // Create new
      result = await pool.query(
        `INSERT INTO retailer_payout_settings (retailer_id, payout_method, account_details)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [retailerId, payoutMethod, JSON.stringify(accountDetails)]
      );
    }

    res.json({
      success: true,
      message: "Payout settings saved successfully",
      data: {
        id: result.rows[0].id,
        retailerId: result.rows[0].retailer_id,
        payoutMethod: result.rows[0].payout_method,
        isVerified: result.rows[0].is_verified,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get payout history
router.get("/retailer/payouts", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user || user.role !== "retailer") {
      return res.status(403).json({ success: false, message: "Only retailers can access this" });
    }

    const retailerResult = await pool.query(
      "SELECT id FROM retailers WHERE user_id = $1",
      [user.id]
    );

    if (retailerResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Retailer profile not found" });
    }

    const retailerId = retailerResult.rows[0].id;

    const result = await pool.query(
      `SELECT * FROM payouts 
       WHERE retailer_id = $1 
       ORDER BY created_at DESC
       LIMIT 50`,
      [retailerId]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// Request payout
router.post("/retailer/payouts/request", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user || user.role !== "retailer") {
      return res.status(403).json({ success: false, message: "Only retailers can request payouts" });
    }

    const retailerResult = await pool.query(
      "SELECT id FROM retailers WHERE user_id = $1",
      [user.id]
    );

    if (retailerResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Retailer profile not found" });
    }

    const retailerId = retailerResult.rows[0].id;

    // Check payout settings
    const settingsResult = await pool.query(
      "SELECT * FROM retailer_payout_settings WHERE retailer_id = $1",
      [retailerId]
    );

    if (settingsResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please configure payout settings first",
      });
    }

    const { amount, notes, currency } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: "Valid amount is required" });
    }

    const payoutMethod = settingsResult.rows[0].payout_method;

    const allowedCurrencies = ["GBP", "USD", "EUR"];
    const payoutCurrency = (currency || BASE_CURRENCY).toUpperCase();
    if (!allowedCurrencies.includes(payoutCurrency)) {
      return res.status(400).json({
        success: false,
        message: `Unsupported currency. Allowed: ${allowedCurrencies.join(", ")}`,
      });
    }

    const amountBase = toBaseCurrency(amount, payoutCurrency);

    // Calculate available balance in base currency (GBP):
    // - use retailer_amount when present (excludes platform commission), fall back to total
    // - only count orders that are beyond "pending" and not cancelled
    // - subtract both completed and in-flight payouts to avoid double requesting
    const revenueResult = await pool.query(
      `SELECT COALESCE(SUM(COALESCE(retailer_amount, total)), 0) AS total_revenue
       FROM orders 
       WHERE retailer_id = $1 
         AND status NOT IN ('cancelled', 'pending')`,
      [retailerId]
    );

    const completedPayoutsResult = await pool.query(
      `SELECT COALESCE(SUM(COALESCE(amount_base, amount)), 0) AS total_payouts
       FROM payouts 
       WHERE retailer_id = $1 AND status = 'completed'`,
      [retailerId]
    );

    const pendingPayoutsResult = await pool.query(
      `SELECT COALESCE(SUM(COALESCE(amount_base, amount)), 0) AS pending_payouts
       FROM payouts 
       WHERE retailer_id = $1 AND status IN ('pending', 'processing')`,
      [retailerId]
    );

    const totalRevenue = parseFloat(revenueResult.rows[0].total_revenue);
    const totalPayouts = parseFloat(completedPayoutsResult.rows[0].total_payouts);
    const pendingPayouts = parseFloat(pendingPayoutsResult.rows[0].pending_payouts);
    const availableBalance = totalRevenue - totalPayouts - pendingPayouts;

    if (amountBase > availableBalance) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Available: £${availableBalance.toFixed(2)} (base currency)`,
      });
    }

    // Record payout
    const result = await pool.query(
      `INSERT INTO payouts (retailer_id, amount, currency, amount_base, payout_method, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [retailerId, amount, payoutCurrency, amountBase, payoutMethod, notes || null]
    );

    const payoutRow = result.rows[0];

    // Attempt Stripe transfer to connected account using base currency (GBP)
    let transferId: string | null = null;
    let status: "pending" | "processing" | "completed" | "failed" = "processing";

    try {
      const transfer = await stripeService.createTransferToConnectedAccount({
        retailerId,
        amountBase,
        currency: BASE_CURRENCY,
        metadata: {
          payout_id: payoutRow.id,
          retailer_id: retailerId,
        },
      });
      transferId = transfer.id;
      const transferStatus = (transfer as any).status as string | undefined;
      if (transferStatus === "paid") {
        status = "completed";
      }
    } catch (err: any) {
      status = "failed";
      await pool.query(
        `UPDATE payouts 
         SET status = $1, transaction_id = $2, processed_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [status, transferId, payoutRow.id]
      );
      throw err;
    }

    const updateResult = await pool.query(
      `UPDATE payouts 
       SET status = $1,
           transaction_id = $2,
           processed_at = CURRENT_TIMESTAMP,
           completed_at = CASE WHEN $1 = 'completed' THEN CURRENT_TIMESTAMP ELSE NULL END
       WHERE id = $3
       RETURNING *`,
      [status, transferId, payoutRow.id]
    );

    res.status(201).json({
      success: true,
      message: status === "completed" ? "Payout sent successfully" : "Payout initiated",
      data: updateResult.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// Get retailer earnings summary
router.get("/retailer/earnings", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user || user.role !== "retailer") {
      return res.status(403).json({ success: false, message: "Only retailers can access this" });
    }

    const retailerResult = await pool.query(
      "SELECT id FROM retailers WHERE user_id = $1",
      [user.id]
    );

    if (retailerResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Retailer profile not found" });
    }

    const retailerId = retailerResult.rows[0].id;

    // Total revenue (net to retailer)
    const revenueResult = await pool.query(
      `SELECT COALESCE(SUM(COALESCE(retailer_amount, total)), 0) AS total_revenue
       FROM orders 
       WHERE retailer_id = $1 
         AND status NOT IN ('cancelled', 'pending')`,
      [retailerId]
    );

    // Completed payouts
    const completedPayoutsResult = await pool.query(
      `SELECT COALESCE(SUM(COALESCE(amount_base, amount)), 0) AS total_payouts
       FROM payouts 
       WHERE retailer_id = $1 AND status = 'completed'`,
      [retailerId]
    );

    // Pending payouts
    const pendingPayoutsResult = await pool.query(
      `SELECT COALESCE(SUM(COALESCE(amount_base, amount)), 0) AS pending_payouts
       FROM payouts 
       WHERE retailer_id = $1 AND status IN ('pending', 'processing')`,
      [retailerId]
    );

    const totalRevenue = parseFloat(revenueResult.rows[0].total_revenue);
    const totalPayouts = parseFloat(completedPayoutsResult.rows[0].total_payouts);
    const pendingPayouts = parseFloat(pendingPayoutsResult.rows[0].pending_payouts);
    const availableBalance = totalRevenue - totalPayouts - pendingPayouts;

    res.json({
      success: true,
      data: {
        totalRevenue,
        totalPayouts,
        pendingPayouts,
        availableBalance,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Update retailer banner image
router.put("/retailer/banner", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user || user.role !== "retailer") {
      return res.status(403).json({ success: false, message: "Only retailers can update banner" });
    }

    const { bannerImage } = req.body;

    const retailerResult = await pool.query(
      "SELECT id FROM retailers WHERE user_id = $1",
      [user.id]
    );

    if (retailerResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Retailer profile not found" });
    }

    const retailerId = retailerResult.rows[0].id;

    const result = await pool.query(
      `UPDATE retailers 
       SET banner_image = $1
       WHERE id = $2
       RETURNING *`,
      [bannerImage || null, retailerId]
    );

    res.json({
      success: true,
      message: "Banner image updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// ==================== STRIPE CONNECT ====================

// Create Stripe Connect account (legacy) – now a no-op that returns existing mapping
router.post("/retailer/stripe/connect", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user || user.role !== "retailer") {
      return res.status(403).json({ success: false, message: "Only retailers can connect Stripe" });
    }

    const retailerResult = await pool.query(
      "SELECT id, business_name FROM retailers WHERE user_id = $1",
      [user.id]
    );

    if (retailerResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Retailer profile not found" });
    }

    const retailer = retailerResult.rows[0];

    // Check if already connected
    const existing = await pool.query(
      "SELECT stripe_account_id, charges_enabled, payouts_enabled FROM stripe_connect_accounts WHERE retailer_id = $1",
      [retailer.id]
    );

    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      return res.json({
        success: true,
        data: {
          accountId: row.stripe_account_id,
          charges_enabled: row.charges_enabled,
          payouts_enabled: row.payouts_enabled,
        },
        message: "Stripe account already linked",
      });
    }

    // For OAuth flow we don't create accounts here; just acknowledge
    return res.json({ success: true, data: null, message: "Proceed to Stripe OAuth to link account" });
  } catch (error) {
    next(error);
  }
});

// Get Stripe Connect OAuth link (replaces onboarding link)
router.get("/retailer/stripe/onboarding-link", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user || user.role !== "retailer") {
      return res.status(403).json({ success: false, message: "Only retailers can access this" });
    }

    const retailerResult = await pool.query(
      "SELECT id FROM retailers WHERE user_id = $1",
      [user.id]
    );

    if (retailerResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Retailer profile not found" });
    }

    const retailerId = retailerResult.rows[0].id;

    // If already connected, short-circuit
    const existing = await pool.query(
      "SELECT stripe_account_id, charges_enabled, payouts_enabled, details_submitted FROM stripe_connect_accounts WHERE retailer_id = $1",
      [retailerId]
    );

    if (existing.rows.length > 0 && existing.rows[0].charges_enabled && existing.rows[0].payouts_enabled) {
      return res.json({
        success: true,
        data: { url: null, message: "Stripe account already connected. No action required." },
      });
    }

    const redirectUri = `${req.protocol}://${req.get("host")}/api/retailer/stripe/oauth/callback`;
    const state = Buffer.from(JSON.stringify({ retailerId, userId: user.id, ts: Date.now() })).toString("base64");

    const retailer = retailerResult.rows[0];
    const authorizeUrl = stripeService.getOAuthAuthorizeUrl({
      retailerId,
      email: user.email,
      businessName: retailer.business_name,
      redirectUri,
      state,
    });

    res.json({ success: true, data: { url: authorizeUrl } });
  } catch (error) {
    next(error);
  }
});

// OAuth callback for Stripe Connect
router.get("/retailer/stripe/oauth/callback", async (req, res) => {
  try {
    const { code, state, error, error_description } = req.query as Record<string, string | undefined>;

    if (error) {
      return res.status(400).send(`Stripe OAuth error: ${error_description || error}`);
    }

    if (!code || !state) {
      return res.status(400).send("Missing code or state");
    }

    const parsedState = JSON.parse(Buffer.from(state, "base64").toString());
    const retailerId = parsedState?.retailerId as string;
    if (!retailerId) {
      return res.status(400).send("Invalid state");
    }

    const account = await stripeService.exchangeOAuthCode(code, retailerId);

    // Redirect back to frontend payouts page with status
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const redirectUrl = `${frontendUrl}/retailer/payouts?stripe=connected&acct=${account.id}`;
    return res.redirect(302, redirectUrl);
  } catch (err: any) {
    console.error("Stripe OAuth callback error:", err?.message || err);
    return res.status(400).send(`Stripe OAuth failed: ${err?.message || "unknown error"}`);
  }
});

// Get Stripe account status
router.get("/retailer/stripe/status", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user || user.role !== "retailer") {
      return res.status(403).json({ success: false, message: "Only retailers can access this" });
    }

    const retailerResult = await pool.query(
      "SELECT id FROM retailers WHERE user_id = $1",
      [user.id]
    );

    if (retailerResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Retailer profile not found" });
    }

    const status = await stripeService.getAccountStatus(retailerResult.rows[0].id);

    res.json({ success: true, data: status });
  } catch (error) {
    next(error);
  }
});

// Stripe webhook endpoint
router.post("/stripe/webhook", express.raw({ type: 'application/json' }), async (req, res) => {
  const sigHeader = req.headers['stripe-signature'];
  const sig = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

  if (!sig) {
    return res.status(400).send('Missing stripe-signature header');
  }

  try {
    const event = stripeService.constructWebhookEvent(req.body, sig, webhookSecret);
    await stripeService.handleWebhook(event);
    res.json({ received: true });
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

// ==================== REWARDS & DISCOUNTS ====================

// Get user points balance
router.get("/user/points", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const points = await rewardsService.getUserPoints(user.id);
    res.json({ success: true, data: points });
  } catch (error) {
    next(error);
  }
});

// Validate discount code
router.post("/discount-codes/validate", async (req, res, next) => {
  try {
    const { code, orderTotal } = req.body;

    if (!code) {
      return res.status(400).json({ success: false, message: "Discount code is required" });
    }

    const validation = await rewardsService.validateDiscountCode(code, orderTotal || 0);
    res.json({ success: validation.valid, data: validation });
  } catch (error) {
    next(error);
  }
});

// Apply discount code to order
router.post("/orders/:orderId/discount-code", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const { code } = req.body;
    const discount = await rewardsService.applyDiscountCode(req.params.orderId, code);

    res.json({ success: true, data: discount });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Admin: Create discount code
router.post("/admin/discount-codes", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Only admins can create discount codes" });
    }

    const {
      code,
      description,
      discountType,
      discountValue,
      minPurchaseAmount,
      maxDiscountAmount,
      usageLimit,
      validUntil,
    } = req.body;

    const result = await pool.query(
      `INSERT INTO discount_codes 
       (code, description, discount_type, discount_value, min_purchase_amount, max_discount_amount, usage_limit, valid_until)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        code.toUpperCase(),
        description || null,
        discountType,
        discountValue,
        minPurchaseAmount || 0,
        maxDiscountAmount || null,
        usageLimit || null,
        validUntil || null,
      ]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    if (error.code === '23505') { // Unique violation
      res.status(400).json({ success: false, message: "Discount code already exists" });
    } else {
      next(error);
    }
  }
});

// Admin: Get all discount codes
router.get("/admin/discount-codes", isAuthenticated, async (req, res, next) => {
  try {
    const user = getCurrentUser(req);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Only admins can view discount codes" });
    }

    const result = await pool.query(
      `SELECT * FROM discount_codes ORDER BY created_at DESC`
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// Get retailer user ID by retailer ID (for starting chats)
router.get("/retailer/:retailerId/user", async (req, res, next) => {
  try {
    const { retailerId } = req.params;
    
    const result = await pool.query(
      `SELECT user_id, business_name 
       FROM retailers 
       WHERE id = $1 AND is_approved = true`,
      [retailerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Retailer not found" });
    }

    res.json({
      success: true,
      data: {
        userId: result.rows[0].user_id,
        businessName: result.rows[0].business_name,
      },
    });
  } catch (error) {
    next(error);
  }
});

export { router as apiRoutes };

