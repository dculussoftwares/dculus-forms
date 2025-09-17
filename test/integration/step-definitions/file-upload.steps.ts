import { Given, When, Then } from '@cucumber/cucumber';
import { CustomWorld } from '../support/world';
import { generateTestUserWithOrganization } from '../utils/test-data';
import { loadStaticTestFile, createTestTextFile, validateFileUploadResponse } from '../utils/file-utils';
import FormData from 'form-data';

// Simple assertion function
const expect = (actual: any) => ({
  toBe: (expected: any) => {
    if (actual !== expected) {
      throw new Error(`Expected ${actual} to be ${expected}`);
    }
  },
  toHaveProperty: (property: string) => {
    if (!(property in actual)) {
      throw new Error(`Expected object to have property '${property}'`);
    }
  },
  toBeDefined: () => {
    if (actual === undefined) {
      throw new Error('Expected value to be defined');
    }
  },
  toContain: (expected: any) => {
    if (!actual || !actual.includes(expected)) {
      throw new Error(`Expected ${actual} to contain ${expected}`);
    }
  },
  toBeGreaterThan: (expected: number) => {
    if (actual <= expected) {
      throw new Error(`Expected ${actual} to be greater than ${expected}`);
    }
  }
});

Given('I have a test image file {string} from static files', function (this: CustomWorld, filename: string) {
  try {
    const testFile = loadStaticTestFile(filename);
    (this as any).testFile = testFile;
    console.log(`Test file loaded: ${filename} (${testFile.size} bytes, ${testFile.mimetype})`);
  } catch (error: any) {
    console.error('Failed to load static test file:', error.message);
    throw error;
  }
});

Given('I have a test text file for upload', function (this: CustomWorld) {
  const testFile = createTestTextFile();
  (this as any).testFile = testFile;
  console.log('Test text file created for invalid file type testing');
});

Given('I create a test form', async function (this: CustomWorld) {
  const createFormMutation = `
    mutation CreateForm($input: CreateFormInput!) {
      createForm(input: $input) {
        id
        title
        shortUrl
        organization {
          id
        }
      }
    }
  `;
  
  const variables = {
    input: {
      title: 'Test Form for File Upload',
      description: 'Test form created for file upload integration test',
      organizationId: (this as any).getCurrentOrganizationId()
    }
  };
  
  try {
    this.response = await (this as any).authenticatedGraphQLRequest(createFormMutation, variables);
    expect(this.response?.status).toBe(200);
    expect(this.response?.data.data).toHaveProperty('createForm');
    
    const formData = this.response?.data.data.createForm;
    (this as any).testFormId = formData.id;
    
    console.log(`Test form created with ID: ${formData.id}`);
  } catch (error: any) {
    console.error('Failed to create test form:', error.message);
    throw error;
  }
});

