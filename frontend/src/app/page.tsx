"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchItems,
  fetchSimilar,
  uploadItem,
  imageUrl,
  fetchCollections,
  fetchCollectionDetail,
  createCollection,
  addItemToCollection,
  removeItemFromCollection,
  type Item,
  type Collection,
  type CollectionDetail,
} from "@/lib/api";
import {
  BookmarkIcon,
  SparkleIcon,
  ArrowLeftIcon,
  CloseIcon,
  UploadIcon,
} from "@/components/icons";

type Toast = { message: string; kind: "success" | "error" };
type Tab = "feed" | "collections";

function ItemImage({ item }: { item: Item }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageUrl(item.image_path)}
      alt={item.filename}
      loading="lazy"
      className="w-full object-cover opacity-0 transition-all duration-300 group-hover:scale-105 [&.loaded]:opacity-100"
      onLoad={(e) => e.currentTarget.classList.add("loaded")}
    />
  );
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("feed");
  const [items, setItems] = useState<Item[]>([]);
  const [category, setCategory] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [similarTo, setSimilarTo] = useState<Item | null>(null);
  const [similarItems, setSimilarItems] = useState<Item[]>([]);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [saveMenuFor, setSaveMenuFor] = useState<number | null>(null);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [activeCollection, setActiveCollection] =
    useState<CollectionDetail | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadItems() {
    try {
      setItems(await fetchItems());
      setError(null);
    } catch {
      setError("Couldn't reach the API. Is the backend running on :8000?");
    }
  }

  async function loadCollections() {
    try {
      setCollections(await fetchCollections());
    } catch {
      // collections are secondary; feed still works without them
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetchItems()
      .then((data) => {
        if (!cancelled) {
          setItems(data);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Couldn't reach the API. Is the backend running on :8000?");
        }
      });
    fetchCollections()
      .then((data) => {
        if (!cancelled) setCollections(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const categories = useMemo(
    () =>
      Array.from(
        new Set(items.map((item) => item.category).filter(Boolean))
      ) as string[],
    [items]
  );

  const visibleItems = useMemo(
    () =>
      activeFilter ? items.filter((item) => item.category === activeFilter) : items,
    [items, activeFilter]
  );

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      await uploadItem(file, category || undefined);
      await loadItems();
      setToast({ message: "Uploaded", kind: "success" });
    } catch {
      setToast({ message: "Upload failed", kind: "error" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  }

  async function handleFindSimilar(item: Item) {
    setSimilarTo(item);
    setSimilarLoading(true);
    try {
      setSimilarItems(await fetchSimilar(item.id));
    } catch {
      setSimilarItems([]);
    } finally {
      setSimilarLoading(false);
    }
  }

  async function handleSaveToCollection(itemId: number, collectionId: number, name: string) {
    try {
      await addItemToCollection(collectionId, itemId);
      await loadCollections();
      setToast({ message: `Saved to ${name}`, kind: "success" });
    } catch {
      setToast({ message: "Couldn't save", kind: "error" });
    } finally {
      setSaveMenuFor(null);
    }
  }

  async function handleCreateAndSave(itemId: number) {
    const name = newCollectionName.trim();
    if (!name) return;
    try {
      const collection = await createCollection(name);
      await handleSaveToCollection(itemId, collection.id, collection.name);
    } catch {
      setToast({ message: "Couldn't create collection", kind: "error" });
    } finally {
      setNewCollectionName("");
    }
  }

  async function openCollection(id: number) {
    try {
      setActiveCollection(await fetchCollectionDetail(id));
    } catch {
      setToast({ message: "Couldn't load collection", kind: "error" });
    }
  }

  async function handleRemoveFromCollection(itemId: number) {
    if (!activeCollection) return;
    try {
      await removeItemFromCollection(activeCollection.id, itemId);
      setActiveCollection(await fetchCollectionDetail(activeCollection.id));
      await loadCollections();
    } catch {
      setToast({ message: "Couldn't remove item", kind: "error" });
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-baseline justify-between">
        <h1 className="font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight text-stone-900">
          StyleAI
        </h1>
        <div className="flex gap-1 rounded-full bg-stone-200/60 p-1">
          <button
            onClick={() => {
              setTab("feed");
              setActiveCollection(null);
            }}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === "feed"
                ? "bg-stone-900 text-white"
                : "text-stone-500 hover:text-stone-800"
            }`}
          >
            Feed
          </button>
          <button
            onClick={() => setTab("collections")}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === "collections"
                ? "bg-stone-900 text-white"
                : "text-stone-500 hover:text-stone-800"
            }`}
          >
            Collections
          </button>
        </div>
      </div>
      <p className="mt-1 text-sm text-stone-500">
        Upload outfit inspiration, then find visually similar looks.
      </p>

      {tab === "feed" && (
        <>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            className={`mt-6 flex flex-wrap items-center gap-3 rounded-2xl border-2 border-dashed p-5 transition-colors ${
              dragActive ? "border-stone-900 bg-stone-100" : "border-stone-300 bg-white/50"
            }`}
          >
            <span className="text-stone-400">
              <UploadIcon />
            </span>
            <input
              type="text"
              placeholder="category (optional)"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-full border border-stone-300 bg-white px-3.5 py-2 text-sm outline-none focus:border-stone-500"
            />
            <label className="cursor-pointer rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700">
              {uploading ? "Uploading..." : "Upload image"}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                disabled={uploading}
              />
            </label>
            <span className="text-xs text-stone-400">
              or drag an image anywhere in this box
            </span>
          </div>

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

          {categories.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                onClick={() => setActiveFilter(null)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  activeFilter === null
                    ? "bg-stone-900 text-white"
                    : "bg-stone-200/70 text-stone-600 hover:bg-stone-200"
                }`}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveFilter(cat)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    activeFilter === cat
                      ? "bg-stone-900 text-white"
                      : "bg-stone-200/70 text-stone-600 hover:bg-stone-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {similarTo && (
            <div className="mt-10 rounded-2xl border border-stone-200 bg-white/60 p-4">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-1.5 text-sm font-medium text-stone-700">
                  <SparkleIcon /> Similar to &ldquo;{similarTo.filename}&rdquo;
                </h2>
                <button
                  onClick={() => setSimilarTo(null)}
                  className="text-xs text-stone-500 hover:text-stone-800"
                >
                  Clear
                </button>
              </div>

              {similarLoading && (
                <p className="mt-3 text-sm text-stone-400">Searching…</p>
              )}

              {!similarLoading && similarItems.length === 0 && (
                <p className="mt-3 text-sm text-stone-400">
                  No similar items found yet — upload more images first.
                </p>
              )}

              <div className="mt-4 flex gap-4 overflow-x-auto">
                {similarItems.map((item) => (
                  <div key={item.id} className="w-32 shrink-0">
                    <div className="overflow-hidden rounded-xl bg-stone-100">
                      <ItemImage item={item} />
                    </div>
                    {item.category && (
                      <p className="mt-1 text-xs text-stone-500">
                        {item.category}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-10 columns-2 gap-4 sm:columns-3 md:columns-4">
            {visibleItems.map((item) => (
              <div
                key={item.id}
                className={`group relative mb-4 break-inside-avoid rounded-2xl transition-shadow hover:shadow-xl ${
                  similarTo?.id === item.id ? "ring-2 ring-stone-900" : ""
                }`}
              >
                <div
                  onClick={() => handleFindSimilar(item)}
                  className="cursor-pointer overflow-hidden rounded-2xl bg-stone-100"
                >
                  <ItemImage item={item} />
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setNewCollectionName("");
                    setSaveMenuFor(saveMenuFor === item.id ? null : item.id);
                  }}
                  className="absolute right-2 top-2 rounded-full bg-white/90 p-2 text-stone-700 opacity-0 shadow transition-opacity hover:bg-white group-hover:opacity-100"
                  aria-label="Save to collection"
                >
                  <BookmarkIcon />
                </button>

                {saveMenuFor === item.id && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setSaveMenuFor(null)}
                    />
                    <div className="absolute right-2 top-11 z-20 w-48 rounded-xl border border-stone-200 bg-white p-2 shadow-lg">
                      <p className="px-2 pb-1 pt-1 text-xs font-medium text-stone-400">
                        Save to collection
                      </p>
                      {collections.map((c) => (
                        <button
                          key={c.id}
                          onClick={() =>
                            handleSaveToCollection(item.id, c.id, c.name)
                          }
                          className="block w-full truncate rounded-md px-2 py-1.5 text-left text-sm text-stone-700 hover:bg-stone-100"
                        >
                          {c.name}
                        </button>
                      ))}
                      <div className="mt-1 flex gap-1 border-t border-stone-100 pt-2">
                        <input
                          value={newCollectionName}
                          onChange={(e) => setNewCollectionName(e.target.value)}
                          placeholder="New collection"
                          className="w-full rounded-md border border-stone-200 px-2 py-1 text-xs outline-none focus:border-stone-400"
                        />
                        <button
                          onClick={() => handleCreateAndSave(item.id)}
                          className="rounded-md bg-stone-900 px-2 py-1 text-xs text-white hover:bg-stone-700"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </>
                )}

                <div className="mt-1.5 flex items-center justify-between px-0.5">
                  {item.category ? (
                    <p className="text-xs text-stone-500">{item.category}</p>
                  ) : (
                    <span />
                  )}
                  <button
                    onClick={() => handleFindSimilar(item)}
                    className="flex items-center gap-1 text-xs font-medium text-stone-600 opacity-0 transition-opacity hover:text-stone-900 group-hover:opacity-100"
                  >
                    <SparkleIcon /> Find similar
                  </button>
                </div>
              </div>
            ))}
          </div>

          {visibleItems.length === 0 && !error && (
            <p className="mt-10 text-sm text-stone-400">
              {items.length === 0
                ? "No items yet — upload one above."
                : "No items in this category."}
            </p>
          )}
        </>
      )}

      {tab === "collections" && !activeCollection && (
        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {collections.map((c) => (
            <button
              key={c.id}
              onClick={() => openCollection(c.id)}
              className="text-left"
            >
              <div className="aspect-square overflow-hidden rounded-2xl bg-stone-100 shadow-sm transition-shadow hover:shadow-xl">
                {c.cover_image_path && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imageUrl(c.cover_image_path)}
                    alt={c.name}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <p className="mt-1.5 text-sm font-medium text-stone-800">
                {c.name}
              </p>
              <p className="text-xs text-stone-400">
                {c.item_count} {c.item_count === 1 ? "item" : "items"}
              </p>
            </button>
          ))}

          {collections.length === 0 && (
            <p className="col-span-full text-sm text-stone-400">
              No collections yet — hover an item in the Feed and tap the
              bookmark icon to save it somewhere.
            </p>
          )}
        </div>
      )}

      {tab === "collections" && activeCollection && (
        <div className="mt-10">
          <button
            onClick={() => setActiveCollection(null)}
            className="flex items-center gap-1.5 text-sm font-medium text-stone-600 hover:text-stone-900"
          >
            <ArrowLeftIcon /> All collections
          </button>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-2xl font-semibold text-stone-900">
            {activeCollection.name}
          </h2>

          <div className="mt-6 columns-2 gap-4 sm:columns-3 md:columns-4">
            {activeCollection.items.map((item) => (
              <div
                key={item.id}
                className="group relative mb-4 break-inside-avoid rounded-2xl"
              >
                <div className="overflow-hidden rounded-2xl bg-stone-100">
                  <ItemImage item={item} />
                </div>
                <button
                  onClick={() => handleRemoveFromCollection(item.id)}
                  className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-stone-700 opacity-0 shadow transition-opacity hover:bg-white group-hover:opacity-100"
                  aria-label="Remove from collection"
                >
                  <CloseIcon />
                </button>
              </div>
            ))}
          </div>

          {activeCollection.items.length === 0 && (
            <p className="mt-6 text-sm text-stone-400">
              Nothing saved here yet.
            </p>
          )}
        </div>
      )}

      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full px-4 py-2 text-sm text-white shadow-lg ${
            toast.kind === "success" ? "bg-stone-900" : "bg-red-600"
          }`}
        >
          {toast.message}
        </div>
      )}
    </main>
  );
}
