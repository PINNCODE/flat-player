import { Provider } from "@angular/core";
import { VideoPlaybackFacade } from "@infrastructure/services/video-playback.facade";
import { VIDEO_PLAYBACK_PORT } from "@core/domain/ports/video-playback.port";

export const videoPlaybackProvider: Provider = {
    provide: VIDEO_PLAYBACK_PORT,
    useClass: VideoPlaybackFacade
}