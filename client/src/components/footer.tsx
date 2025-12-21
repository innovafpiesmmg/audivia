import logoAsd from "@assets/ASD Logo_1763072119185.png";

export function Footer() {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="border-t bg-background mt-auto">
      <div className="container mx-auto px-4 md:px-6 py-4">
        <div className="flex items-center justify-center gap-3">
          <img 
            src={logoAsd} 
            alt="Atreyu Servicios Digitales" 
            className="h-6 w-auto"
          />
          <p className="text-sm text-muted-foreground">
            © {currentYear} Atreyu Servicios Digitales. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
