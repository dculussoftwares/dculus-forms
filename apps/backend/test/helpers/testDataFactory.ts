import { faker } from '@faker-js/faker';
import { Form, Response, FormPermission, User, Organization, Member } from '@prisma/client';

export class TestDataFactory {
  // Generate realistic form data
  static createForm(overrides?: Partial<Form>): Form {
    return {
      id: faker.string.uuid(),
      title: faker.lorem.words(3),
      description: faker.lorem.sentence(),
      organizationId: faker.string.uuid(),
      createdById: faker.string.uuid(),
      isPublished: false,
      shortUrl: faker.string.alphanumeric(8),
      schema: JSON.stringify({
        pages: [],
        layout: { theme: 'light', textColor: '#000000', spacing: 'normal', code: '', content: '', customBackGroundColor: '#ffffff', backgroundImageKey: '' },
        isShuffleEnabled: false,
      }),
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      ...overrides,
    } as Form;
  }

  // Generate form response
  static createResponse(overrides?: Partial<Response>): Response {
    return {
      id: faker.string.uuid(),
      formId: faker.string.uuid(),
      data: JSON.stringify({ field1: 'value1' }),
      submittedAt: faker.date.recent(),
      metadata: null,
      editedAt: null,
      ...overrides,
    } as Response;
  }

  // Generate form permission
  static createPermission(
    overrides?: Partial<FormPermission>
  ): FormPermission {
    return {
      id: faker.string.uuid(),
      formId: faker.string.uuid(),
      userId: faker.string.uuid(),
      accessLevel: 'VIEWER',
      createdAt: faker.date.past(),
      ...overrides,
    } as FormPermission;
  }

  // Generate user
  static createUser(overrides?: Partial<User>): User {
    return {
      id: faker.string.uuid(),
      email: faker.internet.email(),
      name: faker.person.fullName(),
      role: 'user',
      emailVerified: true,
      image: null,
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      banned: false,
      banReason: null,
      banExpires: null,
      ...overrides,
    } as User;
  }

  // Generate organization
  static createOrganization(overrides?: Partial<Organization>): Organization {
    return {
      id: faker.string.uuid(),
      name: faker.company.name(),
      slug: faker.helpers.slugify(faker.company.name()).toLowerCase(),
      logo: null,
      createdAt: faker.date.past(),
      metadata: null,
      ...overrides,
    } as Organization;
  }

  // Generate member
  static createMember(overrides?: Partial<Member>): Member {
    return {
      id: faker.string.uuid(),
      organizationId: faker.string.uuid(),
      userId: faker.string.uuid(),
      role: 'member',
      createdAt: faker.date.past(),
      ...overrides,
    } as Member;
  }

  // Generate multiple items
  static createForms(count: number, overrides?: Partial<Form>): Form[] {
    return Array.from({ length: count }, () => this.createForm(overrides));
  }

  static createResponses(
    count: number,
    overrides?: Partial<Response>
  ): Response[] {
    return Array.from({ length: count }, () => this.createResponse(overrides));
  }

  static createUsers(count: number, overrides?: Partial<User>): User[] {
    return Array.from({ length: count }, () => this.createUser(overrides));
  }

  static createOrganizations(count: number, overrides?: Partial<Organization>): Organization[] {
    return Array.from({ length: count }, () => this.createOrganization(overrides));
  }
}
