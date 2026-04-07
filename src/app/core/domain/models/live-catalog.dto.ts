export interface LiveStreamDto {
  readonly num: number;
  readonly name: string;
  readonly stream_type: string;
  readonly stream_id: number;
  readonly stream_icon: string | null;
  readonly epg_channel_id: string | null;
  readonly added: string;
  readonly is_adult: string;
  readonly category_id: string;
  readonly custom_sid: string;
  readonly tv_archive: number;
  readonly direct_source: string;
  readonly tv_archive_duration: number;
}

export interface LiveCategoryDto {
  readonly category_id: string;
  readonly category_name: string;
  readonly parent_id: number;
}
