// Copyright 2026 uuMinutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX, MouseEvent } from 'react';

import type { LocalizerType } from '../../types/I18N.std.ts';
import { APP_DISPLAY_NAME } from '../branding.std.ts';
import {
  UUMINUTES_AUTHOR,
  UUMINUTES_AUTHOR_SIGNAL_USERNAME,
  UUMINUTES_README_LABEL,
  UUMINUTES_WELCOME_FEATURES_HEADING,
  UUMINUTES_WELCOME_TAGLINE,
  UUMINUTES_WELCOME_TILES,
  UUMINUTES_WELCOME_TITLE,
} from '../welcomeContent.std.ts';
import { UuMinutesVersionFooter } from './UuMinutesVersionFooter.dom.tsx';

const UUMINUTES_ICON_PATH = 'images/uuminutes/app-icon-source.png';

type Props = Readonly<{
  isStaging: boolean;
  i18n: LocalizerType;
}>;

function handleOpenReadme(event: MouseEvent<HTMLAnchorElement>): void {
  event.preventDefault();
  void window.uuMinutes?.openReadme();
}

export function UuMinutesWelcomeSplash({
  isStaging,
}: Props): JSX.Element {
  const appVersion =
    typeof window.getVersion === 'function'
      ? window.getVersion()
      : window.SignalContext.getVersion();

  return (
    <div className="UuMinutesWelcomeSplash">
      <img
        className="UuMinutesWelcomeSplash__logo"
        src={UUMINUTES_ICON_PATH}
        alt={APP_DISPLAY_NAME}
        width={96}
        height={96}
      />
      <h3 className="Inbox__welcome UuMinutesWelcomeSplash__title">
        {isStaging ? `STAGING — ${APP_DISPLAY_NAME}` : UUMINUTES_WELCOME_TITLE}
      </h3>
      <p className="UuMinutesWelcomeSplash__tagline">{UUMINUTES_WELCOME_TAGLINE}</p>
      <p className="UuMinutesWelcomeSplash__featuresHeading">
        {UUMINUTES_WELCOME_FEATURES_HEADING}
      </p>
      <div className="UuMinutesWelcomeSplash__tiles">
        {UUMINUTES_WELCOME_TILES.map(tile => (
          <article
            key={tile.id}
            className={`UuMinutesWelcomeSplash__tile UuMinutesWelcomeSplash__tile--${tile.id}`}
          >
            <h4 className="UuMinutesWelcomeSplash__tileTitle">{tile.title}</h4>
            {tile.id === 'about' ? (
              <div className="UuMinutesWelcomeSplash__about">
                <dl className="UuMinutesWelcomeSplash__aboutMeta">
                  <div>
                    <dt>Autor</dt>
                    <dd>{UUMINUTES_AUTHOR}</dd>
                  </div>
                  <div>
                    <dt>Signal</dt>
                    <dd>@{UUMINUTES_AUTHOR_SIGNAL_USERNAME}</dd>
                  </div>
                </dl>
                <a
                  className="UuMinutesWelcomeSplash__readmeLink"
                  href="#"
                  onClick={handleOpenReadme}
                >
                  {UUMINUTES_README_LABEL}
                </a>
              </div>
            ) : (
              <p className="UuMinutesWelcomeSplash__tileDescription">
                {tile.description}
              </p>
            )}
          </article>
        ))}
      </div>
      <UuMinutesVersionFooter appVersion={appVersion} />
    </div>
  );
}
