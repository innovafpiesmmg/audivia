import { Octokit } from '@octokit/rest';
import { createRequire } from 'module';
import fs from 'fs/promises';
import path from 'path';

const require = createRequire(import.meta.url);

let Octokit_: typeof Octokit;
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
  if (!Octokit_) {
    const plugin = require('octokit-commit-multiple-files');
    Octokit_ = Octokit.plugin(plugin);
  }
  return new Octokit_({ auth: accessToken });
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
  'scripts/upload-to-github.ts',
  'scripts/create-github-repo.ts',
  'scripts/push-to-github-simple.ts'
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
    console.log('📂 Escaneando archivos...');
    const filePaths = await getAllFiles(process.cwd());
    
    // Asegurar que se incluyen los .gitkeep
    const gitkeepFiles = [
      'uploads/.gitkeep',
      'uploads/images/.gitkeep',
      'uploads/audio/.gitkeep'
    ];
    
    for (const gitkeep of gitkeepFiles) {
      if (!filePaths.includes(gitkeep)) {
        try {
          await fs.access(gitkeep);
          filePaths.push(gitkeep);
        } catch {
          await fs.mkdir(path.dirname(gitkeep), { recursive: true });
          await fs.writeFile(gitkeep, '');
          filePaths.push(gitkeep);
        }
      }
    }
    
    console.log(`✅ Encontrados ${filePaths.length} archivos para subir`);
    
    // Preparar archivos
    console.log('\n📤 Preparando archivos...');
    const files: Record<string, string | { contents: string; mode: '100644' | '100755' }> = {};
    
    let processed = 0;
    for (const filePath of filePaths) {
      try {
        const stats = await fs.stat(filePath);
        if (!stats.isFile()) continue;
        
        const content = await fs.readFile(filePath, 'utf-8');
        
        // Determinar si es ejecutable
        if (filePath.endsWith('.sh')) {
          files[filePath] = {
            contents: content,
            mode: '100755'
          };
        } else {
          files[filePath] = content;
        }
        
        processed++;
        if (processed % 100 === 0) {
          console.log(`  📦 ${processed}/${filePaths.length} archivos procesados...`);
        }
      } catch (error: any) {
        console.warn(`  ⚠️  Error al leer ${filePath}:`, error.message);
      }
    }
    
    console.log(`  ✅ ${processed} archivos listos`);
    
    // Subir a GitHub
    console.log('\n🚀 Subiendo a GitHub...');
    const octokit = await getGitHubClient();
    
    await (octokit.repos as any).createOrUpdateFiles({
      owner,
      repo,
      branch,
      createBranch: true,
      forkFromBaseBranch: false,
      changes: [
        {
          message: 'Initial commit - Podcast Platform con instalación automatizada\n\n- Instalador automático para Ubuntu\n- Documentación completa en README.md\n- Configuración de almacenamiento local\n- Scripts de backup y deployment',
          files
        }
      ]
    });
    
    console.log('\n✅ ¡Código subido exitosamente!');
    console.log(`🔗 https://github.com/${owner}/${repo}`);
    console.log(`📦 ${processed} archivos subidos`);
    console.log(`🌿 Branch: ${branch}`);
    
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
const owner = 'innovafpiesmmg';
const repo = 'podcast-platform';
const branch = 'main';

pushToGitHub(owner, repo, branch)
  .then(success => process.exit(success ? 0 : 1))
  .catch(err => {
    console.error('❌ Error inesperado:', err);
    process.exit(1);
  });
