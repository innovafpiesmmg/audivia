import { Home, Compass, Library, Shield, Users, BookOpen, Play, Mail, ListMusic, CreditCard, FileArchive, Wallet, TrendingUp, ShoppingCart, Tag, ExternalLink } from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAuth } from "@/components/auth-provider";

const menuItems = [
  {
    title: "Inicio",
    url: "/",
    icon: Home,
    testId: "link-home",
  },
  {
    title: "Explorar",
    url: "/explore",
    icon: Compass,
    testId: "link-explore",
  },
  {
    title: "Mi Biblioteca",
    url: "/library",
    icon: Library,
    testId: "link-library",
  },
  {
    title: "Mis Listas",
    url: "/my-playlists",
    icon: ListMusic,
    testId: "link-my-playlists",
  },
  {
    title: "Carrito",
    url: "/cart",
    icon: ShoppingCart,
    testId: "link-cart",
  },
];

// Principal: Dashboard y métricas
const adminMainItems = [
  {
    title: "Dashboard",
    url: "/admin",
    icon: Shield,
    testId: "link-admin-dashboard",
  },
  {
    title: "Ventas",
    url: "/admin/sales",
    icon: TrendingUp,
    testId: "link-admin-sales",
  },
];

// Gestión comercial: clientes, compras, facturas, suscripciones
const adminComercialItems = [
  {
    title: "Gestion Comercial",
    url: "/admin/customers",
    icon: Users,
    testId: "link-admin-customers",
  },
  {
    title: "Suscripciones",
    url: "/admin/subscriptions",
    icon: CreditCard,
    testId: "link-admin-subscriptions",
  },
  {
    title: "Descuentos",
    url: "/admin/discount-codes",
    icon: Tag,
    testId: "link-admin-discount-codes",
  },
];

// Contenido: audiolibros, capítulos, importar
const adminContentItems = [
  {
    title: "Audiolibros",
    url: "/admin/audiobooks",
    icon: BookOpen,
    testId: "link-admin-audiobooks",
  },
  {
    title: "Capitulos",
    url: "/admin/chapters",
    icon: Play,
    testId: "link-admin-chapters",
  },
  {
    title: "Importar ZIP",
    url: "/admin/import",
    icon: FileArchive,
    testId: "link-admin-import",
  },
];

// Sistema: usuarios, configuración
const adminSystemItems = [
  {
    title: "Usuarios",
    url: "/admin/users",
    icon: Users,
    testId: "link-admin-users",
  },
  {
    title: "Email",
    url: "/admin/email-config",
    icon: Mail,
    testId: "link-admin-email-config",
  },
  {
    title: "PayPal",
    url: "/admin/paypal-config",
    icon: Wallet,
    testId: "link-admin-paypal-config",
  },
  {
    title: "Servicios Externos",
    url: "/admin/external-services",
    icon: ExternalLink,
    testId: "link-admin-external-services",
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();

  const isAdmin = user && user.role === "ADMIN";

  return (
    <Sidebar className="pt-[57px]">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Descubrir</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={item.testId}
                  >
                    <Link href={item.url}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <>
            <SidebarGroup>
              <SidebarGroupLabel>Panel Principal</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {adminMainItems.map((item) => (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        asChild
                        isActive={location === item.url || location.startsWith(item.url + "/")}
                        data-testid={item.testId}
                      >
                        <Link href={item.url}>
                          <item.icon className="w-4 h-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Comercial</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {adminComercialItems.map((item) => (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        asChild
                        isActive={location === item.url || location.startsWith(item.url + "/")}
                        data-testid={item.testId}
                      >
                        <Link href={item.url}>
                          <item.icon className="w-4 h-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Contenido</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {adminContentItems.map((item) => (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        asChild
                        isActive={location === item.url || location.startsWith(item.url + "/")}
                        data-testid={item.testId}
                      >
                        <Link href={item.url}>
                          <item.icon className="w-4 h-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Sistema</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {adminSystemItems.map((item) => (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        asChild
                        isActive={location === item.url || location.startsWith(item.url + "/")}
                        data-testid={item.testId}
                      >
                        <Link href={item.url}>
                          <item.icon className="w-4 h-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