When('I upload the file with type {string}', async function (this: CustomWorld, fileType: string) {
  const testFile = (this as any).testFile;
  if (!testFile) {
    throw new Error('No test file available. Please load a test file first.');
  }
  
  try {
    // Create form data for multipart upload
    const form = new FormData();
    
    // Create the GraphQL query as a string
    const query = `
      mutation UploadFile($input: UploadFileInput!) {
        uploadFile(input: $input) {
          key
          type
          url
          originalName
          size
          mimeType
        }
      }
    `;
    
    // GraphQL operations map for file uploads
    const operations = {
      query: query,
      variables: {
        input: {
          file: null,
          type: fileType
        }
      }
    };
    
    const map = {
      "0": ["variables.input.file"]
    };
    
    // Add form fields
    form.append('operations', JSON.stringify(operations));
    form.append('map', JSON.stringify(map));
    form.append('0', testFile.buffer, {
      filename: testFile.filename,
      contentType: testFile.mimetype
    });
    
    // Make the request
    this.response = await this.authUtils.axiosInstance.post('/graphql', form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${this.authToken}`,
        'apollo-require-preflight': 'true'
      }
    });
    
    console.log('File upload response status:', this.response?.status);
    if (this.response?.data?.data?.uploadFile) {
      (this as any).uploadedFileKey = this.response.data.data.uploadFile.key;
      (this as any).trackUploadedFile((this as any).uploadedFileKey);
      console.log('File uploaded with key:', (this as any).uploadedFileKey);
    }
    
  } catch (error: any) {
    console.log('File upload error occurred (may be expected):', error.message);
    this.response = error.response;
    (this as any).uploadError = error.message;
  }
});

When('I upload the file with type {string} without authentication', async function (this: CustomWorld, fileType: string) {
  const testFile = (this as any).testFile;
  if (!testFile) {
    throw new Error('No test file available. Please load a test file first.');
  }
  
  try {
    // Create form data for multipart upload
    const form = new FormData();
    
    const query = `
      mutation UploadFile($input: UploadFileInput!) {
        uploadFile(input: $input) {
          key
          type
          url
          originalName
          size
          mimeType
        }
      }
    `;
    
    const operations = {
      query: query,
      variables: {
        input: {
          file: null,
          type: fileType
        }
      }
    };
    
    const map = {
      "0": ["variables.input.file"]
    };
    
    form.append('operations', JSON.stringify(operations));
    form.append('map', JSON.stringify(map));
    form.append('0', testFile.buffer, {
      filename: testFile.filename,
      contentType: testFile.mimetype
    });
    
    // Make request without Authorization header
    this.response = await this.authUtils.axiosInstance.post('/graphql', form, {
      headers: {
        ...form.getHeaders(),
        'apollo-require-preflight': 'true'
        // No Authorization header
      }
    });
    
  } catch (error: any) {
    console.log('Expected authentication error occurred');
    this.response = error.response;
    (this as any).uploadError = error.message;
  }
});

When('I upload the file with type {string} and the form ID', async function (this: CustomWorld, fileType: string) {
  const testFile = (this as any).testFile;
  const testFormId = (this as any).testFormId;
  
  if (!testFile) {
    throw new Error('No test file available. Please load a test file first.');
  }
  
  if (!testFormId) {
    throw new Error('No test form available. Please create a test form first.');
  }
  
  try {
    const form = new FormData();
    
    const query = `
      mutation UploadFile($input: UploadFileInput!) {
        uploadFile(input: $input) {
          key
          type
          url
          originalName
          size
          mimeType
        }
      }
    `;
    
    const operations = {
      query: query,
      variables: {
        input: {
          file: null,
          type: fileType,
          formId: testFormId
        }
      }
    };
    
    const map = {
      "0": ["variables.input.file"]
    };
    
    form.append('operations', JSON.stringify(operations));
    form.append('map', JSON.stringify(map));
    form.append('0', testFile.buffer, {
      filename: testFile.filename,
      contentType: testFile.mimetype
    });
    
    this.response = await this.authUtils.axiosInstance.post('/graphql', form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${this.authToken}`,
        'apollo-require-preflight': 'true'
      }
    });
    
    console.log('File upload with formId response status:', this.response?.status);
    if (this.response?.data?.data?.uploadFile) {
      (this as any).uploadedFileKey = this.response.data.data.uploadFile.key;
      (this as any).trackUploadedFile((this as any).uploadedFileKey);
      console.log('File uploaded with key:', (this as any).uploadedFileKey);
    }
    
  } catch (error: any) {
    console.log('File upload error occurred:', error.message);
    this.response = error.response;
    (this as any).uploadError = error.message;
  }
});

Then('the upload should be successful', function (this: CustomWorld) {
  expect(this.response?.status).toBe(200);
  expect(this.response?.data).toHaveProperty('data');
  expect(this.response?.data.data).toHaveProperty('uploadFile');
  
  const uploadResult = this.response?.data.data.uploadFile;
  expect(uploadResult).toBeDefined();
  
  console.log('✅ Upload successful');
});

Then('the upload should fail', function (this: CustomWorld) {
  // Could be 400, 401, or 500 depending on the error type
  const isErrorStatus = this.response?.status !== 200;
  const hasGraphQLErrors = this.response?.data?.errors && this.response.data.errors.length > 0;
  
  if (!isErrorStatus && !hasGraphQLErrors) {
    throw new Error('Expected upload to fail, but it succeeded');
  }
  
  console.log('✅ Upload failed as expected');
});

Then('the response should contain file metadata', function (this: CustomWorld) {
  const uploadResult = this.response?.data.data.uploadFile;
  
  // Use the validation utility
  validateFileUploadResponse(uploadResult);
  
  console.log('✅ File metadata is complete:', {
    key: uploadResult.key,
    url: uploadResult.url,
    size: uploadResult.size,
    type: uploadResult.type
  });
});

