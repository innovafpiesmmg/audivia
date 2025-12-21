import { Octokit } from '@octokit/rest';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('GitHub not connected');
  }
  return accessToken;
}

async function createRepository(repoName: string, description: string) {
  try {
    const octokit = new Octokit({ auth: await getAccessToken() });
    
    console.log('🔍 Verificando usuario...');
    const { data: user } = await octokit.rest.users.getAuthenticated();
    console.log(`✅ Usuario: ${user.login}\n`);
    
    // Intentar eliminar el repositorio existente si existe
    try {
      console.log(`🗑️  Eliminando repositorio anterior si existe...`);
      await octokit.rest.repos.delete({
        owner: user.login,
        repo: repoName,
      });
      console.log(`✅ Repositorio anterior eliminado\n`);
      // Esperar un poco para que GitHub procese la eliminación
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error: any) {
      if (error.status !== 404) {
        console.log(`ℹ️  No se encontró repositorio anterior (normal si es la primera vez)\n`);
      }
    }
    
    console.log(`📝 Creando nuevo repositorio: ${repoName}...`);
    const { data: repo } = await octokit.rest.repos.createForAuthenticatedUser({
      name: repoName,
      description: description,
      private: false,
      auto_init: true,  // IMPORTANTE: Inicializar con README
      gitignore_template: 'Node',
    });
    
    console.log(`✅ Repositorio creado con inicialización automática`);
    console.log(`🔗 URL: ${repo.html_url}`);
    console.log(`📡 Clone: ${repo.clone_url}\n`);
    
    return {
      success: true,
      url: repo.html_url,
      cloneUrl: repo.clone_url,
      owner: user.login,
      name: repoName,
    };
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Detalles:', error.response.data);
    }
    return { success: false, error: error.message };
  }
}

// Ejecutar
const repoName = 'podcast-platform';
const description = '🎙️ Plataforma Multitenant de Podcasts - Desarrollado por Atreyu Servicios Digitales';

createRepository(repoName, description)
  .then(result => {
    if (result.success) {
      console.log('═══════════════════════════════════════');
      console.log('✅ ¡REPOSITORIO LISTO!');
      console.log('═══════════════════════════════════════');
      console.log(`Ahora ejecuta: npx tsx scripts/push-final.ts`);
      console.log('═══════════════════════════════════════');
      process.exit(0);
    } else {
      console.error('\n❌ Falló la creación del repositorio');
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('❌ Error inesperado:', err);
    process.exit(1);
  });
