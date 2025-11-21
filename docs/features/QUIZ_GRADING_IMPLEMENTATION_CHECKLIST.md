# Quiz Auto-Grading Plugin Implementation Checklist

This document provides a complete step-by-step guide for implementing the Quiz Auto-Grading plugin. Follow each phase in order and check off items as you complete them.

**Documentation References:**
- [QUIZ_GRADING_PLUGIN.md](./QUIZ_GRADING_PLUGIN.md) - Complete plugin documentation
- [PLUGIN_SYSTEM.md](./PLUGIN_SYSTEM.md) - Plugin system architecture
- [CLAUDE.md](./CLAUDE.md) - Development environment setup

---

## Phase 1: Database & Type Definitions

### 1.1 Database Schema Updates

**File:** `apps/backend/prisma/schema.prisma`

- [ ] Locate the `Response` model (should be around line 155-166)
- [ ] Add `metadata Json?` field to Response model
  ```prisma
  model Response {
    id          String   @id @map("_id")
    formId      String
    data        Json
    metadata    Json?    # NEW: Add this line
    submittedAt DateTime @default(now())

    form                       Form @relation(fields: [formId], references: [id], onDelete: Cascade)
    formSubmissionAnalytics    FormSubmissionAnalytics?
    editHistory                ResponseEditHistory[]

    @@map("response")
  }
  ```
- [ ] Save the file
- [ ] Run `pnpm db:generate` in terminal
- [ ] Run `pnpm db:push` to apply migration
- [ ] Verify migration succeeded (check terminal output)
- [ ] Open Prisma Studio (`pnpm db:studio`) and verify metadata field exists in Response model

---

### 1.2 TypeScript Type Definitions

**File:** `packages/types/src/index.ts`

- [ ] Locate the FormResponse interface (around line 698-708)
- [ ] Add these type definitions **before** the FormResponse interface:

```typescript
// Plugin Metadata Types
export type PluginMetadata = Record<string, any>;

// Quiz-specific metadata (stored under 'quiz-grading' key)
export interface QuizFieldResult {
  fieldId: string;
  fieldLabel: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  marksAwarded: number;
  maxMarks: number;
}

export interface QuizGradingMetadata {
  quizScore: number;
  totalMarks: number;
  percentage: number;
  fieldResults: QuizFieldResult[];
  gradedAt: string;
  gradedBy: 'plugin' | 'manual';
}
```

- [ ] Update the `FormResponse` interface to include metadata:

```typescript
export interface FormResponse {
  id: string;
  formId: string;
  data: Record<string, any>;
  metadata?: PluginMetadata;  // NEW: Add this line
  submittedAt: Date;
  hasBeenEdited?: boolean;
  lastEditedAt?: string;
  lastEditedBy?: User;
  totalEdits?: number;
  editHistory?: ResponseEditHistory[];
}
```

- [ ] Save the file
- [ ] Run `pnpm --filter @dculus/types build` to compile types
- [ ] Verify build succeeded (check terminal output)
- [ ] Check no TypeScript errors in the file

---

### 1.3 GraphQL Schema Updates

**File:** `apps/backend/src/graphql/schema.ts`

- [ ] Locate the `Response` type definition (should be around line 150-170)
- [ ] Add `metadata: JSON` field to Response type:

```graphql
type Response {
  id: ID!
  formId: ID!
  data: JSON!
  metadata: JSON  # NEW: Add this line
  submittedAt: DateTime!
  hasBeenEdited: Boolean
  totalEdits: Int
  lastEditedAt: DateTime
  lastEditedBy: User
  editHistory: [ResponseEditHistory!]
  form: Form!
}
```

- [ ] Save the file
- [ ] Restart backend server to reload schema
- [ ] Check GraphQL playground (`http://localhost:4000/graphql`)
- [ ] Verify metadata field shows in Response type documentation

---

## Phase 2: Backend Plugin Implementation

