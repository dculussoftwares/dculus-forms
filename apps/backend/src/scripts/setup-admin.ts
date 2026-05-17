import 'dotenv/config';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { auth } from '../lib/better-auth.js';
import { logger } from '../lib/logger.js';

async function hashWithBetterAuth(password: string): Promise<string> {
  const ctx: any = await (auth as any).$context;
  return ctx.password.hash(password);
}

async function setupSuperAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminName = process.env.ADMIN_NAME;

  if (!adminEmail || !adminPassword || !adminName) {
    logger.error('❌ Admin credentials not found in environment variables');
    logger.info('Please set ADMIN_EMAIL, ADMIN_PASSWORD, and ADMIN_NAME in your .env file');
    process.exit(1);
  }

  try {
    logger.info('🔧 Setting up super admin user...');

    // Check if admin user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: adminEmail },
    });

    if (existingUser) {
      logger.info('👤 Admin user already exists, updating role and password...');

      await prisma.user.update({
        where: { email: adminEmail },
        data: { role: 'superAdmin', emailVerified: true },
      });

      // Re-hash with better-auth's hasher so sign-in always works
      const hashedPassword = await hashWithBetterAuth(adminPassword);
      const existingAccount = await prisma.account.findFirst({
        where: { userId: existingUser.id, providerId: 'credential' },
        select: { id: true },
      });
      if (existingAccount) {
        await prisma.account.update({
          where: { id: existingAccount.id },
          data: { password: hashedPassword },
        });
      } else {
        await prisma.account.create({
          data: {
            id: crypto.randomUUID(),
            accountId: existingUser.id,
            providerId: 'credential',
            userId: existingUser.id,
            password: hashedPassword,
          },
        });
      }

      logger.info(`✅ User ${adminEmail} updated to superAdmin role`);
    } else {
      logger.info('👤 Creating new super admin user...');
      
      // Create new admin user directly in database using better-auth's approach
      try {
        const result = await auth.api.signUpEmail({
          body: {
            name: adminName,
            email: adminEmail,
            password: adminPassword,
          },
        });

        logger.info('Auth result:', result);

        if ((result as any).data?.user || result.user) {
          // Update the user role to superAdmin
          await prisma.user.update({
            where: { email: adminEmail },
            data: { role: 'superAdmin' },
          });
          
          logger.info(`✅ Super admin user created successfully!`);
          logger.info(`   Email: ${adminEmail}`);
          logger.info(`   Name: ${adminName}`);
          logger.info(`   Role: superAdmin`);
        } else {
          // If better-auth signup fails, try creating directly in database
          logger.info('Attempting direct database creation...');

          const hashedPassword = await hashWithBetterAuth(adminPassword);

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
          
          logger.info(`✅ Super admin user created successfully (direct method)!`);
          logger.info(`   Email: ${adminEmail}`);
          logger.info(`   Name: ${adminName}`);
          logger.info(`   Role: superAdmin`);
        }
      } catch (createError) {
        logger.error('❌ Error during user creation:', createError);
        process.exit(1);
      }
    }

    logger.info('\n🎉 Super admin setup completed!');
    logger.info('You can now sign in to the admin dashboard with:');
    logger.info(`   Email: ${adminEmail}`);
    logger.info(`   Password: ${adminPassword}`);
    logger.info(`   Admin Dashboard: http://localhost:3002`);

  } catch (error) {
    logger.error('❌ Error setting up super admin:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the setup
setupSuperAdmin();