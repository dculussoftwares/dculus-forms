#!/usr/bin/env node

/**
 * Deployment Manifest Generator
 *
 * Generates a deployment-manifest.json file containing metadata about the release
 * including artifact checksums, Docker image information, and deployment URLs.
 *
 * Usage:
 *   node generate-manifest.js --version=1.2.3 --tag=v1.2.3 --digest=sha256:abc123 --output=manifest.json
 */

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

/**
 * Calculate SHA256 checksum of a file
 */
function calculateChecksum(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    const [key, value] = arg.replace(/^--/, '').split('=');
    args[key] = value;
  });
  return args;
}

/**
 * Generate deployment manifest
 */
function generateManifest(options) {
  const {
    version,
    tag,
    commitSha,
    digest,
    dockerTags,
    artifactsDir,
    outputPath
  } = options;

  // Define artifact files
  const artifacts = {
    formApp: {
      filename: `form-app-${tag}.zip`,
      cloudflareProject: 'dculus-forms-app',
      url: 'https://dculus-forms-app.pages.dev'
    },
    formViewer: {
      filename: `form-viewer-${tag}.zip`,
      cloudflareProject: 'dculus-forms-viewer-app',
      url: 'https://dculus-forms-viewer-app.pages.dev'
    },
    adminApp: {
      filename: `admin-app-${tag}.zip`,
      cloudflareProject: 'dculus-forms-admin-app',
      url: 'https://dculus-forms-admin-app.pages.dev'
    }
  };

  // Calculate checksums for each artifact
  const manifestArtifacts = {};
  for (const [key, artifact] of Object.entries(artifacts)) {
    const filePath = path.join(artifactsDir, artifact.filename);

    if (!fs.existsSync(filePath)) {
      console.error(`Error: Artifact not found: ${filePath}`);
      process.exit(1);
    }

    const checksum = calculateChecksum(filePath);
    const stats = fs.statSync(filePath);

    manifestArtifacts[key] = {
      filename: artifact.filename,
      checksum: `sha256:${checksum}`,
      size: stats.size,
      sizeHuman: formatBytes(stats.size),
      cloudflareProject: artifact.cloudflareProject,
      deploymentUrl: artifact.url
    };
  }

  // Create manifest object
  const manifest = {
    version,
    releaseTag: tag,
    createdAt: new Date().toISOString(),
    commitSha,
    artifacts: manifestArtifacts,
    docker: {
      registry: 'docker.io',
      image: 'dculus/forms-backend',
      digest,
      tags: dockerTags ? dockerTags.split(',') : [version],
      pullCommand: `docker pull docker.io/dculus/forms-backend:${version}`
    },
    deployments: {
      production: {
        formApp: 'https://dculus-forms-app.pages.dev',
        formViewer: 'https://dculus-forms-viewer-app.pages.dev',
        adminApp: 'https://dculus-forms-admin-app.pages.dev',
        backend: 'https://dculus-forms-backend.reddune-e5ba9473.eastus.azurecontainerapps.io',
        graphql: 'https://dculus-forms-backend.reddune-e5ba9473.eastus.azurecontainerapps.io/graphql'
      }
    },
    metadata: {
      generator: 'generate-manifest.js',
      generatorVersion: '1.0.0',
      schema: '1.0'
    }
  };

  // Write manifest to file
  fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2));
  console.log(`✅ Deployment manifest generated: ${outputPath}`);
  console.log(`📦 Artifacts: ${Object.keys(manifestArtifacts).length}`);
  console.log(`🐳 Docker image: ${manifest.docker.image}:${version}`);

  return manifest;
}

/**
 * Format bytes to human readable size
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Validate manifest structure
 */
function validateManifest(manifest) {
  const requiredFields = ['version', 'releaseTag', 'createdAt', 'commitSha', 'artifacts', 'docker', 'deployments'];

  for (const field of requiredFields) {
    if (!manifest[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  // Validate artifacts
  const requiredArtifacts = ['formApp', 'formViewer', 'adminApp'];
  for (const artifact of requiredArtifacts) {
    if (!manifest.artifacts[artifact]) {
      throw new Error(`Missing required artifact: ${artifact}`);
    }

    const art = manifest.artifacts[artifact];
    if (!art.filename || !art.checksum || !art.cloudflareProject) {
      throw new Error(`Incomplete artifact data for: ${artifact}`);
    }
  }

  console.log('✅ Manifest validation passed');
  return true;
}

/**
 * Main execution
 */
function main() {
  const args = parseArgs();

  // Validate required arguments
  const required = ['version', 'tag', 'artifactsDir', 'output'];
  for (const arg of required) {
    if (!args[arg]) {
      console.error(`Error: Missing required argument: --${arg}`);
      console.error('Usage: node generate-manifest.js --version=1.2.3 --tag=v1.2.3 --commitSha=abc123 --digest=sha256:def456 --dockerTags=1.2.3,1.2,1 --artifactsDir=./artifacts --output=manifest.json');
      process.exit(1);
    }
  }

  try {
    // Generate manifest
    const manifest = generateManifest({
      version: args.version,
      tag: args.tag,
      commitSha: args.commitSha || process.env.GITHUB_SHA || 'unknown',
      digest: args.digest || '',
      dockerTags: args.dockerTags || args.version,
      artifactsDir: args.artifactsDir,
      outputPath: args.output
    });

    // Validate manifest
    validateManifest(manifest);

    console.log('\n📋 Manifest Summary:');
    console.log(JSON.stringify(manifest, null, 2));

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = {
  generateManifest,
  validateManifest,
  calculateChecksum,
  formatBytes
};
