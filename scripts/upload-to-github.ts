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

// Lista de archivos/directorios a ignorar (según .gitignore)
const IGNORE_PATTERNS = [
  'node_modules',
  'dist',
  '.DS_Store',
  'server/public',
  '.env',
  '.env.local',
  '.env.production',
  'uploads',
  '*.sql',
  '*.dump',
  'logs',
  '*.log',
  'tmp',
  'temp',
  '.vscode',
  '.idea',
  '.git',
  'scripts/upload-to-github.ts', // No subir este script
  'scripts/create-github-repo.ts'
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

    // Ignorar el directorio completo si coincide con el patrón
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

async function uploadToGitHub(owner: string, repo: string, branch: string = 'main') {
  const octokit = await getGitHubClient();
  
  console.log('📂 Escaneando archivos...');
  const files = await getAllFiles(process.cwd());
  console.log(`✅ Encontrados ${files.length} archivos para subir`);

  // Asegurar que se incluyen los .gitkeep
  const gitkeepFiles = [
    'uploads/.gitkeep',
    'uploads/images/.gitkeep',
    'uploads/audio/.gitkeep'
  ];
  
  for (const gitkeep of gitkeepFiles) {
    if (!files.includes(gitkeep)) {
      try {
        await fs.access(gitkeep);
        files.push(gitkeep);
        console.log(`📌 Agregado: ${gitkeep}`);
      } catch {
        // Crear el archivo si no existe
        await fs.mkdir(path.dirname(gitkeep), { recursive: true });
        await fs.writeFile(gitkeep, '');
        files.push(gitkeep);
        console.log(`📌 Creado y agregado: ${gitkeep}`);
      }
    }
  }

  try {
    // Verificar si el repositorio está vacío
    console.log(`\n🔍 Verificando repositorio...`);
    let isEmptyRepo = false;
    let currentCommitSha: string | undefined;
    
    try {
      const ref = await octokit.rest.git.getRef({
        owner,
        repo,
        ref: `heads/${branch}`
      });
      currentCommitSha = ref.data.object.sha;
      console.log(`✅ Branch ${branch} encontrado`);
    } catch (error: any) {
      if (error.status === 404 || error.status === 409) {
        console.log(`📝 Repositorio vacío, creando primer commit...`);
        isEmptyRepo = true;
      } else {
        throw error;
      }
    }

    // Crear blobs para todos los archivos
    console.log('\n📤 Subiendo archivos...');
    const blobs: any[] = [];
    let uploaded = 0;
    
    for (const file of files) {
      try {
        const stats = await fs.stat(file);
        
        // Solo procesar archivos, no directorios
        if (!stats.isFile()) {
          continue;
        }
        
        const content = await fs.readFile(file);
        const { data } = await octokit.rest.git.createBlob({
          owner,
          repo,
          content: content.toString('base64'),
          encoding: 'base64'
        });
        
        // Determinar permisos
        let mode: '100644' | '100755' = '100644';
        if (file.endsWith('.sh')) {
          mode = '100755'; // Ejecutable
        }
        
        blobs.push({
          path: file,
          mode,
          type: 'blob' as const,
          sha: data.sha
        });
        
        uploaded++;
        if (uploaded % 50 === 0) {
          console.log(`  📦 ${uploaded}/${files.length} archivos procesados...`);
        }
      } catch (error: any) {
        if (error.code !== 'EISDIR') {
          console.warn(`  ⚠️  Error al procesar ${file}:`, error.message);
        }
      }
    }
    
    console.log(`  ✅ ${uploaded} archivos listos para subir`);

    // Crear nuevo árbol
    console.log('\n🌳 Creando árbol de archivos...');
    const treeOptions: any = {
      owner,
      repo,
      tree: blobs
    };
    
    // Si no es un repositorio vacío, usar el árbol base
    if (!isEmptyRepo && currentCommitSha) {
      const currentCommit = await octokit.rest.git.getCommit({
        owner,
        repo,
        commit_sha: currentCommitSha
      });
      treeOptions.base_tree = currentCommit.data.tree.sha;
    }
    
    const { data: newTree } = await octokit.rest.git.createTree(treeOptions);

    // Crear nuevo commit
    console.log('💾 Creando commit...');
    const commitOptions: any = {
      owner,
      repo,
      message: 'Initial commit - Podcast Platform con instalación automatizada\n\n- Instalador automático para Ubuntu\n- Documentación completa en README.md\n- Configuración de almacenamiento local\n- Scripts de backup y deployment',
      tree: newTree.sha
    };
    
    // Solo agregar parent si no es repositorio vacío
    if (!isEmptyRepo && currentCommitSha) {
      commitOptions.parents = [currentCommitSha];
    }
    
    const { data: newCommit } = await octokit.rest.git.createCommit(commitOptions);

    // Crear o actualizar referencia
    if (isEmptyRepo) {
      console.log('🚀 Creando branch...');
      await octokit.rest.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${branch}`,
        sha: newCommit.sha
      });
    } else {
      console.log('🚀 Actualizando branch...');
      await octokit.rest.git.updateRef({
        owner,
        repo,
        ref: `heads/${branch}`,
        sha: newCommit.sha
      });
    }

    console.log('\n✅ ¡Código subido exitosamente!');
    console.log(`🔗 https://github.com/${owner}/${repo}`);
    console.log(`📦 ${files.length} archivos subidos`);
    console.log(`📝 Commit: ${newCommit.sha.substring(0, 7)}`);
    
    return true;
  } catch (error: any) {
    console.error('\n❌ Error al subir archivos:', error.message);
    if (error.response) {
      console.error('Detalles:', error.response.data);
    }
    return false;
  }
}

// Ejecutar
const owner = 'innovafpiesmmg';
const repo = 'podcast-platform';
const branch = 'main';

uploadToGitHub(owner, repo, branch)
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('❌ Error inesperado:', err);
    process.exit(1);
  });
