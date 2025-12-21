import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import {
  Share2,
  Link,
  Code,
  Mail,
  MessageCircle,
  Rss,
} from "lucide-react";
import { SiX, SiFacebook, SiLinkedin } from "react-icons/si";

interface ShareMenuProps {
  episodeTitle: string;
  episodeUrl: string;
  embedCode: string;
  isPodcast?: boolean;
  rssUrl?: string;
}

export function ShareMenu({ episodeTitle, episodeUrl, embedCode, isPodcast, rssUrl }: ShareMenuProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  // Validate that we have the necessary data (check for non-empty strings)
  const hasValidUrl = episodeUrl && episodeUrl.trim().length > 0;
  const hasValidEmbedCode = embedCode && embedCode.trim().length > 0;
  const hasValidRssUrl = rssUrl && rssUrl.trim().length > 0;

  const copyToClipboard = async (text: string, successMessage: string) => {
    // Validate that we have actual content to copy
    if (!text || text.trim().length === 0) {
      toast({
        title: "Error",
        description: "No hay contenido disponible para copiar",
        variant: "destructive",
      });
      return;
    }
    
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copiado",
        description: successMessage,
      });
      setOpen(false);
    } catch (err) {
      toast({
        title: "Error",
        description: "No se pudo copiar al portapapeles",
        variant: "destructive",
      });
    }
  };

  const handleCopyLink = (event: Event) => {
    if (!hasValidUrl) {
      event.preventDefault();
      toast({
        title: "Error",
        description: "No hay enlace disponible para copiar",
        variant: "destructive",
      });
      return;
    }
    copyToClipboard(episodeUrl, "Enlace copiado al portapapeles");
  };

  const handleCopyEmbedCode = (event: Event) => {
    if (!hasValidEmbedCode) {
      event.preventDefault();
      toast({
        title: "Error",
        description: "No hay código de inserción disponible",
        variant: "destructive",
      });
      return;
    }
    copyToClipboard(embedCode, "Código de inserción copiado");
  };

  const handleCopyRssUrl = (event: Event) => {
    if (!hasValidRssUrl) {
      event.preventDefault();
      toast({
        title: "Error",
        description: "No hay URL de RSS disponible",
        variant: "destructive",
      });
      return;
    }
    copyToClipboard(rssUrl!, "URL de RSS copiada");
  };

  const shareToX = (event: Event) => {
    if (!hasValidUrl) {
      event.preventDefault();
      toast({
        title: "Error",
        description: "No se puede compartir sin una URL válida",
        variant: "destructive",
      });
      return;
    }
    const text = encodeURIComponent(`Escucha: ${episodeTitle}`);
    const url = encodeURIComponent(episodeUrl);
    // Double-check URL is not empty before opening
    if (!url) {
      event.preventDefault();
      return;
    }
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank', 'noopener,noreferrer');
    setOpen(false);
  };

  const shareToFacebook = (event: Event) => {
    if (!hasValidUrl) {
      event.preventDefault();
      toast({
        title: "Error",
        description: "No se puede compartir sin una URL válida",
        variant: "destructive",
      });
      return;
    }
    const url = encodeURIComponent(episodeUrl);
    // Double-check URL is not empty before opening
    if (!url) {
      event.preventDefault();
      return;
    }
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank', 'noopener,noreferrer');
    setOpen(false);
  };

  const shareToLinkedIn = (event: Event) => {
    if (!hasValidUrl) {
      event.preventDefault();
      toast({
        title: "Error",
        description: "No se puede compartir sin una URL válida",
        variant: "destructive",
      });
      return;
    }
    const url = encodeURIComponent(episodeUrl);
    // Double-check URL is not empty before opening
    if (!url) {
      event.preventDefault();
      return;
    }
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, '_blank', 'noopener,noreferrer');
    setOpen(false);
  };

  const shareToWhatsApp = (event: Event) => {
    if (!hasValidUrl) {
      event.preventDefault();
      toast({
        title: "Error",
        description: "No se puede compartir sin una URL válida",
        variant: "destructive",
      });
      return;
    }
    const text = encodeURIComponent(`Escucha: ${episodeTitle} ${episodeUrl}`);
    // Double-check text is not empty before opening
    if (!text) {
      event.preventDefault();
      return;
    }
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
    setOpen(false);
  };

  const shareViaEmail = (event: Event) => {
    if (!hasValidUrl) {
      event.preventDefault();
      toast({
        title: "Error",
        description: "No se puede compartir sin una URL válida",
        variant: "destructive",
      });
      return;
    }
    const subject = encodeURIComponent(`Te recomiendo este episodio: ${episodeTitle}`);
    const body = encodeURIComponent(`Hola,\n\nTe recomiendo escuchar este episodio:\n\n${episodeTitle}\n\n${episodeUrl}\n\n¡Espero que lo disfrutes!`);
    // Double-check body is not empty before setting location
    if (!body) {
      event.preventDefault();
      return;
    }
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" data-testid="button-share">
          <Share2 className="h-4 w-4 mr-2" />
          Compartir
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{isPodcast ? 'Compartir podcast' : 'Compartir episodio'}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuItem 
          onSelect={handleCopyLink} 
          data-testid="menu-item-copy-link"
          disabled={!hasValidUrl}
        >
          <Link className="h-4 w-4 mr-2" />
          Copiar enlace
        </DropdownMenuItem>
        
        {isPodcast && hasValidRssUrl && (
          <DropdownMenuItem 
            onSelect={handleCopyRssUrl} 
            data-testid="menu-item-copy-rss"
            disabled={!hasValidRssUrl}
          >
            <Rss className="h-4 w-4 mr-2" />
            Copiar URL de RSS
          </DropdownMenuItem>
        )}
        
        {!isPodcast && (
          <DropdownMenuItem 
            onSelect={handleCopyEmbedCode} 
            data-testid="menu-item-copy-embed"
            disabled={!hasValidEmbedCode}
          >
            <Code className="h-4 w-4 mr-2" />
            Copiar código de inserción
          </DropdownMenuItem>
        )}
        
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Compartir en redes</DropdownMenuLabel>
        
        <DropdownMenuItem 
          onSelect={shareToX} 
          data-testid="menu-item-share-x"
          disabled={!hasValidUrl}
        >
          <SiX className="h-4 w-4 mr-2" />
          X (Twitter)
        </DropdownMenuItem>
        
        <DropdownMenuItem 
          onSelect={shareToFacebook} 
          data-testid="menu-item-share-facebook"
          disabled={!hasValidUrl}
        >
          <SiFacebook className="h-4 w-4 mr-2" />
          Facebook
        </DropdownMenuItem>
        
        <DropdownMenuItem 
          onSelect={shareToLinkedIn} 
          data-testid="menu-item-share-linkedin"
          disabled={!hasValidUrl}
        >
          <SiLinkedin className="h-4 w-4 mr-2" />
          LinkedIn
        </DropdownMenuItem>
        
        <DropdownMenuItem 
          onSelect={shareToWhatsApp} 
          data-testid="menu-item-share-whatsapp"
          disabled={!hasValidUrl}
        >
          <MessageCircle className="h-4 w-4 mr-2" />
          WhatsApp
        </DropdownMenuItem>
        
        <DropdownMenuItem 
          onSelect={shareViaEmail} 
          data-testid="menu-item-share-email"
          disabled={!hasValidUrl}
        >
          <Mail className="h-4 w-4 mr-2" />
          Email
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
