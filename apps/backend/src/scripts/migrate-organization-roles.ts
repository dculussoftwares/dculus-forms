import 'dotenv/config';
import { prisma } from '../lib/prisma.js';

/**
 * Migration script to update organization member roles from 'member'/'owner' to 'companyMember'/'companyOwner'
 */
async function migrateOrganizationRoles() {
  console.log('🔄 Starting organization roles migration...');

  try {
    // Update all 'member' roles to 'companyMember'
    const memberUpdate = await prisma.member.updateMany({
      where: { role: 'member' },
      data: { role: 'companyMember' },
    });

    console.log(`✅ Updated ${memberUpdate.count} member roles from 'member' to 'companyMember'`);

    // Update all 'owner' roles to 'companyOwner'
    const ownerUpdate = await prisma.member.updateMany({
      where: { role: 'owner' },
      data: { role: 'companyOwner' },
    });

    console.log(`✅ Updated ${ownerUpdate.count} owner roles from 'owner' to 'companyOwner'`);

    // Update all invitation 'member' roles to 'companyMember'
    const invitationMemberUpdate = await prisma.invitation.updateMany({
      where: { role: 'member' },
      data: { role: 'companyMember' },
    });

    console.log(`✅ Updated ${invitationMemberUpdate.count} invitation roles from 'member' to 'companyMember'`);

    // Update all invitation 'owner' roles to 'companyOwner'
    const invitationOwnerUpdate = await prisma.invitation.updateMany({
      where: { role: 'owner' },
      data: { role: 'companyOwner' },
    });

    console.log(`✅ Updated ${invitationOwnerUpdate.count} invitation roles from 'owner' to 'companyOwner'`);

    // Verify the migration by counting records with old role names
    const remainingOldMemberRoles = await prisma.member.count({
      where: { 
        OR: [
          { role: 'member' },
          { role: 'owner' }
        ]
      }
    });

    const remainingOldInvitationRoles = await prisma.invitation.count({
      where: { 
        OR: [
          { role: 'member' },
          { role: 'owner' }
        ]
      }
    });

    if (remainingOldMemberRoles === 0 && remainingOldInvitationRoles === 0) {
      console.log('✅ Migration completed successfully! No old role names remain.');
    } else {
      console.warn(`⚠️ Migration incomplete: ${remainingOldMemberRoles} member records and ${remainingOldInvitationRoles} invitation records still have old role names.`);
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