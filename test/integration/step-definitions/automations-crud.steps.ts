import { Given, When, Then } from '@cucumber/cucumber';
import { randomUUID } from 'crypto';
import { CustomWorld } from '../support/world';
import { expectDefined, expectEqual } from '../utils/expect-helper';

/**
 * Step definitions for the Automations GraphQL API (#195): CRUD lifecycle, activation
 * gating, version bumping, and delete-cancels-runs.
 *
 * Reuses the generic organization/user/form-template setup steps already defined in
 * form-creation.steps.ts and form-sharing.steps.ts (Cucumber matches steps by text only,
 * regardless of Given/When/Then keyword).
 */

const AUTOMATION_QUERY_FIELDS = `
  id
  formId
  organizationId
  name
  status
  triggerType
  triggerConfig
  graph
  version
  createdBy
  createdAt
  updatedAt
`;

function buildValidSingleActionGraph() {
  return {
    nodes: [
      { id: 'trigger-1', type: 'trigger', data: { triggerType: 'form.submitted' } },
      {
        id: 'action-1',
        type: 'action',
        data: { actionType: 'webhook', config: { url: 'https://example.com/automation-webhook' } },
      },
      { id: 'end-1', type: 'end' },
    ],
    edges: [
      { id: 'e1', source: 'trigger-1', target: 'action-1' },
      { id: 'e2', source: 'action-1', target: 'end-1' },
    ],
  };
}

function buildOrphanNodeGraph() {
  return {
    nodes: [
      { id: 'trigger-1', type: 'trigger', data: { triggerType: 'form.submitted' } },
      { id: 'end-1', type: 'end' },
      // Never wired to any edge — triggers ORPHAN_NODE on validateAutomationGraph.
      { id: 'delay-orphan', type: 'delay', data: { amount: 1, unit: 'minutes' } },
    ],
    edges: [{ id: 'e1', source: 'trigger-1', target: 'end-1' }],
  };
}

async function createAutomation(
  world: CustomWorld,
  name: string,
  triggerType: string
): Promise<any> {
  expectDefined(world.authToken, 'Auth token must be available for GraphQL requests');
  const form = world.getSharedTestData('createdForm');
  expectDefined(form, 'Form must exist before creating an automation');

  const mutation = `
    mutation CreateAutomation($formId: ID!, $name: String!, $triggerType: String!) {
      createAutomation(formId: $formId, name: $name, triggerType: $triggerType) {
        ${AUTOMATION_QUERY_FIELDS}
      }
    }
  `;

  const response = await world.authUtils.graphqlRequest(
    mutation,
    { formId: form.id, name, triggerType },
    world.authToken!
  );

  if (response.data.errors) {
    const err = response.data.errors[0];
    throw new Error(`${err.message} [${err.extensions?.code}]`);
  }

  return response.data.data.createAutomation;
}

Given('I create an automation named {string} with trigger type {string} on the form',
  async function (this: CustomWorld, name: string, triggerType: string) {
    const automation = await createAutomation(this, name, triggerType);
    this.setSharedTestData('automation', automation);
    console.log(`✅ Created automation "${name}" (${automation.id})`);
  }
);

When('I try to create an automation named {string} with trigger type {string} on the form',
  async function (this: CustomWorld, name: string, triggerType: string) {
    try {
      const automation = await createAutomation(this, name, triggerType);
      this.setSharedTestData('automation', automation);
      this.lastOperationError = undefined;
    } catch (error: any) {
      this.lastOperationError = error.message;
      console.log(`❌ Failed to create automation: ${error.message}`);
    }
  }
);

Then('the automation should be created with status {string} and version {int}',
  function (this: CustomWorld, expectedStatus: string, expectedVersion: number) {
    const automation = this.getSharedTestData('automation');
    expectDefined(automation, 'Automation should exist after creation');
    expectEqual(automation.status, expectedStatus, 'Automation status should match');
    expectEqual(automation.version, expectedVersion, 'Automation version should match');
  }
);

When('I query the automation by ID',
  async function (this: CustomWorld) {
    const automation = this.getSharedTestData('automation');
    expectDefined(automation, 'Automation must exist before querying');

    const query = `
      query GetAutomation($id: ID!) {
        automation(id: $id) {
          ${AUTOMATION_QUERY_FIELDS}
        }
      }
    `;

    const response = await this.authUtils.graphqlRequest(query, { id: automation.id }, this.authToken!);
    if (response.data.errors) {
      throw new Error(`Failed to query automation: ${response.data.errors[0].message}`);
    }

    this.setSharedTestData('automation', response.data.data.automation);
  }
);

