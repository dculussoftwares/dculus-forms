import { PrismaClient } from '@prisma/client';
import { TestDataFactory } from './testDataFactory';

export class DatabaseSeeder {
  constructor(private prisma: PrismaClient) {}

  // Seed a complete test scenario
  async seedBasicFormScenario() {
    const user = await this.prisma.user.create({
      data: {
        email: 'testuser@example.com',
        name: 'Test User',
        role: 'user',
        emailVerified: true,
      },
    });

    const org = await this.prisma.organization.create({
      data: {
        name: 'Test Organization',
        slug: 'test-org',
      },
    });

    const member = await this.prisma.member.create({
      data: {
        userId: user.id,
        organizationId: org.id,
        role: 'owner',
      },
    });

    const form = await this.prisma.form.create({
      data: {
        ...TestDataFactory.createForm({
          organizationId: org.id,
          createdById: user.id,
        }),
      },
    });

    return { user, org, member, form };
  }

  // Seed form with responses
  async seedFormWithResponses(formId: string, responseCount: number) {
    const responses = TestDataFactory.createResponses(responseCount, {
      formId,
    });

    return await this.prisma.response.createMany({
      data: responses,
    });
  }

  // Seed user with organization
  async seedUserWithOrganization(userOverrides?: any, orgOverrides?: any) {
    const user = await this.prisma.user.create({
      data: TestDataFactory.createUser(userOverrides),
    });

    const org = await this.prisma.organization.create({
      data: TestDataFactory.createOrganization(orgOverrides),
    });

    const member = await this.prisma.member.create({
      data: {
        userId: user.id,
        organizationId: org.id,
        role: 'owner',
      },
    });

    return { user, org, member };
  }
}
