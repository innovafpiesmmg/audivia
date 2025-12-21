import { Octokit } from '@octokit/rest';
import * as fs from 'fs';
import * as path from 'path';

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

const REPO_OWNER = 'audivia';
const REPO_NAME = 'audivia';

const IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  '.replit',
  '.config',
  '.cache',
  'dist',
  '.upm',
  'replit.nix',
  '.breakpoints',
  'package-lock.json',
  'attached_assets',
  'uploads',
  '.env',
  '*.log',
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
      } else {
        throw error;
      }
    }
    
    const projectDir = process.cwd();
    const files = getAllFiles(projectDir);
    
    console.log(`[GitHub] Found ${files.length} files to sync`);
    
    let mainSha: string | undefined;
    try {
      const { data: ref } = await octokit.git.getRef({
        owner: user.login,
        repo: REPO_NAME,
        ref: 'heads/main',
      });
      mainSha = ref.object.sha;
    } catch (error: any) {
      if (error.status === 404) {
        try {
          const { data: ref } = await octokit.git.getRef({
            owner: user.login,
            repo: REPO_NAME,
            ref: 'heads/master',
          });
          mainSha = ref.object.sha;
        } catch (e) {
          console.log('[GitHub] No existing branch found, will create new');
        }
      }
    }
    
    const treeItems: { path: string; mode: '100644'; type: 'blob'; sha: string }[] = [];
    
    console.log(`[GitHub] Creating blobs for ${files.length} files...`);
    
    let blobCount = 0;
    for (const file of files) {
      const fullPath = path.join(projectDir, file);
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const { data: blob } = await octokit.git.createBlob({
          owner: user.login,
          repo: REPO_NAME,
          content: Buffer.from(content).toString('base64'),
          encoding: 'base64',
        });
        treeItems.push({
          path: file.replace(/\\/g, '/'),
          mode: '100644',
          type: 'blob',
          sha: blob.sha,
        });
        blobCount++;
        if (blobCount % 50 === 0) {
          console.log(`[GitHub] Created ${blobCount}/${files.length} blobs...`);
        }
      } catch (error) {
        console.log(`[GitHub] Skipping binary/unreadable file: ${file}`);
      }
    }
    
    console.log(`[GitHub] Creating tree with ${treeItems.length} files...`);
    
    const { data: tree } = await octokit.git.createTree({
      owner: user.login,
      repo: REPO_NAME,
      tree: treeItems,
    });
    
    const commitMessage = `Sync from Replit - ${new Date().toISOString()}`;
    const { data: commit } = await octokit.git.createCommit({
      owner: user.login,
      repo: REPO_NAME,
      message: commitMessage,
      tree: tree.sha,
      parents: mainSha ? [mainSha] : [],
    });
    
    try {
      await octokit.git.updateRef({
        owner: user.login,
        repo: REPO_NAME,
        ref: 'heads/main',
        sha: commit.sha,
        force: true,
      });
    } catch (error) {
      await octokit.git.createRef({
        owner: user.login,
        repo: REPO_NAME,
        ref: 'refs/heads/main',
        sha: commit.sha,
      });
    }
    
    console.log(`[GitHub] Sync complete! Commit: ${commit.sha}`);
    
    return {
      success: true,
      message: `Repositorio actualizado exitosamente. ${treeItems.length} archivos sincronizados.`,
      filesUpdated: treeItems.length,
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