Then('the file should be accessible via the returned URL', async function (this: CustomWorld) {
  const uploadResult = this.response?.data.data.uploadFile;
  const fileUrl = uploadResult.url;
  
  if (!fileUrl) {
    throw new Error('No URL returned from upload');
  }
  
  try {
    // Make a HEAD request to check if file is accessible
    const headResponse = await this.authUtils.axiosInstance.head(fileUrl, {
      timeout: 10000 // Increase timeout for CDN requests
    });
    
    if (headResponse.status !== 200) {
      throw new Error(`File not accessible. HTTP status: ${headResponse.status}`);
    }
    
    console.log('✅ File is accessible via CDN URL');
  } catch (error: any) {
    console.error('File accessibility check failed:', error.message);
    throw new Error(`File is not accessible via URL: ${fileUrl}`);
  }
});

Then('I should be able to delete the uploaded file', async function (this: CustomWorld) {
  const uploadedFileKey = (this as any).uploadedFileKey;
  
  if (!uploadedFileKey) {
    throw new Error('No uploaded file key available for deletion');
  }
  
  try {
    const deleteFileMutation = `
      mutation DeleteFile($key: String!) {
        deleteFile(key: $key)
      }
    `;
    
    const deleteResponse = await (this as any).authenticatedGraphQLRequest(deleteFileMutation, {
      key: uploadedFileKey
    });
    
    expect(deleteResponse?.status).toBe(200);
    expect(deleteResponse?.data?.data?.deleteFile).toBe(true);
    
    console.log('✅ File deleted successfully');
  } catch (error: any) {
    console.error('File deletion failed:', error.message);
    throw error;
  }
});


Then('the response should indicate invalid file type', function (this: CustomWorld) {
  const hasGraphQLErrors = this.response?.data?.errors && this.response.data.errors.length > 0;
  const isBadRequest = this.response?.status === 400;
  
  if (hasGraphQLErrors) {
    const fileTypeError = this.response?.data?.errors?.some((error: any) => 
      error.message && (
        error.message.toLowerCase().includes('file type') ||
        error.message.toLowerCase().includes('not allowed') ||
        error.message.toLowerCase().includes('invalid')
      )
    );
    if (!fileTypeError) {
      console.log('GraphQL errors:', this.response?.data?.errors);
      throw new Error('Expected file type error in GraphQL response');
    }
  } else if (isBadRequest) {
    console.log('✅ Received 400 Bad Request status');
  } else {
    throw new Error('Expected file type error but got different response');
  }
  
  console.log('✅ Invalid file type error returned as expected');
});

Then('the response should indicate invalid file type parameter', function (this: CustomWorld) {
  const hasGraphQLErrors = this.response?.data?.errors && this.response.data.errors.length > 0;
  
  if (hasGraphQLErrors) {
    const typeParamError = this.response?.data?.errors?.some((error: any) => 
      error.message && (
        error.message.toLowerCase().includes('invalid file type') ||
        error.message.toLowerCase().includes('allowed types')
      )
    );
    if (!typeParamError) {
      console.log('GraphQL errors:', this.response?.data?.errors);
      throw new Error('Expected file type parameter error in GraphQL response');
    }
  } else {
    throw new Error('Expected file type parameter error but got different response');
  }
  
  console.log('✅ Invalid file type parameter error returned as expected');
});

Then('the file should be stored in FormFile table', async function (this: CustomWorld) {
  const uploadResult = this.response?.data.data.uploadFile;
  const fileKey = uploadResult.key;
  const testFormId = (this as any).testFormId;
  
  if (!fileKey || !testFormId) {
    throw new Error('Missing file key or form ID for FormFile verification');
  }
  
  try {
    // Query to check if FormFile record was created
    const checkFormFileQuery = `
      query GetForm($id: ID!) {
        form(id: $id) {
          id
          files {
            id
            key
            type
            originalName
            url
            size
            mimeType
          }
        }
      }
    `;
    
    const formResponse = await (this as any).authenticatedGraphQLRequest(checkFormFileQuery, {
      id: testFormId
    });
    
    expect(formResponse?.status).toBe(200);
    expect(formResponse?.data.data).toHaveProperty('form');
    
    const form = formResponse?.data.data.form;
    expect(form.files).toBeDefined();
    
    const formFile = form.files.find((file: any) => file.key === fileKey);
    if (!formFile) {
      throw new Error(`FormFile record not found for key: ${fileKey}`);
    }
    
    expect(formFile.type).toBe('FormBackground');
    expect(formFile.key).toBe(fileKey);
    
    console.log('✅ File stored in FormFile table:', formFile.key);
  } catch (error: any) {
    console.error('FormFile verification failed:', error.message);
    throw error;
  }
});