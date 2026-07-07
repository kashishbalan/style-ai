const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type Item = {
  id: number;
  filename: string;
  image_path: string;
  category: string | null;
  created_at: string;
};

export async function fetchItems(): Promise<Item[]> {
  const res = await fetch(`${API_URL}/items`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch items");
  return res.json();
}

export async function uploadItem(file: File, category?: string): Promise<Item> {
  const form = new FormData();
  form.append("file", file);

  const params = category ? `?category=${encodeURIComponent(category)}` : "";
  const res = await fetch(`${API_URL}/upload${params}`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error("Upload failed");
  return res.json();
}

export function imageUrl(path: string): string {
  return `${API_URL}${path}`;
}

export async function fetchSimilar(itemId: number): Promise<Item[]> {
  const res = await fetch(`${API_URL}/items/${itemId}/similar`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch similar items");
  return res.json();
}

export type Collection = {
  id: number;
  name: string;
  created_at: string;
  item_count: number;
  cover_image_path: string | null;
};

export type CollectionDetail = {
  id: number;
  name: string;
  created_at: string;
  items: Item[];
};

export async function fetchCollections(): Promise<Collection[]> {
  const res = await fetch(`${API_URL}/collections`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch collections");
  return res.json();
}

export async function fetchCollectionDetail(
  id: number
): Promise<CollectionDetail> {
  const res = await fetch(`${API_URL}/collections/${id}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch collection");
  return res.json();
}

export async function createCollection(name: string): Promise<Collection> {
  const res = await fetch(`${API_URL}/collections`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error("Failed to create collection");
  return res.json();
}

export async function addItemToCollection(
  collectionId: number,
  itemId: number
): Promise<Collection> {
  const res = await fetch(`${API_URL}/collections/${collectionId}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item_id: itemId }),
  });
  if (!res.ok) throw new Error("Failed to save to collection");
  return res.json();
}

export async function removeItemFromCollection(
  collectionId: number,
  itemId: number
): Promise<Collection> {
  const res = await fetch(
    `${API_URL}/collections/${collectionId}/items/${itemId}`,
    { method: "DELETE" }
  );
  if (!res.ok) throw new Error("Failed to remove from collection");
  return res.json();
}
