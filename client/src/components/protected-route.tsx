import { ReactNode, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "./auth-provider";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: ReactNode;
  requireRole?: "LISTENER" | "CREATOR" | "ADMIN";
}

export function ProtectedRoute({ children, requireRole }: ProtectedRouteProps) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [isLoading, isAuthenticated, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // Check role hierarchy: ADMIN can access everything, CREATOR can access CREATOR and LISTENER routes
  if (requireRole) {
    const hasAccess = 
      user?.role === requireRole || 
      (user?.role === "ADMIN") || // Admins can access all routes
      (user?.role === "CREATOR" && requireRole === "LISTENER"); // Creators can access listener routes
    
    if (!hasAccess) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-bold">Acceso Restringido</h2>
            <p className="text-muted-foreground">
              Esta página requiere una cuenta de tipo {
                requireRole === "CREATOR" ? "Creador" : 
                requireRole === "ADMIN" ? "Administrador" : 
                "Oyente"
              }.
            </p>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}
