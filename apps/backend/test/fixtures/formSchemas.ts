export const basicFormSchema = {
  pages: [
    {
      id: 'page-1',
      title: 'Contact Information',
      fields: [
        {
          id: 'field-1',
          type: 'text',
          label: 'Full Name',
          validation: { required: true, type: 'text' },
        },
        {
          id: 'field-2',
          type: 'email',
          label: 'Email Address',
          validation: { required: true, type: 'email' },
        },
      ],
      order: 0,
    },
  ],
  layout: {
    theme: 'light' as const,
    textColor: '#000000',
    spacing: 'normal' as const,
    code: '',
    content: '',
    customBackGroundColor: '#ffffff',
    backgroundImageKey: '',
  },
  isShuffleEnabled: false,
};

export const multiPageFormSchema = {
  pages: [
    {
      id: 'page-1',
      title: 'Page 1',
      fields: [
        {
          id: 'field-1',
          type: 'text',
          label: 'Question 1',
          validation: { required: true, type: 'text' },
        },
      ],
      order: 0,
    },
    {
      id: 'page-2',
      title: 'Page 2',
      fields: [
        {
          id: 'field-2',
          type: 'textarea',
          label: 'Question 2',
          validation: { required: false, type: 'textarea' },
        },
      ],
      order: 1,
    },
  ],
  layout: basicFormSchema.layout,
  isShuffleEnabled: false,
};

export const quizFormSchema = {
  pages: [
    {
      id: 'page-1',
      title: 'Quiz Questions',
      fields: [
        {
          id: 'q1',
          type: 'radio',
          label: 'What is 2 + 2?',
          options: ['3', '4', '5'],
          validation: { required: true, type: 'radio' },
        },
        {
          id: 'q2',
          type: 'select',
          label: 'Capital of France?',
          options: ['London', 'Paris', 'Berlin'],
          validation: { required: true, type: 'select' },
        },
      ],
      order: 0,
    },
  ],
  layout: basicFormSchema.layout,
  isShuffleEnabled: false,
};
