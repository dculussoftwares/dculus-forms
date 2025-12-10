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

/**
 * Helper function to create form schema for filter testing
 * Contains Short Text, Number, and Date fields for filter tests
 */
export function createFilterTestFormSchema() {
  return {
    layout: {
      theme: "light",
      textColor: "#000000",
      spacing: "normal",
      code: "L9",
      content: "<h1>Filter Test Form</h1>",
      customBackGroundColor: "#ffffff",
      backgroundImageKey: "",
      pageMode: "single",
      isCustomBackgroundColorEnabled: false
    },
    pages: [
      {
        id: "page-1",
        title: "Filter Test Fields",
        fields: [
          {
            id: "field-text-filter",
            type: "text_input_field",
            label: "Text Field",
            defaultValue: "",
            prefix: "",
            hint: "Enter text for filter testing",
            placeholder: "Enter text",
            validation: {
              required: false,
              type: "text_field_validation"
            }
          },
          {
            id: "field-number-filter",
            type: "number_field",
            label: "Number Field",
            defaultValue: "",
            prefix: "",
            hint: "Enter number for filter testing",
            placeholder: "Enter number",
            validation: {
              required: false,
              type: "fillable_form_field"
            }
          },
          {
            id: "field-date-filter",
            type: "date_field",
            label: "Date Field",
            defaultValue: "",
            prefix: "",
            hint: "Select date for filter testing",
            placeholder: "Select date",
            validation: {
              required: false,
              type: "fillable_form_field"
            }
          },
          {
            id: "field-dropdown-filter",
            type: "select_field",
            label: "Dropdown Field",
            defaultValue: "",
            prefix: "",
            hint: "Select option for filter testing",
            placeholder: "Select option",
            options: ["Red", "Green", "Blue"],
            validation: {
              required: false,
              type: "fillable_form_field"
            }
          },
          {
            id: "field-checkbox-filter",
            type: "checkbox_field",
            label: "Checkbox Field",
            defaultValues: [],
            prefix: "",
            hint: "Select options for filter testing",
            placeholder: "",
            options: ["Apple", "Banana", "Cherry"],
            validation: {
              required: false,
              type: "checkbox_field_validation"
            }
          },
          {
            id: "field-radio-filter",
            type: "radio_field",
            label: "Radio Field",
            defaultValue: "",
            prefix: "",
            hint: "Select option for filter testing",
            options: ["Yes", "No", "Maybe"],
            validation: {
              required: false,
              type: "fillable_form_field"
            }
          },
          {
            id: "field-email-filter",
            type: "email_field",
            label: "Email Field",
            defaultValue: "",
            prefix: "",
            hint: "Enter email for filter testing",
            placeholder: "email@example.com",
            validation: {
              required: false,
              type: "text_field_validation",
              minLength: 0,
              maxLength: 5000
            }
          },
          {
            id: "field-longtext-filter",
            type: "text_area_field",
            label: "Long Text Field",
            defaultValue: "",
            prefix: "",
            hint: "Enter long text for filter testing",
            placeholder: "Enter your text...",
            validation: {
              required: false,
              type: "text_field_validation",
              minLength: 0,
              maxLength: 5000
            }
          }
        ]
      }
    ]
  };
}

/**
 * Create comprehensive form schema for mass response testing
 * Contains 9 fields across 3 pages with variety for data generation
 */
export function createMassResponseTestFormSchema() {
  return {
    layout: {
      theme: "light",
      textColor: "#000000",
      spacing: "normal",
      code: "L9",
      content: "<h1>Mass Response Test Form</h1><p>Testing form with 120+ varied responses</p>",
      customBackGroundColor: "#ffffff",
      backgroundImageKey: "",
      pageMode: "multipage",
      isCustomBackgroundColorEnabled: false
    },
    pages: [
      {
        id: "page-1",
        title: "Personal Information",
        fields: [
          {
            id: "field-name",
            type: "text_input_field",
            label: "Full Name",
            defaultValue: "",
            prefix: "",
            hint: "Enter your full name",
            placeholder: "John Doe",
            validation: {
              required: true,
              type: "text_field_validation"
            }
          },
          {
            id: "field-email",
            type: "email_field",
            label: "Email Address",
            defaultValue: "",
            prefix: "",
            hint: "Enter your email address",
            placeholder: "email@example.com",
            validation: {
              required: true,
              type: "text_field_validation"
            }
          },
          {
            id: "field-birth-date",
            type: "date_field",
            label: "Date of Birth",
            defaultValue: "",
            prefix: "",
            hint: "Select your birth date",
            placeholder: "Select date",
            validation: {
              required: true,
              type: "fillable_form_field"
            }
          }
        ]
      },
      {
        id: "page-2",
        title: "Preferences",
        fields: [
          {
            id: "field-favorite-color",
            type: "select_field",
            label: "Favorite Color",
            defaultValue: "",
            prefix: "",
            hint: "Select your favorite color",
            validation: {
              required: true,
              type: "fillable_form_field"
            },
            options: ["Red", "Blue", "Green", "Yellow", "Purple"]
          },
          {
            id: "field-experience-level",
            type: "radio_field",
            label: "Experience Level",
            defaultValue: "",
            prefix: "",
            hint: "Select your experience level",
            validation: {
              required: true,
              type: "fillable_form_field"
            },
            options: ["Beginner", "Intermediate", "Advanced", "Expert"]
          },
          {
            id: "field-years",
            type: "number_field",
            label: "Years of Experience",
            defaultValue: "",
            prefix: "",
            hint: "Enter years of experience (0-50)",
            placeholder: "0",
            min: 0,
            max: 50,
            validation: {
              required: true,
              type: "fillable_form_field"
            }
          }
        ]
      },
      {
        id: "page-3",
        title: "Feedback",
        fields: [
          {
            id: "field-interests",
            type: "checkbox_field",
            label: "Areas of Interest",
            defaultValues: [],
            prefix: "",
            hint: "Select all that apply",
            placeholder: "",
            validation: {
              required: true,
              type: "checkbox_field_validation",
              minSelections: 1,
              maxSelections: 6
            },
            options: ["Technology", "Sports", "Music", "Art", "Travel", "Food"]
          },
          {
            id: "field-comments",
            type: "text_area_field",
            label: "Additional Comments",
            defaultValue: "",
            prefix: "",
            hint: "Share your thoughts",
            placeholder: "Enter your comments here...",
            validation: {
              required: true,
              type: "text_field_validation"
            }
          },
          {
            id: "field-satisfaction",
            type: "radio_field",
            label: "Overall Satisfaction",
            defaultValue: "",
            prefix: "",
            hint: "Rate your experience",
            validation: {
              required: true,
              type: "fillable_form_field"
            },
            options: ["Very Dissatisfied", "Dissatisfied", "Neutral", "Satisfied", "Very Satisfied"]
          }
        ]
      }
    ]
  };
}

