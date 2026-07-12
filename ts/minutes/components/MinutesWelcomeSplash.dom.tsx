// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX, MouseEvent } from 'react';

import type { LocalizerType } from '../../types/I18N.std.ts';
import { APP_DISPLAY_NAME } from '../branding.std.ts';
import {
  MINUTES_AUTHOR,
  MINUTES_AUTHOR_SIGNAL_USERNAME,
  MINUTES_PUBLIC_SIGNAL_GROUP_LINK_LABEL,
  MINUTES_PUBLIC_SIGNAL_GROUP_URL,
  MINUTES_README_LABEL,
  MINUTES_WELCOME_FEATURES_HEADING,
  MINUTES_WELCOME_TAGLINE,
  MINUTES_WELCOME_TILES,
  MINUTES_WELCOME_TITLE,
} from '../welcomeContent.std.ts';
import { MinutesVersionFooter } from './MinutesVersionFooter.dom.tsx';

const MINUTES_ICON_PATH = 'images/minutes/app-icon-source.png';

type Props = Readonly<{
  isStaging: boolean;
  i18n: LocalizerType;
}>;

function handleOpenReadme(event: MouseEvent<HTMLAnchorElement>): void {
  event.preventDefault();
  void window.minutes?.openReadme();
}

export function MinutesWelcomeSplash({
  isStaging,
}: Props): JSX.Element {
  const appVersion =
    typeof window.getVersion === 'function'
      ? window.getVersion()
      : window.SignalContext.getVersion();

  return (
    <div className="MinutesWelcomeSplash">
      <img
        className="MinutesWelcomeSplash__logo"
        src={MINUTES_ICON_PATH}
        alt={APP_DISPLAY_NAME}
        width={96}
        height={96}
      />
      <h3 className="Inbox__welcome MinutesWelcomeSplash__title">
        {isStaging ? `STAGING — ${APP_DISPLAY_NAME}` : MINUTES_WELCOME_TITLE}
      </h3>
      <p className="MinutesWelcomeSplash__tagline">{MINUTES_WELCOME_TAGLINE}</p>
      <p className="MinutesWelcomeSplash__featuresHeading">
        {MINUTES_WELCOME_FEATURES_HEADING}
      </p>
      <div className="MinutesWelcomeSplash__tiles">
        {MINUTES_WELCOME_TILES.map(tile => (
          <article
            key={tile.id}
            className={`MinutesWelcomeSplash__tile MinutesWelcomeSplash__tile--${tile.id}`}
          >
            <h4 className="MinutesWelcomeSplash__tileTitle">{tile.title}</h4>
            {tile.id === 'about' ? (
              <div className="MinutesWelcomeSplash__about">
                <dl className="MinutesWelcomeSplash__aboutMeta">
                  <div>
                    <dt>Autor</dt>
                    <dd>{MINUTES_AUTHOR}</dd>
                  </div>
                  <div>
                    <dt>Signal</dt>
                    <dd>@{MINUTES_AUTHOR_SIGNAL_USERNAME}</dd>
                  </div>
                  <div>
                    <dt>Skupina</dt>
                    <dd>
                      <a
                        className="MinutesWelcomeSplash__externalLink"
                        href={MINUTES_PUBLIC_SIGNAL_GROUP_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {MINUTES_PUBLIC_SIGNAL_GROUP_LINK_LABEL}
                      </a>
                    </dd>
                  </div>
                </dl>
                <a
                  className="MinutesWelcomeSplash__readmeLink"
                  href="#"
                  onClick={handleOpenReadme}
                >
                  {MINUTES_README_LABEL}
                </a>
              </div>
            ) : (
              <p className="MinutesWelcomeSplash__tileDescription">
                {tile.description}
              </p>
            )}
          </article>
        ))}
      </div>
      <MinutesVersionFooter appVersion={appVersion} />
    </div>
  );
}
