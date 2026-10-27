import { reelFileProblem } from '@carza/shared';

/** Longest edge of the poster frame. Phones show it full screen until the video starts. */
const POSTER_EDGE = 1080;

export type PreparedVideo = {
  file: File;
  contentType: string;
  previewUrl: string;
  poster: Blob;
  width: number;
  height: number;
  durationSeconds: number;
};

/**
 * Reads a picked video's size and length in the browser and grabs a poster frame, so the feed can show
 * something instantly while the video loads. Throws a message to show when the clip can't be a reel.
 */
export async function prepareVideo(file: File): Promise<PreparedVideo> {
  // Some Android pickers leave the type empty; fall back to the extension.
  const ext = file.name.split('.').pop()?.toLowerCase();
  const contentType =
    file.type ||
    (
      { mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm' } as Record<
        string,
        string
      >
    )[ext ?? ''] ||
    '';
  const previewUrl = URL.createObjectURL(file);
  try {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = previewUrl;
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error('unreadable'));
    }).catch(() => {
      throw new Error('This video format won’t play here. Try exporting it as MP4.');
    });

    const problem = reelFileProblem({ type: contentType, size: file.size }, video.duration);
    if (problem) throw new Error(problem);
    // Zero dimensions means the browser can read the file but not decode it (e.g. HEVC in Chrome).
    if (!video.videoWidth || !video.videoHeight) {
      throw new Error('This video format won’t play here. Try exporting it as MP4.');
    }

    // A frame slightly in avoids the black first frame many phones record.
    video.currentTime = Math.min(0.5, video.duration / 2);
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
    });
    const scale = Math.min(1, POSTER_EDGE / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const poster = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Couldn’t make a thumbnail.'))),
        'image/webp',
        0.8,
      ),
    );
    return {
      file,
      contentType,
      previewUrl,
      poster,
      width: video.videoWidth,
      height: video.videoHeight,
      durationSeconds: video.duration,
    };
  } catch (e) {
    URL.revokeObjectURL(previewUrl);
    throw e;
  }
}
