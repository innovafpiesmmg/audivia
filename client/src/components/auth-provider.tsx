import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { User } from "@shared/schema";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, role: "LISTENER" | "CREATOR") => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  
  // Fetch current user
  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["/api/auth/me"],
    retry: false,
    // If not authenticated, the query will fail but that's expected
    meta: { skipErrorToast: true },
  });

  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/login", { email, password }, { raw: true });
      return res.json();
    },
    onSuccess: async () => {
      // Refetch from server to get fresh session data
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async ({ username, email, password, role }: { username: string; email: string; password: string; role: "LISTENER" | "CREATOR" }) => {
      const res = await apiRequest("POST", "/api/auth/register", { username, email, password, role }, { raw: true });
      return res.json();
    },
    onSuccess: async () => {
      // Refetch from server to get fresh session data
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/logout", {}, { raw: true });
      return res.json();
    },
    onSuccess: () => {
      // Only clear auth-related queries, not the entire cache
      queryClient.removeQueries({ queryKey: ["/api/auth/me"] });
      // Optionally clear other user-specific data
      queryClient.removeQueries({ predicate: (query) => {
        // Clear any queries that might be user-specific
        const key = query.queryKey[0];
        return typeof key === 'string' && (
          key.includes('/api/subscriptions') || 
          key.includes('/api/user')
        );
      }});
    },
  });

  const login = async (email: string, password: string) => {
    await loginMutation.mutateAsync({ email, password });
  };

  const register = async (username: string, email: string, password: string, role: "LISTENER" | "CREATOR") => {
    await registerMutation.mutateAsync({ username, email, password, role });
  };

  const logout = async () => {
    await logoutMutation.mutateAsync();
  };

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
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
