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
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
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

async function getGitHubClient() {
  const accessToken = await getAccessToken();
  return new Octokit({ auth: accessToken });
}

async function createRepository(repoName: string, description: string, isPrivate: boolean = false) {
  try {
    const octokit = await getGitHubClient();
    
    console.log('🔍 Verificando usuario de GitHub...');
    const { data: user } = await octokit.rest.users.getAuthenticated();
    console.log(`✅ Conectado como: ${user.login}`);
    
    console.log(`\n📝 Creando repositorio: ${repoName}...`);
    const { data: repo } = await octokit.rest.repos.createForAuthenticatedUser({
      name: repoName,
      description: description,
      private: isPrivate,
      auto_init: false, // No crear README automático
    });
    
    console.log(`✅ Repositorio creado: ${repo.html_url}`);
    console.log(`📡 URL de clonación: ${repo.clone_url}`);
    
    return {
      success: true,
      url: repo.html_url,
      cloneUrl: repo.clone_url,
      owner: user.login,
      name: repoName,
    };
  } catch (error: any) {
    if (error.status === 422) {
      console.error('❌ Error: El repositorio ya existe');
      // Intentar obtener el repositorio existente
      try {
        const octokit = await getGitHubClient();
        const { data: user } = await octokit.rest.users.getAuthenticated();
        const { data: repo } = await octokit.rest.repos.get({
          owner: user.login,
          repo: repoName,
        });
        console.log(`ℹ️  Usando repositorio existente: ${repo.html_url}`);
        return {
          success: true,
          url: repo.html_url,
          cloneUrl: repo.clone_url,
          owner: user.login,
          name: repoName,
          existing: true,
        };
      } catch (e) {
        console.error('❌ Error al obtener repositorio existente:', e);
        return { success: false, error: 'Repository exists but could not be accessed' };
      }
    }
    console.error('❌ Error al crear repositorio:', error.message);
    return { success: false, error: error.message };
  }
}

// Ejecutar
const repoName = process.argv[2] || 'podcast-platform';
const description = process.argv[3] || 'Plataforma Multitenant de Podcasts - Desarrollado por Atreyu Servicios Digitales';
const isPrivate = process.argv[4] === 'true';

createRepository(repoName, description, isPrivate)
  .then(result => {
    if (result.success) {
      console.log('\n✨ Repositorio listo para usar!');
      process.exit(0);
    } else {
      console.error('\n❌ Error:', result.error);
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('❌ Error inesperado:', err);
    process.exit(1);
  });
