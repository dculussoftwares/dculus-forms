import 'dotenv/config';
import { prisma } from '../lib/prisma.js';

/**
 * Migration script to update organization member roles from custom roles ('companyMember'/'companyOwner') to standard better-auth roles ('member'/'owner')
 */
async function migrateOrganizationRoles() {
  console.log('🚀 Starting organization role migration to standard better-auth roles...');

  try {
    // Update all 'companyMember' roles to 'member'
    const memberUpdate = await prisma.member.updateMany({
      where: { role: 'companyMember' },
      data: { role: 'member' },
    });

    console.log(`✅ Updated ${memberUpdate.count} member roles from 'companyMember' to 'member'`);

    // Update all 'companyOwner' roles to 'owner'
    const ownerUpdate = await prisma.member.updateMany({
      where: { role: 'companyOwner' },
      data: { role: 'owner' },
    });

    console.log(`✅ Updated ${ownerUpdate.count} owner roles from 'companyOwner' to 'owner'`);

    // Update all invitation 'companyMember' roles to 'member'
    const invitationMemberUpdate = await prisma.invitation.updateMany({
      where: { role: 'companyMember' },
      data: { role: 'member' },
    });

    console.log(`✅ Updated ${invitationMemberUpdate.count} invitation roles from 'companyMember' to 'member'`);

    // Update all invitation 'companyOwner' roles to 'owner'
    const invitationOwnerUpdate = await prisma.invitation.updateMany({
      where: { role: 'companyOwner' },
      data: { role: 'owner' },
    });

    console.log(`✅ Updated ${invitationOwnerUpdate.count} invitation roles from 'companyOwner' to 'owner'`);

    // Verify the migration by counting records with old custom role names
    const remainingCustomMemberRoles = await prisma.member.count({
      where: {
        OR: [
          { role: 'companyMember' },
          { role: 'companyOwner' }
        ]
      }
    });

    const remainingCustomInvitationRoles = await prisma.invitation.count({
      where: {
        OR: [
          { role: 'companyMember' },
          { role: 'companyOwner' }
        ]
      }
    });

    if (remainingCustomMemberRoles === 0 && remainingCustomInvitationRoles === 0) {
      console.log('✅ Migration completed successfully! All roles are now using standard better-auth names.');
    } else {
      console.warn(`⚠️ Migration incomplete: ${remainingCustomMemberRoles} member records and ${remainingCustomInvitationRoles} invitation records still have custom role names.`);
    }

    // Show current role distribution
    const currentRoleStats = await prisma.member.groupBy({
      by: ['role'],
      _count: {
        role: true
      }
    });

    console.log('\n📊 Current organization role distribution:');
    currentRoleStats.forEach(stat => {
      console.log(`  ${stat.role}: ${stat._count.role} members`);
    });

  } catch (error) {
    console.error('❌ Error during migration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateOrganizationRoles().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});