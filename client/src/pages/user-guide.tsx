import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { BookOpen, Shield, Mic, Headphones } from "lucide-react";

export default function UserGuide() {
  return (
    <div className="min-h-screen pb-8">
      <div className="bg-gradient-to-b from-primary/10 to-background border-b">
        <div className="max-w-5xl mx-auto px-6 py-12">
          <div className="flex items-center gap-3 mb-4">
            <BookOpen className="h-10 w-10 text-primary" />
            <h1 className="text-4xl font-bold font-[Outfit]">Manual de Uso</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Guía completa para aprovechar al máximo PodcastHub según tu rol
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <Tabs defaultValue="listener" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="listener" className="gap-2" data-testid="tab-listener">
              <Headphones className="h-4 w-4" />
              Oyentes
            </TabsTrigger>
            <TabsTrigger value="creator" className="gap-2" data-testid="tab-creator">
              <Mic className="h-4 w-4" />
              Creadores
            </TabsTrigger>
            <TabsTrigger value="admin" className="gap-2" data-testid="tab-admin">
              <Shield className="h-4 w-4" />
              Administradores
            </TabsTrigger>
          </TabsList>

          {/* OYENTES */}
          <TabsContent value="listener">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Headphones className="h-5 w-5 text-primary" />
                  Guía para Oyentes
                </CardTitle>
                <CardDescription>
                  Aprende a descubrir, escuchar y organizar tus podcasts favoritos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="item-1">
                    <AccordionTrigger>Explorar Podcasts</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 text-sm">
                        <p><strong>Descubrir contenido:</strong></p>
                        <ul className="list-disc pl-6 space-y-2">
                          <li>Ve a <strong>"Explorar"</strong> en el menú lateral para ver todos los podcasts públicos disponibles</li>
                          <li>Usa el campo de búsqueda para encontrar podcasts por título o descripción</li>
                          <li>Haz clic en cualquier podcast para ver sus episodios y detalles</li>
                        </ul>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="item-2">
                    <AccordionTrigger>Suscribirse a Podcasts</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 text-sm">
                        <p><strong>Gestionar tus suscripciónes:</strong></p>
                        <ul className="list-disc pl-6 space-y-2">
                          <li>En la página de cualquier podcast, haz clic en el botón <strong>"Suscribirse"</strong> (icono de corazón)</li>
                          <li>Los podcasts suscritos aparecerán en <strong>"Mi Biblioteca"</strong> en el menú lateral</li>
                          <li>Para desuscribirte, vuelve al podcast y haz clic en <strong>"Desuscribirse"</strong></li>
                          <li>Tu biblioteca te permite acceder rápidamente a tus podcasts favoritos</li>
                        </ul>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="item-3">
                    <AccordionTrigger>Buscar y Filtrar Episodios</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 text-sm">
                        <p><strong>Encontrar episodios específicos:</strong></p>
                        <ul className="list-disc pl-6 space-y-2">
                          <li>Dentro de cada podcast, usa el <strong>campo de búsqueda</strong> para filtrar episodios por título o contenido</li>
                          <li>Usa el <strong>selector de ordenamiento</strong> para organizar episodios por:
                            <ul className="list-circle pl-6 mt-1">
                              <li>Más recientes primero / Más antiguos primero</li>
                              <li>Orden alfabético (A-Z / Z-A)</li>
                              <li>No escuchados primero</li>
                            </ul>
                          </li>
                          <li>Los episodios se marcan automáticamente como "escuchados" cuando completas el 80% de reproducción</li>
                        </ul>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="item-4">
                    <AccordionTrigger>Reproducir Episodios</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 text-sm">
                        <p><strong>Controles del reproductor:</strong></p>
                        <ul className="list-disc pl-6 space-y-2">
                          <li>Haz clic en el botón <strong>"Play"</strong> de cualquier episodio para reproducirlo</li>
                          <li>El reproductor aparece en la parte inferior de la pantalla</li>
                          <li>Controles disponibles: play/pausa, barra de progreso, control de volumen</li>
                          <li>Puedes navegar por el sitio mientras el audio continúa reproduciéndose</li>
                          <li>La barra de progreso te permite adelantar o retroceder en el episodio</li>
                        </ul>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="item-5">
                    <AccordionTrigger>Compartir y RSS</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 text-sm">
                        <p><strong>Compartir contenido:</strong></p>
                        <ul className="list-disc pl-6 space-y-2">
                          <li>Usa el botón <strong>"Compartir"</strong> para obtener enlaces y códigos de embed</li>
                          <li>Comparte episodios individuales o podcasts completos en redes sociales</li>
                          <li>Copia el código embed para incrustar episodios en tu sitio web</li>
                          <li>Accede al <strong>Feed RSS</strong> desde el icono RSS en cada podcast para agregarlo a tu lector favorito</li>
                        </ul>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="item-6">
                    <AccordionTrigger>Gestionar tu Perfil</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 text-sm">
                        <p><strong>Personalizar tu cuenta:</strong></p>
                        <ul className="list-disc pl-6 space-y-2">
                          <li>Haz clic en tu <strong>avatar</strong> (esquina superior derecha) y selecciona <strong>"Mi Perfil"</strong></li>
                          <li>Actualiza tu nombre de usuario y correo electrónico</li>
                          <li>Cambia tu contraseña desde la opción <strong>"Cambiar Contraseña"</strong></li>
                          <li>Verifica tu correo electrónico si aún no lo has hecho</li>
                        </ul>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          </TabsContent>

          {/* CREADORES */}
          <TabsContent value="creator">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mic className="h-5 w-5 text-primary" />
                  Guía para Creadores
                </CardTitle>
                <CardDescription>
                  Aprende a crear, gestionar y distribuir tus podcasts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="item-1">
                    <AccordionTrigger>Crear tu Primer Podcast</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 text-sm">
                        <p><strong>Paso a paso:</strong></p>
                        <ol className="list-decimal pl-6 space-y-2">
                          <li>Ve a <strong>"Mis Podcasts"</strong> en el menú lateral</li>
                          <li>Haz clic en <strong>"Crear Podcast"</strong></li>
                          <li>Completa la información requerida:
                            <ul className="list-circle pl-6 mt-1">
                              <li><strong>Título:</strong> Nombre de tu podcast</li>
                              <li><strong>Descripción:</strong> Resume de qué trata tu contenido</li>
                              <li><strong>Cover Art:</strong> Sube una imagen cuadrada (recomendado 1400x1400px, máx 2MB)</li>
                              <li><strong>Categoría:</strong> Selecciona la más apropiada</li>
                              <li><strong>Idioma:</strong> Idioma principal del contenido</li>
                            </ul>
                          </li>
                          <li>Configura la <strong>privacidad</strong>:
                            <ul className="list-circle pl-6 mt-1">
                              <li><strong>Público:</strong> Visible para todos</li>
                              <li><strong>No listado:</strong> Solo accesible con el enlace + invitaciones por email</li>
                              <li><strong>Privado:</strong> Solo tú puedes verlo + invitaciones por email</li>
                            </ul>
                          </li>
                          <li>Opcionalmente, agrega el primer episodio en el mismo formulario</li>
                          <li>Haz clic en <strong>"Crear Podcast"</strong></li>
                        </ol>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="item-1-5">
                    <AccordionTrigger>Importar Podcasts desde RSS o Carpeta Local</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 text-sm">
                        <div>
                          <p className="font-semibold mb-2">📡 Opción 1: Importar desde Feed RSS (Creadores y Administradores)</p>
                          <ol className="list-decimal pl-6 space-y-2">
                            <li>Ve a <strong>"Mis Podcasts"</strong> y haz clic en <strong>"Importar RSS"</strong></li>
                            <li>Pega la URL del feed RSS del podcast:
                              <ul className="list-circle pl-6 mt-1">
                                <li><strong>Spotify:</strong> Busca "nombre del podcast RSS feed" en Google</li>
                                <li><strong>Apple Podcasts:</strong> La URL RSS suele estar en la página del podcast</li>
                                <li><strong>iVoox:</strong> Busca el ícono RSS en la página del podcast</li>
                                <li><strong>Otros servicios:</strong> La mayoría tienen un enlace RSS visible</li>
                              </ul>
                            </li>
                            <li>Configura las opciones:
                              <ul className="list-circle pl-6 mt-1">
                                <li><strong>Cantidad máxima de episodios:</strong> Hasta 50 episodios (por defecto 10)</li>
                                <li><strong>Visibilidad:</strong> Público, No listado o Privado</li>
                              </ul>
                            </li>
                            <li>Haz clic en <strong>"Importar Podcast"</strong></li>
                            <li>El sistema importará automáticamente:
                              <ul className="list-circle pl-6 mt-1">
                                <li>Información del podcast (título, descripción, cover art)</li>
                                <li>Los episodios más recientes (según la cantidad configurada)</li>
                                <li>Metadatos completos de cada episodio</li>
                                <li>Enlaces a los archivos de audio originales</li>
                              </ul>
                            </li>
                            <li><strong>Nota:</strong> La importación RSS toma los episodios tal como están en el feed original. No se descargan los archivos de audio localmente.</li>
                            <li>El contenido queda <strong>pendiente de aprobación</strong> por un administrador</li>
                          </ol>
                        </div>
                        <div className="border-t pt-4">
                          <p className="font-semibold mb-2">📁 Opción 2: Importar desde Carpeta Local (Solo Administradores)</p>
                          <p className="text-muted-foreground mb-3 text-xs italic">
                            Sube múltiples archivos MP3 desde tu ordenador para crear un podcast completo
                          </p>
                          
                          <div className="space-y-3">
                            <div>
                              <p className="font-medium text-primary">Cómo funciona:</p>
                              <ol className="list-decimal pl-6 space-y-1 mt-1">
                                <li>Ve a <strong>"Mis Podcasts"</strong> (el botón solo aparece para administradores)</li>
                                <li>Haz clic en <strong>"Importar Carpeta Local"</strong></li>
                                <li>Selecciona múltiples archivos MP3 de tu ordenador (máximo 50 archivos)</li>
                                <li>Opcionalmente, sube una imagen de cover art para el podcast</li>
                                <li>Completa la información del podcast:
                                  <ul className="list-circle pl-6 mt-1">
                                    <li><strong>Título del Podcast:</strong> Nombre del podcast que se creará</li>
                                    <li><strong>Descripción:</strong> Describe de qué trata tu contenido</li>
                                    <li><strong>Categoría:</strong> Clasifica tu podcast</li>
                                    <li><strong>Idioma:</strong> Idioma del contenido</li>
                                    <li><strong>Visibilidad:</strong> Público, No listado o Privado</li>
                                  </ul>
                                </li>
                                <li>Haz clic en <strong>"Importar Podcast"</strong></li>
                              </ol>
                            </div>

                            <div>
                              <p className="font-medium text-primary">Qué sucede durante la importación:</p>
                              <ul className="list-disc pl-6 space-y-1">
                                <li>Se crea automáticamente un nuevo podcast con la información proporcionada</li>
                                <li>Cada archivo MP3 se convierte en un episodio individual:
                                  <ul className="list-circle pl-6 mt-1">
                                    <li><strong>Título del episodio:</strong> Se extrae del nombre del archivo</li>
                                    <li><strong>Audio:</strong> Se sube a tu sistema de almacenamiento (local o Google Drive)</li>
                                    <li><strong>Cover Art:</strong> Hereda la imagen del podcast (si la proporcionaste)</li>
                                  </ul>
                                </li>
                                <li>Verás una <strong>barra de progreso</strong> durante el proceso de subida</li>
                                <li>Al finalizar, se muestra un resumen con el número de episodios importados</li>
                              </ul>
                            </div>
                          </div>

                          <div className="mt-4 space-y-2">
                            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs">
                              <strong>💡 Ventajas de la importación local:</strong>
                              <ul className="list-disc pl-4 mt-1 space-y-0.5">
                                <li>Ideal para migrar contenido desde otras plataformas</li>
                                <li>Perfecto para subir grabaciones masivas de conferencias o cursos</li>
                                <li>Todos los archivos se suben a la vez, ahorrando tiempo</li>
                                <li>Control total sobre la calidad del audio (sin conversiones adicionales)</li>
                              </ul>
                            </div>
                            <div className="p-2 bg-gray-50 dark:bg-gray-900/20 rounded text-xs">
                              <strong>📊 Límites técnicos:</strong>
                              <ul className="list-disc pl-4 mt-1 space-y-0.5">
                                <li>Máximo 50 archivos MP3 por importación</li>
                                <li>Tamaño máximo por archivo: 500MB</li>
                                <li>Solo archivos de audio en formato MP3</li>
                                <li>Los títulos de episodios se pueden editar después de la importación</li>
                              </ul>
                            </div>
                            <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded text-xs">
                              <strong>✅ Consejos para mejores resultados:</strong>
                              <ul className="list-disc pl-4 mt-1 space-y-0.5">
                                <li>Nombra tus archivos de forma descriptiva (ej: "01 - Introducción.mp3")</li>
                                <li>Asegúrate de que todos los archivos estén en formato MP3</li>
                                <li>Prepara una imagen cuadrada de cover art (1400x1400px recomendado)</li>
                                <li>Revisa los episodios después de importar para ajustar títulos y descripciones</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="item-2">
                    <AccordionTrigger>Añadir Episodios</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 text-sm">
                        <p><strong>Publicar nuevo episodio:</strong></p>
                        <ol className="list-decimal pl-6 space-y-2">
                          <li>Entra a tu podcast desde <strong>"Mis Podcasts"</strong></li>
                          <li>Haz clic en <strong>"Añadir Episodio"</strong></li>
                          <li>Completa la información:
                            <ul className="list-circle pl-6 mt-1">
                              <li><strong>Título:</strong> Nombre del episodio</li>
                              <li><strong>Descripción/Notas:</strong> Detalles del episodio, temas tratados, timestamps, etc.</li>
                              <li><strong>Cover Art (opcional):</strong> Imagen específica para este episodio</li>
                              <li><strong>Archivo de Audio (obligatorio):</strong> Sube tu archivo MP3/M4A (máx 500MB)</li>
                              <li><strong>Duración:</strong> Se detecta automáticamente o ingrésala manualmente</li>
                            </ul>
                          </li>
                          <li>Configura la privacidad del episodio (puede ser diferente a la del podcast)</li>
                          <li>Haz clic en <strong>"Crear Episodio"</strong></li>
                          <li>El episodio queda pendiente de aprobación por un administrador</li>
                        </ol>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="item-3">
                    <AccordionTrigger>Gestionar Privacidad e Invitaciones</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 text-sm">
                        <p><strong>Control de acceso:</strong></p>
                        <ul className="list-disc pl-6 space-y-2">
                          <li><strong>Cambiar privacidad:</strong> Edita tu podcast o episodio y cambia la configuración de visibilidad</li>
                          <li><strong>Gestionar invitaciones:</strong>
                            <ul className="list-circle pl-6 mt-1">
                              <li>Para contenido <strong>No listado</strong> o <strong>Privado</strong>, aparece el botón <strong>"Gestionar Invitaciones"</strong></li>
                              <li>Ingresa correos electrónicos de personas que quieres invitar</li>
                              <li>Cada persona invitada puede acceder al contenido aunque sea privado</li>
                              <li>Puedes eliminar invitaciones en cualquier momento</li>
                            </ul>
                          </li>
                          <li>Las invitaciones funcionan tanto a nivel de podcast como de episodio individual</li>
                        </ul>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="item-4">
                    <AccordionTrigger>Editar Podcasts y Episodios</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 text-sm">
                        <p><strong>Actualizar tu contenido:</strong></p>
                        <ul className="list-disc pl-6 space-y-2">
                          <li>Desde <strong>"Mis Podcasts"</strong>, haz clic en el podcast que quieres editar</li>
                          <li>Usa el botón <strong>"Editar"</strong> para modificar información del podcast</li>
                          <li>Para editar un episodio:
                            <ul className="list-circle pl-6 mt-1">
                              <li>Haz clic en el episodio para ver sus detalles</li>
                              <li>Haz clic en <strong>"Editar"</strong></li>
                              <li>Puedes cambiar título, descripción, cover art y privacidad</li>
                              <li>No puedes cambiar el archivo de audio de un episodio ya publicado</li>
                            </ul>
                          </li>
                          <li>Los cambios en podcasts pueden requerir aprobación del administrador</li>
                        </ul>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="item-5">
                    <AccordionTrigger>Distribuir con RSS</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 text-sm">
                        <p><strong>Alcance más allá de la plataforma:</strong></p>
                        <ul className="list-disc pl-6 space-y-2">
                          <li>Cada podcast tiene un <strong>Feed RSS automático</strong> compatible con iTunes/Apple Podcasts</li>
                          <li>Accede al feed desde el icono RSS en la página de tu podcast</li>
                          <li>Copia la URL del RSS para enviarlo a:
                            <ul className="list-circle pl-6 mt-1">
                              <li>Apple Podcasts</li>
                              <li>Spotify</li>
                              <li>Google Podcasts</li>
                              <li>Cualquier app de podcasts que soporte RSS</li>
                            </ul>
                          </li>
                          <li>El feed se actualiza automáticamente cuando publicas nuevos episodios</li>
                        </ul>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="item-6">
                    <AccordionTrigger>Estados de Moderación</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 text-sm">
                        <p><strong>Proceso de aprobación:</strong></p>
                        <ul className="list-disc pl-6 space-y-2">
                          <li><strong>Borrador:</strong> Contenido guardado pero no enviado para revisión</li>
                          <li><strong>Pendiente de Aprobación:</strong> Enviado a los administradores para revisión</li>
                          <li><strong>Aprobado:</strong> Contenido publicado y visible según configuración de privacidad</li>
                          <li><strong>Rechazado:</strong> El administrador rechazó el contenido (recibirás notificación)</li>
                          <li>Verás indicadores de estado en tus podcasts y episodios</li>
                          <li>Solo el contenido aprobado es visible públicamente</li>
                        </ul>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="item-7">
                    <AccordionTrigger>Buenas Prácticas</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 text-sm">
                        <p><strong>Recomendaciones:</strong></p>
                        <ul className="list-disc pl-6 space-y-2">
                          <li><strong>Cover Art:</strong> Usa imágenes de alta calidad, cuadradas, con texto legible incluso en tamaño pequeño</li>
                          <li><strong>Audio:</strong> Exporta en formato MP3 o M4A, bitrate de 128-192 kbps es suficiente</li>
                          <li><strong>Títulos:</strong> Sé descriptivo pero conciso, evita clickbait</li>
                          <li><strong>Descripciones:</strong> Incluye timestamps, menciona temas importantes, enlaces relevantes</li>
                          <li><strong>Consistencia:</strong> Mantén un horario regular de publicación</li>
                          <li><strong>SEO:</strong> Usa palabras clave relevantes en títulos y descripciones</li>
                        </ul>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ADMINISTRADORES */}
          <TabsContent value="admin">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  Guía para Administradores
                </CardTitle>
                <CardDescription>
                  Gestión completa de usuarios, contenido y configuración de la plataforma
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="item-1">
                    <AccordionTrigger>Panel de Administración</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 text-sm">
                        <p><strong>Acceso al panel:</strong></p>
                        <ul className="list-disc pl-6 space-y-2">
                          <li>Como administrador, verás la sección <strong>"Administración"</strong> en el menú lateral</li>
                          <li>Opciones disponibles:
                            <ul className="list-circle pl-6 mt-1">
                              <li><strong>Dashboard:</strong> Vista general de estadísticas</li>
                              <li><strong>Usuarios:</strong> Gestión de cuentas de usuarios</li>
                              <li><strong>Podcasts:</strong> Moderación de podcasts</li>
                              <li><strong>Episodios:</strong> Moderación de episodios</li>
                              <li><strong>Email Config:</strong> Configuración de correo electrónico</li>
                              <li><strong>Google Drive:</strong> Configuración de almacenamiento</li>
                            </ul>
                          </li>
                        </ul>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="item-2">
                    <AccordionTrigger>Gestión de Usuarios</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 text-sm">
                        <p><strong>Administrar cuentas:</strong></p>
                        <ul className="list-disc pl-6 space-y-2">
                          <li><strong>Ver todos los usuarios:</strong> Accede a la lista completa desde "Usuarios"</li>
                          <li><strong>Cambiar roles:</strong>
                            <ul className="list-circle pl-6 mt-1">
                              <li><strong>LISTENER:</strong> Solo puede escuchar podcasts</li>
                              <li><strong>CREATOR:</strong> Puede crear y gestionar podcasts</li>
                              <li><strong>ADMIN:</strong> Acceso total a la plataforma</li>
                            </ul>
                          </li>
                          <li><strong>Activar/Desactivar usuarios:</strong> Bloquea o reactiva cuentas individualmente</li>
                          <li><strong>Operaciones masivas:</strong>
                            <ul className="list-circle pl-6 mt-1">
                              <li>Selecciona múltiples usuarios con checkboxes</li>
                              <li>Activa o desactiva hasta 50 usuarios a la vez</li>
                              <li>Elimina cuentas en lote si es necesario</li>
                            </ul>
                          </li>
                          <li><strong>Búsqueda y filtros:</strong> Encuentra usuarios por nombre o email</li>
                        </ul>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="item-3">
                    <AccordionTrigger>Moderación de Podcasts</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 text-sm">
                        <p><strong>Revisar y aprobar podcasts:</strong></p>
                        <ul className="list-disc pl-6 space-y-2">
                          <li>Ve a <strong>"Podcasts"</strong> en el panel de administración</li>
                          <li><strong>Filtrar por estado:</strong>
                            <ul className="list-circle pl-6 mt-1">
                              <li>Pendientes de aprobación</li>
                              <li>Aprobados</li>
                              <li>Rechazados</li>
                              <li>Todos</li>
                            </ul>
                          </li>
                          <li><strong>Revisar contenido:</strong> Haz clic en un podcast para ver todos sus detalles</li>
                          <li><strong>Aprobar o rechazar:</strong>
                            <ul className="list-circle pl-6 mt-1">
                              <li>Selecciona podcasts individuales o múltiples</li>
                              <li>Usa los botones de acción para aprobar o rechazar</li>
                              <li>Los creadores reciben notificaciones del cambio de estado</li>
                            </ul>
                          </li>
                          <li><strong>Editar contenido:</strong> Puedes editar cualquier podcast si es necesario</li>
                          <li><strong>Eliminar podcasts:</strong> Elimina contenido inapropiado (acción irreversible)</li>
                        </ul>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="item-4">
                    <AccordionTrigger>Moderación de Episodios</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 text-sm">
                        <p><strong>Gestión de episodios:</strong></p>
                        <ul className="list-disc pl-6 space-y-2">
                          <li>Accede a <strong>"Episodios"</strong> para ver todos los episodios de la plataforma</li>
                          <li><strong>Filtros disponibles:</strong> Por estado de moderación, búsqueda por título</li>
                          <li><strong>Proceso de aprobación:</strong>
                            <ul className="list-circle pl-6 mt-1">
                              <li>Revisa episodios pendientes</li>
                              <li>Escucha el audio si es necesario</li>
                              <li>Aprueba episodios que cumplan las políticas</li>
                              <li>Rechaza contenido inapropiado con notificación al creador</li>
                            </ul>
                          </li>
                          <li><strong>Operaciones masivas:</strong> Aprueba o rechaza múltiples episodios a la vez (máx 50)</li>
                          <li><strong>Editar episodios:</strong> Modifica metadata si encuentras errores</li>
                        </ul>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="item-5">
                    <AccordionTrigger>Configuración de Email</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 text-sm">
                        <p><strong>SMTP y notificaciones:</strong></p>
                        <ul className="list-disc pl-6 space-y-2">
                          <li>Ve a <strong>"Email Config"</strong> para configurar el servidor de correo</li>
                          <li><strong>Configuración SMTP:</strong>
                            <ul className="list-circle pl-6 mt-1">
                              <li>Host: Servidor SMTP (ej: smtp.gmail.com)</li>
                              <li>Puerto: Generalmente 587 (TLS) o 465 (SSL)</li>
                              <li>Usuario: Tu cuenta de correo</li>
                              <li>Contraseña: Contraseña de aplicación</li>
                              <li>Nombre del remitente: Ej: "PodcastHub Notificaciones"</li>
                            </ul>
                          </li>
                          <li><strong>Probar configuración:</strong> Envía un email de prueba antes de activar</li>
                          <li><strong>Tipos de emails automáticos:</strong>
                            <ul className="list-circle pl-6 mt-1">
                              <li>Bienvenida a nuevos usuarios</li>
                              <li>Verificación de correo electrónico</li>
                              <li>Recuperación de contraseña</li>
                              <li>Notificaciones de moderación (aprobaciones/rechazos)</li>
                            </ul>
                          </li>
                        </ul>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="item-6">
                    <AccordionTrigger>Configuración de Google Drive</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 text-sm">
                        <p><strong>Almacenamiento en la nube:</strong></p>
                        <ul className="list-disc pl-6 space-y-2">
                          <li>Accede a <strong>"Google Drive"</strong> para configurar almacenamiento externo</li>
                          <li><strong>Configuración:</strong>
                            <ul className="list-circle pl-6 mt-1">
                              <li>Crea un proyecto en Google Cloud Console</li>
                              <li>Habilita Google Drive API</li>
                              <li>Genera credenciales de cuenta de servicio</li>
                              <li>Descarga el archivo JSON de credenciales</li>
                              <li>Copia el contenido en la configuración de la plataforma</li>
                            </ul>
                          </li>
                          <li><strong>Beneficios:</strong>
                            <ul className="list-circle pl-6 mt-1">
                              <li>Almacenamiento ilimitado (según plan de Google)</li>
                              <li>Los archivos de audio se guardan en Drive automáticamente</li>
                              <li>Reduce costos de almacenamiento del servidor</li>
                            </ul>
                          </li>
                          <li>Sin configurar Google Drive, los archivos se guardan localmente en el servidor</li>
                        </ul>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="item-7">
                    <AccordionTrigger>Operaciones Masivas</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 text-sm">
                        <p><strong>Gestión eficiente:</strong></p>
                        <ul className="list-disc pl-6 space-y-2">
                          <li><strong>Selección múltiple:</strong> Usa checkboxes para seleccionar hasta 50 elementos</li>
                          <li><strong>Seleccionar todo:</strong> Checkbox en el encabezado selecciona todos los visibles</li>
                          <li><strong>Acciones disponibles:</strong>
                            <ul className="list-circle pl-6 mt-1">
                              <li>Aprobar/Rechazar contenido en lote</li>
                              <li>Activar/Desactivar usuarios múltiples</li>
                              <li>Eliminar elementos seleccionados</li>
                            </ul>
                          </li>
                          <li><strong>Gestión de errores:</strong>
                            <ul className="list-circle pl-6 mt-1">
                              <li>Verás notificaciones separadas de éxitos y fallos</li>
                              <li>Los elementos fallidos permanecen seleccionados para reintentar</li>
                              <li>Los exitosos se deseleccionan automáticamente</li>
                            </ul>
                          </li>
                          <li><strong>Protección:</strong> Las operaciones destructivas requieren confirmación en diálogos</li>
                        </ul>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="item-8">
                    <AccordionTrigger>Mejores Prácticas de Moderación</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 text-sm">
                        <p><strong>Guías para administradores:</strong></p>
                        <ul className="list-disc pl-6 space-y-2">
                          <li><strong>Criterios de aprobación:</strong>
                            <ul className="list-circle pl-6 mt-1">
                              <li>Contenido apropiado para la audiencia</li>
                              <li>Sin infracción de derechos de autor</li>
                              <li>Metadata correcta y descriptiva</li>
                              <li>Audio de calidad aceptable</li>
                            </ul>
                          </li>
                          <li><strong>Comunicación:</strong> Al rechazar, considera enviar feedback al creador</li>
                          <li><strong>Consistencia:</strong> Aplica los mismos estándares a todo el contenido</li>
                          <li><strong>Privacidad:</strong> Respeta la configuración de privacidad de los creadores</li>
                          <li><strong>Respaldo:</strong> Mantén registro de decisiones importantes de moderación</li>
                        </ul>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
