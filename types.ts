
export interface MediaItem {
  id: string;
  name: string;
  url: string;
  type: 'video' | 'audio';
}

export type ViewMode = 'video-focus' | 'camera-focus';

export interface PlaylistState {
  videos: MediaItem[];
  audios: MediaItem[];
}
