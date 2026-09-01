import { useEffect } from 'react';

interface ShortcutHandler {
  key: string;
  handler: () => void;
  description: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}

export const useKeyboardShortcuts = (shortcuts: ShortcutHandler[]) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const matchingShortcut = shortcuts.find(shortcut => {
        const keyMatches = shortcut.key.toLowerCase() === event.key.toLowerCase();
        const ctrlMatches = (shortcut.ctrlKey ?? false) === event.ctrlKey;
        const shiftMatches = (shortcut.shiftKey ?? false) === event.shiftKey;
        const altMatches = (shortcut.altKey ?? false) === event.altKey;
        
        return keyMatches && ctrlMatches && shiftMatches && altMatches;
      });

      if (matchingShortcut) {
        event.preventDefault();
        matchingShortcut.handler();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
};

// Common dashboard shortcuts
export const useDashboardShortcuts = ({
  onNewRepository,
  onSearch,
  onToggleTheme,
  onRefresh
}: {
  onNewRepository: () => void;
  onSearch: () => void;
  onToggleTheme: () => void;
  onRefresh: () => void;
}) => {
  useKeyboardShortcuts([
    {
      key: 'n',
      ctrlKey: true,
      handler: onNewRepository,
      description: 'Create new repository'
    },
    {
      key: '/',
      handler: onSearch,
      description: 'Focus search'
    },
    {
      key: 'd',
      ctrlKey: true,
      handler: onToggleTheme,
      description: 'Toggle theme'
    },
    {
      key: 'r',
      ctrlKey: true,
      shiftKey: true,
      handler: onRefresh,
      description: 'Refresh repositories'
    }
  ]);
};