### 2.1 Create Plugin Types File

**File:** `apps/backend/src/plugins/quiz/types.ts` (NEW)

- [ ] Create directory: `apps/backend/src/plugins/quiz/`
- [ ] Create file: `types.ts`
- [ ] Add the following content:

```typescript
import type { PluginConfig } from '../types.js';

// Quiz field configuration (per field)
export interface QuizFieldConfig {
  fieldId: string;          // Form field ID
  correctAnswer: string;    // The correct option value
  marks: number;            // Points for this question
}

// Main plugin configuration
export interface QuizGradingPluginConfig extends PluginConfig {
  type: 'quiz-grading';
  quizFields: QuizFieldConfig[];  // Array of quiz field configurations
  passThreshold: number;          // Pass percentage (default: 60)
}

export const QUIZ_GRADING_PLUGIN_TYPE = 'quiz-grading' as const;
export const QUIZ_GRADING_METADATA_KEY = 'quiz-grading' as const;

export type ValidatedQuizGradingConfig = QuizGradingPluginConfig;

// Result returned by plugin handler
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

- [ ] Save the file
- [ ] Verify no TypeScript errors

---

### 2.2 Create Plugin Handler File

**File:** `apps/backend/src/plugins/quiz/handler.ts` (NEW)

- [ ] Create file: `handler.ts`
- [ ] Add imports:

```typescript
import type { PluginHandler } from '../types.js';
import type {
  QuizGradingPluginConfig,
  QuizFieldConfig,
  QuizGradingResult,
} from './types.js';
import { QUIZ_GRADING_METADATA_KEY } from './types.js';
import { deserializeFormSchema } from '@dculus/types';
import { createFieldLabelsMap } from '@dculus/utils';
```

- [ ] Implement the `gradeQuizResponse` helper function:

```typescript
/**
 * Grade quiz response based on configuration
 */
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

- [ ] Implement the main handler:

