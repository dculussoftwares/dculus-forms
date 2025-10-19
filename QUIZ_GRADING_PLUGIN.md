# Quiz Auto-Grading Plugin

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Architecture](#architecture)
4. [How It Works](#how-it-works)
5. [Data Structures](#data-structures)
6. [Plugin Configuration](#plugin-configuration)
7. [Backend Implementation](#backend-implementation)
8. [Frontend Implementation](#frontend-implementation)
9. [API Reference](#api-reference)
10. [Usage Examples](#usage-examples)
11. [Testing](#testing)
12. [Troubleshooting](#troubleshooting)
13. [Future Enhancements](#future-enhancements)

---

## Overview

The **Quiz Auto-Grading Plugin** automatically grades form responses containing quiz questions (dropdown and radio fields). It compares user answers with configured correct answers, calculates scores, and stores results in response metadata.

**Plugin Type:** `quiz-grading`
**Category:** Workflow Automation
**Events:** `form.submitted`, `plugin.test`

### Key Benefits

- ✅ **Zero Manual Grading** - Automatic scoring on form submission
- ✅ **Centralized Configuration** - All quiz settings in plugin UI
- ✅ **Flexible Scoring** - Custom marks per question
- ✅ **Instant Feedback** - Results available immediately
- ✅ **Extensible** - Integrates with metadata system
- ✅ **Type-Safe** - Full TypeScript support

---

## Features

### Core Features

- **Automatic Grading** - Grade responses on submission via `form.submitted` event
- **Field Selection** - Configure quiz from existing dropdown/radio fields
- **Correct Answers** - Set correct answer for each question
- **Custom Marks** - Assign points per question (supports decimals)
- **Pass Threshold** - Configurable pass percentage (default: 60%)
- **Binary Scoring** - Full marks for correct, 0 for incorrect
- **Metadata Storage** - Results stored in `Response.metadata['quiz-grading']`
- **Visual Results** - Quiz results card with pass/fail badge
- **Table Display** - Score column in responses table

### Current Limitations

- Only SelectField and RadioField supported (single-choice questions)
- Binary scoring (no partial credit)
- Case-sensitive answer matching
- No manual grade override (Phase 1)
- No notification emails (Phase 1)

---

## Architecture

### Plugin Flow

```
Form Creation
    ↓
Form creator adds SelectField/RadioField with options
    ↓
Plugin Installation
    ↓
Form creator installs "Quiz Grading" plugin
    ↓
Plugin Configuration
    ↓
- Select fields to include in quiz
- Set correct answer for each field
- Assign marks per question
- Set pass threshold
    ↓
Plugin config saved to FormPlugin table
    ↓
═════════════════════════════════
    ↓
User Submits Form
    ↓
Response saved to Response table
    ↓
form.submitted event emitted
    ↓
Quiz Grading Plugin Handler executes
    ↓
1. Fetch response and form schema from context
2. Extract quiz field configurations from plugin config
3. Grade each question (compare answers)
4. Calculate total score and percentage
5. Build QuizGradingMetadata object
6. Update Response.metadata with results
7. Log result to PluginDelivery
    ↓
Results stored in database
    ↓
═════════════════════════════════
    ↓
User views Responses table
    ↓
Quiz score displayed in table column
    ↓
User clicks to view detailed results
    ↓
QuizGradingMetadataViewer component renders
    ↓
Shows score, percentage, pass/fail, and breakdown
```

### Metadata Storage Structure

```typescript
Response.metadata = {
  'quiz-grading': {
    quizScore: 8,           // Total marks earned
    totalMarks: 10,         // Total possible marks
    percentage: 80,         // Score percentage
    fieldResults: [         // Per-question breakdown
      {
        fieldId: 'field_1',
        fieldLabel: 'What is 2+2?',
        userAnswer: '4',
        correctAnswer: '4',
        isCorrect: true,
        marksAwarded: 1,
        maxMarks: 1
      },
      // ... more results
    ],
    gradedAt: '2025-01-15T10:30:00Z',
    gradedBy: 'plugin'      // 'plugin' or 'manual'
  }
}
```

### Plugin Configuration Structure

```typescript
FormPlugin.config = {
  quizFields: [
    {
      fieldId: 'field_abc123',
      correctAnswer: 'Option 2',
      marks: 2
    },
    {
      fieldId: 'field_def456',
      correctAnswer: 'Paris',
      marks: 1
    }
  ],
  passThreshold: 70  // Percentage required to pass
}
```

---

## How It Works

### 1. Plugin Installation & Configuration

**Step 1: Form Creation**
- Form creator adds form fields as usual
- SelectField and RadioField with options
- No special configuration needed in field settings

**Step 2: Plugin Installation**
- Navigate to Forms → [Form] → Plugins
- Click "Add Plugin"
- Select "Quiz Auto-Grading" from plugin gallery
- Enter plugin configuration page

**Step 3: Plugin Configuration**
- **Plugin Name:** Descriptive name (e.g., "Math Quiz Grading")
- **Pass Threshold:** Percentage required to pass (default: 60%)
- **Quiz Questions Section:**
  - All SelectField and RadioField are listed
  - Check fields to include in quiz
  - For each included field:
    - Select correct answer from dropdown (populated from field options)
    - Enter marks/points (default: 1, min: 0.5, step: 0.5)

**Step 4: Validation**
- At least one field must be included
- All included fields must have correct answer selected
- All included fields must have marks > 0
- Pass threshold must be 0-100

**Step 5: Save**
- Plugin configuration saved to FormPlugin table
- Plugin listens for `form.submitted` events

### 2. Form Submission & Grading

**When User Submits Form:**

1. **Response Creation**
   - User fills out form and submits
   - Response saved to Response table
   - `emitFormSubmitted()` called with response data

2. **Plugin Execution**
   - Plugin executor finds quiz-grading plugin for this form
   - Checks if plugin is enabled
   - Calls `quizGradingHandler` with event data

3. **Grading Process**
   ```typescript
   // Handler receives:
   // - plugin (with config containing quizFields)
   // - event (with formId, responseId, organizationId)
   // - context (with helper functions)

   // 1. Fetch response
   const response = await context.getResponseById(event.data.responseId);

   // 2. Fetch form schema
   const form = await context.getFormById(event.formId);
   const formSchema = deserializeFormSchema(form.formSchema);

   // 3. Create field labels map
   const fieldLabelsMap = createFieldLabelsMap(formSchema);

   // 4. Grade each question
   for (const quizField of config.quizFields) {
     const userAnswer = response.data[quizField.fieldId];
     const correctAnswer = quizField.correctAnswer;
     const isCorrect = userAnswer === correctAnswer;
     const marksAwarded = isCorrect ? quizField.marks : 0;

     totalScore += marksAwarded;
     totalMarks += quizField.marks;

     fieldResults.push({
       fieldId: quizField.fieldId,
       fieldLabel: fieldLabelsMap[quizField.fieldId],
       userAnswer,
       correctAnswer,
       isCorrect,
       marksAwarded,
       maxMarks: quizField.marks
     });
   }

   // 5. Calculate percentage
   const percentage = (totalScore / totalMarks) * 100;

   // 6. Build metadata
   const quizMetadata = {
     quizScore: totalScore,
     totalMarks,
     percentage,
     fieldResults,
     gradedAt: new Date().toISOString(),
     gradedBy: 'plugin'
   };

   // 7. Update response
   await context.prisma.response.update({
     where: { id: response.id },
     data: {
       metadata: {
         ...existingMetadata,
         'quiz-grading': quizMetadata
       }
     }
   });
   ```

4. **Result Logging**
   - Plugin execution result logged to PluginDelivery table
   - Status: 'success' or 'failed'
   - Response includes quiz score and percentage

5. **Metadata Available**
   - Quiz results immediately available in Response.metadata
   - Can be queried via GraphQL
   - Displayed in UI

### 3. Viewing Results

**Responses Table:**
- Quiz Score column shows: `8 / 10 (80%)`
- Color-coded badge: green for pass, red for fail
- Click row to view detailed results

**Individual Response Viewer:**
- QuizGradingMetadataViewer component renders
- Shows:
  - Large score display: "8 / 10"
  - Percentage: "80.0%"
  - Progress bar
  - Pass/Fail badge
  - Answer breakdown:
    - Question number and label
    - User's answer (colored green/red)
    - Correct answer (if user was wrong)
    - Checkmark or X icon
    - Marks awarded / max marks

---

## Data Structures

### TypeScript Interfaces

#### QuizFieldConfig

Plugin configuration for individual quiz field:

```typescript
interface QuizFieldConfig {
  fieldId: string;          // Form field ID (e.g., 'field_abc123')
  correctAnswer: string;    // Correct option value
  marks: number;            // Points for this question (e.g., 1, 2, 0.5)
}
```

#### QuizGradingPluginConfig

Main plugin configuration:

```typescript
interface QuizGradingPluginConfig extends PluginConfig {
  type: 'quiz-grading';
  quizFields: QuizFieldConfig[];  // Array of quiz field configurations
  passThreshold: number;          // Pass percentage (0-100)
}
```

#### QuizFieldResult

Individual question result:

```typescript
interface QuizFieldResult {
  fieldId: string;          // Field ID
  fieldLabel: string;       // Question label (from form schema)
  userAnswer: string;       // User's selected answer
  correctAnswer: string;    // Correct answer from config
  isCorrect: boolean;       // Whether user answered correctly
  marksAwarded: number;     // Marks earned (0 or maxMarks)
  maxMarks: number;         // Maximum possible marks
}
```

#### QuizGradingMetadata

Complete quiz results (stored in Response.metadata):

```typescript
interface QuizGradingMetadata {
  quizScore: number;                // Total marks earned
  totalMarks: number;               // Total possible marks
  percentage: number;               // Score percentage (0-100)
  fieldResults: QuizFieldResult[];  // Per-question breakdown
  gradedAt: string;                 // ISO timestamp
  gradedBy: 'plugin' | 'manual';    // Grading method
}
```

#### QuizGradingResult

Plugin handler return value:

```typescript
interface QuizGradingResult {
  success: boolean;      // Whether grading succeeded
  quizScore: number;     // Total marks earned
  totalMarks: number;    // Total possible marks
  percentage: number;    // Score percentage
  passed: boolean;       // Whether percentage >= passThreshold
  responseId: string;    // Response ID that was graded
  error?: string;        // Error message if failed
}
```

---

## Plugin Configuration

### Configuration UI Location

**Path:** Forms → [Select Form] → Plugins → Add Plugin → Quiz Auto-Grading

### Configuration Steps

1. **Basic Settings Card**
   - **Plugin Name** (required)
     - Descriptive name for this plugin instance
     - Example: "Math Quiz Grading", "History Test Auto-Score"

   - **Pass Threshold** (required, default: 60)
     - Percentage required to pass
     - Range: 0-100
     - Decimal values allowed (e.g., 66.7)
     - Used to determine pass/fail status

2. **Quiz Questions Card**
   - Lists all SelectField and RadioField from form
   - If no selection fields found: shows alert message

   - **For Each Field:**
     - **Checkbox:** Include in quiz (default: unchecked)
     - **Field Label:** Displayed as question text
     - **Field Type Badge:** "Dropdown" or "Radio"

     - **When Included:**
       - **Correct Answer Dropdown** (required)
         - Populated from field's options
         - Select the correct answer
         - Must match exactly (case-sensitive)

       - **Marks Input** (required, default: 1)
         - Number input
         - Min: 0.5
         - Step: 0.5
         - Supports decimals for weighted questions

3. **Validation Rules**
   - At least one field must be checked
   - All checked fields must have:
     - Correct answer selected
     - Marks > 0
   - Pass threshold must be 0-100

4. **Events**
   - Automatically set to `['form.submitted']`
   - Triggers grading on every form submission

### Configuration Example

**Form Fields:**
- Q1: "What is 2+2?" (SelectField: [2, 3, 4, 5])
- Q2: "Capital of France?" (RadioField: [London, Paris, Berlin, Rome])
- Q3: "Email Address" (EmailField)

**Plugin Configuration:**
```json
{
  "name": "Simple Math & Geography Quiz",
  "type": "quiz-grading",
  "config": {
    "quizFields": [
      {
        "fieldId": "q1_field_id",
        "correctAnswer": "4",
        "marks": 1
      },
      {
        "fieldId": "q2_field_id",
        "correctAnswer": "Paris",
        "marks": 2
      }
    ],
    "passThreshold": 60
  },
  "events": ["form.submitted"],
  "enabled": true
}
```

**Note:** Q3 (Email Field) is not included because it's not a SelectField or RadioField.

---

## Backend Implementation

### File Structure

```
apps/backend/src/plugins/quiz/
├── types.ts          # TypeScript interfaces and constants
├── handler.ts        # Plugin handler and grading logic
└── index.ts          # Plugin registration and exports
```

### Plugin Types (`types.ts`)

```typescript
import type { PluginConfig } from '../types.js';

export interface QuizFieldConfig {
  fieldId: string;
  correctAnswer: string;
  marks: number;
}

export interface QuizGradingPluginConfig extends PluginConfig {
  type: 'quiz-grading';
  quizFields: QuizFieldConfig[];
  passThreshold: number;
}

export const QUIZ_GRADING_PLUGIN_TYPE = 'quiz-grading' as const;
export const QUIZ_GRADING_METADATA_KEY = 'quiz-grading' as const;

export type ValidatedQuizGradingConfig = QuizGradingPluginConfig;

export interface QuizGradingResult {
  success: boolean;
  quizScore: number;
  totalMarks: number;
  percentage: number;
  passed: boolean;
  responseId: string;
  error?: string;
}
```

### Plugin Handler (`handler.ts`)

**Main Handler Function:**

```typescript
import type { PluginHandler } from '../types.js';
import type { QuizGradingPluginConfig, QuizGradingResult } from './types.js';
import { QUIZ_GRADING_METADATA_KEY } from './types.js';
import { deserializeFormSchema } from '@dculus/types';
import { createFieldLabelsMap } from '@dculus/utils';

export const quizGradingHandler: PluginHandler = async (plugin, event, context) => {
  const config = plugin.config as QuizGradingPluginConfig;

  context.logger.info('Quiz grading plugin triggered', {
    eventType: event.type,
    formId: event.formId,
    quizFieldCount: config.quizFields.length,
  });

  try {
    // Validate event has response ID
    if (!event.data.responseId) {
      throw new Error('No response ID in event data');
    }

    // Get response data
    const response = await context.getResponseById(event.data.responseId);
    if (!response) {
      throw new Error(`Response not found: ${event.data.responseId}`);
    }

    // Get form schema for field labels
    const form = await context.getFormById(event.formId);
    if (!form) {
      throw new Error(`Form not found: ${event.formId}`);
    }

    // Grade the quiz
    const formSchema = deserializeFormSchema(form.formSchema);
    const fieldLabelsMap = createFieldLabelsMap(formSchema);
    const quizMetadata = gradeQuizResponse(
      config.quizFields,
      response.data,
      fieldLabelsMap
    );

    // Update response metadata
    const existingMetadata = (response.metadata as any) || {};
    const updatedMetadata = {
      ...existingMetadata,
      [QUIZ_GRADING_METADATA_KEY]: quizMetadata,
    };

    await context.prisma.response.update({
      where: { id: response.id },
      data: { metadata: updatedMetadata },
    });

    context.logger.info('Quiz graded successfully', {
      responseId: response.id,
      score: `${quizMetadata.quizScore}/${quizMetadata.totalMarks}`,
      percentage: `${quizMetadata.percentage.toFixed(1)}%`,
      passed: quizMetadata.percentage >= config.passThreshold,
    });

    // Return result
    const result: QuizGradingResult = {
      success: true,
      quizScore: quizMetadata.quizScore,
      totalMarks: quizMetadata.totalMarks,
      percentage: quizMetadata.percentage,
      passed: quizMetadata.percentage >= config.passThreshold,
      responseId: response.id,
    };

    return result;

  } catch (error: any) {
    context.logger.error('Quiz grading failed', {
      error: error.message,
      formId: event.formId,
      responseId: event.data.responseId,
    });

    throw new Error(`Quiz grading failed: ${error.message}`);
  }
};
```

**Grading Logic Function:**

```typescript
function gradeQuizResponse(
  quizFields: QuizFieldConfig[],
  responseData: Record<string, any>,
  fieldLabelsMap: Record<string, string>
): any {
  let totalScore = 0;
  let totalMarks = 0;
  const fieldResults: any[] = [];

  for (const quizField of quizFields) {
    const userAnswer = responseData[quizField.fieldId] || '';
    const correctAnswer = quizField.correctAnswer;
    const maxMarks = quizField.marks;

    // Binary grading: full marks if correct, 0 if incorrect
    const isCorrect = userAnswer === correctAnswer;
    const marksAwarded = isCorrect ? maxMarks : 0;

    totalScore += marksAwarded;
    totalMarks += maxMarks;

    fieldResults.push({
      fieldId: quizField.fieldId,
      fieldLabel: fieldLabelsMap[quizField.fieldId] || 'Unknown Field',
      userAnswer: userAnswer || '(No answer)',
      correctAnswer,
      isCorrect,
      marksAwarded,
      maxMarks,
    });
  }

  const percentage = totalMarks > 0 ? (totalScore / totalMarks) * 100 : 0;

  return {
    quizScore: totalScore,
    totalMarks,
    percentage: parseFloat(percentage.toFixed(2)),
    fieldResults,
    gradedAt: new Date().toISOString(),
    gradedBy: 'plugin',
  };
}
```

### Plugin Registration (`index.ts`)

```typescript
import { registerPlugin } from '../registry.js';
import { quizGradingHandler } from './handler.js';
import { QUIZ_GRADING_PLUGIN_TYPE } from './types.js';

export const registerQuizGradingPlugin = (): void => {
  registerPlugin(QUIZ_GRADING_PLUGIN_TYPE, quizGradingHandler);
};

export * from './types.js';
export * from './handler.js';
```

### Initialize Plugin System

**File:** `apps/backend/src/plugins/index.ts`

```typescript
import { registerWebhookPlugin } from './webhooks/index.js';
import { registerEmailPlugin } from './email/index.js';
import { registerQuizGradingPlugin } from './quiz/index.js';  // NEW
import { initializePluginEvents } from './events.js';

export const initializePluginSystem = (): void => {
  registerWebhookPlugin();
  registerEmailPlugin();
  registerQuizGradingPlugin();  // NEW
  initializePluginEvents();
};
```

---

## Frontend Implementation

### File Structure

```
apps/form-app/src/
├── components/
│   ├── plugin-config/
│   │   └── QuizGradingPluginConfig.tsx    # Configuration UI
│   └── response-metadata/
│       ├── QuizGradingMetadataViewer.tsx  # Results viewer
│       └── MetadataViewerRegistry.tsx     # Viewer registry
├── pages/
│   ├── Plugins.tsx                        # Plugin gallery (add quiz)
│   ├── PluginConfiguration.tsx            # Config router
│   ├── Responses.tsx                      # Add score column
│   └── ResponsesIndividual.tsx            # Add metadata viewer
└── graphql/
    └── queries/
        └── responses.ts                   # Add metadata field
```

### Plugin Configuration Component

**File:** `apps/form-app/src/components/plugin-config/QuizGradingPluginConfig.tsx`

See full implementation in implementation checklist. Key features:

- Extract SelectField/RadioField from form schema
- Manage quiz field configurations with state
- Toggle field inclusion with checkboxes
- Correct answer dropdown (populated from field options)
- Marks input (number, min 0.5, step 0.5)
- Pass threshold setting
- Validation before save

### Quiz Results Viewer Component

**File:** `apps/form-app/src/components/response-metadata/QuizGradingMetadataViewer.tsx`

See full implementation in implementation checklist. Key features:

- Large score display
- Percentage with progress bar
- Pass/fail badge (color-coded)
- Answer breakdown with:
  - Question number and label
  - User's answer (green if correct, red if incorrect)
  - Correct answer (shown if user was wrong)
  - Checkmark or X icon
  - Marks badge

### Metadata Viewer Registry

**File:** `apps/form-app/src/components/response-metadata/MetadataViewerRegistry.tsx`

```typescript
import React from 'react';
import { QuizGradingMetadataViewer } from './QuizGradingMetadataViewer';

const METADATA_VIEWERS: Record<string, React.ComponentType<any>> = {
  'quiz-grading': QuizGradingMetadataViewer,
};

export const MetadataViewer: React.FC<{ metadata: Record<string, any> }> = ({ metadata }) => {
  if (!metadata) return null;

  return (
    <div className="space-y-4">
      {Object.entries(metadata).map(([pluginType, pluginMetadata]) => {
        const ViewerComponent = METADATA_VIEWERS[pluginType];
        if (!ViewerComponent) {
          return <pre key={pluginType}>{JSON.stringify(pluginMetadata, null, 2)}</pre>;
        }
        return <ViewerComponent key={pluginType} metadata={pluginMetadata} />;
      })}
    </div>
  );
};
```

---

## API Reference

### GraphQL Types

```graphql
type Response {
  id: ID!
  formId: ID!
  data: JSON!
  metadata: JSON  # Contains quiz results under 'quiz-grading' key
  submittedAt: DateTime!
  # ... other fields
}
```

### GraphQL Queries

**Get Response with Metadata:**

```graphql
query GetResponse($id: ID!) {
  response(id: $id) {
    id
    formId
    data
    metadata
    submittedAt
  }
}
```

**Get Form Responses with Metadata:**

```graphql
query GetFormResponses($formId: ID!, $page: Int, $limit: Int) {
  responsesByForm(formId: $formId, page: $page, limit: $limit) {
    data {
      id
      formId
      data
      metadata
      submittedAt
    }
    total
    page
    limit
    totalPages
  }
}
```

### GraphQL Mutations

**Create Quiz Grading Plugin:**

```graphql
mutation CreateQuizGradingPlugin($input: CreatePluginInput!) {
  createPlugin(input: $input) {
    id
    type
    name
    enabled
    config
    events
  }
}
```

**Input:**
```json
{
  "formId": "form_abc123",
  "type": "quiz-grading",
  "name": "Math Quiz Grading",
  "config": {
    "quizFields": [
      { "fieldId": "field_1", "correctAnswer": "4", "marks": 1 },
      { "fieldId": "field_2", "correctAnswer": "Paris", "marks": 2 }
    ],
    "passThreshold": 60
  },
  "events": ["form.submitted"]
}
```

**Update Quiz Grading Plugin:**

```graphql
mutation UpdateQuizGradingPlugin($id: ID!, $input: UpdatePluginInput!) {
  updatePlugin(id: $id, input: $input) {
    id
    name
    enabled
    config
  }
}
```

**Test Quiz Grading Plugin:**

```graphql
mutation TestQuizGradingPlugin($id: ID!) {
  testPlugin(id: $id) {
    success
    message
  }
}
```

---

## Usage Examples

### Example 1: Simple Math Quiz

**Form Fields:**
- Q1: "What is 2+2?" (SelectField: [2, 3, 4, 5])
- Q2: "What is 5×5?" (RadioField: [20, 25, 30])

**Plugin Configuration:**
```json
{
  "quizFields": [
    { "fieldId": "q1", "correctAnswer": "4", "marks": 1 },
    { "fieldId": "q2", "correctAnswer": "25", "marks": 1 }
  ],
  "passThreshold": 50
}
```

**User Submission:**
```json
{
  "q1": "4",    // Correct
  "q2": "20"    // Incorrect
}
```

**Grading Result:**
```json
{
  "quizScore": 1,
  "totalMarks": 2,
  "percentage": 50,
  "fieldResults": [
    {
      "fieldId": "q1",
      "fieldLabel": "What is 2+2?",
      "userAnswer": "4",
      "correctAnswer": "4",
      "isCorrect": true,
      "marksAwarded": 1,
      "maxMarks": 1
    },
    {
      "fieldId": "q2",
      "fieldLabel": "What is 5×5?",
      "userAnswer": "20",
      "correctAnswer": "25",
      "isCorrect": false,
      "marksAwarded": 0,
      "maxMarks": 1
    }
  ],
  "passed": true  // 50% meets 50% threshold
}
```

### Example 2: Weighted Questions

**Form Fields:**
- Easy Q: "Capital of France?" (RadioField: [London, Paris, Berlin])
- Hard Q: "Population of Tokyo metropolitan area?" (SelectField: [10M, 14M, 30M, 40M])

**Plugin Configuration:**
```json
{
  "quizFields": [
    { "fieldId": "easy", "correctAnswer": "Paris", "marks": 1 },
    { "fieldId": "hard", "correctAnswer": "40M", "marks": 3 }
  ],
  "passThreshold": 70
}
```

**User Submission:**
```json
{
  "easy": "Paris",  // Correct
  "hard": "30M"     // Incorrect
}
```

**Grading Result:**
```json
{
  "quizScore": 1,
  "totalMarks": 4,
  "percentage": 25,
  "passed": false  // 25% below 70% threshold
}
```

### Example 3: Perfect Score

**User Submission:**
```json
{
  "q1": "4",
  "q2": "25"
}
```

**Grading Result:**
```json
{
  "quizScore": 2,
  "totalMarks": 2,
  "percentage": 100,
  "passed": true
}
```

---

## Testing

### Integration Tests

**File:** `test/integration/features/quiz-grading.feature`

```gherkin
Feature: Quiz Auto-Grading Plugin

  Background:
    Given I am authenticated as a form owner
    And I have a form with dropdown and radio fields

  Scenario: Create quiz grading plugin
    When I install the quiz grading plugin
    And I configure quiz fields with correct answers and marks
    Then the plugin should be created successfully
    And the plugin should listen to "form.submitted" events

  Scenario: Grade response with all correct answers
    Given I have a quiz grading plugin configured
    When a user submits a response with all correct answers
    Then the quiz score should be 100%
    And the response metadata should contain quiz results
    And the passed status should be true

  Scenario: Grade response with all incorrect answers
    Given I have a quiz grading plugin configured
    When a user submits a response with all incorrect answers
    Then the quiz score should be 0%
    And the passed status should be false

  Scenario: Grade response with mixed answers
    Given I have a quiz grading plugin configured with 2 questions
    When a user submits a response with 1 correct and 1 incorrect answer
    Then the quiz score should be 50%
    And the field results should show correct/incorrect breakdown

  Scenario: Verify metadata storage
    Given I have a quiz grading plugin configured
    When a user submits a response
    Then the response metadata should contain 'quiz-grading' key
    And the metadata should include quizScore, totalMarks, percentage, and fieldResults

  Scenario: Test pass/fail threshold
    Given I have a quiz grading plugin with 70% pass threshold
    When a user submits a response with 80% score
    Then the passed status should be true
    When a user submits a response with 60% score
    Then the passed status should be false
```

### Manual Testing Checklist

- [ ] Start dev server: `pnpm dev`
- [ ] Create form with at least 2 dropdown/radio fields with options
- [ ] Install quiz grading plugin
- [ ] Configure quiz:
  - [ ] Select fields to include
  - [ ] Set correct answers
  - [ ] Set marks (try different values: 1, 2, 0.5)
  - [ ] Set pass threshold
- [ ] Submit test response with correct answers
  - [ ] Verify grading in PluginDelivery table
  - [ ] Verify metadata in Response table
  - [ ] Check score in responses table
  - [ ] View detailed results
- [ ] Submit test response with incorrect answers
  - [ ] Verify failed status
  - [ ] Check correct answers shown in breakdown
- [ ] Test edge cases:
  - [ ] No answer provided
  - [ ] Partial answers (some fields unanswered)
  - [ ] Form with no selection fields
  - [ ] Empty quiz (no fields selected)
- [ ] Test plugin management:
  - [ ] Edit plugin configuration
  - [ ] Disable plugin
  - [ ] Re-enable plugin
  - [ ] Delete plugin
  - [ ] Test plugin (test event)

### Unit Tests

Test grading logic in isolation:

```typescript
import { gradeQuizResponse } from '../handler';

describe('gradeQuizResponse', () => {
  const quizFields = [
    { fieldId: 'q1', correctAnswer: '4', marks: 1 },
    { fieldId: 'q2', correctAnswer: 'Paris', marks: 2 },
  ];

  const fieldLabelsMap = {
    q1: 'What is 2+2?',
    q2: 'Capital of France?',
  };

  it('should grade all correct answers', () => {
    const responseData = { q1: '4', q2: 'Paris' };
    const result = gradeQuizResponse(quizFields, responseData, fieldLabelsMap);

    expect(result.quizScore).toBe(3);
    expect(result.totalMarks).toBe(3);
    expect(result.percentage).toBe(100);
  });

  it('should grade all incorrect answers', () => {
    const responseData = { q1: '5', q2: 'London' };
    const result = gradeQuizResponse(quizFields, responseData, fieldLabelsMap);

    expect(result.quizScore).toBe(0);
    expect(result.totalMarks).toBe(3);
    expect(result.percentage).toBe(0);
  });

  it('should handle missing answers', () => {
    const responseData = { q1: '4' }; // q2 missing
    const result = gradeQuizResponse(quizFields, responseData, fieldLabelsMap);

    expect(result.quizScore).toBe(1);
    expect(result.totalMarks).toBe(3);
    expect(result.percentage).toBeCloseTo(33.33);
  });
});
```

---

## Troubleshooting

### Plugin Not Grading Responses

**Symptoms:**
- Form submissions not graded
- No metadata in response
- No PluginDelivery log entry

**Possible Causes & Solutions:**

1. **Plugin is disabled**
   - Check FormPlugin.enabled = true
   - Re-enable plugin in UI

2. **No quiz fields configured**
   - Verify FormPlugin.config.quizFields is not empty
   - Edit plugin and add fields

3. **Form has no selection fields**
   - Add SelectField or RadioField to form
   - Configure plugin with new fields

4. **Plugin not registered**
   - Check `registerQuizGradingPlugin()` called in `plugins/index.ts`
   - Restart backend server

5. **Event not emitting**
   - Verify `emitFormSubmitted()` called after response creation
   - Check plugin executor logs

**Debug Steps:**
1. Check PluginDelivery table for entries
2. If entry exists with error, check errorMessage
3. If no entry, check server logs for plugin executor
4. Verify plugin enabled and events = ['form.submitted']

### Incorrect Grading

**Symptoms:**
- Wrong score calculated
- Correct answers marked as incorrect
- Unexpected field results

**Possible Causes & Solutions:**

1. **Case mismatch**
   - Answers are case-sensitive
   - "Paris" ≠ "paris"
   - Verify correct answer matches field option exactly

2. **Whitespace differences**
   - "Option 1" ≠ "Option 1 " (trailing space)
   - Check field options and plugin config for extra spaces

3. **Field ID mismatch**
   - Plugin config fieldId must match form field ID
   - Regenerate plugin config if form fields changed

4. **Stale plugin configuration**
   - Form field options changed after plugin configured
   - Edit plugin and update correct answers

**Debug Steps:**
1. Check PluginDelivery.response for grading details
2. Compare user answer vs correct answer in field results
3. Verify field IDs in plugin config match form schema
4. Check form schema field options match plugin config

### Metadata Not Displaying

**Symptoms:**
- Quiz score column shows "-"
- No quiz results in individual response viewer
- Metadata field is null or empty

**Possible Causes & Solutions:**

1. **Response has no metadata**
   - Check Response.metadata in database
   - Verify plugin graded this response (check PluginDelivery)

2. **Metadata key mismatch**
   - Verify metadata['quiz-grading'] exists
   - Check QUIZ_GRADING_METADATA_KEY constant

3. **Viewer not registered**
   - Check MetadataViewerRegistry includes 'quiz-grading'
   - Import QuizGradingMetadataViewer

4. **GraphQL query missing metadata field**
   - Add `metadata` to ResponseFields fragment
   - Verify all queries using fragment

**Debug Steps:**
1. Query response directly: `SELECT metadata FROM response WHERE id = 'xxx'`
2. Check if metadata.quiz-grading exists
3. Verify GraphQL response includes metadata
4. Check browser console for rendering errors

### Plugin Test Failing

**Symptoms:**
- Test button returns error
- PluginDelivery shows failed status

**Possible Causes & Solutions:**

1. **No test event handler**
   - Plugin should handle both 'form.submitted' and 'plugin.test'
   - Test events may have different data structure

2. **Missing responseId in test event**
   - Test events may not have responseId
   - Handler should handle test events gracefully

**Debug Steps:**
1. Check PluginDelivery.errorMessage for test execution
2. Verify handler checks for event.data.responseId
3. Add test event handling if needed

---

## Future Enhancements

### Phase 2: Advanced Grading

- **Partial Credit Scoring**
  - Award partial marks for "close" answers
  - Configurable partial credit percentage

- **Multiple Correct Answers**
  - Support multiple acceptable answers per question
  - "Paris", "paris", "PARIS" all correct

- **Case-Insensitive Matching**
  - Option to enable case-insensitive comparison
  - Useful for text-based questions

- **Answer Explanations**
  - Add explanation field to quiz configuration
  - Show explanation with correct answer in results

### Phase 3: Enhanced Features

- **Manual Grade Override**
  - Allow manual adjustment of auto-graded scores
  - Track manual edits in metadata

- **Time-Based Scoring**
  - Award bonus marks for fast completion
  - Penalize slow responses

- **Question Randomization**
  - Randomize question order per user
  - Prevent cheating in timed quizzes

- **Answer Feedback**
  - Immediate feedback mode (show correct answer after submission)
  - Delayed feedback mode (show after deadline)

### Phase 4: Reporting & Analytics

- **Quiz Analytics Dashboard**
  - Average score across all responses
  - Pass rate percentage
  - Question difficulty analysis (% correct per question)
  - Time to complete statistics

- **Export Quiz Results**
  - Export to CSV/Excel
  - Include detailed breakdown
  - Filter by date range, score, etc.

- **Certificate Generation**
  - Auto-generate PDF certificates for passing scores
  - Customizable certificate template
  - Email certificate to respondent

### Phase 5: Integration

- **Email Notifications**
  - Send grade notification to respondent
  - Send admin alert for high/low scores
  - Customizable email templates

- **Webhook Integration**
  - Send quiz results to external system
  - Trigger workflows based on score/pass status

- **LMS Integration**
  - Export quiz results to Learning Management Systems
  - Support SCORM/LTI standards

---

## Related Documentation

- [PLUGIN_SYSTEM.md](./PLUGIN_SYSTEM.md) - Complete plugin system architecture
- [QUIZ_GRADING_IMPLEMENTATION_CHECKLIST.md](./QUIZ_GRADING_IMPLEMENTATION_CHECKLIST.md) - Step-by-step implementation guide
- [CLAUDE.md](./CLAUDE.md) - Development environment setup
- [apps/backend/src/plugins/PLUGIN_DEVELOPMENT_GUIDE.md](./apps/backend/src/plugins/PLUGIN_DEVELOPMENT_GUIDE.md) - Plugin development guide

---

**Last Updated:** 2025-01-19
**Version:** 1.0
**Status:** Implementation Ready
