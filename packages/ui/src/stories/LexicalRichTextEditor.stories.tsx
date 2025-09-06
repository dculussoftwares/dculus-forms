import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { LexicalRichTextEditor } from '../rich-text-editor/LexicalRichTextEditor';

const sampleMentionFields = [
  { fieldId: 'first-name', label: 'First Name' },
  { fieldId: 'last-name', label: 'Last Name' },
  { fieldId: 'email', label: 'Email Address' },
  { fieldId: 'phone', label: 'Phone Number' },
  { fieldId: 'company', label: 'Company Name' },
  { fieldId: 'address', label: 'Street Address' },
  { fieldId: 'city', label: 'City' },
  { fieldId: 'state', label: 'State' },
  { fieldId: 'zip', label: 'ZIP Code' },
  { fieldId: 'country', label: 'Country' },
];

const meta: Meta<typeof LexicalRichTextEditor> = {
  title: 'Components/LexicalRichTextEditor',
  component: LexicalRichTextEditor,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'A rich text editor component built with Lexical. Supports formatting, lists, links, and has configurable toolbar for content creation and editing.',
      },
    },
  },
  argTypes: {
    value: {
      control: 'text',
      description: 'HTML string content of the editor',
    },
    onChange: {
      action: 'onChange',
      description: 'Callback fired when content changes',
    },
    placeholder: {
      control: 'text',
      description: 'Placeholder text shown when editor is empty',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes for the editor container',
    },
    editable: {
      control: 'boolean',
      description: 'Whether the editor is editable or read-only',
    },
    mentionFields: {
      control: false,
      description: 'Array of fields available for mentions',
    },
  },
  args: {
    placeholder: 'Enter content...',
    className: '',
    editable: true,
    mentionFields: [],
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Controlled component wrapper for interactive stories
const ControlledEditor = (props: any) => {
  const [value, setValue] = useState(props.value || '');
  
  return (
    <LexicalRichTextEditor
      {...props}
      value={value}
      onChange={setValue}
    />
  );
};

// Default story
export const Default: Story = {
  render: (args) => <ControlledEditor {...args} />,
  parameters: {
    docs: {
      description: {
        story: 'Default rich text editor with toolbar and basic formatting options.',
      },
    },
  },
};

// With initial content
export const WithContent: Story = {
  render: (args) => <ControlledEditor {...args} />,
  args: {
    value: '<h1>Welcome to the Rich Text Editor</h1><p>This is a paragraph with <strong>bold text</strong> and <em>italic text</em>.</p><ul><li>First bullet point</li><li>Second bullet point</li></ul><p>You can also add <a href="https://example.com" target="_blank">links</a> to your content.</p>',
  },
  parameters: {
    docs: {
      description: {
        story: 'Rich text editor with pre-populated HTML content showing various formatting options.',
      },
    },
  },
};

// Custom placeholder
export const CustomPlaceholder: Story = {
  render: (args) => <ControlledEditor {...args} />,
  args: {
    placeholder: 'Start typing your blog post here...',
  },
  parameters: {
    docs: {
      description: {
        story: 'Rich text editor with custom placeholder text.',
      },
    },
  },
};

// Read-only mode
export const ReadOnly: Story = {
  args: {
    value: '<h2>Read-Only Content</h2><p>This editor is in read-only mode. The toolbar is hidden and content cannot be edited.</p><blockquote>This is a quote that demonstrates read-only formatting.</blockquote>',
    editable: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'Rich text editor in read-only mode - toolbar is hidden and content cannot be edited.',
      },
    },
  },
};

// With custom styling
export const CustomStyling: Story = {
  render: (args) => <ControlledEditor {...args} />,
  args: {
    className: 'max-w-2xl mx-auto',
    value: '<h1>Custom Styled Editor</h1><p>This editor has custom styling applied via className prop.</p>',
  },
  parameters: {
    docs: {
      description: {
        story: 'Rich text editor with custom CSS classes applied for styling.',
      },
    },
  },
};

// Long content example
export const LongContent: Story = {
  render: (args) => <ControlledEditor {...args} />,
  args: {
    value: `<h1>The Future of Web Development</h1>
<p>Web development has evolved significantly over the past decade, with new frameworks, tools, and methodologies emerging to address the growing complexity of modern applications.</p>

<h2>Key Trends</h2>
<ol>
  <li><strong>Component-Based Architecture</strong> - Breaking down UIs into reusable components</li>
  <li><strong>Server-Side Rendering</strong> - Improving performance and SEO</li>
  <li><strong>Progressive Web Apps</strong> - Bridging the gap between web and native apps</li>
  <li><strong>Jamstack</strong> - Static site generators with dynamic functionality</li>
</ol>

<h2>Popular Technologies</h2>
<ul>
  <li>React and Next.js for frontend development</li>
  <li>Node.js and Express for backend services</li>
  <li>GraphQL for efficient data fetching</li>
  <li>TypeScript for type safety</li>
</ul>

<blockquote>
"The best way to predict the future is to invent it." - Alan Kay
</blockquote>

<p>As we continue to push the boundaries of what's possible on the web, developers must stay updated with the latest trends and best practices. The landscape is constantly evolving, and adaptation is key to success.</p>

<p>For more information, visit <a href="https://developer.mozilla.org" target="_blank">MDN Web Docs</a> or explore the latest <a href="https://github.com/trending" target="_blank">trending repositories on GitHub</a>.</p>`,
  },
  parameters: {
    docs: {
      description: {
        story: 'Rich text editor with longer content to demonstrate scrolling and content management.',
      },
    },
  },
};

