import type { VersionGroupId } from '../../../src/app/core/domain/models';
import { rbyConfig } from './rby/config';
import type { VersionGroupConfig } from './types';

/** Version groups with a pipeline configuration. */
export const VERSION_GROUP_CONFIGS: Partial<Record<VersionGroupId, VersionGroupConfig>> = {
  rby: rbyConfig,
};
