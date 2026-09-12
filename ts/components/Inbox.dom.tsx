// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode, JSX } from 'react';
import type { SmartNavTabsProps } from '../state/smart/NavTabs.preload.tsx';
import { TitlebarDragArea } from './TitlebarDragArea.dom.tsx';

export type PropsType = {
  isCustomizingPreferredReactions: boolean;
  navTabsCollapsed: boolean;
  onToggleNavTabsCollapse: (navTabsCollapsed: boolean) => unknown;
  renderCallsTab: () => JSX.Element;
  renderChatsTab: () => JSX.Element;
  renderCustomizingPreferredReactionsModal: () => JSX.Element;
  renderMinutesTranscriptsTab: () => JSX.Element;
  renderMinutesBookmarksTab: () => JSX.Element;
  renderNavTabs: (props: SmartNavTabsProps) => JSX.Element;
  renderStoriesTab: () => JSX.Element;
  renderSettingsTab: () => JSX.Element;
};

export function Inbox({
  isCustomizingPreferredReactions,
  navTabsCollapsed,
  onToggleNavTabsCollapse,
  renderCallsTab,
  renderChatsTab,
  renderCustomizingPreferredReactionsModal,
  renderMinutesTranscriptsTab,
  renderMinutesBookmarksTab,
  renderNavTabs,
  renderStoriesTab,
  renderSettingsTab,
}: PropsType): JSX.Element {
  let activeModal: ReactNode;
  if (isCustomizingPreferredReactions) {
    activeModal = renderCustomizingPreferredReactionsModal();
  }

  return (
    <>
      <div className="Inbox">
        {renderNavTabs({
          navTabsCollapsed,
          onToggleNavTabsCollapse,
          renderChatsTab,
          renderCallsTab,
          renderMinutesTranscriptsTab,
          renderMinutesBookmarksTab,
          renderStoriesTab,
          renderSettingsTab,
        })}
        <TitlebarDragArea />
      </div>
      {activeModal}
    </>
  );
}
