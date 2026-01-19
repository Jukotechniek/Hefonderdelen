
export interface UploadedFile {
  file: File;
  preview: string;
  id: string;
}

export interface AppState {
  step: 'auth' | 'input' | 'details' | 'success' | 'password-setup';
  productId: string;
  description: string;
  images: UploadedFile[];
  user: any | null;
}
