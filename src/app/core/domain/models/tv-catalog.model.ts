export interface TvProgram {
  readonly title: string;
  readonly progressPercent: number;
}

export interface TvChannel {
  readonly id: string;
  readonly name: string;
  readonly logoLabel: string;
  readonly logoUrl?: string;
  readonly streamId: string;
  readonly streamType: string;
  readonly directSource?: string;
  readonly currentProgram: TvProgram;
}

export interface TvCategory {
  readonly id: string;
  readonly name: string;
  readonly iconLabel: string;
  readonly channels: readonly TvChannel[];
}
