// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useRef, useState, type JSX, type ReactNode } from 'react';

import { MinutesIcon, type MinutesIconName } from './MinutesIcon.dom.tsx';

/** Čtvereček s ikonou. Popisek jde do tooltipu i do přístupnosti. */
export function MinutesIconButton({
  icon,
  label,
  tone,
  disabled,
  isActive,
  keepFocus,
  onClick,
}: Readonly<{
  icon: MinutesIconName;
  label: string;
  tone?: 'default' | 'danger';
  disabled?: boolean;
  isActive?: boolean;
  /** Nechá focus a výběr v editoru — nutné pro formátovací lištu. */
  keepFocus?: boolean;
  onClick: () => void;
}>): JSX.Element {
  const className = ['MinutesIconButton']
    .concat(tone === 'danger' ? ['MinutesIconButton--danger'] : [])
    .join(' ');

  return (
    <button
      type="button"
      className={className}
      title={label}
      aria-label={label}
      aria-pressed={isActive}
      disabled={disabled === true}
      onMouseDown={
        keepFocus === true ? event => event.preventDefault() : undefined
      }
      onClick={onClick}
    >
      <MinutesIcon name={icon} />
    </button>
  );
}

/**
 * Ikona, která rozbalí malý panel s volbami. Na rozdíl od nabídky v něm
 * fungují i selecty a textová pole.
 */
export function MinutesOptionsPopover({
  icon,
  label,
  disabled,
  children,
}: Readonly<{
  icon: MinutesIconName;
  label: string;
  disabled?: boolean;
  children: (close: () => void) => ReactNode;
}>): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onPointerDown = (event: MouseEvent): void => {
      if (
        event.target instanceof Node &&
        wrapperRef.current?.contains(event.target) !== true
      ) {
        setIsOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="MinutesOptionsPopover" ref={wrapperRef}>
      <MinutesIconButton
        icon={icon}
        label={label}
        disabled={disabled}
        isActive={isOpen}
        onClick={() => setIsOpen(value => !value)}
      />
      {isOpen && (
        <div
          className="MinutesOptionsPopover__panel"
          role="dialog"
          aria-label={label}
        >
          {children(() => setIsOpen(false))}
        </div>
      )}
    </div>
  );
}
