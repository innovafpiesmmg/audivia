import { Octokit } from '@octokit/rest';
import fs from 'fs/promises';
import path from 'path';

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

async function getGitHubClient() {
  const accessToken = await getAccessToken();
  return new Octokit({ auth: accessToken });
}

const IGNORE_PATTERNS = [
  'node_modules',
  'dist',
  '.DS_Store',
  'server/public',
  '.env',
  '.env.local',
  '.env.production',
  '*.sql',
  '*.dump',
  'logs',
  '*.log',
  'tmp',
  'temp',
  '.vscode',
  '.idea',
  '.git',
  '.cache',
  '.local',
  'uploads/images',
  'uploads/audio',
  'scripts/upload-to-github.ts',
  'scripts/create-github-repo.ts',
  'scripts/push-to-github-simple.ts',
  'scripts/push-final.ts',
  'scripts/create-new-repo.ts'
];

function shouldIgnore(filePath: string): boolean {
  return IGNORE_PATTERNS.some(pattern => {
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace('*', '.*'));
      return regex.test(filePath);
    }
    return filePath.includes(pattern);
  });
}

async function getAllFiles(dir: string, baseDir: string = dir): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(baseDir, fullPath);

    if (shouldIgnore(relativePath) || shouldIgnore(entry.name)) {
      continue;
    }

    if (entry.isDirectory()) {
      files.push(...await getAllFiles(fullPath, baseDir));
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }

  return files;
}

async function pushToGitHub(owner: string, repo: string, branch: string = 'main') {
  try {
    const octokit = await getGitHubClient();
    
    console.log('📂 Escaneando archivos...');
    const filePaths = await getAllFiles(process.cwd());
    
    // Asegurar .gitkeep
    const gitkeepFiles = ['uploads/.gitkeep', 'uploads/images/.gitkeep', 'uploads/audio/.gitkeep'];
    for (const gitkeep of gitkeepFiles) {
      if (!filePaths.includes(gitkeep)) {
        try {
          await fs.mkdir(path.dirname(gitkeep), { recursive: true });
          await fs.writeFile(gitkeep, '');
          filePaths.push(gitkeep);
        } catch {}
      }
    }
    
    console.log(`✅ ${filePaths.length} archivos encontrados\n`);
    
    // Step 1: Create blobs
    console.log('📤 Creando blobs...');
    const blobs: any[] = [];
    let processed = 0;
    
    for (const filePath of filePaths) {
      try {
        const stats = await fs.stat(filePath);
        if (!stats.isFile()) continue;
        
        const content = await fs.readFile(filePath);
        const { data } = await octokit.rest.git.createBlob({
          owner,
          repo,
          content: content.toString('base64'),
          encoding: 'base64'
        });
        
        blobs.push({
          path: filePath,
          mode: filePath.endsWith('.sh') ? '100755' as const : '100644' as const,
          type: 'blob' as const,
          sha: data.sha
        });
        
        processed++;
        if (processed % 50 === 0) {
          console.log(`  📦 ${processed}/${filePaths.length}...`);
        }
      } catch (error: any) {
        console.warn(`  ⚠️  Saltando ${filePath}`);
      }
    }
    
    console.log(`  ✅ ${processed} blobs creados\n`);
    
    // Step 2: Get current commit (repo is now initialized)
    console.log('🔍 Obteniendo commit actual...');
    const { data: ref } = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`
    });
    
    const currentCommit = await octokit.rest.git.getCommit({
      owner,
      repo,
      commit_sha: ref.object.sha
    });
    
    console.log(`  ✅ Commit base: ${currentCommit.data.sha.substring(0, 7)}\n`);
    
    // Step 3: Create tree (with base_tree since repo is not empty)
    console.log('🌳 Creando árbol...');
    const { data: tree } = await octokit.rest.git.createTree({
      owner,
      repo,
      tree: blobs,
      base_tree: currentCommit.data.tree.sha  // Use base tree
    });
    
    console.log(`  ✅ Árbol creado: ${tree.sha}\n`);
    
    // Step 4: Create commit (with parent)
    console.log('💾 Creando commit...');
    const { data: commit } = await octokit.rest.git.createCommit({
      owner,
      repo,
      message: 'Código completo - Podcast Platform\n\n✨ Plataforma completa de podcasting multitenant\n\n📦 Incluye:\n- Instalador automático para Ubuntu (scripts/install.sh)\n- Documentación completa (README.md)\n- Sistema de almacenamiento local persistente\n- Panel de administración\n- Sistema de roles (Admin/Creator/Listener)\n- Feeds RSS automáticos\n- Reproductores embebibles\n- Sistema de playlists\n- Control de privacidad\n- Invitaciones por email\n\n🚀 Desarrollado por Atreyu Servicios Digitales',
      tree: tree.sha,
      parents: [currentCommit.data.sha]  // Add parent!
    });
    
    console.log(`  ✅ Commit creado: ${commit.sha.substring(0, 7)}\n`);
    
    // Step 5: Update branch reference
    console.log('🌿 Actualizando branch...');
    await octokit.rest.git.updateRef({
      owner,
      repo,
      ref: `heads/${branch}`,
      sha: commit.sha
    });
    
    console.log(`  ✅ Branch ${branch} actualizado\n`);
    
    console.log('═══════════════════════════════════════');
    console.log('✅ ¡CÓDIGO SUBIDO EXITOSAMENTE!');
    console.log('═══════════════════════════════════════');
    console.log(`🔗 Repositorio: https://github.com/${owner}/${repo}`);
    console.log(`📦 Archivos: ${processed}`);
    console.log(`📝 Commit: ${commit.sha.substring(0, 7)}`);
    console.log(`🌿 Branch: ${branch}`);
    console.log('═══════════════════════════════════════');
    
    return true;
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('Detalles:', JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
}

// Ejecutar
pushToGitHub('innovafpiesmmg', 'podcast-saas', 'main')
  .then(success => process.exit(success ? 0 : 1))
  .catch(err => {
    console.error('❌ Error inesperado:', err);
    process.exit(1);
  });
