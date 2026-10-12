import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { Search, Loader2 } from "lucide-react";
import { BrandChip } from "../shared/BrandChip";
import { optionId, type SearchResult, type ResultGroup } from "./searchResults";
import { SuggestList } from "./SuggestList";
import { searchMasterFn } from "@/lib/mongodb/serverFns/search";

/** "VetOS Master Search": Live MongoDB-driven search engine scoped to current tenant. */
export function FetchSearch() {
  const navigate = useNavigate();
  const listId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { id } = useParams({ strict: false });
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<ResultGroup[]>([]);

  // Real-time debounced server search
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchMasterFn({ data: { q: query } });
        if (!cancelled) {
          setGroups(res as ResultGroup[]);
        }
      } catch (err) {
        console.error("[MasterSearch] Failed to fetch live results:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  const show = () => {
    setOpen(true);
    setActive(0);
  };
  const close = () => setOpen(false);

  const choose = (item: SearchResult) => {
    close();
    setQuery("");
    inputRef.current?.blur();

    if (item.toModule) {
      navigate({
        to: "/m/$moduleId",
        params: { moduleId: item.toModule },
      });
      return;
    }

    if (item.section && item.petId) {
      navigate({
        to: "/patient/$id/$section",
        params: { id: item.petId, section: item.section },
      });
    } else if (item.petId) {
      navigate({ to: "/patient/$id", params: { id: item.petId } });
    }
  };

  // Press "/" anywhere to jump to the search bar.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const el = document.activeElement;
      const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
      if (e.key === "/" && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Close when clicking anywhere outside the search.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!formRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && flat.length) {
      e.preventDefault();
      if (!open) show();
      else setActive((i) => (i + 1) % flat.length);
    } else if (e.key === "ArrowUp" && flat.length) {
      e.preventDefault();
      setActive((i) => (i - 1 + flat.length) % flat.length);
    } else if (e.key === "Escape") {
      close();
    }
  };

  return (
    <form
      ref={formRef}
      className="vd-search"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const item = flat[open ? active : 0];
        if (item) choose(item);
        else show();
      }}
    >
      <div className="vd-search-name">
        <BrandChip /> Master Search
      </div>
      <label className="vd-search-box">
        {loading ? (
          <Loader2 className="size-4 animate-spin text-primary" strokeWidth={2.5} aria-hidden="true" />
        ) : (
          <Search strokeWidth={2} aria-hidden="true" />
        )}
        <input
          ref={inputRef}
          type="search"
          value={query}
          placeholder="Fetch a patient, owner, medicine or invoice"
          aria-label="VetOS Master Search: find anything in your clinic"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && flat.length ? optionId(listId, active) : undefined}
          onFocus={show}
          onChange={(e) => {
            setQuery(e.target.value);
            show();
          }}
          onKeyDown={onKeyDown}
        />
        <span className="vd-kbd" aria-hidden="true">
          Press /
        </span>
        <button className="vd-fetch-btn" type="submit">
          Fetch
        </button>
      </label>
      {open && (
        <SuggestList
          id={listId}
          groups={groups}
          query={query}
          activeIndex={active}
          onChoose={choose}
        />
      )}
    </form>
  );
}