// Simple text example
export const SimpleText: Story = {
  render: (args) => <ControlledEditor {...args} />,
  args: {
    value: '<p>This is a simple paragraph of text without any special formatting.</p>',
    placeholder: 'Write something simple...',
  },
  parameters: {
    docs: {
      description: {
        story: 'Rich text editor with simple text content.',
      },
    },
  },
};

// Empty editor
export const Empty: Story = {
  render: (args) => <ControlledEditor {...args} />,
  args: {
    value: '',
    placeholder: 'Start writing your content here...',
  },
  parameters: {
    docs: {
      description: {
        story: 'Empty rich text editor showing placeholder text.',
      },
    },
  },
};

// Editor with lists and quotes
export const ListsAndQuotes: Story = {
  render: (args) => <ControlledEditor {...args} />,
  args: {
    value: `<h3>Project Requirements</h3>
<p>Below are the key requirements for the upcoming project:</p>

<h4>Must Have Features</h4>
<ul>
  <li>User authentication and authorization</li>
  <li>Responsive design for mobile devices</li>
  <li>Real-time data synchronization</li>
  <li>Search and filtering capabilities</li>
</ul>

<h4>Nice to Have Features</h4>
<ol>
  <li>Dark mode support</li>
  <li>Offline functionality</li>
  <li>Push notifications</li>
  <li>Advanced analytics dashboard</li>
</ol>

<blockquote>
"Quality is not an act, it is a habit." - Aristotle
</blockquote>

<p><strong>Note:</strong> All features should be implemented following best practices for accessibility and performance.</p>`,
  },
  parameters: {
    docs: {
      description: {
        story: 'Rich text editor showcasing various list types and block quotes.',
      },
    },
  },
};

// Editor with headings hierarchy
export const HeadingsHierarchy: Story = {
  render: (args) => <ControlledEditor {...args} />,
  args: {
    value: `<h1>Main Title (H1)</h1>
<p>This is the main heading of the document.</p>

<h2>Section Title (H2)</h2>
<p>This is a major section heading.</p>

<h3>Subsection Title (H3)</h3>
<p>This is a subsection heading.</p>

<h4>Sub-subsection Title (H4)</h4>
<p>This is a smaller heading for detailed sections.</p>

<h5>Minor Heading (H5)</h5>
<p>This is used for minor sections.</p>

<h6>Smallest Heading (H6)</h6>
<p>This is the smallest heading available.</p>`,
  },
  parameters: {
    docs: {
      description: {
        story: 'Rich text editor showing the complete heading hierarchy from H1 to H6.',
      },
    },
  },
};

// Mention functionality
export const WithMentions: Story = {
  render: (args) => <ControlledEditor {...args} />,
  args: {
    mentionFields: sampleMentionFields,
    placeholder: 'Type @ to mention a field (try typing @first or @email)...',
  },
  parameters: {
    docs: {
      description: {
        story: 'Rich text editor with enhanced mention functionality. Type @ to see a styled dropdown with field labels. Features include hover effects, keyboard navigation, smooth animations, and improved UX. Shows field labels in dropdown and editor, but stores field IDs in HTML.',
      },
    },
  },
};

// Mentions with content - showing field IDs in HTML but labels in display
export const MentionsWithContent: Story = {
  render: (args) => <ControlledEditor {...args} />,
  args: {
    mentionFields: sampleMentionFields,
    value: `<p>Dear <span data-beautiful-mention="true" data-trigger="@" data-value="first-name">@first-name</span> <span data-beautiful-mention="true" data-trigger="@" data-value="last-name">@last-name</span>,</p>
<p>Thank you for your interest in our services. We have received your application and will contact you at <span data-beautiful-mention="true" data-trigger="@" data-value="email">@email</span> within 24 hours.</p>
<p>Your application details:</p>
<ul>
  <li>Company: <span data-beautiful-mention="true" data-trigger="@" data-value="company">@company</span></li>
  <li>Phone: <span data-beautiful-mention="true" data-trigger="@" data-value="phone">@phone</span></li>
  <li>Address: <span data-beautiful-mention="true" data-trigger="@" data-value="address">@address</span>, <span data-beautiful-mention="true" data-trigger="@" data-value="city">@city</span>, <span data-beautiful-mention="true" data-trigger="@" data-value="state">@state</span> <span data-beautiful-mention="true" data-trigger="@" data-value="zip">@zip</span></li>
</ul>
<p>Best regards,<br>The Team</p>`,
  },
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates the perfect mention behavior: users see friendly labels like "First Name" in the editor, but field IDs like "first-name" are saved in HTML for backend processing. Try typing @ to add new mentions - they show labels but save IDs!',
      },
    },
  },
};

// Read-only mentions
export const ReadOnlyWithMentions: Story = {
  args: {
    mentionFields: sampleMentionFields,
    editable: false,
    value: `<p>This is a read-only editor with mentions: <span data-beautiful-mention="true" data-trigger="@" data-value="first-name">@first-name</span> and <span data-beautiful-mention="true" data-trigger="@" data-value="email">@email</span></p>`,
  },
  parameters: {
    docs: {
      description: {
        story: 'Read-only rich text editor displaying field ID mentions without editing capabilities.',
      },
    },
  },
};

// Limited mention fields
export const LimitedMentions: Story = {
  render: (args) => <ControlledEditor {...args} />,
  args: {
    mentionFields: [
      { fieldId: 'name', label: 'Full Name' },
      { fieldId: 'email', label: 'Email' },
      { fieldId: 'date', label: 'Today\'s Date' },
    ],
    placeholder: 'Type @ to see available fields (name, email, date)...',
  },
  parameters: {
    docs: {
      description: {
        story: 'Rich text editor with a limited set of mention fields.',
      },
    },
  },
};