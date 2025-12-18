import axios from 'axios';
import { EXPO_PUBLIC_BACKEND_URL } from '@env';

export interface UploadResult {
  success: boolean;
  fullUrl?: string;
  thumbnailUrl?: string;
  error?: string;
}

/**
 * Upload image to Supabase Storage via backend
 * Returns URLs for both full and thumbnail images
 */
export async function uploadImageToStorage(
  imageBase64: string,
  userId: string,
  bucket: 'wardrobe' | 'profiles' = 'wardrobe',
  filename?: string
): Promise<UploadResult> {
  try {
    const response = await axios.post(
      `${EXPO_PUBLIC_BACKEND_URL}/api/upload-image`,
      {
        image_base64: imageBase64,
        bucket,
        user_id: userId,
        filename,
      },
      {
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

