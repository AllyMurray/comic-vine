export type ApplyOverrides<OriginalType, Overrides> = Omit<
  OriginalType,
  keyof Overrides
> &
  Overrides;
