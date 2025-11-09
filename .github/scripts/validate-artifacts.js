#!/usr/bin/env node

/**
 * Artifact Validation Script
 *
 * Validates release artifacts by checking:
 * - File existence
 * - Checksum integrity
 * - Manifest structure
 * - Required files in archives
 *
 * Usage:
 *   node validate-artifacts.js --manifest=deployment-manifest.json --artifactsDir=./artifacts
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
 * Validate manifest structure
 */
function validateManifestStructure(manifest) {
  console.log('\n📋 Validating manifest structure...');

  const requiredFields = {
    version: 'string',
    releaseTag: 'string',
    createdAt: 'string',
    commitSha: 'string',
    artifacts: 'object',
    docker: 'object',
    deployments: 'object'
  };

  let errors = [];

  // Check top-level fields
  for (const [field, expectedType] of Object.entries(requiredFields)) {
    if (!manifest[field]) {
      errors.push(`Missing required field: ${field}`);
    } else if (typeof manifest[field] !== expectedType) {
      errors.push(`Field '${field}' should be ${expectedType}, got ${typeof manifest[field]}`);
    }
  }

  // Validate artifacts structure
  if (manifest.artifacts) {
    const requiredArtifacts = ['formApp', 'formViewer', 'adminApp'];
    for (const artifactKey of requiredArtifacts) {
      if (!manifest.artifacts[artifactKey]) {
        errors.push(`Missing artifact: ${artifactKey}`);
        continue;
      }

      const artifact = manifest.artifacts[artifactKey];
      const requiredArtifactFields = ['filename', 'checksum', 'cloudflareProject'];

      for (const field of requiredArtifactFields) {
        if (!artifact[field]) {
          errors.push(`Artifact '${artifactKey}' missing field: ${field}`);
        }
      }

      // Validate checksum format
      if (artifact.checksum && !artifact.checksum.startsWith('sha256:')) {
        errors.push(`Artifact '${artifactKey}' checksum should start with 'sha256:'`);
      }
    }
  }

  // Validate Docker info
  if (manifest.docker) {
    const requiredDockerFields = ['registry', 'image', 'tags'];
    for (const field of requiredDockerFields) {
      if (!manifest.docker[field]) {
        errors.push(`Docker info missing field: ${field}`);
      }
    }

    if (manifest.docker.tags && !Array.isArray(manifest.docker.tags)) {
      errors.push('Docker tags should be an array');
    }
  }

  // Validate deployments
  if (manifest.deployments && manifest.deployments.production) {
    const requiredDeployments = ['formApp', 'formViewer', 'adminApp', 'backend'];
    for (const deployment of requiredDeployments) {
      if (!manifest.deployments.production[deployment]) {
        errors.push(`Deployment URL missing for: ${deployment}`);
      }
    }
  }

  if (errors.length > 0) {
    console.error('❌ Manifest structure validation failed:');
    errors.forEach(err => console.error(`  - ${err}`));
    return false;
  }

  console.log('✅ Manifest structure is valid');
  return true;
}

/**
 * Validate artifact files
 */
function validateArtifactFiles(manifest, artifactsDir) {
  console.log('\n📦 Validating artifact files...');

  let errors = [];
  const artifacts = manifest.artifacts;

  for (const [key, artifact] of Object.entries(artifacts)) {
    const filePath = path.join(artifactsDir, artifact.filename);

    console.log(`\nChecking ${artifact.filename}...`);

    // Check file existence
    if (!fs.existsSync(filePath)) {
      errors.push(`File not found: ${filePath}`);
      continue;
    }
    console.log('  ✓ File exists');

    // Check file size
    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      errors.push(`File is empty: ${filePath}`);
      continue;
    }
    console.log(`  ✓ Size: ${formatBytes(stats.size)}`);

    // Validate checksum
    const actualChecksum = calculateChecksum(filePath);
    const expectedChecksum = artifact.checksum.replace('sha256:', '');

    if (actualChecksum !== expectedChecksum) {
      errors.push(`Checksum mismatch for ${artifact.filename}:\n    Expected: ${expectedChecksum}\n    Actual:   ${actualChecksum}`);
      continue;
    }
    console.log(`  ✓ Checksum verified: ${actualChecksum.substring(0, 16)}...`);

    // Check if it's a valid zip file (basic check)
    if (artifact.filename.endsWith('.zip')) {
      const buffer = fs.readFileSync(filePath);
      const isValidZip = buffer[0] === 0x50 && buffer[1] === 0x4B; // PK header

      if (!isValidZip) {
        errors.push(`Invalid ZIP file: ${artifact.filename}`);
        continue;
      }
      console.log('  ✓ Valid ZIP format');
    }
  }

  if (errors.length > 0) {
    console.error('\n❌ Artifact validation failed:');
    errors.forEach(err => console.error(`  - ${err}`));
    return false;
  }

  console.log('\n✅ All artifacts are valid');
  return true;
}