```typescript
/**
 * Quiz Grading Plugin Handler
 * Automatically grades quiz responses and stores results in response metadata
 */
export const quizGradingHandler: PluginHandler = async (plugin, event, context) => {
  const config = plugin.config as QuizGradingPluginConfig;

  context.logger.info('Quiz grading plugin triggered', {
    eventType: event.type,
    formId: event.formId,
    quizFieldCount: config.quizFields.length,
  });

  try {
    // 1. Validate event has response ID
    if (!event.data.responseId) {
      throw new Error('No response ID in event data');
    }

    // 2. Get response data
    const response = await context.getResponseById(event.data.responseId);
    if (!response) {
      throw new Error(`Response not found: ${event.data.responseId}`);
    }

    // 3. Get form schema for field labels
    const form = await context.getFormById(event.formId);
    if (!form) {
      throw new Error(`Form not found: ${event.formId}`);
    }

    // 4. Grade the quiz
    const formSchema = deserializeFormSchema(form.formSchema);
    const fieldLabelsMap = createFieldLabelsMap(formSchema);
    const quizMetadata = gradeQuizResponse(
      config.quizFields,
      response.data,
      fieldLabelsMap
    );

    // 5. Update response metadata with quiz results
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

    // 6. Return result
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

- [ ] Save the file
- [ ] Verify no TypeScript errors

---

### 2.3 Create Plugin Registration File

**File:** `apps/backend/src/plugins/quiz/index.ts` (NEW)

- [ ] Create file: `index.ts`
- [ ] Add content:

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

- [ ] Save the file

---

### 2.4 Register Plugin in System

**File:** `apps/backend/src/plugins/index.ts`

- [ ] Add import at top of file:

```typescript
import { registerQuizGradingPlugin } from './quiz/index.js';
```

- [ ] Add registration call in `initializePluginSystem()` function:

```typescript
export const initializePluginSystem = (): void => {
  registerWebhookPlugin();
  registerEmailPlugin();
  registerQuizGradingPlugin();  // NEW: Add this line
  initializePluginEvents();
};
```

- [ ] Save the file
- [ ] Restart backend server
- [ ] Check server logs for "Quiz grading plugin registered" or similar message
- [ ] Verify no errors in console

---

## Phase 3: Frontend Plugin Configuration UI

### 3.1 Create Quiz Plugin Configuration Component

**File:** `apps/form-app/src/components/plugin-config/QuizGradingPluginConfig.tsx` (NEW)

**Due to length, see the complete component code in QUIZ_GRADING_PLUGIN.md or follow these steps:**

- [ ] Create directory if needed: `apps/form-app/src/components/plugin-config/`
- [ ] Create file: `QuizGradingPluginConfig.tsx`
- [ ] Add imports for UI components, hooks, and types
- [ ] Define TypeScript interfaces for props and quiz field config
- [ ] Implement `extractSelectionFields()` helper function
- [ ] Implement main component with:
  - [ ] Form state management (`useForm` hook)
  - [ ] Quiz fields state (`useState` for quiz field configs)
  - [ ] Selection fields extraction (`useMemo` for form schema parsing)
  - [ ] `toggleQuizField()` function
  - [ ] `updateCorrectAnswer()` function
  - [ ] `updateMarks()` function
  - [ ] `onSubmit()` with validation
- [ ] Render UI cards:
  - [ ] Header card with icon and description
  - [ ] Basic settings card (name, pass threshold)
  - [ ] Quiz questions card with field selector
  - [ ] Action buttons (cancel, save)
- [ ] Export component
- [ ] Save file
- [ ] Run `pnpm --filter form-app type-check` to verify TypeScript
- [ ] Fix any type errors

---

### 3.2 Update Plugin Gallery

**File:** `apps/form-app/src/components/plugins/PluginGallery.tsx`

- [ ] Import `GraduationCap` icon from lucide-react:

```typescript
import { Mail, Webhook, MessageSquare, GraduationCap } from 'lucide-react';
```

- [ ] Locate `AVAILABLE_PLUGIN_TYPES` array
- [ ] Add quiz grading plugin entry:

```typescript
{
  id: 'quiz-grading',
  name: 'Quiz Auto-Grading',
  description: 'Automatically grade quiz responses with correct answers and scoring',
  icon: GraduationCap,
  category: 'workflow',
  available: true,
  comingSoon: false,
},
```

- [ ] Save file
- [ ] Verify no TypeScript errors

---

### 3.3 Update Plugin Configuration Router

**File:** `apps/form-app/src/pages/PluginConfiguration.tsx`

- [ ] Import QuizGradingPluginConfig at top of file:

```typescript
import { QuizGradingPluginConfig } from '../components/plugin-config/QuizGradingPluginConfig';
```

- [ ] Locate the `renderConfigComponent()` function or switch statement
- [ ] Add case for quiz-grading (around line 150-200):

```typescript
case 'quiz-grading':
  return (
    <QuizGradingPluginConfig
      form={form}
      initialData={plugin}
      mode={isEditMode ? 'edit' : 'create'}
      isSaving={isSaving}
      onSave={handleSavePlugin}
      onCancel={() => navigate(`/forms/${formId}/plugins`)}
    />
  );
```

- [ ] Save file
- [ ] Verify no TypeScript errors

---

## Phase 4: Frontend Metadata Viewer

### 4.1 Create Quiz Metadata Viewer Component

**File:** `apps/form-app/src/components/response-metadata/QuizGradingMetadataViewer.tsx` (NEW)

- [ ] Create directory: `apps/form-app/src/components/response-metadata/`
- [ ] Create file: `QuizGradingMetadataViewer.tsx`
- [ ] Add imports
- [ ] Define props interface
- [ ] Implement component with:
  - [ ] Calculate passed status
  - [ ] Render Card with header
  - [ ] Render score summary section (score, percentage, progress bar, badge)
  - [ ] Render answer breakdown section (map over fieldResults)
  - [ ] Show checkmark/X icon per result
  - [ ] Show correct answer if user was wrong
- [ ] Export component
- [ ] Save file
- [ ] Verify no TypeScript errors

**Sample component structure:**

```typescript
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Badge, Progress } from '@dculus/ui';
import { CheckCircle2, XCircle, Award } from 'lucide-react';

