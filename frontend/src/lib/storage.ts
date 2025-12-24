import axios from 'axios';
import { supabase } from './supabase';

export interface UploadResult {
  success: boolean;
  fullUrl?: string;
  thumbnailUrl?: string;
  error?: string;
}

/**
 * Upload image to Supabase Storage via backend
 * Returns URLs for both full and thumbnail images
 * Requires valid Supabase JWT token
 */
export async function uploadImageToStorage(
  fileUri: string,
  userId: string,
  bucket: 'wardrobe' | 'profiles' = 'wardrobe',
  filename?: string,
  mimeType: string = 'image/jpeg'
): Promise<UploadResult> {
  try {
    const EXPO_PUBLIC_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL as string;

    // Get Supabase session token
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return {
        success: false,
        error: 'Authentication required. Please login first.',
      };
    }

    const formData = new FormData();
    formData.append('file', {
      uri: fileUri,
      name: `${filename || `upload_${Date.now()}`}.jpg`,
      type: mimeType,
    } as any);
    formData.append('bucket', bucket);
    formData.append('user_id', userId);
    if (filename) {
      formData.append('filename', filename);
    }

    const response = await axios.post(
      `${EXPO_PUBLIC_BACKEND_URL}/api/upload-image`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${session.access_token}`,
        },
        timeout: 30000, // 30 second timeout
      }
    );

    return {
      success: response.data.success,
      fullUrl: response.data.full_url,
      thumbnailUrl: response.data.thumbnail_url,
      error: response.data.error,
    };
  } catch (error: any) {
    console.error('Upload error:', error);
    return {
      success: false,
      error: error.message || 'Upload failed',
    };
  }
}

/**
 * Extract filename from a URL
 */
export function getFilenameFromUrl(url: string): string {
  return url.split('/').pop() || 'unknown';
}