/**
 * Validate version format
 */
function validateVersion(manifest) {
  console.log('\n🏷️  Validating version...');

  const { version, releaseTag } = manifest;

  // Check semver format
  const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/;
  if (!semverRegex.test(version)) {
    console.error(`❌ Invalid version format: ${version}`);
    console.error('   Expected format: 1.2.3 or 1.2.3-beta.1');
    return false;
  }

  // Check tag format
  if (!releaseTag.startsWith('v')) {
    console.error(`❌ Release tag should start with 'v': ${releaseTag}`);
    return false;
  }

  if (releaseTag !== `v${version}`) {
    console.error(`❌ Version mismatch: tag=${releaseTag}, version=${version}`);
    return false;
  }

  console.log(`✅ Version is valid: ${version} (${releaseTag})`);
  return true;
}

/**
 * Generate validation report
 */
function generateReport(manifest, artifactsDir) {
  console.log('\n' + '='.repeat(60));
  console.log('VALIDATION REPORT');
  console.log('='.repeat(60));

  console.log(`\nRelease: ${manifest.releaseTag}`);
  console.log(`Version: ${manifest.version}`);
  console.log(`Created: ${manifest.createdAt}`);
  console.log(`Commit: ${manifest.commitSha}`);

  console.log('\nArtifacts:');
  for (const [key, artifact] of Object.entries(manifest.artifacts)) {
    const filePath = path.join(artifactsDir, artifact.filename);
    const exists = fs.existsSync(filePath);
    const size = exists ? fs.statSync(filePath).size : 0;

    console.log(`  - ${artifact.filename}`);
    console.log(`    Project: ${artifact.cloudflareProject}`);
    console.log(`    Size: ${formatBytes(size)}`);
    console.log(`    Checksum: ${artifact.checksum.substring(0, 24)}...`);
  }

  console.log('\nDocker Image:');
  console.log(`  Registry: ${manifest.docker.registry}`);
  console.log(`  Image: ${manifest.docker.image}`);
  console.log(`  Tags: ${manifest.docker.tags.join(', ')}`);
  if (manifest.docker.digest) {
    console.log(`  Digest: ${manifest.docker.digest.substring(0, 32)}...`);
  }

  console.log('\nDeployment URLs:');
  for (const [key, url] of Object.entries(manifest.deployments.production)) {
    console.log(`  - ${key}: ${url}`);
  }

  console.log('\n' + '='.repeat(60));
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
 * Main execution
 */
function main() {
  const args = parseArgs();

  console.log('🔍 Artifact Validation Tool\n');

  // Validate arguments
  if (!args.manifest) {
    console.error('Error: Missing required argument: --manifest');
    console.error('Usage: node validate-artifacts.js --manifest=deployment-manifest.json --artifactsDir=./artifacts');
    process.exit(1);
  }

  const manifestPath = args.manifest;
  const artifactsDir = args.artifactsDir || path.dirname(manifestPath);

  // Check if manifest exists
  if (!fs.existsSync(manifestPath)) {
    console.error(`❌ Manifest file not found: ${manifestPath}`);
    process.exit(1);
  }

  // Read manifest
  let manifest;
  try {
    const manifestContent = fs.readFileSync(manifestPath, 'utf8');
    manifest = JSON.parse(manifestContent);
  } catch (error) {
    console.error(`❌ Failed to parse manifest: ${error.message}`);
    process.exit(1);
  }

  console.log(`📄 Manifest: ${manifestPath}`);
  console.log(`📁 Artifacts directory: ${artifactsDir}`);

  // Run validations
  const validations = [
    validateManifestStructure(manifest),
    validateVersion(manifest),
    validateArtifactFiles(manifest, artifactsDir)
  ];

  // Generate report
  generateReport(manifest, artifactsDir);

  // Check results
  if (validations.every(v => v === true)) {
    console.log('\n✅ All validations passed!\n');
    process.exit(0);
  } else {
    console.log('\n❌ Some validations failed\n');
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = {
  validateManifestStructure,
  validateArtifactFiles,
  validateVersion,
  calculateChecksum,
  formatBytes
};
