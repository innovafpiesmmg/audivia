import { useAuth } from "./auth-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { LogIn, LogOut, Settings, User, BookOpen } from "lucide-react";
import { Link } from "wouter";

export function UserMenu() {
  const { user, logout, isAuthenticated } = useAuth();

  // Show login button if not authenticated
  if (!isAuthenticated || !user) {
    return (
      <Button 
        variant="ghost" 
        size="default"
        asChild
        data-testid="button-login-header"
      >
        <Link href="/login">
          <LogIn className="mr-2 h-4 w-4" />
          Iniciar Sesión
        </Link>
      </Button>
    );
  }

  // Get user initials for avatar fallback
  const initials = user.username
    ? user.username.substring(0, 2).toUpperCase()
    : user.email.substring(0, 2).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          data-testid="button-user-menu"
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.avatarUrl || undefined} alt={user.username} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none" data-testid="text-username">
              {user.username}
            </p>
            <p className="text-xs leading-none text-muted-foreground" data-testid="text-email">
              {user.email}
            </p>
            <p className="text-xs leading-none text-muted-foreground capitalize" data-testid="text-role">
              {user.role.toLowerCase()}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile" className="cursor-pointer" data-testid="link-profile">
            <User className="mr-2 h-4 w-4" />
            <span>Mi Perfil</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings" className="cursor-pointer" data-testid="link-settings">
            <Settings className="mr-2 h-4 w-4" />
            <span>Configuración</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/user-guide" className="cursor-pointer" data-testid="link-user-guide">
            <BookOpen className="mr-2 h-4 w-4" />
            <span>Manual de Uso</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer text-destructive focus:text-destructive"
          onClick={() => logout()}
          data-testid="button-logout"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Cerrar Sesión</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
