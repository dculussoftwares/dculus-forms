interface UploadFileResponse {
  key: string;
  type: string;
  url: string;
  originalName: string;
  size: number;
  mimeType: string;
}

export async function uploadFileHTTP(
  file: File,
  type: string,
  formId?: string
): Promise<UploadFileResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', type);
  if (formId) {
    formData.append('formId', formId);
  }

  const response = await fetch('http://localhost:4000/upload', {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Upload failed: ${errorText}`);
  }

  return response.json();
}