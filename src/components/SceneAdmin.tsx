"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/lib/store";
import type { SanctuarySceneConfig, SanctuarySceneObjectLayout } from "@/lib/types";
import {
  DEFAULT_SCENE_OBJECT_LAYOUT,
  defaultLayoutForObjects,
  sortScenes,
  validateSceneForPublish,
} from "@/lib/sanctuaryScenes";

const OBJECT_ICONS: Record<string, string> = {
  seed: "🌱",
  tree: "🌳",
  flowers: "🌸",
  bushes: "🌿",
  rocks: "🪨",
  pond: "💧",
  bridge: "🌉",
  cabin: "🏡",
  lantern: "🏮",
  moon: "🌙",
  fireflies: "✨",
  shore: "🏝️",
  waves: "🌊",
};

const EDITOR_DEVICES = [
  { label: "iPhone SE", width: 375, height: 667 },
  { label: "iPhone 15", width: 393, height: 852 },
  { label: "Pro Max", width: 430, height: 932 },
  { label: "iPad", width: 768, height: 1024 },
  { label: "Desktop", width: 1024, height: 720 },
];

type ResizeHandle =
  | "n"
  | "s"
  | "e"
  | "w"
  | "ne"
  | "nw"
  | "se"
  | "sw";

const RESIZE_HANDLES: { key: ResizeHandle; className: string; cursor: string }[] = [
  { key: "n", className: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2", cursor: "cursor-ns-resize" },
  { key: "s", className: "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2", cursor: "cursor-ns-resize" },
  { key: "e", className: "right-0 top-1/2 -translate-y-1/2 translate-x-1/2", cursor: "cursor-ew-resize" },
  { key: "w", className: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2", cursor: "cursor-ew-resize" },
  { key: "ne", className: "right-0 top-0 -translate-y-1/2 translate-x-1/2", cursor: "cursor-nesw-resize" },
  { key: "nw", className: "left-0 top-0 -translate-x-1/2 -translate-y-1/2", cursor: "cursor-nwse-resize" },
  { key: "se", className: "bottom-0 right-0 translate-x-1/2 translate-y-1/2", cursor: "cursor-nwse-resize" },
  { key: "sw", className: "bottom-0 left-0 -translate-x-1/2 translate-y-1/2", cursor: "cursor-nesw-resize" },
];

function normalizedLayout(layout: SanctuarySceneObjectLayout): SanctuarySceneObjectLayout {
  return {
    ...layout,
    width: layout.width ?? Math.max(18, layout.scale * 118),
    height: layout.height ?? Math.max(18, layout.scale * 118),
  };
}

function layoutForScene(scene: SanctuarySceneConfig) {
  const fallback = defaultLayoutForObjects(scene.unlockableObjects);
  return scene.unlockableObjects.reduce<Record<string, SanctuarySceneObjectLayout>>(
    (layout, object) => ({
      ...layout,
      [object]: scene.objectLayout?.[object] ?? fallback[object],
    }),
    {}
  );
}

function objectAssetsForScene(scene: SanctuarySceneConfig) {
  return scene.unlockableObjects.reduce<Record<string, string>>(
    (assets, object) => ({
      ...assets,
      [object]: scene.objectAssets?.[object] ?? `scene://${scene.id}/${object}`,
    }),
    {}
  );
}

function assetLabel(assetUrl: string) {
  if (assetUrl.startsWith("data:")) return "Uploaded asset";
  const clean = assetUrl.split("?")[0].split("#")[0];
  return clean.split("/").filter(Boolean).pop()?.replace(/\.[a-z0-9]+$/i, "") ?? "asset";
}

function objectIconFor(objectKey: string, assetUrl?: string) {
  const assetKey = assetUrl ? assetLabel(assetUrl) : "";
  const baseKey = objectKey.replace(/-copy(-\d+)?$/i, "");
  return OBJECT_ICONS[objectKey] ?? OBJECT_ICONS[assetKey] ?? OBJECT_ICONS[baseKey] ?? "◌";
}

function makeObjectKey(label: string, existing: string[]) {
  const base = label
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "asset";
  let key = base;
  let index = 2;
  while (existing.includes(key)) {
    key = `${base}-${index}`;
    index += 1;
  }
  return key;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function removeCheckerboardFromDataUrl(dataUrl: string) {
  return new Promise<string>((resolve) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const maxSize = 1400;
      const ratio = Math.min(1, maxSize / Math.max(image.width, image.height));
      canvas.width = Math.max(1, Math.round(image.width * ratio));
      canvas.height = Math.max(1, Math.round(image.height * ratio));
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) {
        resolve(dataUrl);
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const data = pixels.data;
      for (let index = 0; index < data.length; index += 4) {
        const red = data[index];
        const green = data[index + 1];
        const blue = data[index + 2];
        const max = Math.max(red, green, blue);
        const min = Math.min(red, green, blue);
        const isGray = max - min < 14;
        const isCheckerLight = isGray && max > 180;
        const isCheckerMid = isGray && max > 115 && max < 178;
        if (isCheckerLight || isCheckerMid) {
          data[index + 3] = 0;
        }
      }
      context.putImageData(pixels, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });
}

function blankScene(order: number): SanctuarySceneConfig {
  const now = new Date().toISOString();
  return {
    id: `scene-${Date.now()}`,
    name: "New Sanctuary",
    status: "draft",
    unlockRequirementType: "total_checkins",
    unlockRequirementValue: 30,
    maxCheckIns: 90,
    sortOrder: order,
    updatedAt: now,
    previewImage: "linear-gradient(135deg,#151936,#352157,#090D16)",
    backgroundAssetUrl: "scene://custom/background",
    groundAssetUrl: "scene://custom/ground",
    assetUrls: ["scene://custom/tree"],
    unlockableObjects: ["tree"],
    objectAssets: { tree: "scene://custom/tree" },
    objectLayout: defaultLayoutForObjects(["tree"]),
  };
}

export default function SceneAdmin({
  onPreviewScene,
}: {
  onPreviewScene?: (scene: SanctuarySceneConfig) => void;
}) {
  const scenes = useApp((s) => s.sanctuaryScenes);
  const versions = useApp((s) => s.sanctuarySceneVersions);
  const saveSceneDraft = useApp((s) => s.saveSceneDraft);
  const publishScene = useApp((s) => s.publishScene);
  const setSceneStatus = useApp((s) => s.setSceneStatus);
  const duplicateScene = useApp((s) => s.duplicateScene);
  const deleteScene = useApp((s) => s.deleteScene);
  const rollbackScene = useApp((s) => s.rollbackScene);
  const ordered = useMemo(() => sortScenes(scenes), [scenes]);
  const [selectedId, setSelectedId] = useState(ordered[0]?.id ?? "");
  const selected = ordered.find((scene) => scene.id === selectedId) ?? ordered[0];
  const [draft, setDraft] = useState<SanctuarySceneConfig | null>(selected ?? null);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [activeObject, setActiveObject] = useState(selected?.unlockableObjects[0] ?? "");
  const [previewCheckIns, setPreviewCheckIns] = useState(selected?.maxCheckIns ?? 90);

  function selectScene(scene: SanctuarySceneConfig) {
    setSelectedId(scene.id);
    setDraft(scene);
    setActiveObject(scene.unlockableObjects[0] ?? "");
    setPreviewCheckIns(scene.maxCheckIns);
    setErrors([]);
  }

  function updateDraft(patch: Partial<SanctuarySceneConfig>) {
    setDraft((current) => {
      if (!current) return current;
      const next = { ...current, ...patch };
      return next;
    });
  }

  function updateDraftAndSave(patch: Partial<SanctuarySceneConfig>) {
    if (!draft) return;
    const next = { ...draft, ...patch };
    setDraft(next);
    saveSceneDraft(next);
  }

  useEffect(() => {
    if (draft) onPreviewScene?.(draft);
  }, [draft, onPreviewScene]);

  if (!draft) {
    return (
      <section className="rounded-xl2 border border-edge bg-card p-4 shadow-card">
        <div className="flex flex-col gap-3 rounded-2xl border border-edge bg-ink p-6 text-center">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-calm">
            Live Publishing
          </p>
          <h2 className="text-2xl font-black tracking-tight">No scenes yet</h2>
          <p className="text-sm text-dim">
            Create a new sanctuary draft to start publishing scenes.
          </p>
          <button
            onClick={() => {
              const scene = blankScene(1);
              saveSceneDraft(scene);
              selectScene(scene);
            }}
            className="mx-auto min-h-[44px] rounded-2xl border border-calm bg-calm/10 px-4 text-sm font-black text-calm"
          >
            New Draft
          </button>
        </div>
      </section>
    );
  }

  const sceneVersions = versions
    .filter((version) => version.sceneId === draft.id)
    .sort((a, b) => b.versionNumber - a.versionNumber);
  const validation = validateSceneForPublish(draft, scenes);
  const sceneLayout = layoutForScene(draft);
  const sceneObjectAssets = objectAssetsForScene(draft);

  async function addUploadedFiles(files: FileList | File[], point?: { x: number; y: number }) {
    if (!draft) return;
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) return;

    let nextDraft: SanctuarySceneConfig = draft;
    for (const file of imageFiles) {
      const dataUrl = await removeCheckerboardFromDataUrl(await fileToDataUrl(file));
      const objectKey = makeObjectKey(file.name, nextDraft.unlockableObjects);
      nextDraft = {
        ...nextDraft,
        assetUrls: [...nextDraft.assetUrls, dataUrl],
        unlockableObjects: [...nextDraft.unlockableObjects, objectKey],
        objectAssets: {
          ...nextDraft.objectAssets,
          [objectKey]: dataUrl,
        },
        objectLayout: {
          ...layoutForScene(nextDraft),
          [objectKey]: {
            x: point?.x ?? 500,
            y: point?.y ?? 360,
            scale: 1,
            width: 140,
            height: 140,
            rotation: 0,
            zIndex: nextDraft.unlockableObjects.length + 10,
            spawnStart: 1,
            spawnEnd: nextDraft.maxCheckIns,
          },
        },
      };
    }

    setDraft(nextDraft);
  }

  function addAssetFromLibrary(assetUrl: string) {
    if (!draft) return;
    const objectKey = makeObjectKey(assetLabel(assetUrl), draft.unlockableObjects);
    updateDraft({
      unlockableObjects: [...draft.unlockableObjects, objectKey],
      assetUrls: draft.assetUrls.includes(assetUrl) ? draft.assetUrls : [...draft.assetUrls, assetUrl],
      objectAssets: {
        ...draft.objectAssets,
        [objectKey]: assetUrl,
      },
      objectLayout: {
        ...sceneLayout,
        [objectKey]: {
          x: 500,
          y: 360,
          scale: 1,
          width: 140,
          height: 140,
          rotation: 0,
          zIndex: draft.unlockableObjects.length + 10,
          spawnStart: 1,
          spawnEnd: draft.maxCheckIns,
        },
      },
    });
  }

  function deleteObject(objectKey: string) {
    if (!draft) return;
    const { [objectKey]: _removedLayout, ...objectLayout } = sceneLayout;
    const { [objectKey]: _removedAsset, ...objectAssets } = sceneObjectAssets;
    const next = {
      ...draft,
      unlockableObjects: draft.unlockableObjects.filter((item) => item !== objectKey),
      objectLayout,
      objectAssets,
    };
    setDraft(next);
  }

  function duplicateObject(objectKey: string) {
    if (!draft) return "";
    const sourceLayout = normalizedLayout(sceneLayout[objectKey] ?? DEFAULT_SCENE_OBJECT_LAYOUT[objectKey]);
    const sourceAsset = sceneObjectAssets[objectKey];
    const nextKey = makeObjectKey(`${objectKey}-copy`, draft.unlockableObjects);
    const next = {
      ...draft,
      unlockableObjects: [...draft.unlockableObjects, nextKey],
      objectAssets: {
        ...draft.objectAssets,
        [nextKey]: sourceAsset,
      },
      objectLayout: {
        ...sceneLayout,
        [nextKey]: {
          ...sourceLayout,
          x: Math.min(980, sourceLayout.x + 32),
          y: Math.min(680, sourceLayout.y + 32),
          zIndex: Math.max(...Object.values(sceneLayout).map((item) => item.zIndex), 0) + 1,
        },
      },
    };
    setDraft(next);
    return nextKey;
  }

  function updateSceneLayer(patch: Partial<SanctuarySceneConfig>) {
    updateDraft(patch);
  }

  function deleteCurrentScene() {
    if (!draft) return;
    const confirmed = window.confirm(
      `Delete "${draft.name}" from live publishing? This removes the scene and its saved versions from this admin dashboard.`
    );
    if (!confirmed) return;
    const nextScene = ordered.find((scene) => scene.id !== draft.id) ?? null;
    deleteScene(draft.id);
    if (nextScene) {
      selectScene(nextScene);
    } else {
      setSelectedId("");
      setDraft(null);
      setActiveObject("");
    }
  }

  return (
    <section className="rounded-xl2 border border-edge bg-card p-4 shadow-card">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-calm">
            Admin
          </p>
          <h2 className="text-2xl font-black tracking-tight">Live Publishing</h2>
          <p className="mt-1 text-sm text-dim">
            Publish sanctuary scenes live without resetting user progress.
          </p>
        </div>
        <button
          onClick={() => {
            const scene = blankScene(ordered.length + 1);
            saveSceneDraft(scene);
            selectScene(scene);
          }}
          className="rounded-full border border-edge bg-ink px-3 py-2 text-xs font-black text-dim"
        >
          New Draft
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[260px_minmax(520px,1fr)_340px]">
        <div className="flex flex-col gap-2">
          {ordered.map((scene) => {
            const displayScene = scene.id === draft.id ? { ...scene, ...draft } : scene;
            return (
            <button
              key={scene.id}
              onClick={() => selectScene(scene)}
              className={`rounded-2xl border p-3 text-left ${
                scene.id === draft.id ? "border-calm bg-calm/10" : "border-edge bg-ink/50"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-black">{displayScene.name}</p>
                <span className="rounded-full bg-card px-2 py-1 text-[10px] font-black uppercase text-dim">
                  {displayScene.status}
                </span>
              </div>
              <p className="mt-1 text-xs text-faint">{displayScene.unlockRequirementType}</p>
            </button>
          )})}
          <div className="mt-3 rounded-2xl border border-edge bg-ink p-3">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-calm">Asset library</p>
                <p className="mt-1 text-xs text-faint">Add assets to the selected scene.</p>
              </div>
              <label className="cursor-pointer rounded-full border border-edge bg-card px-3 py-2 text-xs font-black text-dim">
                Upload
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    if (event.target.files) void addUploadedFiles(event.target.files);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
            </div>
            <div className="grid gap-2">
              {Array.from(new Set(draft.assetUrls)).map((assetUrl) => (
                <button
                  key={assetUrl}
                  type="button"
                  onClick={() => addAssetFromLibrary(assetUrl)}
                  className="overflow-hidden rounded-2xl border border-edge bg-card text-left"
                >
                  <div className="flex aspect-video items-center justify-center bg-ink">
                    {assetUrl.startsWith("data:") || assetUrl.startsWith("/") || assetUrl.startsWith("http") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={assetUrl} alt="" className="h-full w-full object-contain p-2" />
                    ) : (
                      <span className="text-xs font-black uppercase tracking-wide text-faint">{assetLabel(assetUrl)}</span>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="truncate text-xs font-black text-fg">{assetLabel(assetUrl)}</p>
                    <p className="text-[10px] font-bold text-calm">Add to scene</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <SceneLayoutEditor
            scene={draft}
            layout={sceneLayout}
            objectAssets={sceneObjectAssets}
            activeObject={activeObject}
            onActiveObjectChange={setActiveObject}
            previewCheckIns={previewCheckIns}
            onPreviewCheckInsChange={setPreviewCheckIns}
            onChange={(objectKey, objectLayout) =>
              updateDraft({
                objectLayout: {
                  ...sceneLayout,
                  [objectKey]: objectLayout,
                },
              })
            }
            onDropFiles={addUploadedFiles}
            onDeleteObject={deleteObject}
            onDuplicateObject={duplicateObject}
            onUpdateScene={updateSceneLayer}
          />

          <div className="hidden rounded-2xl border border-edge bg-ink p-3">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-calm">Asset library</p>
                <p className="mt-1 text-xs text-faint">
                  Upload images, then add them to the drag layout.
                </p>
              </div>
              <label className="cursor-pointer rounded-full border border-edge bg-card px-3 py-2 text-xs font-black text-dim">
                Upload images
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    if (event.target.files) void addUploadedFiles(event.target.files);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Array.from(new Set(draft.assetUrls)).map((assetUrl) => (
                <button
                  key={assetUrl}
                  type="button"
                  onClick={() => addAssetFromLibrary(assetUrl)}
                  className="overflow-hidden rounded-2xl border border-edge bg-card text-left"
                >
                  <div className="flex aspect-video items-center justify-center bg-ink">
                    {assetUrl.startsWith("data:") || assetUrl.startsWith("/") || assetUrl.startsWith("http") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={assetUrl} alt="" className="h-full w-full object-contain p-2" />
                    ) : (
                      <span className="text-xs font-black uppercase tracking-wide text-faint">{assetLabel(assetUrl)}</span>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="truncate text-xs font-black text-fg">{assetLabel(assetUrl)}</p>
                    <p className="text-[10px] font-bold text-calm">Add to scene</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

        </div>

        <div className="flex flex-col gap-3">
          <SelectedObjectPanel
            activeObject={activeObject}
            scene={draft}
            sceneLayout={sceneLayout}
            sceneObjectAssets={sceneObjectAssets}
            onChange={(objectKey, objectLayout) =>
              updateDraft({
                objectLayout: {
                  ...sceneLayout,
                  [objectKey]: objectLayout,
                },
              })
            }
          />

          <label className="block">
            <span className="mb-1 block text-xs font-black text-dim">Scene name</span>
            <input
              value={draft.name}
              onChange={(event) => updateDraftAndSave({ name: event.target.value })}
              className="min-h-[44px] w-full rounded-2xl border border-edge bg-ink px-3 text-sm outline-none focus:border-calm"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label>
              <span className="mb-1 block text-xs font-black text-dim">Status</span>
              <select
                value={draft.status}
                onChange={(event) => updateDraftAndSave({ status: event.target.value as SanctuarySceneConfig["status"] })}
                className="min-h-[44px] w-full rounded-2xl border border-edge bg-ink px-3 text-sm"
              >
                <option value="draft">draft</option>
                <option value="preview">preview</option>
                <option value="live">live</option>
                <option value="archived">archived</option>
              </select>
            </label>
            <label>
              <span className="mb-1 block text-xs font-black text-dim">Max check-ins</span>
              <input
                type="number"
                value={draft.maxCheckIns}
                onChange={(event) => updateDraftAndSave({ maxCheckIns: Number(event.target.value) })}
                className="min-h-[44px] w-full rounded-2xl border border-edge bg-ink px-3 text-sm"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label>
              <span className="mb-1 block text-xs font-black text-dim">Unlock type</span>
              <select
                value={draft.unlockRequirementType}
                onChange={(event) =>
                  updateDraftAndSave({
                    unlockRequirementType: event.target.value as SanctuarySceneConfig["unlockRequirementType"],
                  })
                }
                className="min-h-[44px] w-full rounded-2xl border border-edge bg-ink px-3 text-sm"
              >
                <option value="manual">manual</option>
                <option value="complete_previous_scene">complete previous</option>
                <option value="total_checkins">total check-ins</option>
                <option value="premium">premium</option>
              </select>
            </label>
            <label>
              <span className="mb-1 block text-xs font-black text-dim">Requirement value</span>
              <input
                value={String(draft.unlockRequirementValue ?? "")}
                onChange={(event) => updateDraftAndSave({ unlockRequirementValue: event.target.value })}
                className="min-h-[44px] w-full rounded-2xl border border-edge bg-ink px-3 text-sm"
              />
            </label>
          </div>

          <label>
            <span className="mb-1 block text-xs font-black text-dim">Required previous scene</span>
            <select
              value={draft.requiredPreviousSceneId ?? ""}
              onChange={(event) => updateDraftAndSave({ requiredPreviousSceneId: event.target.value || undefined })}
              className="min-h-[44px] w-full rounded-2xl border border-edge bg-ink px-3 text-sm"
            >
              <option value="">None</option>
              {ordered.filter((scene) => scene.id !== draft.id).map((scene) => (
                <option key={scene.id} value={scene.id}>
                  {scene.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-1 block text-xs font-black text-dim">Preview image or gradient</span>
            <input
              value={draft.previewImage}
              onChange={(event) => updateDraftAndSave({ previewImage: event.target.value })}
              className="min-h-[44px] w-full rounded-2xl border border-edge bg-ink px-3 text-sm"
            />
          </label>

          <label>
            <span className="mb-1 block text-xs font-black text-dim">Unlockable objects, comma separated</span>
            <input
              value={draft.unlockableObjects.join(", ")}
              onChange={(event) =>
                setDraft((current) => {
                  if (!current) return current;
                  const unlockableObjects = event.target.value.split(",").map((item) => item.trim()).filter(Boolean);
                  const objectLayout = {
                    ...defaultLayoutForObjects(unlockableObjects),
                    ...current.objectLayout,
                  };
                  const objectAssets = Object.fromEntries(
                    unlockableObjects.map((object) => [
                      object,
                      current.objectAssets?.[object] ?? `scene://${current.id}/${object}`,
                    ])
                  );
                  return { ...current, unlockableObjects, objectLayout, objectAssets };
                })
              }
              className="min-h-[44px] w-full rounded-2xl border border-edge bg-ink px-3 text-sm"
            />
          </label>

          <div className="hidden rounded-2xl border border-edge bg-ink p-3">
            <p className="mb-2 text-xs font-black uppercase tracking-wide text-dim">Object positions</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {draft.unlockableObjects.map((object) => {
                const objectLayout = normalizedLayout(sceneLayout[object] ?? DEFAULT_SCENE_OBJECT_LAYOUT[object]);
                return (
                  <div key={object} className="rounded-xl border border-edge bg-card p-2">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-xs font-black text-fg">
                        {object}
                      </p>
                      <span className="text-[10px] font-black uppercase text-faint">z {objectLayout.zIndex}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <NumberField label="X" value={objectLayout.x} onChange={(x) => updateDraft({ objectLayout: { ...sceneLayout, [object]: { ...objectLayout, x } } })} />
                      <NumberField label="Y" value={objectLayout.y} onChange={(y) => updateDraft({ objectLayout: { ...sceneLayout, [object]: { ...objectLayout, y } } })} />
                      <NumberField label="Width" value={objectLayout.width ?? 96} onChange={(width) => updateDraft({ objectLayout: { ...sceneLayout, [object]: { ...objectLayout, width, scale: 1 } } })} />
                      <NumberField label="Height" value={objectLayout.height ?? 96} onChange={(height) => updateDraft({ objectLayout: { ...sceneLayout, [object]: { ...objectLayout, height, scale: 1 } } })} />
                      <NumberField label="Rotate" value={objectLayout.rotation ?? 0} onChange={(rotation) => updateDraft({ objectLayout: { ...sceneLayout, [object]: { ...objectLayout, rotation } } })} />
                      <NumberField label="Z" value={objectLayout.zIndex} onChange={(zIndex) => updateDraft({ objectLayout: { ...sceneLayout, [object]: { ...objectLayout, zIndex } } })} />
                      <NumberField
                        label="Spawn start"
                        value={objectLayout.spawnStart ?? 1}
                        onChange={(spawnStart) =>
                          updateDraft({
                            objectLayout: {
                              ...sceneLayout,
                              [object]: {
                                ...objectLayout,
                                spawnStart: Math.max(1, Math.min(draft.maxCheckIns, spawnStart)),
                              },
                            },
                          })
                        }
                      />
                      <NumberField
                        label="Spawn end"
                        value={objectLayout.spawnEnd ?? draft.maxCheckIns}
                        onChange={(spawnEnd) =>
                          updateDraft({
                            objectLayout: {
                              ...sceneLayout,
                              [object]: {
                                ...objectLayout,
                                spawnEnd: Math.max(1, Math.min(draft.maxCheckIns, spawnEnd)),
                              },
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-faint">
              Drag objects in the canvas, then save changes. Spawn start and end control the check-in days when this object appears, from day 1 to the scene max.
            </p>
          </div>

          {(errors.length ? errors : validation).length > 0 ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3">
              {(errors.length ? errors : validation).map((error) => (
                <p key={error} className="text-xs font-bold text-red-200">
                  Missing: {error}
                </p>
              ))}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                saveSceneDraft({ ...draft, objectLayout: sceneLayout });
                setErrors([]);
              }}
              className="min-h-[44px] rounded-2xl border border-calm bg-calm/10 text-sm font-black text-calm"
            >
              Save Changes
            </button>
            <button
              onClick={() => {
                saveSceneDraft({ ...draft, status: "draft", objectLayout: sceneLayout });
                setErrors([]);
              }}
              className="min-h-[44px] rounded-2xl border border-edge bg-ink text-sm font-black text-dim"
            >
              Save Draft
            </button>
            <button
              onClick={() => {
                saveSceneDraft({ ...draft, status: "preview", objectLayout: sceneLayout });
                setErrors([]);
              }}
              className="min-h-[44px] rounded-2xl border border-edge bg-ink text-sm font-black text-dim"
            >
              Preview as User
            </button>
            <button
              onClick={() => {
                const nextErrors = validateSceneForPublish(draft, scenes);
                setErrors(nextErrors);
                if (nextErrors.length === 0) {
                  saveSceneDraft({ ...draft, objectLayout: sceneLayout });
                  setConfirmPublish(true);
                }
              }}
              className="min-h-[44px] rounded-2xl bg-gradient-to-r from-calm to-sea text-sm font-black text-ink"
            >
              Publish Live
            </button>
            <button
              onClick={() => setSceneStatus(draft.id, "draft")}
              className="min-h-[44px] rounded-2xl border border-edge bg-ink text-sm font-black text-dim"
            >
              Unpublish
            </button>
            <button
              onClick={() => setSceneStatus(draft.id, "archived")}
              className="min-h-[44px] rounded-2xl border border-edge bg-ink text-sm font-black text-dim"
            >
              Archive
            </button>
            <button
              onClick={() => duplicateScene(draft.id)}
              className="min-h-[44px] rounded-2xl border border-edge bg-ink text-sm font-black text-dim"
            >
              Duplicate Scene
            </button>
            <button
              onClick={deleteCurrentScene}
              className="min-h-[44px] rounded-2xl border border-red-400/35 bg-red-500/10 text-sm font-black text-red-200"
            >
              Delete Scene
            </button>
          </div>

          {sceneVersions.length > 0 ? (
            <div className="rounded-2xl border border-edge bg-ink p-3">
              <p className="mb-2 text-xs font-black uppercase tracking-wide text-dim">Rollback</p>
              <div className="flex flex-wrap gap-2">
                {sceneVersions.map((version) => (
                  <button
                    key={version.versionNumber}
                    onClick={() => rollbackScene(draft.id, version.versionNumber)}
                    className="rounded-full border border-edge bg-card px-3 py-1.5 text-xs font-black text-dim"
                  >
                    Version {version.versionNumber}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {confirmPublish ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5">
          <div className="w-full max-w-sm rounded-[28px] border border-edge bg-card p-5 shadow-card">
            <h3 className="text-xl font-black">Publish this sanctuary for all users?</h3>
            <p className="mt-2 text-sm leading-relaxed text-dim">
              This will make the scene visible in the app. Users will still need to unlock it based on its requirements.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                onClick={() => setConfirmPublish(false)}
                className="min-h-[46px] rounded-2xl border border-edge bg-ink text-sm font-black text-dim"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const publishErrors = publishScene(draft.id);
                  setErrors(publishErrors);
                  setConfirmPublish(false);
                }}
                className="min-h-[46px] rounded-2xl bg-gradient-to-r from-calm to-sea text-sm font-black text-ink"
              >
                Publish Live
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function SelectedObjectPanel({
  activeObject,
  scene,
  sceneLayout,
  sceneObjectAssets,
  onChange,
}: {
  activeObject: string;
  scene: SanctuarySceneConfig;
  sceneLayout: Record<string, SanctuarySceneObjectLayout>;
  sceneObjectAssets: Record<string, string>;
  onChange: (objectKey: string, layout: SanctuarySceneObjectLayout) => void;
}) {
  if (!activeObject || !sceneLayout[activeObject]) {
    return (
      <div className="rounded-2xl border border-edge bg-ink p-4">
        <p className="text-xs font-black uppercase tracking-wide text-calm">Object settings</p>
        <p className="mt-2 text-sm text-faint">Select an object on the canvas.</p>
      </div>
    );
  }

  const objectLayout = normalizedLayout(sceneLayout[activeObject]);
  const update = (patch: Partial<SanctuarySceneObjectLayout>) =>
    onChange(activeObject, { ...objectLayout, ...patch });

  return (
    <div className="rounded-2xl border border-edge bg-ink p-4">
      <p className="text-xs font-black uppercase tracking-wide text-calm">Object settings</p>
      <h3 className="mt-1 text-xl font-black">Selected: {activeObject}</h3>
      <p className="mt-1 truncate text-xs text-faint">Asset: {assetLabel(sceneObjectAssets[activeObject] ?? "")}</p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <NumberField label="Unlock at" value={objectLayout.spawnStart ?? 1} onChange={(spawnStart) => update({ spawnStart: Math.max(1, Math.min(scene.maxCheckIns, spawnStart)) })} />
        <NumberField label="Hide after" value={objectLayout.spawnEnd ?? scene.maxCheckIns} onChange={(spawnEnd) => update({ spawnEnd: Math.max(1, Math.min(scene.maxCheckIns, spawnEnd)) })} />
      </div>

      <label className="mt-3 block">
        <span className="mb-1 block text-[10px] font-black uppercase text-faint">Replacement group</span>
        <input
          value={objectLayout.replacementGroup ?? ""}
          onChange={(event) => update({ replacementGroup: event.target.value })}
          placeholder="tree-stage"
          className="min-h-[38px] w-full rounded-xl border border-edge bg-card px-3 text-xs text-fg"
        />
      </label>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <NumberField label="X position" value={objectLayout.x} onChange={(x) => update({ x })} />
        <NumberField label="Y position" value={objectLayout.y} onChange={(y) => update({ y })} />
        <NumberField label="Width" value={objectLayout.width ?? 96} onChange={(width) => update({ width, scale: 1 })} />
        <NumberField label="Height" value={objectLayout.height ?? 96} onChange={(height) => update({ height, scale: 1 })} />
        <NumberField label="Rotation" value={objectLayout.rotation ?? 0} onChange={(rotation) => update({ rotation })} />
        <NumberField label="Z-index" value={objectLayout.zIndex} onChange={(zIndex) => update({ zIndex })} />
      </div>

      <label className="mt-3 block">
        <span className="mb-1 block text-[10px] font-black uppercase text-faint">Animation</span>
        <select
          value={objectLayout.animation ?? "none"}
          onChange={(event) => update({ animation: event.target.value as SanctuarySceneObjectLayout["animation"] })}
          className="min-h-[38px] w-full rounded-xl border border-edge bg-card px-3 text-xs text-fg"
        >
          <option value="none">none</option>
          <option value="float">float</option>
          <option value="pulse">pulse</option>
          <option value="sway">sway</option>
          <option value="glow">glow</option>
        </select>
      </label>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="flex items-center gap-2 rounded-xl border border-edge bg-card px-3 py-2 text-xs font-black text-dim">
          <input
            type="checkbox"
            checked={objectLayout.visible !== false}
            onChange={(event) => update({ visible: event.target.checked })}
          />
          Visible
        </label>
        <label className="flex items-center gap-2 rounded-xl border border-edge bg-card px-3 py-2 text-xs font-black text-dim">
          <input
            type="checkbox"
            checked={objectLayout.locked === true}
            onChange={(event) => update({ locked: event.target.checked })}
          />
          Locked
        </label>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label>
      <span className="mb-1 block text-[10px] font-black uppercase text-faint">{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="min-h-[34px] w-full rounded-xl border border-edge bg-ink px-2 text-xs text-fg"
      />
    </label>
  );
}

function SceneLayoutEditor({
  scene,
  layout,
  objectAssets,
  activeObject,
  onActiveObjectChange,
  previewCheckIns,
  onPreviewCheckInsChange,
  onChange,
  onDropFiles,
  onDeleteObject,
  onDuplicateObject,
  onUpdateScene,
}: {
  scene: SanctuarySceneConfig;
  layout: Record<string, SanctuarySceneObjectLayout>;
  objectAssets: Record<string, string>;
  activeObject: string;
  onActiveObjectChange: (objectKey: string) => void;
  previewCheckIns: number;
  onPreviewCheckInsChange: (value: number) => void;
  onChange: (objectKey: string, layout: SanctuarySceneObjectLayout) => void;
  onDropFiles: (files: FileList | File[], point?: { x: number; y: number }) => void;
  onDeleteObject: (objectKey: string) => void;
  onDuplicateObject: (objectKey: string) => string;
  onUpdateScene: (patch: Partial<SanctuarySceneConfig>) => void;
}) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const copiedObject = useRef<string | null>(null);
  const resizeStart = useRef({
    pointerX: 0,
    pointerY: 0,
    x: 0,
    y: 0,
    width: 96,
    height: 96,
    handle: "se" as ResizeHandle,
  });
  const [canvasDevice, setCanvasDevice] = useState(EDITOR_DEVICES[1]);
  const activeLayout = activeObject && layout[activeObject] ? normalizedLayout(layout[activeObject]) : null;

  useEffect(() => {
    function handleKeyboard(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT";
      if (isTyping || !activeObject) return;
      const isCopy = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c";
      const isPaste = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v";

      if (isCopy) {
        event.preventDefault();
        copiedObject.current = activeObject;
        return;
      }

      if (isPaste && copiedObject.current) {
        event.preventDefault();
        const nextKey = onDuplicateObject(copiedObject.current);
        if (nextKey) {
          copiedObject.current = nextKey;
          onActiveObjectChange(nextKey);
        }
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        onDeleteObject(activeObject);
        onActiveObjectChange(scene.unlockableObjects.find((item) => item !== activeObject) ?? "");
      }
    }

    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, [activeObject, onActiveObjectChange, onDeleteObject, onDuplicateObject, scene.unlockableObjects]);

  function pointerToCanvas(event: React.PointerEvent<HTMLElement>) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: Math.max(0, Math.min(1000, ((event.clientX - rect.left) / rect.width) * 1000)),
      y: Math.max(0, Math.min(700, ((event.clientY - rect.top) / rect.height) * 700)),
    };
  }

  function startDrag(objectKey: string, event: React.PointerEvent<HTMLButtonElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    onActiveObjectChange(objectKey);
    const point = pointerToCanvas(event);
    if (!point) return;
    dragOffset.current = {
      x: point.x - layout[objectKey].x,
      y: point.y - layout[objectKey].y,
    };
  }

  function moveDrag(objectKey: string, event: React.PointerEvent<HTMLButtonElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const point = pointerToCanvas(event);
    if (!point) return;
    onChange(objectKey, {
      ...layout[objectKey],
      x: Math.round(point.x - dragOffset.current.x),
      y: Math.round(point.y - dragOffset.current.y),
    });
  }

  function dropFiles(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    const point = rect
      ? {
          x: Math.max(0, Math.min(1000, ((event.clientX - rect.left) / rect.width) * 1000)),
          y: Math.max(0, Math.min(700, ((event.clientY - rect.top) / rect.height) * 700)),
        }
      : undefined;
    if (event.dataTransfer.files.length > 0) {
      onDropFiles(event.dataTransfer.files, point);
    }
  }

  function startResize(handle: ResizeHandle, event: React.PointerEvent<HTMLSpanElement>) {
    if (!activeLayout) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeStart.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      x: activeLayout.x,
      y: activeLayout.y,
      width: activeLayout.width ?? 96,
      height: activeLayout.height ?? 96,
      handle,
    };
  }

  function moveResize(event: React.PointerEvent<HTMLSpanElement>) {
    if (!activeLayout || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const dx = ((event.clientX - resizeStart.current.pointerX) / rect.width) * 1000;
    const dy = ((event.clientY - resizeStart.current.pointerY) / rect.height) * 700;
    const handle = resizeStart.current.handle;
    let width = resizeStart.current.width;
    let height = resizeStart.current.height;
    let x = resizeStart.current.x;
    let y = resizeStart.current.y;

    if (handle.includes("e")) {
      width = Math.max(12, resizeStart.current.width + dx);
      x = resizeStart.current.x + dx / 2;
    }
    if (handle.includes("w")) {
      width = Math.max(12, resizeStart.current.width - dx);
      x = resizeStart.current.x + dx / 2;
    }
    if (handle.includes("s")) {
      height = Math.max(12, resizeStart.current.height + dy);
      y = resizeStart.current.y + dy / 2;
    }
    if (handle.includes("n")) {
      height = Math.max(12, resizeStart.current.height - dy);
      y = resizeStart.current.y + dy / 2;
    }

    onChange(activeObject, {
      ...activeLayout,
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height),
      scale: 1,
    });
  }

  return (
    <div className="rounded-2xl border border-edge bg-ink p-3">
      <div className="mb-3 flex flex-col gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-calm">Drag layout</p>
          <p className="mt-1 text-xs text-faint">Place objects on the scene. Drag image files here or add them from the asset library.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {EDITOR_DEVICES.map((device) => (
            <button
              key={device.label}
              type="button"
              onClick={() => setCanvasDevice(device)}
              className={`rounded-full border px-3 py-1.5 text-[10px] font-black ${
                canvasDevice.label === device.label ? "border-calm bg-calm/15 text-calm" : "border-edge bg-card text-dim"
              }`}
            >
              {device.label}
            </button>
          ))}
        </div>
        <div className="rounded-2xl border border-edge bg-card p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-black text-fg">Preview check-ins</p>
            <p className="text-xs font-black text-calm">{previewCheckIns}</p>
          </div>
          <input
            type="range"
            min="1"
            max={scene.maxCheckIns}
            value={Math.min(scene.maxCheckIns, previewCheckIns)}
            onChange={(event) => onPreviewCheckInsChange(Number(event.target.value))}
            className="w-full"
          />
          <div className="mt-2 flex justify-between text-[10px] font-black text-faint">
            {[1, 7, 14, 30, 60, scene.maxCheckIns].map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => onPreviewCheckInsChange(Math.min(scene.maxCheckIns, day))}
                className="rounded-full px-1 hover:text-calm"
              >
                Day {Math.min(scene.maxCheckIns, day)}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="overflow-auto rounded-[28px] border border-edge bg-card p-3">
        <div
          className="mx-auto rounded-[26px] border border-edge bg-[#0B0E14] p-3"
          style={{
            width: Math.min(canvasDevice.width, 760),
            maxWidth: "100%",
          }}
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-[10px] font-black uppercase tracking-wide text-faint">
              {canvasDevice.label} scene card
            </p>
            <p className="text-[10px] font-black text-faint">
              {canvasDevice.width} x {canvasDevice.height}
            </p>
          </div>
          <div
            ref={canvasRef}
            className="relative aspect-[10/7] overflow-hidden rounded-2xl border border-edge"
            style={{
              background: scene.previewImage || "transparent",
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={dropFiles}
          >
            <SceneLayoutLayers
              scene={scene}
              layout={layout}
              objectAssets={objectAssets}
              activeObject={activeObject}
              previewCheckIns={previewCheckIns}
              interactive
              onStartDrag={startDrag}
              onMoveDrag={moveDrag}
              onSelectObject={onActiveObjectChange}
            />
            {activeLayout ? (
              <div
                className="pointer-events-none absolute z-[999] border border-calm/90"
                style={{
                  left: `${activeLayout.x / 10}%`,
                  top: `${activeLayout.y / 7}%`,
                  width: `${activeLayout.width ?? 96}px`,
                  height: `${activeLayout.height ?? 96}px`,
                  transform: `translate(-50%, -50%) rotate(${activeLayout.rotation ?? 0}deg)`,
                  transformOrigin: "center",
                }}
              >
                {RESIZE_HANDLES.map((handle) => (
                  <span
                    key={handle.key}
                    role="presentation"
                    onPointerDown={(event) => startResize(handle.key, event)}
                    onPointerMove={moveResize}
                    onPointerUp={(event) => event.currentTarget.releasePointerCapture(event.pointerId)}
                    className={`pointer-events-auto absolute h-4 w-4 rounded-full border-2 border-ink bg-calm shadow-card ${handle.className} ${handle.cursor}`}
                    style={{ touchAction: "none" }}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-5">
        <button
          type="button"
          onClick={() => {
            if (!activeObject) return;
            copiedObject.current = activeObject;
          }}
          disabled={!activeObject}
          className="min-h-[38px] rounded-2xl border border-edge bg-card text-xs font-black text-dim disabled:opacity-40"
        >
          Copy selected
        </button>
        <button
          type="button"
          onClick={() => {
            const objectToPaste = copiedObject.current ?? activeObject;
            if (!objectToPaste) return;
            const nextKey = onDuplicateObject(objectToPaste);
            if (nextKey) {
              copiedObject.current = nextKey;
              onActiveObjectChange(nextKey);
            }
          }}
          disabled={!activeObject && !copiedObject.current}
          className="min-h-[38px] rounded-2xl border border-edge bg-card text-xs font-black text-dim disabled:opacity-40"
        >
          Paste copy
        </button>
        <button
          type="button"
          onClick={() => {
            if (!activeObject) return;
            onDeleteObject(activeObject);
            onActiveObjectChange(scene.unlockableObjects.find((item) => item !== activeObject) ?? "");
          }}
          disabled={!activeObject}
          className="min-h-[38px] rounded-2xl border border-red-400/30 bg-red-500/10 text-xs font-black text-red-200 disabled:opacity-40"
        >
          Delete selected
        </button>
        <button
          type="button"
          onClick={() => onUpdateScene({ previewImage: "transparent" })}
          className="min-h-[38px] rounded-2xl border border-edge bg-card text-xs font-black text-dim"
        >
          Delete backdrop
        </button>
        <button
          type="button"
          onClick={() => onUpdateScene({ groundAssetUrl: "" })}
          className="min-h-[38px] rounded-2xl border border-edge bg-card text-xs font-black text-dim"
        >
          Delete ground
        </button>
      </div>
      {activeLayout ? (
        <div className="mt-3 rounded-2xl border border-edge bg-card p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-black text-fg">Size {activeObject}</p>
            <p className="text-xs font-black text-calm">
              {Math.round(activeLayout.width ?? 96)} x {Math.round(activeLayout.height ?? 96)}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Width" value={activeLayout.width ?? 96} onChange={(width) => onChange(activeObject, { ...activeLayout, width, scale: 1 })} />
            <NumberField label="Height" value={activeLayout.height ?? 96} onChange={(height) => onChange(activeObject, { ...activeLayout, height, scale: 1 })} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function SceneLayoutPreview({
  scene,
}: {
  scene: SanctuarySceneConfig | null;
}) {
  if (!scene) {
    return (
      <div className="flex aspect-[10/7] items-center justify-center rounded-2xl border border-edge bg-ink text-sm font-bold text-faint">
        Select a scene
      </div>
    );
  }

  return (
    <div className="relative aspect-[10/7] overflow-hidden rounded-2xl border border-edge" style={{ background: scene.previewImage }}>
      <SceneLayoutLayers scene={scene} layout={layoutForScene(scene)} objectAssets={objectAssetsForScene(scene)} />
    </div>
  );
}

function SceneLayoutLayers({
  scene,
  layout,
  objectAssets,
  activeObject = "",
  previewCheckIns,
  interactive = false,
  onStartDrag,
  onMoveDrag,
  onSelectObject,
}: {
  scene: SanctuarySceneConfig;
  layout: Record<string, SanctuarySceneObjectLayout>;
  objectAssets: Record<string, string>;
  activeObject?: string;
  previewCheckIns?: number;
  interactive?: boolean;
  onStartDrag?: (objectKey: string, event: React.PointerEvent<HTMLButtonElement>) => void;
  onMoveDrag?: (objectKey: string, event: React.PointerEvent<HTMLButtonElement>) => void;
  onSelectObject?: (objectKey: string) => void;
}) {
  return (
    <>
      {scene.groundAssetUrl ? (
        <>
          <div className="absolute inset-x-[-10%] bottom-0 h-[42%] rounded-t-[55%] bg-gradient-to-b from-emerald-700/55 to-emerald-950/95" />
          <div className="absolute inset-x-0 bottom-[18%] h-px bg-calm/20" />
        </>
      ) : null}
        {scene.unlockableObjects
          .slice()
          .filter((objectKey) => {
            const objectLayout = normalizedLayout(layout[objectKey] ?? DEFAULT_SCENE_OBJECT_LAYOUT[objectKey]);
            if (objectLayout.visible === false) return false;
            if (previewCheckIns == null) return true;
            const start = objectLayout.spawnStart ?? 1;
            const end = objectLayout.spawnEnd ?? scene.maxCheckIns;
            return previewCheckIns >= start && previewCheckIns <= end;
          })
          .sort((a, b) => (layout[a]?.zIndex ?? 0) - (layout[b]?.zIndex ?? 0))
          .map((objectKey) => {
            const objectLayout = layout[objectKey] ? normalizedLayout(layout[objectKey]) : null;
            if (!objectLayout) return null;
            const isActive = activeObject === objectKey;
            const assetUrl = objectAssets[objectKey];
            const canRenderImage = assetUrl?.startsWith("data:") || assetUrl?.startsWith("/") || assetUrl?.startsWith("http");
            const objectWidth = objectLayout.width ?? 96;
            const objectHeight = objectLayout.height ?? 96;
            const content = canRenderImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={assetUrl} alt="" draggable={false} className="block h-full w-full object-fill" />
            ) : (
              <span
                aria-hidden
                className="flex h-full w-full items-center justify-center leading-none"
                style={{ fontSize: `${Math.max(14, Math.min(objectWidth, objectHeight) * 0.72)}px` }}
              >
                {objectIconFor(objectKey, assetUrl)}
              </span>
            );
            const style = {
              left: `${objectLayout.x / 10}%`,
              top: `${objectLayout.y / 7}%`,
              zIndex: objectLayout.zIndex,
              width: `${objectWidth}px`,
              height: `${objectHeight}px`,
              transform: `translate(-50%, -50%) rotate(${objectLayout.rotation ?? 0}deg)`,
              touchAction: "none",
              transformOrigin: "center",
            };

            if (!interactive) {
              return (
                <div
                  key={objectKey}
                  className="absolute flex select-none items-center justify-center overflow-hidden"
                  style={style}
                >
                  {content}
                </div>
              );
            }

            return (
              <button
                key={objectKey}
                type="button"
                onPointerDown={(event) => {
                  onSelectObject?.(objectKey);
                  if (!objectLayout.locked) onStartDrag?.(objectKey, event);
                }}
                onPointerMove={(event) => {
                  if (!objectLayout.locked) onMoveDrag?.(objectKey, event);
                }}
                onPointerUp={(event) => event.currentTarget.releasePointerCapture(event.pointerId)}
                className={`absolute flex select-none items-center justify-center overflow-hidden bg-transparent p-0 transition ${
                  isActive ? "outline outline-2 outline-calm/80" : "outline-none"
                }`}
                style={style}
                aria-label={`Move ${objectKey}`}
              >
                {content}
              </button>
            );
          })}
    </>
  );
}
