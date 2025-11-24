import { createTemplate } from '../services/templateService.js';
import { 
  TextInputField, 
  EmailField, 
  TextAreaField,
  NumberField,
  SelectField,
  RadioField,
  CheckboxField,
  DateField,
  RichTextFormField,
  FillableFormFieldValidation,
  TextFieldValidation,
  CheckboxFieldValidation,
  ThemeType,
  SpacingType,
  PageModeType,
  LayoutCode
} from '@dculus/types';
import { randomUUID } from 'crypto';
import { logger } from '../lib/logger.js';

// HTML content for different template types
const getHtmlContent = (type: string): string => {
  switch (type) {
    case 'welcome':
      return '<h1><strong>Welcome to Our Platform</strong></h1><p>We\'re excited to have you join us! Please fill out this form to get started.</p>';

    case 'contact':
      return '<h1><strong>Get in Touch</strong></h1><p>We\'d love to hear from you. Send us a message and we\'ll respond as soon as possible.</p>';

    case 'feedback':
      return '<h1><strong>Your Feedback Matters</strong></h1><p>Help us improve by sharing your thoughts and experiences.</p>';

    case 'registration':
      return '<h1><strong>Event Registration</strong></h1><p>Please complete your registration to secure your spot at our upcoming event.</p>';

    case 'survey':
      return '<h1><strong>Quick Survey</strong></h1><p>Your opinion is important to us. This survey will take just a few minutes to complete.</p>';

    case 'event':
      return '<h1><strong>Join Our Event</strong></h1><p>Register now for an exciting event filled with networking, learning, and fun!</p>';

    case 'job':
      return '<h1><strong>Join Our Team</strong></h1><p>We\'re looking for talented individuals to join our growing team. Apply today!</p>';

    case 'newsletter':
      return '<h1><strong>Stay Updated</strong></h1><p>Subscribe to our newsletter and be the first to know about our latest updates and offers.</p>';

    default:
      return '<h1><strong>Welcome</strong></h1><p>Please fill out this form.</p>';
  }
};

interface UploadedFile {
  key: string;
  type: string;
  filename?: string;
  originalName?: string;
}