Then('the automation name should be {string}',
  function (this: CustomWorld, expectedName: string) {
    const automation = this.getSharedTestData('automation');
    expectDefined(automation, 'Automation must exist');
    expectEqual(automation.name, expectedName, 'Automation name should match');
  }
);

async function updateAutomationGraph(world: CustomWorld, graph: any): Promise<any> {
  const automation = world.getSharedTestData('automation');
  expectDefined(automation, 'Automation must exist before updating its graph');

  const mutation = `
    mutation UpdateAutomation($id: ID!, $graph: JSON) {
      updateAutomation(id: $id, graph: $graph) {
        ${AUTOMATION_QUERY_FIELDS}
      }
    }
  `;

  const response = await world.authUtils.graphqlRequest(
    mutation,
    { id: automation.id, graph },
    world.authToken!
  );

  if (response.data.errors) {
    const err = response.data.errors[0];
    throw new Error(`${err.message} [${err.extensions?.code}]`);
  }

  return response.data.data.updateAutomation;
}

Given('I update the automation graph to a single-action webhook automation',
  async function (this: CustomWorld) {
    const updated = await updateAutomationGraph(this, buildValidSingleActionGraph());
    this.setSharedTestData('automation', updated);
    console.log(`✅ Updated automation graph to a single-action webhook automation (version ${updated.version})`);
  }
);

Given('I update the automation graph to an invalid graph with an orphan node',
  async function (this: CustomWorld) {
    const updated = await updateAutomationGraph(this, buildOrphanNodeGraph());
    this.setSharedTestData('automation', updated);
    console.log(`✅ Updated automation graph to an invalid (orphan node) graph`);
  }
);

When('I update the automation name to {string}',
  async function (this: CustomWorld, newName: string) {
    const automation = this.getSharedTestData('automation');
    expectDefined(automation, 'Automation must exist before renaming');

    const mutation = `
      mutation UpdateAutomation($id: ID!, $name: String) {
        updateAutomation(id: $id, name: $name) {
          ${AUTOMATION_QUERY_FIELDS}
        }
      }
    `;

    const response = await this.authUtils.graphqlRequest(
      mutation,
      { id: automation.id, name: newName },
      this.authToken!
    );

    if (response.data.errors) {
      throw new Error(`Failed to rename automation: ${response.data.errors[0].message}`);
    }

    this.setSharedTestData('automation', response.data.data.updateAutomation);
  }
);

Then('the automation version should be {int}',
  function (this: CustomWorld, expectedVersion: number) {
    const automation = this.getSharedTestData('automation');
    expectDefined(automation, 'Automation must exist');
    expectEqual(automation.version, expectedVersion, 'Automation version should match');
  }
);

async function setAutomationStatus(world: CustomWorld, status: string): Promise<any> {
  const automation = world.getSharedTestData('automation');
  expectDefined(automation, 'Automation must exist before changing its status');

  const mutation = `
    mutation SetAutomationStatus($id: ID!, $status: String!) {
      setAutomationStatus(id: $id, status: $status) {
        ${AUTOMATION_QUERY_FIELDS}
      }
    }
  `;

  return world.authUtils.graphqlRequest(mutation, { id: automation.id, status }, world.authToken!);
}

Given('I set the automation status to {string}',
  async function (this: CustomWorld, status: string) {
    const response = await setAutomationStatus(this, status);
    if (response.data.errors) {
      const err = response.data.errors[0];
      throw new Error(`${err.message} [${err.extensions?.code}]`);
    }
    this.setSharedTestData('automation', response.data.data.setAutomationStatus);
    console.log(`✅ Automation status set to ${status}`);
  }
);

When('I try to set the automation status to {string}',
  async function (this: CustomWorld, status: string) {
    const response = await setAutomationStatus(this, status);
    if (response.data.errors) {
      const err = response.data.errors[0];
      this.lastOperationError = `${err.message} [${err.extensions?.code}]`;
      this.setSharedTestData('lastGraphQLErrors', response.data.errors);
      console.log(`❌ Failed to activate automation: ${err.message}`);
    } else {
      this.lastOperationError = undefined;
      this.setSharedTestData('automation', response.data.data.setAutomationStatus);
    }
  }
);

Then('the automation status should be {string}',
  async function (this: CustomWorld, expectedStatus: string) {
    // Re-fetch from the DB directly — the failed mutation attempt never updated the
    // in-memory `automation` shared data, so this is the source of truth either way.
    const automation = this.getSharedTestData('automation');
    expectDefined(automation, 'Automation must exist');
    const current = await this.prisma.automation.findUnique({ where: { id: automation.id } });
    expectDefined(current, 'Automation must still exist in the database');
    expectEqual(current!.status, expectedStatus, 'Automation status should match');
  }
);

