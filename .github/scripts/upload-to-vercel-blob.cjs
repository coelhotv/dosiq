/**
 * Script para upload de arquivos para Vercel Blob
 * Usado por GitHub Actions para armazenar outputs temporários
 * 
 * Uso: node upload-to-vercel-blob.cjs <arquivo-local> [nome-remoto]
 * 
 * @module upload-to-vercel-blob
 */

const { put } = require('@vercel/blob');
const fs = require('fs');
const path = require('path');

/**
 * Faz upload de um arquivo local para o Vercel Blob
 * 
 * @param {string} localPath - Caminho do arquivo local
 * @param {Object} options - Opções de upload
 * @param {string} [options.remoteName] - Nome do arquivo no blob (default: basename do local)
 * @param {boolean} [options.private=true] - Se o arquivo deve ser privado
 * @param {number} [options.ttl] - TTL em segundos para URLs públicas (default: 7 dias)
 * @returns {Promise<Object>} Resultado do upload com url, pathname, etc.
 * @throws {Error} Se o arquivo não existir ou upload falhar
 */
async function uploadToVercelBlob(localPath, options = {}) {
  const {
    remoteName = path.basename(localPath),
    private: isPrivate = true,
    ttl = 7 * 24 * 60 * 60 // 7 dias
  } = options;

  // Verificar se arquivo existe
  if (!fs.existsSync(localPath)) {
    throw new Error(`Arquivo não encontrado: ${localPath}`);
  }

  // Verificar token
  const token = process.env.VERCEL_BLOB_TOKEN;
  if (!token) {
    throw new Error('VERCEL_BLOB_TOKEN não configurado');
  }

  console.log(`📤 Fazendo upload de ${localPath}...`);
  console.log(`   Nome remoto: ${remoteName}`);
  console.log(`   Modo: ${isPrivate ? 'privado' : 'público'}`);

  try {
    // Ler arquivo
    const fileBuffer = fs.readFileSync(localPath);
    
    // Determinar content type
    const contentType = determineContentType(localPath);
    
    // Fazer upload
    const blob = await put(remoteName, fileBuffer, {
      access: isPrivate ? 'private' : 'public',
      token,
      contentType,
      // Adicionar metadata para rastreamento
      addRandomSuffix: false,
    });

    console.log(`✅ Upload concluído:`);
    console.log(`   URL: ${blob.url}`);
    console.log(`   Pathname: ${blob.pathname}`);
    console.log(`   Content-Type: ${contentType}`);

    return {
      url: blob.url,
      pathname: blob.pathname,
      contentType,
      size: fileBuffer.length,
      downloadUrl: blob.downloadUrl || blob.url
    };

  } catch (error) {
    console.error(`❌ Erro no upload: ${error.message}`);
    throw error;
  }
}

/**
 * Determina o content type baseado na extensão do arquivo
 * 
 * @param {string} filePath - Caminho do arquivo
 * @returns {string} Content type
 */
function determineContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  
  const contentTypes = {
    '.json': 'application/json',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.cjs': 'application/javascript',
    '.mjs': 'application/javascript',
    '.xml': 'application/xml',
    '.csv': 'text/csv',
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.zip': 'application/zip',
    '.tar': 'application/x-tar',
    '.gz': 'application/gzip'
  };

  return contentTypes[ext] || 'application/octet-stream';
}

/**
 * CLI interface para uso direto
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.error('Uso: node upload-to-vercel-blob.cjs <arquivo-local> [nome-remoto]');
    console.error('');
    console.error('Variáveis de ambiente necessárias:');
    console.error('  VERCEL_BLOB_TOKEN - Token de autenticação do Vercel Blob');
    process.exit(1);
  }

  const localPath = args[0];
  const remoteName = args[1] || path.basename(localPath);

  try {
    const result = await uploadToVercelBlob(localPath, { remoteName });
    
    // Output em formato que pode ser capturado pelo GitHub Actions
    console.log('');
    console.log('::set-output name=blob_url::' + result.url);
    console.log('::set-output name=blob_pathname::' + result.pathname);
    console.log('::set-output name=blob_size::' + result.size);
    
    // Também output em JSON para parsing fácil
    console.log('');
    console.log('JSON_OUTPUT:');
    console.log(JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error(`Falha: ${error.message}`);
    process.exit(1);
  }
}

// Exportar para uso como módulo
module.exports = {
  uploadToVercelBlob,
  determineContentType
};

// Executar se chamado diretamente
if (require.main === module) {
  main();
}
