/**
 * Form schema templates for E2E tests
 */

/**
 * Helper function to create form schema with all field types
 */
export function createFormSchemaWithAllFields() {
  return {
    layout: {
      theme: "light",
      textColor: "#000000",
      spacing: "normal",
      code: "L9",
      content: "<h1>Test Form</h1>",
      customBackGroundColor: "#ffffff",
      backgroundImageKey: "",
      pageMode: "multipage",
      isCustomBackgroundColorEnabled: false
    },
    pages: [
      {
        id: "page-1",
        title: "Text Fields",
        fields: [
          {
            id: "field-short-text",
            type: "text_input_field",
            label: "Short Text Field",
            defaultValue: "",
            prefix: "",
            hint: "",
            placeholder: "Enter short text",
            validation: {
              required: false,
              type: "text_field_validation"
            }
          },
          {
            id: "field-long-text",
            type: "text_area_field",
            label: "Long Text Field",
            defaultValue: "",
            prefix: "",
            hint: "",
            placeholder: "Enter long text",
            validation: {
              required: false,
              type: "text_field_validation"
            }
          }
        ]
      },
      {
        id: "page-2",
        title: "Input Fields",
        fields: [
          {
            id: "field-email",
            type: "email_field",
            label: "Email Field",
            defaultValue: "",
            prefix: "",
            hint: "",
            placeholder: "Enter email",
            validation: {
              required: false,
              type: "fillable_form_field"
            }
          },
          {
            id: "field-number",
            type: "number_field",
            label: "Number Field",
            defaultValue: "",
            prefix: "",
            hint: "",
            placeholder: "Enter number",
            validation: {
              required: false,
              type: "fillable_form_field"
            }
          },
          {
            id: "field-date",
            type: "date_field",
            label: "Date Field",
            defaultValue: "",
            prefix: "",
            hint: "",
            placeholder: "Select date",
            validation: {
              required: false,
              type: "fillable_form_field"
            }
          }
        ]
      },
      {
        id: "page-3",
        title: "Selection Fields",
        fields: [
          {
            id: "field-dropdown",
            type: "select_field",
            label: "Dropdown Field",
            defaultValue: "",
            prefix: "",
            hint: "",
            validation: {
              required: false,
              type: "fillable_form_field"
            },
            options: ["Option 1", "Option 2", "Option 3"]
          },
          {
            id: "field-radio",
            type: "radio_field",
            label: "Radio Field",
            defaultValue: "",
            prefix: "",
            hint: "",
            validation: {
              required: false,
              type: "fillable_form_field"
            },
            options: ["Choice 1", "Choice 2", "Choice 3"]
          },
          {
            id: "field-checkbox",
            type: "checkbox_field",
            label: "Checkbox Field",
            defaultValues: [],
            prefix: "",
            hint: "",
            placeholder: "",
            validation: {
              required: false,
              type: "checkbox_field_validation"
            },
            options: ["Item 1", "Item 2", "Item 3"]
          }
        ]
      }
    ]
  };
}
