import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth, type UserRole } from "@/contexts/AuthContext";

/**
 * Redirects to the provided login route if the user is not authenticated
 * or does not match the required role.
 */
export function useRequireRole(requiredRole: UserRole, loginPath: string) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!user || user.role !== requiredRole) {
      setLocation(loginPath);
    }
  }, [user, loading, requiredRole, loginPath, setLocation]);
}

