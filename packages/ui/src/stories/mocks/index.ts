import { 
  FormPage, 
  FormLayout, 
  TextInputField, 
  EmailField, 
  NumberField, 
  TextAreaField, 
  SelectField, 
  RadioField, 
  CheckboxField, 
  DateField,
  FillableFormFieldValidation,
  FieldType,
  ThemeType,
  SpacingType,
  PageModeType,
  deserializeFormField 
} from '@dculus/types';
import { generateId } from '@dculus/utils';

// Real form data structure
// Create comprehensive validation test form with all field types
export const createValidationTestPages = (): FormPage[] => {
  // Page 1: Text and Contact Fields
  const page1: FormPage = {
    id: 'validation-page-1',
    title: 'Personal Information',
    order: 0,
    fields: [
      new TextInputField(
        'firstName',
        'First Name',
        '',
        '',
        'Enter your first name',
        'John',
        new FillableFormFieldValidation(true)
      ),
      new TextInputField(
        'lastName', 
        'Last Name',
        '',
        '',
        'Enter your last name',
        'Doe',
        new FillableFormFieldValidation(true)
      ),
      new EmailField(
        'email',
        'Email Address',
        '',
        '📧',
        'We need this to contact you',
        'john.doe@example.com',
        new FillableFormFieldValidation(true)
      ),
      new TextAreaField(
        'bio',
        'Short Bio',
        '',
        '',
        'Tell us a bit about yourself (optional)',
        'Write something about yourself...',
        new FillableFormFieldValidation(false)
      )
    ]
  };

  // Page 2: Numeric and Date Fields
  const page2: FormPage = {
    id: 'validation-page-2',
    title: 'Details & Preferences',
    order: 1,
    fields: [
      new NumberField(
        'age',
        'Age',
        '',
        '',
        'Must be between 18 and 100',
        '25',
        new FillableFormFieldValidation(true),
        18,
        100
      ),
      new NumberField(
        'salary',
        'Annual Salary',
        '',
        '$',
        'Optional - for demographic purposes',
        '',
        new FillableFormFieldValidation(false),
        0,
        1000000
      ),
      new DateField(
        'birthday',
        'Date of Birth',
        '',
        '',
        'We use this to send birthday wishes',
        '',
        new FillableFormFieldValidation(true),
        '1920-01-01',
        '2010-12-31'
      ),
      new DateField(
        'availableDate',
        'Available Start Date',
        '',
        '',
        'When can you start? (optional)',
        '',
        new FillableFormFieldValidation(false)
      )
    ]
  };

  // Page 3: Selection Fields
  const page3: FormPage = {
    id: 'validation-page-3',
    title: 'Preferences & Choices',
    order: 2,
    fields: [
      new SelectField(
        'country',
        'Country',
        '',
        '',
        'Select your country of residence',
        'Select a country...',
        new FillableFormFieldValidation(true),
        ['United States', 'Canada', 'United Kingdom', 'Australia', 'Germany', 'France', 'Other'],
        false
      ),
      new SelectField(
        'languages',
        'Programming Languages',
        '',
        '',
        'Select all languages you know (optional)',
        'Choose languages...',
        new FillableFormFieldValidation(false),
        ['JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'Rust', 'Go'],
        true
      ),
      new RadioField(
        'experience',
        'Experience Level',
        '',
        '',
        'How would you describe your experience?',
        '',
        new FillableFormFieldValidation(true),
        ['Beginner (0-1 years)', 'Intermediate (2-5 years)', 'Senior (5-10 years)', 'Expert (10+ years)']
      ),
      new CheckboxField(
        'interests',
        'Areas of Interest',
        '',
        '',
        'Select all that apply',
        '',
        new FillableFormFieldValidation(true),
        ['Web Development', 'Mobile Development', 'Data Science', 'Machine Learning', 'DevOps', 'UI/UX Design']
      )
    ]
  };

  // Page 4: Mixed Validation Rules
  const page4: FormPage = {
    id: 'validation-page-4',
    title: 'Additional Information',
    order: 3,
    fields: [
      new TextInputField(
        'username',
        'Username',
        '',
        '@',
        'Must be unique - letters, numbers, and underscores only',
        'john_doe_123',
        new FillableFormFieldValidation(true)
      ),
      new TextAreaField(
        'message',
        'Message',
        '',
        '',
        'Tell us why you are interested (required)',
        'I am interested because...',
        new FillableFormFieldValidation(true)
      ),
      new RadioField(
        'newsletter',
        'Newsletter Subscription',
        '',
        '',
        'Would you like to receive our newsletter?',
        '',
        new FillableFormFieldValidation(true),
        ['Yes, send me updates', 'No, thanks']
      ),
      new CheckboxField(
        'agreements',
        'Legal Agreements',
        '',
        '',
        'Please accept our terms',
        '',
        new FillableFormFieldValidation(true),
        ['I agree to the Terms of Service', 'I agree to the Privacy Policy', 'I consent to marketing emails']
      )
    ]
  };

  return [page1, page2, page3, page4];
};

export const createRealFormPages = (): FormPage[] => {
  return [
    {
      id: "e0d827d5-7e27-4002-b709-691287a324c4",
      title: "Subscribe to Our Newsletter",
      order: 0,
      fields: [
        deserializeFormField({
          id: "978328f8-6797-4baa-8257-f9cc68b482cd",
          type: FieldType.TEXT_INPUT_FIELD,
          label: "First Name",
          defaultValue: "",
          prefix: "",
          hint: "",
          placeholder: "",
          validation: {
            required: true,
            type: "form_field"
          },
          __type: FieldType.TEXT_INPUT_FIELD
        }),
        deserializeFormField({
          id: "20e68bec-c6d2-4e82-8b8f-178f3effd1bb",
          type: FieldType.EMAIL_FIELD,
          label: "Email Address",
          defaultValue: "",
          prefix: "",
          hint: "We'll never share your email with anyone",
          placeholder: "",
          validation: {
            required: true,
            type: "form_field"
          },
          __type: FieldType.EMAIL_FIELD
        }),
        deserializeFormField({
          id: "a80fcfba-a9c5-4422-bf94-58181ca4e328",
          type: FieldType.CHECKBOX_FIELD,
          label: "Newsletter Topics",
          defaultValue: "",
          prefix: "",
          hint: "What topics interest you?",
          placeholder: "",
          validation: {
            required: false,
            type: "form_field"
          },
          options: [
            "Product Updates",
            "Industry News",
            "Tips & Tutorials",
            "Company News",
            "Special Offers"
          ],
          __type: FieldType.CHECKBOX_FIELD
        }),
        deserializeFormField({
          id: "ab1fb5b1-dad7-4af8-b3ab-39b01edf58ad",
          type: FieldType.RADIO_FIELD,
          label: "Email Frequency",
          defaultValue: "",
          prefix: "",
          hint: "How often would you like to hear from us?",
          placeholder: "",
          validation: {
            required: true,
            type: "form_field"
          },
          options: [
            "Weekly",
            "Bi-weekly",
            "Monthly",
            "Only major updates"
          ],
          __type: FieldType.RADIO_FIELD
        })
      ]
    },
    {
      id: "page-1755534484908-vg4u5hsvk",
      title: "New Page 2",
      order: 1,
      fields: [
        deserializeFormField({
          id: "field-1755534486892-zg4jm6924",
          type: FieldType.TEXT_AREA_FIELD,
          label: "Long Text",
          defaultValue: "",
          prefix: "",
          hint: "",
          placeholder: "Enter long text",
          validation: {
            required: false,
            type: "form_field"
          },
          __type: FieldType.TEXT_AREA_FIELD
        })
      ]
    }
  ];
};

// Mock validation objects
const requiredValidation: FillableFormFieldValidation = {
  required: true,
  type: FieldType.TEXT_INPUT_FIELD
};

const optionalValidation: FillableFormFieldValidation = {
  required: false,
  type: FieldType.TEXT_INPUT_FIELD
};

// Sample form fields
export const createSampleFields = () => [
  new TextInputField(
    generateId(),
    'Full Name',
    '',
    '',
    'Enter your first and last name',
    '',
    new FillableFormFieldValidation(true)
  ),
  
  new EmailField(
    generateId(),
    'Email Address',
    '',
    '',
    'We\'ll use this to contact you',
    '',
    new FillableFormFieldValidation(true)
  ),
  
  new NumberField(
    generateId(),
    'Age',
    '',
    '',
    '',
    '',
    new FillableFormFieldValidation(true),
    18,
    120
  ),
  
  new TextAreaField(
    generateId(),
    'Comments',
    '',
    '',
    'Any additional comments (optional)',
    '',
    new FillableFormFieldValidation(false)
  ),
  
  new SelectField(
    generateId(),
    'Department',
    '',
    '',
    '',
    '',
    new FillableFormFieldValidation(true),
    ['Engineering', 'Marketing', 'Sales', 'HR', 'Operations'],
    false
  ),
  
  new RadioField(
    generateId(),
    'Experience Level',
    '',
    '',
    '',
    '',
    new FillableFormFieldValidation(true),
    ['Junior', 'Mid-level', 'Senior', 'Lead']
  ),
  
  new CheckboxField(
    generateId(),
    'Skills',
    '',
    '',
    '',
    '',
    new FillableFormFieldValidation(false),
    ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'Go']
  ),
  
  new DateField(
    generateId(),
    'Start Date',
    '',
    '',
    '',
    '',
    new FillableFormFieldValidation(true),
    new Date().toISOString().split('T')[0]
  )
];

