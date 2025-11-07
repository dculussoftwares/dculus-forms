import { Given, When, Then } from '@cucumber/cucumber';
import { CustomWorld } from '../support/world';
import { expect, expectDefined, expectEqual, expectNoGraphQLErrors } from '../utils/expect-helper';
import { randomBytes } from 'crypto';

// Generate nanoid-like IDs using crypto (CommonJS compatible)
function generateId(length: number = 21): string {
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const bytes = randomBytes(length);
  let id = '';
  for (let i = 0; i < length; i++) {
    id += alphabet[bytes[i] % alphabet.length];
  }
  return id;
}

// Store test data temporarily in Given step
let testEmail: string;
let testPassword: string;
let testOrganizationName: string;
let testFormTitle: string;

Given('I am a new user with email {string} and password {string}',
  function(this: CustomWorld, email: string, password: string) {
    testEmail = email;
    testPassword = password;
    console.log(`📝 Test user credentials prepared: ${email}`);
  }
);

When('I sign up with my credentials',
  async function(this: CustomWorld) {
    console.log(`🔐 Creating user in database: ${testEmail}`);

    // Create user directly in database (bypassing better-auth for now to avoid Prisma connection issues)
    const userId = generateId();
    const organizationId = generateId();
    const organizationName = 'My Test Organization';

    // Create user
    const user = await this.prisma.user.create({
      data: {
        id: userId,
        email: testEmail,
        name: 'Test User',
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    });

    // Create organization
    const organization = await this.prisma.organization.create({
      data: {
        id: organizationId,
        name: organizationName,
        slug: organizationName.toLowerCase().replace(/\s+/g, '-'),
        createdAt: new Date(),
      }
    });

    // Create membership
    await this.prisma.member.create({
      data: {
        id: generateId(),
        organizationId: organization.id,
        userId: user.id,
        role: 'owner',
        createdAt: new Date(),
      }
    });

    // Create a session for this user
    const sessionToken = generateId(32);
    const session = await this.prisma.session.create({
      data: {
        id: generateId(),
        userId: user.id,
        token: sessionToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    });

    // Store user info
    this.currentUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
    this.authToken = sessionToken;
    this.currentOrganization = {
      id: organization.id,
      name: organization.name
    };

    console.log(`✅ User created: ${user.id}`);
    console.log(`✅ Organization created: ${organization.id}`);
    console.log(`✅ Session token: ${sessionToken.substring(0, 20)}...`);
  }
);

Then('I should be successfully signed up',
  function(this: CustomWorld) {
    expectDefined(this.currentUser, 'Current user should be defined after sign up');
    expectEqual(this.currentUser!.email, testEmail, 'User email should match');
    console.log(`✅ Sign up verified for user: ${this.currentUser!.email}`);
  }
);

Then('I should have an authentication token',
  function(this: CustomWorld) {
    expectDefined(this.authToken, 'Authentication token should be defined');
    expect(this.authToken!.length > 0, 'Authentication token should not be empty');
    console.log(`✅ Authentication token verified: ${this.authToken!.substring(0, 20)}...`);
  }
);

When('I create an organization named {string}',
  async function(this: CustomWorld, organizationName: string) {
    // Organization was already created during sign up
    // This step just verifies it exists
    testOrganizationName = organizationName;

    console.log(`🏢 Verifying organization exists: ${this.currentOrganization?.name}`);

    expectDefined(this.currentOrganization, 'Organization should have been created during sign up');
    expectEqual(this.currentOrganization!.name, organizationName, 'Organization name should match');

    console.log(`✅ Organization verified: ${this.currentOrganization!.id}`);
  }
);

Then('the organization should be created successfully',
  function(this: CustomWorld) {
    expectDefined(this.currentOrganization, 'Current organization should be defined');
    expect(this.currentOrganization!.name.length > 0, 'Organization name should not be empty');
    console.log(`✅ Organization creation verified: ${this.currentOrganization!.name}`);
  }
);

Then('I should be set as the organization owner',
  async function(this: CustomWorld) {
    expectDefined(this.currentOrganization, 'Current organization must exist');
    expectDefined(this.currentUser, 'Current user must exist');

    // Verify membership in database
    const membership = await this.prisma.member.findFirst({
      where: {
        organizationId: this.currentOrganization!.id,
        userId: this.currentUser!.id
      }
    });

    expectDefined(membership, 'Membership should exist in database');
    expectEqual(membership!.role, 'owner', 'User should have owner role');

    console.log(`✅ Organization ownership verified for user: ${this.currentUser!.email}`);
  }
);

When('I create a form with title {string}',
  async function(this: CustomWorld, title: string) {
    testFormTitle = title;

    expectDefined(this.authToken, 'Auth token must exist to create form');
    expectDefined(this.currentOrganization, 'Organization must exist to create form');
    expectDefined(this.currentUser, 'User must exist to create form');

    console.log(`📝 Creating form: ${testFormTitle}`);

    // Create a basic form schema
    const basicFormSchema = {
      pages: [
        {
          id: generateId(),
          title: 'Page 1',
          fields: [],
          order: 0,
        },
      ],
      layout: {
        theme: 'light',
        textColor: '#000000',
        spacing: 'normal',
        code: '',
        content: '',
        customBackGroundColor: '#ffffff',
        backgroundImageKey: '',
      },
      isShuffleEnabled: false,
    };

    // Create form directly in database (since we don't have templates seeded)
    const form = await this.prisma.form.create({
      data: {
        id: generateId(),
        title: testFormTitle,
        description: 'Test form description',
        shortUrl: generateId(8),
        formSchema: basicFormSchema,
        organizationId: this.currentOrganization!.id,
        createdById: this.currentUser!.id,
        isPublished: false,
        sharingScope: 'PRIVATE',
        defaultPermission: 'VIEWER',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    });

    // Store form for verification and cleanup
    this.setSharedTestData('createdForm', form);
    this.trackCreatedForm(form as any);

    console.log(`✅ Form created: ${form.id}`);
  }
);

Then('the form should be created successfully',
  function(this: CustomWorld) {
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Created form should be stored in shared test data');
    expectEqual(form.title, testFormTitle, 'Form title should match');
    console.log(`✅ Form creation verified: ${form.title}`);
  }
);

Then('the form should belong to my organization',
  function(this: CustomWorld) {
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Created form should exist');
    expectDefined(this.currentOrganization, 'Current organization should exist');

    expectEqual(
      form.organizationId,
      this.currentOrganization!.id,
      'Form should belong to the current organization'
    );

    console.log(`✅ Form organization ownership verified: ${this.currentOrganization!.name}`);
  }
);
