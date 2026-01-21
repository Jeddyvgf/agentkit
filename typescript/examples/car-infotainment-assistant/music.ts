import { formatDuration, loadJsonFile } from "./utils";

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  bpm: number;
  durationSec: number;
  rating: number;
  tags: string[];
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  trackIds: string[];
}

export interface MusicLibraryData {
  tracks: Track[];
  playlists: Playlist[];
}

export interface PlaybackState {
  isPlaying: boolean;
  track: Track | null;
  queue: Track[];
  queueName?: string;
}

export class MusicLibrary {
  private tracks = new Map<string, Track>();
  private playlists = new Map<string, Playlist>();

  static async loadFromFile(filePath: string): Promise<MusicLibrary> {
    const data = await loadJsonFile<MusicLibraryData>(filePath);
    return new MusicLibrary(data);
  }

  constructor(data: MusicLibraryData) {
    data.tracks.forEach(track => this.tracks.set(track.id, track));
    data.playlists.forEach(playlist => this.playlists.set(playlist.id, playlist));
  }

  findTrackById(id: string): Track | undefined {
    return this.tracks.get(id);
  }

  findTrackByQuery(query: string): Track | undefined {
    const lowered = query.toLowerCase();
    return [...this.tracks.values()].find(track =>
      [track.title, track.artist, track.album].some(value =>
        value.toLowerCase().includes(lowered),
      ),
    );
  }

  search(query: string): Track[] {
    const lowered = query.toLowerCase();
    return [...this.tracks.values()].filter(track =>
      [track.title, track.artist, track.album, track.genre]
        .join(" ")
        .toLowerCase()
        .includes(lowered),
    );
  }

  listPlaylists(): Playlist[] {
    return [...this.playlists.values()];
  }

  findPlaylistByName(name: string): Playlist | undefined {
    const lowered = name.toLowerCase();
    return [...this.playlists.values()].find(playlist =>
      playlist.name.toLowerCase().includes(lowered),
    );
  }

  createSmartPlaylist(name: string, tags: string[], minRating = 4): Playlist {
    const trackIds = [...this.tracks.values()]
      .filter(track => track.rating >= minRating && tags.every(tag => track.tags.includes(tag)))
      .map(track => track.id);

    return {
      id: `smart-${name.toLowerCase().replace(/\s+/g, "-")}`,
      name,
      description: `Smart playlist for ${tags.join(", ")}`,
      trackIds,
    };
  }
}

export class PlaybackController {
  private state: PlaybackState = {
    isPlaying: false,
    track: null,
    queue: [],
  };
  private queueIndex = 0;

  playTrack(track: Track): PlaybackState {
    this.state = {
      isPlaying: true,
      track,
      queue: [track],
    };
    this.queueIndex = 0;
    return this.getState();
  }

  playPlaylist(playlist: Playlist, library: MusicLibrary): PlaybackState {
    const queue = playlist.trackIds
      .map(id => library.findTrackById(id))
      .filter((track): track is Track => Boolean(track));

    if (queue.length === 0) {
      throw new Error(`Playlist "${playlist.name}" has no tracks`);
    }

    this.queueIndex = 0;
    this.state = {
      isPlaying: true,
      track: queue[0],
      queue,
      queueName: playlist.name,
    };
    return this.getState();
  }

  pause(): PlaybackState {
    this.state = { ...this.state, isPlaying: false };
    return this.getState();
  }

  resume(): PlaybackState {
    if (!this.state.track) {
      throw new Error("No track loaded");
    }
    this.state = { ...this.state, isPlaying: true };
    return this.getState();
  }

  next(): PlaybackState {
    if (this.state.queue.length === 0) {
      throw new Error("Queue is empty");
    }
    this.queueIndex = (this.queueIndex + 1) % this.state.queue.length;
    this.state = {
      ...this.state,
      track: this.state.queue[this.queueIndex],
      isPlaying: true,
    };
    return this.getState();
  }

  previous(): PlaybackState {
    if (this.state.queue.length === 0) {
      throw new Error("Queue is empty");
    }
    this.queueIndex =
      (this.queueIndex - 1 + this.state.queue.length) % this.state.queue.length;
    this.state = {
      ...this.state,
      track: this.state.queue[this.queueIndex],
      isPlaying: true,
    };
    return this.getState();
  }

  getState(): PlaybackState {
    return {
      ...this.state,
      queue: [...this.state.queue],
    };
  }

  describeState(): string {
    if (!this.state.track) {
      return "Playback idle";
    }
    const track = this.state.track;
    const status = this.state.isPlaying ? "Playing" : "Paused";
    const queueLabel = this.state.queueName ? ` (${this.state.queueName})` : "";
    return `${status}: ${track.title} - ${track.artist}${queueLabel} [${formatDuration(
      track.durationSec,
    )}]`;
  }
}