interface QuizGradingMetadataViewerProps {
  metadata: {
    quizScore: number;
    totalMarks: number;
    percentage: number;
    fieldResults: Array<{
      fieldId: string;
      fieldLabel: string;
      userAnswer: string;
      correctAnswer: string;
      isCorrect: boolean;
      marksAwarded: number;
      maxMarks: number;
    }>;
    gradedAt: string;
    gradedBy: string;
  };
}

export const QuizGradingMetadataViewer: React.FC<QuizGradingMetadataViewerProps> = ({ metadata }) => {
  const passed = metadata.percentage >= 60;

  return (
    <Card>
      {/* Implementation - see QUIZ_GRADING_PLUGIN.md */}
    </Card>
  );
};
```

---

### 4.2 Create Metadata Viewer Registry

**File:** `apps/form-app/src/components/response-metadata/MetadataViewerRegistry.tsx` (NEW)

- [ ] Create file: `MetadataViewerRegistry.tsx`
- [ ] Import QuizGradingMetadataViewer
- [ ] Create METADATA_VIEWERS registry object
- [ ] Map 'quiz-grading' to QuizGradingMetadataViewer
- [ ] Implement MetadataViewer component:
  - [ ] Check if metadata exists
  - [ ] Map over metadata entries
  - [ ] Get viewer component for each plugin type
  - [ ] Render viewer or fallback
- [ ] Export MetadataViewer
- [ ] Save file

**Sample implementation:**

```typescript
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@dculus/ui';
import { QuizGradingMetadataViewer } from './QuizGradingMetadataViewer';

const METADATA_VIEWERS: Record<string, React.ComponentType<any>> = {
  'quiz-grading': QuizGradingMetadataViewer,
};

interface MetadataViewerProps {
  metadata: Record<string, any>;
}

export const MetadataViewer: React.FC<MetadataViewerProps> = ({ metadata }) => {
  if (!metadata || Object.keys(metadata).length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {Object.entries(metadata).map(([pluginType, pluginMetadata]) => {
        const ViewerComponent = METADATA_VIEWERS[pluginType];

        if (!ViewerComponent) {
          // Fallback for unknown plugin types
          return (
            <Card key={pluginType}>
              <CardHeader>
                <CardTitle>Plugin Metadata: {pluginType}</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-gray-100 p-3 rounded overflow-auto">
                  {JSON.stringify(pluginMetadata, null, 2)}
                </pre>
              </CardContent>
            </Card>
          );
        }

        return <ViewerComponent key={pluginType} metadata={pluginMetadata} />;
      })}
    </div>
  );
};
```

---

### 4.3 Update Responses Table

**File:** `apps/form-app/src/pages/Responses.tsx`

- [ ] Import Badge component if not already imported
- [ ] Locate the columns array definition
- [ ] Add quiz score column after existing columns:

```typescript
{
  accessorKey: 'metadata',
  header: 'Quiz Score',
  cell: ({ row }) => {
    const metadata = row.original.metadata;

    // Check if quiz-grading metadata exists
    if (metadata && metadata['quiz-grading']) {
      const quiz = metadata['quiz-grading'];
      const passed = quiz.percentage >= 60;

      return (
        <div className="flex items-center gap-2">
          <Badge variant={passed ? 'success' : 'destructive'}>
            {quiz.quizScore} / {quiz.totalMarks}
          </Badge>
          <span className="text-sm text-muted-foreground">
            ({quiz.percentage.toFixed(0)}%)
          </span>
        </div>
      );
    }

    return <span className="text-muted-foreground">-</span>;
  },
}
```

- [ ] Save file
- [ ] Verify no TypeScript errors
- [ ] Test in browser (column should appear if metadata exists)

---

### 4.4 Update Individual Response Viewer

**File:** `apps/form-app/src/pages/ResponsesIndividual.tsx`

- [ ] Import MetadataViewer at top:

```typescript
import { MetadataViewer } from '../components/response-metadata/MetadataViewerRegistry';
```

- [ ] Locate the component render section
- [ ] Add MetadataViewer after response data card:

```typescript
{/* Response Data */}
<ResponseDataCard response={response} />

