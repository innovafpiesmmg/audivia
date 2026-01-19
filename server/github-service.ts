import { Octokit } from '@octokit/rest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
// @ts-ignore
import { CreateOrUpdateFiles } from 'octokit-commit-multiple-files';

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

async function getUncachableGitHubClient() {
  const accessToken = await getAccessToken();
  return new Octokit({ auth: accessToken });
}

const REPO_OWNER = 'innovafpiesmmg';
const REPO_NAME = 'audivia';

const IGNORE_PATTERNS = [
  'node_modules/',
  '.git/',
  '.replit',
  '.config/',
  '.cache/',
  '.local/',
  'dist/',
  '.upm/',
  'replit.nix',
  '.breakpoints',
  'package-lock.json',
  'uploads/',
  '.env',
  '*.log',
  '*.mp3',
  '*.zip',
  'attached_assets/Pasted-',
  'attached_assets/generated_images/',
  'attached_assets/logo_extracted/',
];

function shouldIgnore(filePath: string): boolean {
  const normalizedPath = filePath.replace(/\\/g, '/');
  for (const pattern of IGNORE_PATTERNS) {
    if (pattern.startsWith('*')) {
      const ext = pattern.slice(1);
      if (normalizedPath.endsWith(ext)) return true;
    } else if (normalizedPath.includes(pattern)) {
      return true;
    }
  }
  return false;
}

function getAllFiles(dir: string, baseDir: string = dir): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(baseDir, fullPath);
    
    if (shouldIgnore(relativePath)) continue;
    
    if (entry.isDirectory()) {
      files.push(...getAllFiles(fullPath, baseDir));
    } else {
      files.push(relativePath);
    }
  }
  
  return files;
}

