import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import Home from "@/pages/home";
import SearchPage from "@/pages/search";
import ProductDetailPage from "@/pages/product-detail";
import CartPage from "@/pages/cart";
import CheckoutPage from "@/pages/checkout";
import OrdersPage from "@/pages/orders";
import OrderDetailPage from "@/pages/order-detail";
import RetailerDashboard from "@/pages/retailer-dashboard";
import RetailerProductsPage from "@/pages/retailer-products";
import RetailerOrdersPage from "@/pages/retailer-orders";
import RetailerOrderDetailPage from "@/pages/retailer-order-detail";
import RetailerSettingsPage from "@/pages/retailer-settings";
import RetailerSquareSettingsPage from "@/pages/retailer-square-settings";
import AdminDashboard from "@/pages/admin-dashboard";
import AdminProductsPage from "@/pages/admin-products";
import AdminRetailersPage from "@/pages/admin-retailers";
import AdminOrdersPage from "@/pages/admin-orders";
import AdminOrderDetailPage from "@/pages/admin-order-detail";
import AdminCategoriesPage from "@/pages/admin-categories";
import AdminReviewsPage from "@/pages/admin-reviews";
import AdminSettingsPage from "@/pages/admin-settings";
import LoginAdminPage from "@/pages/login-admin";
import LoginCustomerPage from "@/pages/login-customer";
import LoginRetailerPage from "@/pages/login-retailer";
import SignupCustomerPage from "@/pages/signup-customer";
import SignupRetailerPage from "@/pages/signup-retailer";
import NotFound from "@/pages/not-found";
import WishlistPage from "@/pages/wishlist";
import RetailerProfilePage from "@/pages/retailer-profile";
import RetailerPostsPage from "@/pages/retailer-posts";
import RetailerPayoutsPage from "@/pages/retailer-payouts";
import AdminDiscountCodesPage from "@/pages/admin-discount-codes";
import AdminMessagesPage from "@/pages/admin-messages";
import UserPointsPage from "@/pages/user-points";
import MessagesPage from "@/pages/messages";
import RetailerMessagesPage  from "@/pages/retailer-messages";
import { SupportChat } from "@/components/chat/SupportChat";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/search" component={SearchPage} />
      <Route path="/product/:id" component={ProductDetailPage} />

      {/* Customer auth */}
      <Route path="/login/customer" component={LoginCustomerPage} />
      <Route path="/signup/customer" component={SignupCustomerPage} />

      {/* Retailer auth */}
      <Route path="/login/retailer" component={LoginRetailerPage} />
      <Route path="/signup/retailer" component={SignupRetailerPage} />

      {/* Admin auth */}
      <Route path="/admin" component={LoginAdminPage} />

      {/* Customer */}
      <Route path="/cart" component={CartPage} />
      <Route path="/checkout" component={CheckoutPage} />
      <Route path="/orders" component={OrdersPage} />
      <Route path="/orders/:id" component={OrderDetailPage} />
      <Route path="/wishlist" component={WishlistPage} />
      <Route path="/points" component={UserPointsPage} />
      
      {/* Retailer Routes */}
      <Route path="/retailer/dashboard" component={RetailerDashboard} />
      <Route path="/retailer/products" component={RetailerProductsPage} />
      <Route path="/retailer/orders" component={RetailerOrdersPage} />
      <Route path="/retailer/orders/:id" component={RetailerOrderDetailPage} />
      <Route path="/retailer/settings" component={RetailerSettingsPage} />
      <Route path="/retailer/square-settings" component={RetailerSquareSettingsPage} />
      <Route path="/retailer/posts" component={RetailerPostsPage} />
      <Route path="/retailer/payouts" component={RetailerPayoutsPage} />
      <Route path="/retailer/messages" component={RetailerMessagesPage} />
      
      {/* Public retailer profile - MUST be last to avoid matching other routes */}
      <Route path="/retailer/:retailerId" component={RetailerProfilePage} />

      {/* Admin Routes */}
      <Route path="/admin/dashboard" component={AdminDashboard} />
      <Route path="/admin/products" component={AdminProductsPage} />
      <Route path="/admin/retailers" component={AdminRetailersPage} />
      <Route path="/admin/orders/:id" component={AdminOrderDetailPage} />
      <Route path="/admin/orders" component={AdminOrdersPage} />
      <Route path="/admin/categories" component={AdminCategoriesPage} />
      <Route path="/admin/reviews" component={AdminReviewsPage} />
      <Route path="/admin/settings" component={AdminSettingsPage} />
      <Route path="/admin/messages" component={AdminMessagesPage} />
      <Route path="/admin/discount-codes" component={AdminDiscountCodesPage} />
      <Route path="/admin/dashboard" component={AdminDashboard} />
      <Route path="/admin/products" component={AdminProductsPage} />
      <Route path="/admin/retailers" component={AdminRetailersPage} />
      <Route path="/admin/messages" component={AdminMessagesPage} />
      <Route path="/admin/discount-codes" component={AdminDiscountCodesPage} />

      {/* Messages */}
      <Route path="/messages" component={MessagesPage} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
          <SupportChat />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
