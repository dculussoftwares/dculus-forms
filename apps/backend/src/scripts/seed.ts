import 'dotenv/config';
import { prisma } from '../lib/prisma';
const { seedTemplates } = require('./seed-templates');
import { uploadFile } from '../services/fileUploadService';
import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';

async function uploadStaticFiles() {
  console.log('📁 Uploading static files...');
  
  const staticFilesPath = path.join(process.cwd(), '..', '..', 'static-files');
  
  if (!fs.existsSync(staticFilesPath)) {
    console.log('⚠️  Static files folder not found, skipping upload');
    return [];
  }
  
  const files = fs.readdirSync(staticFilesPath);
  const uploadedFiles = [];
  
  for (const fileName of files) {
    const filePath = path.join(staticFilesPath, fileName);
    const fileStats = fs.statSync(filePath);
    
    if (fileStats.isFile()) {
      try {
        // Get file extension and determine mimetype
        const ext = path.extname(fileName).toLowerCase();
        const mimeTypes: Record<string, string> = {
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.gif': 'image/gif',
          '.webp': 'image/webp'
        };
        
        const mimetype = mimeTypes[ext] || 'application/octet-stream';
        
        // Create a readable stream from the file
        const fileBuffer = fs.readFileSync(filePath);
        const readableStream = new Readable({
          read() {
            this.push(fileBuffer);
            this.push(null);
          }
        });
        
        // Create file object for upload
        const fileObject = {
          filename: fileName,
          mimetype: mimetype,
          encoding: '7bit',
          createReadStream: () => readableStream
        };
        
        // Determine file type based on filename
        let fileType = 'FormTemplate'; // default
        if (fileName.includes('logo')) {
          fileType = 'OrganizationLogo';
        } else if (fileName.includes('background')) {
          fileType = 'FormBackground';
        }
        
        const result = await uploadFile({
          file: fileObject,
          type: fileType
        });
        
        uploadedFiles.push(result);
        console.log(`✅ Uploaded ${fileName} -> ${result.key}`);
        
      } catch (error) {
        console.error(`❌ Failed to upload ${fileName}:`, error);
      }
    }
  }
  
  console.log(`📁 Uploaded ${uploadedFiles.length} static files`);
  return uploadedFiles;
}

async function seed() {
  console.log('🌱 Starting database seed...');

  try {
    // Clear existing data
    console.log('🧹 Clearing existing data...');
    await prisma.response.deleteMany();
    await prisma.form.deleteMany();
    await prisma.formTemplate.deleteMany();
    await prisma.member.deleteMany();
    await prisma.invitation.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.session.deleteMany();
    await prisma.account.deleteMany();
    await prisma.user.deleteMany();

    console.log('✅ Database cleared successfully');
    
    // Upload static files
    const uploadedFiles = await uploadStaticFiles();
    
    // Seed templates with uploaded files
    await seedTemplates(uploadedFiles);
    
    console.log('🌱 Seed completed. Use Better Auth endpoints to create users and organizations.');
    console.log(`📁 ${uploadedFiles.length} static files uploaded to CDN`);

  } catch (error) {
    console.error('❌ Error during seed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seed()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  });