export const seedTemplates = async (uploadedFiles: UploadedFile[] = []): Promise<void> => {
  logger.info('🌱 Seeding form templates...');
  logger.info(`📦 Received ${uploadedFiles.length} uploaded files for seeding`);
  
  // Get background image keys from uploaded files
  // Accept files with 'background' OR 'logo' in name, or FormBackground/OrganizationLogo types
  const backgroundImages = uploadedFiles.filter(file => {
    const name = file.filename || file.originalName || '';
    return file.type === 'FormBackground' || 
    file.type === 'OrganizationLogo' ||
    name.includes('background') ||
    name.includes('logo');
  });
  
  // Use all matching images
  const availableImages = backgroundImages;
    
  // Helper function to get an image key for a template
  const getImageKey = (index: number): string => {
    if (availableImages.length === 0) {
      logger.warn('⚠️  No background images found, templates will have empty backgroundImageKey');
      return '';
    }
    return availableImages[index % availableImages.length].key;
  };
    
  logger.info(`📸 Found ${availableImages.length} images for template backgrounds`);
  if (availableImages.length > 0) {
    logger.info('Available images:', availableImages.map(f => f.filename || f.key).join(', '));
  }

  const templates = [
    // Contact Form Template
    {
      name: "Contact Form",
      description: "A simple contact form for customer inquiries",
      category: "Business",
      formSchema: {
        pages: [
          {
            id: randomUUID(),
            title: "Contact Information",
            order: 1,
            fields: [
              new TextInputField(
                randomUUID(),
                "Full Name",
                "",
                "",
                "Please enter your full name",
                "John Doe",
                new TextFieldValidation(true)
              ),
              new EmailField(
                randomUUID(),
                "Email Address",
                "",
                "",
                "We'll use this to get back to you",
                "john@example.com",
                new FillableFormFieldValidation(true)
              ),
              new TextInputField(
                randomUUID(),
                "Subject",
                "",
                "",
                "What is this regarding?",
                "General Inquiry",
                new TextFieldValidation(true)
              ),
              new TextAreaField(
                randomUUID(),
                "Message",
                "",
                "",
                "Please provide details about your inquiry",
                "Type your message here...",
                new TextFieldValidation(true)
              )
            ]
          }
        ],
        layout: {
          theme: ThemeType.LIGHT,
          textColor: "#333333",
          spacing: SpacingType.NORMAL,
          code: "L1" as LayoutCode,
          content: getHtmlContent('contact'),
          customBackGroundColor: "#ffffff",
          backgroundImageKey: getImageKey(0),
          pageMode: PageModeType.MULTIPAGE
        },
        isShuffleEnabled: false
      }
    },

    // Customer Feedback Template
    {
      name: "Customer Feedback Survey",
      description: "Collect valuable feedback from your customers",
      category: "Survey",
      formSchema: {
        pages: [
          {
            id: randomUUID(),
            title: "Your Experience",
            order: 1,
            fields: [
              new RadioField(
                randomUUID(),
                "Overall Satisfaction",
                "",
                "",
                "How satisfied are you with our service?",
                new FillableFormFieldValidation(true),
                ["Very Satisfied", "Satisfied", "Neutral", "Dissatisfied", "Very Dissatisfied"]
              ),
              new SelectField(
                randomUUID(),
                "Service Used",
                "",
                "",
                "Which of our services did you use?",
                new FillableFormFieldValidation(true),
                ["Customer Support", "Product Delivery", "Technical Support", "Billing", "Other"]
              ),
              new NumberField(
                randomUUID(),
                "Rating (1-10)",
                "",
                "",
                "Rate your experience from 1 to 10",
                "8",
                new FillableFormFieldValidation(true),
                1,
                10
              ),
              new TextAreaField(
                randomUUID(),
                "Additional Comments",
                "",
                "",
                "Any additional feedback you'd like to share?",
                "Your feedback here...",
                new TextFieldValidation(false)
              )
            ]
          }
        ],
        layout: {
          theme: ThemeType.LIGHT,
          textColor: "#333333",
          spacing: SpacingType.NORMAL,
          code: "L2" as LayoutCode,
          content: getHtmlContent('feedback'),
          customBackGroundColor: "#f8f9fa",
          backgroundImageKey: getImageKey(1),
          pageMode: PageModeType.MULTIPAGE
        },
        isShuffleEnabled: false
      }
    },

    // Event Registration Template
    {
      name: "Event Registration",
      description: "Registration form for events and workshops",
      category: "Events",
      formSchema: {
        pages: [
          {
            id: randomUUID(),
            title: "Personal Information",
            order: 1,
            fields: [
              new TextInputField(
                randomUUID(),
                "First Name",
                "",
                "",
                "",
                "John",
                new TextFieldValidation(true)
              ),
              new TextInputField(
                randomUUID(),
                "Last Name",
                "",
                "",
                "",
                "Doe",
                new TextFieldValidation(true)
              ),
              new EmailField(
                randomUUID(),
                "Email",
                "",
                "",
                "We'll send event details to this email",
                "john@example.com",
                new FillableFormFieldValidation(true)
              ),
              new TextInputField(
                randomUUID(),
                "Phone Number",
                "",
                "",
                "For event updates and notifications",
                "+1 (555) 123-4567",
                new TextFieldValidation(false)
              )
            ]
          },
          {
            id: randomUUID(),
            title: "Event Details",
            order: 2,
            fields: [
              new SelectField(
                randomUUID(),
                "Session Preference",
                "",
                "",
                "Which session would you like to attend?",
                new FillableFormFieldValidation(true),
                ["Morning Session (9AM - 12PM)", "Afternoon Session (1PM - 4PM)", "Evening Session (5PM - 8PM)"]
              ),
              new CheckboxField(
                randomUUID(),
                "Dietary Restrictions",
                "",
                "",
                "Please select any dietary restrictions",
                "",
                new FillableFormFieldValidation(false),
                ["Vegetarian", "Vegan", "Gluten-Free", "Nut Allergy", "Dairy-Free", "No Restrictions"]
              ),
              new TextAreaField(
                randomUUID(),
                "Special Requirements",
                "",
                "",
                "Any special accommodations needed?",
                "Please describe any special requirements...",
                new TextFieldValidation(false)
              )
            ]
          }
        ],
        layout: {
          theme: ThemeType.LIGHT,
          textColor: "#333333",
          spacing: SpacingType.NORMAL,
          code: "L3" as LayoutCode,
          content: getHtmlContent('registration'),
          customBackGroundColor: "#e3f2fd",
          backgroundImageKey: getImageKey(0),
          pageMode: PageModeType.MULTIPAGE
        },
        isShuffleEnabled: false
      }
    },

    // Job Application Template
    {
      name: "Job Application Form",
      description: "Comprehensive job application form",
      category: "HR",
      formSchema: {
        pages: [
          {
            id: randomUUID(),
            title: "Personal Information",
            order: 1,
            fields: [
              new TextInputField(
                randomUUID(),
                "Full Name",
                "",
                "",
                "",
                "Jane Smith",
                new TextFieldValidation(true)
              ),
              new EmailField(
                randomUUID(),
                "Email Address",
                "",
                "",
                "",
                "jane@example.com",
                new FillableFormFieldValidation(true)
              ),
              new TextInputField(
                randomUUID(),
                "Phone Number",
                "",
                "",
                "",
                "+1 (555) 987-6543",
                new TextFieldValidation(true)
              ),
              new DateField(
                randomUUID(),
                "Availability Date",
                "",
                "",
                "When can you start?",
                "",
                new FillableFormFieldValidation(true)
              )
            ]
          },
          {
            id: randomUUID(),
            title: "Professional Background",
            order: 2,
            fields: [
              new SelectField(
                randomUUID(),
                "Experience Level",
                "",
                "",
                "How many years of relevant experience do you have?",
                new FillableFormFieldValidation(true),
                ["0-1 years", "2-3 years", "4-5 years", "6-10 years", "10+ years"]
              ),
              new TextAreaField(
                randomUUID(),
                "Previous Experience",
                "",
                "",
                "Briefly describe your relevant work experience",
                "Describe your experience...",
                new TextFieldValidation(true)
              ),
              new TextAreaField(
                randomUUID(),
                "Why This Position?",
                "",
                "",
                "Why are you interested in this position?",
                "Tell us why you're interested...",
                new TextFieldValidation(true)
              )
            ]
          }
        ],
        layout: {
          theme: ThemeType.LIGHT,
          textColor: "#333333",
          spacing: SpacingType.SPACIOUS,
          code: "L4" as LayoutCode,
          content: getHtmlContent('job'),
          customBackGroundColor: "#fff3e0",
          backgroundImageKey: getImageKey(1),
          pageMode: PageModeType.MULTIPAGE
        },
        isShuffleEnabled: false
      }
    },

    // Product Survey Template
    {
      name: "Product Feedback Survey",
      description: "Gather insights about product usage and satisfaction",
      category: "Survey",
      formSchema: {
        pages: [
          {
            id: randomUUID(),
            title: "Product Experience",
            order: 1,
            fields: [
              new RadioField(
                randomUUID(),
                "How often do you use our product?",
                "",
                "",
                "",
                new FillableFormFieldValidation(true),
                ["Daily", "Weekly", "Monthly", "Rarely", "This is my first time"]
              ),
              new NumberField(
                randomUUID(),
                "Likelihood to Recommend (0-10)",
                "",
                "",
                "How likely are you to recommend our product to others?",
                "8",
                new FillableFormFieldValidation(true),
                0,
                10
              ),
              new CheckboxField(
                randomUUID(),
                "Which features do you use most?",
                "",
                "",
                "Select all that apply",
                "",
                new FillableFormFieldValidation(false),
                ["Dashboard", "Reports", "Settings", "Mobile App", "Integrations", "Support Chat"]
              ),
              new TextAreaField(
                randomUUID(),
                "Suggestions for Improvement",
                "",
                "",
                "What improvements would you like to see?",
                "Your suggestions...",
                new TextFieldValidation(false)
              )
            ]
          }
        ],
        layout: {
          theme: ThemeType.LIGHT,
          textColor: "#333333",
          spacing: SpacingType.NORMAL,
          code: "L5" as LayoutCode,
          content: getHtmlContent('survey'),
          customBackGroundColor: "#f3e5f5",
          backgroundImageKey: getImageKey(0),
          pageMode: PageModeType.MULTIPAGE
        },
        isShuffleEnabled: false
      }
    },

    // Newsletter Signup Template
    {
      name: "Newsletter Signup",
      description: "Simple newsletter subscription form",
      category: "Marketing",
      formSchema: {
        pages: [
          {
            id: randomUUID(),
            title: "Subscribe to Our Newsletter",
            order: 1,
            fields: [
              new TextInputField(
                randomUUID(),
                "First Name",
                "",
                "",
                "",
                "John",
                new TextFieldValidation(true)
              ),
              new EmailField(
                randomUUID(),
                "Email Address",
                "",
                "",
                "We'll never share your email with anyone",
                "john@example.com",
                new FillableFormFieldValidation(true)
              ),
              new CheckboxField(
                randomUUID(),
                "Newsletter Topics",
                "",
                "",
                "What topics interest you?",
                "",
                new FillableFormFieldValidation(false),
                ["Product Updates", "Industry News", "Tips & Tutorials", "Company News", "Special Offers"]
              ),
              new RadioField(
                randomUUID(),
                "Email Frequency",
                "",
                "",
                "How often would you like to hear from us?",
                new FillableFormFieldValidation(true),
                ["Weekly", "Bi-weekly", "Monthly", "Only major updates"]
              )
            ]
          }
        ],
        layout: {
          theme: ThemeType.LIGHT,
          textColor: "#333333",
          spacing: SpacingType.COMPACT,
          code: "L6" as LayoutCode,
          content: getHtmlContent('newsletter'),
          customBackGroundColor: "#e8f5e8",
          backgroundImageKey: getImageKey(1),
          pageMode: PageModeType.MULTIPAGE
        },
        isShuffleEnabled: false
      }
    },

    // All Fields Showcase Template - Comprehensive demonstration of all field types
    {
      name: "All Fields Showcase",
      description: "Comprehensive template demonstrating all available form field types",
      category: "Reference",
      formSchema: {
        pages: [
          {
            id: randomUUID(),
            title: "Text Input Fields",
            order: 1,
            fields: [
              new TextInputField(
                randomUUID(),
                "Single-Line Text Input",
                "",
                "",
                "Supports character limits (min: 3, max: 50 characters)",
                "Enter your response here",
                new TextFieldValidation(true, 3, 50)
              ),
              new TextAreaField(
                randomUUID(),
                "Multi-Line Text Area",
                "",
                "",
                "Perfect for longer responses with character limits (max: 500 characters)",
                "Enter detailed information here...",
                new TextFieldValidation(true, 10, 500)
              ),
              new EmailField(
                randomUUID(),
                "Email Address",
                "",
                "",
                "Validates email format automatically",
                "your.email@example.com",
                new FillableFormFieldValidation(true)
              )
            ]
          },
          {
            id: randomUUID(),
            title: "Numeric & Choice Fields",
            order: 2,
            fields: [
              new NumberField(
                randomUUID(),
                "Number Input (Age)",
                "",
                "",
                "Numeric input with range validation (18-100)",
                "25",
                new FillableFormFieldValidation(true),
                18,
                100
              ),
              new SelectField(
                randomUUID(),
                "Dropdown Selection",
                "",
                "",
                "Choose one option from the dropdown menu",
                new FillableFormFieldValidation(true),
                ["Option 1", "Option 2", "Option 3", "Option 4", "Option 5"]
              ),
              new RadioField(
                randomUUID(),
                "Radio Button Selection",
                "",
                "",
                "Select exactly one option from the list",
                new FillableFormFieldValidation(true),
                ["Choice A", "Choice B", "Choice C", "Choice D"]
              )
            ]
          },
          {
            id: randomUUID(),
            title: "Selection & Date Fields",
            order: 3,
            fields: [
              new CheckboxField(
                randomUUID(),
                "Multiple Choice Checkboxes",
                [],
                "",
                "Select between 1-3 options (demonstrates selection limits)",
                "",
                new CheckboxFieldValidation(true, 1, 3),
                ["Feature A", "Feature B", "Feature C", "Feature D", "Feature E"]
              ),
              new DateField(
                randomUUID(),
                "Date Picker",
                "",
                "",
                "Select a date with optional min/max constraints",
                "",
                new FillableFormFieldValidation(true),
                "2024-01-01",
                "2025-12-31"
              )
            ]
          },
          {
            id: randomUUID(),
            title: "Rich Content Display",
            order: 4,
            fields: [
              new RichTextFormField(
                randomUUID(),
                '<h2><strong>Rich Text Field</strong></h2><p>This is a <strong>non-fillable</strong> field type used for displaying formatted content, instructions, or information to users.</p><p>It supports:</p><ul><li>Bold and italic text</li><li>Headings and paragraphs</li><li>Lists and formatting</li><li>Any HTML content</li></ul><p><em>Perfect for adding context, instructions, or visual breaks in your forms!</em></p>'
              )
            ]
          }
        ],
        layout: {
          theme: ThemeType.LIGHT,
          textColor: "#333333",
          spacing: SpacingType.NORMAL,
          code: "L1" as LayoutCode,
          content: '<h1><strong>All Fields Showcase</strong></h1><p>This template demonstrates all 9 available form field types with their unique capabilities and validation features.</p>',
          customBackGroundColor: "#f0f4f8",
          backgroundImageKey: getImageKey(0),
          pageMode: PageModeType.MULTIPAGE
        },
        isShuffleEnabled: false
      }
    }
  ];

  try {
    // Create templates
    for (const templateData of templates) {
      const template = await createTemplate(templateData);
      logger.info(`✅ Created template: ${template.name}`);
    }

    logger.info(`🌱 Successfully seeded ${templates.length} form templates`);
  } catch (error) {
    logger.error('❌ Error seeding templates:', error);
    throw error;
  }
};