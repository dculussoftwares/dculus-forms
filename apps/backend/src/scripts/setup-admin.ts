import 'dotenv/config';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { auth } from '../lib/better-auth.js';

async function setupSuperAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminName = process.env.ADMIN_NAME;

  if (!adminEmail || !adminPassword || !adminName) {
    console.error('❌ Admin credentials not found in environment variables');
    console.log('Please set ADMIN_EMAIL, ADMIN_PASSWORD, and ADMIN_NAME in your .env file');
    process.exit(1);
  }

  try {
    console.log('🔧 Setting up super admin user...');

    // Check if admin user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: adminEmail },
    });

    if (existingUser) {
      console.log('👤 Admin user already exists, updating role to superAdmin...');
      
      // Update existing user to superAdmin role
      await prisma.user.update({
        where: { email: adminEmail },
        data: { role: 'superAdmin' },
      });
      
      console.log(`✅ User ${adminEmail} updated to superAdmin role`);
    } else {
      console.log('👤 Creating new super admin user...');
      
      // Create new admin user directly in database using better-auth's approach
      try {
        const result = await auth.api.signUpEmail({
          body: {
            name: adminName,
            email: adminEmail,
            password: adminPassword,
          },
        });

        console.log('Auth result:', result);

        if (result.data?.user) {
          // Update the user role to superAdmin
          await prisma.user.update({
            where: { email: adminEmail },
            data: { role: 'superAdmin' },
          });
          
          console.log(`✅ Super admin user created successfully!`);
          console.log(`   Email: ${adminEmail}`);
          console.log(`   Name: ${adminName}`);
          console.log(`   Role: superAdmin`);
        } else {
          // If better-auth signup fails, try creating directly in database
          console.log('Attempting direct database creation...');
          
          const bcrypt = await import('bcryptjs');
          const hashedPassword = await bcrypt.hash(adminPassword, 12);
          
          const user = await prisma.user.create({
            data: {
              id: crypto.randomUUID(),
              name: adminName,
              email: adminEmail,
              role: 'superAdmin',
              emailVerified: true,
            },
          });
          
          // Create account record for password
          await prisma.account.create({
            data: {
              id: crypto.randomUUID(),
              accountId: adminEmail,
              providerId: 'credential',
              userId: user.id,
              password: hashedPassword,
            },
          });
          
          console.log(`✅ Super admin user created successfully (direct method)!`);
          console.log(`   Email: ${adminEmail}`);
          console.log(`   Name: ${adminName}`);
          console.log(`   Role: superAdmin`);
        }
      } catch (createError) {
        console.error('❌ Error during user creation:', createError);
        process.exit(1);
      }
    }

    console.log('\n🎉 Super admin setup completed!');
    console.log('You can now sign in to the admin dashboard with:');
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Password: ${adminPassword}`);
    console.log(`   Admin Dashboard: http://localhost:3002`);

  } catch (error) {
    console.error('❌ Error setting up super admin:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the setup
setupSuperAdmin();