Then('the validation errors should include code {string}',
  function (this: CustomWorld, expectedCode: string) {
    const errors = this.getSharedTestData('lastGraphQLErrors');
    expectDefined(errors, 'GraphQL errors should have been captured');
    const validationErrors = errors[0]?.extensions?.validationErrors ?? [];
    const found = validationErrors.some((e: any) => e.code === expectedCode);
    if (!found) {
      throw new Error(
        `Expected validationErrors to include code "${expectedCode}", got: ${JSON.stringify(validationErrors)}`
      );
    }
    console.log(`✅ validationErrors include code ${expectedCode}`);
  }
);

When('I query automations for the form',
  async function (this: CustomWorld) {
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Form must exist');

    const query = `
      query FormAutomations($formId: ID!) {
        formAutomations(formId: $formId) {
          ${AUTOMATION_QUERY_FIELDS}
        }
      }
    `;

    const response = await this.authUtils.graphqlRequest(query, { formId: form.id }, this.authToken!);
    if (response.data.errors) {
      throw new Error(`Failed to query automations: ${response.data.errors[0].message}`);
    }

    this.setSharedTestData('automationList', response.data.data.formAutomations);
  }
);

Then('I should see {int} automation(s) in the results',
  function (this: CustomWorld, expectedCount: number) {
    const list = this.getSharedTestData('automationList');
    expectDefined(list, 'Automation list should have been queried');
    expectEqual(list.length, expectedCount, 'Automation count should match');
  }
);

When('I delete the automation',
  async function (this: CustomWorld) {
    const automation = this.getSharedTestData('automation');
    expectDefined(automation, 'Automation must exist before deleting');

    const mutation = `
      mutation DeleteAutomation($id: ID!) {
        deleteAutomation(id: $id)
      }
    `;

    const response = await this.authUtils.graphqlRequest(mutation, { id: automation.id }, this.authToken!);
    if (response.data.errors) {
      throw new Error(`Failed to delete automation: ${response.data.errors[0].message}`);
    }

    expectEqual(response.data.data.deleteAutomation, true, 'deleteAutomation should return true');
    console.log(`✅ Deleted automation ${automation.id}`);
  }
);

Then('the automation should no longer exist',
  async function (this: CustomWorld) {
    const automation = this.getSharedTestData('automation');
    expectDefined(automation, 'Automation reference must exist');

    const row = await this.prisma.automation.findUnique({ where: { id: automation.id } });
    if (row) {
      throw new Error(`Expected automation ${automation.id} to be deleted, but it still exists`);
    }
    console.log(`✅ Confirmed automation ${automation.id} no longer exists`);
  }
);

Given('a RUNNING run exists for the automation',
  async function (this: CustomWorld) {
    const automation = this.getSharedTestData('automation');
    expectDefined(automation, 'Automation must exist before creating a run for it');

    const run = await this.prisma.automationRun.create({
      data: {
        id: randomUUID(),
        automationId: automation.id,
        automationVersion: automation.version,
        graphSnapshot: automation.graph,
        status: 'RUNNING',
        context: {},
      },
    });

    // Keep a list so the "listing runs" scenario can create more than one.
    const runs = this.getSharedTestData('createdRuns') || [];
    runs.push(run);
    this.setSharedTestData('createdRuns', runs);
    console.log(`✅ Seeded RUNNING run ${run.id} for automation ${automation.id}`);
  }
);

When('I query runs for the automation',
  async function (this: CustomWorld) {
    const automation = this.getSharedTestData('automation');
    expectDefined(automation, 'Automation must exist');

    const query = `
      query AutomationRuns($automationId: ID!) {
        automationRuns(automationId: $automationId) {
          id
          automationId
          status
          startedAt
          completedAt
        }
      }
    `;

    const response = await this.authUtils.graphqlRequest(
      query,
      { automationId: automation.id },
      this.authToken!
    );
    if (response.data.errors) {
      throw new Error(`Failed to query automation runs: ${response.data.errors[0].message}`);
    }

    this.setSharedTestData('runList', response.data.data.automationRuns);
  }
);

Then('I should see {int} run(s) in the results',
  function (this: CustomWorld, expectedCount: number) {
    const list = this.getSharedTestData('runList');
    expectDefined(list, 'Run list should have been queried');
    expectEqual(list.length, expectedCount, 'Run count should match');
  }
);
