import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import type { BillingProfile } from "@shared/schema";

const billingProfileFormSchema = z.object({
  legalName: z.string().min(2, "El nombre es requerido"),
  companyName: z.string().optional(),
  taxId: z.string().optional(),
  addressLine1: z.string().min(5, "La direccion es requerida"),
  addressLine2: z.string().optional(),
  city: z.string().min(2, "La ciudad es requerida"),
  state: z.string().optional(),
  postalCode: z.string().min(3, "El codigo postal es requerido"),
  country: z.string().min(2, "El pais es requerido"),
  phone: z.string().optional(),
});

type BillingProfileFormData = z.infer<typeof billingProfileFormSchema>;

export function BillingProfileForm() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: profileData, isLoading } = useQuery<{ profile: BillingProfile | null }>({
    queryKey: ["/api/user/billing-profile"],
  });

  const form = useForm<BillingProfileFormData>({
    resolver: zodResolver(billingProfileFormSchema),
    defaultValues: {
      legalName: "",
      companyName: "",
      taxId: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      postalCode: "",
      country: "",
      phone: "",
    },
    values: profileData?.profile ? {
      legalName: profileData.profile.legalName || "",
      companyName: profileData.profile.companyName || "",
      taxId: profileData.profile.taxId || "",
      addressLine1: profileData.profile.addressLine1 || "",
      addressLine2: profileData.profile.addressLine2 || "",
      city: profileData.profile.city || "",
      state: profileData.profile.state || "",
      postalCode: profileData.profile.postalCode || "",
      country: profileData.profile.country || "",
      phone: profileData.profile.phone || "",
    } : undefined,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: BillingProfileFormData) => {
      return apiRequest("POST", "/api/user/billing-profile", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/billing-profile"] });
      toast({
        title: "Perfil guardado",
        description: "Tu información de facturacion ha sido actualizada.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo guardar el perfil de facturacion.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: BillingProfileFormData) => {
    saveMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="legalName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre completo *</FormLabel>
                <FormControl>
                  <Input data-testid="input-legal-name" placeholder="Tu nombre legal" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="companyName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre de empresa</FormLabel>
                <FormControl>
                  <Input data-testid="input-company-name" placeholder="Opcional" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="taxId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>NIF/CIF</FormLabel>
              <FormControl>
                <Input data-testid="input-tax-id" placeholder="Tu numero de identificacion fiscal" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="addressLine1"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Direccion *</FormLabel>
              <FormControl>
                <Input data-testid="input-address-1" placeholder="Calle, numero, piso..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="addressLine2"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Direccion (linea 2)</FormLabel>
              <FormControl>
                <Input data-testid="input-address-2" placeholder="Apartamento, suite, etc." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ciudad *</FormLabel>
                <FormControl>
                  <Input data-testid="input-city" placeholder="Ciudad" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="state"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Provincia</FormLabel>
                <FormControl>
                  <Input data-testid="input-state" placeholder="Provincia" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="postalCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Codigo postal *</FormLabel>
                <FormControl>
                  <Input data-testid="input-postal-code" placeholder="12345" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="country"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Pais *</FormLabel>
                <FormControl>
                  <Input data-testid="input-country" placeholder="Espana" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Telefono</FormLabel>
                <FormControl>
                  <Input data-testid="input-phone" placeholder="+34 600 000 000" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Button
          type="submit"
          disabled={saveMutation.isPending}
          data-testid="button-save-billing"
        >
          {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Guardar datos de facturacion
        </Button>
      </form>
    </Form>
  );
}
