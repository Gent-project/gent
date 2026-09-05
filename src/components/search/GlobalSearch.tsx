"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BookMarked, CornerDownLeft, Search, UserRound } from "lucide-react";

import { useDebouncedValue, useRepositorySearch, useUserSearch } from "@/hooks/use-search";
import { PUBLIC_PATH } from "@/routes/path";
import { getRepoOwner } from "@/lib/user-display";

type Suggestion =
  | { kind: "repo"; key: string; href: string; title: string; subtitle: string }
  | { kind: "user"; key: string; href: string; title: string; subtitle: string }
  | { kind: "all"; key: string; href: string; title: string; subtitle: string };

/**
 * Header search, modelled on GitHub's: "/" focuses it, typing opens a
 * suggestion panel of repositories and people, arrows move, Enter opens the
 * highlighted row, and Enter with nothing highlighted runs the full search.
 * Available to signed-out visitors — every query it makes is public.
 */
export default function GlobalSearch({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState<number | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const debounced = useDebouncedValue(query, 200);
  const trimmed = debounced.trim();

  const repos = useRepositorySearch(trimmed, { sort: "best" });
  const users = useUserSearch(trimmed);

  const suggestions = useMemo<Suggestion[]>(() => {
    if (!trimmed) return [];

    const repoRows: Suggestion[] = (repos.data?.results ?? []).slice(0, 5).map((repo) => ({
      kind: "repo",
      key: `repo-${repo.id}`,
      href: PUBLIC_PATH.REPOSITORY(getRepoOwner(repo), repo.name),
      title: `${getRepoOwner(repo)}/${repo.name}`,
      subtitle: repo.description || "No description",
    }));

    const userRows: Suggestion[] = (users.data?.results ?? []).slice(0, 3).map((user) => ({
      kind: "user",
      key: `user-${user.id}`,
      href: PUBLIC_PATH.PROFILE(user.username),
      title: user.username,
      subtitle: `${user.public_repo_count} public ${
        user.public_repo_count === 1 ? "repository" : "repositories"
      }`,
    }));

    return [
      ...repoRows,
      ...userRows,
      {
        kind: "all",
        key: "all",
        href: PUBLIC_PATH.SEARCH(trimmed),
        title: `Search for “${trimmed}”`,
        subtitle: "in all of Gent",
      },
    ];
  }, [trimmed, repos.data, users.data]);

  useEffect(() => setCursor(null), [trimmed]);

  // "/" focuses the box, the way it does on GitHub, unless you are typing.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (event.key === "/" && !typing) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    inputRef.current?.blur();
    router.push(href);
  };

  const submitSearch = () => {
    const value = query.trim();
    if (value) go(PUBLIC_PATH.SEARCH(value));
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }

    if (!open || suggestions.length === 0) {
      if (event.key === "Enter") submitSearch();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((value) => (value === null ? 0 : (value + 1) % suggestions.length));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((value) =>
        value === null ? suggestions.length - 1 : (value - 1 + suggestions.length) % suggestions.length,
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (cursor === null) submitSearch();
      else go(suggestions[cursor].href);
    }
  };

  const showPanel = open && trimmed.length > 0 && trimmed === query.trim();
  const loading = repos.isLoading || users.isLoading;

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
        aria-hidden
      />
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls="global-search-results"
        aria-label="Search repositories and people"
        autoComplete="off"
        value={query}
        placeholder="Search or jump to…"
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="w-full rounded-lg border border-line bg-surface/60 py-1.5 pl-9 pr-9 text-sm text-fg outline-none transition-colors placeholder:text-faint focus:border-brand/50 focus:bg-surface"
      />
      {!query && (
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-line px-1.5 py-0.5 font-mono text-[10px] text-faint sm:block">
          /
        </kbd>
      )}

      {showPanel && (
        <div
          id="global-search-results"
          role="listbox"
          className="glass-strong absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl shadow-2xl sm:min-w-[420px]"
        >
          {loading && suggestions.length <= 1 ? (
            <p className="px-3 py-4 text-sm text-muted">Searching…</p>
          ) : (
            suggestions.map((item, index) => {
              const active = index === cursor;
              const isAll = item.kind === "all";

              return (
                <button
                  key={item.key}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onMouseEnter={() => setCursor(index)}
                  onClick={() => go(item.href)}
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                    active ? "bg-brand/12" : ""
                  } ${isAll ? "border-t border-line" : ""}`}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-line text-muted">
                    {item.kind === "repo" ? (
                      <BookMarked className="h-3.5 w-3.5" />
                    ) : item.kind === "user" ? (
                      <UserRound className="h-3.5 w-3.5" />
                    ) : (
                      <Search className="h-3.5 w-3.5" />
                    )}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-fg" data-no-translate>
                      {item.title}
                    </span>
                    <span className="block truncate text-xs text-muted">{item.subtitle}</span>
                  </span>

                  {active && (
                    <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-faint" aria-hidden />
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
