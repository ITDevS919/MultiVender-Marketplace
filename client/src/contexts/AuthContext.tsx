import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useLocation } from "wouter";

export type UserRole = "customer" | "retailer" | "admin";

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

interface RetailerData {
  businessName: string;
  businessAddress?: string;
  postcode?: string;
  city?: string;
  phone?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  signup: (username: string, email: string, password: string, role: UserRole, retailerData?: RetailerData) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isCustomer: boolean;
  isRetailer: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();

  // Check if user is authenticated on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setUser(data.data);
        }
      }
    } catch (error) {
      console.error("Auth check failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Login failed");
    }

    setUser(data.data);
    
    // Redirect based on role
    if (data.data.role === "retailer") {
      setLocation("/retailer/dashboard");
    } else if (data.data.role === "admin") {
      setLocation("/admin/dashboard");
    } else {
      setLocation("/");
    }
  };

  const signup = async (username: string, email: string, password: string, role: UserRole = "customer", retailerData?: RetailerData) => {
    const body: any = { username, email, password, role };
    if (role === "retailer" && retailerData) {
      body.retailerData = retailerData;
    }

    const response = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Signup failed");
    }

    setUser(data.data);
    
    // Redirect based on role
    if (data.data.role === "retailer") {
      setLocation("/retailer/dashboard");
    } else if (data.data.role === "admin") {
      setLocation("/admin/dashboard");
    } else {
      setLocation("/");
    }
  };

  const logout = async () => {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setUser(null);
      setLocation("/");
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        signup,
        logout,
        isAuthenticated: !!user,
        isCustomer: user?.role === "customer",
        isRetailer: user?.role === "retailer",
        isAdmin: user?.role === "admin",
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