// Sample form pages
export const createSamplePages = (): FormPage[] => {
  return createRealFormPages();
};

// Single page sample
export const createSinglePage = (): FormPage[] => {
  return [
    {
      id: "e0d827d5-7e27-4002-b709-691287a324c4",
      title: "Subscribe to Our Newsletter",
      order: 0,
      fields: [
        ...createRealFormPages()[0].fields,
        ...createRealFormPages()[1].fields
      ]
    }
  ];
};

// Sample form layouts
export const sampleLayouts: Record<string, FormLayout> = {
  classic: {
    theme: ThemeType.LIGHT,
    textColor: '#333333',
    spacing: SpacingType.COMPACT,
    code: 'L1',
    content: '<h1><strong>Stay Updated</strong></h1><p>Subscribe to our newsletter and be the first to know about our latest updates and offers.</p>',
    customBackGroundColor: '#e8f5e8',
    customCTAButtonName: 'Submit',
    backgroundImageKey: 'files/form-background/1755534544285-1ce176ab-9b91-410e-bfb8-a4278f7d7477-pixabay-1755534544279.jpg',
    pageMode: PageModeType.SINGLE_PAGE
  },
  
  modern: {
    theme: ThemeType.LIGHT,
    textColor: '#333333',
    spacing: SpacingType.COMPACT,
    code: 'L2',
    content: '<h1><strong>Stay Updated</strong></h1><p>Subscribe to our newsletter and be the first to know about our latest updates and offers.</p>',
    customBackGroundColor: '#e8f5e8',
    customCTAButtonName: 'Submit',
    backgroundImageKey: 'files/form-background/1755534544285-1ce176ab-9b91-410e-bfb8-a4278f7d7477-pixabay-1755534544279.jpg',
    pageMode: PageModeType.SINGLE_PAGE
  },
  
  card: {
    theme: ThemeType.LIGHT,
    textColor: '#333333',
    spacing: SpacingType.COMPACT,
    code: 'L3',
    content: '<h1><strong>Stay Updated</strong></h1><p>Subscribe to our newsletter and be the first to know about our latest updates and offers.</p>',
    customBackGroundColor: '#e8f5e8',
    customCTAButtonName: 'Submit',
    backgroundImageKey: 'files/form-background/1755534544285-1ce176ab-9b91-410e-bfb8-a4278f7d7477-pixabay-1755534544279.jpg',
    pageMode: PageModeType.SINGLE_PAGE
  },
  
  minimal: {
    theme: ThemeType.LIGHT,
    textColor: '#333333',
    spacing: SpacingType.COMPACT,
    code: 'L4',
    content: '<h1><strong>Stay Updated</strong></h1><p>Subscribe to our newsletter and be the first to know about our latest updates and offers.</p>',
    customBackGroundColor: '#e8f5e8',
    customCTAButtonName: 'Submit',
    backgroundImageKey: 'files/form-background/1755534544285-1ce176ab-9b91-410e-bfb8-a4278f7d7477-pixabay-1755534544279.jpg',
    pageMode: PageModeType.SINGLE_PAGE
  },
  
  split: {
    theme: ThemeType.LIGHT,
    textColor: '#333333',
    spacing: SpacingType.COMPACT,
    code: 'L5',
    content: '<h1><strong>Stay Updated</strong></h1><p>Subscribe to our newsletter and be the first to know about our latest updates and offers.</p>',
    customBackGroundColor: '#e8f5e8',
    customCTAButtonName: 'Submit',
    backgroundImageKey: 'files/form-background/1755534544285-1ce176ab-9b91-410e-bfb8-a4278f7d7477-pixabay-1755534544279.jpg',
    pageMode: PageModeType.SINGLE_PAGE
  },
  
  wizard: {
    theme: ThemeType.LIGHT,
    textColor: '#333333',
    spacing: SpacingType.COMPACT,
    code: 'L6',
    content: '<h1><strong>Stay Updated</strong></h1><p>Subscribe to our newsletter and be the first to know about our latest updates and offers.</p>',
    customBackGroundColor: '#e8f5e8',
    customCTAButtonName: 'Submit',
    backgroundImageKey: 'files/form-background/1755534544285-1ce176ab-9b91-410e-bfb8-a4278f7d7477-pixabay-1755534544279.jpg',
    pageMode: PageModeType.SINGLE_PAGE
  },
  
  single: {
    theme: ThemeType.LIGHT,
    textColor: '#333333',
    spacing: SpacingType.COMPACT,
    code: 'L7',
    content: '<h1><strong>Stay Updated</strong></h1><p>Subscribe to our newsletter and be the first to know about our latest updates and offers.</p>',
    customBackGroundColor: '#e8f5e8',
    customCTAButtonName: 'Submit',
    backgroundImageKey: 'files/form-background/1755534544285-1ce176ab-9b91-410e-bfb8-a4278f7d7477-pixabay-1755534544279.jpg',
    pageMode: PageModeType.SINGLE_PAGE
  },
  
  image: {
    theme: ThemeType.LIGHT,
    textColor: '#ffffff',
    spacing: SpacingType.COMPACT,
    code: 'L8',
    content: '<h1><strong>Stay Updated</strong></h1><p>Subscribe to our newsletter and be the first to know about our latest updates and offers.</p>',
    customBackGroundColor: '#e8f5e8',
    customCTAButtonName: 'Submit',
    backgroundImageKey: 'files/form-background/1755534544285-1ce176ab-9b91-410e-bfb8-a4278f7d7477-pixabay-1755534544279.jpg',
    pageMode: PageModeType.SINGLE_PAGE
  },
  
  pages: {
    theme: ThemeType.LIGHT,
    textColor: '#333333',
    spacing: SpacingType.COMPACT,
    code: 'L9',
    content: '<h1><strong>Stay Updated</strong></h1><p>Subscribe to our newsletter and be the first to know about our latest updates and offers.</p>',
    customBackGroundColor: '#e8f5e8',
    customCTAButtonName: 'Submit',
    backgroundImageKey: 'files/form-background/1755534544285-1ce176ab-9b91-410e-bfb8-a4278f7d7477-pixabay-1755534544279.jpg',
    pageMode: PageModeType.SINGLE_PAGE
  }
};

// Layout codes for easy reference
export const layoutCodes = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9'] as const;

// Form mode options
export const formModes = {
  PREVIEW: 'PREVIEW',
  BUILDER: 'BUILDER', 
  SUBMISSION: 'SUBMISSION'
} as const;