{/* Plugin Metadata (dynamically rendered) */}
{response.metadata && (
  <MetadataViewer metadata={response.metadata} />
)}
```

- [ ] Save file
- [ ] Verify no TypeScript errors

---

### 4.5 Update GraphQL Queries

**File:** `apps/form-app/src/graphql/queries/responses.ts`

- [ ] Locate the `ResponseFields` fragment
- [ ] Add `metadata` field:

```graphql
fragment ResponseFields on Response {
  id
  formId
  data
  metadata  # NEW: Add this line
  submittedAt
  hasBeenEdited
  totalEdits
  lastEditedAt
  lastEditedBy {
    id
    name
    email
  }
}
```

- [ ] Save file
- [ ] Verify all queries using this fragment include metadata

---

## Phase 5: Testing

### 5.1 Manual Testing

- [ ] Start dev server: `pnpm dev`
- [ ] Wait for all services to start (backend, form-app, form-viewer)
- [ ] Open browser to http://localhost:3000

**Create Test Form:**
- [ ] Create new form
- [ ] Add at least 2 dropdown or radio fields with options:
  - Example: "What is 2+2?" with options [2, 3, 4, 5]
  - Example: "Capital of France?" with options [London, Paris, Berlin]
- [ ] Publish form

**Install Quiz Plugin:**
- [ ] Navigate to Forms → [Your Form] → Plugins
- [ ] Click "Add Plugin"
- [ ] Select "Quiz Auto-Grading"
- [ ] Verify configuration page loads

**Configure Quiz:**
- [ ] Enter plugin name: "Test Quiz Grading"
- [ ] Set pass threshold: 60
- [ ] Check both fields to include in quiz
- [ ] For first field: Select correct answer, set marks to 1
- [ ] For second field: Select correct answer, set marks to 2
- [ ] Click "Create Plugin"
- [ ] Verify success toast
- [ ] Verify plugin appears in plugins list
- [ ] Verify plugin is enabled

**Submit Test Response (All Correct):**
- [ ] Open form in viewer
- [ ] Fill out form with correct answers
- [ ] Submit form
- [ ] Go to Responses page
- [ ] Verify score column shows: "3 / 3 (100%)" with green badge
- [ ] Click to view response details
- [ ] Verify QuizGradingMetadataViewer renders
- [ ] Verify shows "PASSED" badge
- [ ] Verify shows 100% percentage
- [ ] Verify all questions show green checkmarks

**Submit Test Response (All Incorrect):**
- [ ] Open form in viewer again
- [ ] Fill out form with wrong answers
- [ ] Submit form
- [ ] Go to Responses page
- [ ] Verify score column shows: "0 / 3 (0%)" with red badge
- [ ] Click to view response details
- [ ] Verify shows "FAILED" badge
- [ ] Verify shows 0% percentage
- [ ] Verify all questions show red X marks
- [ ] Verify correct answers are shown

**Submit Test Response (Mixed):**
- [ ] Open form in viewer again
- [ ] Fill out with 1 correct and 1 incorrect answer
- [ ] Submit form
- [ ] Go to Responses page
- [ ] Verify score column shows correct partial score
- [ ] Click to view response details
- [ ] Verify mixed checkmarks and X marks

**Test Edge Cases:**
- [ ] Submit response with no answers (all blank)
- [ ] Verify grading handles empty values
- [ ] Test with form containing no selection fields
- [ ] Verify appropriate error/warning

**Test Plugin Management:**
- [ ] Edit plugin configuration
- [ ] Change correct answers
- [ ] Save changes
- [ ] Submit new response and verify new grading
- [ ] Disable plugin
- [ ] Submit response and verify no grading
- [ ] Re-enable plugin
- [ ] Test plugin (click Test button)
- [ ] Check PluginDelivery log
- [ ] Delete plugin
- [ ] Verify deletion

---

### 5.2 Database Verification

- [ ] Open Prisma Studio: `pnpm db:studio`
- [ ] Navigate to Response model
- [ ] Find a graded response
- [ ] Click to view details
- [ ] Verify `metadata` field contains:
  - `quiz-grading` key
  - `quizScore`, `totalMarks`, `percentage` values
  - `fieldResults` array
  - `gradedAt` timestamp
  - `gradedBy` = "plugin"

**Check PluginDelivery table:**
- [ ] Navigate to PluginDelivery model
- [ ] Find entries for quiz-grading plugin
- [ ] Verify `status` = "success"
- [ ] Check `payload` contains event data
- [ ] Check `response` contains grading result
- [ ] Verify `deliveredAt` timestamp

---

### 5.3 Integration Tests (Optional)

**File:** `test/integration/features/quiz-grading.feature` (NEW)

- [ ] Create feature file with test scenarios
- [ ] Create step definitions file
- [ ] Implement step definitions
- [ ] Run tests: `pnpm test:integration`
- [ ] Verify all scenarios pass

**Test Scenarios:**
- [ ] Create quiz grading plugin
- [ ] Submit response with all correct answers
- [ ] Submit response with all incorrect answers
- [ ] Submit response with mixed answers
- [ ] Verify metadata storage
- [ ] Test pass/fail threshold
- [ ] Test plugin enable/disable
- [ ] Test plugin deletion

---

## Phase 6: Code Quality & Documentation

### 6.1 Code Review

- [ ] Review all new/modified files for:
  - [ ] Consistent code style
  - [ ] Proper TypeScript types
  - [ ] JSDoc comments on functions
  - [ ] Error handling with try/catch
  - [ ] Logging with context.logger
  - [ ] Proper imports (no unused)
  - [ ] No console.log statements (use logger)

**Run Quality Checks:**
- [ ] Run linter: `pnpm lint`
- [ ] Fix any lint errors
- [ ] Run type check: `pnpm type-check`
- [ ] Fix any type errors
- [ ] Run build: `pnpm build`
- [ ] Verify build succeeds for all packages

---

### 6.2 Documentation Updates

- [ ] Verify QUIZ_GRADING_PLUGIN.md is complete
- [ ] Verify PLUGIN_SYSTEM.md includes metadata section
- [ ] Verify CLAUDE.md includes quiz plugin section
- [ ] Update README.md if needed (mention quiz plugin)
- [ ] Add inline code comments where complex logic exists
- [ ] Update any affected API documentation

---

### 6.3 Git Commit

**Only if everything above is complete and tested:**

- [ ] Stage all changes: `git add .`
- [ ] Review changes: `git status`
- [ ] Create commit with descriptive message:
  ```bash
  git commit -m "feat: Add quiz auto-grading plugin with metadata system

  - Add generic plugin metadata system (Response.metadata)
  - Implement quiz grading plugin (quiz-grading)
  - Plugin config UI with field selector
  - Quiz results viewer with pass/fail display
  - Dynamic metadata viewer registry
  - Score column in responses table
  - Complete documentation

  Closes #XXX"
  ```
- [ ] Push to remote: `git push`

---

## Success Criteria Checklist

### ✅ Core Functionality
- [ ] Generic metadata system working (any plugin can store data)
- [ ] Quiz grading plugin installable from plugin gallery
- [ ] Plugin configuration UI functional and validates input
- [ ] Correct answers and marks configurable per field
- [ ] Auto-grading executes on form submission
- [ ] Quiz results stored in Response.metadata['quiz-grading']
- [ ] Grading logged in PluginDelivery table

### ✅ User Interface
- [ ] Quiz score column displays in responses table
- [ ] Score badges color-coded (green for pass, red for fail)
- [ ] QuizGradingMetadataViewer renders detailed results
- [ ] Pass/fail badge displayed prominently
- [ ] Per-question breakdown shows correct/incorrect
- [ ] Correct answers shown when user is wrong
- [ ] Progress bar reflects percentage

### ✅ Technical Quality
- [ ] No TypeScript errors
- [ ] No lint errors
- [ ] All imports working correctly
- [ ] Database migration applied successfully
- [ ] Backend server starts without errors
- [ ] Plugin registered in system
- [ ] All packages build successfully

### ✅ Testing
- [ ] Manual testing complete (all scenarios)
- [ ] Edge cases tested (no answers, no fields, etc.)
- [ ] Plugin management tested (edit, disable, delete, test)
- [ ] Database verification complete
- [ ] Integration tests passing (if implemented)

### ✅ Documentation
- [ ] QUIZ_GRADING_PLUGIN.md complete
- [ ] PLUGIN_SYSTEM.md updated
- [ ] CLAUDE.md updated
- [ ] Code comments added
- [ ] README updated if needed

---

## Troubleshooting Common Issues

### Issue: "Cannot find module '@dculus/types'"
**Solution:**
- Run `pnpm build` in root directory
- Run `pnpm --filter @dculus/types build`
- Restart TypeScript server in IDE

### Issue: "Metadata field not found in database"
**Solution:**
- Verify `pnpm db:push` completed successfully
- Check Prisma Studio to confirm metadata field exists
- Try `pnpm db:generate` again

### Issue: "Plugin not appearing in gallery"
**Solution:**
- Check `AVAILABLE_PLUGIN_TYPES` array includes quiz-grading
- Verify `available: true` and `comingSoon: false`
- Clear browser cache and reload

### Issue: "Plugin not grading responses"
**Solution:**
- Check plugin is enabled in FormPlugin table
- Verify `events` includes 'form.submitted'
- Check PluginDelivery table for error messages
- Check backend server logs for plugin execution
- Verify `registerQuizGradingPlugin()` called in plugins/index.ts

### Issue: "Metadata not displaying in UI"
**Solution:**
- Verify GraphQL query includes `metadata` field
- Check MetadataViewerRegistry includes 'quiz-grading'
- Verify metadata exists in database for that response
- Check browser console for rendering errors

### Issue: "TypeScript errors in handler.ts"
**Solution:**
- Verify all imports are correct (.js extension for local files)
- Run `pnpm --filter @dculus/types build`
- Check PluginContext types match usage
- Restart TypeScript server

---

## Next Steps After Implementation

1. **User Testing**
   - Get feedback from real users
   - Identify usability improvements
   - Test with different quiz scenarios

2. **Performance Optimization**
   - Monitor plugin execution time
   - Optimize grading algorithm if needed
   - Add caching if appropriate

3. **Future Enhancements**
   - Add partial credit scoring
   - Implement multiple correct answers
   - Add case-insensitive matching
   - Create quiz analytics dashboard
   - Add email notifications
   - Implement manual grade override

4. **Documentation**
   - Create user guide for form creators
   - Add video tutorial
   - Update help documentation

---

**Congratulations!** 🎉

If you've completed all checkboxes above, you have successfully implemented the Quiz Auto-Grading Plugin with a generic metadata system that's extensible for future plugins!

---

**Last Updated:** 2025-01-19
**Version:** 1.0
**Status:** Ready for Implementation
