import { db } from "./db";
import { users, podcasts, episodes } from "@shared/schema";
import bcrypt from "bcryptjs";

async function seed() {
  console.log("🌱 Seeding database...");

  // Create demo users
  const hashedPassword = await bcrypt.hash("password123", 10);
  
  const [demoCreator] = await db.insert(users).values({
    username: "demo_creator",
    email: "creator@example.com",
    passwordHash: hashedPassword,
    role: "CREATOR",
    bio: "Creador de contenido apasionado por la tecnología y la educación.",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=creator",
  }).returning();

  const [demoListener] = await db.insert(users).values({
    username: "demo_listener",
    email: "listener@example.com",
    passwordHash: hashedPassword,
    role: "LISTENER",
    bio: "Amante de los podcasts y siempre aprendiendo algo nuevo.",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=listener",
  }).returning();

  console.log("✅ Created demo users (creator & listener)");

  // Create sample podcasts
  const samplePodcasts = [
    {
      title: "Tecnología y Futuro",
      description: "Exploramos las últimas tendencias en tecnología, inteligencia artificial y cómo están transformando nuestro mundo.",
      coverArtUrl: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=500&h=500&fit=crop",
      ownerId: demoCreator.id,
    },
    {
      title: "Historias Inspiradoras",
      description: "Conversaciones con personas que han superado grandes desafíos y nos comparten sus lecciones de vida.",
      coverArtUrl: "https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=500&h=500&fit=crop",
      ownerId: demoCreator.id,
    },
    {
      title: "Ciencia Cotidiana",
      description: "Explicamos fenómenos científicos de forma simple y entretenida. Aprende algo nuevo cada episodio.",
      coverArtUrl: "https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=500&h=500&fit=crop",
      ownerId: demoCreator.id,
    },
    {
      title: "Emprendimiento Digital",
      description: "Consejos prácticos y estrategias para lanzar y hacer crecer tu negocio online en 2024.",
      coverArtUrl: "https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=500&h=500&fit=crop",
      ownerId: demoCreator.id,
    },
  ];

  const createdPodcasts = await db.insert(podcasts).values(samplePodcasts).returning();
  console.log(`✅ Created ${createdPodcasts.length} podcasts`);

  // Create episodes for each podcast
  const sampleEpisodes = [
    // Tecnología y Futuro
    {
      title: "El Futuro de la IA en 2024",
      notes: "Analizamos los avances más importantes en inteligencia artificial y lo que podemos esperar en los próximos meses. Discutimos GPT-4, modelos de código abierto y aplicaciones prácticas.",
      audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
      duration: 1847,
      podcastId: createdPodcasts[0].id,
    },
    {
      title: "Blockchain y Web3: ¿Realidad o Moda?",
      notes: "Exploramos el estado actual de blockchain, NFTs y Web3. ¿Son tecnologías revolucionarias o solo hype? Analizamos casos de uso reales y perspectivas futuras.",
      audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
      duration: 2156,
      podcastId: createdPodcasts[0].id,
    },
    
    // Historias Inspiradoras
    {
      title: "De la Adversidad al Éxito: María González",
      notes: "María nos cuenta cómo superó la pobreza extrema para convertirse en una empresaria exitosa. Una historia de perseverancia, educación y determinación.",
      audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
      duration: 2543,
      podcastId: createdPodcasts[1].id,
    },
    {
      title: "Venciendo el Miedo: Carlos y su Historia",
      notes: "Carlos comparte su experiencia superando el miedo escénico para convertirse en un orador público reconocido. Técnicas y consejos para vencer tus miedos.",
      audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
      duration: 1923,
      podcastId: createdPodcasts[1].id,
    },
    
    // Ciencia Cotidiana
    {
      title: "¿Por Qué el Cielo es Azul?",
      notes: "Explicamos de forma simple la dispersión de Rayleigh y otros fenómenos ópticos que observamos todos los días sin darnos cuenta.",
      audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
      duration: 1234,
      podcastId: createdPodcasts[2].id,
    },
    {
      title: "La Física del Café",
      notes: "Descubre la ciencia detrás de tu taza de café matutina: temperatura, presión, extracción y química molecular. Todo lo que necesitas saber.",
      audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3",
      duration: 1567,
      podcastId: createdPodcasts[2].id,
    },
    
    // Emprendimiento Digital
    {
      title: "Validando tu Idea de Negocio",
      notes: "Antes de invertir tiempo y dinero, aprende a validar tu idea de negocio. Técnicas de MVP, encuestas y pruebas de mercado efectivas.",
      audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3",
      duration: 2034,
      podcastId: createdPodcasts[3].id,
    },
    {
      title: "Marketing Digital para Principiantes",
      notes: "Una guía completa de marketing digital: SEO, redes sociales, email marketing y estrategias de contenido que realmente funcionan en 2024.",
      audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3",
      duration: 2456,
      podcastId: createdPodcasts[3].id,
    },
  ];

  const createdEpisodes = await db.insert(episodes).values(sampleEpisodes).returning();
  console.log(`✅ Created ${createdEpisodes.length} episodes`);

  console.log("🎉 Seeding completed successfully!");
}

seed()
  .catch((error) => {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