export async function syncToGitHub(): Promise<{ success: boolean; message: string; filesUpdated?: number }> {
  try {
    const octokit = await getUncachableGitHubClient();
    
    const { data: user } = await octokit.users.getAuthenticated();
    console.log(`[GitHub] Authenticated as: ${user.login}`);
    
    let repoExists = false;
    try {
      await octokit.repos.get({ owner: user.login, repo: REPO_NAME });
      repoExists = true;
      console.log(`[GitHub] Repository ${REPO_NAME} exists`);
    } catch (error: any) {
      if (error.status === 404) {
        console.log(`[GitHub] Repository ${REPO_NAME} does not exist, creating...`);
        await octokit.repos.createForAuthenticatedUser({
          name: REPO_NAME,
          description: 'Audivia - Premium Audiobook Platform',
          private: false,
          auto_init: true,
        });
        repoExists = true;
        console.log(`[GitHub] Repository ${REPO_NAME} created`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        throw error;
      }
    }
    
    const projectDir = process.cwd();
    const files = getAllFiles(projectDir);
    
    console.log(`[GitHub] Found ${files.length} files to sync`);
    
    const binaryExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.bmp', '.svg', '.woff', '.woff2', '.ttf', '.eot', '.otf', '.pdf'];
    
    const filesObject: Record<string, string> = {};
    const binaryFiles: Array<{path: string, content: Buffer}> = [];
    let fileCount = 0;
    
    for (const file of files) {
      const fullPath = path.join(projectDir, file);
      const ext = path.extname(file).toLowerCase();
      const isBinary = binaryExtensions.includes(ext);
      
      try {
        if (isBinary) {
          const content = fs.readFileSync(fullPath);
          if (content.length > 0) {
            binaryFiles.push({ path: file.replace(/\\/g, '/'), content });
            fileCount++;
          }
        } else {
          const content = fs.readFileSync(fullPath, 'utf-8');
          if (content.length > 0) {
            filesObject[file.replace(/\\/g, '/')] = content;
            fileCount++;
          }
        }
        if (fileCount % 100 === 0) {
          console.log(`[GitHub] Read ${fileCount}/${files.length} files...`);
        }
      } catch (error) {
        console.log(`[GitHub] Skipping unreadable file: ${file}`);
      }
    }
    
    console.log(`[GitHub] Uploading ${Object.keys(filesObject).length} text files in batch...`);
    
    const octokitWithPlugin = CreateOrUpdateFiles(octokit);
    const result = await octokitWithPlugin.createOrUpdateFiles({
      owner: user.login,
      repo: REPO_NAME,
      branch: 'main',
      createBranch: true,
      changes: [
        {
          message: `Sync from Replit - ${new Date().toISOString()}`,
          files: filesObject,
        },
      ],
    });
    
    console.log(`[GitHub] Text files synced. Now uploading ${binaryFiles.length} binary files...`);
    
    // Upload binary files individually using GitHub's contents API
    let binaryUploaded = 0;
    for (const { path: filePath, content } of binaryFiles) {
      try {
        // Get current file SHA if it exists
        let sha: string | undefined;
        try {
          const { data } = await octokit.repos.getContent({
            owner: user.login,
            repo: REPO_NAME,
            path: filePath,
            ref: 'main',
          });
          if (!Array.isArray(data) && data.sha) {
            sha = data.sha;
          }
        } catch (e) {
          // File doesn't exist yet
        }
        
        await octokit.repos.createOrUpdateFileContents({
          owner: user.login,
          repo: REPO_NAME,
          path: filePath,
          message: `Update binary file: ${filePath}`,
          content: content.toString('base64'),
          branch: 'main',
          sha,
        });
        binaryUploaded++;
        if (binaryUploaded % 10 === 0) {
          console.log(`[GitHub] Uploaded ${binaryUploaded}/${binaryFiles.length} binary files...`);
        }
      } catch (error: any) {
        console.log(`[GitHub] Failed to upload binary: ${filePath} - ${error.message}`);
      }
    }
    
    console.log(`[GitHub] Sync complete! ${Object.keys(filesObject).length} text + ${binaryUploaded} binary files.`);
    
    return {
      success: true,
      message: `Repositorio actualizado exitosamente. ${Object.keys(filesObject).length} archivos de texto y ${binaryUploaded} archivos binarios sincronizados.`,
      filesUpdated: Object.keys(filesObject).length + binaryUploaded,
    };
  } catch (error: any) {
    console.error('[GitHub] Error syncing:', error);
    return {
      success: false,
      message: error.message || 'Error al sincronizar con GitHub',
    };
  }
}

export async function getGitHubStatus(): Promise<{ connected: boolean; username?: string; repoUrl?: string }> {
  try {
    const octokit = await getUncachableGitHubClient();
    const { data: user } = await octokit.users.getAuthenticated();
    
    return {
      connected: true,
      username: user.login,
      repoUrl: `https://github.com/${user.login}/${REPO_NAME}`,
    };
  } catch (error) {
    return { connected: false };
  }
}

const PRESERVE_PATTERNS = [
  'node_modules',
  '.git',
  '.replit',
  '.config',
  '.cache',
  '.upm',
  '.breakpoints',
  'uploads',
  'attached_assets',
  '.env',
  'package-lock.json',
];

function shouldPreserve(filePath: string): boolean {
  const normalizedPath = filePath.replace(/\\/g, '/');
  for (const pattern of PRESERVE_PATTERNS) {
    if (normalizedPath.startsWith(pattern) || normalizedPath.includes('/' + pattern)) {
      return true;
    }
  }
  return false;
}

let updateInProgress = false;

export async function pullFromGitHub(): Promise<{ success: boolean; message: string; filesUpdated?: number }> {
  if (updateInProgress) {
    return { success: false, message: 'Ya hay una actualización en progreso' };
  }
  
  updateInProgress = true;
  
  try {
    const octokit = await getUncachableGitHubClient();
    const { data: user } = await octokit.users.getAuthenticated();
    
    console.log(`[GitHub] Pulling from ${user.login}/${REPO_NAME}...`);
    
    let repoExists = false;
    try {
      await octokit.repos.get({ owner: user.login, repo: REPO_NAME });
      repoExists = true;
    } catch (error: any) {
      if (error.status === 404) {
        updateInProgress = false;
        return { success: false, message: 'El repositorio no existe en GitHub' };
      }
      throw error;
    }
    
    console.log('[GitHub] Downloading repository archive...');
    const { data: archive } = await octokit.repos.downloadZipballArchive({
      owner: user.login,
      repo: REPO_NAME,
      ref: 'main',
    });
    
    const tempDir = path.join(os.tmpdir(), `github-pull-${Date.now()}`);
    const zipPath = path.join(tempDir, 'repo.zip');
    
    fs.mkdirSync(tempDir, { recursive: true });
    fs.writeFileSync(zipPath, Buffer.from(archive as ArrayBuffer));
    
    console.log('[GitHub] Extracting archive...');
    const unzipper = await import('unzipper');
    const extractDir = path.join(tempDir, 'extracted');
    
    await new Promise<void>((resolve, reject) => {
      fs.createReadStream(zipPath)
        .pipe(unzipper.Extract({ path: extractDir }))
        .on('close', resolve)
        .on('error', reject);
    });
    
    const extractedContents = fs.readdirSync(extractDir);
    const repoDir = path.join(extractDir, extractedContents[0]);
    
    const projectDir = process.cwd();
    let filesUpdated = 0;
    
    const copyRecursive = (srcDir: string, destDir: string, baseDir: string = srcDir) => {
      const entries = fs.readdirSync(srcDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const srcPath = path.join(srcDir, entry.name);
        const relativePath = path.relative(baseDir, srcPath);
        const destPath = path.join(destDir, relativePath);
        
        if (shouldPreserve(relativePath)) {
          console.log(`[GitHub] Preserving: ${relativePath}`);
          continue;
        }
        
        if (entry.isDirectory()) {
          fs.mkdirSync(destPath, { recursive: true });
          copyRecursive(srcPath, destDir, baseDir);
        } else {
          fs.mkdirSync(path.dirname(destPath), { recursive: true });
          fs.copyFileSync(srcPath, destPath);
          filesUpdated++;
        }
      }
    };
    
    console.log('[GitHub] Copying files to project...');
    copyRecursive(repoDir, projectDir, repoDir);
    
    fs.rmSync(tempDir, { recursive: true, force: true });
    
    console.log(`[GitHub] Pull complete! ${filesUpdated} files updated`);
    
    updateInProgress = false;
    
    return {
      success: true,
      message: `Actualización completada. ${filesUpdated} archivos actualizados. Reiniciando aplicación...`,
      filesUpdated,
    };
  } catch (error: any) {
    console.error('[GitHub] Error pulling:', error);
    updateInProgress = false;
    return {
      success: false,
      message: error.message || 'Error al actualizar desde GitHub',
    };
  }
}
