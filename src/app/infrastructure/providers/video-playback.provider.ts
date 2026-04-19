import { Provider } from "@angular/core";
import { VideoPlaybackFacade } from "@infrastructure/services/video-playback.facade";

export const videoPlaybackProvider: Provider = {
    provide: VideoPlaybackFacade,
    useClass: VideoPlaybackFacade
}