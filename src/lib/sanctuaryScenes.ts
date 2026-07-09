import type {
  CheckIn,
  SanctuarySceneObjectLayout,
  SanctuarySceneConfig,
  SanctuarySceneVersion,
} from "./types";

export const DEFAULT_SCENE_OBJECT_LAYOUT: Record<string, SanctuarySceneObjectLayout> = {
  seed: { x: 420, y: 535, scale: 0.7, width: 72, height: 72, rotation: 0, zIndex: 6, spawnStart: 1, spawnEnd: 7 },
  tree: { x: 430, y: 382, scale: 1, width: 160, height: 160, rotation: 0, zIndex: 8, spawnStart: 7, spawnEnd: 90 },
  flowers: { x: 245, y: 548, scale: 0.72, width: 118, height: 118, rotation: -2, zIndex: 10, spawnStart: 14, spawnEnd: 90 },
  bushes: { x: 308, y: 515, scale: 0.72, width: 118, height: 92, rotation: 0, zIndex: 7, spawnStart: 21, spawnEnd: 90 },
  rocks: { x: 720, y: 575, scale: 0.58, width: 120, height: 80, rotation: 0, zIndex: 10, spawnStart: 28, spawnEnd: 90 },
  pond: { x: 520, y: 570, scale: 0.86, width: 210, height: 96, rotation: 0, zIndex: 5, spawnStart: 42, spawnEnd: 90 },
  bridge: { x: 520, y: 512, scale: 0.74, width: 180, height: 92, rotation: -2, zIndex: 11, spawnStart: 56, spawnEnd: 90 },
  cabin: { x: 775, y: 405, scale: 0.72, width: 145, height: 145, rotation: 0, zIndex: 7, spawnStart: 70, spawnEnd: 90 },
  lantern: { x: 692, y: 482, scale: 0.46, width: 90, height: 120, rotation: 0, zIndex: 12, spawnStart: 70, spawnEnd: 90 },
  moon: { x: 780, y: 132, scale: 0.52, width: 110, height: 110, rotation: -8, zIndex: 2, spawnStart: 1, spawnEnd: 90 },
  fireflies: { x: 650, y: 285, scale: 0.65, width: 140, height: 120, rotation: 0, zIndex: 13, spawnStart: 30, spawnEnd: 90 },
  shore: { x: 500, y: 590, scale: 1, width: 260, height: 110, rotation: 0, zIndex: 4, spawnStart: 1, spawnEnd: 90 },
  waves: { x: 510, y: 540, scale: 0.88, width: 230, height: 110, rotation: 0, zIndex: 5, spawnStart: 7, spawnEnd: 90 },
};

export function defaultLayoutForObjects(objects: string[]) {
  return Object.fromEntries(
    objects.map((object, index) => [
      object,
      DEFAULT_SCENE_OBJECT_LAYOUT[object] ?? {
        x: 220 + (index % 4) * 170,
        y: 340 + Math.floor(index / 4) * 90,
        scale: 0.75,
        width: 120,
        height: 120,
        rotation: 0,
        zIndex: 6 + index,
        spawnStart: 1,
        spawnEnd: 30,
      },
    ])
  );
}

export const DEFAULT_SANCTUARY_SCENES: SanctuarySceneConfig[] = [
  {
    id: "forest-haven",
    name: "Forest Haven",
    status: "live",
    unlockRequirementType: "manual",
    unlockRequirementValue: true,
    maxCheckIns: 90,
    sortOrder: 1,
    publishedAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    previewImage: "linear-gradient(135deg,#081A14,#173B26,#0B0E14)",
    backgroundAssetUrl: "scene://forest/background",
    groundAssetUrl: "scene://forest/ground",
    assetUrls: ["scene://forest/tree", "scene://forest/pond"],
    unlockableObjects: ["seed", "tree", "flowers", "pond", "cabin"],
    objectAssets: {
      seed: "scene://forest/seed",
      tree: "scene://forest/tree",
      flowers: "scene://forest/flowers",
      pond: "scene://forest/pond",
      cabin: "scene://forest/cabin",
    },
    objectLayout: defaultLayoutForObjects(["seed", "tree", "flowers", "pond", "cabin"]),
  },
  {
    id: "twilight-grove",
    name: "Twilight Grove",
    status: "live",
    requiredPreviousSceneId: "forest-haven",
    unlockRequirementType: "complete_previous_scene",
    maxCheckIns: 90,
    sortOrder: 2,
    publishedAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    previewImage: "linear-gradient(135deg,#151936,#352157,#090D16)",
    backgroundAssetUrl: "scene://twilight/background",
    groundAssetUrl: "scene://twilight/ground",
    assetUrls: ["scene://twilight/tree", "scene://twilight/moon"],
    unlockableObjects: ["moon", "tree", "bridge", "fireflies"],
    objectAssets: {
      moon: "scene://twilight/moon",
      tree: "scene://twilight/tree",
      bridge: "scene://twilight/bridge",
      fireflies: "scene://twilight/fireflies",
    },
    objectLayout: defaultLayoutForObjects(["moon", "tree", "bridge", "fireflies"]),
  },
  {
    id: "ocean-calm",
    name: "Ocean Calm",
    status: "live",
    requiredPreviousSceneId: "twilight-grove",
    unlockRequirementType: "complete_previous_scene",
    maxCheckIns: 90,
    sortOrder: 3,
    publishedAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    previewImage: "linear-gradient(135deg,#071B2E,#123F64,#08111D)",
    backgroundAssetUrl: "scene://ocean/background",
    groundAssetUrl: "scene://ocean/ground",
    assetUrls: ["scene://ocean/waves", "scene://ocean/rocks"],
    unlockableObjects: ["shore", "waves", "rocks", "lantern"],
    objectAssets: {
      shore: "scene://ocean/shore",
      waves: "scene://ocean/waves",
      rocks: "scene://ocean/rocks",
      lantern: "scene://ocean/lantern",
    },
    objectLayout: defaultLayoutForObjects(["shore", "waves", "rocks", "lantern"]),
    premium: true,
  },
];

