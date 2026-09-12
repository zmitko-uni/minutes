// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../logging/log.std.ts';
import type { UubtMeetingActivity } from './uubt.std.ts';
import {
  UUBT_ACTIVITY_STATE_SOLVED,
  isUubtMeetingSolvableByMe,
} from './uubt.std.ts';
import { UubtApiError, logUubtErrorMap, uubtPost } from './uubtClient.main.ts';

const log = createLogger('minutes/uubtActivity');

const SET_STATE_USE_CASE = 'uuArtifactIfc/activity/elementary/setState';

/**
 * Nastaví elementární aktivitu schůzky na „vyřešeno“ — v uuDigitalWorkspace
 * tím schůzka zmizí z úkolů uživatele. Pozvánky (accepted / attention) tenhle
 * uuCmd řeší taky, my ho používáme jen pro uzavření zápisu.
 */
export async function markUubtMeetingSolved(
  activity: UubtMeetingActivity,
  note?: string
): Promise<void> {
  const dtoIn: Record<string, unknown> = {
    activityRefId: activity.activityRefId,
    elementaryActivity: activity.elementaryActivity,
    state: UUBT_ACTIVITY_STATE_SOLVED,
  };
  if (note != null && note.trim().length > 0) {
    dtoIn.desc = note.trim();
  }

  try {
    await uubtPost(activity.sourceAppBaseUri, SET_STATE_USE_CASE, dtoIn);
    log.info('uubt: schůzka označena za vyřešenou');
  } catch (error) {
    if (error instanceof UubtApiError) {
      logUubtErrorMap('activity/elementary/setState', error.body);
      if (error.isUnsupportedCommand) {
        throw new Error(
          'Tato instance Plus4U neumí uzavřít schůzku přes API. Uzavřete ji prosím ručně v Plus4U.'
        );
      }
      if (error.isInvalidDtoIn) {
        throw new Error(
          'Plus4U odmítlo požadavek na uzavření schůzky. Podrobnosti jsou v logu (Minutes → Log).'
        );
      }
    }
    throw error;
  }
}

export { isUubtMeetingSolvableByMe };
