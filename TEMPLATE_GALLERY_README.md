# Form Template Gallery

This document describes the Form Template Gallery implementation for the dculus-forms backend.

## Overview

The Form Template Gallery allows users to create, store, and reuse form templates. Templates contain only the FormSchema and a templateId - no tracking of who created them, making them globally accessible.

## Database Schema

### FormTemplate Model

```prisma
model FormTemplate {
  id         String   @id @map("_id")
  name       String
  description String?
  category   String?
  formSchema Json
  isActive   Boolean  @default(true)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@map("form_template")
}
```

## API Endpoints

### REST API

All REST endpoints are available under `/api/templates`:

- `GET /api/templates` - Get all active templates (optional query: `?category=CategoryName`)
- `GET /api/templates/categories` - Get all template categories
- `GET /api/templates/by-category` - Get templates grouped by category
- `GET /api/templates/:id` - Get a specific template by ID
- `POST /api/templates` - Create a new template
- `PUT /api/templates/:id` - Update a template
- `DELETE /api/templates/:id` - Soft delete a template (sets isActive: false)

### GraphQL API

Available at `/graphql`:

#### Queries

```graphql
# Get all templates (optionally filtered by category)
query GetTemplates($category: String) {
  templates(category: $category) {
    id
    name
    description
    category
    formSchema {
      pages {
        id
        title
        order
        fields {
          id
          type
          label
          required
          placeholder
          options
        }
      }
      layout {
        theme
        primaryColor
        backgroundColor
        textColor
        spacing
      }
      isShuffleEnabled
    }
    isActive
    createdAt
    updatedAt
  }
}

# Get a specific template
query GetTemplate($id: ID!) {
  template(id: $id) {
    id
    name
    description
    category
    formSchema {
      # ... same as above
    }
    isActive
    createdAt
    updatedAt
  }
}

# Get templates grouped by category
query GetTemplatesByCategory {
  templatesByCategory {
    category
    templates {
      id
      name
      description
      formSchema {
        # ... same as above
      }
    }
  }
}

# Get all template categories
query GetTemplateCategories {
  templateCategories
}
```

#### Mutations

```graphql
# Create a new template
mutation CreateTemplate($input: CreateTemplateInput!) {
  createTemplate(input: $input) {
    id
    name
    description
    category
    formSchema {
      # ... FormSchema structure
    }
    isActive
    createdAt
    updatedAt
  }
}

# Update a template
mutation UpdateTemplate($id: ID!, $input: UpdateTemplateInput!) {
  updateTemplate(id: $id, input: $input) {
    id
    name
    description
    category
    formSchema {
      # ... FormSchema structure
    }
    isActive
    createdAt
    updatedAt
  }
}

# Delete a template (soft delete)
mutation DeleteTemplate($id: ID!) {
  deleteTemplate(id: $id)
}

# Create a form from a template
mutation CreateFormFromTemplate($templateId: ID!, $organizationId: ID!, $title: String!) {
  createFormFromTemplate(templateId: $templateId, organizationId: $organizationId, title: $title) {
    id
    title
    description
    formSchema {
      # ... FormSchema structure
    }
    isPublished
    createdAt
    updatedAt
  }
}
```

## Sample Templates

The system comes pre-seeded with the following templates:

### 1. Contact Form (Business Category)
- Name, Email, Phone, Message fields
- Simple single-page form
- Blue color scheme

### 2. Event Registration (Events Category)
- Two-page form with personal info and event details
- Select, checkbox, and text fields
- Green color scheme

### 3. Customer Feedback (Feedback Category)
- Rating fields and comment section
- Radio buttons for ratings
- Orange color scheme

### 4. Survey Form (Research Category)
- Demographics and survey questions
- Multiple field types including checkboxes
- Purple color scheme

## Service Functions

The `templateService.ts` provides the following functions:

- `getAllTemplates(category?: string)` - Get all active templates
- `getTemplateById(id: string)` - Get template by ID
- `createTemplate(data: CreateTemplateInput)` - Create new template
- `updateTemplate(id: string, data: UpdateTemplateInput)` - Update template
- `deleteTemplate(id: string)` - Soft delete template
- `getTemplatesByCategory()` - Get templates grouped by category
- `getTemplateCategories()` - Get all categories

## Usage Examples

### Creating a Form from a Template

1. **Get available templates:**
   ```bash
   curl -X GET "http://localhost:4000/api/templates"
   ```

2. **Select a template and create a form:**
   ```graphql
   mutation {
     createFormFromTemplate(
       templateId: "template-id-here"
       organizationId: "org-id-here"
       title: "My New Form"
     ) {
       id
       title
       formSchema {
         pages {
           fields {
             label
             type
           }
         }
       }
     }
   }
   ```

### Adding a New Template

```bash
curl -X POST "http://localhost:4000/api/templates" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Newsletter Signup",
    "description": "Simple newsletter subscription form",
    "category": "Marketing",
    "formSchema": {
      "pages": [{
        "id": "1",
        "title": "Subscribe",
        "order": 1,
        "fields": [{
          "id": "email",
          "type": "email",
          "label": "Email Address",
          "required": true,
          "placeholder": "Enter your email"
        }]
      }],
      "layout": {
        "theme": "light",
        "primaryColor": "#10b981",
        "backgroundColor": "#ffffff",
        "textColor": "#000000",
        "spacing": "normal"
      },
      "isShuffleEnabled": false
    }
  }'
```

## Features

✅ **Implemented:**
- Complete CRUD operations for templates
- REST and GraphQL APIs
- Category-based organization
- Template-to-form conversion
- Soft delete functionality
- Pre-seeded sample templates
- TypeScript type safety

✅ **Key Benefits:**
- No user tracking (templates are global)
- Reusable form schemas
- Category organization
- Both REST and GraphQL access
- Easy form creation from templates

## File Structure

```
apps/backend/src/
├── services/
│   ├── templateService.ts     # Template business logic
│   └── formService.ts         # Form service (updated to work with templates)
├── routes/
│   └── templates.ts           # REST API routes
├── graphql/
│   ├── schema.ts              # GraphQL schema (updated with template types)
│   └── resolvers/
│       └── templates.ts       # GraphQL resolvers
├── scripts/
│   ├── seed-templates.ts      # Template seeding script
│   └── seed.ts                # Main seed script (updated)
└── prisma/
    └── schema.prisma          # Database schema (updated)
```

## Testing

The implementation has been tested and verified:

1. ✅ Database schema migration successful
2. ✅ Template seeding working correctly
3. ✅ REST API endpoints functional
4. ✅ GraphQL endpoints accessible
5. ✅ Template creation and retrieval working
6. ✅ Category-based filtering operational
7. ✅ Form creation from templates functional

## Next Steps for Frontend Integration

1. Create template gallery UI component
2. Add template preview functionality
3. Implement template search and filtering
4. Add template category browsing
5. Integrate with form builder for template usage
