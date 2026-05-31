import { getDownloadURL, ref as storageRef, uploadBytesResumable, type UploadTask } from "firebase/storage";

import { storage } from "../firebaseConfig";

export type UploadedFile = {
  url: string;
  path: string;
};

export type UploadPromise = Promise<UploadedFile> & {
  cancel?: () => void;
};

export function uploadFileAsync(uri: string, onProgress?: (progress: number) => void): UploadPromise | null {
  if (!uri) return null;

  let cancelled = false;
  let uploadTask: UploadTask | null = null;

  const promise = new Promise<UploadedFile>(async (resolve, reject) => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      if (cancelled) {
        reject(new Error("Upload cancelled"));
        return;
      }

      const rawExt = (uri.split(".").pop() || "jpg").split("?")[0];
      const filename = `community/${Date.now()}_${Math.random().toString(36).slice(2)}.${rawExt}`;
      const storageReference = storageRef(storage, filename);
      uploadTask = uploadBytesResumable(storageReference, blob);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress = snapshot.totalBytes ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100) : 0;
          if (onProgress) onProgress(progress);
        },
        (error) => reject(error),
        async () => {
          try {
            if (!uploadTask) throw new Error("Upload task missing");
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            resolve({ url, path: filename });
          } catch (error) {
            reject(error);
          }
        },
      );
    } catch (error) {
      reject(error);
    }
  }) as UploadPromise;

  promise.cancel = () => {
    cancelled = true;
    try {
      uploadTask?.cancel();
    } catch (error) {
      // Ignore cancel errors; callers only need best-effort cancellation.
    }
  };

  return promise;
}