export function sortScenes(scenes: SanctuarySceneConfig[]) {
  return [...scenes].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function liveScenes(scenes: SanctuarySceneConfig[]) {
  return sortScenes(scenes).filter((scene) => scene.status === "live");
}

export function nextSceneVersion(
  sceneId: string,
  versions: SanctuarySceneVersion[]
) {
  return (
    Math.max(
      0,
      ...versions
        .filter((version) => version.sceneId === sceneId)
        .map((version) => version.versionNumber)
    ) + 1
  );
}

export function duplicateScene(scene: SanctuarySceneConfig): SanctuarySceneConfig {
  const now = new Date().toISOString();
  return {
    ...scene,
    id: `${scene.id}-copy-${Date.now()}`,
    name: `${scene.name} Copy`,
    status: "draft",
    publishedAt: undefined,
    sortOrder: scene.sortOrder + 1,
    updatedAt: now,
  };
}

export function createsSceneLoop(
  scene: SanctuarySceneConfig,
  scenes: SanctuarySceneConfig[]
) {
  const byId = new Map(scenes.map((item) => [item.id, item]));
  let current = scene.requiredPreviousSceneId;
  const seen = new Set<string>([scene.id]);
  while (current) {
    if (seen.has(current)) return true;
    seen.add(current);
    current = byId.get(current)?.requiredPreviousSceneId;
  }
  return false;
}

export function validateSceneForPublish(
  scene: SanctuarySceneConfig,
  scenes: SanctuarySceneConfig[]
) {
  const errors: string[] = [];
  if (!scene.name.trim()) errors.push("Scene has a name.");
  if (!scene.backgroundAssetUrl && !scene.groundAssetUrl) {
    errors.push("Scene has at least one ground or background asset.");
  }
  if (!scene.maxCheckIns || scene.maxCheckIns < 1) {
    errors.push("Scene has maxCheckIns.");
  }
  if (scene.unlockableObjects.length < 1) {
    errors.push("Scene has at least one unlockable object.");
  }
  if (!scene.previewImage.trim()) errors.push("Scene has preview image.");
  const invalidAsset = [
    scene.previewImage,
    scene.backgroundAssetUrl,
    scene.groundAssetUrl,
    ...scene.assetUrls,
  ].some((url) => !isValidSceneAssetUrl(url));
  if (invalidAsset) errors.push("All asset URLs are valid.");
  if (createsSceneLoop(scene, scenes)) {
    errors.push("Required previous scene does not create a loop.");
  }
  return errors;
}

function isValidSceneAssetUrl(url: string) {
  if (!url) return false;
  return (
    url.startsWith("scene://") ||
    url.startsWith("data:image/") ||
    url.startsWith("/") ||
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("linear-gradient(")
  );
}

export function sceneRequirementLabel(scene: SanctuarySceneConfig) {
  if (scene.unlockRequirementType === "complete_previous_scene") {
    return scene.requiredPreviousSceneId
      ? "Complete the previous sanctuary"
      : "Complete the previous sanctuary";
  }
  if (scene.unlockRequirementType === "total_checkins") {
    return `${scene.unlockRequirementValue ?? scene.maxCheckIns} check-ins required`;
  }
  if (scene.unlockRequirementType === "premium") return "Premium sanctuary";
  return "Available by default";
}

export function sceneUnlockState({
  scene,
  scenes,
  checkIns,
  premium,
}: {
  scene: SanctuarySceneConfig;
  scenes: SanctuarySceneConfig[];
  checkIns: CheckIn[];
  premium: boolean;
}) {
  const total = checkIns.length;
  const previous = scene.requiredPreviousSceneId
    ? scenes.find((item) => item.id === scene.requiredPreviousSceneId)
    : undefined;
  let required = Number(scene.unlockRequirementValue || scene.maxCheckIns || 1);
  let unlocked = false;
  let label = "Available";

  if (scene.unlockRequirementType === "manual") {
    unlocked = scene.unlockRequirementValue !== false;
    required = 1;
    label = unlocked ? "Available by default" : "Unlock manually";
  } else if (scene.unlockRequirementType === "total_checkins") {
    unlocked = total >= required;
    label = `${Math.min(total, required)} of ${required} check-ins complete.`;
  } else if (scene.unlockRequirementType === "premium") {
    unlocked = premium;
    required = 1;
    label = premium ? "Premium unlocked" : "Premium sanctuary";
  } else if (scene.unlockRequirementType === "complete_previous_scene") {
    required = previous?.maxCheckIns ?? scene.maxCheckIns;
    unlocked = total >= required;
    label = previous
      ? `Complete ${previous.name} to unlock ${scene.name}.`
      : `Complete the previous sanctuary to unlock ${scene.name}.`;
  }

  return {
    unlocked,
    progress: Math.min(total, required),
    required,
    label,
  };
}
